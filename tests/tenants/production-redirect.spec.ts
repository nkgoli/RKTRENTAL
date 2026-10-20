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
  test(`production add tenant redirect reaches a usable detail page at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    const unique = `prod-${width}-${Date.now()}`;
    await page.goto('/tenants?view=directory&q=alex.rivera&property=seed-property-maple');
    const form = page.locator('#add-tenant');
    await form.getByLabel('Full name').fill(`Production ${unique}`);
    await form.getByLabel('Email').fill(`${unique}@example.com`);
    await form.getByLabel('Phone').fill('(555) 010-2030');
    await form.getByRole('button', { name: 'Save tenant' }).click();

    await expect(page).toHaveURL(/\/tenants\/[^/?]+\?returnTo=/);
    await expect(
      page.getByRole('heading', { name: `Production ${unique}`, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('No lease', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to tenants' })).toHaveAttribute(
      'href',
      /\/tenants\?view=directory&q=alex\.rivera&property=seed-property-maple/,
    );
    await page.screenshot({
      path: `tests/tenants/evidence/production-add-tenant-${width}.png`,
      fullPage: true,
    });

    await page.goto(`/tenants?view=directory&q=${unique}`);
    await expect(
      page.getByRole('link', { name: new RegExp(`Production ${unique}.*${unique}@example`) }),
    ).toHaveCount(1);
  });
}

test('production edit, note, move-in and move-out complete without reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page);
  const unique = `prod-move-${Date.now()}`;
  await page.goto('/tenants?view=directory');
  const form = page.locator('#add-tenant');
  await form.getByLabel('Full name').fill(`Production ${unique}`);
  await form.getByLabel('Email').fill(`${unique}@example.com`);
  await form.locator('select[name=propertyId]').selectOption({ label: 'Maple Court' });
  await form.locator('select[name=unitId]').selectOption({ label: '3A' });
  await form.getByLabel('Move-in date').fill('2026-11-01');
  await form.getByRole('button', { name: 'Save tenant' }).click();
  await expect(page).toHaveURL(/\/tenants\/[^/?]+\?returnTo=/);
  await expect(page.getByRole('heading', { name: `Production ${unique}`, level: 1 })).toBeVisible();

  await page.getByRole('link', { name: 'Edit profile', exact: true }).click();
  const edit = page.locator('#edit-profile');
  await edit.getByLabel('Phone', { exact: true }).fill('(555) 010-9999');
  await edit.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page).toHaveURL(/\/tenants\/[^/?]+\?returnTo=/);
  await expect(page.getByText('(555) 010-9999')).toBeVisible();

  await page.getByLabel('Note', { exact: true }).fill(`Production note ${unique}`);
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText('Note added.')).toBeVisible();
  await expect(page.getByText(`Production note ${unique}`)).toBeVisible();

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
