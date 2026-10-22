import { expect, test, type Locator, type Page } from '@playwright/test';

// Rent-roll row menus (RowMenu): stacking above neighbouring rows, anchoring, edge placement,
// dismissal, keyboard and action targeting. Run against a throwaway seeded database only: the
// last test adds a late fee and records a $1.00 payment. Screenshots go to the ignored
// tests/evidence/rent-roll-menu/ directory.

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';
const shots = 'tests/evidence/rent-roll-menu/';

async function openPayments(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/payments');
  await expect(page.getByRole('heading', { name: 'Rent roll' })).toBeVisible();
}

const rows = (page: Page) => page.locator('tbody tr[data-lease]');
const tenantOf = async (row: Locator) => (await row.locator('strong').first().innerText()).trim();
const trigger = (row: Locator) => row.getByRole('button', { name: /^Actions for / });
/** The panel controlled by a tenant's trigger (a disclosure, so it has no role of its own). */
const menuFor = (page: Page, tenant: string) =>
  page
    .locator('.row-menu', {
      has: page.getByRole('button', { name: `Actions for ${tenant}`, exact: true }),
    })
    .locator('.row-menu-panel');
const scroller = (page: Page) => page.getByRole('region', { name: 'Rent roll' });

/** Every sampled point of the open panel hit-tests to the panel itself, not a neighbouring row. */
async function panelOnTop(menu: Locator) {
  return menu.evaluate((panel) => {
    const r = panel.getBoundingClientRect();
    const xs = [r.left + 6, r.left + r.width / 2, r.right - 6];
    const ys = [r.top + 6, r.top + r.height / 2, r.bottom - 6];
    return xs.every((x) => ys.every((y) => panel.contains(document.elementFromPoint(x, y))));
  });
}

async function geometry(menu: Locator, button: Locator) {
  const p = (await menu.boundingBox())!;
  const t = (await button.boundingBox())!;
  const viewport = menu.page().viewportSize()!;
  return { p, t, viewport };
}

async function openCount(page: Page) {
  return page.locator('.row-menu-panel:not([hidden])').count();
}

test.describe('rent-roll row menu', () => {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    test(`opens above neighbouring rows, anchored and inside the viewport at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openPayments(page);
      const first = rows(page).first();
      const tenant = await tenantOf(first);
      await first.scrollIntoViewIfNeeded();
      await trigger(first).click();
      const menu = menuFor(page, tenant);
      await expect(menu).toBeVisible();
      await expect(trigger(first)).toHaveAttribute('aria-expanded', 'true');
      expect(await panelOnTop(menu)).toBe(true);
      const bg = await menu.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toMatch(/^rgb\(/); // opaque surface, not rgba/transparent
      const { p, t } = await geometry(menu, trigger(first));
      expect(p.x).toBeGreaterThanOrEqual(8);
      expect(p.x + p.width).toBeLessThanOrEqual(viewport.width - 8 + 0.5);
      // Anchored: directly below (or above) the trigger.
      const below = Math.abs(p.y - (t.y + t.height + 4)) < 1.5;
      const above = Math.abs(p.y + p.height - (t.y - 4)) < 1.5;
      expect(below || above).toBe(true);
      await page.screenshot({
        path: `${shots}after-${viewport.width}-first-row.png`,
        animations: 'disabled',
      });

      // Last visible row: the panel is not clipped by the table's scroll container.
      await page.keyboard.press('Escape');
      await scroller(page).evaluate((el) => el.scrollTo(0, el.scrollHeight));
      const last = rows(page).last();
      await last.scrollIntoViewIfNeeded();
      const lastTenant = await tenantOf(last);
      await trigger(last).click();
      const lastMenu = menuFor(page, lastTenant);
      await expect(lastMenu).toBeVisible();
      expect(await panelOnTop(lastMenu)).toBe(true);
      const g = await geometry(lastMenu, trigger(last));
      expect(g.p.y).toBeGreaterThanOrEqual(8 - 0.5);
      expect(g.p.y + g.p.height).toBeLessThanOrEqual(viewport.height - 8 + 0.5);
      await page.screenshot({
        path: `${shots}after-${viewport.width}-last-row.png`,
        animations: 'disabled',
      });

      // Viewport bottom edge: the panel flips above the trigger instead of running off-screen.
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.scrollTo(0, 0));
      await scroller(page).evaluate((el) => el.scrollTo(0, 0));
      const edgeRow = await rows(page).evaluateAll((list) => {
        const h = document.documentElement.clientHeight;
        return list.findIndex((row) => {
          const b = row.querySelector('button[aria-controls]')!.getBoundingClientRect();
          return b.bottom > h - 70 && b.bottom < h - 8;
        });
      });
      if (edgeRow >= 0) {
        const row = rows(page).nth(edgeRow);
        await trigger(row).click();
        const edgeMenu = menuFor(page, await tenantOf(row));
        await expect(edgeMenu).toBeVisible();
        const e = await geometry(edgeMenu, trigger(row));
        expect(e.p.y + e.p.height).toBeLessThanOrEqual(e.t.y + 0.5);
        expect(await panelOnTop(edgeMenu)).toBe(true);
        await page.screenshot({
          path: `${shots}after-${viewport.width}-edge-flip.png`,
          animations: 'disabled',
        });
      }
    });
  }

  test('follows its row while scrolling, closes when the row leaves view, one menu at a time', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPayments(page);
    await rows(page).first().scrollIntoViewIfNeeded();
    const second = rows(page).nth(1);
    const tenant = await tenantOf(second);
    await trigger(second).click();
    const menu = menuFor(page, tenant);
    await expect(menu).toBeVisible();

    // Small table scroll: the panel moves with its trigger.
    await scroller(page).evaluate((el) => el.scrollBy(0, 20));
    await expect
      .poll(async () => {
        const { p, t } = await geometry(menu, trigger(second));
        return Math.round(p.y - (t.y + t.height));
      })
      .toBe(4);

    // Resize keeps it anchored.
    await page.setViewportSize({ width: 1200, height: 900 });
    await expect
      .poll(async () => {
        const { p, t } = await geometry(menu, trigger(second));
        return Math.round(p.x + p.width - (t.x + t.width));
      })
      .toBe(0);

    // Scrolling the row out of the table's view dismisses the menu.
    await scroller(page).evaluate((el) => el.scrollBy(0, 400));
    await expect(menu).toBeHidden();
    await scroller(page).evaluate((el) => el.scrollTo(0, 0));

    // Opening another row's menu closes the first; outside click closes it.
    const first = rows(page).first();
    await trigger(first).click();
    await trigger(second).click();
    expect(await openCount(page)).toBe(1);
    await expect(menuFor(page, tenant)).toBeVisible();
    await page.getByRole('heading', { name: 'Rent roll' }).click();
    expect(await openCount(page)).toBe(0);
  });

  test('keyboard: arrows, Home/End, Escape and Tab with focus restored to the trigger', async ({
    page,
  }) => {
    await openPayments(page);
    const row = rows(page)
      .filter({ has: page.locator('.badge', { hasText: 'Paid' }) })
      .first();
    const tenant = await tenantOf(row);
    const button = trigger(row);
    const menu = menuFor(page, tenant);
    const items = menu.locator(':scope > a[href], :scope > button');
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(await items.count()).toBeGreaterThan(1);
    // Disclosure: focus stays on the trigger; Tab or ArrowDown moves into the actions.
    await expect(button).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(items.last()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(items.last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('ArrowDown');
    await expect(menu).toBeVisible();
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowUp');
    await expect(menu).toBeVisible();
    await expect(items.last()).toBeFocused();
    // Tab past the last action leaves the menu and closes it.
    await page.keyboard.press('Tab');
    await expect(menu).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  test('actions target the selected lease only; dialogs open, cancel and confirm in place', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPayments(page);
    const feeRow = rows(page)
      .filter({ has: page.getByRole('button', { name: 'Add late fee', includeHidden: true }) })
      .first();
    const tenant = await tenantOf(feeRow);
    const leaseId = await feeRow.getAttribute('data-lease');
    const next = feeRow.locator('xpath=following-sibling::tr[1]');
    const nextTenant = await tenantOf(next);
    const nextLease = await next.getAttribute('data-lease');

    await feeRow.scrollIntoViewIfNeeded();
    await trigger(feeRow).click();
    const menu = menuFor(page, tenant);
    await expect(menu).toBeVisible();

    // The panel covers the next row's controls; clicking there must not reach that row.
    const url = page.url();
    const nextButton = next.getByRole('link', { name: 'Record payment' });
    if (await nextButton.count()) {
      const b = (await nextButton.boundingBox())!;
      const p = (await menu.boundingBox())!;
      const x = b.x + b.width / 2;
      const y = b.y + b.height / 2;
      if (x > p.x && x < p.x + p.width && y > p.y && y < p.y + p.height) {
        const hit = await page.evaluate(
          ([px, py]) => document.elementFromPoint(px, py)?.closest('.row-menu-panel')?.id ?? null,
          [x, y],
        );
        expect(hit).toBe(await menu.getAttribute('id'));
      }
    }
    expect(page.url()).toBe(url);

    // Open and cancel the confirmation: it names this tenant and posts this lease.
    await menu.getByRole('button', { name: 'Add late fee' }).click();
    const dialog = page.getByRole('dialog', { name: `Add late fee for ${tenant}?` });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input[name="leaseId"]')).toHaveValue(leaseId!);
    await page.screenshot({
      path: `${shots}after-1440-confirm-dialog.png`,
      animations: 'disabled',
    });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(menu.getByRole('button', { name: 'Add late fee' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // Escape inside the dialog closes only the dialog.
    await trigger(feeRow).click();
    await menu.getByRole('button', { name: 'Add late fee' }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');

    // Confirm on the synthetic seed: the fee lands on this lease only.
    await trigger(feeRow).click();
    await menu.getByRole('button', { name: 'Add late fee' }).click();
    await dialog.getByRole('button', { name: 'Add late fee' }).click();
    await expect(page.getByText('Late fee added to the tenant ledger.')).toBeVisible();
    await expect(menu).toBeHidden();
    expect(await openCount(page)).toBe(0);
    const after = page.locator(`tbody tr[data-lease="${leaseId}"]`);
    await expect(trigger(after)).toBeFocused();
    await trigger(after).click();
    await expect(menuFor(page, tenant).getByText('Late fee applied')).toBeVisible();
    await page.keyboard.press('Escape');
    const neighbour = page.locator(`tbody tr[data-lease="${nextLease}"]`);
    await trigger(neighbour).click();
    await expect(menuFor(page, nextTenant).getByText('Late fee applied')).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Record payment from the neighbouring row opens the form for that lease.
    const record = neighbour.getByRole('link', { name: 'Record payment' });
    if (await record.count()) {
      await record.click();
      await expect(page.getByRole('heading', { name: 'Record payment' })).toBeVisible();
      await expect(page.locator('#record-payment select[name="leaseId"]')).toHaveValue(nextLease!);
      await page.getByLabel('Amount').fill('1.00');
      await page.getByRole('button', { name: 'Save payment' }).click();
      await expect(page.getByText('Payment recorded and applied to the ledger.')).toBeVisible();
      await expect(
        page.locator(`tbody tr[data-lease="${nextLease}"]`).getByText('owed'),
      ).toBeVisible();
    }
  });
});
