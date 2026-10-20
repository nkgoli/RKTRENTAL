import { expect, test, type Page } from '@playwright/test';

// Explicitly opt in to the guarded production runtime; never provision or reseed here.
const expectedBuild = process.env.LEASE_BUILDER_EXPECTED_BUILD;
const expectedSource = process.env.LEASE_BUILDER_EXPECTED_SOURCE;
test.skip(
  !expectedBuild || !expectedSource,
  'Requires the task-owned production build and retained fixture.',
);

test.beforeEach(async ({ page, request, baseURL }) => {
  expect(baseURL).toBe('http://127.0.0.1:3308');
  const identity = await request.get('/__builder_identity');
  expect(identity.ok()).toBe(true);
  expect(await identity.json()).toMatchObject({
    checkout: process.cwd(),
    directory: process.cwd(),
    build: expectedBuild,
    source: expectedSource,
    port: 3308,
    databasePort: 55508,
  });
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
  await page
    .getByLabel('Password')
    .fill(process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

async function createThroughTenants(page: Page) {
  await page.goto('/leases/new?unit=seed-unit-maple-7&fresh=1');
  await page.getByLabel(/^Start date/).fill('2037-01-15');
  await page.locator('#custom-end-date').fill('2037-11-20');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rent, deposit & fees' })).toBeVisible();
  await page.getByLabel(/^Monthly rent/).fill('1681');
  await page.getByLabel(/^Security deposit/).fill('1500');
  await page.getByLabel(/^Rent due day/).selectOption('5');
  const rentSave = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/leases/new'),
  );
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const leaseId = (await rentSave).postDataJSON()[0]?.leaseId as string | undefined;
  expect(leaseId, 'The next save must address the draft persisted by the Term step').toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Tenants', exact: true })).toBeFocused();
  return leaseId!;
}

async function expectExit(page: Page, leaseId: string) {
  await page.getByRole('button', { name: 'Save and exit', exact: true }).click();
  // A persisted draft or successful POST alone is insufficient: the user must leave the wizard.
  await expect(page).toHaveURL(/\/leases\?tab=drafts$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Lease portfolio', exact: true })).toBeVisible();
  await page.locator(`a[href="/leases/new?draft=${leaseId}"]`).click();
}

test('fresh draft Save and exit reaches the list and resumes the saved step', async ({ page }) => {
  const leaseId = await createThroughTenants(page);
  await expectExit(page, leaseId);
  await expect(page.getByRole('heading', { name: 'Tenants', exact: true })).toBeFocused();
  await page.getByRole('button', { name: /Rent, deposit & fees/ }).click();
  await expect(page.getByLabel(/^Monthly rent/)).toHaveValue('1681');
  await expect(page.getByLabel(/^Rent due day/)).toHaveValue('5');
});

test('resumed draft Save and exit reaches the list with visited-step edits', async ({ page }) => {
  const leaseId = await createThroughTenants(page);
  await page.goto(`/leases/new?draft=${leaseId}`);
  await page.getByRole('button', { name: /Rent, deposit & fees/ }).click();
  await page.getByLabel(/^Monthly rent/).fill('1782');
  await expectExit(page, leaseId);
  await expect(page.getByRole('heading', { name: 'Rent, deposit & fees' })).toBeFocused();
  await expect(page.getByLabel(/^Monthly rent/)).toHaveValue('1782');
  await page.getByRole('button', { name: /Tenants/ }).click();
  await expect(page.getByRole('heading', { name: 'Tenants', exact: true })).toBeFocused();
});

test('failed exit keeps values, releases pending controls and permits an exit retry', async ({
  page,
}) => {
  const leaseId = await createThroughTenants(page);
  await page.getByRole('button', { name: /Rent, deposit & fees/ }).click();
  await page.getByLabel(/^Monthly rent/).fill('1893');
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/leases/new?*', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await held;
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Save and exit', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saving…');
  await expect(page.getByRole('button', { name: 'Save and exit', exact: true })).toBeDisabled();
  await expect(page.getByLabel(/^Monthly rent/)).toBeDisabled();
  release();
  const summary = page.getByRole('region', { name: 'Create lease' }).getByRole('alert');
  await expect(summary).toBeFocused();
  await expect(summary).toContainText('They are still here; try again.');
  await expect(page.getByLabel(/^Monthly rent/)).toHaveValue('1893');
  await expect(page.getByRole('button', { name: 'Save and exit', exact: true })).toBeEnabled();
  await page.unroute('**/leases/new?*');
  await expectExit(page, leaseId);
  await expect(page.getByLabel(/^Monthly rent/)).toHaveValue('1893');
});
