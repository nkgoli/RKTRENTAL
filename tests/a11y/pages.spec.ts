import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const managerPages = [
  '/dashboard', '/properties', '/tenants', '/leases', '/leases/new', '/applications',
  '/payments', '/returns', '/rent-comps', '/maintenance', '/documents', '/integrations',
];
const tenantPages = ['/home', '/pay', '/lease', '/repairs'];

async function signIn(page: Page, role: 'manager' | 'tenant') {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(role === 'manager' ? 'jordan.mills@rocketrental.example' : 'alex.rivera@email.com');
  await page.getByLabel('Password').fill(role === 'manager'
    ? process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026'
    : process.env.ROCKETRENTAL_DEMO_TENANT_PASSWORD ?? 'AlexDemo#2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

async function audit(page: Page, path: string, testInfo: { attach: (name: string, options: { body: Buffer; contentType: string }) => Promise<void> }) {
  await page.goto(path);
  // /rent-comps redirects client-side to the first unit's Listing tab.
  if (path === '/rent-comps') await page.waitForURL(/\/properties\/[^/]+\/units\/[^/?]+\?tab=listing/);
  // The dev server can finish a navigation after the first paint; let it settle before axe injects.
  await page.waitForLoadState('networkidle');
  await expect(page.locator('main h1').first()).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const severe = results.violations.filter((violation: { impact?: string | null }) => violation.impact === 'serious' || violation.impact === 'critical');
  await testInfo.attach('axe-results.json', {
    body: Buffer.from(JSON.stringify({ path, violations: results.violations }, null, 2)),
    contentType: 'application/json',
  });
  console.log(`[axe] ${path}: ${severe.length} serious/critical, ${results.violations.length} total`);
  expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
}

test.describe('manager pages at 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.beforeEach(async ({ page }) => signIn(page, 'manager'));
  for (const path of managerPages) {
    test(path, async ({ page }, testInfo) => audit(page, path, testInfo));
  }
});

test.describe('tenant pages at 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({ page }) => signIn(page, 'tenant'));
  for (const path of tenantPages) {
    test(path, async ({ page }, testInfo) => audit(page, path, testInfo));
  }
});
