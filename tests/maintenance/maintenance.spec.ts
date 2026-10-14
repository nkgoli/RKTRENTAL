import { expect, test } from '@playwright/test';

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test('manager creates a photographed request, assigns a vendor, and changes status', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/maintenance');
  await expect(page.getByRole('heading', { name: 'Repairs at a glance' })).toBeVisible();
  await expect(
    page.locator('article').filter({ hasText: 'Kitchen sink leak' }).first(),
  ).toBeVisible();
  await expect(
    page
      .locator('article')
      .filter({ hasText: 'Window latch loose' })
      .getByText('Northstar Repairs')
      .first(),
  ).toBeVisible();

  const title = `Test repair ${Date.now()}`;
  const create = page.locator('#new-request');
  await create.getByLabel('Unit').selectOption({ label: 'Maple Court · 4B' });
  await create.getByLabel('Priority').selectOption('HIGH');
  await create.getByLabel('Request title').fill(title);
  await create.getByLabel('Description').fill('E2E maintenance request');
  await create
    .getByLabel('Photo')
    .setInputFiles({ name: 'repair.png', mimeType: 'image/png', buffer: PNG });
  await create.getByRole('button', { name: 'Create request' }).click();

  const ticket = page.locator('article').filter({ hasText: title });
  await expect(ticket).toBeVisible();
  await expect(ticket.getByRole('img', { name: `${title} photo` })).toBeVisible();
  await expect(ticket.getByText('High')).toBeVisible();
  await ticket.getByText('Manage request').click();
  await ticket.getByLabel('Assign vendor').selectOption({ label: 'Northstar Repairs' });
  await ticket.getByRole('button', { name: 'Assign', exact: true }).click();

  const assigned = page.locator('article').filter({ hasText: title });
  await expect(assigned.getByText('Northstar Repairs').first()).toBeVisible();
  await assigned.getByText('Manage request').click();
  await assigned.getByLabel('Change status').selectOption('IN_PROGRESS');
  await assigned.getByRole('button', { name: 'Update' }).click();
  await expect(
    page.getByRole('region', { name: 'In progress' }).locator('article').filter({ hasText: title }),
  ).toBeVisible();
  const inProgress = page.locator('article').filter({ hasText: title });
  await inProgress.getByText('Manage request').click();
  await inProgress.getByLabel('Comment').fill('Vendor visit confirmed.');
  await inProgress.getByRole('button', { name: 'Add comment' }).click();
  await page.locator('article').filter({ hasText: title }).getByText('Manage request').click();
  await expect(
    page.locator('article').filter({ hasText: title }).getByText('Vendor visit confirmed.'),
  ).toBeVisible();
});
