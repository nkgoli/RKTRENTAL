import { expect, test, type Page } from '@playwright/test';
import { applicantWizardFixture } from '../applications/wizard-fixture';

async function tenantsStep(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Lease term', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Rent, deposit & fees', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tenants', exact: true })).toBeVisible();
}

for (const width of [1280, 390]) {
  test(`general and legacy applicant selection preserve promotion identity at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const fixture = await applicantWizardFixture(width);
    const shots = 'tests/lease-create/evidence';
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/sign-in');
      await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
      await page
        .getByLabel('Password', { exact: true })
        .fill(process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/);

      // No applicant parameter: choosing the visible applicant must use their saved tenant ID.
      await tenantsStep(page, `/leases/new?unit=${fixture.unitId}&fresh=1`);
      const applicants = page.getByRole('region', { name: 'Applicants for this unit' });
      await applicants.getByRole('checkbox', { name: fixture.name, exact: true }).check();
      await expect(page.getByRole('combobox', { name: 'Primary tenant', exact: true })).toHaveValue(
        fixture.tenantId,
      );
      await expect(
        page.getByRole('button', { name: `Remove ${fixture.tenantName}`, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: `Remove ${fixture.collision.name}`, exact: true }),
      ).toHaveCount(0);
      for (const applicant of fixture.pending) {
        await expect(
          applicants.getByRole('checkbox', { name: applicant.applicantName }),
        ).toHaveCount(0);
        await expect(
          applicants.getByRole('link', { name: `Review ${applicant.applicantName}'s application` }),
        ).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `${shots}/applicant-promotion-general-${width}.png`,
        fullPage: true,
      });

      // Keyboard review must save the unsaved selection and render the actual scoped review body.
      const unpromoted = fixture.pending[1];
      const review = applicants.getByRole('link', {
        name: `Review ${unpromoted.applicantName}'s application`,
      });
      await review.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(
        new RegExp(
          `/applications\\?propertyId=${fixture.propertyId}&unitId=${fixture.unitId}&applicant=${unpromoted.id}#selected-applicant$`,
        ),
      );
      await expect(page.getByRole('heading', { name: 'Applications', level: 1 })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: unpromoted.applicantName, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Applicant review', exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `${shots}/applicant-promotion-review-${width}.png`,
        fullPage: true,
      });
      const drafts = await fixture.drafts();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].data).toMatchObject({
        draft: { tenantIds: [fixture.tenantId], primaryTenantId: fixture.tenantId },
      });
      await page.goto(`/leases/new?draft=${drafts[0].leaseId}`);
      await expect(page.getByRole('heading', { name: 'Tenants', exact: true })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Primary tenant', exact: true })).toHaveValue(
        fixture.tenantId,
      );
      await expect(page.getByRole('status')).toHaveText('Draft saved');

      // Legacy applicant links retain the same association after the contact email edit.
      await tenantsStep(page, `/leases/new?applicant=${fixture.applicationId}&fresh=1`);
      await expect(page.getByRole('combobox', { name: 'Primary tenant', exact: true })).toHaveValue(
        fixture.tenantId,
      );
      await page.screenshot({
        path: `${shots}/applicant-promotion-legacy-${width}.png`,
        fullPage: true,
      });

      // A legacy unpromoted link cannot select the same-email tenant; its notice routes to review.
      await tenantsStep(page, `/leases/new?applicant=${unpromoted.id}&fresh=1`);
      await expect(page.getByRole('combobox', { name: 'Primary tenant', exact: true })).toHaveValue(
        '',
      );
      await expect(
        page.getByText(/needs an approved application and explicit promotion/),
      ).toBeVisible();
      const noticeLink = page.getByRole('link', { name: 'Review application', exact: true });
      await noticeLink.focus();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('heading', { name: unpromoted.applicantName, exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `${shots}/applicant-promotion-legacy-review-${width}.png`,
        fullPage: true,
      });
      await testInfo.attach('applicant-promotion-selection', {
        body: JSON.stringify({
          tenantId: fixture.tenantId,
          collisionId: fixture.collision.id,
          draft: drafts[0],
        }),
        contentType: 'application/json',
      });
    } finally {
      await fixture.cleanup();
    }
  });
}
