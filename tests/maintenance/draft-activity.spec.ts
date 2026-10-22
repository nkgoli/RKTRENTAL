import { expect, test } from '@playwright/test';

const fixture = 'maintenance-pages-property';
const unit = 'maintenance-pages-unit';

for (const width of [1440, 390])
  test(`immediate activity preserves staged request edits at ${width}`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto('/sign-in');
    await page
      .getByRole('textbox', { name: 'Email address', exact: true })
      .fill('maintenance-pages@example.test');
    await page.getByLabel('Password', { exact: true }).fill('MaintenanceTest#2026');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/dashboard');

    // Each case creates its own request; only the account/property/vendor come from runtime.cjs.
    const original = {
      title: `Synthetic draft preservation ${width} ${Date.now()}`,
      description: 'Original repair instructions.',
      priority: 'NORMAL',
    };
    await page.goto(
      `/maintenance/new?propertyId=${fixture}&unitId=${unit}&returnTo=%2Fmaintenance`,
    );
    const create = page.getByRole('form', { name: 'Create repair request', exact: true });
    await expect(create.getByRole('combobox', { name: 'Unit', exact: true })).toHaveValue(unit);
    await create.getByRole('textbox', { name: 'Title', exact: true }).fill(original.title);
    await create
      .getByRole('textbox', { name: 'Description', exact: true })
      .fill(original.description);
    await create.getByRole('button', { name: 'Save request', exact: true }).click();
    await expect(create.getByRole('status')).toContainText('Repair request created.');
    await create.getByRole('link', { name: 'Back to repair requests', exact: true }).click();
    await page.getByRole('link', { name: original.title, exact: true }).click();
    await page.waitForURL(/\/maintenance\/[^/]+\/edit(?:\?|$)/);
    const edit = page.url();
    const title = page.getByRole('textbox', { name: 'Title', exact: true });
    const description = page.getByRole('textbox', { name: 'Description', exact: true });
    const priority = page.getByRole('combobox', { name: 'Priority', exact: true });
    const vendor = page.getByRole('combobox', { name: 'Assign vendor', exact: true });
    const status = page.getByRole('combobox', { name: 'Status', exact: true });
    await expect(title).toHaveValue(original.title);
    await expect(page.getByText('Photos · none added', { exact: true })).toBeVisible();

    const draft = {
      title: `Unsaved issue draft ${width}`,
      description: 'Unsaved detailed repair instructions. '.repeat(20),
      priority: 'HIGH',
    };
    await title.fill(draft.title);
    await description.fill(draft.description);
    await priority.selectOption(draft.priority);
    await vendor.selectOption('maintenance-pages-vendor');
    await status.selectOption('IN_PROGRESS');
    async function retained() {
      await expect(title).toHaveValue(draft.title);
      await expect(description).toHaveValue(draft.description);
      await expect(priority).toHaveValue(draft.priority);
      await expect(vendor).toHaveValue('maintenance-pages-vendor');
      await expect(status).toHaveValue('IN_PROGRESS');
      await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
    }

    const comment = `Draft preservation activity ${width} ${Date.now()}`;
    await page.getByRole('textbox', { name: 'Add a comment', exact: true }).fill(comment);
    await page.getByRole('button', { name: 'Post comment', exact: true }).click();
    await expect(page.getByText(comment, { exact: true })).toBeVisible();
    await retained();
    await page.getByLabel('Choose request photo', { exact: true }).setInputFiles({
      name: 'draft-repair.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64',
      ),
    });
    await expect(
      page.getByRole('img', { name: 'Selected photo preview', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Upload photo', exact: true }).click();
    await expect(
      page.getByRole('form', { name: 'Upload request photo', exact: true }).getByRole('status'),
    ).toContainText('Photo uploaded.');
    await retained();
    await page.getByRole('button', { name: 'Preview draft-repair.png', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'draft-repair.png', exact: true });
    await expect(preview.getByRole('img', { name: 'draft-repair.png', exact: true })).toBeVisible();
    await expect(
      preview.getByRole('link', { name: 'Download original', exact: true }),
    ).toHaveAttribute('href', /\/api\/files\/.+\/download$/);
    await page.screenshot({
      path: `tests/maintenance/evidence/draft-preview-${width}.png`,
      fullPage: true,
    });
    await preview.getByRole('button', { name: 'Close', exact: true }).click();
    await retained();
    await page
      .getByRole('button', { name: 'Save changes', exact: true })
      .first()
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `tests/maintenance/evidence/draft-activity-${width}.png`,
      fullPage: true,
    });

    const persisted = await context.newPage();
    await persisted.goto(edit);
    await expect(persisted.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      original.title,
    );
    await expect(persisted.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(
      original.description,
    );
    await expect(persisted.getByRole('combobox', { name: 'Priority', exact: true })).toHaveValue(
      original.priority,
    );
    await expect(persisted.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue(
      'NEW',
    );
    await expect(
      persisted.getByRole('combobox', { name: 'Assign vendor', exact: true }),
    ).toHaveValue('');
    await expect(persisted.getByText(comment, { exact: true })).toBeVisible();
    await persisted.close();

    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
    await discard.getByRole('button', { name: 'Cancel', exact: true }).click();
    await retained();
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    await discard.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await page.waitForURL('**/maintenance');
    await page.goto(edit);
    await expect(title).toHaveValue(original.title);
    await expect(description).toHaveValue(original.description);
    await expect(priority).toHaveValue(original.priority);
    await expect(vendor).toHaveValue('');
    await expect(status).toHaveValue('NEW');
    await expect(page.getByText(comment, { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Preview draft-repair.png', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `tests/maintenance/evidence/draft-cancel-${width}.png`,
      fullPage: true,
    });
  });
