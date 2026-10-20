// Renders every RealROI chart (C1–C25) on an ISOLATED startup database and
// reports which chart cards appear, the demo-label notice and console errors.
// Never point it at the live app: Compare picks two assets in an unsaved draft.
// node tests/analysis/startup-charts-runtime.mjs <baseUrl> <outDir> [propertyId]
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [base, outDir, propertyId = 'seed-property-maple', unitId = 'seed-unit-maple-7'] =
  process.argv.slice(2);
if (!base || !outDir) throw Error('usage: <baseUrl> <outDir> [propertyId]');
if (/:3100\b/.test(base)) throw Error('Refusing to run against the live app on 3100.');
mkdirSync(outDir, { recursive: true });

const charts = {
  summary: [
    ['C1', 'Net Cash Flow by Year'],
    ['C2', 'Outcome'],
    ['C3', 'Deal Snapshot'],
    ['C4', 'Fix My Deal'],
    ['C5', 'Cash Flow & Equity Projections'],
  ],
  Equity: [
    ['C6', 'Equity Composition vs Debt Paydown'],
    ['C7', 'Value vs Mortgage Balance'],
  ],
  'Cash Flow': [
    ['C8', 'Cash Flow & Cumulative'],
    ['C9', 'Income to Cash Flow Bridge'],
  ],
  Expenses: [['C10', 'Operating Expenses']],
  Amortization: [
    ['C11', 'Principal vs Interest Over Time'],
    ['C12', 'Loan Payoff Breakdown'],
    ['C13', 'Loan Amortization Schedule'],
    ['C17', 'Balance at'],
  ],
  'Exit Analysis': [['C14', 'Exit Analysis & Comparison']],
  Sensitivity: [
    ['C15', 'Sensitivity'],
    ['C16', 'Break-even'],
  ],
  scenarios: [['C18', 'Equity Growth by Scenario']],
  benchmarks: [
    ['C19', 'Investment Growth Over Time'],
    ['C20', 'Risk vs Return'],
  ],
  compare: [
    ['C21', 'Investment Growth Over Time'],
    ['C22', 'Annualized Returns Comparison'],
    ['C23', 'Multi-Dimensional Comparison'],
    ['C24', 'Side-by-Side Comparison'],
  ],
  listing: [['C25', 'Rental Distribution']],
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const report = { base, propertyId, at: new Date().toISOString(), steps: {}, notes: [] };

async function check(step, shot) {
  await page.waitForTimeout(600);
  const text = await page.locator('main').innerText();
  const plots = await page.locator('main svg').count();
  report.steps[step] = {
    plots,
    found: charts[step].map(([id, title]) => [id, title, text.includes(title)]),
  };
  await page.screenshot({ path: path.join(outDir, `${shot}.png`), fullPage: true });
}

await page.goto(`${base}/sign-in`);
await page.locator('input[name="email"]').fill('jordan.mills@rocketrental.example');
await page.locator('input[name="password"]').fill('JordanDemo#2026');
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/sign-in')),
  page.keyboard.press('Enter'),
]);

await page.goto(`${base}/roi-analysis?property=${propertyId}`);
await page.getByText('Net Cash Flow by Year').first().waitFor({ timeout: 60000 });
const main = await page.locator('main').innerText();
report.demoNotice = /fictional demo value/i.test(main);
report.loadMessage = (main.match(/(New analysis[^\n]*|Loaded [^\n]*)/) ?? [''])[0];
await check('summary', 'summary');

await page.getByRole('tab', { name: 'Charts', exact: true }).click();
for (const sub of [
  'Equity',
  'Cash Flow',
  'Expenses',
  'Amortization',
  'Exit Analysis',
  'Sensitivity',
]) {
  await page.getByRole('tab', { name: sub, exact: true }).click();
  await check(sub, `charts-${sub.toLowerCase().replace(/ /g, '-')}`);
}
await page.getByRole('tab', { name: 'Scenarios', exact: true }).click();
await check('scenarios', 'scenarios');
await page.getByRole('tab', { name: 'Benchmarks', exact: true }).click();
await check('benchmarks', 'benchmarks');
await page.getByRole('tab', { name: 'Compare', exact: true }).click();
await page.waitForTimeout(600);
if (await page.getByText('Choose at least one reference asset').count()) {
  report.notes.push(
    'Compare had no saved selection; picked S&P 500 and Nasdaq 100 in an unsaved draft.',
  );
  for (const name of ['S&P 500', 'Nasdaq 100'])
    await page.getByLabel(name, { exact: false }).first().check();
}
await check('compare', 'compare');

// Unit comps (sandbox provider, no keys): the vacant 3A compares its listed rent.
await page.goto(`${base}/properties/${propertyId}/listing?unit=${unitId}`);
await page
  .getByText('Rental Distribution')
  .first()
  .waitFor({ timeout: 60000 })
  .catch(() => {});
report.listingUrl = page.url();
await check('listing', 'listing');

report.consoleErrors = errors;
const found = Object.values(report.steps).flatMap((s) => s.found);
report.missing = found.filter((f) => !f[2]).map((f) => f[0]);
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    demoNotice: report.demoNotice,
    load: report.loadMessage,
    missing: report.missing,
    notes: report.notes,
    consoleErrors: errors.length,
  }),
);
await browser.close();
