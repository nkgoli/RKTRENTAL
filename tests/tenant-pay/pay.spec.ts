import { expect, test, type Page } from '@playwright/test';

/**
 * Tenant pay flow at phone width (390px) against a freshly seeded database
 * (Alex Rivera owes $1,850 for the upcoming month). Run `npm run db:seed`
 * before re-running locally: a completed run settles that month for real.
 */
const tenantEmail = 'alex.rivera@email.com';
const tenantPassword = process.env.ROCKETRENTAL_DEMO_TENANT_PASSWORD ?? 'AlexDemo#2026';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(tenantEmail);
  await page.getByLabel('Password').fill(tenantPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test('pay screen requires a tenant session', async ({ page }) => {
  await page.goto('/pay');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('Alex Rivera pays $1,850 by card with the mock provider', async ({ page }) => {
  await signIn(page);
  // The dev server compiles /pay on first hit and can reset that first navigation.
  await page.goto('/pay').catch(() => page.goto('/pay'));
  await expect(page.getByRole('heading', { name: /Pay \w+ rent/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Amount due' })).toBeVisible();
  await expect(page.getByText('$1,850', { exact: true }).first()).toBeVisible();
  // Exactly one month is billed: the amount defaults to a single $1,850, never $3,700.
  await expect(page.getByRole('textbox', { name: 'Amount' })).toHaveValue('1850.00');
  await expect(page.getByRole('heading', { name: 'Recent receipts' })).toBeVisible();
  await expect(page.getByText('October rent')).toBeVisible();
  await page.screenshot({ path: 'test-results/tenant-pay-screen.png', fullPage: true });

  // Card through the provider hosted field; the passed-on fee is shown before paying.
  await page.getByRole('radio', { name: /Card/ }).check();
  await expect(page.getByText(/fee \(2\.9%\)/)).toBeVisible();
  await page.getByRole('button', { name: /Pay \$/ }).click();
  await expect(page.getByRole('button', { name: 'Confirm payment' })).toBeVisible();
  await page.screenshot({ path: 'test-results/tenant-pay-confirm.png', fullPage: true });
  await page.getByRole('button', { name: 'Confirm payment' }).click();

  await expect(page.getByText('Payment received.')).toBeVisible();
  await expect(page.getByText(/all paid up/)).toBeVisible();
  await expect(page.locator('.badge', { hasText: 'Paid' }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/tenant-pay-receipt.png', fullPage: true });
});

test('autopay turns on with a saved method and back off', async ({ page }) => {
  await signIn(page);
  await page.goto('/pay');
  await page.getByRole('button', { name: /Add bank account/ }).click();
  await expect(page.getByText('Payment method added.')).toBeVisible();

  const toggle = page.getByRole('switch', { name: 'Autopay' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Currently on')).toBeVisible();
  await page.screenshot({ path: 'test-results/tenant-pay-autopay.png', fullPage: true });

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Currently off')).toBeVisible();
});
