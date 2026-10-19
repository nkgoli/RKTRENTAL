import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Choose before or after');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3234' });
const page = await context.newPage();
mkdirSync('.playwright-mcp/lease-details', { recursive: true });
try {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
  await page.getByLabel('Password', { exact: true }).fill('JordanDemo#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/dashboard');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const tab of ['overview', 'agreement', 'documents', 'payments', 'activity']) {
      await page.goto(`/leases/seed-lease-maple-11?tab=${tab}`);
      await page.getByRole('navigation', { name: 'Lease sections' }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `.playwright-mcp/lease-details/${phase}-${tab}-${width}.png`,
        fullPage: true,
      });
      console.log(
        `${phase} ${tab} ${width}: overflow=${await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)}`,
      );
    }
  }
} finally {
  await browser.close();
}
