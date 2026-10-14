import { Prisma, type PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { activeIntegration } from '@/lib/integrations/active';
import {
  centsToDecimal,
  ensureRentCharges,
  leaseTerms,
  monthKey,
  rentKey,
  toCents,
  toLedgerCharge,
  toLedgerPayment,
} from '@/lib/ledger';
import { paymentsProvider } from '@/lib/providers';
import type { PaymentsProvider } from '@/lib/providers/types';
import {
  buildAmountDue,
  buildReceipts,
  cardFeeCents,
  validatePayAmount,
  validateProviderToken,
  type AmountDue,
  type PayMethodType,
  type Receipt,
} from './core';

type Client = PrismaClient;

export class TenantPayError extends Error {}

export type SavedMethod = {
  id: string;
  type: PayMethodType;
  label: string;
  last4: string | null;
  provider: string;
};

export type TenantPayView = {
  leaseId: string;
  tenantId: string;
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  monthlyRentCents: number;
  graceDays: number;
  amountDue: AmountDue;
  receipts: Receipt[];
  methods: SavedMethod[];
  autopay: { enabled: boolean; paymentMethodId: string | null };
  passFees: boolean;
  providerName: string;
};

const methodLabel = (type: string, last4: string | null) =>
  `${type === 'card' ? 'Card' : 'Bank transfer'}${last4 ? ` ••••${last4}` : ''}`;

async function passProcessingFees(organizationId: string, client: Client): Promise<boolean> {
  try {
    const { settings } = await activeIntegration(organizationId, 'payments', [], (args) =>
      client.providerConnection.findMany(args),
    );
    return settings.passProcessingFees;
  } catch {
    return true;
  }
}

/** The tenant's own active lease. Returns null when the tenant has none. */
async function findTenantLease(client: Client, organizationId: string, tenantId: string) {
  return client.lease.findFirst({
    where: {
      organizationId,
      status: 'ACTIVE',
      tenants: { some: { tenantId, organizationId } },
    },
    orderBy: { startDate: 'asc' },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true }, orderBy: { isPrimary: 'desc' } },
    },
  });
}

/** The tenant's lease by id; used by writes so a tenant with several leases pays the right one. */
async function findTenantLeaseById(
  client: Client,
  organizationId: string,
  tenantId: string,
  leaseId: string,
) {
  return client.lease.findFirst({
    where: {
      id: leaseId,
      organizationId,
      status: 'ACTIVE',
      tenants: { some: { tenantId, organizationId } },
    },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true }, orderBy: { isPrimary: 'desc' } },
    },
  });
}

async function loadLedger(client: Client, organizationId: string, leaseId: string) {
  const [charges, payments] = await Promise.all([
    client.charge.findMany({ where: { organizationId, leaseId } }),
    client.payment.findMany({ where: { organizationId, leaseId } }),
  ]);
  return { charges: charges.map(toLedgerCharge), payments: payments.map(toLedgerPayment) };
}

/**
 * Creates next month's rent charge when everything due is settled, so the portal can show
 * and take the upcoming payment (the design's "Pay November rent"). Never creates a charge
 * past the lease end, and never duplicates the deterministic rent key.
 */
async function ensureUpcomingCharge(
  client: Client,
  organizationId: string,
  lease: { id: string; endDate: Date; monthlyRent: { toString(): string } },
  due: AmountDue,
  now: Date,
): Promise<boolean> {
  if (due.totalDueCents > 0) return false;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  if (next.getTime() > lease.endDate.getTime()) return false;
  const description = rentKey(lease.id, monthKey(next));
  // Serialised per lease (same advisory lock the ledger uses): concurrent page loads in
  // dev can otherwise both see "no charge yet" and create the upcoming month twice.
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`lease:${lease.id}`}))`;
    const existing = await tx.charge.findFirst({
      where: { organizationId, leaseId: lease.id, description },
    });
    if (existing) return false;
    await tx.charge.create({
      data: {
        organizationId,
        leaseId: lease.id,
        kind: 'RENT',
        amount: centsToDecimal(toCents(lease.monthlyRent)),
        dueDate: next,
        description,
      },
    });
    return true;
  });
}

export async function loadTenantPayView(
  organizationId: string,
  tenantId: string,
  now: Date,
  client: Client = db,
): Promise<TenantPayView | null> {
  const lease = await findTenantLease(client, organizationId, tenantId);
  if (!lease) return null;
  await ensureRentCharges(organizationId, now, client);
  let ledger = await loadLedger(client, organizationId, lease.id);
  let due = buildAmountDue(ledger.charges, ledger.payments);
  if (await ensureUpcomingCharge(client, organizationId, lease, due, now)) {
    ledger = await loadLedger(client, organizationId, lease.id);
    due = buildAmountDue(ledger.charges, ledger.payments);
  }
  const [methodRows, autopayRow] = await Promise.all([
    client.paymentMethod.findMany({
      where: { organizationId, tenantId },
      orderBy: { createdAt: 'asc' },
    }),
    client.autopaySetting.findUnique({
      where: { leaseId_tenantId: { leaseId: lease.id, tenantId } },
    }),
  ]);
  const terms = leaseTerms(lease);
  const tenant = lease.tenants.find((t) => t.tenantId === tenantId)?.tenant;
  return {
    leaseId: lease.id,
    tenantId,
    tenantName: tenant?.name ?? 'Tenant',
    propertyName: lease.unit.property.name,
    unitLabel: lease.unit.isImplicit ? '' : lease.unit.number,
    monthlyRentCents: terms.monthlyRentCents,
    graceDays: terms.graceDays,
    amountDue: due,
    receipts: buildReceipts(ledger.payments),
    methods: methodRows.map((m) => ({
      id: m.id,
      type: m.type === 'card' ? 'card' : 'ach',
      label: methodLabel(m.type, m.last4),
      last4: m.last4,
      provider: m.provider,
    })),
    autopay: {
      enabled: autopayRow?.enabled ?? false,
      paymentMethodId: autopayRow?.paymentMethodId ?? null,
    },
    passFees: await passProcessingFees(organizationId, client),
    providerName: 'mock',
  };
}

export type PayRentResult = {
  paymentId: string;
  status: 'SUCCEEDED' | 'PENDING';
  duplicate: boolean;
  feeCents: number;
  chargedCents: number;
  savedMethodId: string | null;
};

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Charges the provider and posts the payment to the ledger. The Payment row carries the
 * rent amount (so it settles charges oldest-first); the card fee, when passed on, is part
 * of the provider charge only. Card payments settle immediately; bank debits stay PENDING
 * until the provider webhook flips them (see ledger/webhooks applyPaymentWebhook).
 * Only the provider token crosses this boundary - never a card or account number.
 */
export async function payRent(
  input: {
    organizationId: string;
    tenantId: string;
    leaseId: string;
    amountCents: number;
    method: PayMethodType;
    /** Provider token from hosted fields, or omit and pass paymentMethodId for a saved method. */
    providerToken?: string;
    paymentMethodId?: string;
    idempotencyKey: string;
    saveMethod?: boolean;
  },
  options: { client?: Client; provider?: PaymentsProvider; now?: Date } = {},
): Promise<PayRentResult> {
  const client = options.client ?? db;
  const now = options.now ?? new Date();
  const { organizationId, tenantId, leaseId } = input;
  if (!input.idempotencyKey.trim()) throw new TenantPayError('Idempotency key required');
  const lease = await findTenantLeaseById(client, organizationId, tenantId, leaseId);
  if (!lease) throw new TenantPayError('Lease not found');
  let token: string;
  let last4: string;
  if (input.paymentMethodId) {
    const saved = await client.paymentMethod.findFirst({
      where: { id: input.paymentMethodId, organizationId, tenantId },
    });
    if (!saved) throw new TenantPayError('Payment method not found');
    if ((saved.type === 'card' ? 'card' : 'ach') !== input.method)
      throw new TenantPayError('Payment method type does not match');
    token = saved.providerToken;
    last4 = saved.last4 ?? validateProviderTokenSafe(token, input.method).last4;
  } else {
    if (!input.providerToken) throw new TenantPayError('Provider-issued payment token required');
    ({ token, last4 } = validateProviderTokenSafe(input.providerToken, input.method));
  }
  await ensureRentCharges(organizationId, now, client);
  let ledger = await loadLedger(client, organizationId, leaseId);
  let due = buildAmountDue(ledger.charges, ledger.payments);
  if (await ensureUpcomingCharge(client, organizationId, lease, due, now)) {
    ledger = await loadLedger(client, organizationId, leaseId);
    due = buildAmountDue(ledger.charges, ledger.payments);
  }
  // A double submit can arrive after the first payment settled the balance. Answering with
  // the original payment keeps the retry safe instead of reporting "nothing is due".
  if (due.totalDueCents <= 0 && Number.isSafeInteger(input.amountCents) && input.amountCents > 0) {
    const prior = ledger.payments
      .filter(
        (p) =>
          p.amountCents === input.amountCents && p.status !== 'FAILED' && p.status !== 'REFUNDED',
      )
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0];
    if (prior?.id) {
      const passFeesEarly = await passProcessingFees(organizationId, client);
      const fee = input.method === 'card' ? cardFeeCents(input.amountCents, passFeesEarly) : 0;
      return {
        paymentId: prior.id,
        status: prior.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'PENDING',
        duplicate: true,
        feeCents: fee,
        chargedCents: input.amountCents + fee,
        savedMethodId: input.paymentMethodId ?? null,
      };
    }
  }
  const amountCents = validatePayAmountSafe(input.amountCents, due.totalDueCents);
  const passFees = await passProcessingFees(organizationId, client);
  const feeCents = input.method === 'card' ? cardFeeCents(amountCents, passFees) : 0;
  const chargedCents = amountCents + feeCents;

  const provider = options.provider ?? (await paymentsProvider(organizationId));
  const tenant = lease.tenants.find((t) => t.tenantId === tenantId)?.tenant;
  const customer = await provider.createCustomer({
    organizationId,
    email: tenant?.email ?? `${tenantId}@tenant.invalid`,
    name: tenant?.name ?? 'Tenant',
  });
  const result = await provider.charge({
    customerId: customer.id,
    paymentMethodToken: token,
    type: input.method,
    money: { amountCents: chargedCents, currency: 'usd' },
    idempotencyKey: input.idempotencyKey,
  });
  if (result.status === 'failed' || result.status === 'requires_action')
    throw new TenantPayError('The provider could not complete this payment');

  const status = result.status === 'succeeded' ? 'SUCCEEDED' : 'PENDING';
  let paymentId: string;
  let duplicate = false;
  try {
    const payment = await client.payment.create({
      data: {
        organizationId,
        leaseId,
        amount: centsToDecimal(amountCents),
        status,
        providerReference: result.id,
        paidAt: status === 'SUCCEEDED' ? now : null,
      },
    });
    paymentId = payment.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await client.payment.findUnique({
      where: { providerReference: result.id },
    });
    if (!existing || existing.organizationId !== organizationId || existing.leaseId !== leaseId)
      throw new TenantPayError('Idempotency key already used for a different payment');
    if (toCents(existing.amount) !== amountCents)
      throw new TenantPayError('Idempotency key already used for a different payment');
    paymentId = existing.id;
    duplicate = true;
  }

  let savedMethodId: string | null = null;
  if (input.paymentMethodId) savedMethodId = input.paymentMethodId;
  else if (input.saveMethod && !duplicate) {
    savedMethodId = await savePaymentMethod(client, provider, {
      organizationId,
      tenantId,
      customerId: customer.id,
      token,
      type: input.method,
      last4,
    });
  }
  return { paymentId, status, duplicate, feeCents, chargedCents, savedMethodId };
}

function validateProviderTokenSafe(token: string, type: PayMethodType) {
  try {
    return validateProviderToken(token, type);
  } catch (error) {
    throw new TenantPayError(error instanceof Error ? error.message : 'Invalid payment token');
  }
}

function validatePayAmountSafe(amountCents: number, totalDueCents: number) {
  try {
    return validatePayAmount(amountCents, totalDueCents);
  } catch (error) {
    throw new TenantPayError(error instanceof Error ? error.message : 'Invalid amount');
  }
}

/** Stores only the provider-issued token and display metadata (last4/brand), never details. */
export async function savePaymentMethod(
  client: Client,
  provider: PaymentsProvider,
  input: {
    organizationId: string;
    tenantId: string;
    customerId: string;
    token: string;
    type: PayMethodType;
    last4: string;
  },
): Promise<string> {
  const attached = await provider.attachPaymentMethod({
    customerId: input.customerId,
    providerToken: input.token,
    type: input.type,
  });
  const existing = await client.paymentMethod.findUnique({
    where: { provider_providerToken: { provider: provider.name, providerToken: attached.id } },
  });
  if (existing) {
    if (existing.organizationId !== input.organizationId || existing.tenantId !== input.tenantId)
      throw new TenantPayError('Payment method belongs to another tenant');
    return existing.id;
  }
  const created = await client.paymentMethod.create({
    data: {
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      provider: provider.name,
      providerToken: attached.id,
      type: input.type,
      last4: attached.last4 ?? input.last4,
      brand: input.type === 'card' ? 'Card' : 'Bank',
    },
  });
  return created.id;
}

/** Adds a method through the provider without charging it (the "+ Add payment method" flow). */
export async function addPaymentMethod(
  input: {
    organizationId: string;
    tenantId: string;
    method: PayMethodType;
    providerToken: string;
  },
  options: { client?: Client; provider?: PaymentsProvider } = {},
): Promise<{ methodId: string }> {
  const client = options.client ?? db;
  const { token, last4 } = validateProviderTokenSafe(input.providerToken, input.method);
  const lease = await findTenantLease(client, input.organizationId, input.tenantId);
  if (!lease) throw new TenantPayError('Lease not found');
  const provider = options.provider ?? (await paymentsProvider(input.organizationId));
  const tenant = lease.tenants.find((t) => t.tenantId === input.tenantId)?.tenant;
  const customer = await provider.createCustomer({
    organizationId: input.organizationId,
    email: tenant?.email ?? `${input.tenantId}@tenant.invalid`,
    name: tenant?.name ?? 'Tenant',
  });
  const methodId = await savePaymentMethod(client, provider, {
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    customerId: customer.id,
    token,
    type: input.method,
    last4,
  });
  return { methodId };
}

/** Turns autopay on or off for the tenant's lease. Enabling needs one of their saved methods. */
export async function setAutopay(
  input: {
    organizationId: string;
    tenantId: string;
    leaseId: string;
    enabled: boolean;
    paymentMethodId?: string | null;
  },
  options: { client?: Client } = {},
): Promise<{ enabled: boolean }> {
  const client = options.client ?? db;
  const lease = await findTenantLeaseById(
    client,
    input.organizationId,
    input.tenantId,
    input.leaseId,
  );
  if (!lease) throw new TenantPayError('Lease not found');
  const existing = await client.autopaySetting.findUnique({
    where: { leaseId_tenantId: { leaseId: input.leaseId, tenantId: input.tenantId } },
  });
  if (!input.enabled) {
    if (existing)
      await client.autopaySetting.update({
        where: { id: existing.id },
        data: { enabled: false },
      });
    return { enabled: false };
  }
  const paymentMethodId = input.paymentMethodId ?? existing?.paymentMethodId ?? null;
  if (!paymentMethodId) throw new TenantPayError('Add a payment method before turning on autopay');
  const method = await client.paymentMethod.findFirst({
    where: { id: paymentMethodId, organizationId: input.organizationId, tenantId: input.tenantId },
  });
  if (!method) throw new TenantPayError('Payment method not found');
  await client.autopaySetting.upsert({
    where: { leaseId_tenantId: { leaseId: input.leaseId, tenantId: input.tenantId } },
    create: {
      organizationId: input.organizationId,
      leaseId: input.leaseId,
      tenantId: input.tenantId,
      paymentMethodId,
      enabled: true,
      dayOfMonth: 1,
    },
    update: { paymentMethodId, enabled: true },
  });
  return { enabled: true };
}
