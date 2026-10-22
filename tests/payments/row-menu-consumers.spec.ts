import { expect, test } from '@playwright/test';
import {
  expectAnchored,
  fixture,
  panelOf,
  prisma,
  removeFixtures,
  resetFixtures,
  signIn,
} from './fixtures';

// The shared RowMenu outside the rent roll: the lease list, the property workspace's Leases tab
// and the tenant directory, each rendered from the synthetic property so the rows always exist.
// Checks anchoring inside the viewport, stacking above neighbouring rows, Escape with focus
// returned to the trigger and that the action links target the row's own record.

const shots = 'tests/evidence/rent-roll-menu/';
const { leases, tenants, propertyId } = fixture;

test.beforeAll(resetFixtures);
test.afterAll(async () => {
  await removeFixtures();
  await prisma.$disconnect();
});

const consumers = [
  {
    name: 'lease list',
    url: `/leases?propertyId=${propertyId}`,
    trigger: `More actions for ${tenants.avery.name}`,
    link: 'Prepare renewal',
    href: new RegExp(`renew=${leases.shared}`),
  },
  {
    name: 'property leases tab',
    url: `/properties/${propertyId}/leases`,
    trigger: `More actions for ${tenants.drew.name}`,
    link: 'Prepare renewal',
    href: new RegExp(`renew=${leases.paidLater}`),
  },
  {
    name: 'tenant directory',
    url: `/tenants?q=${encodeURIComponent('Synthetic Casey')}`,
    trigger: `Actions for ${tenants.casey.name}`,
    link: 'Open ledger',
    href: new RegExp(`/leases/${leases.noContact}\\?tab=payments$`),
  },
];

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  for (const consumer of consumers) {
    test(`${consumer.name} row menu at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await signIn(page);
      await page.goto(consumer.url);
      const button = page.getByRole('button', { name: consumer.trigger, exact: true });
      await button.scrollIntoViewIfNeeded();
      await button.click();
      const panel = panelOf(page, button);
      await expect(panel).toBeVisible();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expectAnchored(panel, button);
      await page.screenshot({
        path: `${shots}consumer-${consumer.name.replace(/ /g, '-')}-${viewport.width}.png`,
        animations: 'disabled',
      });
      expect(await page.locator('.row-menu-panel:not([hidden])').count()).toBe(1);

      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(button).toBeFocused();

      await button.click();
      const link = panel.getByRole('link', { name: consumer.link });
      await expect(link).toHaveAttribute('href', consumer.href);
      await link.click();
      await expect(panel).toBeHidden();
      await expect(page).toHaveURL(consumer.href);
    });
  }
}
