import {
  Prisma, PrismaClient, type ChargeKind, type MaintenancePriority,
  type MaintenanceStatus,
} from '@prisma/client';
import { hashPassword } from '../../src/lib/auth/password';
import {
  assessLateFee, centsToDecimal, computeBalance, monthKey, addMonths, rentDueDate,
  rentKey, type LedgerCharge, type LedgerPayment,
} from '../../src/lib/ledger/core';
import { planSetupCharges } from '../../src/lib/ledger/lease-setup';
import { createTermsSnapshot, STANDARD_ITEMS } from '../../src/lib/lease-create/templates';
import { ensureStandardTemplate, toDefinition } from '../../src/lib/lease-create/template-service';
import { STANDARD_V2_ITEMS } from '../../src/lib/lease-create/standard-v2';
import { createStorageAdapter } from '../../src/lib/storage/config';
import { photoLimits } from '../../src/lib/storage/photo-limits';
import { cardPng, type CardKind } from './image';
import { planApplications } from './applications';
import { assertDemoTarget } from './guard';
import {
  assertNoLeaseOverlap, pickInt, planPortfolio, prng, properties,
  propertyId,
} from './plan';

const organizationId = 'seed-rocket-rental';
const asDate = (date: Date) => date.toISOString().slice(0, 10);
const day = (date: Date, offset: number) => new Date(date.getTime() + offset * 86_400_000);
const cents = (amount: number) => centsToDecimal(amount);
const now = new Date();

const rawSeed = process.argv.find((arg) => arg.startsWith('--seed='))?.slice(7)
  ?? (process.argv.indexOf('--seed') >= 0 ? process.argv[process.argv.indexOf('--seed') + 1] : '42');
const seed = Number(rawSeed);
if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('--seed must be a non-negative integer.');
assertDemoTarget(process.env.NODE_ENV, process.env.DATABASE_URL, process.argv.includes('--force-demo'));

const prisma = new PrismaClient();

async function resetDatabase() {
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations' ORDER BY tablename",
  );
  if (rows.length) {
    const names = rows.map((row) => `"${row.tablename.replaceAll('"', '""')}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
  }
}

async function createManyInChunks<T>(rows: T[], write: (chunk: T[]) => Promise<unknown>, size = 1000) {
  for (let i = 0; i < rows.length; i += size) await write(rows.slice(i, i + size));
}

async function seedDatabase() {
  const started = performance.now();
  const plan = planPortfolio(seed, now);
  assertNoLeaseOverlap(plan.leases);
  const random = prng(seed ^ 0x5f3759df);
  await resetDatabase();
  await prisma.organization.create({ data: { id: organizationId, name: 'RocketRental Demo' } });
  await prisma.user.createMany({ data: [
    { id: 'seed-jordan-mills', organizationId, name: 'Jordan Mills', email: 'jordan.mills@example.com', role: 'MANAGER', passwordHash: await hashPassword('JordanDemo#2026') },
    { id: 'seed-harbor-owner', organizationId, name: 'Demo Holdings LLC', email: 'owner@example.com', role: 'OWNER' },
  ] });

  const propertyRows: Prisma.PropertyCreateManyInput[] = properties.map((property, index) => ({
    id: propertyId(property.slug), organizationId, ownerId: 'seed-harbor-owner',
    name: property.name, type: property.type, street: property.street, city: 'Austin', state: 'TX',
    postalCode: property.postalCode, yearBuilt: property.yearBuilt,
    hasSharedLaundry: property.hasSharedLaundry, isFloodZone: property.isFloodZone,
    purchasePrice: 400_000 + property.count * 190_000 + index * 35_000,
    downPayment: 120_000 + property.count * 55_000,
    loanAmount: 280_000 + property.count * 135_000,
    annualDebtService: 9_600 + property.count * 2_800,
  }));
  await prisma.property.createMany({ data: propertyRows });
  const historicalTemplateRow = await prisma.leaseTemplate.create({ data: {
    id: 'demo-historical-lease-template', organizationId, name: 'Residential lease 2021 edition',
    version: 1, createdAt: new Date('2021-01-01T00:00:00.000Z'),
    defaultFees: { lateFee: '75', graceDays: 5, moveInFee: '150', petDeposit: '250' },
    items: { create: STANDARD_ITEMS.map((item, index) => ({ id: `demo-historical-template-item-${index}`,
      section: item.section, title: item.title, body: item.body, sortOrder: item.order,
      required: item.required, includeWhen: item.includeWhen })) },
  }, include: { items: { orderBy: { sortOrder: 'asc' } } } });
  const historicalTemplate = toDefinition(historicalTemplateRow);
  const templateId = 'demo-standard-lease-template';
  await prisma.leaseTemplate.create({ data: {
    id: templateId, organizationId, name: 'Standard residential lease', version: 2,
    createdAt: new Date('2024-10-01T00:00:00.000Z'),
    defaultFees: { lateFee: '75', graceDays: 5, moveInFee: '150', petDeposit: '250', returnedPaymentFee: '35', keyFee: '0' },
    items: { create: STANDARD_V2_ITEMS.map((item, index) => ({
      id: `demo-template-item-${index}`, section: item.section, title: item.title,
      body: item.body, sortOrder: item.order, required: item.required, includeWhen: item.includeWhen,
    })) },
  } });
  const template = await ensureStandardTemplate(organizationId, prisma);
  await prisma.property.updateMany({ where: { organizationId }, data: { defaultLeaseTemplateId: template.id } });

  await prisma.unit.createMany({ data: plan.units.map((unit) => {
    const property = properties.find((candidate) => candidate.slug === unit.propertySlug)!;
    const current = plan.leases.some((lease) => lease.unitId === unit.id && lease.status === 'ACTIVE' && lease.startDate <= now && lease.endDate >= now);
    const listedRent = property.baseRent + (unit.index % 5) * 85;
    return {
      id: unit.id, organizationId, propertyId: propertyId(property.slug), number: unit.number,
      isImplicit: property.type === 'SINGLE_UNIT', status: current ? 'OCCUPIED' as const : 'VACANT' as const,
      bedrooms: property.type === 'SINGLE_UNIT' ? 3 : 1 + unit.index % 3,
      bathrooms: property.type === 'SINGLE_UNIT' ? 2 : unit.index % 3 === 0 ? 2 : 1,
      squareFeet: property.type === 'SINGLE_UNIT' ? 1450 : 650 + unit.index % 5 * 130,
      listedRent, marketRent: listedRent + 85, floor: property.type === 'SINGLE_UNIT' ? 1 : Math.floor(unit.index / 4) + 1,
      amenities: property.type === 'SINGLE_UNIT' ? ['Driveway parking', 'In-unit laundry'] : property.hasSharedLaundry ? ['Shared laundry', 'Assigned parking'] : ['In-unit laundry', 'Assigned parking'],
      hasBalconyPatio: property.type === 'SINGLE_UNIT' || unit.index % 3 === 0,
    };
  }) });
  await createManyInChunks(plan.tenants.map((tenant) => ({ organizationId, ...tenant })),
    (data) => prisma.tenant.createMany({ data }));

  // A tenant-portal login for the demo: the first tenant with a lease running today.
  const portalLease = plan.leases.find((lease) => lease.status === 'ACTIVE' && lease.startDate <= now && lease.endDate >= now);
  const portalTenant = portalLease && plan.tenants.find((tenant) => tenant.id === portalLease.tenantId);
  if (portalTenant) {
    await prisma.user.create({ data: { id: 'seed-tenant-portal', organizationId, name: portalTenant.name,
      email: portalTenant.email, role: 'TENANT', passwordHash: await hashPassword('TenantDemo#2026') } });
    await prisma.tenant.update({ where: { id: portalTenant.id }, data: { userId: 'seed-tenant-portal' } });
  }

  const leaseRows: Prisma.LeaseCreateManyInput[] = [];
  const membershipRows: Prisma.LeaseTenantCreateManyInput[] = [];
  for (const lease of plan.leases) {
    const unit = plan.units.find((candidate) => candidate.id === lease.unitId)!;
    const property = properties.find((candidate) => candidate.slug === unit.propertySlug)!;
    const depositCents = lease.renewal ? 0 : lease.rentCents;
    const petDepositCents = !lease.renewal && unit.index % 7 === 0 ? 25000 : 0;
    const signedAt = day(lease.startDate, -7);
    const signingTemplate = signedAt < new Date('2024-10-01T00:00:00.000Z')
      ? historicalTemplate : template;
    const snapshot = createTermsSnapshot(signingTemplate, {
      leaseType: 'fixed', petsAllowed: petDepositCents > 0, petFee: petDepositCents > 0,
      assignedParking: true, propertyType: property.type, tenantUtilities: ['electricity', 'water'],
      yearBuilt: property.yearBuilt, balconyPatio: property.type === 'SINGLE_UNIT' || unit.index % 3 === 0,
      sharedLaundry: property.hasSharedLaundry, floodZone: property.isFloodZone,
      securityDeposit: depositCents > 0,
      values: { monthly_rent: `$${(lease.rentCents / 100).toFixed(2)}`, start_date: asDate(lease.startDate),
        end_date: asDate(lease.endDate), security_deposit: `$${(depositCents / 100).toFixed(2)}` },
    });
    leaseRows.push({
      id: lease.id, organizationId, unitId: lease.unitId, startDate: lease.startDate, endDate: lease.endDate,
      monthlyRent: cents(lease.rentCents), deposit: cents(depositCents), lateFee: '75.00', graceDays: 5,
      rentDueDay: 1 + unit.index % 5, moveInFee: lease.renewal ? '0.00' : '150.00',
      petDeposit: cents(petDepositCents), prorateFirstMonth: false, status: lease.status,
      eSignStatus: lease.status === 'DRAFT' ? 'NOT_SENT' : 'SIGNED',
      signedAt: lease.status === 'DRAFT' ? null : signedAt,
      templateId: signingTemplate.id, templateVersion: signingTemplate.version,
      termsSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      createdAt: day(lease.startDate, -12),
    });
    membershipRows.push({ organizationId, leaseId: lease.id, tenantId: lease.tenantId, isPrimary: true });
  }
  await createManyInChunks(leaseRows, (data) => prisma.lease.createMany({ data }));
  await createManyInChunks(membershipRows, (data) => prisma.leaseTenant.createMany({ data }));
  await createManyInChunks(plan.leases.flatMap((lease): Prisma.LeaseEventCreateManyInput[] => [
    { id: `demo-event-${lease.id}-created`, organizationId, leaseId: lease.id,
      kind: 'CREATED', message: lease.status === 'DRAFT' ? 'Saved as draft' : 'Demo lease created',
      actorName: 'Jordan Mills', createdAt: day(lease.startDate, -12) },
    ...(lease.renewal ? [{ id: `demo-event-${lease.id}-renewed`, organizationId,
      leaseId: lease.id, kind: 'RENEWED' as const, message: 'Renewal signed with a rent increase',
      actorName: 'Jordan Mills', createdAt: day(lease.startDate, -7) }] : []),
  ]), (data) => prisma.leaseEvent.createMany({ data }));

  const charges: Prisma.ChargeCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const refunds: string[] = [];
  for (const lease of plan.leases) {
    if (lease.status === 'DRAFT' || lease.startDate > now) continue;
    const storedLease = leaseRows.find((row) => row.id === lease.id)!;
    const depositCents = Math.round(Number(storedLease.deposit) * 100);
    const moveInFeeCents = Math.round(Number(storedLease.moveInFee) * 100);
    const petDepositCents = Math.round(Number(storedLease.petDeposit) * 100);
    const setup = planSetupCharges({ leaseId: lease.id, startDate: lease.startDate, endDate: lease.endDate,
      fees: { monthlyRentCents: lease.rentCents, depositCents, moveInFeeCents, petDepositCents,
        prorateFirstMonth: false, rentDueDay: storedLease.rentDueDay ?? 1 } });
    const localCharges: LedgerCharge[] = [];
    const localPayments: LedgerPayment[] = [];
    for (const [index, charge] of setup.entries()) {
      const id = `demo-charge-${lease.id}-setup-${index}`;
      charges.push({ id, organizationId, leaseId: lease.id, kind: charge.kind as ChargeKind,
        amount: cents(charge.amountCents), dueDate: charge.dueDate, description: charge.description });
      localCharges.push({ id, leaseId: lease.id, kind: charge.kind, amountCents: charge.amountCents,
        dueDate: charge.dueDate, description: charge.description });
    }
    if (setup.length) {
      const amountCents = setup.reduce((sum, charge) => sum + charge.amountCents, 0);
      const id = `demo-payment-${lease.id}-setup`;
      payments.push({ id, organizationId, leaseId: lease.id, amount: cents(amountCents), status: 'SUCCEEDED',
        providerReference: `manual:${lease.id}:setup`, paidAt: lease.startDate, createdAt: lease.startDate });
      localPayments.push({ id, leaseId: lease.id, amountCents, status: 'SUCCEEDED', paidAt: lease.startDate });
      if (lease.status === 'ENDED' && !lease.renewal && lease.cycle === 0 && depositCents > 0) refunds.push(id);
    }
    for (let month = monthKey(lease.startDate); month <= monthKey(lease.endDate) && month <= monthKey(now); month = addMonths(month, 1)) {
      const dueDate = rentDueDate(month, storedLease.rentDueDay ?? 1);
      if (dueDate < lease.startDate || dueDate > lease.endDate || dueDate > now) continue;
      const chargeId = `demo-charge-${lease.id}-${month}`;
      const description = rentKey(lease.id, month);
      charges.push({ id: chargeId, organizationId, leaseId: lease.id, kind: 'RENT', amount: cents(lease.rentCents), dueDate, description });
      localCharges.push({ id: chargeId, leaseId: lease.id, kind: 'RENT', amountCents: lease.rentCents, dueDate, description });
      const cedarDemoPartial = lease.unitId === 'demo-unit-cedar-2' && month === monthKey(now);
      const draw = cedarDemoPartial ? 0.98 : random();
      const partial = draw >= 0.95;
      const late = draw >= 0.85;
      const returned = !partial && random() < 0.012;
      const paidAt = cedarDemoPartial ? day(dueDate, 8)
        : late ? day(dueDate, pickInt(random, 8, 16)) : day(dueDate, pickInt(random, 0, 3));
      if (paidAt > now) continue;
      let feeCents = 0;
      if (late) {
        const decision = assessLateFee({ id: lease.id, startDate: lease.startDate, endDate: lease.endDate,
          monthlyRentCents: lease.rentCents, lateFeeCents: 7500, graceDays: 5,
          rentDueDay: storedLease.rentDueDay ?? 1, status: 'ACTIVE' }, month,
        localCharges, localPayments, day(dueDate, 6));
        if (decision.eligible) {
          feeCents = decision.fee.amountCents;
          charges.push({ id: `demo-charge-${lease.id}-${month}-late`, organizationId, leaseId: lease.id,
            kind: 'LATE_FEE', amount: cents(feeCents), dueDate: decision.fee.dueDate,
            description: decision.fee.description });
          localCharges.push({ leaseId: lease.id, kind: 'LATE_FEE', amountCents: feeCents,
            dueDate: decision.fee.dueDate, description: decision.fee.description });
        }
      }
      if (returned) payments.push({ id: `demo-payment-${lease.id}-${month}-returned`, organizationId,
        leaseId: lease.id, amount: cents(lease.rentCents), status: 'FAILED',
        providerReference: `demo-returned:${lease.id}:${month}`, paidAt: null, createdAt: dueDate });
      const paidCents = partial ? Math.round(lease.rentCents * 0.55) : lease.rentCents + feeCents;
      const id = `demo-payment-${lease.id}-${month}`;
      payments.push({ id, organizationId, leaseId: lease.id, amount: cents(paidCents), status: 'SUCCEEDED',
        providerReference: `manual:${lease.id}:${month}`, paidAt, createdAt: paidAt });
      localPayments.push({ id, leaseId: lease.id, amountCents: paidCents, status: 'SUCCEEDED', paidAt });
      // Most partial payments are completed later; keep a small set of real arrears.
      const catchUpAt = day(dueDate, 20);
      if (partial && catchUpAt <= now && random() < 0.85) {
        const remainder = lease.rentCents + feeCents - paidCents;
        const catchUpId = `demo-payment-${lease.id}-${month}-catch-up`;
        payments.push({ id: catchUpId, organizationId, leaseId: lease.id, amount: cents(remainder),
          status: 'SUCCEEDED', providerReference: `manual:${lease.id}:${month}:catch-up`,
          paidAt: catchUpAt, createdAt: catchUpAt });
        localPayments.push({ id: catchUpId, leaseId: lease.id, amountCents: remainder,
          status: 'SUCCEEDED', paidAt: catchUpAt });
      }
    }
    const balance = computeBalance(localCharges, localPayments);
    if (balance.chargedCents !== balance.paidCents + balance.outstandingCents) throw new Error(`Ledger mismatch: ${lease.id}`);
  }
  await createManyInChunks(charges, (data) => prisma.charge.createMany({ data }));
  await createManyInChunks(payments, (data) => prisma.payment.createMany({ data }));
  // The ledger's refund service applies the same status and balance rules as a manager refund.
  const { refundPayment } = await import('../../src/lib/ledger/store');
  for (const paymentId of refunds.slice(0, 8)) {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const lease = leaseRows.find((row) => row.id === payment.leaseId)!;
    const depositCents = Math.round(Number(lease.deposit) * 100);
    if (depositCents < Math.round(Number(payment.amount) * 100)) {
      await refundPayment({ organizationId, paymentId, amountCents: depositCents,
        idempotencyKey: `move-out:${payment.leaseId}` }, { client: prisma });
    }
  }

  const applicationPlan = planApplications(seed, now, plan.units, plan.leases, plan.tenants);
  const { groups, applications, consents, reports } = applicationPlan;
  await createManyInChunks(groups.map((group) => ({ id: group.id, organizationId, unitId: group.unitId,
    status: group.status, archivedAt: group.archivedAt, createdAt: group.at })),
    (data) => prisma.applicationGroup.createMany({ data }));
  await createManyInChunks(applications, (data) => prisma.application.createMany({ data }));
  await createManyInChunks(consents, (data) => prisma.screeningConsent.createMany({ data }));
  await createManyInChunks(reports, (data) => prisma.screeningReport.createMany({ data }));

  const vendors = [
    { id: 'demo-vendor-northstar', name: 'Northstar Repairs', trade: 'General repairs' },
    { id: 'demo-vendor-brightline', name: 'Brightline HVAC', trade: 'Heating and cooling' },
    { id: 'demo-vendor-keyline', name: 'Keyline Services', trade: 'Locks and doors' },
  ];
  await prisma.vendor.createMany({ data: vendors.map((vendor) => ({ ...vendor, organizationId })) });
  const topics = ['Kitchen sink leak', 'Air conditioner service', 'Door lock repair', 'Bathroom tile repair', 'Smoke alarm replacement', 'Window latch adjustment', 'Laundry appliance repair'];
  const statuses: MaintenanceStatus[] = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
  const priorities: MaintenancePriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
  const maintenance: Prisma.MaintenanceRequestCreateManyInput[] = [];
  const photoRandom = prng(seed ^ 0x145ab921);
  const maintenancePhotoTargets: { requestId: string; leaseId: string; at: Date; title: string; count: number }[] = [];
  for (const unit of plan.units) {
    for (let year = 0; year < 5; year++) {
      const count = pickInt(random, 2, 6);
      for (let index = 0; index < count; index++) {
        const id = `demo-maintenance-${unit.id}-${year}-${index}`;
        const at = day(new Date(Date.UTC(now.getUTCFullYear() - 5 + year, now.getUTCMonth(), 1)), pickInt(random, 1, 330));
        const status = at < day(now, -75)
          ? (random() < 0.94 ? 'DONE' : 'CANCELLED')
          : statuses[pickInt(random, 0, statuses.length - 1)]!;
        const vendor = vendors[pickInt(random, 0, vendors.length - 1)]!;
        const title = topics[pickInt(random, 0, topics.length - 1)]!;
        const matchingLease = plan.leases.find((lease) => lease.unitId === unit.id &&
          lease.startDate <= at && lease.endDate >= at && lease.status !== 'DRAFT');
        const tenantId = matchingLease && photoRandom() < 0.35 ? matchingLease.tenantId : null;
        maintenance.push({ id, organizationId, propertyId: propertyId(unit.propertySlug), unitId: unit.id,
          title, description: 'Synthetic maintenance history for the demo.', tenantId,
          priority: priorities[pickInt(random, 0, priorities.length - 1)]!, status,
          vendorId: status === 'NEW' ? null : vendor.id, vendorName: status === 'NEW' ? null : vendor.name,
          createdAt: at, completedAt: status === 'DONE' ? day(at, 4) : null });
        if (photoRandom() < 0.5) {
          // Repair uploads use the lease target, as tenant uploads do. Unit photo limits
          // therefore count the unit gallery only, even across years of repair history.
          const leaseId = matchingLease?.id ?? plan.leases.find((lease) => lease.unitId === unit.id)!.id;
          maintenancePhotoTargets.push({ requestId: id, leaseId, at, title,
            count: pickInt(photoRandom, 1, 3) });
        }
      }
    }
  }
  await createManyInChunks(maintenance, (data) => prisma.maintenanceRequest.createMany({ data }));

  const expenses: Prisma.ExpenseCreateManyInput[] = [];
  for (const property of properties) {
    for (let month = addMonths(plan.currentMonth, -60); month <= plan.currentMonth; month = addMonths(month, 1)) {
      const date = new Date(`${month}-15T00:00:00.000Z`);
      for (const [category, factor] of [['TAXES', 0.22], ['INSURANCE', 0.09], ['REPAIRS', 0.12], ['MANAGEMENT', 0.08]] as const) {
        expenses.push({ id: `demo-expense-${property.slug}-${month}-${category}`, organizationId,
          propertyId: propertyId(property.slug), category, amount: Math.round(property.baseRent * property.count * factor),
          occurredOn: date, description: 'Synthetic monthly operating expense' });
      }
    }
  }
  await createManyInChunks(expenses, (data) => prisma.expense.createMany({ data }));

  const storage = createStorageAdapter(process.env);
  const limits = photoLimits(process.env);
  if (limits.perProperty < 7 || limits.perUnit < 3)
    throw new Error('Demo galleries require photo limits of at least 7 per property and 3 per unit.');
  const photos: Prisma.DocumentCreateManyInput[] = [];
  const photoAttachments: Prisma.MaintenancePhotoCreateManyInput[] = [];
  const payloads: { key: string; kind: CardKind; label: string; variant: number }[] = [];
  const propertyLabels = ['Front exterior', 'Entryway', 'Living room', 'Kitchen', 'Courtyard', 'Laundry room', 'Parking'];
  for (const [index, property] of properties.entries()) {
    const count = 4 + (index + seed) % 4;
    for (let image = 0; image < count; image++) {
      const id = `demo-property-photo-${property.slug}-${image}`;
      const key = `demo/${id}.png`;
      const label = propertyLabels[image]!;
      payloads.push({ key, kind: 'property', label, variant: seed + index + image * 3 });
      photos.push({ id, organizationId, propertyId: propertyId(property.slug), kind: 'PHOTO',
        name: `${property.slug}-${label.toLowerCase().replaceAll(' ', '-')}.png`, storageKey: key, sizeBytes: 0n,
        mimeType: 'image/png', isCover: image === 0, sortOrder: image,
        caption: label });
    }
  }
  for (const [index, unit] of plan.units.entries()) {
    const count = 1 + (index + seed) % 3;
    const labels = [`${unit.number} living room`, 'Kitchen', 'Bedroom'];
    for (let image = 0; image < count; image++) {
      const id = `demo-unit-photo-${index}-${image}`;
      const key = `demo/${id}.png`;
      const label = labels[image]!;
      payloads.push({ key, kind: 'unit', label, variant: seed + index + image * 5 });
      photos.push({ id, organizationId, unitId: unit.id, kind: 'PHOTO',
        name: `${unit.propertySlug}-${unit.number.replaceAll(' ', '-')}-${image + 1}.png`,
        storageKey: key, sizeBytes: 0n, mimeType: 'image/png', isCover: image === 0,
        sortOrder: image, caption: label });
    }
  }
  for (const target of maintenancePhotoTargets) {
    for (let image = 0; image < target.count; image++) {
      const id = `demo-maintenance-photo-${target.requestId}-${image}`;
      const key = `demo/${id}.png`;
      payloads.push({ key, kind: 'repair', label: target.title, variant: seed + image + target.requestId.length });
      photos.push({ id, organizationId, leaseId: target.leaseId, kind: 'PHOTO',
        name: `${target.title.toLowerCase().replaceAll(' ', '-')}-${image + 1}.png`,
        storageKey: key, sizeBytes: 0n, mimeType: 'image/png', sortOrder: image,
        caption: target.title, createdAt: target.at });
      photoAttachments.push({ id: `demo-maintenance-attachment-${target.requestId}-${image}`, organizationId,
        maintenanceRequestId: target.requestId, documentId: id, storageKey: key,
        sizeBytes: 0n, mimeType: 'image/png', createdAt: target.at });
    }
  }
  const pictureBytes = new Map<string, Uint8Array>();
  const documentsByKey = new Map(photos.map((photo) => [photo.storageKey, photo]));
  const attachmentsByKey = new Map(photoAttachments.map((attachment) => [attachment.storageKey, attachment]));
  let nextPayload = 0;
  await Promise.all(Array.from({ length: 24 }, async () => {
    while (nextPayload < payloads.length) {
      const payload = payloads[nextPayload++]!;
      const cacheKey = `${payload.kind}:${payload.label}:${payload.variant % 6}`;
      let bytes = pictureBytes.get(cacheKey);
      if (!bytes) {
        bytes = cardPng(payload.kind, payload.label, payload.variant);
        pictureBytes.set(cacheKey, bytes);
      }
      await storage.put(payload.key, bytes, 'image/png');
      documentsByKey.get(payload.key)!.sizeBytes = BigInt(bytes.byteLength);
      const attachment = attachmentsByKey.get(payload.key);
      if (attachment) attachment.sizeBytes = BigInt(bytes.byteLength);
    }
  }));
  await prisma.document.createMany({ data: photos });
  if (photoAttachments.length) await prisma.maintenancePhoto.createMany({ data: photoAttachments });

  const elapsed = Math.round(performance.now() - started);
  console.log(`Demo seed ${seed}: ${properties.length} properties, ${plan.units.length} units, ${plan.leases.length} leases, ${payments.length} payments, ${groups.length} application groups, ${applications.length} applicants, ${maintenance.length} maintenance requests, ${photos.length} photos in ${elapsed} ms.`);
  console.log(`Pictures: ${photos.filter((photo) => photo.propertyId).length} property, ${photos.filter((photo) => photo.unitId).length} unit, ${photoAttachments.length} maintenance across ${maintenancePhotoTargets.length} requests (${Math.round(maintenancePhotoTargets.length / maintenance.length * 100)}%).`);
  console.log(`Charges: ${charges.length}; expenses: ${expenses.length}; partial deposit refunds: ${Math.min(refunds.length, 8)}.`);
  console.log('Property | Year | Leases | Charges | Payments | Groups | Applicants');
  const unitProperty = new Map(plan.units.map((unit) => [unit.id, unit.propertySlug]));
  const leaseProperty = new Map(plan.leases.map((lease) => [lease.id, unitProperty.get(lease.unitId)]));
  for (const property of properties) {
    const yearOf = (value: string | Date | null | undefined) => value == null ? undefined : new Date(value).getUTCFullYear();
    const years = new Set([
      ...plan.leases.filter((lease) => leaseProperty.get(lease.id) === property.slug).map((lease) => yearOf(lease.startDate)),
      ...charges.filter((charge) => leaseProperty.get(charge.leaseId) === property.slug).map((charge) => yearOf(charge.dueDate)),
      ...payments.filter((payment) => leaseProperty.get(payment.leaseId) === property.slug).map((payment) => yearOf(payment.paidAt ?? payment.createdAt)),
      ...groups.filter((group) => unitProperty.get(group.unitId) === property.slug).map((group) => yearOf(group.at)),
    ]);
    for (const year of [...years].filter((value): value is number => value !== undefined).sort()) {
      const inYear = (date: string | Date | null | undefined) => yearOf(date) === year;
      const leaseCount = plan.leases.filter((lease) => leaseProperty.get(lease.id) === property.slug && inYear(lease.startDate)).length;
      const chargeCount = charges.filter((charge) => leaseProperty.get(charge.leaseId) === property.slug && inYear(charge.dueDate)).length;
      const paymentCount = payments.filter((payment) => leaseProperty.get(payment.leaseId) === property.slug && inYear(payment.paidAt ?? payment.createdAt)).length;
      const groupCount = groups.filter((group) => unitProperty.get(group.unitId) === property.slug && inYear(group.at)).length;
      const applicantCount = applications.filter((application) => unitProperty.get(application.unitId) === property.slug && inYear(application.appliedAt)).length;
      console.log(`${property.name} | ${year} | ${leaseCount} | ${chargeCount} | ${paymentCount} | ${groupCount} | ${applicantCount}`);
    }
  }
}

seedDatabase().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
