'use server';

import { revalidatePath } from 'next/cache';
import { requireManagerRole } from '@/lib/auth/access';
import { LeaseServiceError } from '@/lib/leases/service';
import { db } from '@/lib/db/client';
import { createLeaseFromWizard, createRenewalFromWizard } from '@/lib/lease-create/service';
import { validateReview } from '@/lib/lease-create/validation';
import type { WizardDraft } from '@/lib/lease-create/types';
import {
  completeMockSigning,
  getLeaseSignStatus,
  sendLeaseForSignature,
} from '@/lib/esign/service';
import { EsignError } from '@/lib/esign/types';
import { actorFromSession } from '@/lib/storage/http';

export type WizardActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  leaseId?: string;
  esignStatus?: string;
  intent?: string;
};

function draftFromForm(form: FormData): WizardDraft {
  const tenantIds = form.getAll('tenantIds').map(String).filter(Boolean);
  return {
    unitId: String(form.get('unitId') ?? ''),
    tenantIds,
    primaryTenantId: String(form.get('primaryTenantId') ?? tenantIds[0] ?? ''),
    leaseType: form.get('leaseType') === 'month-to-month' ? 'month-to-month' : 'fixed',
    startDate: String(form.get('startDate') ?? ''),
    endDate: String(form.get('endDate') ?? ''),
    renewalNoticeDays: Number(form.get('renewalNoticeDays') ?? 60),
    monthlyRent: String(form.get('monthlyRent') ?? ''),
    deposit: String(form.get('deposit') ?? ''),
    lateFee: String(form.get('lateFee') ?? '0'),
    graceDays: Number(form.get('graceDays') ?? 0),
    rentDueDay: Number(form.get('rentDueDay') ?? 1),
    clauses: form.getAll('clauses').map(String).filter(Boolean),
    customClause: String(form.get('customClause') ?? ''),
    documentNames: form
      .getAll('documentNames')
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

async function uploadExtraDocuments(
  session: Awaited<ReturnType<typeof requireManagerRole>>,
  leaseId: string,
  form: FormData,
) {
  const files = form.getAll('documents').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return;
  const { createPrismaFileService } = await import('@/lib/storage/service');
  const service = await createPrismaFileService();
  const actor = actorFromSession(session);
  for (const file of files) {
    await service.upload(actor, {
      target: { kind: 'lease', id: leaseId },
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      kind: 'LEASE',
      body: new Uint8Array(await file.arrayBuffer()),
    });
  }
}

export async function submitWizardAction(
  _prev: WizardActionState,
  form: FormData,
): Promise<WizardActionState> {
  const session = await requireManagerRole();
  const intent = form.get('intent') === 'send' ? 'send' : 'draft';
  const renewId = String(form.get('renewId') ?? '');
  const draft = draftFromForm(form);
  try {
    let sourceEnd: Date | null = null;
    if (renewId) {
      const source = await db.lease.findFirst({
        where: { id: renewId, organizationId: session.organizationId, status: 'ACTIVE' },
        select: { endDate: true, unitId: true },
      });
      if (!source) return { message: 'Only an active lease can be renewed.', intent };
      sourceEnd = source.endDate;
      draft.unitId = source.unitId;
    }
    const tenants = draft.tenantIds.length
      ? await db.tenant.findMany({
          where: { id: { in: draft.tenantIds }, organizationId: session.organizationId },
          select: { id: true, name: true, email: true },
        })
      : [];
    const errors = validateReview(draft, {
      tenants,
      renewalSourceEnd: sourceEnd,
      isRenewal: Boolean(renewId),
    });
    if (intent === 'draft') delete errors.primaryTenantId;
    if (Object.keys(errors).length)
      return { message: 'Please fix the highlighted fields.', errors, intent };

    const status = intent === 'send' ? 'ACTIVE' : 'DRAFT';
    const { id } = renewId
      ? await createRenewalFromWizard(session.organizationId, renewId, draft, status)
      : await createLeaseFromWizard(session.organizationId, draft, status);

    await uploadExtraDocuments(session, id, form);

    let esignStatus: string = 'NOT_SENT';
    if (intent === 'send') {
      const envelope = await sendLeaseForSignature(session.organizationId, id);
      esignStatus = envelope.status;
    }
    revalidatePath('/leases');
    revalidatePath(`/leases/${id}`);
    return {
      ok: true,
      leaseId: id,
      esignStatus,
      intent,
      message:
        intent === 'send'
          ? 'Lease created and sent for e-signature through the mock provider. Complete mock signing below to store the signed lease PDF.'
          : 'Draft lease saved. You can review it from the lease detail page.',
    };
  } catch (error) {
    if (error instanceof LeaseServiceError)
      return {
        message: error.message,
        errors: error.field ? { [error.field]: error.message } : {},
        intent,
      };
    if (error instanceof EsignError)
      return {
        message: error.message,
        errors: error.field ? { [error.field]: error.message } : {},
        intent,
      };
    throw error;
  }
}

export async function completeSigningAction(
  _prev: WizardActionState,
  form: FormData,
): Promise<WizardActionState> {
  const session = await requireManagerRole();
  const leaseId = String(form.get('leaseId') ?? '');
  try {
    const envelope = await completeMockSigning(
      session.organizationId,
      actorFromSession(session),
      leaseId,
    );
    revalidatePath('/leases');
    revalidatePath(`/leases/${leaseId}`);
    return {
      ok: true,
      leaseId,
      esignStatus: envelope.status,
      message: 'Mock signing complete. The signed lease PDF is stored as a lease document.',
    };
  } catch (error) {
    if (error instanceof EsignError) return { message: error.message, leaseId };
    throw error;
  }
}

export async function signingStatusAction(leaseId: string): Promise<string> {
  const session = await requireManagerRole();
  const envelope = await getLeaseSignStatus(session.organizationId, leaseId);
  return envelope.status;
}
