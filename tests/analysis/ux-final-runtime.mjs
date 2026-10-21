// Final ROI polish: loading, load-failure, status, phone tab cues, skip link, basis tints and
// rent comps text, at 1440 and 390 px against a production build.
//   node tests/analysis/ux-final-runtime.mjs <baseUrl> <outDir> [propertyId...]
// Read-only: it never saves. Loading and failure states are produced by delaying or aborting
// the page's own server-action requests in the browser, so nothing reaches the database.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [base, outDir, ...ids] = process.argv.slice(2);
if (!base || !outDir) throw Error('usage: <baseUrl> <outDir> [propertyId...]');
const properties = ids.length ? ids : ['seed-property-maple', 'seed-property-harbor'];
if (/:3100\b/.test(base) && properties.includes('seed-property-elm'))
  throw Error('Do not open 18 Elm Street on the live app.');
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
    reducedMotion: 'reduce',
  });
  page.errors = [];
  page.on('console', (m) => {
    // Aborted requests are this harness's own failure simulation.
    if (m.type() === 'error' && !page.simulating)
      page.errors.push(`${m.text()} ${m.location()?.url ?? ''}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !page.simulating) page.errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
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
const shot = (target, name, fullPage = false) =>
  target.screenshot({
    path: path.join(outDir, `${name}.jpg`),
    type: 'jpeg',
    quality: fullPage ? 45 : 60,
    ...(fullPage ? { fullPage } : {}),
  });
const overflow = (page) =>
  page.evaluate(
    (width) =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ||
      window.innerWidth !== width,
    page.viewportSize().width,
  );
async function ready(page) {
  await page.getByRole('tab', { name: 'Summary', exact: true }).waitFor({ timeout: 60000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}
const roiPage = (url) => url.pathname === '/roi-analysis';
/** Server actions are POSTs to the page itself. */
const isAction = (request) => request.method() === 'POST' && !!request.headers()['next-action'];

for (const width of [1440, 390]) {
  const page = await session(width);
  const tap = (locator) => (width < 500 ? locator.tap() : locator.click());

  // Chooser.
  await page.goto(`${base}/roi-analysis`);
  await page.getByRole('heading', { name: 'Choose a property' }).waitFor();
  await shot(page, `chooser-${width}`);
  check(`chooser-no-overflow-${width}`, !(await overflow(page)));

  // Loading: hold the analysis requests so the loading state stays on screen.
  const id = properties[0];
  page.simulating = true;
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route(roiPage, async (route) => {
    if (!isAction(route.request())) return route.continue();
    await held;
    await route.continue().catch(() => {});
  });
  await page.goto(`${base}/roi-analysis?property=${id}`);
  // While the analysis loads the page must say so, never fall back to the property chooser.
  await page.waitForTimeout(1500);
  const opening = await page.evaluate(() => ({
    loading: document.body.innerText.includes('Loading analysis'),
    chooser:
      !!document.querySelector('h1') && document.body.innerText.includes('Choose a property'),
  }));
  await shot(page, `loading-${width}`);
  check(`loading-shown-not-chooser-${width}`, opening.loading && !opening.chooser, opening);
  check(
    `loading-announced-${width}`,
    (await page.getByRole('status').filter({ hasText: 'Loading analysis' }).count()) > 0,
  );
  check(`loading-no-overflow-${width}`, !(await overflow(page)));
  release();
  await page.unroute(roiPage);
  await ready(page);

  // Load failure: abort the analysis requests, then recover with Retry.
  await page.route(roiPage, (route) =>
    isAction(route.request()) ? route.abort() : route.continue(),
  );
  await page.goto(`${base}/roi-analysis?property=${id}`);
  const failed = page.getByText('Could not load analysis', { exact: false });
  await failed.first().waitFor({ timeout: 30000 });
  await shot(page, `load-error-${width}`);
  const retry = page.getByRole('button', { name: /Retry loading/ });
  check(`load-error-retry-${width}`, (await retry.count()) === 1);
  check(
    `load-error-heading-${width}`,
    (await page.getByRole('heading', { name: /did not load/ }).count()) === 1,
  );
  check(`load-error-no-overflow-${width}`, !(await overflow(page)));
  await page.unroute(roiPage);
  await tap(retry);
  await ready(page);
  page.simulating = false;
  check(`load-error-retry-recovers-${width}`, true);

  for (const property of properties) {
    await page.goto(`${base}/roi-analysis?property=${property}`);
    await ready(page);
    const slug = property.replace('seed-property-', '');
    // The load confirmation is announced but not shown beside the Assumptions source.
    const status = await page.evaluate(() => {
      const el = document.querySelector('p[role="status"][aria-live="polite"]');
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return { text: el.textContent, visible: box.width > 2 && box.height > 2 };
    });
    const source = await page
      .getByRole('region', { name: 'Baseline assumptions' })
      .locator('span')
      .first()
      .textContent();
    check(`load-status-not-repeated-${slug}-${width}`, !status?.text || !status.visible, {
      status,
      source,
    });
    await shot(page, `summary-top-${slug}-${width}`);

    // Phone tab row: hidden tabs are cued at the edge they hide behind.
    const tabs = page.getByRole('tablist', { name: 'ROI sections' });
    const before = await tabs.getAttribute('data-more');
    const fits = await tabs.evaluate((el) => el.scrollWidth <= el.clientWidth);
    check(`tabs-cue-at-start-${slug}-${width}`, fits ? !before : /end/.test(before ?? ''), {
      before,
      fits,
    });
    await tap(page.getByRole('tab', { name: 'Compare', exact: true }));
    await page.waitForTimeout(150);
    const after = await tabs.getAttribute('data-more');
    const inView = await page.evaluate(() => {
      const row = document.querySelector('[role="tablist"][aria-label="ROI sections"]');
      const tab = document.getElementById('roi-section-tab-compare');
      const r = row.getBoundingClientRect();
      const t = tab.getBoundingClientRect();
      return t.left >= r.left - 1 && t.right <= r.right + 1;
    });
    check(`tabs-selected-in-view-${slug}-${width}`, inView);
    check(`tabs-cue-after-scroll-${slug}-${width}`, fits ? !after : /start/.test(after ?? ''), {
      after,
    });
    await shot(tabs, `tabs-compare-${slug}-${width}`);

    // A tap or click never reveals the keyboard-only skip link.
    const skip = await page.evaluate(() => {
      const link = [...document.querySelectorAll('a')].find((a) =>
        /Skip to main content/.test(a.textContent ?? ''),
      );
      const box = link?.getBoundingClientRect();
      return box ? { bottom: box.bottom, focused: document.activeElement === link } : null;
    });
    check(`skip-link-hidden-after-tap-${slug}-${width}`, !skip || skip.bottom <= 0, { skip });

    // Hypothetical market figures carry their own tint.
    await tap(page.getByRole('tab', { name: 'Benchmarks', exact: true }));
    const kinds = await page
      .locator('#roi-section-panel-benchmarks [aria-label="Data basis"] li')
      .evaluateAll((items) =>
        items.map((li) => [li.textContent, li.getAttribute('data-kind') ?? '']),
      );
    check(
      `basis-hypothetical-tint-${slug}-${width}`,
      kinds.some(([text, kind]) => /^Hypothetical/.test(text) && kind === 'hypothetical'),
      { kinds: kinds.slice(0, 6) },
    );
    await shot(page, `benchmarks-top-${slug}-${width}`);
    check(`no-overflow-${slug}-${width}`, !(await overflow(page)));
  }

  // The keyboard still reaches the skip link first.
  if (width > 500) {
    await page.goto(`${base}/roi-analysis?property=${id}`);
    await ready(page);
    await page.keyboard.press('Tab');
    const shown = await page.evaluate(() => {
      const a = document.activeElement;
      return (
        /Skip to main content/.test(a?.textContent ?? '') && a.getBoundingClientRect().top >= 0
      );
    });
    check('skip-link-on-keyboard-focus', shown);
    await shot(page, 'skip-link-keyboard-1440');
  }

  // Rent comps header text has no encoding damage.
  await page.goto(`${base}/rent-comps`);
  await page.waitForLoadState('networkidle');
  const text = await page.evaluate(() => document.body.innerText);
  check(`rent-comps-no-mojibake-${width}`, !/Â|â€/.test(text), {
    sample: (text.match(/.{0,30}Â.{0,30}/) ?? [''])[0],
  });
  await shot(page, `rent-comps-${width}`);

  check(`no-console-errors-${width}`, page.errors.length === 0, { errors: page.errors });
  await page.close();
}

// Opt-in, ISOLATED databases only: a Compare selection saved as a draft survives a reload,
// and removing it again restores the saved state.
const writeId = process.env.UX_FINAL_WRITE;
if (writeId) {
  if (/:3100\b/.test(base)) throw Error('Refusing to write to the live app.');
  const page = await session(1440);
  const compare = async () => {
    await page.goto(`${base}/roi-analysis?property=${writeId}&view=compare`);
    await ready(page);
    return page.locator('#roi-section-panel-compare');
  };
  const save = async () => {
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.getByText(/Saved draft - revision \d+/).waitFor();
    return Number((await page.getByText(/Saved draft - revision \d+/).textContent()).match(/\d+/));
  };
  let panel = await compare();
  const box = panel.getByRole('checkbox', { name: 'US Bonds' });
  const was = await box.isChecked();
  await box.click();
  const first = await save();
  panel = await compare();
  check(
    'compare-selection-saved',
    (await panel.getByRole('checkbox', { name: 'US Bonds' }).isChecked()) !== was,
    {
      revision: first,
    },
  );
  await shot(page, 'compare-saved-1440');
  await panel.getByRole('checkbox', { name: 'US Bonds' }).click();
  const second = await save();
  panel = await compare();
  check(
    'compare-selection-restored',
    (await panel.getByRole('checkbox', { name: 'US Bonds' }).isChecked()) === was,
    {
      revision: second,
    },
  );
  check('compare-write-no-console-errors', page.errors.length === 0, { errors: page.errors });
  await page.close();
}

await browser.close();
writeFileSync(path.join(outDir, 'ux-final-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ failures: report.failures }));
