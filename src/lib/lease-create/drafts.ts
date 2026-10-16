import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { recordLeaseEvents } from '@/lib/leases/events';
import { LeaseServiceError } from '@/lib/leases/service';
import { parseLeaseDate, parseMoney } from '@/lib/leases/core';
import { ensureSetupCharges } from '@/lib/ledger/lease-setup';
import { feesFromDraft } from './fees';
import { STEP_COUNT, emptyDraft, type WizardDraft, type WizardErrors } from './types';
import {
  endOptionDates,
  hasOverlap,
  parseWizardTerms,
  validateReview,
  validateStep,
  withResolvedEnd,
} from './validation';

const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const bool = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;
const strings = (value: unknown, fallback: string[] = []) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : fallback;
const int = (value: unknown, fallback: number) => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) ? n : fallback;
};

/** Rebuilds a draft from untrusted JSON (a client payload or a stored row), filling gaps with defaults. */
export function coerceDraft(raw: unknown): WizardDraft {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = emptyDraft();
  const endOption =
    r.endOption === 'month-to-month' || r.endOption === 'custom' ? r.endOption : 'full-year';
  return withResolvedEnd({
    unitId: str(r.unitId),
    tenantIds: strings(r.tenantIds),
    primaryTenantId: str(r.primaryTenantId),
    leaseType: 'fixed',
    startDate: str(r.startDate),
    endDate: '',
    endOption,
    customEndDate: str(r.customEndDate),
    renewalNoticeDays: int(r.renewalNoticeDays, d.renewalNoticeDays),
    monthlyRent: str(r.monthlyRent),
    deposit: str(r.deposit),
    lateFee: str(r.lateFee, d.lateFee),
    lateFeeEnabled: bool(r.lateFeeEnabled, d.lateFeeEnabled),
    graceDays: int(r.graceDays, d.graceDays),
    rentDueDay: int(r.rentDueDay, d.rentDueDay),
    prorateFirstMonth: bool(r.prorateFirstMonth, d.prorateFirstMonth),
    moveInFeeEnabled: bool(r.moveInFeeEnabled, false),
    moveInFee: str(r.moveInFee),
    petDepositEnabled: bool(r.petDepositEnabled, false),
    petDeposit: str(r.petDeposit),
    occupants: str(r.occupants),
    options: strings(r.options),
    clauses: strings(r.clauses, d.clauses),
    customClause: str(r.customClause),
    rules: strings(r.rules),
    customRules: str(r.customRules),
    disclosures: strings(r.disclosures),
    lessorName: str(r.lessorName),
    lessorAddress: str(r.lessorAddress),
    lessorPhone: str(r.lessorPhone),
    lessorEmail: str(r.lessorEmail),
    documentNames: strings(r.documentNames),
  });
}

export type DraftSnapshot = {
  leaseId: string;
  unitId: string;
  renewId: string | null;
  step: number;
  furthestStep: number;
  draft: WizardDraft;
};

type StoredData = { draft: unknown; renewId: string | null };

const clampStep = (step: number) => Math.min(STEP_COUNT - 1, Math.max(0, Math.trunc(step) || 0));

const storedData = (value: Prisma.JsonValue): StoredData => {
  const obj = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<
    string,
    unknown
  >;
  return { draft: obj.draft, renewId: typeof obj.renewId === 'string' ? obj.renewId : null };
};

/** The wizard state saved on a DRAFT lease, or null when the lease is not an open draft. */
export async function loadLeaseDraft(
  organizationId: string,
  leaseId: string,
  client: PrismaClient = db,
): Promise<DraftSnapshot | null> {
  const lease = await client.lease.findFirst({
    where: { id: leaseId, organizationId, status: 'DRAFT' },
    include: { draft: true, tenants: true },
  });
  if (!lease) return null;
  if (!lease.draft) {
    // A draft saved before the wizard kept its own state: rebuild it from the lease columns.
    const start = lease.startDate.toISOString().slice(0, 10);
    const end = lease.endDate.toISOString().slice(0, 10);
    const dates = endOptionDates(start);
    const late = Number(lease.lateFee.toString());
    return {
      leaseId: lease.id,
      unitId: lease.unitId,
      renewId: null,
      step: 0,
      furthestStep: 0,
      draft: withResolvedEnd(
        emptyDraft({
          unitId: lease.unitId,
          tenantIds: lease.tenants.map((t) => t.tenantId),
          primaryTenantId: lease.tenants.find((t) => t.isPrimary)?.tenantId ?? '',
          startDate: start,
          endOption:
            end === dates.fullYear ? 'full-year' : end === dates.monthToMonth ? 'month-to-month' : 'custom',
          customEndDate: end,
          monthlyRent: lease.monthlyRent.toString(),
          deposit: lease.deposit.toString(),
          lateFee: late > 0 ? lease.lateFee.toString() : '75',
          lateFeeEnabled: late > 0,
          graceDays: lease.graceDays,
          occupants: lease.occupants ?? '',
        }),
      ),
    };
  }
  const data = storedData(lease.draft.data);
  return {
    leaseId: lease.id,
    unitId: lease.unitId,
    renewId: data.renewId,
    step: clampStep(lease.draft.step),
    furthestStep: clampStep(lease.draft.furthestStep),
    draft: { ...coerceDraft(data.draft), unitId: lease.unitId },
  };
}

/** The newest open draft for a unit (or for a renewal), so a manager who comes back resumes it. */
export async function findOpenDraft(
  organizationId: string,
  where: { unitId?: string; renewId?: string },
  client: PrismaClient = db,
): Promise<string | null> {
  if (!where.unitId && !where.renewId) return null;
  let unitId = where.unitId;
  if (where.renewId) {
    const source = await client.lease.findFirst({
      where: { id: where.renewId, organizationId },
      select: { unitId: true },
    });
    if (!source) return null;
    unitId = source.unitId;
  }
  const drafts = await client.lease.findMany({
    where: { organizationId, unitId, status: 'DRAFT', draft: { isNot: null } },
    include: { draft: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const match = drafts.find(
    (lease) => lease.draft && storedData(lease.draft.data).renewId === (where.renewId ?? null),
  );
  return match?.id ?? null;
}

export type SaveDraftInput = {
  leaseId?: string;
  renewId?: string;
  /** The step being saved. */
  step: number;
  /** The step to resume on next time. */
  nextStep: number;
  draft: WizardDraft;
  /** Validate the saved step; Save and exit saves what is there instead. */
  strict: boolean;
};

export type SaveDraftResult =
  | { ok: true; leaseId: string; step: number; furthestStep: number }
  | { ok: false; errors: WizardErrors };

async function lockUnit(tx: Prisma.TransactionClient, organizationId: string, unitId: string) {
  const { count } = await tx.unit.updateMany({
    where: { id: unitId, organizationId, status: { not: 'ARCHIVED' } },
    data: { updatedAt: new Date() },
  });
  if (!count) throw new LeaseServiceError('Unit not found or archived.', 'unitId');
}

async function renewalSource(
  tx: Prisma.TransactionClient,
  organizationId: string,
  renewId: string,
) {
  const source = await tx.lease.findFirst({
    where: { id: renewId, organizationId, status: 'ACTIVE' },
    include: { tenants: true },
  });
  if (!source) throw new LeaseServiceError('Only an active lease can be renewed.');
  return source;
}

/**
 * Saves one wizard step on a DRAFT lease. The lease row is created the first time (it needs a unit
 * and valid dates) and every save keeps the lease columns and the wizard state in step, so leaving
 * and coming back resumes on `nextStep` with everything entered so far.
 */
export async function saveLeaseDraft(
  organizationId: string,
  input: SaveDraftInput,
  client: PrismaClient = db,
): Promise<SaveDraftResult> {
  const draft = withResolvedEnd(input.draft);
  const step = clampStep(input.step);
  const nextStep = clampStep(input.nextStep);
  return client.$transaction(async (tx) => {
    const existing = input.leaseId
      ? await tx.lease.findFirst({
          where: { id: input.leaseId, organizationId, status: 'DRAFT' },
          include: { draft: true },
        })
      : null;
    if (input.leaseId && !existing) throw new LeaseServiceError('This draft is no longer open.');
    const renewId = existing?.draft
      ? storedData(existing.draft.data).renewId
      : (input.renewId ?? null);
    const source = renewId ? await renewalSource(tx, organizationId, renewId) : null;
    const unitId = existing?.unitId ?? source?.unitId ?? draft.unitId;
    if (!unitId) return { ok: false, errors: { unitId: 'Select a unit for this lease.' } };
    draft.unitId = unitId;

    const tenants = draft.tenantIds.length
      ? await tx.tenant.findMany({
          where: { id: { in: draft.tenantIds }, organizationId },
          select: { id: true },
        })
      : [];
    const known = new Set(tenants.map((t) => t.id));
    if (input.strict) {
      const errors = validateStep(step, draft, {
        isRenewal: Boolean(renewId),
        renewalSourceEnd: source?.endDate ?? null,
      });
      if (draft.tenantIds.some((id) => !known.has(id))) errors.tenantIds = 'Tenant not found.';
      if (Object.keys(errors).length) return { ok: false, errors };
    }
    const tenantIds = draft.tenantIds.filter((id) => known.has(id));
    const primaryTenantId = tenantIds.includes(draft.primaryTenantId)
      ? draft.primaryTenantId
      : (tenantIds[0] ?? '');

    // Lease columns follow the draft wherever the draft holds a valid value.
    const start = parseLeaseDate(draft.startDate);
    const end = parseLeaseDate(draft.endDate);
    const datesOk = Boolean(start && end && end >= start);
    const rent = parseMoney(draft.monthlyRent);
    const deposit = parseMoney(draft.deposit);
    const lateFee = draft.lateFeeEnabled ? parseMoney(draft.lateFee || '0') : '0.00';
    const columns: Prisma.LeaseUncheckedUpdateInput = {
      ...(datesOk ? { startDate: start as Date, endDate: end as Date } : {}),
      ...(rent ? { monthlyRent: rent } : {}),
      ...(deposit ? { deposit } : {}),
      ...(lateFee ? { lateFee } : {}),
      ...(Number.isInteger(draft.graceDays) && draft.graceDays >= 0 && draft.graceDays <= 31
        ? { graceDays: draft.graceDays }
        : {}),
      occupants: draft.occupants.trim() || null,
    };

    let leaseId = existing?.id ?? '';
    if (!existing) {
      if (!datesOk)
        return {
          ok: false,
          errors: {
            startDate: start ? '' : 'Enter a valid start date.',
            endDate: 'Enter a valid end date on or after the start date.',
          },
        };
      await lockUnit(tx, organizationId, unitId);
      const created = await tx.lease.create({
        data: {
          organizationId,
          unitId,
          startDate: start as Date,
          endDate: end as Date,
          monthlyRent: rent ?? '0.00',
          deposit: deposit ?? '0.00',
          lateFee: lateFee ?? '0.00',
          graceDays: columns.graceDays as number | undefined,
          occupants: draft.occupants.trim() || null,
          status: 'DRAFT',
        },
        select: { id: true },
      });
      leaseId = created.id;
      await recordLeaseEvents(tx, organizationId, leaseId, [
        { kind: 'CREATED', message: renewId ? 'Saved as a renewal draft' : 'Saved as draft' },
      ]);
    } else {
      await tx.lease.update({ where: { id: leaseId }, data: columns });
    }

    await tx.leaseTenant.deleteMany({ where: { leaseId, organizationId } });
    if (tenantIds.length)
      await tx.leaseTenant.createMany({
        data: tenantIds.map((tenantId) => ({
          organizationId,
          leaseId,
          tenantId,
          isPrimary: tenantId === primaryTenantId,
        })),
      });

    const furthestStep = Math.max(existing?.draft?.furthestStep ?? 0, nextStep);
    const stored = { ...draft, tenantIds, primaryTenantId };
    const data = { draft: stored, renewId } as unknown as Prisma.InputJsonValue;
    await tx.leaseDraft.upsert({
      where: { leaseId },
      create: { leaseId, organizationId, step: nextStep, furthestStep, data },
      update: { step: nextStep, furthestStep, data },
    });
    return { ok: true, leaseId, step: nextStep, furthestStep };
  });
}

export type ActivateResult = { ok: true; id: string } | { ok: false; errors: WizardErrors };

/**
 * Turns a draft into an active lease for sending: validates the whole wizard, checks the unit is
 * free, creates the move-in charges in the ledger (once) and marks the unit occupied.
 */
export async function activateDraftLease(
  organizationId: string,
  leaseId: string,
  rawDraft: WizardDraft,
  client: PrismaClient = db,
): Promise<ActivateResult> {
  const draft = withResolvedEnd(rawDraft);
  return client.$transaction(async (tx) => {
    const lease = await tx.lease.findFirst({
      where: { id: leaseId, organizationId, status: 'DRAFT' },
      include: { draft: true },
    });
    if (!lease) throw new LeaseServiceError('This draft is no longer open.');
    const renewId = lease.draft ? storedData(lease.draft.data).renewId : null;
    const source = renewId ? await renewalSource(tx, organizationId, renewId) : null;
    draft.unitId = lease.unitId;
    const tenants = await tx.tenant.findMany({
      where: { id: { in: draft.tenantIds }, organizationId },
      select: { id: true, name: true, email: true },
    });
    const errors = validateReview(draft, {
      tenants,
      isRenewal: Boolean(renewId),
      renewalSourceEnd: source?.endDate ?? null,
    });
    if (tenants.length !== new Set(draft.tenantIds).size) errors.tenantIds = 'Tenant not found.';
    if (Object.keys(errors).length) return { ok: false, errors };
    const terms = parseWizardTerms(draft);
    if (!terms) return { ok: false, errors: { startDate: 'Please fix the highlighted fields.' } };

    await lockUnit(tx, organizationId, lease.unitId);
    const active = await tx.lease.findMany({
      where: { organizationId, unitId: lease.unitId, status: 'ACTIVE' },
      select: { startDate: true, endDate: true },
    });
    if (hasOverlap(terms, active))
      throw new LeaseServiceError(
        'This unit already has an active lease during those dates.',
        'startDate',
      );
    await tx.lease.update({
      where: { id: leaseId },
      data: { ...terms, status: 'ACTIVE' },
    });
    await tx.leaseTenant.deleteMany({ where: { leaseId, organizationId } });
    await tx.leaseTenant.createMany({
      data: draft.tenantIds.map((tenantId) => ({
        organizationId,
        leaseId,
        tenantId,
        isPrimary: tenantId === draft.primaryTenantId,
      })),
    });
    if (!source)
      await tx.unit.updateMany({
        where: { id: lease.unitId, organizationId },
        data: { status: 'OCCUPIED' },
      });
    await ensureSetupCharges(tx, {
      organizationId,
      leaseId,
      startDate: terms.startDate,
      endDate: terms.endDate,
      fees: feesFromDraft(draft),
    });
    if (source) {
      await recordLeaseEvents(tx, organizationId, leaseId, [
        { kind: 'RENEWED', message: `Renews lease ${source.id}` },
      ]);
      await recordLeaseEvents(tx, organizationId, source.id, [
        { kind: 'RENEWED', message: `Renewal ${leaseId} created` },
      ]);
    } else {
      await recordLeaseEvents(tx, organizationId, leaseId, [
        { kind: 'CREATED', message: 'Created from wizard' },
      ]);
    }
    return { ok: true, id: leaseId };
  });
}
