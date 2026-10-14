import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3000);
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: '.',
  testMatch: 'lease-create.spec.ts',
  reporter: process.env.CI ? 'github' : 'list',
  use: { ...devices['Desktop Chrome'], baseURL: externalBaseUrl ?? `http://127.0.0.1:${port}` },
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: process.platform === 'win32' ? 'npm.cmd run dev' : 'npm run dev',
          url: `http://127.0.0.1:${port}/sign-in`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
