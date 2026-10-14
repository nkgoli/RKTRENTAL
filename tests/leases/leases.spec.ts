import { expect, test } from '@playwright/test';

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';

test('manager reviews lease tabs, Alex Rivera detail, and uploads a lease document', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/leases');
  await expect(page.getByRole('heading', { name: 'Leases', level: 1 })).toBeVisible();
  const tabs = page.getByRole('navigation', { name: 'Sections' });
  for (const name of [/^Active \d+$/, /^Expiring soon \d+$/, /^Drafts \d+$/, /^Ended \d+$/]) {
    await expect(tabs.getByRole('link', { name })).toBeVisible();
  }
  await expect(page.locator('tbody tr', { hasText: 'Alex Rivera' })).toBeVisible();
  await page.screenshot({ path: 'test-results/leases-list.png', fullPage: true });
  await tabs.getByRole('link', { name: /^Expiring soon/ }).click();
  await expect(page).toHaveURL(/tab=expiring/);
  await expect(page.locator('tbody tr', { hasText: 'Alex Rivera' })).toBeVisible();
  await tabs.getByRole('link', { name: /^Drafts/ }).click();
  await expect(page).toHaveURL(/tab=drafts/);
  await tabs.getByRole('link', { name: /^Ended/ }).click();
  await expect(page).toHaveURL(/tab=ended/);

  await page.goto('/leases/seed-lease-maple-11');
  await expect(page.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeVisible();
  for (const heading of [
    'Leased premises',
    'Lease terms',
    'Documents',
    'Tenants on this lease',
    'Rent ledger',
    'E-signature history',
    'Activity',
  ]) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Maple Court' })).toHaveAttribute(
    'href',
    '/properties/seed-property-maple',
  );
  await expect(page.getByRole('link', { name: /Renew lease/ })).toHaveAttribute(
    'href',
    '/leases/new?renew=seed-lease-maple-11',
  );
  await page.screenshot({ path: 'test-results/lease-detail-alex.png', fullPage: true });

  const name = `Lease flow ${Date.now()}.pdf`;
  await page.getByTestId('upload-lease-document').setInputFiles({
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n'),
  });
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  const file = page.locator('.file', { hasText: name });
  const download = file.getByRole('link', { name: /Download/ });
  const href = await download.getAttribute('href');
  expect(href).toMatch(/^\/api\/files\/[^/]+\/download$/);
  const response = await page.request.get(href!);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-disposition']).toContain('attachment');
  await page.screenshot({ path: 'test-results/lease-uploaded.png', fullPage: true });
  await page.request.delete(href!.replace('/download', ''));
});

test('lease pages require a manager session', async ({ page }) => {
  await page.goto('/leases');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('manager renews, edits, activates and terminates a lease', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/leases/seed-lease-maple-11');
  await page.getByRole('link', { name: 'Renew lease' }).click();
  await expect(page).toHaveURL(/\/leases\/new\?renew=seed-lease-maple-11/);
  await expect(page.getByLabel('Start date')).toHaveValue('2026-12-01');
  await page.getByLabel('Monthly rent').fill('1900.00');
  await page.getByRole('button', { name: 'Create renewal draft' }).click();
  await expect(page).toHaveURL(/\/leases\/[^/?]+$/);
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  await page.locator('#edit-terms').getByLabel('Monthly rent').fill('1950.00');
  await page.getByRole('button', { name: 'Save terms' }).click();
  await expect(page.getByText('Lease terms saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Activate lease' }).click();
  await expect(page.getByText('Lease activated.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Active', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Terminate', exact: true }).click();
  await expect(page.getByText('Terminate this lease?')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm terminate' }).click();
  await expect(page.getByText('Lease terminated.')).toBeVisible();
});
