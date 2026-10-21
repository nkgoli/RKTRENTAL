// Compact Returns & ROI header and the section-preserving Edit assumptions round trip.
//   capture <baseUrl> <outDir> <propertyId...>  read-only; safe on the live app
//   flow <baseUrl> <outDir> <readyId> <draftId>  ISOLATED runtimes only: saves data
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [mode, base, outDir, ...rest] = process.argv.slice(2);
if (!['capture', 'flow'].includes(mode) || !base || !outDir) throw Error('see usage above');
if (mode === 'flow' && /:3100\b/.test(base)) throw Error('Refusing to write to the live app.');
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const report = { mode, base, at: new Date().toISOString(), steps: [], failures: [] };
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
  });
  page.errors = [];
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  page.on('dialog', (d) => d.dismiss()); // never confirm a browser dialog
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
async function openRoi(page, query) {
  await page.goto(`${base}/roi-analysis?${query}`);
  await settle(page);
}
const shot = (page, name) =>
  page.screenshot({ path: path.join(outDir, `${name}.jpg`), type: 'jpeg', quality: 60 });
const selectedTabs = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[role="tab"][aria-selected="true"]')]
      .filter((t) => t.offsetParent !== null)
      .map((t) => t.textContent.trim()),
  );
const query = (page) => new URL(page.url()).search;
// Where results start relative to the first viewport.
const firstView = (page) =>
  page.evaluate(() => {
    const box = (el) => (el ? el.getBoundingClientRect() : null);
    const summary = document.querySelector('[aria-label="Baseline assumptions"]');
    const panel = document.getElementById('roi-section-panel-summary');
    const first = panel?.querySelector('section');
    const metric = document.querySelector('[aria-label="Year 1 at a glance"] strong');
    return {
      viewport: [window.innerWidth, window.innerHeight],
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      assumptionsHeight: Math.round(box(summary)?.height ?? 0),
      tabsTop: Math.round(box(document.querySelector('[aria-label="ROI sections"]'))?.top ?? 0),
      firstResultTop: Math.round(box(first)?.top ?? 0),
      firstMetricBottom: Math.round(box(metric)?.bottom ?? 0),
      firstResultHeading: first?.querySelector('h2')?.textContent ?? null,
      detailsHidden: summary?.querySelector('dl')?.hidden ?? null,
      summaryText: summary?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 300),
    };
  });

if (mode === 'capture') {
  for (const width of [1440, 390]) {
    const page = await session(width);
    for (const id of rest) {
      await openRoi(page, `property=${id}`);
      await shot(page, `initial-${id}-${width}`);
      const view = await firstView(page);
      log('capture', { id, width, ...view, errors: page.errors.length });
      // At least 200px of the first result card is inside the first viewport.
      check(
        `results-in-first-viewport-${id}-${width}`,
        view.firstResultTop > 0 && view.firstResultTop + 200 < view.viewport[1] && !view.overflow,
      );
    }
    await page.close();
  }
} else {
  const [readyId, draftId] = rest;
  const page = await session(1440);
  const region = () => page.getByRole('region', { name: 'Baseline assumptions' });
  const editLink = () => region().getByRole('link', { name: 'Edit assumptions' });
  const backToRoi = async (action) => {
    await Promise.all([page.waitForURL(/\/roi-analysis/, { timeout: 60000 }), action()]);
    await settle(page);
  };
  const toEditor = async () => {
    await Promise.all([page.waitForURL(/\/properties\/.+\/edit/), editLink().click()]);
    await page.getByLabel('Vacancy (%)', { exact: true }).waitFor();
  };

  // 1. Keyboard: details disclosure and the More actions menu.
  await openRoi(page, `property=${readyId}`);
  const toggle = region().getByRole('button', { name: 'Show details' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  const expanded = await region().getByRole('button', { name: 'Hide details' });
  check('details-enter-expands', (await expanded.getAttribute('aria-expanded')) === 'true', {
    visible: await region().locator('dl').isVisible(),
  });
  await shot(page, 'details-open-1440');
  await page.keyboard.press('Space');
  check('details-space-collapses', !(await region().locator('dl').isVisible()));
  const menu = page.locator('summary', { hasText: 'More actions' });
  await menu.focus();
  await page.keyboard.press('Enter');
  const recalc = page.getByRole('button', { name: 'Recalculate' });
  check('menu-enter-opens', await recalc.isVisible());
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  await shot(page, 'menu-open-1440');
  await page.keyboard.press('Escape');
  check('menu-escape-closes-and-refocuses', !(await recalc.isVisible()), {
    tabbedTo: focused,
    focus: await page.evaluate(() => document.activeElement?.textContent?.trim()),
  });

  // 2. Charts / Sensitivity with a period: Cancel, then Save, return to the same place.
  await openRoi(page, `property=${readyId}&view=charts&chart=sensitivity&period=YTD`);
  const start = { query: query(page), tabs: await selectedTabs(page) };
  check('opens-charts-sensitivity', start.tabs.join() === 'Charts,Sensitivity', start);
  await toEditor();
  const editorUrl = page.url();
  await page.getByLabel('Vacancy (%)', { exact: true }).fill('41');
  await backToRoi(() => page.getByRole('link', { name: 'Cancel' }).click());
  const cancel = { query: query(page), tabs: await selectedTabs(page) };
  check(
    'cancel-returns-to-sensitivity',
    cancel.query === start.query && cancel.tabs.join() === 'Charts,Sensitivity',
    { ...cancel, editorUrl },
  );
  await toEditor();
  const vacancy = page.getByLabel('Vacancy (%)', { exact: true });
  const prefill = await vacancy.inputValue();
  await vacancy.fill(String(Number(prefill || 0) + 2));
  await backToRoi(() => page.getByRole('button', { name: 'Save and return to ROI' }).click());
  const saved = {
    query: query(page),
    tabs: await selectedTabs(page),
    status: await page.locator('[role="status"][aria-live="polite"]').first().innerText(),
  };
  await shot(page, 'save-returns-sensitivity-1440');
  check(
    'save-returns-to-sensitivity',
    saved.query === start.query && saved.tabs.join() === 'Charts,Sensitivity',
    { ...saved, prefill },
  );
  const sensitivityCells = await page
    .locator('#roi-chart-panel-sensitivity td')
    .evaluateAll((n) => n.slice(0, 12).map((e) => e.textContent.trim()));
  check(
    'sensitivity-one-decimal',
    sensitivityCells.filter((t) => /%$/.test(t)).every((t) => /\.\d%$/.test(t)),
    { sensitivityCells },
  );

  // 3. Scenarios, Benchmarks and Compare survive Cancel.
  for (const [tab, view] of [
    ['Scenarios', 'scenarios'],
    ['Benchmarks', 'benchmarks'],
    ['Compare', 'compare'],
  ]) {
    await openRoi(page, `property=${readyId}&period=QTD`);
    await page.getByRole('tab', { name: tab, exact: true }).click();
    const before = query(page);
    await toEditor();
    await backToRoi(() => page.getByRole('link', { name: 'Cancel' }).click());
    check(
      `cancel-returns-to-${view}`,
      query(page) === before && (await selectedTabs(page))[0] === tab,
      {
        before,
        after: query(page),
      },
    );
  }

  // 4. Unsaved scenario edits are guarded: keep editing, then save draft and continue.
  await openRoi(page, `property=${draftId}&view=scenarios`);
  const names = () =>
    page.locator('[id$=".name"][id^="scenarios."]').evaluateAll((n) => n.map((e) => e.value));
  const scenariosBefore = await names();
  await page.getByRole('button', { name: 'Create scenario' }).click();
  await page.locator(`[id="scenarios.${scenariosBefore.length}.name"]`).fill('Round trip case');
  await editLink().click();
  const dialog = page.getByRole('alertdialog');
  await dialog.waitFor();
  await shot(page, 'guard-1440');
  await dialog.getByRole('button', { name: 'Keep editing' }).click();
  check(
    'keep-editing-stays',
    /\/roi-analysis/.test(page.url()) && (await names()).includes('Round trip case'),
  );
  await editLink().click();
  await Promise.all([
    page.waitForURL(/\/properties\/.+\/edit/, { timeout: 60000 }),
    dialog.getByRole('button', { name: 'Save draft and continue' }).click(),
  ]);
  await backToRoi(() => page.getByRole('link', { name: 'Cancel' }).click());
  const afterGuard = { query: query(page), tabs: await selectedTabs(page), names: await names() };
  check(
    'save-draft-continue-returns-to-scenarios',
    afterGuard.tabs[0] === 'Scenarios' && afterGuard.names.includes('Round trip case'),
    { scenariosBefore, ...afterGuard },
  );

  // 5. Discard and continue leaves the saved analysis unchanged.
  await page.getByRole('button', { name: 'Create scenario' }).click();
  await page.locator(`[id="scenarios.${afterGuard.names.length}.name"]`).fill('Discarded case');
  await editLink().click();
  await Promise.all([
    page.waitForURL(/\/properties\/.+\/edit/, { timeout: 60000 }),
    dialog.getByRole('button', { name: 'Discard and continue' }).click(),
  ]);
  await backToRoi(() => page.getByRole('link', { name: 'Cancel' }).click());
  const afterDiscard = { tabs: await selectedTabs(page), names: await names() };
  check(
    'discard-returns-without-change',
    afterDiscard.tabs[0] === 'Scenarios' &&
      !afterDiscard.names.includes('Discarded case') &&
      afterDiscard.names.includes('Round trip case'),
    afterDiscard,
  );

  report.consoleErrors = page.errors;
  await page.close();
}
writeFileSync(path.join(outDir, `${mode}-report.json`), JSON.stringify(report, null, 2));
await browser.close();
if (report.failures.length) {
  console.error('FAILED:', report.failures.join(', '));
  process.exitCode = 1;
}
