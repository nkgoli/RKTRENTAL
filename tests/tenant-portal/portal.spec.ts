import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

/**
 * Tenant home and lease at phone width (390px) against the seeded demo database (Alex Rivera).
 */
const prisma = new PrismaClient();
test.use({ viewport: { width: 390, height: 844 } });
test.afterAll(async () => prisma.$disconnect());

const tenantEmail = 'alex.rivera@email.com';
const tenantPassword = process.env.ROCKETRENTAL_DEMO_TENANT_PASSWORD ?? 'AlexDemo#2026';
const otherLease = 'e2e-portal-other-lease';
const otherDoc = 'e2e-portal-other-doc';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(tenantEmail);
  await page.getByLabel('Password').fill(tenantPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/home$/);
  // The dev server compiles /home on first hit and can fail that first load; reload once.
  const heading = page.getByRole('heading', { name: 'Welcome home', level: 1 });
  if (!(await heading.isVisible({ timeout: 15_000 }).catch(() => false))) await page.reload();
}

/** A second tenant's lease and document, so the refusal is against real data. */
async function seedOtherTenant() {
  const alexLease = await prisma.lease.findUniqueOrThrow({ where: { id: 'seed-lease-maple-11' } });
  const organizationId = alexLease.organizationId;
  const unit = await prisma.unit.findFirstOrThrow({
    where: { organizationId, id: { not: alexLease.unitId }, leases: { none: {} } },
  });
  await prisma.tenant.upsert({
    where: { id: 'e2e-portal-other-tenant' },
    update: {},
    create: { id: 'e2e-portal-other-tenant', organizationId, name: 'Robin Other' },
  });
  await prisma.lease.upsert({
    where: { id: otherLease },
    update: {},
    create: {
      id: otherLease,
      organizationId,
      unitId: unit.id,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
      monthlyRent: '1200.00',
      deposit: '1200.00',
      status: 'ACTIVE',
    },
  });
  await prisma.leaseTenant.upsert({
    where: { leaseId_tenantId: { leaseId: otherLease, tenantId: 'e2e-portal-other-tenant' } },
    update: {},
    create: {
      leaseId: otherLease,
      tenantId: 'e2e-portal-other-tenant',
      organizationId,
      isPrimary: true,
    },
  });
  await prisma.document.upsert({
    where: { id: otherDoc },
    update: {},
    create: {
      id: otherDoc,
      organizationId,
      leaseId: otherLease,
      kind: 'LEASE',
      name: 'Robin lease.pdf',
      storageKey: 'e2e/tenant-portal/other-lease.pdf',
      sizeBytes: 100,
      mimeType: 'application/pdf',
    },
  });
}

test('tenant home and lease require a tenant session', async ({ page }) => {
  for (const path of ['/home', '/lease']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in/);
  }
});

test('Alex Rivera sees home with amount due, quick actions and links', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Welcome home', level: 1 })).toBeVisible();
  await expect(page.getByText(/Hi Alex Rivera · Maple Court · Unit 4B/)).toBeVisible();
  await expect(page.getByText(/^Rent due/)).toBeVisible();
  await expect(page.getByRole('region', { name: /^Rent due/ }).locator('.amount')).toHaveText(
    '$1,850',
  );
  await expect(page.getByRole('heading', { name: 'Quick actions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Open repair request' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Announcements' })).toBeVisible();
  const tabs = page.getByRole('navigation', { name: 'Tenant' });
  for (const name of ['Home', 'Pay', 'Lease', 'Repairs'])
    await expect(tabs.getByRole('link', { name })).toBeVisible();
  // The whole screen fits a 390px column without sideways scrolling.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/tenant-home.png', fullPage: true });
  await page.getByRole('link', { name: 'Pay now' }).click();
  await expect(page).toHaveURL(/\/pay$/);
});

test('Alex opens the lease, previews and downloads a document, and is refused another tenant file', async ({
  page,
}) => {
  await seedOtherTenant();
  await signIn(page);
  await page.goto('/lease');
  await expect(page.getByRole('heading', { name: 'Your lease', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current lease' })).toBeVisible();
  await expect(page.getByText('Dec 1, 2025 – Nov 30, 2026')).toBeVisible();
  await expect(page.getByText('Alex Rivera, Casey Rivera')).toBeVisible();
  // The detailed reminder lives on Home; Lease keeps renewal as term metadata.
  await expect(page.getByText('Renewal pending')).toBeVisible();
  await expect(page.getByText('Renewal coming up')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Lease & documents' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unit photos' })).toBeVisible();
  await expect(page.locator('.photo img').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/tenant-lease.png', fullPage: true });

  // Preview serves the tenant's own signed lease inline (headless Chromium has no PDF viewer,
  // so check the link and fetch it with the session instead of opening a tab).
  const preview = page.getByRole('link', { name: /Preview Signed lease/ });
  await expect(preview).toHaveAttribute('target', '_blank');
  const previewUrl = await preview.getAttribute('href');
  expect(previewUrl).toMatch(/^\/api\/files\/[^/]+\/preview$/);
  const own = await page.request.get(previewUrl!);
  expect(own.status()).toBe(200);
  expect(own.headers()['content-type']).toBe('application/pdf');
  expect(own.headers()['content-disposition']).toContain('inline');
  await page.screenshot({ path: 'test-results/tenant-lease-document.png' });
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: /Download Signed lease/ }).click();
  expect((await download).suggestedFilename()).toMatch(/Signed.*lease/i);

  // Another tenant's document is refused for preview and download.
  for (const kind of ['preview', 'download']) {
    const res = await page.request.get(`/api/files/${otherDoc}/${kind}`);
    expect(res.status()).toBe(403);
  }
  const refused = await page.goto(`/api/files/${otherDoc}/preview`);
  expect(refused?.status()).toBe(403);
  await page.screenshot({ path: 'test-results/tenant-document-refused.png' });
});
