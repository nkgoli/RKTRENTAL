import { expect, test } from '@playwright/test';

test('repeated Back to applicants Enter activation reopens the same fragment', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/applications?applicant=seed-application-rohan');
  const list = page.locator('#applicants');
  const summary = list.locator('summary');
  const back = page.getByRole('link', { name: /Back to applicants/ });
  await expect(list).not.toHaveAttribute('open', '');
  for (let activation = 0; activation < 2; activation++) {
    await back.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#applicants$/);
    await expect(list).toHaveAttribute('open', '');
    await expect(list).toBeFocused();
    await expect(list.getByRole('link').first()).toBeVisible();
    if (activation === 0) {
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(list).not.toHaveAttribute('open', '');
      await expect(page).toHaveURL(/#applicants$/);
    }
  }
  await page.screenshot({
    path: 'tests/screening/evidence/applicant-list-repeat-390.png',
    fullPage: true,
  });
  await summary.click();
  await expect(list).not.toHaveAttribute('open', '');
  await back.click();
  await expect(list).toHaveAttribute('open', '');
  await expect(list).toBeFocused();
  await summary.click();
  await expect(list).not.toHaveAttribute('open', '');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(list).toHaveAttribute('open', '');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(list).not.toHaveAttribute('open', '');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(list).toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(list).not.toHaveAttribute('open', '');
});
