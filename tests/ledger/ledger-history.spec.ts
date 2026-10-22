import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { db, lease, prepareLedgerFixtures, propertyId, unit } from './ledger-review-fixtures';

/**
 * Rent ledger targeting and history in a real browser against the isolated review database:
 * Record payment keeps the originating lease (two ACTIVE terms on one unit), stale targets never
 * select another lease, and ended-only and payment-only history stay discoverable.
 */
test.describe.configure({ mode: 'serial', timeout: 90_000 });
const evidence = '.playwright-mcp/ledger-history';
const payments = (unitId?: string, extra = '') =>
  `/properties/${propertyId}/payments${unitId ? `?unit=${unitId}${extra}` : ''}`;

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
  await page.getByLabel('Password', { exact: true }).fill('JordanDemo#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function capture(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
}
const money = (text: string | null) => Number((text ?? '').replace(/[^0-9.]/g, ''));

test.beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  await prepareLedgerFixtures();
});
test.afterAll(async () => {
  await db.$disconnect();
});

for (const width of [1280, 390]) {
  test.describe(`${width}px Rent ledger`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 900 } });
    test.beforeEach(async ({ page }) => signIn(page));

    test('Record payment from a lease keeps that exact term', async ({ page }) => {
      for (const id of [lease.now, lease.next]) {
        await page.goto(`/leases/${id}?tab=payments`);
        const record = page.getByRole('link', { name: 'Record payment', exact: true });
        await expect(record).toHaveAttribute('href', payments(unit.terms, `&record=1&lease=${id}`));
        await record.click();
        const dialog = page.getByRole('dialog', { name: 'Record payment' });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('combobox', { name: 'Lease' })).toHaveValue(id);
        await expect(dialog.getByRole('alert')).toHaveCount(0);
        await capture(page, `record-${id === lease.now ? 'current' : 'renewal'}-${width}`);
      }
      // Save from the current (older) term: the payment lands on it, never on the renewal.
      await page.goto(`/leases/${lease.now}?tab=payments`);
      await page.getByRole('link', { name: 'Record payment', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Record payment' });
      await dialog.getByRole('textbox', { name: /^Amount/ }).fill(width === 390 ? '12.34' : '43.21');
      await dialog.getByRole('button', { name: 'Save payment' }).click();
      await expect(page.getByText('Payment recorded and applied to the ledger.')).toBeVisible();
      const recorded = await db.payment.findMany({
        where: { leaseId: { in: [lease.now, lease.next] } },
      });
      expect(recorded.map((p) => [p.leaseId, p.amount.toString()])).toContainEqual([
        lease.now,
        width === 390 ? '12.34' : '43.21',
      ]);
      expect(recorded.some((p) => p.leaseId === lease.next)).toBe(false);
    });

    test('stale and foreign targets never select another lease', async ({ page }) => {
      for (const target of [lease.ended, 'seed-lease-maple-1', 'not-a-lease']) {
        await page.goto(payments(unit.terms, `&record=1&lease=${target}`));
        const dialog = page.getByRole('dialog', { name: 'Record payment' });
        await expect(dialog.getByRole('alert')).toContainText('can no longer take payments here');
        const select = dialog.getByRole('combobox', { name: 'Lease' });
        await expect(select).toHaveValue('');
        await dialog.getByRole('textbox', { name: /^Amount/ }).fill('5.00');
        await dialog.getByRole('button', { name: 'Save payment' }).click();
        // The required lease choice blocks submission; nothing is recorded silently.
        await expect(dialog).toBeVisible();
        expect(await select.evaluate((el: HTMLSelectElement) => el.validity.valueMissing)).toBe(
          true,
        );
      }
      await capture(page, `stale-target-${width}`);
      expect(await db.payment.count({ where: { amount: '5.00', leaseId: { in: Object.values(lease) } } })).toBe(0);
    });

    test('property summary keeps ended-only units outside Balance due', async ({ page }) => {
      await page.goto(payments());
      const table = page.getByRole('table', { name: 'Unit balances' });
      const ended = table.getByRole('row').filter({ hasText: 'Ended 2' });
      await expect(ended.getByText('Ended', { exact: true })).toBeVisible();
      await expect(ended).toContainText('$500.00 on ended lease');
      await expect(ended).toContainText('Previous tenant');
      await expect(table.getByRole('row').filter({ hasText: 'Credit 3' })).toContainText(
        '$100.00 credit on ended lease',
      );
      await expect(page.getByTestId('occupied-units')).toHaveText(
        '1 occupied unit · 2 with ended leases only',
      );
      const total = money(await table.locator('tfoot').textContent());
      expect(total).toBe(money(await page.getByTestId('balance').textContent()));
      await capture(page, `summary-ended-only-${width}`);
      // Keyboard: the ended unit's ledger opens from its link.
      await ended.getByRole('link', { name: 'Ended 2', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(payments(unit.ended));
      await expect(page.getByTestId('balance')).toHaveText('$0.00');
      await expect(page.getByTestId('ended-balance')).toContainText('$500.00');
      const group = page.getByRole('button', { name: /Gale Ended/ });
      await expect(group).toHaveAttribute('aria-expanded', 'false');
      await group.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('list', { name: 'Gale Ended' })).toContainText('December rent');
      await page.getByText('Payment history (1 payment)').click();
      await expect(page.getByRole('list', { name: 'Payments on Ended 2 · Gale Ended' })).toContainText(
        'Rent · Dec 2025',
      );
      await capture(page, `unit-ended-history-${width}`);
    });

    test('payment-only history shows its credit in unit and lease views', async ({ page }) => {
      await page.goto(payments(unit.credit));
      const group = page.getByRole('button', { name: /Pat Credit/ });
      await expect(group).toContainText('Credit $100.00');
      await group.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByText('No charges on this lease · $100.00 credit.')).toBeVisible();
      const history = page.getByRole('list', { name: 'Payments on Credit 3 · Pat Credit' });
      await expect(history).toContainText('Jun 1, 2025');
      await expect(history).toContainText('$100.00 credit');
      await capture(page, `unit-credit-history-${width}`);
      await page.goto(`/leases/${lease.credit}?tab=payments`);
      await expect(page.getByText('Credit on account', { exact: true })).toBeVisible();
      await expect(page.getByTestId('balance')).toHaveText('$100.00');
      await expect(page.getByRole('list', { name: /Payments on/ })).toContainText('$100.00 credit');
      await expect(page.getByRole('link', { name: 'Record payment', exact: true })).toHaveCount(0);
      await capture(page, `lease-credit-history-${width}`);
    });

    test('lease and unit scopes report the same balance for a term', async ({ page }) => {
      await page.goto(`/leases/${lease.now}?tab=payments`);
      const leaseBalance = await page.getByTestId('balance').textContent();
      await page.goto(payments(unit.terms));
      const group = page.getByRole('button', { name: /Sam Review .*2026 \(/ });
      await expect(group).toContainText(`Balance ${leaseBalance}`);
      await capture(page, `unit-two-terms-${width}`);
    });
  });
}
