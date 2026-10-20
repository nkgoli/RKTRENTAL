import { expect, test } from '@playwright/test';

test('production phone keyboard, eligibility, scope settings and recovery remain usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/applications?applicant=seed-application-rohan');
  await expect(page.getByRole('button', { name: 'Run screening', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeFocused();
  await page.locator('#applicants summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#applicants')).toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(page.locator('#applicants')).not.toHaveAttribute('open', '');
  await page.screenshot({
    path: 'tests/screening/evidence/production-consent-keyboard-390.png',
    fullPage: true,
  });
  await page.goto('/applications?applicant=seed-application-marcus');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await page.screenshot({
    path: 'tests/screening/evidence/production-pending-390.png',
    fullPage: true,
  });
  await page.goto('/properties/seed-property-maple/applications?unit=seed-unit-maple-7');
  await page.getByText('Application settings', { exact: true }).first().click();
  await page.getByLabel('Screening reports', { exact: true }).selectOption('checkr-background');
  await expect(page.locator('small[aria-live]')).toHaveText('Checkr · background check');
  await expect(page.locator('[data-application-group]')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({
    path: 'tests/screening/evidence/production-settings-390.png',
    fullPage: true,
  });
  await page.goto('/applications?q=no-such-applicant&applicant=missing');
  await expect(
    page.getByRole('heading', { name: 'Applicant unavailable in this view' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reset review' })).toHaveAttribute(
    'href',
    '/applications',
  );
  await page.screenshot({
    path: 'tests/screening/evidence/production-recovery-390.png',
    fullPage: true,
  });
});
