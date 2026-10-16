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
  await page.getByRole('link', { name: '+ Add property' }).click();
  const form = page.locator('#add-property');
  await expect(form).toBeVisible({ timeout: 15_000 });
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
  await page.getByRole('link', { name: '+ Add property' }).click();
  await expect(page.locator('#add-property')).toBeVisible({ timeout: 15_000 });
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
  await page.locator('#photos input[type="file"]').first().setInputFiles({
    name: 'front.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.getByRole('img', { name: 'front.png' })).toBeVisible();

  // Open the unit.
  await page.locator('#units').getByRole('link', { name: '6A', exact: true }).click();
  await expect(page).toHaveURL(/\/properties\/[^/?]+(\/units\/[^/?]+|\?unit=[^/]+)$/);
  await expect(page.getByRole('heading', { level: 1, name: `${name} · Unit 6A` })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lease timeline' })).toBeVisible();
  await expect(page.getByText('No active lease on this unit.')).toBeVisible();
  // Rent comps live under the workspace Listing tab, scoped to this unit.
  const unitUrl = new URL(page.url());
  const propertyId = unitUrl.pathname.split('/')[2];
  const unitId = unitUrl.searchParams.get('unit') ?? unitUrl.pathname.split('/').pop();
  await expect(
    page.getByRole('navigation', { name: 'Workspace sections' }).getByRole('link', { name: 'Listing' }),
  ).toHaveAttribute('href', `/properties/${propertyId}/listing?unit=${unitId}`);

  // Edit the unit.
  const facts = page.locator('#unit-facts');
  await facts.getByRole('button', { name: 'Edit' }).click();
  await facts.getByLabel('Bedrooms').fill('3');
  await facts.getByRole('button', { name: 'Save' }).click();
  await expect(facts.getByRole('button', { name: 'Edit' })).toBeVisible();
  await expect(facts.getByText('3', { exact: true })).toBeVisible();

  // Unit photo upload.
  await page.locator('#photos input[type="file"]').first().setInputFiles({
    name: 'kitchen.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.getByRole('img', { name: 'kitchen.png' })).toBeVisible();
});

test('single-unit property links straight to its one unit; archive hides it', async ({ page }) => {
  const name = `Birch House ${Date.now()}`;
  await signIn(page);
  await addProperty(page, name, 'Single-unit home');

  await expect(page.getByRole('link', { name: '+ Add unit' })).toHaveCount(0);
  // A single-family property has no unit list: its overview is the one unit.
  await expect(page.locator('#units')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Switch unit' })).toHaveCount(0);
  await expect(page.getByTestId('lease-timeline')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  // The implicit unit is the whole property: its page has no unit facts card, so there is
  // no Delete control at all. The property is removed with Archive property instead.
  await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archive property' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Listing' }).first()).toBeVisible();

  // Edit then archive from the property page.
  await page.getByRole('link', { name: 'Properties', exact: true }).first().click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  const details = page.locator('#property-facts');
  await details.getByRole('button', { name: 'Edit' }).click();
  await details.getByLabel('Year built').fill('2011');
  await details.getByRole('button', { name: 'Save' }).click();
  await expect(details.getByText('2011')).toBeVisible();

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
  await expect(page.locator('a[href^="/tenants/"]', { hasText: 'Alex Rivera' }).first()).toHaveAttribute(
    'href',
    /\/tenants\//,
  );
  await expect(page.getByRole('link', { name: 'View lease' })).toHaveAttribute(
    'href',
    /\/leases\//,
  );
  await expect(page.getByRole('link', { name: '1 open maintenance request' })).toBeVisible();
  // A unit with linked records (lease, requests) cannot be deleted.
  await expect(page.locator('#unit-facts').getByRole('button', { name: 'Delete' })).toBeDisabled();
  await expect(page.getByText('A unit with linked records cannot be deleted.')).toBeVisible();
});

test('unit switcher keeps the tab; timeline, applications, leases and maintenance states', async ({ page }) => {
  const tab = (p: Page, label: string) => p.getByRole('navigation', { name: 'Workspace sections' }).getByRole('link', { name: label, exact: true });
  await signIn(page);
  await page.goto('/properties');
  await page.getByRole('link', { name: /Maple Court/ }).click();
  const switcher = page.getByRole('combobox', { name: 'Switch unit' });
  await expect(switcher).toBeVisible();

  // Property overview: one timeline row per unit, today marker, payments strip.
  const timeline = page.getByTestId('lease-timeline');
  await expect(timeline).toBeVisible();
  expect(await timeline.locator('[data-unit-row]').count()).toBeGreaterThan(1);
  await expect(timeline.getByTestId('timeline-today')).toHaveCount(await timeline.locator('[data-unit-row]').count());
  await expect(page.getByLabel('Payments this month')).toBeVisible();

  // Switch to a unit on the Leases tab: same tab, ?unit= set.
  await tab(page, 'Leases').click();
  await expect(page).toHaveURL(/\/leases$/);
  await switcher.selectOption({ label: 'Unit 4B' });
  await expect(page).toHaveURL(/\/leases\?unit=/);
  await expect(page.getByRole('heading', { level: 1, name: 'Maple Court · Unit 4B' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Set up lease' })).toHaveAttribute('href', /\/leases\/new\?unit=/);
  await expect(page.getByRole('heading', { name: /^Current/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Drafts/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Past/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alex Rivera' }).first()).toBeVisible();

  // Unit overview: a single timeline row for the unit.
  await tab(page, 'Overview').click();
  await expect(page).toHaveURL(/\?unit=/);
  await expect(page.getByTestId('lease-timeline').locator('[data-unit-row]')).toHaveCount(1);

  // Applications: settings and groups; no public apply page exists, so no share link is offered.
  await tab(page, 'Applications').click();
  await expect(page).toHaveURL(/\/applications\?unit=/);
  await expect(page.getByLabel('Application link')).toHaveCount(0);
  await expect(page.getByRole('form', { name: 'Application settings' })).toBeVisible();
  await switcher.selectOption({ label: 'Maple Court · all units' });
  await expect(page).toHaveURL(/\/applications$/);

  // Maintenance: a new property shows the friendly empty state and the create flow works.
  const name = `Elm Row ${Date.now()}`;
  await addProperty(page, name, 'Single-unit home');
  await tab(page, 'Maintenance').click();
  await expect(page.getByRole('heading', { name: 'No repair requests yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Create your first request' }).click();
  const dialog = page.getByRole('dialog', { name: 'New repair request' });
  await dialog.getByLabel('Request title').fill('Kitchen sink leak');
  await dialog.getByRole('button', { name: 'Create request' }).click();
  await expect(page.getByText('Kitchen sink leak')).toBeVisible();
});
