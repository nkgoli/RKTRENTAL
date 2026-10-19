import { expect, test, type Page } from '@playwright/test';

test.setTimeout(60_000);

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
  test(`light tenant directory and status at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await signIn(page);

    await page.goto('/tenants?view=directory');
    await expect(page.getByRole('heading', { name: 'Tenants', level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Tenant views' })).toBeVisible();
    await page.screenshot({
      path: `tests/tenants/evidence/tenants-directory-${width}.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.getByRole('link', { name: 'Status', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Tenant status' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Tenant setup checklist' })).toBeVisible();
    await page.screenshot({
      path: `tests/tenants/evidence/tenants-status-${width}.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`light tenant detail and move-out keyboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await signIn(page);

    await page.goto('/tenants/seed-tenant-maple-11');
    await expect(page.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lease summary' })).toBeVisible();
    await page.screenshot({
      path: `tests/tenants/evidence/tenant-detail-${width}.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const moveOut = page.getByRole('button', { name: 'Move out', exact: true });
    await moveOut.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.screenshot({
      path: `tests/tenants/evidence/tenant-move-out-${width}.png`,
    });
    await dialog.getByRole('button', { name: 'Cancel' }).focus();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(moveOut).toBeFocused();
  });
}
