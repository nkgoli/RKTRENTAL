import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';

const baseline = process.env.TEMPLATE_BASELINE === '1';
const surface = baseline ? 'baseline-foundation' : 'candidate';
const evidence = path.resolve('.playwright-mcp');
const prisma = new PrismaClient();
let comparisonId: string;
test.beforeAll(async () => {
  const standard = await prisma.leaseTemplate.findFirstOrThrow({
    where: { name: 'Standard residential lease' },
  });
  const existing = await prisma.leaseTemplate.findFirst({
    where: {
      name: 'Automation comparison · reusable residential terms',
      organizationId: standard.organizationId,
    },
  });
  const comparison =
    existing ??
    (await prisma.leaseTemplate.create({
      data: {
        organizationId: standard.organizationId,
        name: 'Automation comparison · reusable residential terms',
        defaultFees: {
          lateFee: '75',
          graceDays: 5,
          moveInFee: '',
          petDeposit: '250',
          returnedPaymentFee: '',
          keyFee: '',
        },
        items: {
          create: [
            {
              section: 'CLAUSE',
              title: 'Residential use and complete agreement wording',
              body: 'Use the home as a residence. Review the complete agreement wording before signing. '.repeat(
                16,
              ),
              sortOrder: 0,
              required: true,
              includeWhen: 'ALWAYS',
            },
            {
              section: 'RULE',
              title: 'Quiet hours',
              body: 'Keep noise low so neighbors can rest.',
              sortOrder: 1,
              required: false,
              includeWhen: 'MULTI_UNIT',
            },
            {
              section: 'DISCLOSURE',
              title: 'Lead-based paint',
              body: 'Review the separate disclosure and required information before signing.',
              sortOrder: 2,
              required: true,
              includeWhen: 'PRE_1978',
            },
          ],
        },
      },
    }));
  comparisonId = comparison.id;
});
async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
  await page
    .getByLabel('Password')
    .fill(process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function capture(page: Page, name: string) {
  await page.screenshot({ path: path.join(evidence, `${surface}-${name}.png`), fullPage: true });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
test.afterAll(async () => {
  await prisma.$disconnect();
});

for (const width of [1440, 390]) {
  test(`${surface}: library/editor ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await signIn(page);
    await page.goto('/leases/templates');
    await expect(page.getByRole('link', { name: 'Edit template' }).first()).toBeVisible();
    await capture(page, `library-${width}`);
    if (!baseline) await noOverflow(page);
    await page.locator(`a[href="/leases/templates/${comparisonId}"]:visible`).click();
    await expect(page.getByRole('button', { name: 'Expand all' })).toBeVisible();
    if (!baseline) {
      const preview = page.locator('article p[class*="lt-item-preview"]').first();
      const metrics = await preview.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          height: el.getBoundingClientRect().height,
          line: parseFloat(style.lineHeight),
          padding: style.paddingBottom,
        };
      });
      expect(metrics.padding).toBe('0px');
      expect(metrics.height).toBeLessThanOrEqual(metrics.line * 2 + 0.5);
      await expect(page.locator('#template-properties svg')).toHaveCount(5);
    }
    await capture(page, `editor-${width}`);
    await page.getByRole('button', { name: 'Expand all' }).click();
    if (!baseline) {
      await expect(page.locator('article p[class*="lt-item-preview"]')).toHaveCount(0);
      const title = page.getByLabel('Residential use and complete agreement wording title');
      await expect(title.locator('..')).toContainText(
        'Residential use and complete agreement wording title',
      );
      await expect(
        page.getByLabel('Residential use and complete agreement wording wording').locator('..'),
      ).toContainText('Residential use and complete agreement wording wording');
      expect(
        await page
          .getByRole('button', {
            name: 'Remove Residential use and complete agreement wording',
            exact: true,
          })
          .evaluate((el) => getComputedStyle(el).color),
      ).toBe('rgb(180, 35, 62)');
      await title.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(title).toBeFocused();
      expect(await title.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
    }
    await capture(page, `editor-expanded-${width}`);
    if (!baseline) {
      await noOverflow(page);
      await page.getByLabel('Key replacement fee').scrollIntoViewIfNeeded();
      const save = page.getByRole('button', { name: 'Save template', exact: true });
      const box = await save.boundingBox();
      expect(box && box.y >= 0 && box.y + box.height <= 1000).toBeTruthy();
      await save.focus();
      await expect(save).toBeFocused();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(save).toBeFocused();
      expect(await save.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
      await capture(page, `sticky-focus-${width}`);
    }
  });
}

test('candidate: actual mutations, validation, failure retention and keyboard', async ({
  page,
}) => {
  test.skip(baseline);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/leases/templates/new');
  const name = `Automation terms ${Date.now()}`;
  await page.getByLabel('Template name', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save template', exact: true }).click();
  await expect(page.getByText('Enter a template name.')).toBeFocused();
  await page.getByLabel('Template name', { exact: true }).fill(name);
  await page.getByRole('button', { name: '+ Add clause', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Save template', exact: true }).click();
  await expect(page.getByLabel('New item title')).toHaveAttribute('aria-invalid', 'true');
  await capture(page, 'validation-phone');
  await page.getByLabel('New item title').fill('Original clause');
  await page.getByLabel('Original clause wording').fill('Full reusable wording. '.repeat(45));
  expect(await page.getByLabel('Original clause include when').locator('option').count()).toBe(14);
  await page.getByLabel('Original clause include when').selectOption('PETS_ALLOWED');
  await page.getByRole('button', { name: '+ Add clause', exact: true }).click();
  await page.getByLabel('New item title').fill('First ordered clause');
  await page.getByLabel('First ordered clause wording').fill('This clause is ordered first.');
  await page.getByRole('button', { name: 'Move First ordered clause up' }).click();
  await page.getByRole('button', { name: '+ Add rule', exact: true }).click();
  await page.getByLabel('New item title').fill('House rule');
  await page.getByLabel('House rule wording').fill('Respect the home and shared areas.');
  await page.getByRole('button', { name: '+ Add disclosure', exact: true }).click();
  await page.getByLabel('New item title').fill('Disclosure');
  await page
    .getByLabel('Disclosure wording', { exact: true })
    .fill('Read the required disclosure before signing.');
  for (const [label, value] of [
    ['Late fee', '80'],
    ['Grace days', '6'],
    ['Move-in fee', '120'],
    ['Pet deposit', '250'],
    ['Returned payment fee', '30'],
    ['Key replacement fee', '25'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Save template', exact: true }).click();
  await expect(page).toHaveURL(/\/leases\/templates\/(?!new)[^/]+$/);
  const originalUrl = page.url();
  await expect(page.getByRole('status').filter({ hasText: 'Version 1' })).toBeVisible();
  await page.getByLabel('Template name', { exact: true }).fill(`${name} edited`);
  await page.route('**/leases/templates/**', async (route) => {
    if (route.request().method() === 'POST') await route.abort('failed');
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Save template', exact: true }).click();
  await expect(
    page.getByText('The template could not be saved. Your edits are still here; try again.'),
  ).toBeFocused();
  await expect(page.getByLabel('Template name', { exact: true })).toHaveValue(`${name} edited`);
  await capture(page, 'failure-retention-phone');
  await page.unroute('**/leases/templates/**');
  await page.route('**/leases/templates/**', async (route) => {
    if (route.request().method() === 'POST')
      await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Save template', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Template name', { exact: true })).toBeDisabled();
  await capture(page, 'pending-save-phone');
  await expect(page.getByText('Saved version 2.')).toBeVisible();
  await page.unroute('**/leases/templates/**');
  expect(page.url()).toBe(originalUrl);
  await page.reload();
  await expect(page.getByLabel('Template name', { exact: true })).toHaveValue(`${name} edited`);
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(page.locator('article button[aria-expanded] strong').first()).toHaveText(
    '1. First ordered clause',
  );
  await expect(page.getByLabel('Original clause wording')).toHaveValue(
    'Full reusable wording. '.repeat(45).trim(),
  );
  for (const [label, value] of [
    ['Late fee', '80'],
    ['Grace days', '6'],
    ['Move-in fee', '120'],
    ['Pet deposit', '250'],
    ['Returned payment fee', '30'],
    ['Key replacement fee', '25'],
  ])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  await expect(page.getByLabel('Original clause include when')).toHaveValue('PETS_ALLOWED');
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(page).not.toHaveURL(originalUrl);
  await expect(page.getByLabel('Template name', { exact: true })).toHaveValue(
    `${name} edited copy`,
  );
  const copyUrl = page.url();
  const copyId = copyUrl.split('/').at(-1)!;
  const propertyButton = page.getByRole('button', { name: /^Set as default for/ }).first();
  const propertyName = (await propertyButton.getAttribute('aria-label'))!.replace(
    'Set as default for ',
    '',
  );
  await propertyButton.click();
  await expect(page.getByText('Property default updated.')).toBeVisible();
  await expect(
    page
      .locator('div')
      .filter({ has: page.getByText(propertyName, { exact: true }) })
      .filter({ hasText: 'Default for this property' })
      .first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Delete when unused' }).click();
  await expect(
    page.getByText('Remove this template from leases and property defaults before deleting it.'),
  ).toBeVisible();
  await capture(page, 'property-default-denial-phone');
  // Keep the fixture isolated; attach one existing fixture lease solely to exercise usage denial.
  const template = await prisma.leaseTemplate.findUniqueOrThrow({ where: { id: copyId } });
  const lease = await prisma.lease.findFirstOrThrow({
    where: { organizationId: template.organizationId },
  });
  await prisma.property.updateMany({
    where: { defaultLeaseTemplateId: copyId },
    data: { defaultLeaseTemplateId: null },
  });
  await prisma.lease.update({ where: { id: lease.id }, data: { templateId: copyId } });
  await page.reload();
  await page.getByRole('button', { name: 'Delete when unused' }).click();
  await expect(
    page.getByText('Remove this template from leases and property defaults before deleting it.'),
  ).toBeVisible();
  await capture(page, 'used-deletion-denial-phone');
  await expect(page.getByRole('button', { name: 'Delete when unused' })).toBeEnabled();
  await prisma.lease.update({ where: { id: lease.id }, data: { templateId: lease.templateId } });
  expect(await prisma.lease.count({ where: { templateId: copyId } })).toBe(0);
  expect(await prisma.property.count({ where: { defaultLeaseTemplateId: copyId } })).toBe(0);
  await page.reload();
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(page.getByRole('button', { name: 'Collapse all' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete when unused' }).click();
  await expect(page).toHaveURL(/\/leases\/templates$/);
  await expect(page.getByText(`${name} edited copy`, { exact: true })).toHaveCount(0);
  await capture(page, 'unused-deleted-phone');
  // The duplicate's unused deletion above is the UI assertion. Remove the original fixture directly.
  await prisma.leaseTemplate.delete({ where: { id: originalUrl.split('/').at(-1)! } });
});
