'use server';

import { requireManagerRole } from '@/lib/auth/access';
import { LeaseServiceError } from '@/lib/leases/service';
import { activateDraftLease, coerceDraft, saveLeaseDraft } from '@/lib/lease-create/drafts';
import { STEP } from '@/lib/lease-create/types';
import { getLeaseSignStatus, sendLeaseForSignature } from '@/lib/esign/service';
import { EsignError } from '@/lib/esign/types';
import { getTemplate, saveTemplate } from '@/lib/lease-create/template-service';
import { contextFromDraft, resolveTerms } from '@/lib/lease-create/templates';

export async function saveTemplateFromDraftAction(input: { name: string; draft: unknown }) {
  const session = await requireManagerRole();
  try {
    const draft = coerceDraft(input.draft);
    if (!draft.template) return { error: 'Choose a template first.' };
    const resolved = resolveTerms(draft.template, contextFromDraft(draft), draft.termOverrides)
      .filter((item) => item.included)
      .map((item, index) => ({
        id: item.id,
        section: item.section,
        title: item.title,
        body: item.body,
        order: index,
        required: item.required,
        includeWhen: item.includeWhen,
      }));
    const saved = await saveTemplate(session.organizationId, {
      name: input.name,
      items: resolved,
      defaultFees: draft.template.defaultFees,
    });
    const template = await getTemplate(session.organizationId, saved.id);
    if (!template) return { error: 'The new template could not be loaded.' };
    return { template };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save template.' };
  }
}

export type WizardActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  leaseId?: string;
  esignStatus?: string;
};

export type SaveStepResult = {
  ok: boolean;
  leaseId?: string;
  step?: number;
  furthestStep?: number;
  errors?: Record<string, string>;
  message?: string;
};

type SaveStepInput = {
  leaseId?: string;
  renewId?: string;
  step: number;
  nextStep: number;
  draft: unknown;
  strict: boolean;
};

/** Saves one wizard step as the lease draft; Next validates the step, Save and exit saves as is. */
export async function saveWizardStepAction(input: SaveStepInput): Promise<SaveStepResult> {
  const session = await requireManagerRole();
  try {
    const result = await saveLeaseDraft(session.organizationId, {
      leaseId: input.leaseId || undefined,
      renewId: input.renewId || undefined,
      step: Number(input.step),
      nextStep: Number(input.nextStep),
      draft: coerceDraft(input.draft),
      strict: Boolean(input.strict),
    });
    if (!result.ok)
      return { ok: false, errors: result.errors, message: 'Please fix the highlighted fields.' };
    return {
      ok: true,
      leaseId: result.leaseId,
      step: result.step,
      furthestStep: result.furthestStep,
    };
  } catch (error) {
    if (error instanceof LeaseServiceError)
      return {
        ok: false,
        message: error.message,
        errors: error.field ? { [error.field]: error.message } : {},
      };
    throw error;
  }
}

/** Activates the draft (ledger charges included) and sends it for e-signature. */
export async function sendWizardLeaseAction(input: {
  leaseId: string;
  renewId?: string;
  draft: unknown;
}): Promise<WizardActionState> {
  const session = await requireManagerRole();
  const leaseId = String(input.leaseId ?? '');
  try {
    const draft = coerceDraft(input.draft);
    const saved = await saveLeaseDraft(session.organizationId, {
      leaseId,
      step: STEP.review,
      nextStep: STEP.review,
      draft,
      strict: false,
    });
    if (!saved.ok) return { message: 'Please fix the highlighted fields.', errors: saved.errors };
    const activated = await activateDraftLease(session.organizationId, leaseId, draft);
    if (!activated.ok)
      return { message: 'Please fix the highlighted fields.', errors: activated.errors };
    try {
      const envelope = await sendLeaseForSignature(session.organizationId, leaseId);
      return {
        ok: true,
        leaseId,
        esignStatus: envelope.status,
        message:
          'Agreement ready for the owner / lessor and each tenant to review and sign from their own accounts. No email or text notification was sent.',
      };
    } catch (error) {
      if (!(error instanceof EsignError)) throw error;
      return {
        ok: true,
        leaseId,
        esignStatus: 'NOT_SENT',
        message: `The lease is active but was not sent: ${error.message}`,
        errors: error.field ? { [error.field]: error.message } : {},
      };
    }
  } catch (error) {
    if (error instanceof LeaseServiceError)
      return {
        message: error.message,
        errors: error.field ? { [error.field]: error.message } : {},
      };
    throw error;
  }
}

export async function prepareSigningAction(leaseId: string): Promise<WizardActionState> {
  const session = await requireManagerRole();
  try {
    const envelope = await sendLeaseForSignature(session.organizationId, leaseId);
    return { ok: true, leaseId, esignStatus: envelope.status };
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
