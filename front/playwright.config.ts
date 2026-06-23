import { defineConfig, devices } from '@playwright/test';

/**
 * E2E 테스트 설정
 * 실행 전: 프론트(npm run dev), 백엔드(backend npm run dev) 둘 다 띄워 둘 것.
 * 프론트: http://localhost:5173, API: http://localhost:4000/api
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      slowMo: Number(process.env.E2E_SLOW_MO || process.env.DQPM_SLOW_MO || 0) || undefined,
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'smoke',
      use: { ...devices['Desktop Chrome'] },
      grep: /@smoke/,
    },
    {
      name: 'workflow',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /workflow-qa-live\.spec\.ts/,
      timeout: 120000,
    },
    {
      name: 'result-ui',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /result-ui\.spec\.ts/,
      timeout: 90000,
    },
    {
      name: 'workflow-pool',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /workflow-pool-live-delete\.spec\.ts/,
      timeout: 120000,
    },
  ],
  timeout: 30000,
  expect: { timeout: 10000 },
});
