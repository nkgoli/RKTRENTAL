import { expect, test } from '@playwright/test';
const edit = '/maintenance/cmvgaxlq20001b9v8asyud0fv/edit?returnTo=%2Fmaintenance';
for (const width of [1440, 390])
  test(`activity preserves unsaved issue draft at ${width}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto('/sign-in');
    await page.getByLabel('Email address').fill('maintenance-pages@example.test');
    await page.getByLabel('Password', { exact: true }).fill('MaintenanceTest#2026');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/dashboard');
    await page.goto(edit);
    const title = page.getByLabel('Request title', { exact: true });
    const description = page.getByLabel('Description', { exact: true });
    const priority = page.getByLabel('Priority', { exact: true });
    const original = {
      title: await title.inputValue(),
      description: await description.inputValue(),
      priority: await priority.inputValue(),
    };
    const draft = {
      title: `Unsaved issue draft ${width}`,
      description: 'Unsaved detailed repair instructions. '.repeat(20),
      priority: original.priority === 'LOW' ? 'HIGH' : 'LOW',
    };
    await title.fill(draft.title);
    await description.fill(draft.description);
    await priority.selectOption(draft.priority);
    const comment = `Draft preservation activity ${width} ${Date.now()}`;
    await page.locator('textarea[name=comment]').fill(comment);
    await page.getByRole('button', { name: 'Add comment', exact: true }).click();
    await expect(page.getByText(comment, { exact: true })).toBeVisible();
    async function retained() {
      await expect(title).toHaveValue(draft.title);
      await expect(description).toHaveValue(draft.description);
      await expect(priority).toHaveValue(draft.priority);
      await expect(
        page.getByRole('status').filter({ hasText: 'Unsaved issue details restored.' }),
      ).toBeVisible();
    }
    await retained();
    await page.locator('select[name=vendorId]').selectOption('maintenance-pages-vendor');
    await page.getByRole('button', { name: 'Assign', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Vendor assigned.' })).toBeVisible();
    await retained();
    await page.locator('select[name=status]').selectOption('IN_PROGRESS');
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Status updated.' })).toBeVisible();
    await retained();
    await page
      .getByLabel('Choose a file')
      .setInputFiles({
        name: 'draft-repair.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          'base64',
        ),
      });
    await page.getByRole('button', { name: 'Upload photo', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Photo uploaded.' })).toBeVisible();
    await retained();
    await page.getByRole('button', { name: 'Save changes' }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `tests/maintenance/evidence/draft-activity-${width}.png`,
      fullPage: true,
    });
    const persisted = await context.newPage();
    await persisted.goto(edit);
    await expect(persisted.getByLabel('Request title', { exact: true })).toHaveValue(
      original.title,
    );
    await expect(persisted.getByLabel('Description', { exact: true })).toHaveValue(
      original.description,
    );
    await expect(persisted.getByLabel('Priority', { exact: true })).toHaveValue(original.priority);
    await persisted.close();
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    await page.waitForURL('**/maintenance');
    await page.goto(edit);
    await expect(title).toHaveValue(original.title);
    await expect(description).toHaveValue(original.description);
    await expect(priority).toHaveValue(original.priority);
    await expect(page.getByText(comment, { exact: true })).toBeVisible();
    await expect(page.locator('select[name=status]')).toHaveValue('IN_PROGRESS');
    await expect(page.locator('select[name=vendorId]')).toHaveValue('maintenance-pages-vendor');
    await expect(page.getByRole('link', { name: /Open photo/ }).first()).toBeVisible();
    await page.screenshot({
      path: `tests/maintenance/evidence/draft-cancel-${width}.png`,
      fullPage: true,
    });
  });
