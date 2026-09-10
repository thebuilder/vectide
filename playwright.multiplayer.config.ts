import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'multiplayer.spec.ts',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5184',
    channel: 'chromium',
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
    launchOptions: {
      args: [
        ...(process.env.PLAYWRIGHT_GPU ? [`--use-angle=${process.env.PLAYWRIGHT_GPU}`] : []),
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
    },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5184 --strictPort',
    url: 'http://127.0.0.1:5184',
    env: { VITE_PEER_HOST: '127.0.0.1', VITE_PEER_PORT: '9001', VITE_PEER_SECURE: 'false' },
    reuseExistingServer: false,
  },
});
