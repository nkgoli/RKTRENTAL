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

test('manager lists, searches, adds and opens a tenant', async ({ page }) => {
  await signIn(page);
  await page.goto('/tenants');
  await expect(page.getByRole('heading', { name: 'Tenants', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Tenant views' })).toBeVisible();
  await page.getByRole('link', { name: 'Directory', exact: true }).click();
  await expect(page).toHaveURL(/view=directory/);
  await expect(page.getByRole('link', { name: /Alex Rivera/ }).first()).toBeVisible();

  await page.getByRole('searchbox').fill('priya');
  await page.getByRole('searchbox').press('Enter');
  await expect(page).toHaveURL(/q=priya/);
  await expect(page.getByRole('link', { name: /Priya Shah/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Alex Rivera/ })).toHaveCount(0);

  await page.goto('/tenants?view=directory');
  const unique = `e2e-${Date.now()}`;
  const form = page.locator('#add-tenant');
  await form.getByLabel('Full name').fill('Validation Check');
  await form.getByLabel('Email').fill('not-an-email');
  await form.getByRole('button', { name: 'Save tenant' }).click();
  await expect(form.getByText('Enter a valid email.')).toBeVisible();

  await form.getByLabel('Email').fill(`${unique}@example.com`);
  await form.getByLabel('Full name').fill(`Pat ${unique}`);
  await form.getByLabel('Phone').fill('(555) 010-2030');
  await form.getByRole('button', { name: 'Save tenant' }).click();

  await expect(page).toHaveURL(/\/tenants\/[^/?]+$/);
  await expect(page.getByRole('heading', { name: `Pat ${unique}`, level: 1 })).toBeVisible();
  await expect(page.getByText(`${unique}@example.com`)).toBeVisible();
  await expect(page.getByText('No lease', { exact: true })).toBeVisible();
});

test('tenant detail shows lease summary linking to the lease', async ({ page }) => {
  await signIn(page);
  await page.goto('/tenants?view=directory&q=alex.rivera');
  await page
    .getByRole('link', { name: /Alex Rivera/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/tenants\/seed-tenant-maple-11(\?|$)/);
  await expect(page.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lease summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payment history' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View lease' }).first()).toHaveAttribute(
    'href',
    '/leases/seed-lease-maple-11',
  );
});

test('manager moves a new tenant in and out of a vacant unit', async ({ page }) => {
  await signIn(page);
  await page.goto('/tenants?view=directory');
  const form = page.locator('#add-tenant');
  const name = `Mover ${Date.now()}`;
  await form.getByLabel('Full name').fill(name);
  await form.locator('select[name=propertyId]').selectOption({ label: 'Maple Court' });
  await form.locator('select[name=unitId]').selectOption({ label: '3A' });
  await form.getByLabel('Move-in date').fill('2026-11-01');
  await form.getByRole('button', { name: 'Save tenant' }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Move in' }).click();
  await expect(page.getByText(/Moved in Nov 1, 2026/)).toBeVisible();
  await expect(page.getByText('Current', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Move out', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Move out', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Move out', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm move out' }).click();
  await expect(page.getByText('This tenant has moved out.')).toBeVisible();
  await expect(page.getByText('Past tenant')).toBeVisible();
});
