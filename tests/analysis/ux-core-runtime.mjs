// Core projection charts (Equity, Cash Flow, Expenses, Amortization): captures and checks
// against a production build.
//   node tests/analysis/ux-core-runtime.mjs <baseUrl> <outDir> [propertyNamePattern]
// Read-only by default: it opens Charts sub-tabs, presses chart controls and disclosures,
// but never saves, reloads a draft or edits (see step 6 for the opt-in missing-data check).
// It refuses the live app port.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [base, outDir, only = ''] = process.argv.slice(2);
if (!base || !outDir) throw Error('usage: <baseUrl> <outDir> [propertyNamePattern]');
if (/:3100\b/.test(base)) throw Error('Refusing to run against the live app.');
mkdirSync(outDir, { recursive: true });
const groups = ['equity', 'cash-flow', 'expenses', 'amortization'];
const browser = await chromium.launch();
const report = {
  base,
  at: new Date().toISOString(),
  properties: [],
  cards: [],
  steps: [],
  failures: [],
};
const log = (step, data = {}) => {
  report.steps.push({ step, ...data });
  console.log(JSON.stringify({ step, ...data }));
};
const check = (name, ok, data = {}) => {
  log(`check:${name}`, { ok, ...data });
  if (!ok) report.failures.push(name);
};
const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function session(width, reducedMotion = 'no-preference') {
  const page = await browser.newPage({
    viewport: { width, height: width > 500 ? 900 : 844 },
    hasTouch: width < 500,
    isMobile: width < 500,
    reducedMotion,
  });
  page.errors = [];
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  // Never accept a "reload saved analysis" or leave-page prompt.
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
async function open(page, id, chart) {
  await page.goto(`${base}/roi-analysis?property=${id}&view=charts&chart=${chart}`);
  await page.getByRole('tab', { name: 'Summary', exact: true }).waitFor({ timeout: 60000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  return page.locator(`#roi-chart-panel-${chart}`);
}
const overflow = (page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
// Per card: title, subtitle length, basis tags, legend items, tick labels, overlapping
// SVG labels and the smallest SVG text size.
const describe = (panel) =>
  panel.evaluate((root) => {
    const boxesOverlap = (a, b) =>
      a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    return [...root.querySelectorAll('section')]
      .filter((s) => s.querySelector(':scope > header h2'))
      .map((s) => {
        const texts = [...s.querySelectorAll('svg text')].filter((t) => t.textContent.trim());
        const boxes = texts.map((t) => t.getBoundingClientRect());
        let overlaps = 0;
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++)
            if (boxesOverlap(boxes[i], boxes[j])) overlaps++;
        const sizes = texts.map((t) => parseFloat(getComputedStyle(t).fontSize));
        return {
          title: s.querySelector(':scope > header h2').textContent.trim(),
          subtitle: s.querySelector(':scope > header p')?.textContent.trim() ?? '',
          basis: [...s.querySelectorAll(':scope > header [aria-label="Data basis"] li')].map((li) =>
            li.textContent.trim(),
          ),
          legend: [...s.querySelectorAll('ul[aria-label$="legend"] li')].map((li) =>
            li.textContent.trim(),
          ),
          ticks: texts.map((t) => t.textContent.trim()),
          overlaps,
          minFont: sizes.length ? Math.min(...sizes) : null,
          disclosures: [...s.querySelectorAll('details > summary')].map((x) =>
            x.textContent.trim(),
          ),
          height: Math.round(s.getBoundingClientRect().height),
        };
      });
  });

// 1. The properties to sample (all of them, or those matching the pattern).
let ids = [];
{
  const page = await session(1440);
  await page.goto(`${base}/roi-analysis`);
  const region = page.getByRole('region', { name: 'Your properties' });
  await region.waitFor({ timeout: 60000 });
  const names = await region.locator('button strong').allTextContents();
  for (const name of names.filter((n) => new RegExp(only, 'i').test(n))) {
    await page.goto(`${base}/roi-analysis`);
    await page
      .getByRole('button', { name: new RegExp(name) })
      .first()
      .click();
    await page.waitForURL(/property=/);
    ids.push({ id: new URL(page.url()).searchParams.get('property'), name });
  }
  report.properties = ids;
  await page.close();
}

// 2. Every core group for every property at both widths.
for (const width of [1440, 390]) {
  const page = await session(width);
  for (const { id, name } of ids) {
    for (const chart of groups) {
      const panel = await open(page, id, chart);
      await panel.waitFor();
      await panel.screenshot({
        path: path.join(outDir, `${chart}-${slug(name)}-${width}.jpg`),
        type: 'jpeg',
        quality: 55,
      });
      const cards = await describe(panel);
      report.cards.push({ width, name, chart, cards });
      check(`no-overflow-${chart}-${slug(name)}-${width}`, !(await overflow(page)));
      check(
        `no-label-overlap-${chart}-${slug(name)}-${width}`,
        cards.every((c) => c.overlaps === 0),
        { overlaps: cards.map((c) => [c.title, c.overlaps]).filter(([, n]) => n) },
      );
      check(
        `sub-tab-selected-${chart}-${slug(name)}-${width}`,
        (await page
          .getByRole('tab', { name: new RegExp(`^${chart.replace('-', ' ')}$`, 'i') })
          .getAttribute('aria-selected')) === 'true',
      );
    }
  }

  // 3. Controls on the first financed property: keyboard (desktop) or touch (phone).
  const { id, name } = ids[0];
  const desk = width > 500;
  const press = async (locator, key = 'Enter') => {
    if (desk) {
      await locator.focus();
      await page.keyboard.press(key);
    } else await locator.tap();
  };
  let panel = await open(page, id, 'equity');
  const plot = panel.getByRole('group', { name: /Equity composition and loan balance/ });
  if (desk) {
    await plot.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
  } else {
    await plot.scrollIntoViewIfNeeded();
    const box = await plot.locator('svg').boundingBox();
    await page.touchscreen.tap(box.x + box.width * 0.3, box.y + box.height * 0.5);
  }
  const spoken = await plot.locator('xpath=..').locator('[aria-live]').textContent();
  check(`equity-readout-${width}`, /^Year \d+: Property Value \$/.test(spoken), { spoken });
  await panel.screenshot({
    path: path.join(outDir, `equity-tooltip-${width}.jpg`),
    type: 'jpeg',
    quality: 55,
  });
  const horizon = panel.getByRole('group', { name: 'Equity chart horizon' });
  await press(horizon.getByRole('button', { name: 'Y5' }));
  check(
    `equity-horizon-y5-${width}`,
    (await horizon.getByRole('button', { name: 'Y5' }).getAttribute('aria-pressed')) === 'true',
  );
  const indexed = panel.getByRole('button', { name: 'Indexed' });
  await press(indexed);
  check(`equity-indexed-${width}`, (await indexed.getAttribute('aria-pressed')) === 'true');
  const downPayment = panel.getByLabel('Include down payment');
  await press(downPayment, 'Space');
  check(`equity-down-payment-${width}`, await downPayment.isChecked());
  await panel.screenshot({
    path: path.join(outDir, `equity-controls-${width}.jpg`),
    type: 'jpeg',
    quality: 55,
  });

  // Sub-tab keyboard/tap selection is kept in the address and after a reload.
  const cashTab = page.getByRole('tab', { name: 'Cash Flow', exact: true });
  if (desk) {
    await page.getByRole('tab', { name: 'Equity', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
  } else await cashTab.tap();
  await page.waitForURL(/chart=cash-flow/);
  await page.reload();
  await page.getByRole('tab', { name: 'Summary', exact: true }).waitFor();
  check(
    `sub-tab-kept-after-reload-${width}`,
    (await page
      .getByRole('tab', { name: 'Cash Flow', exact: true })
      .getAttribute('aria-selected')) === 'true',
    { url: page.url() },
  );

  // Expenses: the sort menu by keyboard or tap, then the what-if toggle.
  panel = await open(page, id, 'expenses');
  const sort = panel.getByRole('button', { name: /^Sort: / });
  await press(sort);
  const change = panel.getByRole('menuitemradio', { name: 'Biggest Δ vs Y1' });
  if (desk) {
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
  } else await change.tap();
  check(`expenses-sort-${width}`, /Biggest Δ/.test(await sort.textContent()));
  if (desk) {
    await press(sort);
    await page.keyboard.press('Escape');
    check('expenses-sort-escape', (await sort.getAttribute('aria-expanded')) === 'false');
  }
  // The toggle is renamed "Reset" while pressed.
  const simulate = panel.locator('button[aria-pressed]', { hasText: /Simulate −10% Tax|Reset/ });
  if (await simulate.count()) {
    await press(simulate);
    check(`expenses-simulate-${width}`, (await simulate.getAttribute('aria-pressed')) === 'true');
    await press(simulate);
  }

  // Amortization: detailed rows and the schedule disclosures.
  panel = await open(page, id, 'amortization');
  await press(panel.getByRole('button', { name: 'Detailed' }));
  const year1 = panel.getByRole('button', { name: 'Year 1 monthly payments' });
  await press(year1);
  check(`amortization-expand-${width}`, (await year1.getAttribute('aria-expanded')) === 'true');
  await press(panel.getByRole('button', { name: 'Collapse All' }));

  // 4. Every collapsed disclosure in the four groups opens.
  let count = 0;
  let opened = 0;
  for (const chart of groups) {
    panel = await open(page, id, chart);
    const closed = panel.locator('details:not([open]) > summary');
    const n = await closed.count();
    count += n;
    for (let i = 0; i < n; i++) {
      const t = closed.first();
      if (!(await t.isVisible())) break;
      await press(t);
      opened++;
    }
    check(`no-overflow-expanded-${chart}-${width}`, !(await overflow(page)));
    await panel.screenshot({
      path: path.join(outDir, `${chart}-${slug(name)}-${width}-expanded.jpg`),
      type: 'jpeg',
      quality: 45,
    });
  }
  log('disclosures', { width, count, opened });
  check(`disclosures-open-${width}`, opened === count);
  report[`consoleErrors${width}`] = page.errors;
  check(`no-console-errors-${width}`, page.errors.length === 0, { errors: page.errors });
  await page.close();
}

// 5. Reduced motion: nothing in the four groups animates or transitions.
{
  const page = await session(1440, 'reduce');
  const moving = [];
  for (const chart of groups) {
    const panel = await open(page, ids[0].id, chart);
    moving.push(
      ...(
        await panel.evaluate((root) =>
          [...root.querySelectorAll('*')]
            .filter((el) => {
              const s = getComputedStyle(el);
              const long = (v) => v.split(',').some((t) => parseFloat(t) > 0.011);
              return (
                (s.animationName !== 'none' && long(s.animationDuration)) ||
                long(s.transitionDuration)
              );
            })
            .map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''}`)
            .slice(0, 5),
        )
      ).map((m) => `${chart}: ${m}`),
    );
  }
  check('reduced-motion-still', moving.length === 0, { moving });
  await page.close();
}

// 6. Opt-in, isolated databases only (it saves): UX_CORE_MISSING=<propertyId> clears that
// property's vacancy through Edit Property, then checks every group's incomplete state.
const missing = process.env.UX_CORE_MISSING;
if (missing) {
  for (const width of [1440, 390]) {
    const page = await session(width);
    if (width === 1440) {
      await open(page, missing, 'equity');
      await page.getByRole('button', { name: 'Edit assumptions' }).last().click();
      await page.waitForURL(/\/properties\/.+\/edit/);
      await page.getByLabel('Vacancy (%)', { exact: true }).fill('');
      await Promise.all([
        page.waitForURL(/\/roi-analysis/, { timeout: 60000 }),
        page.getByRole('button', { name: 'Save and return to ROI' }).click(),
      ]);
    }
    for (const chart of groups) {
      const panel = await open(page, missing, chart);
      await panel.screenshot({
        path: path.join(outDir, `missing-${chart}-${width}.jpg`),
        type: 'jpeg',
        quality: 55,
      });
      check(
        `missing-${chart}-${width}`,
        (await panel
          .getByRole('heading', { name: 'Complete your assumptions to see charts' })
          .count()) === 1 && (await panel.locator('svg[role="img"]').count()) === 0,
      );
      check(`missing-no-overflow-${chart}-${width}`, !(await overflow(page)));
    }
    check(`missing-no-console-errors-${width}`, page.errors.length === 0, { errors: page.errors });
    await page.close();
  }
}

writeFileSync(path.join(outDir, 'ux-core-report.json'), JSON.stringify(report, null, 2));
await browser.close();
if (report.failures.length) {
  console.error('FAILED:', report.failures.join(', '));
  process.exitCode = 1;
}
