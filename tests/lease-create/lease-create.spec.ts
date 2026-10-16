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
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}

test('manager builds a lease in the wizard, resumes it, and sends it for signing', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/leases/new', { waitUntil: 'domcontentloaded' }).catch(async (error: unknown) => {
    if (!(error instanceof Error) || !error.message.includes('ERR_ABORTED')) throw error;
    await page.goto('/leases/new', { waitUntil: 'domcontentloaded' });
  });
  const option = page.locator('select[name="unit"] option', { hasText: 'Maple Court · Unit 3A' });
  const unitId = (await option.getAttribute('value'))!;
  await page.getByLabel('Property / unit').selectOption(unitId);
  await page.getByRole('button', { name: 'Start lease' }).click();
  await page.goto(`/leases/new?unit=${unitId}&fresh=1`);

  await expect(page.getByRole('heading', { name: 'Lease term', exact: true })).toBeVisible();
  // Unique term per run so reruns against a persistent database never overlap.
  const year = 2100 + Math.floor(Date.now() / 1000) % 3000;
  await page.getByLabel('Start date').fill(`${year}-02-15`);
  await expect(page.getByText(`${year + 1}-02-14`)).toBeVisible();
  await expect(page.getByText(`${year}-02-${new Date(Date.UTC(year, 2, 0)).getUTCDate()}`)).toBeVisible();
  await next(page, 'Rent, deposit & fees');

  await page.getByRole('textbox', { name: 'Monthly rent', exact: true }).fill('1600');
  await page.getByLabel('Security deposit').fill('1600');
  await page.getByLabel('Rent due day').selectOption('5');
  await page.getByRole('checkbox', { name: /Move-in fee/ }).check();
  await page.getByLabel('Move-in fee amount').fill('150');
  await page.getByRole('checkbox', { name: /Pet deposit/ }).check();
  await page.getByLabel('Pet deposit amount').fill('250');
  await expect(page.getByText('Scheduled charges preview')).toBeVisible();
  await expect(page.getByText(/Prorated rent.*February/)).toBeVisible();
  await expect(page.getByText(/repeats on the 5th/)).toBeVisible();
  await page.getByTestId('charges-preview').screenshot({ path: 'tests/lease-create/evidence/charges-preview-day-5.png' });
  await page.getByRole('region', { name: 'Create lease' }).evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: 'tests/lease-create/evidence/rent-day-5.png' });
  await next(page, 'Tenants');

  await page.getByRole('checkbox', { name: /Alex Rivera/ }).check();
  await next(page, 'Options');
  await next(page, 'Clauses');

  // Save and exit, then come back: the wizard resumes on Clauses with finished steps checked.
  await page.getByRole('button', { name: 'Save and exit' }).click();
  await expect(page).toHaveURL(/\/leases\?tab=drafts/);
  await page.goto(`/leases/new?unit=${unitId}`);
  await expect(page.getByRole('heading', { name: 'Clauses', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '+ Add clause' }).click();
  await page.getByRole('textbox', { name: 'New clause title' }).fill('Move-in walkthrough');
  await page.getByRole('textbox', { name: 'Move-in walkthrough wording' }).fill('The tenant and manager will document the home’s condition at move-in.');
  await next(page, 'Rules');
  await next(page, 'Disclosures');
  await next(page, 'Attachments');
  await page.getByLabel('Choose files').setInputFiles({
    name: `lease-disclosure-${year}.pdf`,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'),
  });
  await expect(page.getByLabel(`Type for lease-disclosure-${year}.pdf`)).toBeVisible();
  const typeSaved = page.waitForResponse((response) => response.url().includes('/api/files/') && response.request().method() === 'PATCH');
  await page.getByLabel(`Type for lease-disclosure-${year}.pdf`).selectOption('DISCLOSURE');
  expect((await typeSaved).ok()).toBe(true);
  await expect(page.getByLabel(`Type for lease-disclosure-${year}.pdf`)).toHaveValue('DISCLOSURE');
  await page.getByRole('region', { name: 'Create lease' }).evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: 'tests/lease-create/evidence/attachment-type.png' });
  await next(page, 'Lessor info');
  await next(page, 'Review & send');
  await expect(page.getByText(/due on the 5th/)).toBeVisible();
  await page.getByRole('button', { name: 'Send for e-signature' }).click();

  await expect(page.getByText(/sent for e-signature/)).toBeVisible();
  await page.getByRole('region', { name: 'Create lease' }).evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: 'tests/lease-create/evidence/lease-sent.png' });
  const leaseId = (await page.getByRole('link', { name: 'View lease detail' }).getAttribute('href'))?.split('/').at(-1);
  expect(leaseId).toBeTruthy();
  const filesResponse = await page.request.get(`/api/files?targetType=lease&targetId=${leaseId}`);
  expect(filesResponse.ok()).toBe(true);
  const files = (await filesResponse.json() as { files: { name: string; kind: string }[] }).files;
  expect(files.find((file) => file.name === `lease-disclosure-${year}.pdf`)?.kind).toBe('DISCLOSURE');
  expect(files.every((file) => file.kind !== 'PHOTO')).toBe(true);

  await page.getByRole('button', { name: 'Complete mock signing' }).click();
  await expect(page.getByText(/Mock signing complete/)).toBeVisible();

  await page.goto(`/properties/seed-property-maple/payments?unit=${unitId}`);
  const leaseGroup = page.locator('tbody', { hasText: `${year}` }).first();
  await expect(leaseGroup).toBeVisible();
  await expect(leaseGroup.locator('tr', { hasText: 'Prorated February rent' })).toHaveCount(1);
  await expect(leaseGroup.locator('tr', { hasText: 'Security deposit' })).toHaveCount(1);
  await expect(leaseGroup.locator('tr', { hasText: 'Move-in fee' })).toHaveCount(1);
  await expect(leaseGroup.locator('tr', { hasText: 'Pet deposit' })).toHaveCount(1);
  const marchRent = leaseGroup.locator('tr', { hasText: 'March rent' });
  await expect(marchRent).toHaveCount(1);
  await expect(marchRent.locator('td').nth(1).getByText('5')).toBeVisible();
  await leaseGroup.screenshot({ path: 'tests/lease-create/evidence/payments-day-5.png' });
  await page.goto(`/leases/${leaseId}`);
  await expect(page).toHaveURL(/\/leases\/(?!new)[^/?]+$/);
  await expect(page.getByText('Signed lease agreement.pdf').first()).toBeVisible();
});

test('Clauses swap the no-pets clause and the pet agreement when pets change at a fixed term', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/leases/new', { waitUntil: 'domcontentloaded' }).catch(async (error: unknown) => {
    if (!(error instanceof Error) || !error.message.includes('ERR_ABORTED')) throw error;
    await page.goto('/leases/new', { waitUntil: 'domcontentloaded' });
  });
  const unitId = (await page.locator('select[name="unit"] option', { hasText: 'Maple Court · Unit 3A' }).getAttribute('value'))!;
  await page.goto(`/leases/new?unit=${unitId}&fresh=1`);
  await expect(page.getByRole('heading', { name: 'Lease term', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: /Full year/ }).check();
  await next(page, 'Rent, deposit & fees');
  await page.getByRole('textbox', { name: 'Monthly rent', exact: true }).fill('1600');
  await page.getByLabel('Security deposit').fill('1600');
  await next(page, 'Tenants');
  await page.getByRole('checkbox', { name: /Alex Rivera/ }).check();
  await next(page, 'Options');
  await expect(page.getByRole('checkbox', { name: /Pets allowed/ })).not.toBeChecked();
  await next(page, 'Clauses');

  const titles = page.locator('article input[aria-label$=" title"]:visible');
  const noPets = page.locator('article', { has: page.getByRole('textbox', { name: 'No pets title' }) });
  const petAgreement = page.locator('article', { has: page.getByRole('textbox', { name: 'Approved pets title' }) });

  // Fixed term, no pets: the no-pets clause is in, the pet agreement is not.
  await expect(titles.first()).toBeVisible();
  const withoutPets = await titles.evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
  expect(withoutPets).toContain('No pets');
  expect(withoutPets).toContain('Ending a fixed term early');
  expect(withoutPets).not.toContain('Approved pets');
  expect(withoutPets).not.toContain('Month-to-month notice');
  await expect(noPets.getByText('Added because pets are not allowed')).toBeVisible();
  await page.screenshot({ path: 'tests/lease-create/evidence/fixed-no-pets-clauses.png' });

  // Back, allow pets, return: the two clauses swap and the pet agreement says why.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Options', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: /Pets allowed/ }).check();
  await next(page, 'Clauses');
  await expect(titles.first()).toBeVisible();
  const withPets = await titles.evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
  expect(withPets).toContain('Approved pets');
  expect(withPets).toContain('Ending a fixed term early');
  expect(withPets).not.toContain('No pets');
  await expect(petAgreement.getByText('Added because pets are allowed or a pet fee is set')).toBeVisible();
  await page.screenshot({ path: 'tests/lease-create/evidence/fixed-pets-clauses.png' });

  // Turning pets off again restores the no-pets clause.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('checkbox', { name: /Pets allowed/ }).uncheck();
  await next(page, 'Clauses');
  await expect(page.getByRole('textbox', { name: 'No pets title' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Approved pets title' })).toBeHidden();
});

test('wizard blocks continuing past a step with missing values', async ({ page }) => {
  await signIn(page);
  await page.goto('/leases/new?unit=seed-unit-cedar-8&fresh=1');
  await expect(page.getByRole('region', { name: 'Create lease' })).not.toHaveAttribute('inert', '');
  await page.getByLabel('Start date').fill('');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Enter a valid start date.')).toBeVisible();
});

test('renewal wizard prefills the following term', async ({ page }) => {
  await signIn(page);
  await page.goto('/leases/new?renew=seed-lease-maple-11&fresh=1');
  await expect(page.getByLabel('Start date')).toHaveValue('2026-12-01');
  await expect(page.getByText('2027-11-30').first()).toBeVisible();
});
