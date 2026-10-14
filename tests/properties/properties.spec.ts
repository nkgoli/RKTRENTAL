import { expect, test, type Page } from '@playwright/test';

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForLoadState('networkidle');
}

async function addProperty(
  page: Page,
  name: string,
  type: 'Multi-unit building' | 'Single-unit home',
) {
  await page.goto('/properties');
  const form = page.locator('#add-property');
  await form.getByLabel('Property name').fill(name);
  await form.getByLabel('Type').selectOption({ label: type });
  await form.getByLabel('Street address').fill('77 Test Lane');
  await form.getByLabel('City').fill('Austin');
  await form.getByLabel('State').fill('TX');
  await form.getByLabel('ZIP').fill('78704');
  await form.getByRole('button', { name: 'Save property' }).click();
  await expect(page).toHaveURL(/\/properties\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test('add a property, add a unit, open the unit', async ({ page }) => {
  const name = `Pine Court ${Date.now()}`;
  await signIn(page);

  // Server-side validation shows field errors without creating anything.
  await page.goto('/properties');
  await page.locator('#add-property').getByRole('button', { name: 'Save property' }).click();
  await expect(page.getByText('Property name is required')).toBeVisible();

  await addProperty(page, name, 'Multi-unit building');

  // Add a unit.
  const addUnit = page.locator('#add-unit');
  await addUnit.getByLabel('Unit number').fill('6A');
  await addUnit.getByLabel('Monthly rent').fill('$1,750');
  await addUnit.getByRole('button', { name: 'Save unit' }).click();
  await expect(page.getByText('Unit 6A added.')).toBeVisible();
  await expect(page.locator('#units').getByRole('link', { name: '6A', exact: true })).toBeVisible();

  // Duplicate unit numbers are rejected.
  await addUnit.getByLabel('Unit number').fill('6A');
  await addUnit.getByRole('button', { name: 'Save unit' }).click();
  await expect(page.getByText('already has a unit with that number')).toBeVisible();

  // Upload a property photo through the storage API.
  await page.getByTestId('upload-property-photo').setInputFiles({
    name: 'front.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.locator('#photos img[alt="front.png"]')).toBeVisible();

  // Open the unit.
  await page.locator('#units').getByRole('link', { name: '6A', exact: true }).click();
  await expect(page).toHaveURL(/\/properties\/[^/]+\/units\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1, name: `${name} · Unit 6A` })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current lease' })).toBeVisible();
  await expect(page.getByText('No active lease on this unit.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Rent comps' }).first()).toHaveAttribute(
    'href',
    '/rent-comps',
  );

  // Edit the unit.
  await page.locator('#edit-unit-form').getByLabel('Bedrooms').fill('3');
  await page.locator('#edit-unit-form').getByRole('button', { name: 'Save unit' }).click();
  await expect(page.getByText('Unit saved.')).toBeVisible();

  // Unit photo upload.
  await page.getByTestId('upload-unit-photo').setInputFiles({
    name: 'kitchen.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.locator('#photos img[alt="kitchen.png"]')).toBeVisible();
});

test('single-unit property links straight to its one unit; archive hides it', async ({ page }) => {
  const name = `Birch House ${Date.now()}`;
  await signIn(page);
  await addProperty(page, name, 'Single-unit home');

  await expect(page.getByRole('link', { name: '+ Add unit' })).toHaveCount(0);
  await page
    .locator('#units')
    .getByRole('link', { name: /Whole property|Open/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByText('single-unit property, so this page is its one unit')).toBeVisible();

  // Edit then archive from the property page.
  await page.getByRole('link', { name: 'Properties', exact: true }).first().click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await page.locator('#edit-property').getByLabel('Year built').fill('2011');
  await page.locator('#edit-property').getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Property saved.')).toBeVisible();

  await page.getByRole('button', { name: 'Archive property' }).click();
  await expect(page).toHaveURL(/\/properties$/);
  await expect(page.getByRole('link', { name: new RegExp(name) })).toHaveCount(0);

  await page.goto('/properties?filter=archived');
  await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
});

test('seeded Maple Court shows its units and the 4B lease', async ({ page }) => {
  await signIn(page);
  await page.goto('/properties');
  await page.getByRole('link', { name: /Maple Court/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Maple Court' })).toBeVisible();
  await page.locator('#units').getByRole('link', { name: '4B', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Maple Court · Unit 4B' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alex Rivera' }).first()).toHaveAttribute(
    'href',
    /\/tenants\//,
  );
  await expect(page.getByRole('link', { name: 'View lease' })).toHaveAttribute(
    'href',
    /\/leases\//,
  );
  await expect(page.getByText('Kitchen sink leak')).toBeVisible();
});
