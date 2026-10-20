// Paired reference/RocketRental chart captures at a MATCHED card width, plus the
// rendered fonts and y-axis ticks of each card. RocketRental must be an isolated
// build whose property holds the RealROI sample (tests/analysis/load-realroi-sample.mts).
// node tests/analysis/realroi-pairs-runtime.mjs <refUrl> <isolatedAppUrl> <outDir> [propertyId]
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [ref, app, outDir, propertyId = 'seed-property-elm'] = process.argv.slice(2);
if (!ref || !app || !outDir) throw Error('usage: <refUrl> <isolatedAppUrl> <outDir> [propertyId]');
if (/:3100\b/.test(app)) throw Error('Use an isolated app, not the live 3100.');
mkdirSync(outDir, { recursive: true });

// [id, title, main tab, Charts sub-tab (reference name), file slug]
const cards = [
  ['C1', 'Net Cash Flow by Year', 'Summary', null, 'summary-net-cashflow-y5'],
  ['C6', 'Equity Composition vs Debt Paydown', 'Charts', 'Equity', 'charts-equity-composition-y30'],
  ['C7', 'Value vs Mortgage Balance', 'Charts', 'Equity', 'charts-value-vs-mortgage-y30'],
  ['C8', 'Cash Flow & Cumulative', 'Charts', 'Cash Flow', 'charts-cashflow-cumulative-y10'],
  ['C9', 'Income to Cash Flow Bridge', 'Charts', 'Cash Flow', 'charts-cashflow-bridge-y10'],
  ['C11', 'Principal vs Interest Over Time', 'Charts', 'Amortization', 'charts-amortization-area'],
  ['C14', 'Exit Analysis & Comparison', 'Charts', 'Exit Analysis', 'charts-exit-y10-selected'],
  ['C18', 'Equity Growth by Scenario', 'Scenarios', null, 'scenarios-equity-growth'],
  ['C19', 'Investment Growth Over Time', 'Benchmarks', null, 'benchmarks-growth-indexed'],
  ['C20', 'Risk vs Return', 'Benchmarks', null, 'benchmarks-risk-return'],
  ['C22', 'Annualized Returns Comparison', 'Compare', null, 'compare-annualized-bars'],
];

const fontProbe = () => ({
  inter: document.fonts.check('600 14px Inter'),
  mono: document.fonts.check('700 18px "JetBrains Mono"'),
  loaded: [...document.fonts]
    .filter((f) => f.status === 'loaded')
    .map((f) => `${f.family} ${f.weight}`),
});
async function describe(card) {
  return card.evaluate((el) => {
    const title = el.querySelector('h2, h3');
    const figure = [...el.querySelectorAll('*')].find(
      (n) => /JetBrains/.test(getComputedStyle(n).fontFamily) && n.textContent?.trim(),
    );
    const ticks = [...el.querySelectorAll('svg text')]
      .map((t) => t.textContent.trim())
      .filter((t) => /^-?\$-?[\d.]+k$|^\d+(\.\d+)?%?$/.test(t));
    return {
      width: Math.round(el.getBoundingClientRect().width),
      titleFont: title ? getComputedStyle(title).fontFamily : null,
      figureFont: figure ? getComputedStyle(figure).fontFamily : null,
      ticks: [...new Set(ticks)],
    };
  });
}
const browser = await chromium.launch();
const report = { at: new Date().toISOString(), ref, app, propertyId, cards: {} };

const rp = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await rp.goto(`${ref}/demo`);
await rp.waitForLoadState('networkidle');
const rr = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await rr.goto(`${app}/sign-in`);
await rr.locator('input[name="email"]').fill('jordan.mills@rocketrental.example');
await rr.locator('input[name="password"]').fill('JordanDemo#2026');
await Promise.all([
  rr.waitForURL((u) => !u.pathname.startsWith('/sign-in')),
  rr.keyboard.press('Enter'),
]);
await rr.goto(`${app}/roi-analysis?property=${propertyId}`);
await rr.getByText('Net Cash Flow by Year').first().waitFor({ timeout: 60000 });
report.fonts = {
  reference: await rp.evaluate(fontProbe),
  rocketRental: await rr.evaluate(fontProbe),
};

async function open(page, isRef, tab, sub) {
  const click = async (name) => {
    const target = isRef
      ? page
          .getByRole('button', { name, exact: true })
          .or(page.getByRole('tab', { name, exact: true }))
      : page.getByRole('tab', { name, exact: true });
    await target.first().click();
  };
  await click(tab);
  if (sub) await click(sub);
  if (
    !isRef &&
    tab === 'Compare' &&
    (await page.getByText('Choose at least one reference asset').count())
  )
    for (const name of ['S&P 500', 'Nasdaq 100'])
      await page.getByLabel(name, { exact: false }).first().check();
  // The reference opens with Optimistic and Conservative on; add the same unsaved examples.
  if (!isRef && tab === 'Scenarios')
    for (const name of ['Optimistic', 'Conservative']) {
      const chip = page.locator(`button[title^="Add the ${name} example"]`);
      if (await chip.count()) await chip.first().click();
    }
  await page.waitForTimeout(isRef ? 1800 : 700); // Recharts mount animation / clip reveal
}
for (const [id, title, tab, sub, slug] of cards) {
  const entry = {};
  await open(rp, true, tab, sub);
  const refCard = rp
    .locator('h2, h3', { hasText: title })
    .filter({ visible: true })
    .first()
    .locator(
      'xpath=ancestor::div[(contains(@class,"rounded") and contains(@class,"bg-white")) or contains(concat(" ",@class," ")," card ")][1]',
    );
  await refCard.scrollIntoViewIfNeeded();
  entry.reference = await describe(refCard);
  await refCard.screenshot({ path: path.join(outDir, `ref-pair-${slug}-1440.png`) });
  await open(rr, false, tab, sub === 'Exit Analysis' ? 'Exit Analysis' : sub);
  const rrCard = rr.getByText(title, { exact: true }).first().locator('xpath=ancestor::section[1]');
  await rrCard.evaluate((el, w) => {
    el.style.width = `${w}px`;
    el.style.maxWidth = 'none';
  }, entry.reference.width);
  await rr.waitForTimeout(500);
  await rrCard.scrollIntoViewIfNeeded();
  entry.rocketRental = await describe(rrCard);
  await rrCard.screenshot({ path: path.join(outDir, `rr-pair-${slug}-1440.png`) });
  report.cards[id] = entry;
  console.log(
    id,
    JSON.stringify({
      ref: entry.reference.ticks,
      rr: entry.rocketRental.ticks,
      w: [entry.reference.width, entry.rocketRental.width],
    }),
  );
}
writeFileSync(path.join(outDir, 'pairs-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.fonts));
await browser.close();
