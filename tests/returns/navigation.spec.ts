import { expect, test } from '@playwright/test';

// Read-only regression against a real production server; no Link/router mocks.
// Run with PLAYWRIGHT_BASE_URL set to the isolated review runtime.
for (const width of [1280, 390]) {
  test(`Returns navigation and back preserve scope at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/sign-in');
    await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
    await page.getByLabel('Password', { exact: true }).fill(
      process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026',
    );
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    for (const unit of ['', 'seed-unit-maple-2']) {
      for (const source of ['Payments', 'Maintenance']) {
        for (const input of ['mouse', 'keyboard']) {
          await test.step(`${source} → Returns → Back, ${unit ? 'Unit 1B' : 'property'}, ${input}`, async () => {
            const query = unit ? `?unit=${unit}` : '';
            const from = `/properties/seed-property-maple/${source.toLowerCase()}${query}`;
            const to = `/properties/seed-property-maple/returns${query}`;
            await page.goto(from);
            const sourceHeadings = await page.locator('main h2, main h3').allTextContents();
            const nav = page.getByRole('navigation', { name: 'Workspace sections' });
            await expect(nav.getByRole('link', { name: source, exact: true })).toHaveAttribute('aria-current', 'page');
            const returns = nav.getByRole('link', { name: 'Returns', exact: true });
            if (input === 'keyboard') {
              await nav.getByRole('link', { name: source, exact: true }).focus();
              await page.keyboard.press(source === 'Payments' ? 'Tab' : 'Shift+Tab');
              await expect(returns).toBeFocused();
              await page.keyboard.press('Enter');
            } else {
              await returns.click();
            }
            // This timed out on the integrated baseline with the correct href and HTTP 200.
            await expect(page).toHaveURL(new URL(to, page.url()).href, { timeout: 5000 });
            await expect(page.getByRole('heading', { name: 'Income statement', exact: true })).toBeVisible();
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(unit ? 'Maple Court · Unit 1B' : 'Maple Court');
            await expect(returns).toHaveAttribute('aria-current', 'page');
            await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
            await expect(page.getByLabel('Switch unit')).toHaveValue(unit);
            await expect(page.getByText(unit ? /Unit income follows settled payments/ : /Income follows settled payments\. Expenses/)).toBeVisible();
            await page.goBack();
            await expect(page).toHaveURL(new URL(from, page.url()).href);
            await expect(nav.getByRole('link', { name: source, exact: true })).toHaveAttribute('aria-current', 'page');
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(unit ? 'Maple Court · Unit 1B' : 'Maple Court');
            await expect(page.locator('main h2, main h3')).toHaveText(sourceHeadings);
          });
        }
      }
    }
  });
}
