import { expect as baseExpect, test, type Page, type Locator } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { db, fixtureId, prepareLightFixtures, propertyId } from './light-fixtures';

const expect = baseExpect.configure({ timeout: 15_000 });
test.describe.configure({ timeout: 60_000 });
test.use({ channel: 'chromium' });
const evidence = '.playwright-mcp/lease-details';
const tabs = ['Agreement', 'Documents', 'Payments', 'Activity', 'Overview'];
const route = (state: string, tab = 'agreement') =>
  `/leases/${fixtureId(state)}?propertyId=${propertyId}&unitId=${fixtureId(state)}-unit&tab=${tab}`;
async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
  await page.getByLabel('Password', { exact: true }).fill('JordanDemo#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function capture(page: Page, name: string) {
  await noOverflow(page);
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
}

async function submitResult(page: Page, button: Locator, saved: string) {
  const actionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && Boolean(response.headers()['x-action-redirect']),
  );
  const resultResponse = page.waitForResponse(
    (response) =>
      response.request().resourceType() === 'document' && response.url().includes('/result?'),
  );
  await button.click();
  expect((await actionResponse).status()).toBe(303);
  const result = await resultResponse;
  expect(result.status()).toBe(303);
  expect(result.headers()['location']).toContain('propertyId=seed-property-maple&unitId=');
  await expect(page).toHaveURL(
    (url) => url.searchParams.get('saved') === saved && url.searchParams.get('tab') === 'agreement',
  );
}

test.beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  await prepareLightFixtures();
});
test.afterAll(async () => {
  await db.$disconnect();
});

for (const width of [1280, 390]) {
  test.describe(`${width}px lease details`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 900 } });
    test.beforeEach(async ({ page }) => {
      await signIn(page);
    });

    test('scoped tabs, body links, return target, keyboard and resize', async ({ page }) => {
      await page.goto(route('active', 'overview'));
      const navigation = page.getByRole('navigation', { name: 'Lease sections' });
      for (const label of [...tabs, ...tabs]) {
        const link = navigation.getByRole('link', { name: label, exact: true });
        await expect(link).toHaveAttribute(
          'href',
          new RegExp(`propertyId=${propertyId}&unitId=light-detail-active-unit`),
        );
        await link.click();
        await expect(page).toHaveURL((await link.getAttribute('href'))!);
        await expect(link).toHaveAttribute('aria-current', 'page');
        await noOverflow(page);
      }
      await navigation.getByRole('link', { name: 'Activity', exact: true }).click();
      await expect(navigation.getByRole('link', { name: 'Activity', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect
        .poll(async () => {
          const current = await navigation
            .getByRole('link', { name: 'Activity', exact: true })
            .boundingBox();
          const nav = await navigation.boundingBox();
          return Boolean(
            current &&
            nav &&
            current.x >= nav.x - 1 &&
            current.x + current.width <= nav.x + nav.width + 1,
          );
        })
        .toBe(true);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto(route('active', 'overview'));
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Unit Review active');
      for (const label of ['Manage agreement', 'View rent ledger', 'Lease documents']) {
        await expect(page.getByRole('link', { name: new RegExp(label) })).toHaveAttribute(
          'href',
          new RegExp(`propertyId=${propertyId}&unitId=light-detail-active-unit&tab=`),
        );
      }
      await navigation.getByRole('link', { name: 'Overview', exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(navigation.getByRole('link', { name: 'Agreement', exact: true })).toBeFocused();
      expect(
        await navigation
          .getByRole('link', { name: 'Agreement', exact: true })
          .evaluate((el) => getComputedStyle(el).outlineStyle),
      ).toBe('solid');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: 'Lease terms', exact: true })).toBeVisible();
      await capture(page, `scoped-agreement-${width}`);
      await page.getByRole('link', { name: /Maple Court leases/ }).click();
      await expect(page).toHaveURL(
        `/properties/${propertyId}/leases?unit=light-detail-active-unit`,
      );
      await page.goto(`/leases/${fixtureId('active')}?propertyId=wrong&unitId=wrong&tab=payments`);
      await expect(page.getByRole('link', { name: 'View payments' })).toHaveAttribute(
        'href',
        `/properties/${propertyId}/payments?unit=light-detail-active-unit`,
      );
    });

    test('terms and notice validation, pending feedback, persistence and signed snapshot', async ({
      page,
    }) => {
      await page.goto(route('active'));
      await page.getByText('Edit terms', { exact: true }).click();
      const form = page.getByRole('form', { name: 'Edit lease terms' });
      const priorSnapshot = (
        await db.lease.findUniqueOrThrow({ where: { id: fixtureId('active') } })
      ).termsSnapshot;
      await form.getByLabel('End date').fill('2025-01-01');
      await page.route('**/leases/light-detail-active?**', async (request) => {
        if (request.request().method() === 'POST')
          await new Promise((resolve) => setTimeout(resolve, 500));
        await request.continue();
      });
      await form.getByRole('button', { name: 'Save terms' }).click();
      await expect(form.getByRole('button', { name: 'Saving…' })).toBeDisabled();
      await expect(form.getByRole('button', { name: 'Saving…' })).toHaveAttribute(
        'aria-busy',
        'true',
      );
      await expect(form.getByText('End date must be on or after start date.')).toBeVisible();
      await page.unroute('**/leases/light-detail-active?**');
      await expect(form.getByLabel('End date')).toHaveValue('2025-01-01');
      await expect(form.getByLabel('End date')).toHaveAttribute('aria-invalid', 'true');
      await expect(form.getByLabel('End date')).toHaveAttribute(
        'aria-describedby',
        /endDate-error/,
      );
      await capture(page, `terms-error-${width}`);
      await form.getByLabel('End date').fill('2027-11-30');
      await form.getByLabel('Monthly rent').fill(width === 390 ? '1925' : '1900');
      await submitResult(page, form.getByRole('button', { name: 'Save terms' }), 'terms');
      await expect(form.getByRole('status')).toHaveText('Lease terms saved.');
      const saved = await db.lease.findUniqueOrThrow({ where: { id: fixtureId('active') } });
      expect(Number(saved.monthlyRent)).toBe(width === 390 ? 1925 : 1900);
      expect(saved.termsSnapshot).toEqual(priorSnapshot);
      await page.getByText(/Show all 1 clauses/).click();
      await expect(page.getByText(/The signed deposit is \$1,850/)).toBeVisible();
      await page.getByText(/(?:Record|Update) notice or move-out/, { exact: true }).click();
      const notice = page.getByRole('form', { name: 'Notice and move-out' });
      await notice.getByLabel('Notice given').fill('');
      await notice.getByRole('button', { name: 'Record notice' }).click();
      await expect(notice.getByText('Enter the date notice was given.')).toBeVisible();
      await expect(notice.getByLabel('Notice given')).toHaveAttribute('aria-invalid', 'true');
      await notice.getByLabel('Notice given').fill('2026-10-19');
      await notice.getByLabel('Planned move-out').fill('2026-10-18');
      await notice.getByRole('button', { name: 'Record notice' }).click();
      await expect(
        notice.getByText('The move-out date cannot be before the notice date.').first(),
      ).toBeVisible();
      await expect(notice.getByLabel('Planned move-out')).toHaveAttribute('aria-invalid', 'true');
      await capture(page, `notice-error-${width}`);
      await notice.getByLabel('Planned move-out').fill('2027-11-30');
      await submitResult(page, notice.getByRole('button', { name: 'Record notice' }), 'notice');
      await expect(notice.getByRole('status')).toHaveText('Notice recorded.');
      await capture(page, `agreement-saved-${width}`);
      expect(
        (
          await db.lease.findUniqueOrThrow({ where: { id: fixtureId('active') } })
        ).moveOutDate?.toISOString(),
      ).toContain('2027-11-30');
      await expect(page.getByRole('link', { name: 'Browse templates' })).toHaveAttribute(
        'href',
        '/leases/templates',
      );
    });

    test('document gates, upload retry, download, rename, sharing and delete recovery', async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.goto(route('active', 'documents'));
      const uploader = page.getByRole('region', { name: 'Upload lease document', exact: true });
      const input = uploader.getByLabel('Choose files');
      await input.setInputFiles({
        name: 'blocked.exe',
        mimeType: 'application/octet-stream',
        buffer: Buffer.from('blocked'),
      });
      await expect(uploader.getByRole('alert').first()).toContainText('not allowed');
      await input.setInputFiles({
        name: 'too-large.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(25 * 1024 * 1024 + 1, 65),
      });
      await expect(
        uploader.getByRole('alert').filter({ hasText: /exceeds the 25 MB limit/ }),
      ).toBeVisible();
      await input.setInputFiles({
        name: 'mismatch.pdf',
        mimeType: 'image/png',
        buffer: Buffer.from('%PDF-1.4'),
      });
      await expect(
        uploader.getByRole('alert').filter({ hasText: /does not match extension/ }),
      ).toBeVisible();
      await capture(page, `upload-gates-${width}`);
      const name = `Review document ${width}.pdf`;
      await page.route('**/api/files', (request) =>
        request.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Fixture upload failure. Try again.' }),
        }),
      );
      await input.setInputFiles({
        name,
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n'),
      });
      await expect(uploader.getByRole('button', { name: `Retry ${name}` })).toBeVisible();
      await capture(page, `upload-failure-${width}`);
      await page.unroute('**/api/files');
      await uploader.getByRole('button', { name: `Retry ${name}` }).click();
      let card = page.locator('article').filter({ hasText: name });
      await expect(card.getByText(name, { exact: true })).toBeVisible();
      const href = await card
        .getByRole('link', { name: 'Download', exact: true })
        .first()
        .getAttribute('href');
      const response = await page.request.get(href!);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('application/pdf');
      const downloadEvent = page.waitForEvent('download');
      await card.getByRole('link', { name: 'Download', exact: true }).first().click();
      const download = await downloadEvent;
      expect(await download.failure()).toBeNull();
      await download.saveAs(`tests/leases/.runtime/download-${width}.pdf`);
      await card.getByText('More actions', { exact: true }).click();
      await expect(card.getByRole('button', { name: 'Share with tenant' })).toBeDisabled();
      await card.getByText('Rename', { exact: true }).click();
      await card.getByRole('textbox').fill('   ');
      await card.getByRole('button', { name: 'Save name' }).click();
      await expect(card.getByRole('alert')).toHaveText('Enter a document name.');
      const longName = `Review-${width}-${'LongDocumentTitle'.repeat(9)}.pdf`;
      await card.getByRole('textbox').fill(longName);
      await card.getByRole('button', { name: 'Save name' }).click();
      card = page.locator('article').filter({ hasText: longName });
      await expect(card.getByRole('status')).toHaveText('Document renamed.');
      await card.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(
        card.getByRole('group', { name: `Delete ${longName}`, exact: true }),
      ).toBeFocused();
      await card.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(card.getByRole('button', { name: 'Delete', exact: true })).toBeFocused();
      const endpoint = href!.replace('/download', '');
      await page.route(`**${endpoint}`, (request) =>
        request.fulfill({ status: 500, body: 'Fixture failure' }),
      );
      await card.getByRole('button', { name: 'Delete', exact: true }).click();
      await card.getByRole('button', { name: 'Confirm delete', exact: true }).click();
      await expect(card.getByRole('alert')).toHaveText(
        'The file could not be deleted. Please try again.',
      );
      await capture(page, `document-delete-error-${width}`);
      await page.unroute(`**${endpoint}`);
      await card.getByRole('button', { name: 'Confirm delete', exact: true }).click();
      await expect(card).toHaveCount(0);
      await expect(
        page.getByRole('status').filter({ hasText: `${longName} deleted.` }),
      ).toBeVisible();
      await input.setInputFiles(
        [1, 2].map((index) => ({
          name: `Batch ${width}-${index}.pdf`,
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n'),
        })),
      );
      for (const index of [1, 2])
        await expect(
          page.locator('article').getByText(`Batch ${width}-${index}.pdf`, { exact: true }),
        ).toBeVisible();
    });

    test('empty ledger/documents and real pending, signed and declined activity', async ({
      page,
    }) => {
      await page.goto(route('ended', 'payments'));
      await expect(page.getByText('No charges due yet.')).toBeVisible();
      await expect(page.getByText('None yet', { exact: true })).toBeVisible();
      await capture(page, `ledger-empty-${width}`);
      await page.goto(route('ended', 'documents'));
      await expect(page.getByText('No lease documents yet.')).toBeVisible();
      await page.goto(route('ended', 'activity'));
      await expect(page.getByText('No completed signature recorded yet.')).toBeVisible();
      await expect(page.getByText('Lease created', { exact: true })).toBeVisible();
      await page.goto(route('pending', 'activity'));
      const signers = page.getByLabel('Signers');
      for (const label of ['Signed', 'Awaiting', 'Declined'])
        await expect(signers.getByText(label, { exact: true })).toBeVisible();
      await capture(page, `signature-pending-${width}`);
      await page.goto('/leases/seed-lease-maple-11?tab=payments');
      await expect(page.getByRole('heading', { name: 'Rent ledger', exact: true })).toBeVisible();
      await expect(page.getByText('Balance due', { exact: true })).toBeVisible();
    });
  });
}

test('draft activation restrictions, ended restrictions and fixture termination confirmation', async ({
  page,
}) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route('blocked'));
  await expect(page.getByRole('button', { name: 'Activate lease' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Terminate', exact: true })).toHaveCount(0);
  await expect(page.getByText('Record notice or move-out', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Activate lease' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'This unit already has an active lease' }),
  ).toHaveText('This unit already has an active lease during those dates.');
  await capture(page, 'draft-ineligible-390');
  await page.goto(route('draft'));
  await submitResult(page, page.getByRole('button', { name: 'Activate lease' }), 'activated');
  await expect(page.getByLabel('Lease summary').getByText('Active', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Lease activated.' })).toBeVisible();
  await page.goto(route('ended'));
  for (const name of ['Edit terms', 'Record notice or move-out', 'Activate lease', 'Terminate'])
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  await expect(page.getByText(/No agreement snapshot is recorded/)).toBeVisible();
  await capture(page, 'ended-agreement-390');
  await page.goto(route('terminate'));
  await page.getByRole('button', { name: 'Terminate', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Confirm lease termination' })).toBeFocused();
  await capture(page, 'terminate-confirm-390');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Terminate', exact: true })).toBeFocused();
  expect((await db.lease.findUniqueOrThrow({ where: { id: fixtureId('terminate') } })).status).toBe(
    'ACTIVE',
  );
  await page.getByRole('button', { name: 'Terminate', exact: true }).click();
  await submitResult(
    page,
    page.getByRole('button', { name: 'Confirm terminate', exact: true }),
    'terminated',
  );
  await expect(
    page.getByLabel('Lease summary').getByText('Terminated', { exact: true }),
  ).toBeVisible();
  expect((await db.lease.findUniqueOrThrow({ where: { id: fixtureId('terminate') } })).status).toBe(
    'TERMINATED',
  );
  await capture(page, 'terminated-390');
});

test('result routes require a manager and do not expose unavailable leases', async ({ page }) => {
  await page.goto('/leases/light-detail-active/result?saved=terms&scope=unit');
  await expect(page).toHaveURL(/\/sign-in\?/);
  await signIn(page);
  const missing = await page.request.get(
    '/leases/not-a-review-lease/result?saved=terms&scope=unit',
  );
  expect(missing.status()).toBe(404);
});
