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
  await expect(
    page.getByRole('heading', { name: /^Maple Court · Unit \w+/, level: 1 }),
  ).toBeVisible();
  for (const heading of ['Leased premises', 'Tenants on this lease']) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByLabel('Lease summary').getByText('Alex Rivera').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Maple Court' }).first()).toHaveAttribute(
    'href',
    '/properties/seed-property-maple',
  );
  await expect(page.getByRole('link', { name: /Renew lease/ })).toHaveAttribute(
    'href',
    '/leases/new?renew=seed-lease-maple-11',
  );
  await page.screenshot({ path: 'test-results/lease-detail-alex.png', fullPage: true });

  const sections = page.getByRole('navigation', { name: 'Lease sections' });
  for (const [name, heading] of [
    ['Agreement', 'Lease terms'],
    ['Payments', 'Rent ledger'],
    ['Activity', 'E-signature history'],
    ['Documents', 'Lease documents'],
  ]) {
    await sections.getByRole('link', { name, exact: true }).click();
    await expect(sections.getByRole('link', { name, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }

  const name = `Lease flow ${Date.now()}.pdf`;
  await page
    .getByRole('region', { name: 'Upload lease document' })
    .getByLabel('Choose files')
    .setInputFiles({
      name,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n'),
    });
  const file = page.locator('article', { hasText: name });
  await expect(file.getByText(name, { exact: true })).toBeVisible();
  const download = file.getByRole('link', { name: /Download/ }).first();
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

test('lease workspace supports keyboard navigation and phone layouts', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/leases/seed-lease-maple-11');
  const sections = page.getByRole('navigation', { name: 'Lease sections' });
  await sections.getByRole('link', { name: 'Overview', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(sections.getByRole('link', { name: 'Agreement', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Lease terms', exact: true })).toBeVisible();
  await page.getByText('Edit terms', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save terms' })).toBeVisible();
  await page.getByText('Record notice or move-out', { exact: true }).click();
  await expect(page.getByLabel('Planned move-out')).toBeVisible();
  await page.getByRole('button', { name: 'Terminate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm terminate' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm terminate' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['Overview', 'Agreement', 'Documents', 'Payments', 'Activity']) {
    await sections.getByRole('link', { name, exact: true }).click();
    await expect(sections.getByRole('link', { name, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.screenshot({ path: 'test-results/lease-activity-phone.png', fullPage: true });
});

test('manager starts a renewal and reviews re-evaluated template terms', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/leases/seed-lease-maple-11');
  await page.goto('/leases/new?renew=seed-lease-maple-11&fresh=1');
  await expect(page).toHaveURL(/\/leases\/new\?renew=seed-lease-maple-11&fresh=1/);
  await expect(page.getByRole('region', { name: 'Create lease' })).not.toHaveAttribute('inert', '');
  await expect(page.getByLabel('Start date')).toHaveValue('2026-12-01');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rent, deposit & fees' })).toBeVisible();
  await page.getByLabel('Monthly rent').fill('1900.00');
  for (const heading of ['Tenants', 'Options', 'Clauses']) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByText('Carried over from the prior lease.')).toBeVisible();
  await expect(page.getByText('Added because this is a fixed-term lease').first()).toBeVisible();
  await page.getByRole('button', { name: 'Re-apply template' }).click();
  await expect(page.getByRole('button', { name: /Early Termination/ })).toBeVisible();
});
