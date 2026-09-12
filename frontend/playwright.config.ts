import { defineConfig, devices } from '@playwright/test';

const configuredFrontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT ?? '5173';

if (!/^\d+$/.test(configuredFrontendPort) || Number(configuredFrontendPort) < 1024 || Number(configuredFrontendPort) > 65535) {
  throw new Error('PLAYWRIGHT_FRONTEND_PORT must be a TCP port between 1024 and 65535.');
}

const frontendPort = Number(configuredFrontendPort);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${frontendPort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: '../reports/6g-r6b-browser-validation/html-report' }],
    ['list']
  ],
  outputDir: '../reports/6g-r6b-browser-validation/test-results',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'Laptop 1366',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'Tablet 1024',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
    }
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
