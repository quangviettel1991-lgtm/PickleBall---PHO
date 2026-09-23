import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4175', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: process.env.PW_EXTERNAL_SERVER ? undefined : [
    { command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort', url: 'http://127.0.0.1:4175', reuseExistingServer: false,
      env: { VITE_LOCAL_MODE: 'true', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_CLUB_ID: '1' } },
    { command: 'npm run dev -- --host 127.0.0.1 --port 4176 --strictPort', url: 'http://127.0.0.1:4176', reuseExistingServer: false,
      env: { VITE_LOCAL_MODE: 'false', VITE_SUPABASE_URL: 'https://test-project.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-public-key', VITE_CLUB_ID: '1' } },
  ],
});
