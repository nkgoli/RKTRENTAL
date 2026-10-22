import { expect, test, type Page } from '@playwright/test';

// Add expense open/cancel/submit must reload /returns as a document. A same-route client
// transition there stalled in production builds (URL and form unchanged after a 200 RSC
// fetch), so these checks also run against `next start` via PLAYWRIGHT_BASE_URL.
const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';
const filtered = '/returns?period=3Y&property=seed-property-maple';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const addHeading = (page: Page) => page.getByRole('heading', { name: 'Add expense' });
const cancel = (page: Page) => page.locator('#add-expense').getByRole('link', { name: 'Cancel' });
const expenseTotal = (page: Page) =>
  page
    .locator('.card', { hasText: 'Expense breakdown' })
    .getByText(/ total$/)
    .innerText();

/** Activates a link and requires a document navigation to `path` (not a client transition). */
async function documentNavigation(page: Page, path: string, activate: () => Promise<void>) {
  const request = page.waitForRequest(
    (r) => r.isNavigationRequest() && new URL(r.url()).pathname + new URL(r.url()).search === path,
  );
  await activate();
  await request;
  await page.waitForLoadState('domcontentloaded');
}

async function expectClosedReport(page: Page) {
  await expect(page).toHaveURL(filtered);
  await expect(addHeading(page)).toHaveCount(0);
  await expect(page.locator('select[name="property"]')).toHaveValue('seed-property-maple');
  await expect(page.locator('[aria-label="Date range"] [aria-current="true"]')).toHaveText('3Y');
  await expect(page.getByText('Check the expense details')).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('Cancel closes Add expense, keeps the filters and records nothing', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/returns')) posts.push(r.url());
  });
  await page.goto(filtered);
  const totalBefore = await expenseTotal(page);

  // Repeated open/cancel by click, then by keyboard.
  for (let round = 0; round < 3; round++) {
    await documentNavigation(page, `${filtered}&add=1`, () =>
      page.getByRole('link', { name: '+ Add expense' }).click(),
    );
    await expect(addHeading(page)).toBeVisible();
    await documentNavigation(page, filtered, () => cancel(page).click());
    await expectClosedReport(page);
  }
  await documentNavigation(page, `${filtered}&add=1`, async () => {
    await page.getByRole('link', { name: '+ Add expense' }).focus();
    await page.keyboard.press('Enter');
  });
  await page.locator('input[name="amount"]').fill('99.00');
  await documentNavigation(page, filtered, async () => {
    await cancel(page).focus();
    await page.keyboard.press('Enter');
  });
  await expectClosedReport(page);
  expect(await expenseTotal(page)).toBe(totalBefore);
  expect(posts).toEqual([]);
});

test('Cancel after an invalid submission clears the notice and the form', async ({ page }) => {
  await page.goto(`${filtered}&add=1`);
  const totalBefore = await expenseTotal(page);
  await page.locator('input[name="amount"]').fill('-5');
  await page.locator('input[name="occurredOn"]').fill('2026-10-01');
  await documentNavigation(
    page,
    '/returns?notice=expense-invalid&period=3Y&property=seed-property-maple',
    () => page.getByRole('button', { name: 'Save expense' }).click(),
  );
  await expect(page.getByText('Check the expense details')).toBeVisible();
  await expect(addHeading(page)).toBeVisible();
  await expect(page.locator('input[name="amount"]')).toHaveValue('');
  await documentNavigation(page, filtered, () => cancel(page).click());
  await expectClosedReport(page);
  expect(await expenseTotal(page)).toBe(totalBefore);
});

test('Cancel works on a phone-width viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${filtered}&add=1`);
  await expect(addHeading(page)).toBeVisible();
  await documentNavigation(page, filtered, () => cancel(page).click());
  await expectClosedReport(page);
});
