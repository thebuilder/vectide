import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testIgnore: 'multiplayer.spec.ts',
  timeout: 30000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    channel: process.env.PLAYWRIGHT_CHANNEL,
    launchOptions: {
      args: process.env.PLAYWRIGHT_GPU ? [`--use-angle=${process.env.PLAYWRIGHT_GPU}`] : [],
    },
    viewport: { width: 1280, height: 800 },
  },
});
