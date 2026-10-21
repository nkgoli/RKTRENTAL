// Exit, Sensitivity and Scenarios (the decision views): captures and checks against a
// production build.
//   node tests/analysis/ux-decisions-runtime.mjs <baseUrl> <outDir> [propertyNamePattern]
// Read-only by default: probes, ranges, view toggles and example chips stay unsaved, and
// leaving a page discards them. It refuses the live app port. Two opt-in steps save, so
// use them only on an isolated database:
//   UX_DECISIONS_WRITE=<propertyId>    create, save, reload, edit, clear and remove a scenario
//   UX_DECISIONS_MISSING=<propertyId>  clear that property's vacancy through Edit Property
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [base, outDir, only = ''] = process.argv.slice(2);
if (!base || !outDir) throw Error('usage: <baseUrl> <outDir> [propertyNamePattern]');
if (/:3100\b/.test(base)) throw Error('Refusing to run against the live app.');
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const report = {
  base,
  at: new Date().toISOString(),
  properties: [],
  views: [],
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
const shot = (locator, name, quality = 55) =>
  locator.screenshot({ path: path.join(outDir, `${name}.jpg`), type: 'jpeg', quality });

async function session(width) {
  const page = await browser.newPage({
    viewport: { width, height: width > 500 ? 900 : 844 },
    hasTouch: width < 500,
    isMobile: width < 500,
  });
  page.errors = [];
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && page.errors.push(`${r.status()} ${r.url()}`));
  // Leaving a page discards unsaved probes and chips; nothing else is ever accepted.
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
const views = {
  exit: () => [`view=charts&chart=exit`, '#roi-chart-panel-exit'],
  sensitivity: () => [`view=charts&chart=sensitivity`, '#roi-chart-panel-sensitivity'],
  scenarios: () => [`view=scenarios`, '#roi-section-panel-scenarios'],
};
async function open(page, id, view) {
  const [query, selector] = views[view]();
  await page.goto(`${base}/roi-analysis?property=${id}&${query}`);
  await page.getByRole('tab', { name: 'Summary', exact: true }).waitFor({ timeout: 60000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  const panel = page.locator(selector);
  await panel.waitFor();
  return panel;
}
const overflow = (page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
// A zoomed-out phone layout keeps scrollWidth == clientWidth, so check the layout width too.
const layoutWidth = (page) => page.evaluate(() => window.innerWidth);
// Card titles, subtitles, basis tags, disclosures and overlapping SVG labels.
const describe = (panel) =>
  panel.evaluate((root) => {
    const overlap = (a, b) =>
      a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const cards = [...root.querySelectorAll('section')].filter((s) =>
      s.querySelector(':scope > header h2, :scope h3'),
    );
    return {
      height: Math.round(root.getBoundingClientRect().height),
      cards: cards.map((s) => {
        const texts = [...s.querySelectorAll('svg text')].filter((t) => t.textContent.trim());
        const boxes = texts.map((t) => t.getBoundingClientRect());
        let overlaps = 0;
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) if (overlap(boxes[i], boxes[j])) overlaps++;
        return {
          title: (
            s.querySelector(':scope > header h2') ?? s.querySelector('h3')
          )?.textContent.trim(),
          subtitle: s.querySelector(':scope > header p')?.textContent.trim() ?? '',
          basis: [...s.querySelectorAll(':scope > header [aria-label="Data basis"] li')].map((li) =>
            li.textContent.trim(),
          ),
          disclosures: [...s.querySelectorAll('details > summary')].map((x) =>
            x.textContent.trim(),
          ),
          overlaps,
        };
      }),
    };
  });

// 1. The properties to sample.
const ids = [];
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

// 2. Every view for every property at both widths.
for (const width of [1440, 390]) {
  const page = await session(width);
  for (const { id, name } of ids) {
    for (const view of Object.keys(views)) {
      const panel = await open(page, id, view);
      await shot(panel, `${view}-${slug(name)}-${width}`);
      const d = await describe(panel);
      report.views.push({ width, name, view, ...d });
      check(`no-overflow-${view}-${slug(name)}-${width}`, !(await overflow(page)));
      check(`layout-width-${view}-${slug(name)}-${width}`, (await layoutWidth(page)) === width);
      check(
        `no-label-overlap-${view}-${slug(name)}-${width}`,
        d.cards.every((c) => c.overlaps === 0),
        { overlaps: d.cards.filter((c) => c.overlaps).map((c) => [c.title, c.overlaps]) },
      );
    }
  }

  // 3. Controls on the first property with an exit comparison: keyboard or touch.
  const desk = width > 500;
  const press = async (locator, key = 'Enter') => {
    await locator.scrollIntoViewIfNeeded();
    if (desk) {
      await locator.focus();
      await page.keyboard.press(key);
    } else await locator.tap();
  };
  let target = null;
  for (const p of ids) {
    const panel = await open(page, p.id, 'exit');
    if (await panel.getByRole('group', { name: /Total cash back by exit year/ }).count()) {
      target = p;
      break;
    }
  }
  if (!target) {
    check(`exit-property-found-${width}`, false);
  } else {
    const { id } = target;
    log('controls-property', { width, name: target.name });
    // Exit: year buttons, landmark chips, the summary view and a temporary probe.
    let panel = await open(page, id, 'exit');
    const years = panel.getByRole('group', { name: 'Select Exit Year' });
    const first = years.getByRole('button').first();
    const firstYear = (await first.textContent()).replace('y', '');
    await press(first);
    check(
      `exit-year-select-${width}`,
      (await panel.getByText(`Year ${firstYear} Exit Summary`).count()) === 1,
    );
    const best = panel.getByRole('button', { name: /^Best IRR: Year/ });
    if (await best.count()) {
      await press(best);
      check(`exit-best-irr-chip-${width}`, (await best.getAttribute('aria-pressed')) === 'true');
    }
    const cashBack = panel.getByRole('button', { name: 'Total Cash Back', exact: true });
    await press(cashBack);
    check(`exit-view-toggle-${width}`, (await cashBack.getAttribute('aria-pressed')) === 'true');
    const probeYear = panel.getByLabel('Probe exit year', { exact: true });
    const saved = await probeYear.inputValue();
    await probeYear.fill('2.5');
    await press(panel.getByRole('button', { name: 'Update exit comparison' }));
    check(
      `exit-probe-invalid-${width}`,
      /whole number/.test(await panel.getByRole('alert').textContent()),
    );
    await shot(panel, `exit-probe-invalid-${width}`);
    await probeYear.fill('12');
    await shot(panel, `exit-probe-pending-${width}`);
    await press(panel.getByRole('button', { name: 'Update exit comparison' }));
    check(
      `exit-probe-applied-${width}`,
      (await panel.getByText('Year 10 Exit Summary').count()) === 1 &&
        (await years.getByRole('button', { name: '12y' }).count()) === 1,
    );
    await shot(panel, `exit-probe-applied-${width}`);
    const reset = panel.getByRole('button', { name: 'Reset to saved' });
    if (await reset.count()) {
      await press(reset);
    } else {
      await probeYear.fill(saved);
      await press(panel.getByRole('button', { name: 'Update exit comparison' }));
    }
    check(`exit-probe-reset-${width}`, (await probeYear.inputValue()) === saved);

    // Sensitivity: metric, timeframes, values, colourblind palette, ranges and cells.
    panel = await open(page, id, 'sensitivity');
    const map = panel.getByRole('group', { name: /by monthly rent and vacancy rate/ });
    check(`sensitivity-base-marker-${width}`, (await map.locator('polygon').count()) === 1);
    const live = map.locator('xpath=..').locator('[aria-live]');
    if (desk) {
      await map.focus();
      await page.keyboard.press('ArrowRight');
      check(
        `sensitivity-keyboard-${width}`,
        /\(your assumptions\)$/.test(await live.textContent()),
        {
          spoken: await live.textContent(),
        },
      );
      await page.keyboard.press('ArrowRight');
    } else {
      await map.scrollIntoViewIfNeeded();
      const box = await map.locator('svg').boundingBox();
      await page.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height * 0.3);
      check(`sensitivity-tap-${width}`, /^Monthly rent \$/.test(await live.textContent()), {
        spoken: await live.textContent(),
      });
    }
    await shot(panel, `sensitivity-readout-${width}`);
    const table = panel.getByRole('table', {
      name: /cash-on-cash · percentages rounded/,
      includeHidden: true,
    });
    const cells = await table.evaluate((t) =>
      [...t.querySelectorAll('tbody td')].map((td) => td.childNodes[0]?.textContent ?? ''),
    );
    check(
      `sensitivity-one-decimal-${width}`,
      cells.length > 0 && cells.every((v) => /^-?\d+\.\d%$|^Unavailable$/.test(v)),
      { sample: cells.slice(0, 4) },
    );
    const fill = await map.locator('rect').first().getAttribute('fill');
    await press(panel.getByLabel('Colorblind-safe'), 'Space');
    check(
      `sensitivity-colorblind-${width}`,
      (await map.locator('rect').first().getAttribute('fill')) !== fill,
    );
    await press(panel.getByLabel('Show values'), 'Space');
    check(`sensitivity-values-${width}`, /\d%/.test(await map.textContent()));
    const y5 = panel.getByRole('button', { name: 'Year 5', exact: true });
    if (await y5.isEnabled()) {
      await press(y5);
      check(
        `sensitivity-year5-${width}`,
        (await panel
          .getByRole('table', { name: /Year 5 cash-on-cash/, includeHidden: true })
          .count()) === 1,
      );
    }
    await panel.getByLabel('Sensitivity metric').selectOption('irr');
    check(
      `sensitivity-irr-${width}`,
      (await panel
        .getByRole('table', { name: /Hold-period leveraged IRR/, includeHidden: true })
        .count()) === 1,
    );
    await shot(panel, `sensitivity-irr-values-${width}`);
    const customize = panel.getByRole('button', { name: 'Customize Ranges' });
    await press(customize);
    check(
      `sensitivity-customize-${width}`,
      (await customize.getAttribute('aria-expanded')) === 'true',
    );
    const minRent = panel.getByLabel('Minimum rent ($ / month)', { exact: true });
    await minRent.fill('bad');
    await press(panel.getByRole('button', { name: 'Update sensitivity' }));
    check(
      `sensitivity-invalid-${width}`,
      /Minimum rent/.test(await panel.getByRole('alert').textContent()),
    );
    await shot(panel, `sensitivity-invalid-${width}`);
    await press(panel.getByRole('button', { name: /^Reset/ }));
    check(`sensitivity-reset-${width}`, (await panel.getByRole('alert').count()) === 0);

    // Scenarios: example chip (unsaved), Δ view, focus a case, horizon.
    panel = await open(page, id, 'scenarios');
    const tiles = () => panel.locator('button[aria-pressed]').filter({ has: page.locator('dl') });
    const before = await tiles().count();
    const chip = panel.getByRole('button', { name: /Best Case.*\(add example\)/ });
    if (await chip.count()) {
      await press(chip);
      await page.waitForTimeout(300);
      check(`scenario-example-chip-${width}`, (await tiles().count()) === before + 1);
    }
    const delta = panel.getByRole('button', { name: 'Δ vs Base' });
    await press(delta);
    check(`scenario-delta-view-${width}`, (await delta.getAttribute('aria-pressed')) === 'true');
    const tile = tiles().last();
    await press(tile);
    check(`scenario-focus-tile-${width}`, (await tile.getAttribute('aria-pressed')) === 'true');
    const horizon = panel.getByRole('group', { name: 'Scenario horizon' });
    if (await horizon.count()) {
      const y5h = horizon.getByRole('button', { name: 'Y5' });
      if (await y5h.count()) {
        await press(y5h);
        check(`scenario-horizon-${width}`, (await y5h.getAttribute('aria-pressed')) === 'true');
      }
    }
    await shot(panel, `scenarios-compare-${width}`);

    // 4. Every collapsed disclosure in the three views opens.
    let count = 0;
    let opened = 0;
    for (const view of Object.keys(views)) {
      panel = await open(page, id, view);
      const closed = panel.locator('details:not([open]) > summary');
      for (let guard = 0; guard < 80; guard++) {
        const visible = [];
        for (const s of await closed.all()) if (await s.isVisible()) visible.push(s);
        if (!visible.length) break;
        count++;
        // The `:not([open])` locator moves on once this one opens, so hold the element.
        const summary = await visible[0].elementHandle();
        await summary.scrollIntoViewIfNeeded();
        if (desk) {
          await summary.focus();
          await page.keyboard.press('Enter');
        } else await summary.tap();
        if (await summary.evaluate((s) => s.parentElement.open)) opened++;
        else break;
      }
      check(`no-overflow-expanded-${view}-${width}`, !(await overflow(page)));
      check(`layout-width-expanded-${view}-${width}`, (await layoutWidth(page)) === width);
      await shot(panel, `${view}-${slug(target.name)}-${width}-expanded`, 45);
    }
    log('disclosures', { width, count, opened });
    check(`disclosures-open-${width}`, opened === count);
  }
  report[`consoleErrors${width}`] = page.errors;
  check(`no-console-errors-${width}`, page.errors.length === 0, { errors: page.errors });
  await page.close();
}

// 5. Opt-in (saves): a scenario is created, saved, reloaded, edited, cleared and removed.
const write = process.env.UX_DECISIONS_WRITE;
if (write) {
  const page = await session(1440);
  const save = async (expect) => {
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.getByText(/Saved draft - revision \d+/).waitFor({ timeout: 60000 });
    log('saved', {
      expect,
      status: await page.getByText(/Saved draft - revision \d+/).textContent(),
    });
  };
  let panel = await open(page, write, 'scenarios');
  const start = await panel.getByText(/^\d+ of 20 scenarios$/).textContent();
  await panel.getByRole('button', { name: 'Create scenario' }).click();
  const index = Number(start.split(' ')[0]);
  const name = page.locator(`[id="scenarios.${index}.name"]`);
  await name.fill('UX probe case');
  const rent = page.locator(`[id="scenarios.${index}.overrides.income.monthlyRent"]`);
  await rent.evaluate((el) => (el.closest('details').open = true));
  await rent.fill('2500');
  await page.waitForTimeout(300);
  // The Key Differences chip names the override (its title is the field label).
  check('write-diff-shown', (await panel.locator('[title^="Scheduled rent"]').count()) > 0);
  await shot(panel, 'write-edited-1440');
  await save('created');
  panel = await open(page, write, 'scenarios');
  check(
    'write-reloaded',
    (await page.locator(`[id="scenarios.${index}.name"]`).inputValue()) === 'UX probe case',
  );
  check(
    'write-override-kept',
    (await page.locator(`[id="scenarios.${index}.overrides.income.monthlyRent"]`).inputValue()) ===
      '2500',
  );
  await page
    .locator(`[id="scenarios.${index}.overrides.income.monthlyRent"]`)
    .evaluate((el) => (el.closest('details').open = true));
  await page.locator(`[id="scenarios.${index}.overrides.income.monthlyRent"]`).fill('');
  await page.waitForTimeout(300);
  check(
    'write-cleared-inherits',
    (await panel.getByText('Inherits every base assumption').count()) > 0,
  );
  await panel.getByRole('button', { name: 'Remove UX probe case' }).click();
  await save('removed');
  panel = await open(page, write, 'scenarios');
  check('write-reverted', (await panel.getByText(/^\d+ of 20 scenarios$/).textContent()) === start);
  check('write-no-console-errors', page.errors.length === 0, { errors: page.errors });
  await page.close();
}

// 6. Opt-in (saves): clear a property's vacancy, then check each view's incomplete state.
const missing = process.env.UX_DECISIONS_MISSING;
if (missing) {
  for (const width of [1440, 390]) {
    const page = await session(width);
    if (width === 1440) {
      await open(page, missing, 'exit');
      await page.getByRole('button', { name: 'Edit assumptions' }).last().click();
      await page.waitForURL(/\/properties\/.+\/edit/);
      await page.getByLabel('Vacancy (%)', { exact: true }).fill('');
      await Promise.all([
        page.waitForURL(/\/roi-analysis/, { timeout: 60000 }),
        page.getByRole('button', { name: 'Save and return to ROI' }).click(),
      ]);
    }
    for (const view of Object.keys(views)) {
      const panel = await open(page, missing, view);
      await shot(panel, `missing-${view}-${width}`);
      const text = await panel.textContent();
      check(
        `missing-${view}-${width}`,
        view === 'scenarios'
          ? /projection|out of date|unavailable/i.test(text) &&
              (await panel.locator('svg[role="img"]').count()) === 0
          : (await panel
              .getByRole('heading', { name: 'Complete your assumptions to see charts' })
              .count()) === 1,
      );
      check(`missing-no-invented-values-${view}-${width}`, !/\$0\.00|NaN|undefined/.test(text));
      check(`missing-no-overflow-${view}-${width}`, !(await overflow(page)));
    }
    check(`missing-no-console-errors-${width}`, page.errors.length === 0, { errors: page.errors });
    await page.close();
  }
}

writeFileSync(path.join(outDir, 'ux-decisions-report.json'), JSON.stringify(report, null, 2));
await browser.close();
if (report.failures.length) {
  console.error('FAILED:', report.failures.join(', '));
  process.exitCode = 1;
}
