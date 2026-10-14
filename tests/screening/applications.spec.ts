import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';
const oliviaId = 'seed-application-olivia';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('manager runs screening and approves Olivia Reed with a written reason', async ({ page }, testInfo) => {
  const reset = await prisma.application.updateMany({
    where: { id: oliviaId },
    data: { status: 'REVIEW' },
  });
  expect(reset.count).toBe(1);

  await signIn(page);
  await page.goto(`/applications?applicant=${oliviaId}`);
  await expect(page.getByRole('heading', { name: 'Olivia Reed' })).toBeVisible();
  await expect(page.getByText('FCRA consent recorded')).toBeVisible();

  await page.getByRole('button', { name: 'Run screening again' }).click();
  await expect(page.getByRole('status')).toContainText('Screening request sent');
  await expect(page.getByText('742', { exact: true })).toBeVisible();
  await expect(page.getByText('Background check')).toBeVisible();
  await expect(page.getByText('Eviction check')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('olivia-screening-complete.png'),
    fullPage: true,
  });

  await page.getByLabel('Decision reason').selectOption('criteria-met');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('status')).toContainText('Applicant approved');
  const createLease = page.getByRole('link', { name: 'Create lease →' });
  await expect(createLease).toHaveAttribute(
    'href',
    `/leases/new?unit=seed-unit-maple-7&applicant=${oliviaId}`,
  );
  await page.screenshot({
    path: testInfo.outputPath('olivia-approved.png'),
    fullPage: true,
  });
});

test('screening stays blocked until the applicant records FCRA consent', async ({ page }) => {
  await signIn(page);
  await page.goto('/applications?applicant=seed-application-rohan');
  await expect(page.getByRole('heading', { name: 'Rohan Das' })).toBeVisible();
  await expect(page.getByText('FCRA consent required')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run screening' })).toBeDisabled();
});
