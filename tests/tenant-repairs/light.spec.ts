import { expect, test } from '@playwright/test';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
test('approved Repairs phone/desktop labels, focus, photo controls and feedback', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('alex.rivera@email.com');
  await page.getByLabel('Password', { exact: true }).fill('AlexDemo#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto('/repairs');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('link', { name: 'Repairs', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByLabel('Urgency', { exact: true })).toBeVisible();
    await page.screenshot({
      path: `tests/tenant-repairs/evidence/repairs-${width}-after.png`,
      fullPage: true,
    });
  }
  const description = page.getByLabel('What needs fixing?', { exact: true });
  await description.fill('   ');
  await page.getByRole('button', { name: 'Submit request', exact: true }).click();
  await expect(description).toBeFocused();
  await expect(description).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Browse files', exact: true })).toBeFocused();
  expect(
    await page
      .getByRole('button', { name: 'Browse files', exact: true })
      .evaluate((el) => getComputedStyle(el).outlineStyle),
  ).toBe('solid');
  await page.screenshot({ path: 'tests/tenant-repairs/evidence/repairs-focus-390.png' });
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await chooser).setFiles({ name: 'tap.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('1 of 5 photos', { exact: true })).toBeVisible();
  await expect(page.getByText('Ready to submit', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove tap.png', exact: true }).click();
  await page
    .getByLabel('Choose files', { exact: true })
    .setInputFiles(
      Array.from({ length: 6 }, (_, i) => ({
        name: `tap-${i}.png`,
        mimeType: 'image/png',
        buffer: PNG,
      })),
    );
  await expect(page.getByText('5 of 5 photos', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Photo limit reached' })).toBeVisible();
  await page.screenshot({
    path: 'tests/tenant-repairs/evidence/repairs-limit-390.png',
    fullPage: true,
  });
  for (const notice of ['submitted', 'photo-failed', 'invalid', 'comment-failed']) {
    await page.goto(`/repairs?notice=${notice}`);
    await expect(page.locator('.alert')).toBeVisible();
  }
  await page.goto('/repairs');
  await page.getByRole('link', { name: /Your requests \(/ }).click();
  await expect(page.getByRole('heading', { name: 'Your requests', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.screenshot({ path: 'tests/tenant-repairs/evidence/repairs-end-390.png' });
});
