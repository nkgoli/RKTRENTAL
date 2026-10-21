// ROI overview / actuals presentation captures and checks against a production build.
//   node tests/analysis/ux-overview-runtime.mjs <baseUrl> <outDir> [maxProperties]
// Read-only: it opens the chooser, every ROI tab and Charts sub-tab and toggles
// disclosures, but never saves, reloads or edits. It still refuses the live app port.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [base, outDir, max = '4'] = process.argv.slice(2);
if (!base || !outDir) throw Error('usage: <baseUrl> <outDir> [maxProperties]');
if (/:3100\b/.test(base)) throw Error('Refusing to run against the live app.');
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const report = { base, at: new Date().toISOString(), properties: [], steps: [], failures: [] };
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
  });
  page.errors = [];
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  page.on('dialog', (d) => d.dismiss());
  await page.goto(`${base}/sign-in`);
  await page.locator('input[name="email"]').fill('jordan.mills@rocketrental.example');
  await page.locator('input[name="password"]').fill('JordanDemo#2026');
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/sign-in')),
    page.keyboard.press('Enter'),
  ]);
  return page;
}
async function settle(page) {
  await page.getByRole('tab', { name: 'Summary', exact: true }).waitFor({ timeout: 60000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}
const shot = (page, name, fullPage = false) =>
  page.screenshot({
    path: path.join(outDir, `${name}.jpg`),
    type: 'jpeg',
    quality: fullPage ? 45 : 60,
    fullPage,
  });
const overflow = (page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
// Headings in reading order inside the visible ROI panel, and where the first one sits.
const outline = (page, panelId) =>
  page.evaluate((id) => {
    const panel = document.getElementById(id);
    if (!panel) return null;
    const heads = [...panel.querySelectorAll('h2, summary')]
      .filter((h) => h.offsetParent !== null)
      .map((h) => h.textContent.replace(/\s+/g, ' ').trim().slice(0, 60));
    const first = panel.querySelector('section, [data-overview]');
    return {
      heads,
      firstTop: Math.round(first?.getBoundingClientRect().top ?? 0),
      height: Math.round(panel.getBoundingClientRect().height),
      unavailable: (panel.textContent.match(/Unavailable/g) ?? []).length,
    };
  }, panelId);

// 1. Chooser at both widths, and the property list to sample.
let ids = [];
for (const width of [1440, 390]) {
  const page = await session(width);
  await page.goto(`${base}/roi-analysis`);
  await page.getByRole('region', { name: 'Your properties' }).waitFor({ timeout: 60000 });
  await shot(page, `chooser-${width}`);
  check(`chooser-no-overflow-${width}`, !(await overflow(page)));
  if (!ids.length) {
    const names = await page
      .getByRole('region', { name: 'Your properties' })
      .locator('button strong')
      .allTextContents();
    for (const name of names.slice(0, Number(max))) {
      await page.goto(`${base}/roi-analysis`);
      await page
        .getByRole('button', { name: new RegExp(name) })
        .first()
        .click();
      await page.waitForURL(/property=/);
      ids.push({ id: new URL(page.url()).searchParams.get('property'), name });
    }
    report.properties = ids;
  }
  await page.close();
}

// 2. Summary and Actual vs projected for each property; every tab for the first.
for (const width of [1440, 390]) {
  const page = await session(width);
  for (const [n, { id, name }] of ids.entries()) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    await page.goto(`${base}/roi-analysis?property=${id}`);
    await settle(page);
    await shot(page, `summary-${slug}-${width}`);
    if (n === 0) await shot(page, `summary-${slug}-${width}-full`, true);
    const summary = await outline(page, 'roi-section-panel-summary');
    log('summary', { width, name, ...summary });
    check(`summary-no-overflow-${slug}-${width}`, !(await overflow(page)));
    await page.goto(`${base}/roi-analysis?property=${id}&view=actual`);
    await settle(page);
    // Loaded once the panel stops announcing the load (its status may then be empty).
    await page.waitForFunction(
      () =>
        !document
          .getElementById('roi-section-panel-actual')
          ?.textContent.includes('Loading recorded returns'),
      null,
      { timeout: 30000 },
    );
    await shot(page, `actual-${slug}-${width}`);
    if (n === 0) await shot(page, `actual-${slug}-${width}-full`, true);
    log('actual', { width, name, ...(await outline(page, 'roi-section-panel-actual')) });
    check(`actual-no-overflow-${slug}-${width}`, !(await overflow(page)));
    if (n !== 0) continue;
    for (const view of ['charts', 'scenarios', 'benchmarks', 'compare']) {
      await page.goto(`${base}/roi-analysis?property=${id}&view=${view}`);
      await settle(page);
      await shot(page, `${view}-${slug}-${width}`);
      check(`${view}-no-overflow-${width}`, !(await overflow(page)));
    }
    for (const chart of ['cash-flow', 'expenses', 'amortization', 'exit', 'sensitivity']) {
      await page.goto(`${base}/roi-analysis?property=${id}&view=charts&chart=${chart}`);
      await settle(page);
      await shot(page, `charts-${chart}-${slug}-${width}`);
      check(`charts-${chart}-no-overflow-${width}`, !(await overflow(page)));
    }
  }

  // 3. Keyboard (desktop) or touch (phone) through the overview's tabs and disclosures.
  const { id } = ids[0];
  await page.goto(`${base}/roi-analysis?property=${id}`);
  await settle(page);
  const summaryTab = page.getByRole('tab', { name: 'Summary', exact: true });
  const actualTab = page.getByRole('tab', { name: 'Actual vs projected', exact: true });
  if (width > 500) {
    await summaryTab.focus();
    await page.keyboard.press('ArrowRight');
    check(
      'keyboard-arrow-selects-actual',
      (await actualTab.getAttribute('aria-selected')) === 'true',
      { url: page.url() },
    );
    await page.keyboard.press('ArrowLeft');
  } else {
    await actualTab.tap();
    check('touch-tap-selects-actual', (await actualTab.getAttribute('aria-selected')) === 'true');
    await summaryTab.tap();
  }
  // Every collapsed disclosure in the overview opens from the keyboard or a tap.
  const toggles = page.locator(
    '#roi-section-panel-summary button[aria-expanded="false"], #roi-section-panel-summary details:not([open]) > summary',
  );
  const count = await toggles.count();
  let opened = 0;
  for (let i = 0; i < count; i++) {
    const t = toggles.nth(0);
    if (!(await t.isVisible())) break;
    if (width > 500) {
      await t.focus();
      await page.keyboard.press('Enter');
    } else await t.tap();
    opened++;
  }
  log('disclosures', { width, count, opened });
  check(`disclosures-open-${width}`, opened === count && !(await overflow(page)));
  await shot(page, `summary-expanded-${width}`, true);
  report[`consoleErrors${width}`] = page.errors;
  check(`no-console-errors-${width}`, page.errors.length === 0, { errors: page.errors });
  await page.close();
}
writeFileSync(path.join(outDir, 'ux-overview-report.json'), JSON.stringify(report, null, 2));
await browser.close();
if (report.failures.length) {
  console.error('FAILED:', report.failures.join(', '));
  process.exitCode = 1;
}
