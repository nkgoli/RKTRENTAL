import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

for (const width of [1280, 390]) {
  test(`tenant directory, profile and validation at ${width}px`, async ({ page }) => {
    const serializationErrors: string[] = [];
    page.on('console', (message) => {
      if (/Only plain objects|Decimal objects/.test(message.text())) {
        serializationErrors.push(message.text());
      }
    });
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/tenants?view=directory&property=seed-property-maple');
    await page.getByRole('searchbox').fill('alex.rivera');
    await page.getByRole('searchbox').press('Enter');
    await expect(page).toHaveURL(/view=directory/);
    await expect(page).toHaveURL(/property=seed-property-maple/);
    await page.getByRole('link', { name: /Alex Rivera alex.rivera/ }).click();
    await expect(page.getByRole('heading', { name: 'Alex Rivera', exact: true })).toBeVisible();
    await expect(page.locator('#contact a').first()).toHaveAttribute(
      'href',
      'mailto:alex.rivera@email.com',
    );
    await expect(
      page.locator('#lease-summary').getByRole('link', { name: 'Unit 4B', exact: true }),
    ).toHaveAttribute('href', '/properties/seed-property-maple?unit=seed-unit-maple-11');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('link', { name: 'Edit profile', exact: true }).click();
    const editForm = page.locator('#edit-profile');
    await expect(editForm.getByLabel('Full name', { exact: true })).toHaveValue('Alex Rivera');
    expect(serializationErrors).toEqual([]);
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await editForm.getByLabel('Full name', { exact: true }).fill('');
    await editForm.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(editForm.locator('[name=name]')).toBeFocused();
    await expect(editForm.locator('[name=name]')).toHaveAttribute('aria-invalid', 'true');
    await editForm.getByRole('link', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Alex Rivera', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Back to tenants' }).click();
    await expect(page).toHaveURL(/q=alex.rivera/);
    await page.getByRole('link', { name: 'Status', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tenant status' })).toBeVisible();
    const checklist = page.getByRole('region', { name: 'Tenant setup checklist' });
    if (width === 390)
      expect(await checklist.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.getByRole('link', { name: '+ Add tenant', exact: true }).click();
    await page
      .locator('#add-tenant')
      .getByRole('button', { name: 'Save tenant', exact: true })
      .click();
    await expect(page.locator('#add-tenant [name=name]')).toBeFocused();
    await expect(page.locator('#add-tenant [name=name]')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#add-tenant [name=propertyId]')).toHaveValue('seed-property-maple');
    expect((await new AxeBuilder({ page }).include('#add-tenant').analyze()).violations).toEqual(
      [],
    );
    await page.goto('/tenants?q=zz-no-match-ux');
    await expect(page.getByRole('heading', { name: 'No tenants match this view' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`applicant review retains scope and consent at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/properties/seed-property-maple/applications?unit=seed-unit-maple-7');
    await page.getByText('Application settings', { exact: true }).first().click();
    await expect(page.getByRole('combobox', { name: 'Screening reports' })).toBeVisible();
    await page.getByRole('link', { name: /Rohan Das/ }).click();
    await expect(page).toHaveURL(/propertyId=seed-property-maple/);
    await expect(page).toHaveURL(/unitId=seed-unit-maple-7/);
    await expect(page.getByRole('heading', { name: 'Rohan Das', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run screening', exact: true })).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Back to property applications' })).toHaveAttribute(
      'href',
      '/properties/seed-property-maple/applications?unit=seed-unit-maple-7',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('textbox', { name: 'Search applicants or units' }).fill('zz-no-match-ux');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('heading', { name: 'No applications in this view' })).toBeVisible();
    await page.getByRole('link', { name: 'Clear filters', exact: true }).first().click();
    await expect(page).toHaveURL(/unitId=seed-unit-maple-7/);
    await page.goto('/applications?applicant=unavailable-applicant');
    await expect(
      page.getByRole('heading', { name: 'Applicant unavailable in this view' }),
    ).toBeVisible();
    await page.goto('/applications?applicant=seed-application-nina#selected-applicant');
    await page.getByRole('combobox', { name: 'Decision reason' }).selectOption('criteria-met');
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Decline', exact: true })).toBeDisabled();
    await page
      .getByRole('combobox', { name: 'Decision reason' })
      .selectOption('credit-below-criteria');
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Decline', exact: true })).toBeEnabled();
  });
}
