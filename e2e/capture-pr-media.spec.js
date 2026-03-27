/**
 * Captures screenshots and video for the card layout PR.
 * Run: bun x playwright test e2e/capture-pr-media.js --reporter=line
 *
 * Output: .github/
 *   layout-mobile.png         — 390×844 single-column
 *   layout-desktop.png        — 1280×900 two-column
 *   layout-full-width.png     — card expanded to full-width
 *   layout-3-columns.png      — three-column layout
 *   demo-layout.mp4 (or .webm) — interaction video
 */

import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.setTimeout(90_000);

const OUT = path.resolve('.github');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:8000';

async function clearLayout(page) {
    await page.evaluate(() => {
        try {
            const key = 'toolkit_prefs_v2';
            const prefs = JSON.parse(localStorage.getItem(key) || '{}');
            delete prefs.cardLayout;
            delete prefs.cardOrder;
            localStorage.setItem(key, JSON.stringify(prefs));
        } catch {}
    });
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

test('capture desktop two-column screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BASE);
    await page.waitForSelector('body[data-ready]');
    await clearLayout(page);
    await page.screenshot({ path: path.join(OUT, 'layout-desktop.png'), fullPage: false });
});

test('capture full-width card screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BASE);
    await page.waitForSelector('body[data-ready]');
    await clearLayout(page);

    // Expand drone-card to full-width via resize grip
    const grip = page.locator('#drone-card .card-resize-handle');
    const box = await grip.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    await page.screenshot({ path: path.join(OUT, 'layout-full-width.png'), fullPage: false });
});

test('capture 3-column screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BASE);
    await page.waitForSelector('body[data-ready]');
    await clearLayout(page);

    await page.locator('#colCountPlus').click();
    await page.waitForTimeout(200);

    await page.screenshot({ path: path.join(OUT, 'layout-3-columns.png'), fullPage: false });
});

test('record demo video', async ({ browser }) => {
    // Try mp4 first (via chromium), fall back to webm
    const videoFormats = [
        { ext: 'webm', mime: 'video/webm' },
    ];

    for (const fmt of videoFormats) {
        const outPath = path.join(OUT, `demo-layout.${fmt.ext}`);
        const context = await browser.newContext({
            viewport: { width: 1280, height: 900 },
            recordVideo: {
                dir: path.join(OUT, '_video_tmp'),
                size: { width: 1280, height: 900 },
            },
        });

        const page = await context.newPage();
        await page.goto(BASE);
        await page.waitForSelector('body[data-ready]');

        // Clear layout
        await page.evaluate(() => {
            try {
                const key = 'toolkit_prefs_v2';
                const prefs = JSON.parse(localStorage.getItem(key) || '{}');
                delete prefs.cardLayout;
                delete prefs.cardOrder;
                localStorage.setItem(key, JSON.stringify(prefs));
            } catch {}
        });
        await page.reload();
        await page.waitForSelector('body[data-ready]');
        await page.waitForTimeout(600);

        // ── 1. Show two-column default layout ─────────────────────────────────
        await page.waitForTimeout(1200);

        // ── 2. Column-isolated drag: move metro-card down within col2 ──────────
        const metroHandle = page.locator('#metro-card .drag-handle');
        const memoCard = page.locator('#memos-card');
        const handleBox = await metroHandle.boundingBox();
        const memoBox = await memoCard.boundingBox();

        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(300);
        await page.mouse.move(
            memoBox.x + memoBox.width / 2,
            memoBox.y + memoBox.height * 0.8,
            { steps: 30 }
        );
        await page.waitForTimeout(300);
        await page.mouse.up();
        await page.waitForTimeout(800);

        // ── 3. Expand drone-card to full-width ─────────────────────────────────
        const grip = page.locator('#drone-card .card-resize-handle');
        const gripBox = await grip.boundingBox();
        await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
        await page.waitForTimeout(300);
        await page.mouse.down();
        await page.mouse.move(gripBox.x + gripBox.width / 2 + 120, gripBox.y + gripBox.height / 2, { steps: 25 });
        await page.waitForTimeout(300);
        await page.mouse.up();
        await page.waitForTimeout(800);

        // ── 4. Contract drone-card back ────────────────────────────────────────
        await page.locator('#drone-card').scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        const grip2Box = await grip.boundingBox();
        await page.mouse.move(grip2Box.x + grip2Box.width / 2, grip2Box.y + grip2Box.height / 2);
        await page.waitForTimeout(200);
        await page.mouse.down();
        await page.mouse.move(grip2Box.x + grip2Box.width / 2 - 120, grip2Box.y + grip2Box.height / 2, { steps: 25 });
        await page.waitForTimeout(300);
        await page.mouse.up();
        await page.waitForTimeout(800);

        // ── 5. Scroll to top, show column count stepper ────────────────────────
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(600);
        await page.locator('#colCountPlus').click();
        await page.waitForTimeout(800);
        await page.locator('#colCountMinus').click();
        await page.waitForTimeout(800);

        await context.close();

        // Move the generated video to the target path
        const tmpDir = path.join(OUT, '_video_tmp');
        const files = fs.readdirSync(tmpDir);
        if (files.length > 0) {
            const src = path.join(tmpDir, files[0]);
            fs.renameSync(src, outPath);
            fs.rmdirSync(tmpDir, { recursive: true });
            console.log(`Video saved to ${outPath}`);
        }
        break;
    }
});
