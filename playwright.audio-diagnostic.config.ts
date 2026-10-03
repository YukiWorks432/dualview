import { defineConfig, devices } from '@playwright/test'

// This does not modify playwright.config.ts or the original audio-budget assertions.
export default defineConfig({
  testDir: './e2e/diagnostics',
  testMatch: 'audio-responsiveness.diagnostic.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 90_000,
  outputDir: 'test-results/audio-diagnostic',
  reporter: [['list'], ['json', { outputFile: 'test-results/audio-diagnostic-report.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    baseURL: 'http://127.0.0.1:4175',
    trace: 'on',
  },
  webServer: {
    command:
      'pnpm exec vite --config vite.audio-diagnostic.config.ts --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
