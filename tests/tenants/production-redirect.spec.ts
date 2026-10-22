import { expect, test, type Page } from '@playwright/test';

test.setTimeout(90_000);

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

for (const width of [1280, 390]) {
  test(`legacy add tenant link leads to Applications at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await page.goto('/tenants?view=directory&q=alex.rivera&property=seed-property-maple&add=1');
    await expect(page).toHaveURL(/\/applications\?propertyId=seed-property-maple$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Applications', level: 1 })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search applicants or units' })).toBeVisible();
    await page.screenshot({
      path: `tests/tenants/evidence/legacy-add-applications-${width}.png`,
      fullPage: true,
    });
  });
}

test('production edit and note complete without reload on an existing tenant', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page);
  const unique = `prod-edit-${Date.now()}`;
  await page.goto('/tenants?view=directory&q=alex.rivera');
  await page.getByRole('link', { name: /Alex Rivera alex.rivera/ }).click();
  await expect(page.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeVisible();

  await page.getByRole('link', { name: 'Edit profile', exact: true }).click();
  const edit = page.locator('#edit-profile');
  const relationship = edit.getByLabel('Relationship', { exact: true });
  const original = await relationship.inputValue();
  await relationship.fill('Sibling');
  await edit.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page).toHaveURL(/\/tenants\/[^/?]+\?returnTo=/);
  await expect(page.locator('#edit-profile')).toHaveCount(0);
  await expect(page.getByText('Sibling')).toBeVisible();
  // Restore the seeded value so the run leaves tenant data as it found it.
  await page.getByRole('link', { name: 'Edit profile', exact: true }).click();
  await page.locator('#edit-profile').getByLabel('Relationship', { exact: true }).fill(original);
  await page
    .locator('#edit-profile')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click();
  await expect(page).toHaveURL(/\/tenants\/[^/?]+\?returnTo=/);
  await expect(page.locator('#edit-profile')).toHaveCount(0);

  await page.getByLabel('Note', { exact: true }).fill(`Production note ${unique}`);
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(
    page.locator('#tenant-history').getByText(`Production note ${unique}`, { exact: true }),
  ).toBeVisible();
});
