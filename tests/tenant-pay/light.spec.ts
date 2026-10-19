import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`payment composition and keyboard review at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/sign-in');
    await page.getByLabel('Email address').fill('alex.rivera@email.com');
    await page
      .getByLabel('Password')
      .fill(process.env.ROCKETRENTAL_DEMO_TENANT_PASSWORD ?? 'AlexDemo#2026');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await page.goto('/pay');
    const amount = page.getByRole('textbox', { name: 'Amount' });
    await expect(amount).toBeVisible();
    await page.screenshot({
      path: `tests/tenant-pay/evidence/${process.env.PAY_EVIDENCE_PHASE ?? 'after'}-${width}.png`,
      fullPage: true,
    });
    await page.screenshot({
      path: `tests/tenant-pay/evidence/${process.env.PAY_EVIDENCE_PHASE ?? 'after'}-viewport-${width}.png`,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await amount.fill('500.00');
    await amount.press('Enter');
    const review = page.getByRole('group', { name: 'Confirm payment' });
    await expect(review).toBeFocused();
    await expect(review).toContainText('$500');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Confirm payment' })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Pay $500' })).toBeFocused();
    await page.getByRole('radio', { name: /^Card/ }).check();
    await page.getByRole('button', { name: /^Pay \$/ }).click();
    await expect(review).toContainText('$14.50 card fee');
    await expect(review).toContainText('$514.50');
    await page.screenshot({
      path: `tests/tenant-pay/evidence/${process.env.PAY_EVIDENCE_PHASE ?? 'after'}-review-${width}.png`,
      fullPage: true,
    });
    await review.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `tests/tenant-pay/evidence/${process.env.PAY_EVIDENCE_PHASE ?? 'after'}-review-viewport-${width}.png`,
    });
  });
}
