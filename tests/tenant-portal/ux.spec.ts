import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('alex.rivera@email.com');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.ROCKETRENTAL_DEMO_TENANT_PASSWORD ?? 'AlexDemo#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}

for (const width of [390, 1280]) {
  test(`tenant navigation, documents and form review at ${width}px without financial submissions`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await signIn(page);
    for (const [path, title, tab] of [
      ['home', 'Welcome home', 'Home'],
      ['pay', /Pay .* rent/, 'Pay'],
      ['lease', 'Alex Rivera', 'Lease'],
      ['repairs', 'Repairs', 'Repairs'],
    ] as const) {
      await page.goto(`/${path}`);
      await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
      const current = page
        .getByRole('navigation', { name: 'Tenant', exact: true })
        .getByRole('link', { name: tab, exact: true });
      await expect(current).toHaveAttribute('aria-current', 'page');
      const bounds = await current.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations).toEqual([]);
    }
    await page.goto('/lease');
    const documents = page
      .getByRole('navigation', { name: 'Lease sections' })
      .getByRole('link', { name: /^Documents/ });
    await documents.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#documents$/);
    const preview = page.getByRole('link', { name: /Preview Signed lease/ });
    await expect(preview).toHaveAttribute('target', '_blank');
    const own = await page.request.get((await preview.getAttribute('href'))!);
    expect(own.status()).toBe(200);
    expect(own.headers()['content-type']).toContain('application/pdf');

    await page.goto('/pay');
    const amount = page.getByRole('textbox', { name: 'Amount', exact: true });
    await amount.fill('0');
    await expect(amount).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('main').getByRole('alert')).toContainText('two decimal places');
    await amount.fill('1850.00');
    await amount.press('Enter');
    await expect(page.getByRole('group', { name: 'Confirm payment' })).toBeFocused();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pay $1,850', exact: true })).toBeFocused();

    await page.goto('/repairs');
    await page.getByRole('textbox', { name: /What needs fixing/ }).fill('   ');
    await page.getByLabel('Category').selectOption('Electrical');
    await page.getByRole('button', { name: 'Submit request' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Describe what needs fixing',
    );
    await expect(page.getByRole('textbox', { name: /What needs fixing/ })).toBeFocused();
    await expect(page.getByLabel('Category')).toHaveValue('Electrical');
    await page
      .getByRole('navigation', { name: 'Repair sections' })
      .getByRole('link', { name: /^Your requests/ })
      .click();
    await expect(page).toHaveURL(/#your-requests$/);

    await page.goto('/sign-out');
    await page.getByRole('link', { name: 'Stay signed in' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/home$/);
  });
}

test('account recovery is readable and keyboard accessible at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sign-in?error=invalid&next=%2Flease');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Check your details');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Show characters' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide characters' }).click();
  await page.goto('/a-page-that-does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Return to your account' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});
