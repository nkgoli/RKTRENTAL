// Keyboard and touch check for hero controls, rendered in Chromium.
// - Every link and button inside a hero is reachable with Tab, shows a visible focus ring and
//   sits fully inside the hero; on phones each one is at least 24px tall (stat rows 44px).
// - ROI Deal Snapshot: Monthly/Annual switches the lead figure, and each breakdown popover opens
//   from the keyboard, fits on screen without clipped text, closes on Escape and returns focus.
// Usage: node tests/hero-density/focus-check.mjs [baseURL]
// Saves popover screenshots under tests/hero-density/shots/controls/ (git-ignored).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://localhost:3117';
const shots = fileURLToPath(new URL('shots/controls/', import.meta.url));
mkdirSync(shots, { recursive: true });
const SIZES = [
  [1280, 900],
  [1024, 900],
  [820, 1100],
  [390, 844],
];
const HERO =
  '.summary-band, section[aria-labelledby="rent-due"], section[aria-labelledby="amount-due-title"]';

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL ${msg}`);
};

const browser = await chromium.launch();
async function signIn(email, password) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${base}/sign-in`);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 90000 }),
    page.press('input[name=password]', 'Enter'),
  ]);
  return page;
}
async function open(page, path, waitFor) {
  await page
    .goto(base + path, { waitUntil: 'networkidle' })
    .catch(() => page.goto(base + path, { waitUntil: 'networkidle' }));
  await page.waitForSelector(waitFor ?? HERO, { timeout: 60000 });
}

async function tabThrough(page, label, w) {
  const hero = page.locator(HERO).first();
  const targets = await hero.locator('a[href], button, summary').count();
  let reached = 0;
  await page.locator('body').focus();
  for (let i = 0; i < 120 && reached < targets; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate((sel) => {
      const el = document.activeElement;
      const band = el?.closest(sel);
      if (!band) return null;
      const r = el.getBoundingClientRect();
      const b = band.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        text: el.innerText.trim().slice(0, 40),
        height: r.height,
        stat: el.matches('.summary-stat'),
        ring:
          (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
          cs.boxShadow !== 'none',
        inside:
          r.left >= b.left - 1 &&
          r.right <= b.right + 1 &&
          r.top >= b.top - 1 &&
          r.bottom <= b.bottom + 1,
      };
    }, HERO);
    if (!info) continue;
    reached++;
    if (!info.ring) fail(`${label} @${w}: no focus ring on "${info.text}"`);
    if (!info.inside) fail(`${label} @${w}: "${info.text}" outside the hero`);
    if (w < 600 && info.height < (info.stat ? 44 : 24))
      fail(`${label} @${w}: "${info.text}" is ${Math.round(info.height)}px tall`);
  }
  if (reached !== targets) fail(`${label} @${w}: focused ${reached} of ${targets} controls`);
  console.log(
    `${String(w).padStart(4)} ${label.padEnd(34)} controls ${targets}, focused ${reached}`,
  );
}

async function roiControls(page, w) {
  const band = page.locator('section[aria-label="Deal Snapshot"]');
  const lead = band.locator('.summary-band-value');
  // Monthly / Annual
  await band.getByRole('button', { name: 'Annual' }).click();
  if (!/\/ year/.test(await lead.innerText())) fail(`ROI @${w}: Annual did not switch the figure`);
  if ((await band.getByRole('button', { name: 'Annual' }).getAttribute('aria-pressed')) !== 'true')
    fail(`ROI @${w}: Annual not pressed`);
  await band.getByRole('button', { name: 'Monthly' }).click();
  if (!/\/ month/.test(await lead.innerText())) fail(`ROI @${w}: Monthly did not switch back`);
  // Breakdown popovers: lead figure and the three stats, opened with the keyboard.
  const triggers = band.locator('button[aria-controls]');
  const n = await triggers.count();
  for (let i = 0; i < n; i++) {
    const trigger = triggers.nth(i);
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.locator(`[id="${await trigger.getAttribute('aria-controls')}"]`);
    if (!(await dialog.isVisible())) {
      fail(`ROI @${w}: popover ${i} did not open`);
      continue;
    }
    const fit = await dialog.evaluate((d) => {
      const r = d.getBoundingClientRect();
      const clipped = [...d.querySelectorAll('*')].some(
        (c) => c.scrollWidth > c.clientWidth + 1 && getComputedStyle(c).overflowX !== 'visible',
      );
      const rows = [...d.querySelectorAll('div')].every(
        (row) => row.scrollWidth <= row.clientWidth + 1,
      );
      return {
        title: d.getAttribute('aria-label'),
        onScreen: r.left >= 0 && r.right <= document.documentElement.clientWidth,
        clipped: clipped || !rows,
      };
    });
    if (!fit.onScreen) fail(`ROI @${w}: "${fit.title}" runs off screen`);
    if (fit.clipped) fail(`ROI @${w}: "${fit.title}" has clipped text`);
    if (w === 1280) await page.screenshot({ path: `${shots}roi-popover-${i}-${w}.png` });
    if (w === 390) {
      // Phones open the breakdown in place under its stat: capture the stat with its panel.
      const bars = (hide) =>
        page.evaluate((hide) => {
          for (const el of document.querySelectorAll('body *')) {
            if (hide && /fixed|sticky/.test(getComputedStyle(el).position)) {
              el.dataset.shotHidden = '1';
              el.style.visibility = 'hidden';
            } else if (!hide && el.dataset.shotHidden) {
              delete el.dataset.shotHidden;
              el.style.visibility = '';
            }
          }
        }, hide);
      await bars(true);
      await dialog.locator('..').screenshot({ path: `${shots}roi-popover-${i}-${w}.png` });
      await bars(false);
    }
    await page.keyboard.press('Escape');
    if (await dialog.isVisible()) fail(`ROI @${w}: "${fit.title}" stayed open after Escape`);
    const back = await trigger.evaluate((t) => t === document.activeElement);
    if (!back) fail(`ROI @${w}: focus did not return to "${fit.title}" trigger`);
    console.log(`     ROI popover "${fit.title}" opens, fits and closes`);
  }
}

const manager = await signIn('jordan.mills@rocketrental.example', 'JordanDemo#2026');
await manager.goto(`${base}/rent-analysis?property=seed-property-maple`, {
  waitUntil: 'networkidle',
});
const unit = await manager
  .locator('select[name=unit] option:not([disabled])')
  .first()
  .getAttribute('value');
const MANAGER = [
  ['/dashboard'],
  ['/leases'],
  ['/tenants'],
  ['/payments'],
  ['/properties/seed-property-elm'],
  ['/roi-analysis?property=seed-property-maple', 'section[aria-label="Deal Snapshot"]'],
  [`/rent-analysis?property=seed-property-maple&unit=${unit}`],
];
for (const [w, h] of SIZES) {
  await manager.setViewportSize({ width: w, height: h });
  for (const [path, waitFor] of MANAGER) {
    await open(manager, path, waitFor);
    await tabThrough(manager, path.split('?')[0], w);
    if (path.startsWith('/roi-analysis')) await roiControls(manager, w);
  }
}
const tenant = await signIn('alex.rivera@email.com', 'AlexDemo#2026');
for (const [w, h] of SIZES) {
  await tenant.setViewportSize({ width: w, height: h });
  for (const path of ['/home', '/pay']) {
    await open(tenant, path);
    await tabThrough(tenant, `tenant ${path}`, w);
  }
}
await browser.close();
console.log(
  failures
    ? `FAIL: ${failures} problems`
    : 'PASS: hero controls reachable, ringed, inside their hero and sized; ROI toggles and popovers work',
);
process.exit(failures ? 1 : 0);
