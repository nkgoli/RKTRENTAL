// Returns & ROI layout captures and the Edit Property assumptions round trip.
//   capture <baseUrl> <outDir> <tag> <propertyId...>  read-only; safe on the live app
//   flow <baseUrl> <outDir> <readyId> <draftId> <missingId>  ISOLATED runtimes only: saves data
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [mode, base, outDir, ...rest] = process.argv.slice(2);
if (!['capture', 'flow'].includes(mode) || !base || !outDir) throw Error('see usage above');
if (mode === 'flow' && /:3100\b/.test(base)) throw Error('Refusing to write to the live app.');
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const report = { mode, base, at: new Date().toISOString(), steps: [] };
const log = (step, data = {}) => {
  report.steps.push({ step, ...data });
  console.log(JSON.stringify({ step, ...data }));
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
async function openRoi(page, query) {
  await page.goto(`${base}/roi-analysis?${query}`);
  await page.getByRole('tab', { name: 'Summary', exact: true }).waitFor({ timeout: 60000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}
const shot = (page, name, full = false) =>
  page.screenshot({
    path: path.join(outDir, `${name}.jpg`),
    type: 'jpeg',
    quality: 60,
    fullPage: full,
  });
// Width the results get, and whether a large assumptions form is still on the page.
const layout = (page) =>
  page.evaluate(() => {
    const panel = document.getElementById('roi-section-panel-summary');
    const first = panel?.querySelector('section');
    return {
      viewport: window.innerWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      resultsWidth: Math.round(first?.getBoundingClientRect().width ?? 0),
      panelWidth: Math.round(panel?.getBoundingClientRect().width ?? 0),
      inlineAssumptionInputs: document.querySelectorAll('[id^="input."]').length,
      summary: document
        .querySelector('[aria-label="Baseline assumptions"]')
        ?.textContent?.replace(/\s+/g, ' ')
        .slice(0, 400),
      guidance:
        document
          .querySelector('details[open] > summary')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim() ?? null,
    };
  });

if (mode === 'capture') {
  const [tag, ...ids] = rest;
  for (const width of [1440, 390]) {
    const page = await session(width);
    for (const id of ids) {
      await openRoi(page, `property=${id}`);
      await shot(page, `${tag}-${id}-${width}`);
      log('capture', { tag, id, width, ...(await layout(page)), errors: page.errors.length });
    }
    await page.close();
  }
} else {
  const [readyId, draftId, missingId] = rest;
  const page = await session(1440);
  const editLink = () =>
    page.getByRole('region', { name: 'Baseline assumptions' }).getByRole('link', {
      name: 'Edit assumptions',
    });
  const metric = async (label) =>
    (
      await page
        .locator('[aria-label="Year 1 at a glance"]')
        .locator('div', { has: page.getByText(label, { exact: true }) })
        .locator('strong')
        .first()
        .textContent()
    ).trim();

  // 1. Ready analysis in Actual vs projected for a quarter: context survives the round trip.
  await openRoi(page, `property=${readyId}&view=actual&period=QTD`);
  await page.getByRole('tab', { name: 'Summary', exact: true }).click();
  await page.getByRole('tab', { name: 'Actual vs projected', exact: true }).click();
  const href = await editLink().getAttribute('href');
  const before = { url: page.url(), cash: await metric('Annual cash flow') };
  await editLink().click();
  await page.waitForURL(/\/properties\/.+\/edit/);
  const vacancy = page.getByLabel('Vacancy (%)', { exact: true });
  await vacancy.waitFor();
  const prefill = await vacancy.inputValue();
  await shot(page, 'flow-editor-1440');
  log('editor', { href, before, prefill, url: page.url() });

  // Cancel changes nothing.
  await vacancy.fill('37');
  await page.getByRole('link', { name: 'Cancel' }).click();
  await page.waitForURL(/\/roi-analysis/);
  await page.getByRole('tab', { name: 'Summary', exact: true }).waitFor();
  await page.waitForLoadState('networkidle');
  log('cancel', {
    url: page.url(),
    cash: await metric('Annual cash flow'),
    status: await page.locator('[role="status"][aria-live="polite"]').first().innerText(),
  });

  // Save returns to the same context with recalculated results.
  await editLink().click();
  await page.getByLabel('Vacancy (%)', { exact: true }).fill(String(Number(prefill || 0) + 5));
  await Promise.all([
    page.waitForURL(/\/roi-analysis/, { timeout: 60000 }),
    page.getByRole('button', { name: 'Save and return to ROI' }).click(),
  ]);
  await page.getByRole('tab', { name: 'Summary', exact: true }).waitFor();
  await page.waitForLoadState('networkidle');
  const afterSave = {
    url: page.url(),
    selectedTab: await page.getByRole('tab', { selected: true }).first().innerText(),
    status: await page.locator('[role="status"][aria-live="polite"]').first().innerText(),
  };
  await page.getByRole('tab', { name: 'Summary', exact: true }).click();
  afterSave.cash = await metric('Annual cash flow');
  await page
    .getByRole('region', { name: 'Baseline assumptions' })
    .getByRole('button', { name: 'Show details' })
    .click();
  afterSave.vacancy = await page
    .getByRole('region', { name: 'Baseline assumptions' })
    .locator('div', { has: page.getByText('Vacancy', { exact: true }) })
    .locator('dd')
    .innerText();
  await shot(page, 'flow-after-save-1440');
  log('save-return', afterSave);

  // 2. Saved draft with scenarios: scenarios survive a property save.
  await openRoi(page, `property=${draftId}`);
  await page.getByRole('tab', { name: 'Scenarios', exact: true }).click();
  const scenariosBefore = await page
    .locator('[id$=".name"][id^="scenarios."]')
    .evaluateAll((n) => n.map((e) => e.value));
  await page.getByRole('tab', { name: 'Summary', exact: true }).click();
  const draftStatus = await page.locator('[role="status"][aria-live="polite"]').first().innerText();
  await editLink().click();
  const insurance = page.getByLabel('Insurance ($ / year)', { exact: true });
  const insuranceBefore = await insurance.inputValue();
  await insurance.fill(String(Number(insuranceBefore || 0) + 120));
  await Promise.all([
    page.waitForURL(/\/roi-analysis/, { timeout: 60000 }),
    page.getByRole('button', { name: 'Save and return to ROI' }).click(),
  ]);
  await page.getByRole('tab', { name: 'Scenarios', exact: true }).click();
  const scenariosAfter = await page
    .locator('[id$=".name"][id^="scenarios."]')
    .evaluateAll((n) => n.map((e) => e.value));
  log('draft', {
    draftStatus,
    after: await page.locator('[role="status"][aria-live="polite"]').first().innerText(),
    insuranceBefore,
    scenariosBefore,
    scenariosAfter,
  });

  // 3. Missing-input property: concise guidance, then complete it through the editor.
  await openRoi(page, `property=${missingId}`);
  const missingBefore = await layout(page);
  await shot(page, 'flow-missing-1440');
  const complete = page.getByRole('link', { name: 'Complete assumptions' });
  const completeHref = await complete.getAttribute('href');
  await complete.click();
  await page.waitForURL(/\/edit/);
  await page.waitForTimeout(400);
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  const needed = await page.locator('#roi-details [role="status"]').first().innerText();
  await shot(page, 'flow-missing-editor-1440');
  log('missing', { missingBefore, completeHref, focused, needed });
  report.consoleErrors = page.errors;
  await page.close();

  const mobile = await session(390);
  await openRoi(mobile, `property=${missingId}`);
  await shot(mobile, 'flow-missing-390');
  log('missing-390', { ...(await layout(mobile)) });
  await mobile.goto(`${base}${completeHref}`);
  await mobile.waitForLoadState('networkidle');
  await shot(mobile, 'flow-missing-editor-390');
  log('editor-390', {
    overflow: await mobile.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  });
  await mobile.close();
}
writeFileSync(path.join(outDir, `${mode}-report.json`), JSON.stringify(report, null, 2));
await browser.close();
