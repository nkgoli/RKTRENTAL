import { expect, test } from '@playwright/test';

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';
const tenantEmail = 'alex.rivera@email.com';
const tenantPassword = process.env.ROCKETRENTAL_DEMO_TENANT_PASSWORD ?? 'AlexDemo#2026';

test('manager signs in and out', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/sign-out');
  await page.getByRole('button', { name: 'Sign out of RocketRental' }).click();
  await expect(page).toHaveURL(/\/sign-in\?loggedOut=1$/);
});

test('tenant cannot open a manager route or another tenant lease', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(tenantEmail);
  await page.getByLabel('Password').fill(tenantPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/home$/);

  const response = await page.request.get('/api/auth/leases/seed-lease-maple-1');
  expect(response?.status()).toBe(404);
});
