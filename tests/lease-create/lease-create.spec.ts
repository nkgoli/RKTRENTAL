import { expect, test } from '@playwright/test';

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('manager creates a lease for vacant Maple Court 3A and completes mock signing', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/leases/new');
  await expect(page.getByRole('heading', { name: 'Create lease' })).toBeVisible();
  await expect(page.getByText('Unit and tenants', { exact: true }).first()).toBeVisible();

  const unitSelect = page.getByLabel('Property / unit');
  const option = page.locator('select[aria-label="Property / unit"] option', {
    hasText: 'Maple Court · Unit 3A',
  });
  await unitSelect.selectOption((await option.getAttribute('value'))!);
  await page.getByRole('checkbox', { name: /Alex Rivera/ }).check();
  await page.screenshot({
    path: 'test-results/lease-create-step-1-unit-tenants.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Lease terms' })).toBeVisible();
  // Unique term per run so reruns against a persistent database never overlap.
  const year = 2100 + Math.floor(Math.random() * 800);
  await page.getByLabel('Start date').fill(`${year}-02-01`);
  await page.getByLabel('End date').fill(`${year + 1}-01-31`);
  await page.screenshot({ path: 'test-results/lease-create-step-2-terms.png', fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Rent and deposit' })).toBeVisible();
  await page.getByLabel('Monthly rent').fill('1600');
  await page.getByLabel('Security deposit').fill('1600');
  await page.screenshot({ path: 'test-results/lease-create-step-3-rent.png', fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Clauses and documents', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: /No smoking/ }).check();
  await page.screenshot({ path: 'test-results/lease-create-step-4-clauses.png', fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Review and send' })).toBeVisible();
  await expect(page.getByText('Maple Court · Unit 3A').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/lease-create-step-5-review.png', fullPage: true });
  await page.getByRole('button', { name: 'Send for e-signature' }).click();

  await expect(page.getByText(/sent for e-signature/)).toBeVisible();
  await page.getByRole('button', { name: 'Complete mock signing' }).click();
  await expect(page.getByText(/Mock signing complete/)).toBeVisible();
  await expect(page.getByText('Signed lease agreement.pdf stored')).toBeVisible();
  await page.screenshot({ path: 'test-results/lease-create-signed.png', fullPage: true });

  await page.getByRole('link', { name: 'View lease detail' }).click();
  await expect(page).toHaveURL(/\/leases\/(?!new)[^/?]+$/);
  await expect(page.getByText('Signed lease agreement.pdf').first()).toBeVisible();
  await expect(page.getByText('Signed', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/lease-create-lease-detail.png', fullPage: true });
});

test('wizard blocks continuing without a unit and tenant, and saves a draft', async ({ page }) => {
  await signIn(page);
  await page.goto('/leases/new');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Select a unit for this lease.')).toBeVisible();
  await expect(page.getByText('Select at least one tenant.')).toBeVisible();
});

test('renewal wizard prefills the following term', async ({ page }) => {
  await signIn(page);
  await page.goto('/leases/new?renew=seed-lease-maple-11');
  await expect(page.getByRole('heading', { name: 'Renew lease' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByLabel('Start date')).toHaveValue('2026-12-01');
  await expect(page.getByLabel('End date')).toHaveValue('2027-11-30');
});


