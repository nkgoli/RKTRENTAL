import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

/** Tenant repairs at phone width (390px) against the seeded demo database (Alex Rivera). */
const prisma = new PrismaClient();
test.use({ viewport: { width: 390, height: 844 } });
test.afterAll(async () => prisma.$disconnect());

const tenantEmail = 'alex.rivera@email.com';
const tenantPassword = process.env.ROCKETRENTAL_DEMO_TENANT_PASSWORD ?? 'AlexDemo#2026';
const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const otherTitle = 'E2E other unit repair';

async function signIn(page: Page, email: string, password: string, landing: RegExp) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(landing);
}

/** A repair on a different unit and tenant, which Alex must never see. */
async function seedOtherUnitRepair() {
  const alexLease = await prisma.lease.findUniqueOrThrow({ where: { id: 'seed-lease-maple-11' } });
  const unit = await prisma.unit.findFirstOrThrow({
    where: { organizationId: alexLease.organizationId, id: { not: alexLease.unitId } },
  });
  await prisma.maintenanceRequest.upsert({
    where: { id: 'e2e-tenant-repairs-other' },
    update: {},
    create: {
      id: 'e2e-tenant-repairs-other',
      organizationId: alexLease.organizationId,
      propertyId: unit.propertyId,
      unitId: unit.id,
      title: otherTitle,
    },
  });
}

test('repairs require a tenant session', async ({ page }) => {
  await page.goto('/repairs');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('Alex submits a repair with a photo, then follows the manager status change', async ({
  browser,
  page,
}) => {
  await seedOtherUnitRepair();
  await signIn(page, tenantEmail, tenantPassword, /\/home$/);
  await page.goto('/repairs');
  await expect(page.getByRole('heading', { name: 'Repairs', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New repair request' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your requests' })).toBeVisible();
  await expect(page.getByText(otherTitle)).toHaveCount(0);

  const title = `Bathroom fan rattles ${Date.now()}`;
  await page.getByLabel('Category').selectOption('Electrical');
  await page.getByLabel('What needs fixing?').fill(`${title}. It started on Monday.`);
  await page
    .getByLabel('Choose files')
    .setInputFiles({ name: 'fan.png', mimeType: 'image/png', buffer: PNG });
  await page.getByLabel('I need to be home — call first').check();
  await page.getByLabel('Urgency').selectOption('HIGH');
  await page.getByRole('button', { name: 'Submit request' }).click();

  await expect(page).toHaveURL(/\/repairs\?notice=submitted/);
  await expect(page.getByText('Repair request sent.')).toBeVisible();
  const card = page.locator('article').filter({ hasText: title });
  await expect(card.getByText('Received').first()).toBeVisible();
  await expect(card.getByText('Electrical ·')).toBeVisible();
  await expect(card.getByRole('img', { name: /fan\.png/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: 'tests/tenant-repairs/evidence/tenant-repairs-submitted.png',
    fullPage: true,
  });

  // The manager sees it on the board and moves it along.
  const managerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const manager = await managerContext.newPage();
  await signIn(manager, managerEmail, managerPassword, /\/dashboard$/);
  await manager.goto('/maintenance');
  const ticket = manager.locator('article').filter({ hasText: title });
  await expect(ticket).toBeVisible();
  await ticket.getByText('Manage request').click();
  await ticket.getByRole('combobox', { name: /^Change status/ }).selectOption('IN_PROGRESS');
  await ticket.getByRole('button', { name: 'Update' }).click();
  // The inherited manager action persists but can leave its streamed UI pending.
  // Check persistence, then explicitly reload; live manager refresh is a disclosed limitation.
  await expect
    .poll(
      async () =>
        (await prisma.maintenanceRequest.findFirst({ where: { title: { startsWith: title } } }))
          ?.status,
    )
    .toBe('IN_PROGRESS');
  await manager.reload();
  const column = manager.getByRole('region', { name: 'In progress' });
  await expect(column.locator('article').filter({ hasText: title })).toBeVisible({
    timeout: 20000,
  });
  const moved = manager.locator('article').filter({ hasText: title });
  await moved.getByText('Manage request').click();
  await moved
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill('Vendor visit confirmed.');
  await moved.getByRole('button', { name: 'Add comment' }).click();
  await expect
    .poll(async () =>
      prisma.maintenanceEvent.count({
        where: {
          maintenanceRequest: { title: { startsWith: title } },
          body: 'Vendor visit confirmed.',
        },
      }),
    )
    .toBeGreaterThan(0);
  await manager.reload();
  await expect(manager.locator('article').filter({ hasText: title })).toContainText(
    'Vendor visit confirmed.',
  );
  await managerContext.close();

  await page.goto('/repairs');
  const updated = page.locator('article').filter({ hasText: title });
  await expect(updated.getByText('In progress').first()).toBeVisible();
  await expect(updated.getByText('Manager: Vendor visit confirmed.')).toBeVisible();
  await expect(page.getByText(otherTitle)).toHaveCount(0);
  await page.screenshot({
    path: 'tests/tenant-repairs/evidence/tenant-repairs-status.png',
    fullPage: true,
  });

  await updated.getByLabel(/^Add a comment to/).fill('Thanks, I will be home.');
  await updated.getByRole('button', { name: 'Send' }).click();
  await expect(
    page.locator('article').filter({ hasText: title }).getByText('You: Thanks, I will be home.'),
  ).toBeVisible();
});
