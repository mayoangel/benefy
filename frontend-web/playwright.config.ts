import {defineConfig} from '@playwright/test';
const channel = process.env.PLAYWRIGHT_CHANNEL || undefined;
export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5174',
    channel,
    headless: true,
  },
  webServer: process.env.BENEFY_TEST_SERVER_EXTERNAL ? undefined : {
    command: 'node tests/server.mjs',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
  },
  workers: 1,
});
