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

test('manager reviews the rent roll, records a payment and applies a late fee', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/payments');
  await expect(page.getByRole('heading', { name: 'Payments', level: 1 })).toBeVisible();
  for (const label of ['Collected this month', 'Outstanding', 'Late', 'Next owner payout'])
    await expect(page.locator('.stat .label', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rent roll' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Owner payouts' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Collection tools' })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/payments-overview.png', fullPage: true });

  // Seeded Alex Rivera has paid October rent in full: status badge Paid, links to tenant/property/lease.
  const alex = page.locator('tbody tr', { hasText: 'Alex Rivera' });
  await expect(alex.locator('.badge', { hasText: 'Paid' })).toBeVisible();
  await expect(alex.getByRole('link', { name: 'Maple Court' })).toHaveAttribute(
    'href',
    /\/properties\/seed-property-maple$/,
  );
  await expect(alex.getByRole('link', { name: '$1,850' })).toHaveAttribute(
    'href',
    /\/leases\/seed-lease-maple-11$/,
  );

  // Record a partial offline payment against a late lease.
  const late = page
    .locator('tbody tr', { has: page.locator('.badge', { hasText: 'Late' }) })
    .first();
  const tenant = (await late.locator('strong').first().innerText()).trim();
  await late.getByRole('link', { name: 'Record payment' }).click();
  await expect(page.getByRole('heading', { name: 'Record payment' })).toBeVisible();
  await page.getByLabel('Amount').fill('100.00');
  await page.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByText('Payment recorded and applied to the ledger.')).toBeVisible();
  await expect(page.locator('tbody tr', { hasText: tenant }).getByText('owed')).toBeVisible();
  await page.screenshot({ path: 'test-results/payments-recorded.png', fullPage: true });

  // Apply a late fee to a lease still past its grace period.
  const feeRow = page
    .locator('tbody tr', { has: page.getByRole('button', { name: 'Add late fee' }) })
    .first();
  const feeTenant = (await feeRow.locator('strong').first().innerText()).trim();
  await feeRow.getByRole('button', { name: 'Add late fee' }).click();
  await expect(page.getByText('Late fee added to the tenant ledger.')).toBeVisible();
  const after = page.locator('tbody tr', { hasText: feeTenant });
  await expect(after.getByText('Late fee applied')).toBeVisible();
  await expect(after.getByRole('button', { name: 'Add late fee' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/payments-late-fee.png', fullPage: true });
});

test('payments requires a manager session', async ({ page }) => {
  await page.goto('/payments');
  await expect(page).toHaveURL(/\/sign-in/);
});
