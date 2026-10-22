import { expect, test, type Page } from '@playwright/test';
import { tenantLifecycleFixture } from './lifecycle-fixture';

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('manager lists and searches tenants and is led to Applications to add one', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/tenants');
  await expect(page.getByRole('heading', { name: 'Tenant directory', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Tenant views' })).toBeVisible();
  await page.getByRole('link', { name: 'Directory', exact: true }).click();
  await expect(page).toHaveURL(/\/tenants(?:\?view=directory)?$/);
  await expect(page.getByRole('link', { name: /Alex Rivera/ }).first()).toBeVisible();

  const search = page.getByRole('searchbox', { name: 'Name, email, phone or unit' });
  await search.pressSequentially('priya', { delay: 30 });
  await search.press('Enter');
  await expect(page).toHaveURL(/q=priya/);
  await expect(page.getByRole('link', { name: /Priya Shah/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Alex Rivera/ })).toHaveCount(0);

  // Tenants come from approved applicants; the directory offers Applications, not a form.
  await page.goto('/tenants?view=directory&add=1');
  await expect(page).toHaveURL(/\/applications$/);
  await expect(page.getByRole('heading', { name: 'Applications', level: 1 })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search applicants or units' })).toBeVisible();
  await page.goto('/tenants?view=directory');
  await expect(page.locator('#add-tenant')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Review applications', exact: true }),
  ).toHaveAttribute('href', '/applications');
});

test('tenant detail shows lease summary linking to the lease', async ({ page }) => {
  await signIn(page);
  await page.goto('/tenants?view=directory&q=alex.rivera');
  await page
    .getByRole('link', { name: /Alex Rivera/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/tenants\/seed-tenant-maple-11(\?|$)/);
  await expect(page.getByRole('heading', { name: 'Alex Rivera', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lease summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payment history' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View lease' }).first()).toHaveAttribute(
    'href',
    '/leases/seed-lease-maple-11',
  );
});

for (const width of [1280, 390]) {
  test(`manager promotes, edits and moves a tenant in and out at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const fixture = await tenantLifecycleFixture(width);
    const editedName = `Lifecycle Tenant ${width}`;
    const editedEmail = fixture.email.replace('tenant.lifecycle.', 'tenant.edited.');
    const note = `Synthetic lifecycle note at ${width}px`;
    try {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page);
      await page.goto(
        `/applications?${new URLSearchParams({
          propertyId: fixture.propertyId,
          unitId: fixture.unitId,
          applicant: fixture.applicationId,
        })}#selected-applicant`,
      );
      await expect(page.getByRole('heading', { name: 'Applications', level: 1 })).toBeVisible();
      await expect(page.getByRole('heading', { name: fixture.name, exact: true })).toBeVisible();
      const promotion = page.getByRole('region', { name: 'Tenant promotion' });
      await promotion.getByRole('button', { name: 'Promote to tenant', exact: true }).click();
      await expect(promotion.getByRole('link', { name: 'View tenant', exact: true })).toBeVisible();

      const promoted = await fixture.snapshot();
      expect(promoted.tenantId).toBeTruthy();
      expect(promoted.promotedBy).toBe('seed-jordan-mills');
      expect(promoted.promotedAt).not.toBeNull();
      expect(promoted).toMatchObject({
        unitStatus: 'VACANT',
        leaseCount: 0,
        consentCount: 0,
        reportCount: 0,
        chargeCount: 0,
        paymentCount: 0,
        autopayCount: 0,
        tenant: { emailRemindersEnabled: false, smsRemindersEnabled: false },
      });
      const tenantId = promoted.tenantId!;
      await promotion.getByRole('link', { name: 'View tenant', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/tenants/${tenantId}(\\?|$)`));
      await expect(page.getByText('Not assigned to a unit', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Move in', exact: true })).toHaveCount(0);
      await page.screenshot({
        path: `tests/tenants/evidence/lifecycle-promoted-${width}.png`,
        fullPage: true,
      });

      await page.getByRole('link', { name: 'Edit profile', exact: true }).click();
      const edit = page.locator('#edit-profile');
      await edit.getByLabel('Full name', { exact: true }).fill(editedName);
      await edit.getByLabel('Email', { exact: true }).fill(editedEmail);
      await edit
        .getByLabel('Emergency contact', { exact: true })
        .fill('Synthetic Emergency Contact');
      await edit.getByLabel('Relationship', { exact: true }).fill('Sibling');
      await edit.getByRole('button', { name: 'Save changes', exact: true }).click();
      // Do not reload: this checks the production server-action redirect actually completes.
      await expect(page.locator('#edit-profile')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: editedName, level: 1 })).toBeVisible();
      await expect(page.locator('#contact').getByRole('link', { name: editedEmail })).toBeVisible();
      await expect(page.locator('#contact')).toContainText('Sibling');
      await page.getByLabel('Note', { exact: true }).fill(note);
      await page.getByRole('button', { name: 'Save note', exact: true }).click();
      await expect(page.locator('#tenant-history').getByText(note, { exact: true })).toBeVisible();
      await page.screenshot({
        path: `tests/tenants/evidence/lifecycle-edited-${width}.png`,
        fullPage: true,
      });

      // Deliberately establish a lease only after proving promotion has no lease side effects.
      await fixture.createDraftLease(tenantId);
      await page.reload();
      await expect(
        page.locator('#lease-summary').getByText('Draft', { exact: true }),
      ).toBeVisible();
      expect(await fixture.snapshot()).toMatchObject({
        unitStatus: 'VACANT',
        leaseStatus: 'DRAFT',
        chargeCount: 0,
      });
      await page.getByRole('button', { name: 'Move in', exact: true }).click();
      await expect(
        page.locator('#lease-summary').getByText('Active', { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Record move-out', exact: true }),
      ).toBeVisible();
      expect(await fixture.snapshot()).toMatchObject({
        unitStatus: 'OCCUPIED',
        leaseStatus: 'ACTIVE',
      });
      await page.screenshot({
        path: `tests/tenants/evidence/lifecycle-moved-in-${width}.png`,
        fullPage: true,
      });

      await page.getByRole('button', { name: 'Record move-out', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: `Move ${editedName} out?` });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      expect(await fixture.snapshot()).toMatchObject({
        unitStatus: 'OCCUPIED',
        leaseStatus: 'ACTIVE',
      });
      await page.getByRole('button', { name: 'Record move-out', exact: true }).click();
      await dialog.getByRole('button', { name: 'Record move-out', exact: true }).click();
      await expect(page.getByText('This tenant has moved out.', { exact: true })).toBeVisible();
      await expect(
        page.locator('#lease-summary').getByText('Ended', { exact: true }),
      ).toBeVisible();
      await expect(page.locator('#tenant-history').getByText(note, { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: editedName, level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const movedOut = await fixture.snapshot();
      expect(movedOut).toMatchObject({
        tenantId,
        unitStatus: 'VACANT',
        leaseStatus: 'ENDED',
        leaseCount: 1,
        consentCount: 0,
        reportCount: 0,
        paymentCount: 0,
        autopayCount: 0,
        tenant: { name: editedName, email: editedEmail, emergencyContactRelationship: 'Sibling' },
      });
      expect(movedOut.chargeCount).toBeGreaterThan(0);
      expect(movedOut.tenant?.notes.map((row) => row.body)).toContain(note);
      await page.screenshot({
        path: `tests/tenants/evidence/lifecycle-moved-out-${width}.png`,
        fullPage: true,
      });
      await testInfo.attach('tenant-lifecycle-database-evidence', {
        body: JSON.stringify({ promoted, movedOut }, null, 2),
        contentType: 'application/json',
      });
    } finally {
      await fixture.cleanup();
    }
  });
}
