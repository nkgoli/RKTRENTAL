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

test('manager lists and searches tenants and is led to Applications to add one', async ({
  page,
}) => {
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

  // Tenants come from approved applicants; the directory offers Applications, not a form.
  await page.goto('/tenants?view=directory&add=1');
  await expect(page).toHaveURL(/\/applications$/);
  await page.goto('/tenants?view=directory');
  await expect(page.locator('#add-tenant')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Review applications', exact: true }),
  ).toHaveAttribute('href', '/applications');
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

// Manual creation is gone; move-in/out of a newly promoted applicant is covered by the
// approved-applicant promotion work, which owns creating the tenant this flow needs.
test.fixme('manager moves a newly promoted tenant in and out of a vacant unit', async () => {});
