import { expect, test } from '@playwright/test';

test.setTimeout(180_000);

const shots = 'tests/tenants/evidence/applicant-led';

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

for (const width of [1280, 390]) {
  test(`tenants lead to Applications and keep editing at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });

    // Directory: no manual creation; header leads to Applications with the property kept.
    await page.goto('/tenants?view=directory&property=seed-property-maple');
    const review = page.getByRole('link', { name: 'Review applications', exact: true });
    await expect(review).toHaveAttribute('href', '/applications?propertyId=seed-property-maple');
    await expect(page.getByRole('link', { name: /Add (a )?tenant/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `${shots}/directory-${width}.png` });

    // Keyboard: Tab reaches the header action and Enter follows it.
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await review.evaluate((el) => el === document.activeElement);
    }
    expect(reached).toBe(true);
    await page.screenshot({ path: `${shots}/review-focus-${width}.png` });
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/applications\?propertyId=seed-property-maple$/);

    // Legacy add links never reopen a form.
    await page.goto('/tenants?view=directory&property=seed-property-maple&add=1');
    await expect(page).toHaveURL(/\/applications\?propertyId=seed-property-maple$/);
    await expect(page.locator('#add-tenant, [name=unitId]')).toHaveCount(0);
    await page.screenshot({ path: `${shots}/legacy-add-${width}.png` });
    await page.goto('/tenants?add=1');
    await expect(page).toHaveURL(/\/applications$/);

    // Filtered empty state still offers Clear filters only.
    await page.goto('/tenants?view=directory&q=zz-no-match-ux');
    await expect(page.getByRole('heading', { name: 'No tenants match this view' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Add (a )?tenant/ })).toHaveCount(0);
    await page.screenshot({ path: `${shots}/no-match-${width}.png` });

    // Existing tenant profile: notes, lease link and edit form remain; cancel saves nothing.
    await page.goto('/tenants?view=directory&q=alex.rivera');
    await page
      .getByRole('link', { name: /Alex Rivera/ })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: 'Alex Rivera', exact: true })).toBeVisible();
    await expect(page.getByLabel('Note', { exact: true })).toBeVisible();
    await expect(page.locator('#lease-summary a').first()).toBeVisible();
    await page.getByRole('link', { name: 'Edit profile', exact: true }).click();
    const edit = page.locator('#edit-profile');
    await expect(edit.getByLabel('Full name', { exact: true })).toHaveValue('Alex Rivera');
    await edit.getByLabel('Full name', { exact: true }).focus();
    await page.screenshot({ path: `${shots}/edit-profile-${width}.png` });
    await edit.getByRole('link', { name: 'Cancel', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#edit-profile')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Alex Rivera', exact: true })).toBeVisible();
  });
}
