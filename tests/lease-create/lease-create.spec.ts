import { expect, test } from '@playwright/test';

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function next(page: import('@playwright/test').Page, heading: string) {
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}

test('manager builds a lease in the wizard, resumes it, and sends it for signing', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/leases/new');
  const option = page.locator('select[name="unit"] option', { hasText: 'Maple Court · Unit 3A' });
  await page.getByLabel('Property / unit').selectOption((await option.getAttribute('value'))!);
  await page.getByRole('button', { name: 'Start lease' }).click();

  await expect(page.getByRole('heading', { name: 'Lease term', exact: true })).toBeVisible();
  // Unique term per run so reruns against a persistent database never overlap.
  const year = 2100 + Math.floor(Math.random() * 800);
  await page.getByLabel('Start date').fill(`${year}-02-15`);
  await expect(page.getByText(`${year + 1}-02-14`)).toBeVisible();
  await expect(page.getByText(`${year}-02-28`)).toBeVisible();
  await next(page, 'Rent, deposit & fees');

  await page.getByLabel('Monthly rent').fill('1600');
  await page.getByLabel('Security deposit').fill('1600');
  await expect(page.getByText('Scheduled charges preview')).toBeVisible();
  await expect(page.getByText('Prorated February rent')).toBeVisible();
  await next(page, 'Tenants');

  await page.getByRole('checkbox', { name: /Alex Rivera/ }).check();
  await next(page, 'Options');
  await next(page, 'Clauses');

  // Save and exit, then come back: the wizard resumes on Clauses with finished steps checked.
  await page.getByRole('button', { name: 'Save and exit' }).click();
  await expect(page).toHaveURL(/\/leases\?tab=drafts/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Clauses', exact: true })).toBeVisible();

  await page.getByRole('checkbox', { name: /No smoking/ }).check();
  await next(page, 'Rules');
  await next(page, 'Disclosures');
  await next(page, 'Attachments');
  await next(page, 'Lessor info');
  await next(page, 'Review & send');
  await page.getByRole('button', { name: 'Send for e-signature' }).click();

  await expect(page.getByText(/sent for e-signature/)).toBeVisible();
  await page.getByRole('button', { name: 'Complete mock signing' }).click();
  await expect(page.getByText(/Mock signing complete/)).toBeVisible();

  await page.getByRole('link', { name: 'View lease detail' }).click();
  await expect(page).toHaveURL(/\/leases\/(?!new)[^/?]+$/);
  await expect(page.getByText('Signed lease agreement.pdf').first()).toBeVisible();
});

test('wizard blocks continuing past a step with missing values', async ({ page }) => {
  await signIn(page);
  await page.goto('/leases/new?unit=seed-unit-cedar-8&fresh=1');
  await page.getByLabel('Start date').fill('');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Enter a valid start date.')).toBeVisible();
});

test('renewal wizard prefills the following term', async ({ page }) => {
  await signIn(page);
  await page.goto('/leases/new?renew=seed-lease-maple-11&fresh=1');
  await expect(page.getByLabel('Start date')).toHaveValue('2026-12-01');
  await expect(page.getByText('2027-11-30').first()).toBeVisible();
});