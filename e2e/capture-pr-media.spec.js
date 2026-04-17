/**
 * Captures screenshots and a video for the grid-layout PR.
 * Run: bun x playwright test e2e/capture-pr-media.spec.js --reporter=line
 *
 * Output: .github/
 *   layout-mobile.png       — 390×844 single-column stack
 *   layout-desktop.png      — 1280×900 default 12-column grid
 *   layout-resized.png      — drone-card resized larger via corner handle
 *   demo-grid.webm          — short video showing drag + resize
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.setTimeout(90_000);

const OUT = path.resolve('.github');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:8000';

async function clearLayout(page) {
    await page.evaluate(() => { localStorage.removeItem('toolkit_prefs_v2'); });
    await page.reload();
    await page.waitForSelector('body[data-ready]');
}

test('capture mobile screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE);
    await page.waitForSelector('body[data-ready]');
    await clearLayout(page);
    await page.screenshot({ path: path.join(OUT, 'layout-mobile.png'), fullPage: false });
});

test('capture desktop default screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BASE);
    await page.waitForSelector('body[data-ready]');
    await clearLayout(page);
    await page.screenshot({ path: path.join(OUT, 'layout-desktop.png'), fullPage: false });
});

test('capture resized card screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.goto(BASE);
    await page.waitForSelector('body[data-ready]');
    await clearLayout(page);

    const card = page.locator('#tuner-card');
    const handle = card.locator('.card-resize-corner');
    const hb = await handle.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + 200, hb.y + hb.height / 2 + 160, { steps: 30 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await page.screenshot({ path: path.join(OUT, 'layout-resized.png'), fullPage: false });
});

test('record demo video', async ({ browser }) => {
    const outPath = path.join(OUT, 'demo-grid.webm');
    const tmpDir = path.join(OUT, '_video_tmp');
    fs.mkdirSync(tmpDir, { recursive: true });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
        recordVideo: { dir: tmpDir, size: { width: 1280, height: 1000 } },
    });
    const page = await context.newPage();
    await page.goto(BASE);
    await page.waitForSelector('body[data-ready]');
    await page.evaluate(() => { localStorage.removeItem('toolkit_prefs_v2'); });
    await page.reload();
    await page.waitForSelector('body[data-ready]');
    await page.waitForTimeout(800);

    // 1. Drag tuner-card to the right side
    const tunerHandle = page.locator('#tuner-card .drag-handle');
    const spectrum = page.locator('#spectrum-card');
    const th = await tunerHandle.boundingBox();
    const sb = await spectrum.boundingBox();
    await page.mouse.move(th.x + th.width / 2, th.y + th.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 30 });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForTimeout(800);

    // 2. Resize a card via the corner
    const corner = page.locator('#dict-card .card-resize-corner');
    const cb = await corner.boundingBox();
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.mouse.move(cb.x + cb.width / 2 + 180, cb.y + cb.height / 2 + 200, { steps: 30 });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForTimeout(800);

    await context.close();

    const files = fs.readdirSync(tmpDir);
    if (files.length > 0) {
        const src = path.join(tmpDir, files[0]);
        fs.renameSync(src, outPath);
        fs.rmdirSync(tmpDir, { recursive: true });
        console.log(`Video saved to ${outPath}`);
    }
    expect(fs.existsSync(outPath)).toBe(true);
});
