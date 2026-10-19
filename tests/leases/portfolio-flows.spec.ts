import { expect, test, type Page } from '@playwright/test';
const base = 'http://127.0.0.1:3229';
const property = 'seed-property-maple';
const unit = 'seed-unit-maple-11';
async function login(page: Page, origin = base) {
  await page.goto(`${origin}/sign-in`);
  await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
  await page.getByLabel('Password', { exact: true }).fill('JordanDemo#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/dashboard');
}
async function capture(page: Page, name: string) {
  await page.locator('tbody tr, [data-lease]').first().waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await noOverflow(page);
  await page.screenshot({ path: `.playwright-mcp/${name}.png`, fullPage: true });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
for (const width of [1440, 390]) {
  test(`production portfolio flows ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await login(page);
    await page.goto(`${base}/leases`);
    await expect(page.getByRole('heading', { name: 'Lease portfolio', exact: true })).toBeVisible();
    await noOverflow(page);
    await capture(page, `leases-${width}-after`);
    const tabs = page.getByRole('navigation', { name: 'Sections', exact: true });
    await tabs.getByRole('link', { name: /^Expiring soon/ }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await tabs.getByRole('link', { name: /^Drafts/ }).click();
    await expect(page.getByRole('link', { name: 'Continue setup', exact: true })).toHaveAttribute(
      'href',
      /draft=lease-review-draft/,
    );
    await page.getByRole('link', { name: 'Continue setup', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Create lease', exact: true })).toBeVisible();
    await page.goto(`${base}/leases?tab=ended`);
    await expect(page.locator('tbody tr')).toHaveCount(20);
    await page.goto(`${base}/leases`);
    await page.getByLabel('Search leases', { exact: true }).fill('Alex Rivera');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody')).toContainText('Alex Rivera');
    await page.getByRole('link', { name: 'Clear search', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(20);
    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('link', { name: /Next/ })
      .click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator('tbody tr')).toHaveCount(20);
    await capture(page, `leases-page2-${width}`);
    await page.goto(`${base}/leases?q=NoSuchLeaseReview`);
    await expect(page.getByRole('heading', { name: 'No leases match this view' })).toBeVisible();
    await noOverflow(page);
    await capture(page, `leases-empty-${width}`);
    await page.goto(`${base}/leases?propertyId=${property}&unitId=${unit}`);
    const view = page.getByRole('link', { name: 'View', exact: true });
    await expect(view).toHaveAttribute(
      'href',
      `/leases/seed-lease-maple-11?propertyId=${property}&unitId=${unit}`,
    );
    await view.focus();
    await expect(view).toBeFocused();
    expect(await view.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Renew', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(
      new RegExp(`/leases/seed-lease-maple-11\\?propertyId=${property}&unitId=${unit}`),
    );
    await page.goto(`${base}/leases?propertyId=${property}&unitId=${unit}`);
    await expect(page.getByRole('link', { name: 'Renew', exact: true })).toHaveAttribute(
      'href',
      new RegExp(`propertyId=${property}&unitId=${unit}&property=${property}&unit=${unit}&renew=`),
    );
    await page.getByRole('link', { name: 'Renew', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Create lease', exact: true })).toBeVisible();
    await page.goto(`${base}/properties/${property}/leases`);
    await expect(page.locator('[aria-label="Current leases"]')).toBeVisible();
    await expect(page.locator('[aria-label="Drafts leases"]')).toBeVisible();
    await expect(page.locator('[aria-label="Past leases"]')).toBeVisible();
    await noOverflow(page);
    await capture(page, `property-leases-${width}-after`);
    await page
      .locator('[aria-label="Current leases"]')
      .getByRole('link', { name: 'View', exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`propertyId=${property}`));
    await page.goto(`${base}/properties/${property}/leases?unit=${unit}`);
    await noOverflow(page);
    await capture(page, `unit-leases-${width}-after`);
    await expect(page.getByRole('link', { name: 'Continue setup', exact: true })).toHaveAttribute(
      'href',
      new RegExp(`propertyId=${property}&unitId=${unit}.*draft=lease-review-draft`),
    );
    await page.getByRole('link', { name: 'Continue setup', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Create lease', exact: true })).toBeVisible();
    await page.goto(`${base}/properties/${property}/leases?unit=${unit}&page=2`);
    await expect(page.locator('[aria-label="Past leases"]').locator('li')).toHaveCount(2);
    await page.goto(`${base}/properties/${property}/leases?unit=seed-unit-maple-7`);
    await expect(page.getByText('No leases yet', { exact: true })).toBeVisible();
    await noOverflow(page);
    await page.getByRole('link', { name: 'Set up lease', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Create lease', exact: true })).toBeVisible();
    await page.goto(`${base}/leases?unitId=seed-unit-maple-7`);
    await expect(page.getByRole('heading', { name: 'No active leases yet' })).toBeVisible();
    await noOverflow(page);
  });
  test(`exact foundation baseline captures ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await login(page, 'http://127.0.0.1:3230');
    for (const [path, name] of [
      ['/leases', 'leases'],
      [`/properties/${property}/leases`, 'property-leases'],
      [`/properties/${property}/leases?unit=${unit}`, 'unit-leases'],
    ]) {
      await page.goto(`http://127.0.0.1:3230${path}`);
      await capture(page, `${name}-${width}-before`);
    }
  });
}
