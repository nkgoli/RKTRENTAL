import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';
const propertyId = 'seed-property-maple';
const unitId = 'seed-unit-maple-7';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
}

// A first request can be aborted while the dev server compiles the route; retry it once.
async function open(page: Page, url: string) {
  try {
    await page.goto(url);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('net::ERR_ABORTED')) throw error;
    await page.goto(url);
  }
  await page.waitForLoadState('networkidle');
}
let originalRent: unknown;

test.beforeAll(async () => {
  originalRent = (await prisma.unit.findUniqueOrThrow({ where: { id: unitId } })).marketRent;
});

test.afterAll(async () => {
  await prisma.unit.update({
    where: { id: unitId },
    data: {
      marketRent: originalRent as never,
      marketRentSetAt: null,
      marketRentSetById: null,
      marketRentSetByName: null,
    },
  });
  await prisma.$disconnect();
});

test('manager reviews comps, filters them, and applies a market rent', async ({
  page,
}, testInfo) => {
  await signIn(page);
  await open(page, `/rent-comps?unit=${unitId}`);

  await expect(page.getByRole('heading', { name: 'Maple Court · Unit 3A' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comparable rentals map' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Market summary' })).toBeVisible();
  const rows = page.getByRole('table', { name: 'Comparable rentals' }).locator('tbody tr');
  const pins = page.getByTestId('comp-pin');
  const initialCount = await rows.count();
  expect(initialCount).toBeGreaterThan(2);
  await expect(pins).toHaveCount(initialCount);
  await expect(page.getByTestId('suggested-rent')).toHaveText(/^\$[\d,]+$/);
  await page.screenshot({ path: 'test-results/rent-comps-unit.png', fullPage: true });

  // Filtering by radius refetches fewer, closer comps.
  await page.getByLabel('Radius').selectOption('1');
  await expect(page).toHaveURL(/radius=1/);
  await expect(rows).not.toHaveCount(initialCount);
  const nearCount = await rows.count();
  expect(nearCount).toBeGreaterThan(0);
  await expect(pins).toHaveCount(nearCount);
  for (const text of await rows.locator('td:nth-child(3)').allTextContents())
    expect(parseFloat(text)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/rent-comps-filtered.png', fullPage: true });

  // Status chips filter to leased comps only.
  await page
    .getByRole('form', { name: 'Comp filters' })
    .getByText('Leased', { exact: true })
    .click();
  await expect(page).toHaveURL(/status=leased/);
  for (const badge of await rows.locator('td:nth-child(8)').allTextContents())
    expect(badge).toBe('Leased');

  // Excluding a comp updates the summary.
  await page.waitForLoadState('networkidle');
  const included = page.getByRole('checkbox', { checked: true });
  const includedBefore = await included.count();
  await included.first().uncheck();
  await expect(included).toHaveCount(includedBefore - 1);
  await expect(page.getByText(`${includedBefore - 1} included`)).toBeVisible();

  // Applying sets the unit's market rent and records who and when.
  await page.getByLabel('Market rent to apply ($ / month)').fill('1725');
  await page.getByRole('button', { name: /^Apply to / }).click();
  await expect(page.getByText(/Market rent updated\. Now \$1,725/)).toBeVisible();
  await expect(page.getByTestId('current-market-rent')).toHaveText('$1,725');
  await expect(page.getByTestId('applied-note')).toContainText('Market rent set by Jordan Mills');
  const unit = await prisma.unit.findUniqueOrThrow({ where: { id: unitId } });
  expect(Number(unit.marketRent)).toBe(1725);
  expect(unit.marketRentSetByName).toBe('Jordan Mills');
  expect(unit.marketRentSetById).toBeTruthy();
  expect(unit.marketRentSetAt!.getTime()).toBeGreaterThan(Date.now() - 60_000);

  await open(page, `/properties/${propertyId}/units/${unitId}`);
  const facts = page.locator('dl.kv').first();
  await expect(facts.getByText('Market rent', { exact: true })).toBeVisible();
  await expect(facts).toContainText('$1,725');
  await page.screenshot({ path: 'test-results/rent-comps-unit-detail.png', fullPage: true });
  testInfo.annotations.push({ type: 'applied', description: '$1,725' });
});

test('rejects an invalid rent and serves repeat views from the cache', async ({ page }) => {
  await signIn(page);
  await open(page, `/rent-comps?unit=${unitId}&days=180`);
  await page.getByLabel('Market rent to apply ($ / month)').fill('0');
  await page.getByRole('button', { name: /^Apply to / }).click();
  await expect(page.getByText('Enter a monthly rent between $1 and $100,000.')).toBeVisible();

  await open(page, `/rent-comps?unit=${unitId}&days=180`);
  await expect(page.getByText(/cached for this unit/)).toBeVisible();
});

test('unit picker switches the subject unit', async ({ page }) => {
  await signIn(page);
  await open(page, '/rent-comps');
  await page.locator('select[name="unit"]').selectOption(unitId);
  await expect(page).toHaveURL(new RegExp(`unit=${unitId}`));
  await expect(page.getByRole('heading', { name: 'Maple Court · Unit 3A' })).toBeVisible();
});
