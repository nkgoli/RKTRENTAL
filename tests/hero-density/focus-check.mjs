// Keyboard check: every link and button inside a summary band is reachable with Tab, shows a
// visible focus ring and sits fully inside the band. Also saves tablet screenshots of Leases.
// Usage: node tests/hero-density/focus-check.mjs [baseURL]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://localhost:3117';
const shots = fileURLToPath(new URL('shots/after/', import.meta.url));
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.goto(`${base}/sign-in`);
await page.fill('input[name=email]', 'jordan.mills@rocketrental.example');
await page.fill('input[name=password]', 'JordanDemo#2026');
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 90000 }),
  page.press('input[name=password]', 'Enter'),
]);

let failures = 0;
for (const [w, h] of [
  [1280, 900],
  [1024, 900],
  [820, 1100],
  [390, 844],
]) {
  await page.setViewportSize({ width: w, height: h });
  for (const path of ['/dashboard', '/leases', '/payments', '/properties/seed-property-elm']) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    const targets = await page.locator('.summary-band a, .summary-band button').count();
    let reached = 0;
    await page.locator('body').focus();
    for (let i = 0; i < 80 && reached < targets; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        const band = el?.closest('.summary-band');
        if (!band) return null;
        const r = el.getBoundingClientRect();
        const b = band.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          ring:
            (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
            cs.boxShadow !== 'none',
          inside:
            r.left >= b.left - 1 &&
            r.right <= b.right + 1 &&
            r.top >= b.top - 1 &&
            r.bottom <= b.bottom + 1,
        };
      });
      if (info) {
        reached++;
        if (!info.ring || !info.inside) failures++;
      }
    }
    const ok = reached === targets;
    if (!ok) failures++;
    console.log(
      `${String(w).padStart(4)} ${path.padEnd(32)} band controls ${targets}, focused ${reached}${ok ? '' : ' MISSING'}`,
    );
  }
  if (w === 820 || w === 1024)
    await page
      .goto(base + '/leases', { waitUntil: 'networkidle' })
      .then(() => page.screenshot({ path: `${shots}leases-${w}.png` }));
}
await browser.close();
console.log(
  failures
    ? `FAIL: ${failures} focus problems`
    : 'PASS: all band controls focusable with a visible ring, inside the band',
);
process.exit(failures ? 1 : 0);
