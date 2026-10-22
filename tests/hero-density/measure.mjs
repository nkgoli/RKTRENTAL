// Measures every hero / summary panel on the main routes at desktop, tablet and phone widths.
// Usage: node tests/hero-density/measure.mjs <label> [baseURL]
// Writes tests/hero-density/out/<label>.json and screenshots under tests/hero-density/shots/<label>/
// (both git-ignored evidence). Needs a running dev server and the seeded demo accounts.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const label = process.argv[2] ?? 'run';
const base = process.argv[3] ?? 'http://localhost:3117';
const here = new URL('.', import.meta.url);
const shots = new URL(`shots/${label}/`, here);
mkdirSync(shots, { recursive: true });
mkdirSync(new URL('out/', here), { recursive: true });

const VIEWPORTS = { desktop: [1280, 900], tablet: [820, 1100], mobile: [390, 844] };
const HERO =
  '.summary-band, .hero, .phone-hero, [class*="heroTop"], [class*="hero_"], [class*="_hero"]';
const MANAGER = [
  '/dashboard',
  '/properties',
  '/tenants',
  '/leases',
  '/applications',
  '/payments',
  '/returns',
  '/rent-comps',
  '/maintenance',
  '/documents',
  '/integrations',
];
const TENANT = ['/home', '/pay', '/lease', '/repairs'];
const SCREENSHOT = new Set([
  '/dashboard',
  '/leases',
  '/properties/:id',
  '/payments',
  '/pay',
  '/home',
]);

async function signIn(context, email, password) {
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

function measure(selector) {
  const docW = document.documentElement.clientWidth;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.width > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const heroes = [...document.querySelectorAll(selector)].filter(
    (el) =>
      visible(el) && !el.closest('[aria-hidden="true"]') && !el.parentElement.closest(selector),
  );
  const out = heroes.map((el) => {
    const r = el.getBoundingClientRect();
    // Next visible block after the hero in document order (not inside it).
    let next = null;
    for (let n = el; n && !next; n = n.parentElement) {
      for (let s = n.nextElementSibling; s; s = s.nextElementSibling) {
        if (visible(s) && getComputedStyle(s).position !== 'fixed') {
          next = s;
          break;
        }
      }
      if (n.matches('main, .page')) break;
    }
    const clipped = [...el.querySelectorAll('*')].filter((c) => {
      const cs = getComputedStyle(c);
      return (
        visible(c) &&
        /hidden|clip/.test(cs.overflowX + cs.overflowY) &&
        (c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1)
      );
    }).length;
    const stats = [...el.querySelectorAll('.summary-stat')].map((s) =>
      Math.round(s.getBoundingClientRect().height),
    );
    return {
      cls: el.className.toString().slice(0, 60),
      height: Math.round(r.height),
      width: Math.round(r.width),
      gapToNext: next ? Math.round(next.getBoundingClientRect().top - r.bottom) : null,
      next: next ? `${next.tagName.toLowerCase()}.${next.className.toString().slice(0, 40)}` : null,
      stats,
      clipped,
      overflowsViewport: r.right > docW + 1,
    };
  });
  const topbar = document.querySelector('.topbar');
  return {
    heroes: out,
    topbar: topbar && visible(topbar) ? Math.round(topbar.getBoundingClientRect().height) : null,
    pageOverflowX: document.documentElement.scrollWidth > docW + 1,
  };
}

const browser = await chromium.launch();
const results = {};
async function run(email, password, routes, discover) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await signIn(context, email, password);
  if (discover) {
    for (const [list, pattern, key] of [
      ['/properties', /^\/properties\/[^/?]+$/, '/properties/:id'],
      ['/leases', /^\/leases\/[^/?]+$/, '/leases/:id'],
      ['/tenants', /^\/tenants\/[^/?]+$/, '/tenants/:id'],
    ]) {
      await page.goto(base + list, { waitUntil: 'networkidle' });
      const hrefs = await page
        .locator('main a[href]')
        .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      const href = hrefs
        .map((h) => h.split('?')[0])
        .find((h) => pattern.test(h) && !/\/(new|templates)$/.test(h));
      if (!href)
        console.warn(
          `No ${key} link found on ${list}:`,
          hrefs.filter((h) => h.startsWith(list)).slice(0, 5),
        );
      if (href) {
        routes.push([key, href]);
        if (key === '/leases/:id') routes.push(['/leases/:id/ledger', `${href}/ledger`]);
        if (key === '/properties/:id') routes.push(['/properties/:id/returns', `${href}/returns`]);
      }
    }
  }
  for (const entry of routes) {
    const [key, path] = Array.isArray(entry) ? entry : [entry, entry];
    for (const [vp, [w, h]] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      results[`${key} @${vp}`] = { path, ...(await page.evaluate(measure, HERO)) };
      if (SCREENSHOT.has(key) && vp !== 'tablet') {
        const name = `${key.replace(/[/:]+/g, '_').replace(/^_/, '')}-${vp}.png`;
        await page.screenshot({ path: fileURLToPath(new URL(name, shots)), fullPage: false });
      }
    }
  }
  await context.close();
}

await run('jordan.mills@rocketrental.example', 'JordanDemo#2026', [...MANAGER], true);
await run('alex.rivera@email.com', 'AlexDemo#2026', [...TENANT], false);
await browser.close();
writeFileSync(new URL(`out/${label}.json`, here), JSON.stringify(results, null, 2));
for (const [k, v] of Object.entries(results)) {
  const hs = v.heroes.map(
    (x) =>
      `${x.height}h gap ${x.gapToNext} [${x.stats.join(',')}]${x.clipped ? ' CLIP' : ''}${x.overflowsViewport ? ' OVF' : ''}`,
  );
  console.log(
    `${k.padEnd(28)} topbar ${v.topbar ?? '-'} | ${hs.join(' ; ') || 'no hero'}${v.pageOverflowX ? ' PAGE-OVERFLOW-X' : ''}`,
  );
}
