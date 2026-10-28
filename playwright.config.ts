import { defineConfig, devices } from "@playwright/test";

// Smoke tests on a phone-sized screen, against the production build (so the service worker is active too).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // A Dutch browser, so the journeys read the app as it was written; the language journeys set their own locale.
  use: { ...devices["Pixel 7"], locale: "nl-NL", baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
