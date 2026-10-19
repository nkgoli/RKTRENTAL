import { expect, test } from '@playwright/test';

test('signed-out root opens the account sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
