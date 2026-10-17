import { expect, test } from '@playwright/test';

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';

test('manager dashboard shows live portfolio data and opens an expiring lease', async (
  { page },
  testInfo,
) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rent collection this month' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leases expiring soon' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alex Rivera', exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('dashboard-after-sign-in.png'),
    fullPage: true,
  });

  await page.getByRole('link', { name: 'Alex Rivera', exact: true }).click();
  await expect(page).toHaveURL(/\/leases\/seed-lease-maple-11$/);
  await expect(page.getByRole('heading', { name: /^Maple Court · Unit \w+ Lease$/, level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leased premises' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('expiring-lease-detail.png'),
    fullPage: true,
  });
});

test('dashboard requires a signed-in manager', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/sign-in/);
});

