import { notFound, redirect } from 'next/navigation';
import { LeaseBuilder } from '@/components/lease-builder';
import { UnitPicker } from '@/components/lease-builder/UnitPicker';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import {
  findOpenDraft,
  loadLeaseDraft,
  renewalDefaults,
  withResolvedEnd,
  type DraftSnapshot,
} from '@/lib/lease-create';
import { emptyDraft } from '@/lib/lease-create/types';
import { dateInput } from '@/lib/leases/core';
import { leaseName } from '@/lib/leases/format';
import { leasesDb } from '@/lib/leases/queries';
import { unitLabel } from '@/lib/properties/format';
import { listTemplates } from '@/lib/lease-create/template-service';
import type { TemplateDefinition, TemplateItem, TermOverride, TermsContext } from '@/lib/lease-create/templates';

export const dynamic = 'force-dynamic';

type Search = {
  draft?: string;
  renew?: string;
  unit?: string;
  applicant?: string;
  tenant?: string;
  fresh?: string;
};

export default async function NewLeasePage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireManagerRole();
  const organizationId = session.organizationId;
  const { draft: draftId, renew: renewId, unit: unitParam, applicant: applicantId, tenant: tenantParam, fresh } =
    await searchParams;

  const data = leasesDb(organizationId);
  const [options, source] = await Promise.all([
    data.formOptions(),
    renewId ? data.detail(renewId) : Promise.resolve(null),
  ]);
  if (renewId && (!source || source.status !== 'ACTIVE')) notFound();

  const applicant = applicantId
    ? await db.application.findFirst({ where: { id: applicantId, organizationId } })
    : null;
  const requestedUnitId = source?.unitId ?? unitParam ?? applicant?.unitId;

  // Coming back to a unit (or renewal) that already has an open draft resumes it.
  let snapshot: DraftSnapshot | null = null;
  if (draftId) {
    snapshot = await loadLeaseDraft(organizationId, draftId);
    if (!snapshot) {
      // A draft that has been sent is a normal lease now.
      const sent = await db.lease.findFirst({ where: { id: draftId, organizationId }, select: { id: true } });
      if (sent) redirect(`/leases/${sent.id}`);
      notFound();
    }
  } else if (!fresh && (renewId || requestedUnitId)) {
    const existing = await findOpenDraft(organizationId, {
      renewId: renewId || undefined,
      unitId: renewId ? undefined : requestedUnitId,
    });
    if (existing) redirect(`/leases/new?draft=${existing}`);
  }

  const applicantTenant = applicant
    ? options.tenants.find((t) => t.email?.toLowerCase() === applicant.applicantEmail.toLowerCase())
    : undefined;
  const unitId = snapshot?.unitId ?? requestedUnitId;
  const unit = unitId ? options.units.find((u) => u.id === unitId) : undefined;
  if (!unit) {
    return (
      <UnitPicker
        backHref="/leases"
        units={options.units.map((u) => ({
          id: u.id,
          label: unitLabel(u.property, u),
          status: u.status,
        }))}
      />
    );
  }

  const templateData = await listTemplates(organizationId);
  const propertyDefaultId = templateData.properties.find((p) => p.id === unit.propertyId)?.defaultLeaseTemplateId;
  const defaultTemplate = templateData.templates.find((t) => t.id === propertyDefaultId) ?? templateData.templates[0];

  let initial = snapshot?.draft;
  if (!initial) {
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    if (source) {
      initial = renewalDefaults(source);
      const signed = source.termsSnapshot && typeof source.termsSnapshot === 'object' && !Array.isArray(source.termsSnapshot)
        ? source.termsSnapshot as Record<string, unknown> : null;
      const priorContext = signed?.context as TermsContext | undefined;
      const carriedItems = Array.isArray(signed?.items) ? signed.items as TemplateItem[] : [];
      initial = { ...initial,
        template: signed?.template as TemplateDefinition ?? defaultTemplate,
        termOverrides: signed?.overrides as Record<string, TermOverride> ?? {},
        renewalTerms: carriedItems,
        options: (priorContext?.petsAllowed ?? carriedItems.some((item) => item.includeWhen === 'PETS_ALLOWED')) ? ['pets-allowed'] : [],
        assignedParking: priorContext?.assignedParking ?? carriedItems.some((item) => item.includeWhen === 'ASSIGNED_PARKING'),
        tenantUtilities: priorContext?.tenantUtilities ?? [],
        petDepositEnabled: Number(source.petDeposit) > 0,
        petDeposit: source.petDeposit.toString(),
      };
    } else {
      const org = await db.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      const rent = unit.listedRent?.toString() ?? '';
      const preselected =
        applicantTenant ?? (tenantParam ? options.tenants.find((t) => t.id === tenantParam) : undefined);
      initial = withResolvedEnd(
        emptyDraft({
          unitId: unit.id,
          startDate: dateInput(todayUtc),
          monthlyRent: rent,
          deposit: rent,
          tenantIds: preselected ? [preselected.id] : [],
          primaryTenantId: preselected?.id ?? '',
          lessorName: org?.name ?? '',
          lessorAddress: `${unit.property.street}, ${unit.property.city}, ${unit.property.state} ${unit.property.postalCode}`,
          template: defaultTemplate,
          lateFee: defaultTemplate.defaultFees.lateFee,
          graceDays: defaultTemplate.defaultFees.graceDays,
          moveInFeeEnabled: Number(defaultTemplate.defaultFees.moveInFee) > 0,
          moveInFee: defaultTemplate.defaultFees.moveInFee,
          petDepositEnabled: Number(defaultTemplate.defaultFees.petDeposit) > 0,
          petDeposit: defaultTemplate.defaultFees.petDeposit,
        }),
      );
    }
    initial = { ...initial, unitId: unit.id };
  }
  initial = { ...initial, propertyType: unit.property.type, yearBuilt: unit.property.yearBuilt };

  const attachments = snapshot
    ? (
        await db.document.findMany({
          where: { organizationId, leaseId: snapshot.leaseId, kind: { not: 'PHOTO' } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, sizeBytes: true, kind: true },
        })
      ).map((d) => ({
        id: d.id,
        name: d.name,
        sizeBytes: Number(d.sizeBytes),
        kind: d.kind === 'LEASE' || d.kind === 'ADDENDUM' || d.kind === 'DISCLOSURE' ? d.kind : 'OTHER' as const,
      }))
    : [];

  const renewSource =
    snapshot?.renewId && !source ? await data.detail(snapshot.renewId) : source;
  return (
    <LeaseBuilder
      key={snapshot?.leaseId ?? 'new'}
      placeLabel={unitLabel(unit.property, unit)}
      tenants={options.tenants.map((t) => ({ id: t.id, name: t.name, email: t.email }))}
      leaseId={snapshot?.leaseId ?? null}
      renewId={snapshot?.renewId ?? renewId ?? null}
      draft={initial}
      templates={templateData.templates}
      step={snapshot?.step ?? 0}
      furthestStep={snapshot?.furthestStep ?? 0}
      attachments={attachments}
      sourceLabel={
        renewSource
          ? `${leaseName(renewSource)} · ${unitLabel(renewSource.unit.property, renewSource.unit)}`
          : undefined
      }
      notice={
        applicant && !applicantTenant
          ? ` () isn’t a tenant yet. Add them as a tenant, then return here to select them.`
          : undefined
      }
      backHref={`/properties/${unit.propertyId}/leases`}
      exitHref="/leases?tab=drafts"
    />
  );
}
