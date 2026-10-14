import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

// Every suite shares one seeded database and one server, so run serially. `npm run test:e2e`
// (scripts/e2e.mjs) provisions the database; set PLAYWRIGHT_BASE_URL to reuse a running server.
const suites: { dir: string; viewport?: { width: number; height: number } }[] = [
  { dir: 'a11y' },
  { dir: 'e2e' },
  { dir: 'auth' },
  { dir: 'properties' },
  { dir: 'tenants' },
  { dir: 'leases' },
  { dir: 'lease-create' },
  { dir: 'documents' },
  { dir: 'portfolio' },
  { dir: 'integrations' },
  { dir: 'providers' },
  { dir: 'ledger' },
  { dir: 'dashboard', viewport: { width: 1440, height: 1000 } },
  { dir: 'returns' },
  { dir: 'rent-comps' },
  { dir: 'screening', viewport: { width: 1280, height: 1000 } },
  { dir: 'maintenance', viewport: { width: 1440, height: 1000 } },
  { dir: 'tenant-pay', viewport: { width: 390, height: 844 } },
  { dir: 'tenant-portal', viewport: { width: 390, height: 844 } },
  { dir: 'tenant-repairs', viewport: { width: 390, height: 844 } },
];

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL },
  projects: suites.map(({ dir, viewport }) => ({
    name: dir,
    testMatch: `${dir}/**/*.spec.ts`,
    use: { ...devices['Desktop Chrome'], ...(viewport ? { viewport } : {}) },
  })),
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `node node_modules/next/dist/bin/next dev -p ${port}`,
        url: `${baseURL}/sign-in`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: { MOCK_WEBHOOK_SECRET: process.env.MOCK_WEBHOOK_SECRET ?? 'dev-webhook-secret' },
      },
});
