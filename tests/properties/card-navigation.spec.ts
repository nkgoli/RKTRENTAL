import { expect, test, type Locator, type Page } from '@playwright/test';

// Every property card must open its own workspace. Multi-unit cards used to stay on the
// directory in production builds: the detail segment suspended inside the already-visible
// manager loading boundary, and React dropped a ping that arrived mid-render. `next dev` does
// not reproduce it, so run this against a production server too:
//   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test --project=properties card-navigation

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';

type CardInfo = { href: string; name: string; address: string };

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const cardsIn = (page: Page) =>
  page.getByRole('region', { name: 'Property directory' }).locator(':scope > a');

async function openDirectory(page: Page, query = '') {
  await page.goto(`/properties${query}`);
  await page.waitForLoadState('networkidle');
  await expect(cardsIn(page).first()).toBeVisible();
}

/** Reads every card's own link target, name and address from the rendered directory. */
async function readCards(page: Page): Promise<CardInfo[]> {
  return cardsIn(page).evaluateAll((links) =>
    links.map((a) => ({
      href: a.getAttribute('href') ?? '',
      name: a.querySelector('h3')?.textContent?.trim() ?? '',
      address: a.querySelector('h3 + span')?.textContent?.trim() ?? '',
    })),
  );
}

const cardFor = (page: Page, card: CardInfo) =>
  cardsIn(page).and(page.locator(`[href="${card.href}"]`));

async function expectWorkspace(page: Page, card: CardInfo) {
  await expect(page).toHaveURL(new RegExp(`${card.href}$`), { timeout: 10_000 });
  await expect(page.getByRole('heading', { level: 1, name: card.name })).toBeVisible();
  await expect(page.getByText(card.address, { exact: true }).first()).toBeVisible();
  // The workspace body streams in behind the property's loading boundary; it must finish.
  await expect(page.getByLabel('Loading page')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText(/Units & lease terms|Lease timeline/).first()).toBeVisible();
}

async function returnToDirectory(page: Page, query = '') {
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/properties${query.replace('?', '\\?')}$`));
  await expect(cardsIn(page).first()).toBeVisible();
}

/** Tabs through the page until the card has keyboard focus. */
async function tabTo(page: Page, card: Locator) {
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    if (await card.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error('Card never received keyboard focus');
}

test.describe('property cards on desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("mouse clicks on the cover, title and body open each card's own property", async ({
    page,
  }) => {
    await signIn(page);
    await openDirectory(page);
    const cards = await readCards(page);
    expect(cards.length).toBeGreaterThanOrEqual(4);
    expect(new Set(cards.map((c) => c.href)).size).toBe(cards.length);

    for (const card of cards) {
      for (const area of ['cover', 'title', 'body'] as const) {
        await openDirectory(page);
        const link = cardFor(page, card);
        const target = {
          cover: link.locator('[aria-hidden="true"]').first(),
          title: link.getByRole('heading', { level: 3 }),
          body: link.locator('strong').first(),
        }[area];
        await target.click();
        await expectWorkspace(page, card);
      }
      await returnToDirectory(page);
    }
  });

  test('keyboard Tab and Enter open each property with a visible focus ring', async ({ page }) => {
    await signIn(page);
    await openDirectory(page);
    const cards = await readCards(page);

    for (const card of cards) {
      await openDirectory(page);
      const link = cardFor(page, card);
      await tabTo(page, link);
      await expect(link).toBeFocused();
      const ring = await link.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          visible: el.matches(':focus-visible'),
          outline: style.outlineStyle,
          width: style.outlineWidth,
        };
      });
      expect(ring).toEqual({ visible: true, outline: 'solid', width: '3px' });
      await page.keyboard.press('Enter');
      await expectWorkspace(page, card);
      await returnToDirectory(page);
    }
  });

  test('filtered and searched lists keep each card mapped to its own property', async ({
    page,
  }) => {
    await signIn(page);
    await openDirectory(page);
    const all = await readCards(page);

    for (const query of ['?filter=multi', '?filter=vacancies', '?filter=single']) {
      await openDirectory(page, query);
      const shown = await readCards(page);
      for (const card of shown) {
        expect(all).toContainEqual(card);
        await openDirectory(page, query);
        await cardFor(page, card).getByRole('heading', { level: 3 }).click();
        await expectWorkspace(page, card);
        await returnToDirectory(page, query);
      }
    }

    // A search narrows the list to one card at the first position; it must still open itself.
    for (const card of all) {
      const query = `?q=${encodeURIComponent(card.name)}`;
      await openDirectory(page, query);
      const first = cardsIn(page).first();
      await expect(first).toHaveAttribute('href', card.href);
      await first.click();
      await expectWorkspace(page, card);
    }
  });

  test('moving from one property to another lands on the second property', async ({ page }) => {
    await signIn(page);
    await openDirectory(page);
    const cards = await readCards(page);
    for (let i = 0; i + 1 < cards.length; i++) {
      await page.goto(cards[i].href);
      await expectWorkspace(page, cards[i]);
      await page.evaluate(
        (href) =>
          (window as unknown as { next: { router: { push(h: string): void } } }).next.router.push(
            href,
          ),
        cards[i + 1].href,
      );
      await expectWorkspace(page, cards[i + 1]);
    }
  });
});

test('workspace tabs still switch under the property loading boundary', async ({ page }) => {
  await signIn(page);
  await openDirectory(page, '?filter=multi');
  const [card] = await readCards(page);
  await cardFor(page, card).getByRole('heading', { level: 3 }).click();
  await expectWorkspace(page, card);
  const tabs = page.getByRole('navigation', { name: 'Workspace sections' });
  for (const [label, path] of [
    ['Leases', '/leases'],
    ['Payments', '/payments'],
    ['Maintenance', '/maintenance'],
    ['Media', '/media'],
    ['Overview', ''],
  ] as const) {
    await tabs.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${card.href}${path}$`), { timeout: 10_000 });
    await expect(page.getByLabel('Loading page')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1, name: card.name })).toBeVisible();
  }
});

test.describe('property cards on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('tapping each card opens its own property and back returns to the list', async ({
    page,
  }) => {
    await signIn(page);
    await openDirectory(page);
    const cards = await readCards(page);
    expect(cards.length).toBeGreaterThanOrEqual(4);

    for (const card of cards) {
      for (const area of ['cover', 'title'] as const) {
        await openDirectory(page);
        const link = cardFor(page, card);
        const target =
          area === 'cover'
            ? link.locator('[aria-hidden="true"]').first()
            : link.getByRole('heading', { level: 3 });
        await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await target.tap();
        await expectWorkspace(page, card);
      }
      await returnToDirectory(page);
    }
  });
});
