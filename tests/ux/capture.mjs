// Screenshot capture for UX checks against a running app (dev or production build).
//
//   node tests/ux/capture.mjs --base http://localhost:3100 --out docs/ux-review/screenshots/after \
//     --widths 1280,390 --route /dashboard=dashboard --route "/payments=payments" [--fold] [--tenant]
//
// Signs in as the seeded manager (or tenant with --tenant), opens every route at every width and
// writes `<name>-<width>.png` (full page) plus `<name>-fold-<width>.png` when --fold is set. Also
// prints the document scroll width/height per capture so horizontal overflow is visible in the log.
// Output folders are never tracked in Git (the tree is at its size cap); cite them as Task evidence.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);
const base = opt('base', 'http://localhost:3100');
const out = opt('out', 'docs/ux-review/screenshots/after');
const widths = opt('widths', '1280,390').split(',').map(Number);
const routes = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--route') {
    const [route, name] = args[++i].split(/=(?=[^=]*$)/);
    routes.push({ route, name: name ?? route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') });
  }
}
if (routes.length === 0) {
  console.error('No --route given.');
  process.exit(1);
}
const tenant = flag('tenant');
const account = tenant
  ? {
      email: 'alex.rivera@email.com',
      password: process.env.ROCKETRENTAL_DEMO_TENANT_PASSWORD ?? 'AlexDemo#2026',
    }
  : {
      email: 'jordan.mills@rocketrental.example',
      password: process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026',
    };

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of widths) {
    const height = width <= 480 ? 844 : 800;
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      isMobile: width <= 480,
      hasTouch: width <= 480,
    });
    const page = await context.newPage();
    await page.goto(`${base}/sign-in`, { waitUntil: 'networkidle' });
    await page.getByLabel('Email address').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 });
    for (const { route, name } of routes) {
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const size = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientWidth: document.documentElement.clientWidth,
      }));
      const file = path.join(out, `${name}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      if (flag('fold')) {
        await page.screenshot({
          path: path.join(out, `${name}-fold-${width}.png`),
          fullPage: false,
        });
      }
      const overflow = size.scrollWidth > size.clientWidth ? ` OVERFLOW x${size.scrollWidth}` : '';
      console.log(`${file}  ${size.scrollWidth}x${size.scrollHeight}${overflow}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
