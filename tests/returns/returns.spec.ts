import { expect, test, type Page } from '@playwright/test';

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('manager reviews returns, adds an expense and exports CSV', async ({ page }) => {
  await signIn(page);
  await page.goto('/returns');
  await expect(page.getByRole('heading', { name: 'Returns and metrics', level: 1 })).toBeVisible();
  for (const label of [
    'Net operating income',
    'Cash flow',
    'Cap rate',
    'Cash-on-cash return',
    'Occupancy',
    'Expense ratio',
  ])
    await expect(page.locator('.stat .label', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Income vs expenses' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'NOI by property' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Returns by property' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Expense breakdown' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Export report' })).toBeVisible();
  for (const name of ['Maple Court', 'Harbor View Lofts', 'Cedar Row Townhomes', '18 Elm Street', 'Portfolio'])
    await expect(page.locator('tbody tr', { hasText: name }).first()).toBeVisible();
  await expect(
    page.locator('tbody tr', { hasText: 'Maple Court' }).getByRole('link', { name: /Maple Court/ }),
  ).toHaveAttribute('href', /\/properties\/seed-property-maple\?tab=returns$/);
  await page.screenshot({ path: 'test-results/returns-overview.png', fullPage: true });

  const noiBefore = await page
    .locator('.stat', { hasText: 'Net operating income' })
    .locator('.value')
    .innerText();

  // Add an expense dated inside the trailing 12 months and see NOI move.
  await page.getByRole('link', { name: '+ Add expense' }).click();
  await expect(page.getByRole('heading', { name: 'Add expense' })).toBeVisible();
  const expenseForm = page.locator('form', { hasText: 'Save expense' });
  await expenseForm.locator('select[name="propertyId"]').selectOption({ label: 'Maple Court' });
  await expenseForm.locator('select[name="category"]').selectOption('REPAIRS');
  await expenseForm.locator('input[name="amount"]').fill('1200.00');
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  await expenseForm.locator('input[name="occurredOn"]').fill(`${yyyy}-${mm}-15`);
  await expenseForm.locator('input[name="description"]').fill('Playwright verification repair');
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page.getByText('Expense added. The returns below now include it.')).toBeVisible();
  const noiAfter = await page
    .locator('.stat', { hasText: 'Net operating income' })
    .locator('.value')
    .innerText();
  expect(noiAfter).not.toBe(noiBefore);
  await page.screenshot({ path: 'test-results/returns-expense-added.png', fullPage: true });

  // CSV export downloads a file with the per-property table.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export report (CSV)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('returns-');
  const path = await download.path();
  expect(path).toBeTruthy();
});


test('returns and dashboard switch to multi-year ranges kept in the URL', async ({ page }) => {
  await signIn(page);
  await page.goto('/returns');
  await page.getByRole('link', { name: '5Y', exact: true }).click();
  await expect(page).toHaveURL(/period=5Y/);
  await expect(page.getByText(/by quarter/)).toBeVisible();
  await page.getByRole('link', { name: '2Y', exact: true }).click();
  await expect(page.getByText(/by month/)).toBeVisible();

  await page.goto('/returns');
  const custom = page.getByRole('form', { name: 'Custom range' });
  await custom.getByLabel('From').fill('2024-01');
  await custom.getByLabel('To').fill('2024-06');
  await custom.getByRole('button', { name: 'Apply' }).click();
  await expect(page).toHaveURL(/period=CUSTOM&from=2024-01&to=2024-06/);
  await expect(page.getByText('Jan 2024 – Jun 2024').first()).toBeVisible();

  await page.goto('/properties/seed-property-maple/returns?period=3Y');
  await expect(page.getByText(/by quarter/)).toBeVisible();

  await page.goto('/dashboard');
  await page.getByRole('link', { name: '5Y', exact: true }).click();
  await expect(page).toHaveURL(/range=5Y/);
  await expect(page.getByTestId('collection-chart')).toBeVisible();
});
