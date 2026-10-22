// Measures every hero / summary panel at desktop, tablet and phone widths, rendered in Chromium.
// Usage: node tests/hero-density/measure.mjs <label> [baseURL] [--check]
// Writes tests/hero-density/out/<label>.json and screenshots under tests/hero-density/shots/<label>/
// (both git-ignored evidence). Needs a running dev server and the seeded demo accounts.
// --check compares the run with budgets.json and exits 1 on a taller hero, a later following
// panel, a hero gap other than 24px, clipped or overflowing content, text under 12px, a hero
// control under 24px, or a Screening report card that no longer matches its own layout.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const check = args.includes('--check');
const [label = 'run', base = 'http://localhost:3117'] = args.filter((a) => !a.startsWith('--'));
const here = new URL('.', import.meta.url);
const shots = new URL(`shots/${label}/`, here);
mkdirSync(shots, { recursive: true });
mkdirSync(new URL('out/', here), { recursive: true });

const VIEWPORTS = { desktop: [1280, 900], tablet: [820, 1100], mobile: [390, 844] };
const BAND = 'main .summary-band';
const DEAL = 'section[aria-label="Deal Snapshot"]';
// [key, path, hero selector, screenshot?, wait-for selector]
const MANAGER = [
  ['/dashboard', '/dashboard', BAND, true],
  ['/properties', '/properties', BAND, false],
  ['/tenants', '/tenants', BAND, true],
  ['/leases', '/leases', BAND, true],
  ['/applications', '/applications', BAND, false],
  ['/payments', '/payments', BAND, true],
  ['/maintenance', '/maintenance', BAND, false],
  ['/documents', '/documents', BAND, false],
  ['/properties/:id', '/properties/seed-property-maple', BAND, true],
  ['/properties/:id/returns', '/properties/seed-property-maple/returns', BAND, false],
  ['/roi-analysis', '/roi-analysis?property=seed-property-maple', DEAL, true, DEAL],
  ['/rent-analysis', null, BAND, true, BAND],
  ['/rent-comps (listing)', '/rent-comps', null, false],
  ['/returns', '/returns', null, false],
  ['/integrations', '/integrations', null, false],
];
const TENANT = [
  ['/home', '/home', 'section[aria-labelledby="rent-due"]', true],
  ['/pay', '/pay', 'section[aria-labelledby="amount-due-title"]', true],
];
const REPORT = '[aria-label="Screening report"]';

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

function measure([selector, report]) {
  const docW = document.documentElement.clientWidth;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.width > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const pageY = (y) => Math.round(y + window.scrollY);
  const topbar = document.querySelector('.topbar');
  const out = {
    topbar: topbar && visible(topbar) ? Math.round(topbar.getBoundingClientRect().height) : null,
    pageOverflowX: document.documentElement.scrollWidth > docW + 1,
  };
  const el = selector && [...document.querySelectorAll(selector)].find(visible);
  if (el) {
    const r = el.getBoundingClientRect();
    // Next visible block after the hero in document order (not inside it).
    let next = null;
    for (let n = el; n && !next; n = n.parentElement) {
      for (let s = n.nextElementSibling; s; s = s.nextElementSibling) {
        const cs = getComputedStyle(s);
        if (visible(s) && cs.position !== 'fixed' && cs.position !== 'absolute') {
          next = s;
          break;
        }
      }
      if (n.matches('main, .page')) break;
    }
    const inner = [...el.querySelectorAll('*')].filter(visible);
    const clipped = inner.filter((c) => {
      const cs = getComputedStyle(c);
      return (
        /hidden|clip/.test(cs.overflowX + cs.overflowY) &&
        !c.matches('.bar, [class*="meterBar"], progress') &&
        c.getBoundingClientRect().width > 1 && // visually hidden screen-reader text
        (c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1)
      );
    }).length;
    const escapes = inner.filter((c) => {
      const b = c.getBoundingClientRect();
      return b.right > r.right + 1 || b.left < r.left - 1;
    }).length;
    const texts = inner.filter((c) =>
      [...c.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()),
    );
    // Button-like targets; standalone text links are reported separately (WCAG 2.5.8 lets a
    // spaced text link be smaller), and links inside a sentence are exempt.
    const byHeight = (a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height;
    const smallest = inner
      .filter((c) => c.matches('button, summary, select, input, a.btn, a.summary-stat'))
      .sort(byHeight)[0];
    const link = inner
      .filter(
        (c) =>
          c.matches('a[href]:not(.btn, .summary-stat)') &&
          !c.parentElement.matches('p, small, span'),
      )
      .sort(byHeight)[0];
    out.hero = {
      top: pageY(r.top),
      height: Math.round(r.height),
      width: Math.round(r.width),
      nextTop: next ? pageY(next.getBoundingClientRect().top) : null,
      gapToNext: next ? Math.round(next.getBoundingClientRect().top - r.bottom) : null,
      next: next ? `${next.tagName.toLowerCase()}.${next.className.toString().slice(0, 40)}` : null,
      stats: [...el.querySelectorAll('.summary-stat')].map((s) =>
        Math.round(s.getBoundingClientRect().height),
      ),
      text: el.innerText.replace(/\s+/g, ' ').trim(),
      minFont: Math.min(...texts.map((c) => parseFloat(getComputedStyle(c).fontSize))),
      minControl: smallest ? Math.round(smallest.getBoundingClientRect().height) : null,
      minControlText: smallest ? smallest.innerText.trim().slice(0, 30) : null,
      minLink: link ? Math.round(link.getBoundingClientRect().height) : null,
      clipped,
      escapes,
      overflowsViewport: r.right > docW + 1,
    };
  }
  const rep = report && document.querySelector(report);
  if (rep) {
    out.report = [...rep.querySelectorAll('.summary-stat')].map((s) => {
      const cs = getComputedStyle(s);
      const strong = getComputedStyle(s.querySelector('strong'));
      return {
        display: cs.display,
        padding: cs.padding,
        height: Math.round(s.getBoundingClientRect().height),
        valueSize: strong.fontSize,
        valueAlign: strong.textAlign,
      };
    });
  }
  return out;
}

const browser = await chromium.launch();
const results = {};
async function run(email, password, routes) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await signIn(context, email, password);
  for (const [key, fixed, selector, shot, waitFor] of routes) {
    let path = fixed;
    if (key === '/rent-analysis') {
      // Pick the first unit, which runs its comps analysis and renders the suggested-rent band.
      await page.goto(`${base}/rent-analysis?property=seed-property-maple`, {
        waitUntil: 'networkidle',
      });
      const unit = await page.locator('select[name=unit] option:not([disabled])').first();
      path = `/rent-analysis?property=seed-property-maple&unit=${await unit.getAttribute('value')}`;
    }
    for (const [vp, [w, h]] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize({ width: w, height: h });
      // A dev-server recompile can abort the first navigation; retry it once.
      await page
        .goto(base + path, { waitUntil: 'networkidle' })
        .catch(() => page.goto(base + path, { waitUntil: 'networkidle' }));
      if (waitFor) await page.waitForSelector(waitFor, { timeout: 60000 });
      await page.waitForTimeout(400);
      results[`${key} @${vp}`] = {
        path: new URL(page.url()).pathname + new URL(page.url()).search,
        ...(await page.evaluate(measure, [selector, null])),
      };
      if (shot) {
        const name = `${key.replace(/[/:]+/g, '_').replace(/^_/, '')}-${vp}.png`;
        await page.screenshot({ path: fileURLToPath(new URL(name, shots)) });
        // The whole hero, however tall, for side-by-side comparison (fixed bars hidden).
        const bars = (hide) =>
          page.evaluate((hide) => {
            for (const el of document.querySelectorAll('body *')) {
              if (hide && /fixed|sticky/.test(getComputedStyle(el).position)) {
                el.dataset.heroShotHidden = '';
                el.style.visibility = 'hidden';
              } else if (!hide && 'heroShotHidden' in el.dataset) {
                delete el.dataset.heroShotHidden;
                el.style.visibility = '';
              }
            }
          }, hide);
        await bars(true);
        await page
          .locator(selector)
          .first()
          .screenshot({ path: fileURLToPath(new URL(name.replace('.png', '-hero.png'), shots)) });
        await bars(false);
      }
    }
  }
  if (email.startsWith('jordan')) {
    // The selected application's Screening report reuses .summary-stat outside any hero.
    for (const [vp, [w, h]] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`${base}/applications?applicant=seed-application-marcus#selected-applicant`, {
        waitUntil: 'networkidle',
      });
      await page.locator(REPORT).scrollIntoViewIfNeeded();
      results[`screening report @${vp}`] = await page.evaluate(measure, [null, REPORT]);
      if (vp !== 'tablet')
        await page
          .locator(REPORT)
          .screenshot({ path: fileURLToPath(new URL(`screening-report-${vp}.png`, shots)) });
    }
  }
  await context.close();
}

await run('jordan.mills@rocketrental.example', 'JordanDemo#2026', MANAGER);
await run('alex.rivera@email.com', 'AlexDemo#2026', TENANT);
await browser.close();
writeFileSync(new URL(`out/${label}.json`, here), JSON.stringify(results, null, 2));
for (const [k, v] of Object.entries(results)) {
  const x = v.hero;
  const hero = x
    ? `${x.height}h top ${x.top} next@${x.nextTop} gap ${x.gapToNext} font>=${x.minFont} ctl>=${x.minControl ?? '-'}${x.minControl < 30 ? `(${x.minControlText})` : ''} link>=${x.minLink ?? '-'} [${x.stats.join(',')}]${x.clipped ? ' CLIP' : ''}${x.escapes ? ' ESCAPE' : ''}${x.overflowsViewport ? ' OVF' : ''}`
    : v.report
      ? `report ${v.report.map((r) => `${r.display}/${r.height}h/${r.valueSize}`).join(' ')}`
      : 'no hero';
  console.log(
    `${k.padEnd(34)} topbar ${v.topbar ?? '-'} | ${hero}${v.pageOverflowX ? ' PAGE-OVERFLOW-X' : ''}`,
  );
}

if (check) {
  const budgets = JSON.parse(readFileSync(new URL('budgets.json', here), 'utf8'));
  const problems = [];
  for (const [k, b] of Object.entries(budgets.heroes)) {
    const x = results[k]?.hero;
    if (!x) {
      problems.push(`${k}: hero not found`);
      continue;
    }
    if (x.height > b.height) problems.push(`${k}: hero ${x.height}px > budget ${b.height}px`);
    if (b.nextTop && x.nextTop > b.nextTop)
      problems.push(`${k}: next panel at ${x.nextTop}px > budget ${b.nextTop}px`);
    if (b.gap !== undefined && x.gapToNext !== b.gap)
      problems.push(`${k}: gap ${x.gapToNext}px, expected ${b.gap}px`);
    for (const word of b.text ?? [])
      if (!x.text.toLowerCase().includes(word.toLowerCase()))
        problems.push(`${k}: missing "${word}"`);
  }
  for (const [k, v] of Object.entries(results)) {
    const x = v.hero;
    if (v.pageOverflowX) problems.push(`${k}: horizontal page overflow`);
    if (!x) continue;
    if (x.clipped || x.escapes || x.overflowsViewport) problems.push(`${k}: clipped content`);
    if (x.minFont < 12) problems.push(`${k}: ${x.minFont}px text`);
    if (x.minControl !== null && x.minControl < 24)
      problems.push(`${k}: ${x.minControl}px control`);
    if (x.minLink !== null && x.minLink < 20) problems.push(`${k}: ${x.minLink}px text link`);
  }
  for (const [k, want] of Object.entries(budgets.report)) {
    const got = results[k]?.report;
    if (JSON.stringify(got) !== JSON.stringify(want))
      problems.push(`${k}: Screening report layout changed ${JSON.stringify(got)}`);
  }
  console.log(problems.length ? `FAIL\n- ${problems.join('\n- ')}` : 'PASS: all budgets met');
  process.exit(problems.length ? 1 : 0);
}
