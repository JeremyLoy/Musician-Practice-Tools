import { defineConfig, devices, chromium } from '@playwright/test';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * If the exact Chromium revision bundled with this @playwright/test version
 * isn't installed (e.g. CDN blocked in a cloud environment), fall back to
 * any available Chromium in the Playwright browser cache.
 */
function findChromiumExecutable() {
  // If Playwright's own browser exists, let it use the default (return undefined).
  const defaultPath = chromium.executablePath();
  if (existsSync(defaultPath)) return undefined;

  const cacheDirs = [
    join(process.env.HOME || '/root', '.cache', 'ms-playwright'),
    '/opt/pw-browsers',
  ];

  for (const cacheDir of cacheDirs) {
    if (!existsSync(cacheDir)) continue;

    const dirs = readdirSync(cacheDir)
      .filter(d => /^chromium[-_]?\d*$/.test(d) || /^chromium-\d+$/.test(d))
      .sort((a, b) => {
        const numA = Number((a.match(/\d+/) || ['0'])[0]);
        const numB = Number((b.match(/\d+/) || ['0'])[0]);
        return numB - numA;
      }); // newest first

    for (const dir of dirs) {
      // Newer layout: chrome-linux64/chrome
      const newLayout = join(cacheDir, dir, 'chrome-linux64', 'chrome');
      if (existsSync(newLayout)) return newLayout;
      // Older layout: chrome-linux/chrome
      const oldLayout = join(cacheDir, dir, 'chrome-linux', 'chrome');
      if (existsSync(oldLayout)) return oldLayout;
    }
  }

  return undefined;
}

const executablePath = findChromiumExecutable();

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8000',
    headless: true,
    ...(executablePath && { launchOptions: { executablePath } }),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 8000 --directory docs',
    url: 'http://localhost:8000',
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
