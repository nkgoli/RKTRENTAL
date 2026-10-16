import { Prisma, type PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { paymentsProvider } from '@/lib/providers';
import { unitScopeWhere, type ScopeFilter } from '@/lib/workspace/scope';
import type { PaymentsProvider } from '@/lib/providers/types';
import {
  assertCents,
  assessLateFee,
  centsToDecimal,
  computeBalance,
  manualPaymentRef,
  monthKey,
  monthStart,
  addMonths,
  planLateFees,
  planOwnerPayout,
  planRefund,
  planRentCharges,
  refundRef,
  rentKey,
  rentStatus,
  toCents,
  type Cents,
  type LateFeeDecision,
  type LeaseTerms,
  type LedgerCharge,
  type LedgerPayment,
  type PayoutPlan,
  type RentStatus,
} from './core';

type Tx = Prisma.TransactionClient;
type Client = PrismaClient;

// ---------------------------------------------------------------------------------------- mapping

type LeaseRow = {
  id: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: { toString(): string };
  lateFee: { toString(): string };
  graceDays: number;
  rentDueDay?: number;
  status: LeaseTerms['status'];
};

export const leaseTerms = (lease: LeaseRow): LeaseTerms => ({
  id: lease.id,
  startDate: lease.startDate,
  endDate: lease.endDate,
  monthlyRentCents: toCents(lease.monthlyRent),
  lateFeeCents: toCents(lease.lateFee),
  graceDays: lease.graceDays,
  rentDueDay: lease.rentDueDay ?? 1,
  status: lease.status,
});

export const toLedgerCharge = (row: {
  id: string;
  leaseId: string;
  kind: LedgerCharge['kind'];
  amount: { toString(): string };
  dueDate: Date;
  description: string | null;
}): LedgerCharge => ({
  id: row.id,
  leaseId: row.leaseId,
  kind: row.kind,
  amountCents: toCents(row.amount),
  dueDate: row.dueDate,
  description: row.description,
});

export const toLedgerPayment = (row: {
  id: string;
  leaseId: string;
  amount: { toString(): string };
  status: LedgerPayment['status'];
  paidAt: Date | null;
  createdAt: Date;
  providerReference: string | null;
}): LedgerPayment => ({
  id: row.id,
  leaseId: row.leaseId,
  amountCents: toCents(row.amount),
  status: row.status,
  paidAt: row.paidAt,
  createdAt: row.createdAt,
  providerReference: row.providerReference,
});

/** Serialises writers for one key for the rest of the transaction (Postgres advisory lock). */
async function lock(tx: Tx, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

// ---------------------------------------------------------------------------------------- charges

/**
 * Creates any missing monthly rent charges for the organization's active leases. Safe to call on
 * every page load or from a scheduler: charges already present (by deterministic key) are skipped.
 */
export async function ensureRentCharges(
  organizationId: string,
  asOf: Date,
  client: Client = db,
): Promise<number> {
  return client.$transaction(async (tx) => {
    await lock(tx, `ledger:${organizationId}`);
    const leases = await tx.lease.findMany({
      where: { organizationId, status: 'ACTIVE', startDate: { lte: asOf } },
    });
    if (!leases.length) return 0;
    const ids = leases.map((l) => l.id);
    const [charges, payments] = await Promise.all([
      tx.charge.findMany({ where: { organizationId, leaseId: { in: ids }, kind: 'RENT' } }),
      tx.payment.findMany({ where: { organizationId, leaseId: { in: ids } } }),
    ]);
    const data: Prisma.ChargeCreateManyInput[] = [];
    for (const lease of leases) {
      const planned = planRentCharges(
        leaseTerms(lease),
        charges.filter((c) => c.leaseId === lease.id).map(toLedgerCharge),
        payments.filter((p) => p.leaseId === lease.id).map(toLedgerPayment),
        asOf,
      );
      for (const charge of planned)
        data.push({
          organizationId,
          leaseId: charge.leaseId,
          kind: charge.kind,
          amount: centsToDecimal(charge.amountCents),
          dueDate: charge.dueDate,
          description: charge.description,
        });
    }
    if (data.length) await tx.charge.createMany({ data });
    return data.length;
  });
}

async function loadLeaseLedger(tx: Tx, organizationId: string, leaseId: string) {
  const lease = await tx.lease.findFirst({ where: { id: leaseId, organizationId } });
  if (!lease) throw new Error('Lease not found');
  const [charges, payments] = await Promise.all([
    tx.charge.findMany({ where: { organizationId, leaseId } }),
    tx.payment.findMany({ where: { organizationId, leaseId } }),
  ]);
  return {
    lease: leaseTerms(lease),
    charges: charges.map(toLedgerCharge),
    payments: payments.map(toLedgerPayment),
  };
}

/** Adds the lease's late fee for one rent month if it is due. Returns the decision either way. */
export async function applyLateFee(
  input: { organizationId: string; leaseId: string; month: string; asOf: Date },
  client: Client = db,
): Promise<LateFeeDecision> {
  const { organizationId, leaseId, month, asOf } = input;
  return client.$transaction(async (tx) => {
    await lock(tx, `lease:${leaseId}`);
    const { lease, charges, payments } = await loadLeaseLedger(tx, organizationId, leaseId);
    const decision = assessLateFee(lease, month, charges, payments, asOf);
    if (decision.eligible)
      await tx.charge.create({
        data: {
          organizationId,
          leaseId,
          kind: decision.fee.kind,
          amount: centsToDecimal(decision.fee.amountCents),
          dueDate: decision.fee.dueDate,
          description: decision.fee.description,
        },
      });
    return decision;
  });
}

/** Batch version: assess every active lease. Idempotent because each fee has a per-month key. */
export async function applyAllLateFees(
  organizationId: string,
  asOf: Date,
  client: Client = db,
): Promise<number> {
  return client.$transaction(async (tx) => {
    await lock(tx, `ledger:${organizationId}`);
    const leases = await tx.lease.findMany({ where: { organizationId, status: 'ACTIVE' } });
    let created = 0;
    for (const row of leases) {
      const [charges, payments] = await Promise.all([
        tx.charge.findMany({ where: { organizationId, leaseId: row.id } }),
        tx.payment.findMany({ where: { organizationId, leaseId: row.id } }),
      ]);
      const fees = planLateFees(
        leaseTerms(row),
        charges.map(toLedgerCharge),
        payments.map(toLedgerPayment),
        asOf,
      );
      for (const fee of fees) {
        await tx.charge.create({
          data: {
            organizationId,
            leaseId: fee.leaseId,
            kind: fee.kind,
            amount: centsToDecimal(fee.amountCents),
            dueDate: fee.dueDate,
            description: fee.description,
          },
        });
        created += 1;
      }
    }
    return created;
  });
}

// ---------------------------------------------------------------------------------------- payments

/**
 * Records an offline (cash/check) payment. The idempotency key makes a double submit return the
 * original payment instead of recording it twice.
 */
export async function recordPayment(
  input: {
    organizationId: string;
    leaseId: string;
    amountCents: Cents;
    idempotencyKey: string;
    paidAt?: Date;
  },
  client: Client = db,
): Promise<{ paymentId: string; duplicate: boolean }> {
  const { organizationId, leaseId, amountCents, idempotencyKey } = input;
  assertCents(amountCents);
  if (amountCents <= 0) throw new Error('Payment must be greater than zero');
  if (!idempotencyKey.trim()) throw new Error('Idempotency key required');
  const providerReference = manualPaymentRef(`${leaseId}:${idempotencyKey}`);
  const lease = await client.lease.findFirst({ where: { id: leaseId, organizationId } });
  if (!lease) throw new Error('Lease not found');
  try {
    const payment = await client.payment.create({
      data: {
        organizationId,
        leaseId,
        amount: centsToDecimal(amountCents),
        status: 'SUCCEEDED',
        providerReference,
        paidAt: input.paidAt ?? new Date(),
      },
    });
    return { paymentId: payment.id, duplicate: false };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await client.payment.findUnique({ where: { providerReference } });
    if (existing?.organizationId !== organizationId || toCents(existing.amount) !== amountCents)
      throw new Error('Idempotency key already used for a different payment');
    return { paymentId: existing.id, duplicate: true };
  }
}

/**
 * Refunds all or part of a settled payment. Provider-processed payments go through the
 * PaymentsProvider (idempotent on the same key); offline payments are only adjusted in the ledger.
 */
export async function refundPayment(
  input: {
    organizationId: string;
    paymentId: string;
    amountCents?: Cents;
    idempotencyKey: string;
  },
  options: { client?: Client; provider?: PaymentsProvider } = {},
): Promise<{ refundedCents: Cents; duplicate: boolean }> {
  const client = options.client ?? db;
  const { organizationId, paymentId, idempotencyKey } = input;
  const row = await client.payment.findFirst({ where: { id: paymentId, organizationId } });
  if (!row) throw new Error('Payment not found');
  const amountCents = toCents(row.amount);
  const plan = planRefund(
    { id: row.id, amountCents, status: row.status },
    input.amountCents,
    idempotencyKey,
  );
  if (plan.kind === 'noop') return { refundedCents: 0, duplicate: true };

  const external = row.providerReference && !row.providerReference.startsWith('manual:');
  if (external) {
    const provider = options.provider ?? (await paymentsProvider(organizationId));
    await provider.refund({
      chargeId: row.providerReference as string,
      amountCents: plan.refundCents,
      idempotencyKey: refundRef(paymentId, idempotencyKey),
    });
  }

  return client.$transaction(async (tx) => {
    await lock(tx, `payment:${paymentId}`);
    const current = await tx.payment.findFirstOrThrow({ where: { id: paymentId, organizationId } });
    if (plan.kind === 'full') {
      if (current.status !== 'SUCCEEDED') return { refundedCents: 0, duplicate: true };
      await tx.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });
      return { refundedCents: plan.refundCents, duplicate: false };
    }
    const done = await tx.payment.findUnique({
      where: { providerReference: plan.refundReference },
    });
    if (done) return { refundedCents: 0, duplicate: true };
    if (current.status !== 'SUCCEEDED' || toCents(current.amount) !== amountCents)
      throw new Error('Payment changed; reload and try again');
    await tx.payment.update({
      where: { id: paymentId },
      data: { amount: centsToDecimal(plan.remainingCents) },
    });
    await tx.payment.create({
      data: {
        organizationId,
        leaseId: current.leaseId,
        amount: centsToDecimal(plan.refundCents),
        status: 'REFUNDED',
        providerReference: plan.refundReference,
        paidAt: new Date(),
      },
    });
    return { refundedCents: plan.refundCents, duplicate: false };
  });
}

// ---------------------------------------------------------------------------------------- payouts

export type OwnerPayoutRow = PayoutPlan & {
  propertyName: string;
  ownerName: string | null;
};

async function payoutPlans(organizationId: string, month: string, client: Client) {
  const start = monthStart(month);
  const end = monthStart(addMonths(month, 1));
  const [properties, payouts] = await Promise.all([
    client.property.findMany({
      where: { organizationId, archivedAt: null },
      include: {
        owner: true,
        units: {
          include: {
            leases: {
              include: {
                payments: { where: { status: 'SUCCEEDED', paidAt: { gte: start, lt: end } } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    client.payout.findMany({ where: { organizationId } }),
  ]);
  const decoded = payouts.map((p) => ({
    status: p.status,
    propertyId: p.propertyId,
    month: p.month,
    cents: toCents(p.amount),
  }));
  return properties.map((property): OwnerPayoutRow => {
    const payments = property.units.flatMap((u) =>
      u.leases.flatMap((l) => l.payments.map(toLedgerPayment)),
    );
    const plan = planOwnerPayout({
      propertyId: property.id,
      month,
      payments,
      priorPayoutCents: decoded
        .filter((p) => p.propertyId === property.id && p.month === month && p.status !== 'failed')
        .map((p) => p.cents),
    });
    return { ...plan, propertyName: property.name, ownerName: property.owner?.name ?? null };
  });
}

export const ownerPayouts = (organizationId: string, month: string, client: Client = db) =>
  payoutPlans(organizationId, month, client);

/**
 * Sends every property's ready amount to its owner through the PaymentsProvider. The provider call
 * carries a deterministic idempotency key, so re-running with unchanged money sends nothing twice.
 */
export async function runOwnerPayouts(
  organizationId: string,
  month: string,
  options: { client?: Client; provider?: PaymentsProvider } = {},
): Promise<{ sent: number; totalCents: Cents }> {
  const client = options.client ?? db;
  const provider = options.provider ?? (await paymentsProvider(organizationId));
  let sent = 0;
  let totalCents = 0;
  for (const plan of await payoutPlans(organizationId, month, client)) {
    if (plan.readyCents <= 0) continue;
    const result = await provider.payout({
      money: { amountCents: plan.readyCents, currency: 'usd' },
      idempotencyKey: plan.idempotencyKey,
    });
    try {
      await client.payout.create({
        data: {
          organizationId,
          propertyId: plan.propertyId,
          month,
          provider: provider.name,
          providerReference: result.id,
          amount: centsToDecimal(plan.readyCents),
          status: result.status === 'succeeded' ? 'paid' : result.status,
        },
      });
      sent += 1;
      totalCents += plan.readyCents;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error; // same key already recorded
    }
  }
  return { sent, totalCents };
}

// ---------------------------------------------------------------------------------------- rent roll

export type RentRollRow = {
  leaseId: string;
  tenantId: string | null;
  tenantName: string;
  initials: string;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  singleUnit: boolean;
  dueDate: Date;
  rentCents: Cents;
  status: RentStatus;
  outstandingCents: Cents;
  lateFeeCents: Cents;
  lateFeeEligible: boolean;
  lateFeeApplied: boolean;
  lastPaymentId: string | null;
  lastPaymentCents: Cents;
  creditCents: Cents;
};

export type PaymentsOverview = {
  month: string;
  rows: RentRollRow[];
  collectedCents: Cents;
  outstandingCents: Cents;
  openCount: number;
  lateCents: Cents;
  lateCount: number;
  payouts: OwnerPayoutRow[];
  payoutReadyCents: Cents;
  recentPayouts: { id: string; amountCents: Cents; status: string; createdAt: Date }[];
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export async function loadPaymentsOverview(
  organizationId: string,
  month: string,
  asOf: Date,
  client: Client = db,
  scope: ScopeFilter = {},
): Promise<PaymentsOverview> {
  const start = monthStart(month);
  const end = monthStart(addMonths(month, 1));
  const leases = await client.lease.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      startDate: { lt: end },
      endDate: { gte: start },
      ...unitScopeWhere(scope),
    },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true }, orderBy: { isPrimary: 'desc' } },
      charges: true,
      payments: { orderBy: { createdAt: 'asc' } },
      autopaySettings: { where: { enabled: true } },
    },
  });

  const rows: RentRollRow[] = [];
  let collectedCents = 0;
  let outstandingCents = 0;
  let lateCents = 0;
  let lateCount = 0;
  let openCount = 0;
  for (const lease of leases) {
    const terms = leaseTerms(lease);
    const charges = lease.charges.map(toLedgerCharge);
    const payments = lease.payments.map(toLedgerPayment);
    const rent = charges.find((c) => c.description === rentKey(lease.id, month));
    if (!rent) continue;
    const { status, outstandingCents: owed } = rentStatus({
      lease: terms,
      month,
      charges,
      payments,
      autopay: lease.autopaySettings.length > 0,
      asOf,
    });
    const balance = computeBalance(charges, payments);
    const decision = assessLateFee(terms, month, charges, payments, asOf);
    const lateFee = charges.find((c) => c.description === `late-fee:${lease.id}:${month}`);
    const tenant = lease.tenants[0]?.tenant;
    const name = tenant?.name ?? 'Unassigned tenant';
    const succeeded = payments.filter((p) => p.status === 'SUCCEEDED');
    const last = succeeded.at(-1);
    collectedCents += lease.payments
      .filter((p) => p.status === 'SUCCEEDED' && p.paidAt && p.paidAt >= start && p.paidAt < end)
      .reduce((sum, p) => sum + toCents(p.amount), 0);
    // Only balances that are due by asOf count as outstanding.
    const due = computeBalance(charges, payments, asOf);
    if (due.outstandingCents > 0) {
      outstandingCents += due.outstandingCents;
      openCount += 1;
    }
    if (status === 'LATE') {
      lateCents += owed + (lateFee ? lateFee.amountCents : 0);
      lateCount += 1;
    }
    rows.push({
      leaseId: lease.id,
      tenantId: tenant?.id ?? null,
      tenantName: name,
      initials: initialsOf(name),
      propertyId: lease.unit.property.id,
      propertyName: lease.unit.property.name,
      unitLabel: lease.unit.number,
      singleUnit: lease.unit.isImplicit,
      dueDate: rent.dueDate,
      rentCents: rent.amountCents,
      status,
      outstandingCents: due.outstandingCents,
      lateFeeCents: terms.lateFeeCents,
      lateFeeEligible: decision.eligible,
      lateFeeApplied: Boolean(lateFee),
      lastPaymentId: last?.id ?? null,
      lastPaymentCents: last?.amountCents ?? 0,
      creditCents: balance.creditCents,
    });
  }
  const order: Record<RentStatus, number> = { LATE: 0, PENDING: 1, AUTOPAY: 2, PAID: 3 };
  rows.sort(
    (a, b) => order[a.status] - order[b.status] || a.tenantName.localeCompare(b.tenantName),
  );

  const payouts = (await payoutPlans(organizationId, month, client)).filter(
    (plan) => !scope.propertyId || plan.propertyId === scope.propertyId,
  );
  const recent = await client.payout.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  return {
    month,
    rows,
    collectedCents,
    outstandingCents,
    openCount,
    lateCents,
    lateCount,
    payouts,
    payoutReadyCents: payouts.reduce((sum, p) => sum + p.readyCents, 0),
    recentPayouts: recent.map((p) => ({
      id: p.id,
      amountCents: toCents(p.amount),
      status: p.status,
      createdAt: p.createdAt,
    })),
  };
}

export { monthKey };
