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
    await page.getByLabel('Email address').fill('maintenance-pages@example.test');
    await page.getByLabel('Password', { exact: true }).fill('MaintenanceTest#2026');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/dashboard');
    await page.goto('/maintenance');
    await page.getByRole('link', { name: 'New request', exact: true }).click();
    const form = page.getByRole('form', { name: 'Create repair request', exact: true });
    await expect(form).toBeVisible();
    await page.getByLabel('Request title', { exact: true }).fill('Cancelled global draft');
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    await page.waitForURL('**/maintenance');
    await expect(page.getByText('Cancelled global draft', { exact: true })).toHaveCount(0);
    const scope = `/properties/${fixture}/maintenance?unit=${unit}`;
    await page.goto(scope);
    await page.getByRole('link', { name: '+ New request', exact: true }).click();
    await expect(form).toBeVisible();
    await expect(page.getByLabel('Property and unit')).toHaveValue(unit);
    await page.getByLabel('Request title', { exact: true }).fill('   ');
    await page.getByLabel('Description', { exact: true }).fill('Keep draft after validation');
    await page.getByRole('button', { name: 'Create request', exact: true }).click();
    const error = page.getByRole('alert').filter({ hasText: 'Title is required' });
    await expect(error).toBeFocused();
    await expect(page.getByLabel('Description', { exact: true })).toHaveValue(
      'Keep draft after validation',
    );
    const title = `Synthetic repair ${width} ${Date.now()} ${'long issue title '.repeat(6)}`.trim();
    await page.getByLabel('Request title', { exact: true }).fill(title);
    await page
      .getByLabel('Description', { exact: true })
      .fill('Long create issue details and access instructions. '.repeat(50));
    await page.getByLabel('Priority', { exact: true }).selectOption('HIGH');
    await page.getByLabel('Choose a file').setInputFiles(photo);
    await page
      .getByRole('button', { name: 'Create request', exact: true })
      .scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const createBox = await form.boundingBox();
    expect(createBox!.width).toBeGreaterThan(width === 1440 ? 800 : 330);
    await page.getByRole('button', { name: 'Create request', exact: true }).focus();
    await expect(page.getByRole('button', { name: 'Create request', exact: true })).toBeFocused();
    await page.screenshot({
      path: `tests/maintenance/evidence/automated-create-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Create request', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Repair request created.');
    await page.getByRole('status').getByRole('link').click();
    await page.waitForURL(`**${scope}#request-*`);
    const details = page.locator('details').filter({ hasText: title });
    await details.locator('summary').click();
    await details.getByRole('link', { name: 'Edit request', exact: true }).click();
    await expect(page.getByLabel('Request title', { exact: true })).toHaveValue(title);
    const edit = page.url();
    await page.getByLabel('Request title', { exact: true }).fill(`${title} edited`);
    await page
      .getByLabel('Description', { exact: true })
      .fill('Long issue details and access instructions. '.repeat(55));
    await page.getByLabel('Priority', { exact: true }).selectOption('URGENT');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Repair request saved.' }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Request title', { exact: true })).toHaveValue(`${title} edited`);
    await expect(page.getByLabel('Description', { exact: true })).toHaveValue(
      'Long issue details and access instructions. '.repeat(55).trim(),
    );
    await expect(page.getByLabel('Priority', { exact: true })).toHaveValue('URGENT');
    await expect(page.getByRole('link', { name: /Open photo/ })).toHaveCount(1);
    await page.locator('select[name=vendorId]').selectOption('maintenance-pages-vendor');
    await page.getByRole('button', { name: 'Assign', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Vendor assigned.' })).toBeVisible();
    await page.locator('select[name=status]').selectOption('IN_PROGRESS');
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Status updated.' })).toBeVisible();
    await page.locator('textarea[name=comment]').fill('Retained activity');
    await page.getByRole('button', { name: 'Add comment', exact: true }).click();
    await expect(page.getByText('Retained activity', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('select[name=status]')).toHaveValue('IN_PROGRESS');
    await expect(page.locator('select[name=vendorId]')).toHaveValue('maintenance-pages-vendor');
    await expect(page.getByText('Retained activity', { exact: true })).toBeVisible();
    await page
      .getByLabel('Description', { exact: true })
      .fill('Long issue details with retained activity. '.repeat(55));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Repair request saved.' }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText('Retained activity', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Open photo/ })).toHaveCount(1);
    await expect(page.locator('select[name=status]')).toHaveValue('IN_PROGRESS');
    const editForm = page.getByRole('form', { name: 'Edit repair request', exact: true });
    const editBox = await editForm.boundingBox();
    const activityBox = await page
      .getByRole('heading', { name: 'Assignment, status & activity' })
      .locator('..')
      .boundingBox();
    expect(editBox!.width).toBeGreaterThan(width === 1440 ? 800 : 330);
    expect(Math.abs(editBox!.width - activityBox!.width)).toBeLessThan(2);
    expect(Math.abs(editBox!.x - activityBox!.x)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Save changes' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Save changes' }).focus();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeFocused();
    await page.screenshot({
      path: `tests/maintenance/evidence/automated-edit-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel('Request title', { exact: true }).fill('Cancel must not write');
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    await page.waitForURL(`**${scope}`);
    await page.goto(edit);
    await expect(page.getByLabel('Request title', { exact: true })).toHaveValue(`${title} edited`);
    await page.goto('/maintenance/new?propertyId=seed-property-maple');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('form')).toHaveCount(0);
    await page.goto('/maintenance/foreign-request/edit');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('form')).toHaveCount(0);
  });
