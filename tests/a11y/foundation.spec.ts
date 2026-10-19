import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
  await page
    .getByLabel('Password')
    .fill(process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

for (const width of [390, 768]) {
  test(`foundation navigation and chart at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const menu = page.getByRole('button', { name: 'Open menu' });
    await menu.click();
    const dialog = page.getByRole('dialog', { name: 'Main menu' });
    await expect(dialog.getByRole('button', { name: 'Close menu' })).toBeFocused();
    expect(await page.locator('main').evaluate((node) => node.hasAttribute('inert'))).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('link', { name: 'RocketRental', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('link', { name: 'Sign out' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('link', { name: 'RocketRental', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
    expect(await page.locator('main').evaluate((node) => node.hasAttribute('inert'))).toBe(false);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');

    await page.getByRole('link', { name: '2Y', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\?range=2Y$/);
    await expect(page.getByRole('link', { name: '2Y', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await page.getByText('View monthly amounts', { exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Monthly rent collection amounts' }).locator('tbody tr'),
    ).toHaveCount(24);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);

    await menu.click();
    await dialog.getByRole('link', { name: 'Properties', exact: true }).click();
    await expect(page).toHaveURL(/\/properties$/);
    await expect(page.getByRole('heading', { name: 'Properties', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Main menu' })).toHaveCount(0);
  });
}

test('shared UI switches and route recovery examples work', async ({ page }) => {
  await page.goto('/ui');
  const autopay = page.getByRole('switch', { name: 'Autopay' });
  await expect(autopay).toHaveAttribute('aria-checked', 'true');
  await autopay.click();
  await expect(autopay).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('status', { name: 'Loading page' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No results yet' })).toBeVisible();
});
