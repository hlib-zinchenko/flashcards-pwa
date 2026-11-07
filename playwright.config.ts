import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the production build (service worker included), in WebKit:
// the engine closest to iOS Safari, where most people use the app.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4174/',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  projects: [
    // Phone-sized desktop Safari: mouse pointer, so exports download instead of opening the share sheet.
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    // Own port, never reused: a `npm run preview` left running on 4173 would serve an old build.
    command: 'npm run build && npm run preview -- --port 4174 --strictPort',
    url: 'http://localhost:4174/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
