import { expect, test } from '@playwright/test';

const fixture = 'maintenance-pages-property';
const unit = 'maintenance-pages-unit';
const photo = {
  name: 'repair.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  ),
};

for (const width of [1440, 390])
  test(`dedicated maintenance forms at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto('/sign-in');
    await page
      .getByRole('textbox', { name: 'Email address', exact: true })
      .fill('maintenance-pages@example.test');
    await page.getByLabel('Password', { exact: true }).fill('MaintenanceTest#2026');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/dashboard');
    await page.goto('/maintenance');
    await page.getByRole('link', { name: 'New request', exact: true }).click();
    const form = page.getByRole('form', { name: 'Create repair request', exact: true });
    await expect(form).toBeVisible();
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Cancelled global draft');
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    await page.waitForURL('**/maintenance');
    await expect(page.getByText('Cancelled global draft', { exact: true })).toHaveCount(0);

    const scope = `/properties/${fixture}/maintenance?unit=${unit}`;
    await page.goto(scope);
    await page
      .getByRole('link', { name: /^(\+ New request|Create your first request)$/, exact: true })
      .click();
    await expect(form).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Unit', exact: true })).toHaveValue(unit);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('   ');
    await page
      .getByRole('textbox', { name: 'Description', exact: true })
      .fill('Keep draft after validation');
    await page.getByRole('button', { name: 'Save request', exact: true }).click();
    const error = form.getByRole('alert').filter({ hasText: 'Title is required' });
    await expect(error).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(
      'Keep draft after validation',
    );
    const title = `Synthetic repair ${width} ${Date.now()} ${'long issue title '.repeat(6)}`.trim();
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
    await page
      .getByRole('textbox', { name: 'Description', exact: true })
      .fill('Long create issue details and access instructions. '.repeat(50));
    await page.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('HIGH');
    await page.getByLabel('Request photo', { exact: true }).setInputFiles(photo);
    const createButton = page.getByRole('button', { name: 'Save request', exact: true });
    await createButton.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const createBox = await form.boundingBox();
    expect(createBox!.width).toBeGreaterThan(width === 1440 ? 600 : 330);
    await createButton.focus();
    await expect(createButton).toBeFocused();
    await page.screenshot({
      path: `tests/maintenance/evidence/automated-create-${width}.png`,
      fullPage: true,
    });
    await createButton.click();
    await expect(form.getByRole('status')).toContainText('Repair request created.');
    await form.getByRole('link', { name: 'Back to repair requests', exact: true }).click();
    await page.waitForURL(`**${scope}#request-*`);
    await page.getByRole('link', { name: title, exact: true }).click();

    const requestTitle = page.getByRole('textbox', { name: 'Title', exact: true });
    const description = page.getByRole('textbox', { name: 'Description', exact: true });
    const priority = page.getByRole('combobox', { name: 'Priority', exact: true });
    const vendor = page.getByRole('combobox', { name: 'Assign vendor', exact: true });
    const status = page.getByRole('combobox', { name: 'Status', exact: true });
    const save = page.getByRole('button', { name: 'Save changes', exact: true }).first();
    await expect(requestTitle).toHaveValue(title);
    const edit = page.url();
    const editedTitle = `${title} edited`;
    const editedDescription = 'Long issue details and access instructions. '.repeat(55).trim();
    await requestTitle.fill(editedTitle);
    await description.fill(editedDescription);
    await priority.selectOption('URGENT');
    await vendor.selectOption('maintenance-pages-vendor');
    await status.selectOption('IN_PROGRESS');
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
    await save.click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Request saved.' }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(requestTitle).toHaveValue(editedTitle);
    await expect(description).toHaveValue(editedDescription);
    await expect(priority).toHaveValue('URGENT');
    await expect(vendor).toHaveValue('maintenance-pages-vendor');
    await expect(status).toHaveValue('IN_PROGRESS');
    await expect(page.getByRole('button', { name: 'Preview repair.png', exact: true })).toHaveCount(
      1,
    );
    await page.getByRole('button', { name: 'Preview repair.png', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'repair.png', exact: true });
    await expect(preview.getByRole('img', { name: 'repair.png', exact: true })).toBeVisible();
    await page.screenshot({
      path: `tests/maintenance/evidence/automated-preview-${width}.png`,
      fullPage: true,
    });
    await preview.getByRole('button', { name: 'Close', exact: true }).click();

    await page
      .getByRole('textbox', { name: 'Add a comment', exact: true })
      .fill('Retained activity');
    await page.getByRole('button', { name: 'Post comment', exact: true }).click();
    await expect(page.getByText('Retained activity', { exact: true })).toBeVisible();
    await page.reload();
    await expect(status).toHaveValue('IN_PROGRESS');
    await expect(vendor).toHaveValue('maintenance-pages-vendor');
    await expect(page.getByText('Retained activity', { exact: true })).toBeVisible();
    await description.fill('Long issue details with retained activity. '.repeat(55));
    await save.click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Request saved.' }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText('Retained activity', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview repair.png', exact: true })).toHaveCount(
      1,
    );
    await expect(status).toHaveValue('IN_PROGRESS');

    const editForm = page.getByRole('form', { name: 'Edit repair request', exact: true });
    const editBox = await editForm.boundingBox();
    const detailsBox = await page
      .getByRole('region', { name: 'Request details', exact: true })
      .boundingBox();
    const activityBox = await page
      .getByRole('region', { name: /^Activity \d+$/, exact: true })
      .boundingBox();
    // Designs/redisgn: request details on the left (2fr), activity in the right column (1fr);
    // phones stack activity below the details card.
    expect(editBox!.width).toBeGreaterThan(width === 1440 ? 560 : 300);
    if (width === 1440) {
      expect(activityBox!.x).toBeGreaterThan(detailsBox!.x + detailsBox!.width);
      expect(detailsBox!.width).toBeGreaterThan(activityBox!.width * 1.5);
    } else {
      expect(activityBox!.y).toBeGreaterThan(detailsBox!.y + detailsBox!.height);
      expect(Math.abs(detailsBox!.width - activityBox!.width)).toBeLessThan(2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `tests/maintenance/evidence/automated-edit-${width}.png`,
      fullPage: true,
    });

    await requestTitle.fill('Cancel must not write');
    await save.scrollIntoViewIfNeeded();
    await save.focus();
    await expect(save).toBeFocused();
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    await page
      .getByRole('dialog', { name: 'Discard unsaved changes?', exact: true })
      .getByRole('button', { name: 'Discard changes', exact: true })
      .click();
    await page.waitForURL(`**${scope}`);
    await page.goto(edit);
    await expect(requestTitle).toHaveValue(editedTitle);
    await status.selectOption('CANCELLED');
    await save.click();
    const cancellation = page.getByRole('dialog', {
      name: 'Cancel this repair request?',
      exact: true,
    });
    await cancellation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
    await save.click();
    await cancellation
      .getByRole('button', { name: 'Save and cancel request', exact: true })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Request saved.' }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(status).toHaveValue('CANCELLED');
    await expect(page.getByText('Retained activity', { exact: true })).toBeVisible();

    await page.goto('/maintenance/new?propertyId=seed-property-maple');
    await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
    await expect(page.getByRole('form')).toHaveCount(0);
    await page.goto('/maintenance/foreign-request/edit');
    await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
    await expect(page.getByRole('form')).toHaveCount(0);
  });
