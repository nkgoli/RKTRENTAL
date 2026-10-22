import { PrismaClient } from '@prisma/client';
import { expect, type Locator, type Page } from '@playwright/test';

// Synthetic rent-roll fixtures for the payments browser suites. Everything lives on one
// property ("Synthetic Reminder Court") in the seeded organization, with `e2e-reminder-` IDs and
// example.invalid contacts, so the suites can rebuild it before every test without touching the
// demo portfolio. Run against a throwaway seeded database (`npm run test:e2e`) in sandbox mode:
// reminders are recorded as sandbox attempts and nothing is delivered.

export const prisma = new PrismaClient();
export const organizationId = 'seed-rocket-rental';
const prefix = 'e2e-reminder-';
export const fixture = {
  propertyId: `${prefix}property`,
  propertyName: 'Synthetic Reminder Court',
  leases: {
    /** Avery (primary, email and SMS) with co-tenant Blair (email only). */
    shared: `${prefix}lease-shared`,
    /** Casey has no email or phone. */
    noContact: `${prefix}lease-no-contact`,
    /** Drew, email only: paid while the rent roll is open. */
    paidLater: `${prefix}lease-paid-later`,
  },
  tenants: {
    avery: { id: `${prefix}tenant-avery`, name: 'Synthetic Avery' },
    blair: { id: `${prefix}tenant-blair`, name: 'Synthetic Blair' },
    casey: { id: `${prefix}tenant-casey`, name: 'Synthetic Casey' },
    drew: { id: `${prefix}tenant-drew`, name: 'Synthetic Drew' },
  },
  rent: { shared: 1200, noContact: 1300, paidLater: 1400 },
  /** A connected live SMS provider, which sandbox mode refuses: the SMS channel is unavailable. */
  liveSmsConnection: `${prefix}live-sms`,
} as const;

const leaseIds = Object.values(fixture.leases);
const tenantIds = Object.values(fixture.tenants).map((t) => t.id);

export async function removeFixtures() {
  const previews = await prisma.paymentReminderPreview.findMany({
    where: { leaseId: { in: leaseIds } },
    select: { id: true },
  });
  await prisma.paymentReminderAttempt.deleteMany({
    where: { previewId: { in: previews.map((p) => p.id) } },
  });
  await prisma.paymentReminderPreview.deleteMany({ where: { leaseId: { in: leaseIds } } });
  await prisma.providerConnection.deleteMany({ where: { id: fixture.liveSmsConnection } });
  await prisma.payment.deleteMany({ where: { leaseId: { in: leaseIds } } });
  await prisma.charge.deleteMany({ where: { leaseId: { in: leaseIds } } });
  await prisma.leaseEvent.deleteMany({ where: { leaseId: { in: leaseIds } } });
  await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await prisma.unit.deleteMany({ where: { propertyId: fixture.propertyId } });
  await prisma.property.deleteMany({ where: { id: fixture.propertyId } });
}

/** Rebuilds the property with three active, unpaid leases. Rent is due on the 1st, no grace. */
export async function resetFixtures() {
  await removeFixtures();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear() + 2, now.getUTCMonth(), 0));
  await prisma.property.create({
    data: {
      id: fixture.propertyId,
      organizationId,
      name: fixture.propertyName,
      type: 'MULTI_UNIT',
      street: '1 Synthetic Way',
      city: 'Testville',
      state: 'CA',
      postalCode: '90000',
    },
  });
  const { avery, blair, casey, drew } = fixture.tenants;
  await prisma.tenant.createMany({
    data: [
      {
        ...avery,
        organizationId,
        email: 'avery@example.invalid',
        phone: '+15005550006',
        smsRemindersEnabled: true,
      },
      { ...blair, organizationId, email: 'blair@example.invalid' },
      { ...casey, organizationId },
      { ...drew, organizationId, email: 'drew@example.invalid' },
    ],
  });
  const leases = [
    { id: fixture.leases.shared, unit: '1', rent: fixture.rent.shared, tenants: [avery, blair] },
    { id: fixture.leases.noContact, unit: '2', rent: fixture.rent.noContact, tenants: [casey] },
    { id: fixture.leases.paidLater, unit: '3', rent: fixture.rent.paidLater, tenants: [drew] },
  ];
  for (const lease of leases) {
    const unitId = `${prefix}unit-${lease.unit}`;
    await prisma.unit.create({
      data: {
        id: unitId,
        organizationId,
        propertyId: fixture.propertyId,
        number: lease.unit,
        status: 'OCCUPIED',
      },
    });
    await prisma.lease.create({
      data: {
        id: lease.id,
        organizationId,
        unitId,
        startDate: start,
        endDate: end,
        monthlyRent: lease.rent,
        deposit: 0,
        graceDays: 0,
        rentDueDay: 1,
        prorateFirstMonth: false,
        status: 'ACTIVE',
      },
    });
    await prisma.leaseTenant.createMany({
      data: lease.tenants.map((t, i) => ({
        leaseId: lease.id,
        tenantId: t.id,
        organizationId,
        isPrimary: i === 0,
      })),
    });
  }
}

/** Settles a lease's whole balance, as if a payment arrived after the rent roll rendered. */
export async function payInFull(leaseId: string, amount: number) {
  await prisma.payment.create({
    data: { organizationId, leaseId, amount, status: 'SUCCEEDED', paidAt: new Date() },
  });
}

/** A connected live SMS provider, which sandbox mode blocks: the SMS channel is unavailable. */
export async function connectLiveSms() {
  await prisma.providerConnection.create({
    data: {
      id: fixture.liveSmsConnection,
      organizationId,
      kind: 'SMS',
      provider: 'twilio',
      status: 'CONNECTED',
    },
  });
}

export async function dispatchedReminders(leaseId: string) {
  return prisma.paymentReminderPreview.findMany({
    where: { leaseId, dispatchedAt: { not: null } },
    include: { attempts: true },
  });
}

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';

export async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** The panel controlled by a RowMenu trigger (a disclosure, so it has no role of its own). */
export const panelOf = (_page: Page, trigger: Locator) =>
  trigger.locator('xpath=following-sibling::div[contains(@class, "row-menu-panel")]');

/** Every sampled point of an open panel hit-tests to the panel itself, not a neighbouring row. */
export async function panelOnTop(panel: Locator) {
  const covered = await panel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const xs = [r.left + 6, r.left + r.width / 2, r.right - 6];
    const ys = [r.top + 6, r.top + r.height / 2, r.bottom - 6];
    for (const x of xs)
      for (const y of ys) {
        const hit = document.elementFromPoint(x, y);
        if (!el.contains(hit)) return `.${hit?.className} at ${x},${y}`;
      }
    return '';
  });
  return covered === '' || covered;
}

/** The open panel sits inside the viewport, directly below or above its trigger. */
export async function expectAnchored(panel: Locator, trigger: Locator) {
  const p = (await panel.boundingBox())!;
  const t = (await trigger.boundingBox())!;
  const viewport = panel.page().viewportSize()!;
  expect(p.x).toBeGreaterThanOrEqual(8 - 0.5);
  expect(p.x + p.width).toBeLessThanOrEqual(viewport.width - 8 + 0.5);
  expect(p.y).toBeGreaterThanOrEqual(8 - 0.5);
  expect(p.y + p.height).toBeLessThanOrEqual(viewport.height - 8 + 0.5);
  const below = Math.abs(p.y - (t.y + t.height + 4)) < 1.5;
  const above = Math.abs(p.y + p.height - (t.y - 4)) < 1.5;
  expect(below || above).toBe(true);
  expect(await panelOnTop(panel)).toBe(true);
}
