import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end suite (PLAN.md §11.4). Runs at a 390 px mobile viewport in both
 * languages against a local Supabase stack — SUPABASE_URL/ANON_KEY must point
 * at one, or every spec is skipped rather than failing for the wrong reason.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    // The iPhone profile for viewport, touch and user agent, on Chromium: it is
    // the only browser CI installs, and the phone profile defaults to WebKit.
    ...devices['iPhone 12'],
    browserName: 'chromium',
    // Where a machine ships its own Chromium (no download allowed), point at
    // it; CI leaves this unset and uses the build `playwright install` fetched.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
    viewport: { width: 390, height: 844 },
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: 'http://localhost:3000/en',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
