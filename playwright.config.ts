import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3000);

export default defineConfig({
  testDir: './tests',
  testMatch: [
    '**/e2e/**/*.spec.ts',
    '**/ledger/**/*.spec.ts',
    '**/tenant-pay/**/*.spec.ts',
    '**/screening/**/*.spec.ts',
    '**/integrations/**/*.spec.ts',
    '**/providers/**/*.spec.ts',
  ],
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { MOCK_WEBHOOK_SECRET: process.env.MOCK_WEBHOOK_SECRET ?? 'dev-webhook-secret' },
  },
});
