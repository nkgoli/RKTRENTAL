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

async function openApplications(page: Page, applicationId: string) {
  const url = `/applications?applicant=${applicationId}`;
  try {
    await page.goto(url);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('net::ERR_ABORTED')) throw error;
    await page.goto(url);
  }
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('manager runs screening and approves Olivia Reed with a written reason', async ({
  page,
}, testInfo) => {
  const reset = await prisma.application.updateMany({
    where: { id: oliviaId },
    data: { status: 'REVIEW', decisionReason: null, decidedBy: null, decidedAt: null },
  });
  expect(reset.count).toBe(1);

  await signIn(page);
  await openApplications(page, oliviaId);
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
  expect(await prisma.application.findUniqueOrThrow({ where: { id: oliviaId } })).toMatchObject({
    status: 'APPROVED',
    decisionReason: 'criteria-met',
    decidedBy: 'seed-jordan-mills',
    decidedAt: expect.any(Date),
  });
  await page.screenshot({
    path: testInfo.outputPath('olivia-approved.png'),
    fullPage: true,
  });
});

test('screening stays blocked until the applicant records FCRA consent', async ({ page }) => {
  await signIn(page);
  await openApplications(page, 'seed-application-rohan');
  await expect(page.getByRole('heading', { name: 'Rohan Das' })).toBeVisible();
  await expect(page.getByText('FCRA consent required')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run screening' })).toBeDisabled();
});

test('screening and decision redirects keep the property and unit scope', async ({ page }) => {
  const reset = await prisma.application.updateMany({
    where: { id: oliviaId },
    data: { status: 'REVIEW', decisionReason: null, decidedBy: null, decidedAt: null },
  });
  expect(reset.count).toBe(1);
  const olivia = await prisma.application.findUniqueOrThrow({
    where: { id: oliviaId },
    include: { unit: true },
  });
  const scope = { propertyId: olivia.unit.propertyId, unitId: olivia.unitId };

  await signIn(page);
  await page.goto(
    `/applications?propertyId=${scope.propertyId}&unitId=${scope.unitId}&applicant=${oliviaId}`,
  );
  await page.getByRole('button', { name: 'Run screening again' }).click();
  await expect(page.getByRole('status')).toContainText('Screening request sent');
  await expect(page).toHaveURL(new RegExp(`propertyId=${scope.propertyId}`));
  await expect(page).toHaveURL(new RegExp(`unitId=${scope.unitId}`));
  await expect(page).toHaveURL(/notice=screening/);

  await page.getByLabel('Decision reason').selectOption('credit-below-criteria');
  await page.getByRole('button', { name: 'Decline' }).click();
  await expect(page.getByRole('status')).toContainText('Decision recorded');
  await expect(page).toHaveURL(new RegExp(`propertyId=${scope.propertyId}`));
  await expect(page).toHaveURL(new RegExp(`unitId=${scope.unitId}`));
  await prisma.application.update({
    where: { id: oliviaId },
    data: { status: 'REVIEW', decisionReason: null, decidedBy: null, decidedAt: null },
  });
});
