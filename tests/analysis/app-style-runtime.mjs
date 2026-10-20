// Captures every ROI chart family next to current RocketRental manager screens, at
// 1440 and 390 px, and records computed fonts/tokens plus basic chart interactions.
// ISOLATED runtimes only: Compare picks two assets in an unsaved draft.
// node tests/analysis/app-style-runtime.mjs <baseUrl> <outDir> [propertyId] [unitId]
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [base, outDir, propertyId = 'seed-property-maple', unitId = 'seed-unit-maple-7'] =
  process.argv.slice(2);
if (!base || !outDir) throw Error('usage: <baseUrl> <outDir> [propertyId] [unitId]');
if (/:3100\b/.test(base)) throw Error('Refusing to run against the live app on 3100.');
mkdirSync(outDir, { recursive: true });

// One card per chart family: [file, tab, Charts sub-tab, card heading, chart ids].
const families = [
  ['summary-net-cashflow', 'Summary', null, 'Net Cash Flow by Year', 'C1'],
  ['summary-outcome', 'Summary', null, 'Outcome', 'C2'],
  ['summary-deal-snapshot', 'Summary', null, 'Deal Snapshot', 'C3'],
  ['summary-fix-my-deal', 'Summary', null, 'Fix My Deal', 'C4'],
  ['summary-projections', 'Summary', null, 'Cash Flow & Equity Projections', 'C5'],
  ['actual-vs-projected', 'Actual vs projected', null, 'Actual vs projected', 'table'],
  ['equity-composition', 'Charts', 'Equity', 'Equity Composition vs Debt Paydown', 'C6'],
  ['equity-value-mortgage', 'Charts', 'Equity', 'Value vs Mortgage Balance', 'C7'],
  ['cashflow-cumulative', 'Charts', 'Cash Flow', 'Cash Flow & Cumulative', 'C8'],
  ['cashflow-bridge', 'Charts', 'Cash Flow', 'Income to Cash Flow Bridge', 'C9'],
  ['expenses', 'Charts', 'Expenses', 'Operating Expenses', 'C10'],
  ['amortization-area', 'Charts', 'Amortization', 'Principal vs Interest Over Time', 'C11'],
  ['amortization-schedule', 'Charts', 'Amortization', 'Loan Amortization Schedule', 'C12-C13,C17'],
  ['exit', 'Charts', 'Exit Analysis', 'Exit Analysis & Comparison', 'C14'],
  ['sensitivity', 'Charts', 'Sensitivity', 'Sensitivity', 'C15-C16'],
  ['scenarios', 'Scenarios', null, 'Equity Growth by Scenario', 'C18'],
  ['benchmarks-growth', 'Benchmarks', null, 'Investment Growth Over Time', 'C19'],
  ['benchmarks-risk', 'Benchmarks', null, 'Risk vs Return', 'C20'],
  ['compare-growth', 'Compare', null, 'Investment Growth Over Time', 'C21'],
  ['compare-bars', 'Compare', null, 'Annualized Returns Comparison', 'C22'],
  ['compare-radar', 'Compare', null, 'Multi-Dimensional Comparison', 'C23'],
  ['compare-table', 'Compare', null, 'Side-by-Side Comparison', 'C24'],
  ['rental-distribution', 'Listing', null, 'Rental Distribution', 'C25'],
];

// Computed style of the first match, for app-vs-ROI token comparison.
const probe = (selector) =>
  globalThis.document.querySelector(selector) &&
  (() => {
    const s = getComputedStyle(globalThis.document.querySelector(selector));
    return {
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      color: s.color,
      background: s.backgroundColor,
      border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
      radius: s.borderTopLeftRadius,
      shadow: s.boxShadow,
    };
  })();

const browser = await chromium.launch();
const report = { base, propertyId, at: new Date().toISOString(), widths: {} };

for (const width of [1440, 390]) {
  const page = await browser.newPage({
    viewport: { width, height: width > 500 ? 900 : 844 },
    hasTouch: width < 500,
  });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const w = (report.widths[width] = { cards: {}, overflow: {}, tokens: {}, interactions: {} });
  const shot = (name) => path.join(outDir, `${name}-${width}.png`);

  await page.goto(`${base}/sign-in`);
  await page.locator('input[name="email"]').fill('jordan.mills@rocketrental.example');
  await page.locator('input[name="password"]').fill('JordanDemo#2026');
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/sign-in')),
    page.keyboard.press('Enter'),
  ]);

  // Current RocketRental screens are the visual authority.
  for (const [name, url] of [
    ['app-dashboard', '/dashboard'],
    ['app-property', `/properties/${propertyId}`],
  ]) {
    await page.goto(`${base}${url}`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: shot(name) });
    if (name === 'app-dashboard') w.tokens.app = await appTokens();
  }
  async function appTokens() {
    return page.evaluate((fn) => {
      const p = eval(fn);
      return {
        card: p('.card'),
        cardHeading: p('.card h2, .card h3, .card-header h3'),
        body: p('body'),
        chipActive: p('.chip.active, .tabs a.active'),
        button: p('.btn-secondary, .btn'),
      };
    }, `(${probe})`);
  }

  const openTab = async (tab, sub) => {
    if (tab === 'Listing') {
      await page.goto(`${base}/properties/${propertyId}/listing?unit=${unitId}`);
      await page.getByText('Rental Distribution').first().waitFor({ timeout: 60000 });
    } else {
      if (!page.url().includes('/roi-analysis')) {
        await page.goto(`${base}/roi-analysis?property=${propertyId}`);
        await page.getByText('Net Cash Flow by Year').first().waitFor({ timeout: 60000 });
      }
      await page.getByRole('tab', { name: tab, exact: true }).click();
      if (sub) await page.getByRole('tab', { name: sub, exact: true }).click();
      if (
        tab === 'Compare' &&
        (await page.getByText('Choose at least one reference asset').count())
      )
        for (const name of ['S&P 500', 'Nasdaq 100'])
          await page.getByLabel(name, { exact: false }).first().check();
    }
    await page.waitForTimeout(700);
    w.overflow[`${tab}${sub ? `/${sub}` : ''}`] = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
  };

  let last = '';
  for (const [file, tab, sub, title, ids] of families) {
    const key = `${tab}/${sub}`;
    if (key !== last) await openTab(tab, sub);
    last = key;
    const heading = page
      .locator('h2:visible, h3:visible')
      .filter({ hasText: new RegExp(`^${title.replace(/[&]/g, '\\$&')}`) })
      .first();
    const found = (await heading.count()) > 0;
    let card = null;
    if (found) {
      card = heading.locator('xpath=ancestor::section[1]');
      if (!(await card.count()))
        card = heading.locator('xpath=ancestor::*[self::div or self::article][1]');
      await page.evaluate(() => document.activeElement?.blur());
      await card.scrollIntoViewIfNeeded();
      await card.screenshot({ path: shot(file) });
    }
    w.cards[file] = { ids, title, found };
  }

  // ROI tokens, read on the Summary tab.
  await openTab('Summary', null);
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: shot('roi-page') });
  w.tokens.roi = await page.evaluate((fn) => {
    const p = eval(fn);
    return {
      chartCard: p('section:has(> header h2)'),
      chartTitle: p('section > header h2'),
      chartSubtitle: p('section > header p'),
      pressedToggle: p('[role="group"] button[aria-pressed="true"]'),
      tileValue: p('dl dd strong'),
      tileLabel: p('dl dt'),
      axisText: p('svg text'),
      insight: p('section p strong'),
      fonts: [...document.fonts]
        .filter((f) => f.status === 'loaded')
        .map((f) => `${f.family} ${f.weight}`),
      jetbrainsLoaded:
        document.fonts.check('500 14px "JetBrains Mono"') &&
        [...document.fonts].some((f) => /JetBrains/.test(f.family)),
    };
  }, `(${probe})`);

  // Hover/tap and keyboard on C1: tooltip and live region must still respond.
  const plot = page.locator('[role="group"][tabindex="0"]:visible').first();
  await plot.scrollIntoViewIfNeeded();
  const box = await plot.boundingBox();
  if (width < 500) await page.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height / 2);
  else await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
  await page.waitForTimeout(400);
  const tip = await plot
    .locator('div')
    .filter({ hasText: /Year/ })
    .first()
    .innerText()
    .catch(() => '');
  await page.screenshot({
    path: shot('tooltip'),
    clip: { ...box, height: Math.min(box.height + 60, 500) },
  });
  await plot.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const live = await plot.locator('xpath=..').locator('[aria-live="polite"]').first().innerText();
  w.interactions = { pointerTooltip: tip.replace(/\s+/g, ' ').trim(), keyboardLive: live.trim() };
  w.consoleErrors = errors;
  await page.close();
}

writeFileSync(path.join(outDir, 'app-style-report.json'), JSON.stringify(report, null, 2));
for (const [width, w] of Object.entries(report.widths))
  console.log(
    JSON.stringify({
      width,
      missing: Object.entries(w.cards)
        .filter(([, c]) => !c.found)
        .map(([f]) => f),
      overflow: Object.entries(w.overflow)
        .filter(([, o]) => o.scrollWidth > o.clientWidth)
        .map(([t]) => t),
      interactions: w.interactions,
      errors: w.consoleErrors.length,
    }),
  );
await browser.close();
