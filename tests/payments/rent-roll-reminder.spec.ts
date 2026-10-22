import { expect, test, type Page } from '@playwright/test';
import {
  connectLiveSms,
  dispatchedReminders,
  expectAnchored,
  fixture,
  panelOf,
  payInFull,
  prisma,
  removeFixtures,
  resetFixtures,
  signIn,
} from './fixtures';

// "Send late-rent reminder" from a rent-roll row menu opens the existing /notifications review for
// that row's lease and tenant. Navigation never previews or sends; the review rechecks the ledger
// and contacts, and only an explicit confirmation records a (sandbox) attempt. Synthetic fixtures
// only; screenshots go to the ignored tests/evidence/rent-roll-menu/ directory.

const shots = 'tests/evidence/rent-roll-menu/';
const { leases, tenants } = fixture;

test.beforeEach(resetFixtures);
test.afterAll(async () => {
  await removeFixtures();
  await prisma.$disconnect();
});

async function openLateRoll(page: Page) {
  await page.goto(`/payments?filter=late&propertyId=${fixture.propertyId}`);
  await expect(page.getByRole('heading', { name: 'Rent roll' })).toBeVisible();
}

const row = (page: Page, leaseId: string) => page.locator(`tbody tr[data-lease="${leaseId}"]`);
const trigger = (page: Page, leaseId: string, tenant: string) =>
  row(page, leaseId).getByRole('button', { name: `Actions for ${tenant}`, exact: true });

/** Opens the row's menu and follows its reminder link, checking the panel stays anchored. */
async function remindFromRow(page: Page, leaseId: string, tenant: { id: string; name: string }) {
  const button = trigger(page, leaseId, tenant.name);
  await row(page, leaseId).scrollIntoViewIfNeeded();
  await button.click();
  const panel = panelOf(page, button);
  await expect(panel).toBeVisible();
  await expectAnchored(panel, button);
  const link = panel.getByRole('link', { name: 'Send late-rent reminder' });
  await expect(link).toHaveAttribute(
    'href',
    `/notifications?leaseId=${leaseId}&tenantId=${tenant.id}&from=rent-roll&propertyId=${fixture.propertyId}`,
  );
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/notifications\\?leaseId=${leaseId}&`));
  await expect(page.getByRole('heading', { name: 'Payment reminders' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Lease' })).toHaveValue(leaseId);
}

const recipient = (page: Page, name: string) =>
  page.getByRole('checkbox', { name: new RegExp(name) });

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('each row opens the review for its own lease and tenant without sending', async ({
      page,
    }) => {
      await signIn(page);
      await openLateRoll(page);
      await expect(row(page, leases.shared).locator('.badge')).toHaveText('Late');
      await expect(row(page, leases.paidLater).locator('.badge')).toHaveText('Late');

      await remindFromRow(page, leases.shared, tenants.avery);
      await expect(
        page.getByText(`Opened from the rent roll for ${tenants.avery.name}`),
      ).toBeVisible();
      await expect(page.getByLabel('Overdue charges').first()).toContainText('$1,200.00');
      // The row's tenant is preselected; the co-tenant stays an explicit choice.
      await expect(recipient(page, tenants.avery.name)).toBeChecked();
      await expect(recipient(page, tenants.blair.name)).not.toBeChecked();
      await expect(page.getByRole('heading', { name: /^Review before/ })).toHaveCount(0);
      await page.screenshot({
        path: `${shots}reminder-${viewport.width}-row-shared.png`,
        fullPage: true,
        animations: 'disabled',
      });

      // Back on the rent roll, a different row targets its own lease and tenant.
      await page.getByRole('link', { name: 'Rent roll' }).click();
      await expect(page).toHaveURL(/\/payments\?/);
      await remindFromRow(page, leases.paidLater, tenants.drew);
      await expect(page.getByLabel('Overdue charges').first()).toContainText('$1,400.00');
      await expect(recipient(page, tenants.drew.name)).toBeChecked();
      await expect(recipient(page, tenants.avery.name)).toHaveCount(0);
      await page.screenshot({
        path: `${shots}reminder-${viewport.width}-row-paid-later.png`,
        fullPage: true,
        animations: 'disabled',
      });

      // Opening the review previewed and sent nothing.
      expect(
        await prisma.paymentReminderPreview.count({
          where: { leaseId: { in: Object.values(leases) } },
        }),
      ).toBe(0);
    });

    test('review, edit and channel choice, then an explicit sandbox send with history and duplicate protection', async ({
      page,
    }) => {
      await signIn(page);
      await openLateRoll(page);
      await remindFromRow(page, leases.shared, tenants.avery);

      // Edit the email; switching to SMS and back keeps the edit.
      const subject = page.getByRole('textbox', { name: 'Subject' });
      const body = page.locator('textarea');
      await subject.fill('Synthetic overdue rent reminder');
      await body.fill('Synthetic edited reminder body for Avery.');
      await page.getByRole('radio', { name: 'Text message (SMS)' }).check();
      await expect(recipient(page, tenants.avery.name)).toBeChecked();
      await expect(page.getByText('+15005550006')).toBeVisible();
      await expect(
        page.getByText(/Synthetic Blair: (opted out|missing or invalid contact)/),
      ).toBeVisible();
      await page.getByRole('radio', { name: 'Email' }).check();
      await expect(subject).toHaveValue('Synthetic overdue rent reminder');
      await expect(page.getByText('Sandbox · not delivered').first()).toBeVisible();

      await page.getByRole('button', { name: 'Preview reminder' }).click();
      const review = page.getByRole('region', { name: /^Review before recording a sandbox test/ });
      await expect(review).toBeVisible();
      await expect(review).toContainText('Email to avery@example.invalid');
      await expect(review).toContainText('Synthetic edited reminder body for Avery.');
      await expect(review).not.toContainText('blair@example.invalid');
      expect(await dispatchedReminders(leases.shared)).toHaveLength(0);
      await page.screenshot({
        path: `${shots}reminder-${viewport.width}-review.png`,
        fullPage: true,
        animations: 'disabled',
      });

      await review.getByRole('button', { name: 'Record sandbox test · not delivered' }).click();
      await expect(
        page.getByText('Sandbox test recorded. No email or text was delivered. See history below.'),
      ).toBeVisible();
      const history = page.getByRole('region', { name: 'Reminder history' });
      await expect(history.getByText('Sandbox · not delivered')).toBeVisible();
      await expect(history.getByText('Sandbox record only · no delivery.')).toBeVisible();
      await page.screenshot({
        path: `${shots}reminder-${viewport.width}-sandbox-history.png`,
        fullPage: true,
        animations: 'disabled',
      });
      const sent = await dispatchedReminders(leases.shared);
      expect(sent).toHaveLength(1);
      expect(sent[0].attempts.map((a) => [a.recipient, a.status, a.provider])).toEqual([
        ['avery@example.invalid', 'MOCK_RECORDED', 'mock'],
      ]);

      // Opening the same row again and confirming is refused as a duplicate.
      await openLateRoll(page);
      await remindFromRow(page, leases.shared, tenants.avery);
      await expect(
        page.getByRole('region', { name: 'Reminder history' }).getByText('Sandbox · not delivered'),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Preview reminder' }).click();
      await page.getByRole('button', { name: 'Record sandbox test · not delivered' }).click();
      await expect(page.getByRole('alert').first()).toContainText(
        'A reminder for this balance and channel was already submitted today.',
      );
      expect(await dispatchedReminders(leases.shared)).toHaveLength(1);
    });

    test('a row paid after the rent roll rendered cannot be reminded', async ({ page }) => {
      await signIn(page);
      await openLateRoll(page);
      await expect(row(page, leases.paidLater).locator('.badge')).toHaveText('Late');
      await payInFull(leases.paidLater, fixture.rent.paidLater);

      // The stale Late label still links to the review, which rechecks the ledger.
      await remindFromRow(page, leases.paidLater, tenants.drew);
      await expect(page.getByRole('heading', { name: 'All caught up' })).toBeVisible();
      await expect(page.getByText(/may have been paid since the rent roll loaded/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Preview reminder' })).toHaveCount(0);
      await page.screenshot({
        path: `${shots}reminder-${viewport.width}-paid-after-render.png`,
        fullPage: true,
        animations: 'disabled',
      });

      // Paid between preview and confirmation: the send is refused as stale.
      await page.getByRole('link', { name: 'Rent roll' }).click();
      await remindFromRow(page, leases.shared, tenants.avery);
      await page.getByRole('button', { name: 'Preview reminder' }).click();
      await expect(page.getByRole('heading', { name: /^Review before/ })).toBeVisible();
      await payInFull(leases.shared, fixture.rent.shared);
      await page.getByRole('button', { name: 'Record sandbox test · not delivered' }).click();
      await expect(page.getByRole('alert').first()).toContainText(
        /changed|no longer has an overdue/,
      );
      expect(await dispatchedReminders(leases.shared)).toHaveLength(0);
    });

    test('missing contacts and an unavailable channel block the send', async ({ page }) => {
      await connectLiveSms();
      await signIn(page);
      await openLateRoll(page);

      await remindFromRow(page, leases.noContact, tenants.casey);
      await expect(page.getByText(/No eligible contacts/)).toBeVisible();
      await expect(page.getByText(/Synthetic Casey: missing or invalid contact/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Preview reminder' })).toBeDisabled();
      await page.screenshot({
        path: `${shots}reminder-${viewport.width}-missing-contact.png`,
        fullPage: true,
        animations: 'disabled',
      });

      // SMS is unavailable (a live provider is connected in sandbox mode); email still works.
      await page.getByRole('link', { name: 'Rent roll' }).click();
      await remindFromRow(page, leases.shared, tenants.avery);
      await page.getByRole('radio', { name: 'Text message (SMS)' }).check();
      await expect(page.getByText('Channel unavailable')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Preview reminder' })).toBeDisabled();
      await page.screenshot({
        path: `${shots}reminder-${viewport.width}-sms-unavailable.png`,
        fullPage: true,
        animations: 'disabled',
      });
      await page.getByRole('radio', { name: 'Email' }).check();
      await expect(page.getByRole('button', { name: 'Preview reminder' })).toBeEnabled();
      expect(
        await prisma.paymentReminderPreview.count({
          where: { leaseId: { in: Object.values(leases) } },
        }),
      ).toBe(0);
    });
  });
}

test('keyboard: the reminder action is reachable with arrows and Enter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await openLateRoll(page);
  const button = trigger(page, leases.shared, tenants.avery.name);
  const panel = panelOf(page, button);
  await button.focus();
  await page.keyboard.press('ArrowDown');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Open ledger' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(panel.getByRole('link', { name: 'Send late-rent reminder' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(button).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`leaseId=${leases.shared}`));
  await expect(recipient(page, tenants.avery.name)).toBeChecked();
});
