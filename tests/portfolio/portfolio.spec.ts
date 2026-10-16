import { expect, test, type Page } from '@playwright/test';

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('unit detail shows floor, market rent and amenities', async ({ page }) => {
  await signIn(page);
  await page.goto('/properties/seed-property-maple/units/seed-unit-maple-11');
  const facts = page.locator('dl').filter({ hasText: 'Listed rent' });
  await expect(facts.getByText('Floor', { exact: true })).toBeVisible();
  await expect(facts.getByText('Market rent', { exact: true })).toBeVisible();
  await expect(facts.getByText('In-unit laundry')).toBeVisible();
  await page.screenshot({ path: 'test-results/portfolio-unit-detail.png', fullPage: true });
});

test('create-lease links open the wizard prefilled', async ({ page }) => {
  await signIn(page);
  await page.goto('/properties/seed-property-maple/units/seed-unit-maple-7');
  // 3A is vacant until the lease-create suite fills it; then the unit links to its lease instead.
  const createLease = page.getByRole('link', { name: 'Create lease' }).first();
  const viewLease = page.getByRole('link', { name: 'View lease' });
  await expect(createLease.or(viewLease)).toBeVisible();
  if (await createLease.isVisible()) {
    await expect(createLease).toHaveAttribute('href', '/leases/new?unit=seed-unit-maple-7');
  } else {
    await expect(viewLease).toHaveAttribute(
      'href',
      /^\/leases\/[^/?]+\?propertyId=seed-property-maple&unitId=seed-unit-maple-7$/,
    );
  }

  // `fresh` starts a new wizard instead of resuming a draft another suite left on this unit.
  await page.goto('/leases/new?unit=seed-unit-maple-7&fresh=1');
  await expect(page.getByText('Build the agreement for Maple Court · Unit 3A')).toBeVisible();

  await page.goto('/leases/new?unit=seed-unit-maple-7&applicant=seed-application-olivia&fresh=1');
  await expect(page.getByText('Build the agreement for Maple Court · Unit 3A')).toBeVisible();
  // Olivia is an applicant, not a tenant yet; the Tenants step says so.
  const wizard = page.getByRole('region', { name: 'Create lease' });
  await wizard.getByRole('button', { name: 'Next', exact: true }).click();
  await wizard.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Olivia Reed (olivia.reed@example.com) isn’t a tenant yet.')).toBeVisible();

  await page.goto('/tenants/seed-tenant-maple-11');
  await expect(page.getByRole('link', { name: 'Renew lease' })).toHaveAttribute(
    'href',
    /^\/leases\/new\?renew=.+/,
  );

  await page.goto('/tenants?view=directory');
  await page.locator('select[name=propertyId]').selectOption({ label: 'Cedar Row Townhomes' });
  await page.locator('select[name=unitId]').selectOption({ index: 1 });
  await expect(page.getByRole('link', { name: 'Create lease' })).toHaveAttribute(
    'href',
    /\/leases\/new\?unit=seed-unit-cedar-/,
  );
});

test('tenant detail shows emergency contact, notice and writable notes', async ({ page }) => {
  await signIn(page);
  await page.goto('/tenants/seed-tenant-maple-11');
  await expect(page.getByText('Maria Rivera')).toBeVisible();
  const note = `Portfolio note ${Date.now()}`;
  await page.getByLabel('Note', { exact: true }).fill(note);
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText('Note added.')).toBeVisible();
  await expect(page.getByText(note)).toBeVisible();
  await page.screenshot({ path: 'test-results/portfolio-tenant-notes.png', fullPage: true });

  await page.goto('/tenants/seed-tenant-maple-6');
  await expect(page.getByText('Notice given').first()).toBeVisible();
});

test('lease detail lists per-signer e-sign events and notice', async ({ page }) => {
  await signIn(page);
  await page.goto('/leases/seed-lease-maple-11');
  const signers = page.getByLabel('Signers');
  await expect(signers.getByText('Alex Rivera')).toBeVisible();
  await expect(signers.getByText('Signed', { exact: true })).toBeVisible();
  await expect(page.getByText('Sent for signature: Alex Rivera')).toBeVisible();
  await page.screenshot({ path: 'test-results/portfolio-lease-events.png', fullPage: true });

  await page.goto('/leases/seed-lease-maple-6');
  await expect(page.getByText('Notice given', { exact: false }).first()).toBeVisible();
});
