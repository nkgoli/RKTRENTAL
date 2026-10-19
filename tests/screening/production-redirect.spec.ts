import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const db = new PrismaClient();
test.afterAll(async () => {
  await db.$disconnect();
});

for (const width of [1440, 390]) {
  test.describe(`production screening at ${width}px`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 1000 } });
    test('303 renders notice, report and usable decision controls without manual reload', async ({
      page,
    }) => {
      await db.application.update({
        where: { id: 'seed-application-olivia' },
        data: { status: 'REVIEW', decisionReason: null, decidedBy: null, decidedAt: null },
      });
      await page.goto('/sign-in');
      const origin = new URL(page.url()).origin;
      await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
      await page
        .getByLabel('Password', { exact: true })
        .fill(process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto('/applications?applicant=seed-application-olivia');
      const actionResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/applications',
      );
      const documentRedirect = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/applications/result' &&
          response.request().resourceType() === 'document',
      );
      await page.getByRole('button', { name: 'Run screening again' }).click();
      expect((await actionResponse).status()).toBe(303);
      expect((await documentRedirect).status()).toBe(303);
      await expect(page).toHaveURL(
        `${origin}/applications?applicant=seed-application-olivia&notice=screening`,
      );
      await expect(page.getByRole('status')).toContainText('Screening request sent');
      await expect(page.getByRole('heading', { name: 'Olivia Reed' })).toBeVisible();
      await expect(page.getByText('742', { exact: true })).toBeVisible();
      await page.getByLabel('Decision reason', { exact: true }).selectOption('criteria-met');
      await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Decline', exact: true })).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      await page.screenshot({
        path: `tests/screening/evidence/production-screening-${width}.png`,
        fullPage: true,
      });
    });
  });
}

test('result route keeps unauthenticated requests behind sign-in', async ({ page }) => {
  await page.goto('/applications/result?applicant=seed-application-olivia&notice=screening');
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Olivia Reed' })).toHaveCount(0);
});
