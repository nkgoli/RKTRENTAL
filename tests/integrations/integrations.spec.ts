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

test('manager connects a provider and changes settings', async ({ page }) => {
  await signIn(page);
  await page.goto('/integrations');
  await expect(page.getByRole('heading', { name: 'Payment providers' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tenant screening providers' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rent comps data providers' })).toBeVisible();

  // Start from a known state so the flow is repeatable.
  const checkr = page.locator('article[data-provider="checkr"]');
  if ((await checkr.getAttribute('data-status')) === 'CONNECTED') {
    await checkr.getByText('Configure Checkr').click();
    await checkr.getByRole('button', { name: 'Disconnect' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Disconnect', exact: true }).click();
    await expect(page.getByText('Checkr disconnected')).toBeVisible();
  }

  await page.getByRole('button', { name: 'Connect Checkr' }).click();
  await expect(page.getByText('Checkr connected')).toBeVisible();
  const connected = page.locator('article[data-provider="checkr"]');
  await expect(connected.getByText('Sandbox', { exact: true })).toBeVisible();
  await expect(connected.getByText('Sandbox · no live sync')).toBeVisible();
  await expect(connected.getByText('Last sandbox activity')).toBeVisible();
  await connected.getByText('Configure Checkr').click();
  await expect(connected.getByText('value never shown')).toBeVisible();

  const comps = page.getByRole('form', { name: 'Rent comps settings' });
  await comps.getByLabel('Default search radius').selectOption('3');
  await comps.getByLabel('Data refresh').selectOption('weekly');
  await expect(page.getByRole('status').filter({ hasText: 'Rent comps settings updated' }).first()).toBeVisible();

  await page.goto('/integrations');
  const reloaded = page.getByRole('form', { name: 'Rent comps settings' });
  await expect(reloaded.getByLabel('Default search radius')).toHaveValue('3');
  await expect(reloaded.getByLabel('Data refresh')).toHaveValue('weekly');
});
