// Benchmarks, Compare and Rental Distribution captures and checks against a production build.
//   node tests/analysis/ux-comparison-runtime.mjs <baseUrl> <outDir> [complete] [incomplete]
// ISOLATED runtimes only. Compare selections are changed in an unsaved draft that is never
// saved; leaving the page discards them. It refuses the live app port.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [
  base,
  outDir,
  complete = 'seed-property-maple',
  incomplete = 'seed-property-cedar',
  unit = 'seed-unit-maple-7',
] = process.argv.slice(2);
if (!base || !outDir) throw Error('usage: <baseUrl> <outDir> [complete] [incomplete] [unit]');
if (/:3100\b/.test(base)) throw Error('Refusing to run against the live app.');
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const report = { base, at: new Date().toISOString(), steps: [], failures: [] };
const log = (step, data = {}) => {
  report.steps.push({ step, ...data });
  console.log(JSON.stringify({ step, ...data }));
};
const check = (name, ok, data = {}) => {
  log(`check:${name}`, { ok, ...data });
  if (!ok) report.failures.push(name);
};

async function session(width) {
  const page = await browser.newPage({
    viewport: { width, height: width > 500 ? 900 : 844 },
    hasTouch: width < 500,
    isMobile: width < 500,
    // Complete charts in the captures (the reveal animation is off under reduced motion).
    reducedMotion: 'reduce',
  });
  // Instant scrolling, so a tap lands where Playwright scrolled the target to.
  await page.addInitScript(() =>
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '*{scroll-behavior:auto !important}';
      document.head.append(style);
    }),
  );
  page.errors = [];
  page.on(
    'console',
    (m) => m.type() === 'error' && page.errors.push(`${m.text()} ${m.location()?.url ?? ''}`),
  );
  // Leaving an unsaved draft discards it; every other dialog is dismissed.
  page.on('dialog', (d) => (d.type() === 'beforeunload' ? d.accept() : d.dismiss()));
  await page.goto(`${base}/sign-in`);
  await page.locator('input[name="email"]').fill('jordan.mills@rocketrental.example');
  await page.locator('input[name="password"]').fill('JordanDemo#2026');
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/sign-in')),
    page.keyboard.press('Enter'),
  ]);
  return page;
}
async function openView(page, id, view) {
  await page.goto(`${base}/roi-analysis?property=${id}&view=${view}`);
  await page.getByRole('tab', { name: 'Summary', exact: true }).waitFor({ timeout: 60000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  return page.locator(`#roi-section-panel-${view}`);
}
const shot = (target, name, fullPage = false) =>
  target.screenshot({
    path: path.join(outDir, `${name}.jpg`),
    type: 'jpeg',
    quality: fullPage ? 45 : 60,
    ...(fullPage ? { fullPage } : {}),
  });
// Wider content, or (on a phone) a layout viewport the browser zoomed out to fit it.
const overflow = (page) =>
  page.evaluate(
    (width) =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ||
      window.innerWidth > width + 1,
    page.viewportSize().width,
  );
// Headings and disclosure summaries in reading order, panel height and missing-value words.
const outline = (panel) =>
  panel.evaluate((el) => ({
    heads: [...el.querySelectorAll('h2, h3, summary')]
      .filter((h) => h.offsetParent !== null)
      .map((h) => h.textContent.replace(/\s+/g, ' ').trim().slice(0, 70)),
    height: Math.round(el.getBoundingClientRect().height),
    firstChartTop: Math.round(
      el.querySelector('svg[role="img"]')?.getBoundingClientRect().top ?? -1,
    ),
    basisGroups: el.querySelectorAll('[aria-label="Data basis"]').length,
    brokenValues: (el.textContent.match(/(null|undefined|NaN)%/g) ?? []).length,
    status: [...el.querySelectorAll('[role="status"]')]
      .map((s) => s.textContent.trim())
      .filter(Boolean),
    words: Object.fromEntries(
      ['Unavailable', 'Not measured', 'No projection', 'Not calculated'].map((w) => [
        w,
        (el.textContent.match(new RegExp(w, 'g')) ?? []).length,
      ]),
    ),
  }));
const press = async (page, width, locator) => {
  if (width > 500) {
    await locator.focus();
    await page.keyboard.press(
      (await locator.evaluate((e) => e.tagName)) === 'INPUT' ? 'Space' : 'Enter',
    );
  } else await locator.tap();
};
const srText = (page, plot) =>
  plot.evaluate((el) => el.parentElement.querySelector('[aria-live="polite"]')?.textContent ?? '');
async function openAll(page, width, panel, label) {
  const toggles = panel.locator('details:not([open]) > summary');
  const count = await toggles.count();
  let opened = 0;
  for (let i = 0; i < count; i++) {
    const t = toggles.nth(0);
    if (!(await t.isVisible())) break;
    await press(page, width, t);
    opened++;
  }
  check(`${label}-disclosures-open-${width}`, opened === count, { count, opened });
}

for (const width of [1440, 390]) {
  const page = await session(width);

  // 1. Benchmarks (C19, C20) on a complete analysis.
  let panel = await openView(page, complete, 'benchmarks');
  await panel.locator('svg[role="img"]').first().waitFor({ timeout: 30000 });
  await shot(page, `benchmarks-${width}`);
  await shot(page, `benchmarks-${width}-full`, true);
  const bench = await outline(panel);
  log('benchmarks', { width, ...bench });
  check(`benchmarks-no-overflow-${width}`, !(await overflow(page)));
  check(`benchmarks-no-broken-values-${width}`, bench.brokenValues === 0);
  const dollars = panel.getByRole('button', { name: 'Dollars', exact: true });
  await press(page, width, dollars);
  check(
    `benchmarks-scale-dollars-${width}`,
    (await dollars.getAttribute('aria-pressed')) === 'true',
  );
  await press(page, width, panel.getByRole('button', { name: 'Index (100)', exact: true }));
  const focusCard = panel.locator('button[aria-pressed]', { hasText: /S&P 500.*growth chart/ });
  await press(page, width, focusCard);
  check(
    `benchmarks-focus-card-${width}`,
    (await focusCard.getAttribute('aria-pressed')) === 'true',
  );
  await press(page, width, focusCard);
  const scatter = panel.getByRole('group', { name: /Reference volatility/ });
  await scatter.focus();
  await page.keyboard.press('ArrowRight');
  check(`benchmarks-scatter-keyboard-${width}`, /volatility/.test(await srText(page, scatter)));
  await openAll(page, width, panel, 'benchmarks');
  await shot(page, `benchmarks-expanded-${width}`, true);
  check(`benchmarks-expanded-no-overflow-${width}`, !(await overflow(page)));

  // 2. Compare (C21–C24): empty, select two, the limit, removal and re-selection.
  panel = await openView(page, complete, 'compare');
  const box = (name) => panel.getByRole('checkbox', { name, exact: true });
  const chip = (name) =>
    panel.locator('label', { has: page.getByRole('checkbox', { name, exact: true }) });
  const toggle = (name) => (width > 500 ? press(page, width, box(name)) : chip(name).tap());
  for (const name of ['S&P 500', 'Nasdaq 100', 'US Bonds', 'REITs', 'High-Yield Savings'])
    if ((await box(name).count()) && (await box(name).isChecked())) await toggle(name);
  await page.waitForTimeout(300);
  await shot(page, `compare-empty-${width}`);
  const empty = await outline(panel);
  log('compare-empty', { width, ...empty });
  check(
    `compare-empty-explains-${width}`,
    /Choose at least one reference asset/.test(await panel.textContent()),
  );
  check(`compare-empty-no-overflow-${width}`, !(await overflow(page)));
  await toggle('S&P 500');
  await toggle('Nasdaq 100');
  await toggle('US Bonds');
  check(
    `compare-limit-${width}`,
    /Selection limit/.test(await panel.textContent()) && !(await box('US Bonds').isChecked()),
  );
  await toggle('Nasdaq 100');
  const table = panel.getByRole('region', { name: 'Side-by-side comparison' });
  await table.waitFor({ timeout: 30000 });
  check(`compare-removal-${width}`, !(await table.textContent()).includes('Nasdaq 100'));
  await toggle('Nasdaq 100');
  await page.waitForTimeout(300);
  check(`compare-reselect-${width}`, (await table.textContent()).includes('Nasdaq 100'));
  await shot(page, `compare-${width}`);
  await shot(page, `compare-${width}-full`, true);
  const cmp = await outline(panel);
  log('compare', { width, ...cmp });
  check(`compare-no-broken-values-${width}`, cmp.brokenValues === 0);
  check(`compare-no-overflow-${width}`, !(await overflow(page)));
  const vs = panel.getByRole('button', { name: 'vs Property', exact: true });
  await press(page, width, vs);
  check(`compare-delta-view-${width}`, (await vs.getAttribute('aria-pressed')) === 'true');
  const radar = panel.getByRole('group', { name: /Normalized comparison scores/ });
  await radar.focus();
  await page.keyboard.press('ArrowRight');
  check(`compare-radar-keyboard-${width}`, /Return|Yield/.test(await srText(page, radar)));
  await openAll(page, width, panel, 'compare');
  await shot(page, `compare-expanded-${width}`, true);
  check(`compare-expanded-no-overflow-${width}`, !(await overflow(page)));

  // 3. Unavailable data: an analysis with incomplete assumptions (no projection).
  for (const view of ['benchmarks', 'compare']) {
    panel = await openView(page, incomplete, view);
    await shot(page, `incomplete-${view}-${width}`);
    log(`incomplete-${view}`, { width, ...(await outline(panel)) });
    check(`incomplete-${view}-no-overflow-${width}`, !(await overflow(page)));
  }

  // 4. Rental Distribution (C25) on a unit listing.
  await page.goto(`${base}/properties/${complete}/listing?unit=${unit}`);
  const heading = page.getByRole('heading', { name: 'Rental Distribution' });
  await heading.waitFor({ timeout: 60000 });
  await page.waitForLoadState('networkidle');
  const card = page.locator('section', { has: heading }).last();
  await card.scrollIntoViewIfNeeded();
  await shot(card, `distribution-${width}`);
  log('distribution', {
    width,
    text: (await card.textContent()).replace(/\s+/g, ' ').slice(0, 400),
    height: Math.round((await card.boundingBox()).height),
  });
  check(`distribution-no-overflow-${width}`, !(await overflow(page)));
  const plot = card.getByRole('group', { name: /Rental distribution/ });
  await plot.focus();
  await page.keyboard.press('End');
  check(`distribution-keyboard-${width}`, /per month/.test(await srText(page, plot)));
  if (width < 500) {
    const svg = plot.locator('svg').first();
    const b = await svg.boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  }
  await openAll(page, width, card, 'distribution');
  await shot(card, `distribution-active-${width}`);

  report[`consoleErrors${width}`] = page.errors;
  check(`no-console-errors-${width}`, page.errors.length === 0, { errors: page.errors });
  await page.close();
}
writeFileSync(path.join(outDir, 'ux-comparison-report.json'), JSON.stringify(report, null, 2));
await browser.close();
if (report.failures.length) {
  console.error('FAILED:', report.failures.join(', '));
  process.exitCode = 1;
}
