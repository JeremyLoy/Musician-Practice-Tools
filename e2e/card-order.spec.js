import { test, expect } from '@playwright/test';

// SCROLL_ZONE and SCROLL_SPEED must match constants in initCardDrag() in app.js
const SCROLL_ZONE = 80;
const VIEWPORT_H = 844;

test.describe('Card drag-to-reorder', () => {
    test.beforeEach(async ({ page }) => {
        // Use mobile viewport so cards are in a single column for consistent Y-axis drag behaviour
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await page.waitForSelector('body[data-ready]');
        // Clear any saved card order so tests start from default
        await page.evaluate(() => {
            try {
                const key = 'toolkit_prefs_v2';
                const prefs = JSON.parse(localStorage.getItem(key) || '{}');
                delete prefs.cardOrder;
                localStorage.setItem(key, JSON.stringify(prefs));
            } catch {}
        });
        await page.reload();
        await page.waitForSelector('body[data-ready]');
    });

    test('default card order is drone, metro, memos, tuner, dict', async ({ page }) => {
        const order = await page.locator('.card').evaluateAll(cards => cards.map(c => c.id));
        expect(order).toEqual(['drone-card', 'metro-card', 'memos-card', 'tuner-card', 'dict-card']);
    });

    test('drag handle meets 44px touch target on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const handles = page.locator('.drag-handle');
        const count = await handles.count();
        for (let i = 0; i < count; i++) {
            const box = await handles.nth(i).boundingBox();
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
        }
    });

    test('tapping drag handle without moving does not rearrange cards', async ({ page }) => {
        const orderBefore = await page.locator('.card').evaluateAll(cards => cards.map(c => c.id));

        const handle = page.locator('#drone-card .drag-handle');
        const box = await handle.boundingBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.up();

        const orderAfter = await page.locator('.card').evaluateAll(cards => cards.map(c => c.id));
        expect(orderAfter).toEqual(orderBefore);
    });

    test('dragging drone card below metronome card reorders them', async ({ page }) => {
        const droneHandle = page.locator('#drone-card .drag-handle');
        const metroCard = page.locator('#metro-card');

        const handleBox = await droneHandle.boundingBox();
        const metroBox = await metroCard.boundingBox();

        // Drag from handle down to the lower half of the metro card
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(
            metroBox.x + metroBox.width / 2,
            metroBox.y + metroBox.height * 0.75,
            { steps: 15 }
        );
        await page.mouse.up();

        const newOrder = await page.locator('.card').evaluateAll(cards => cards.map(c => c.id));
        expect(newOrder[0]).toBe('metro-card');
        expect(newOrder[1]).toBe('drone-card');
    });

    test('reordered card position persists after page reload', async ({ page }) => {
        const droneHandle = page.locator('#drone-card .drag-handle');
        const metroCard = page.locator('#metro-card');

        const handleBox = await droneHandle.boundingBox();
        const metroBox = await metroCard.boundingBox();

        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(
            metroBox.x + metroBox.width / 2,
            metroBox.y + metroBox.height * 0.75,
            { steps: 15 }
        );
        await page.mouse.up();

        // Verify order changed
        const orderAfterDrag = await page.locator('.card').evaluateAll(cards => cards.map(c => c.id));
        expect(orderAfterDrag[0]).toBe('metro-card');

        // Reload and confirm persistence
        await page.reload();
        await page.waitForSelector('.drag-handle');
        const orderAfterReload = await page.locator('.card').evaluateAll(cards => cards.map(c => c.id));
        expect(orderAfterReload[0]).toBe('metro-card');
        expect(orderAfterReload[1]).toBe('drone-card');
    });
});

test.describe('Auto-scroll while dragging', () => {
    test.beforeEach(async ({ page }) => {
        // Phone viewport: 5 cards easily exceed 844px, giving genuine off-screen content
        await page.setViewportSize({ width: 390, height: VIEWPORT_H });
        await page.goto('/');
        await page.waitForSelector('.drag-handle');
        await page.evaluate(() => window.scrollTo(0, 0));
    });

    test('page content extends beyond viewport on mobile', async ({ page }) => {
        const pageHeight = await page.evaluate(() => document.body.scrollHeight);
        expect(pageHeight).toBeGreaterThan(VIEWPORT_H);
    });

    test('scrolls down when dragging handle near bottom viewport edge', async ({ page }) => {
        const handle = page.locator('#drone-card .drag-handle');
        const box = await handle.boundingBox();

        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();

        // Enter the bottom scroll zone (within SCROLL_ZONE px of viewport bottom)
        await page.mouse.move(box.x + box.width / 2, VIEWPORT_H - SCROLL_ZONE / 2, { steps: 5 });

        // Allow several requestAnimationFrame ticks to fire
        await page.waitForTimeout(250);

        const scrollY = await page.evaluate(() => window.scrollY);
        expect(scrollY).toBeGreaterThan(0);

        await page.mouse.up();
    });

    test('scrolls up when dragging handle near top viewport edge', async ({ page }) => {
        // Scroll to bottom so the last card is visible and there is room to scroll up
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const maxScrollY = await page.evaluate(() => window.scrollY);
        expect(maxScrollY).toBeGreaterThan(0);

        // dict-card is the last card; scrolled to bottom it will be within the viewport
        const handle = page.locator('#dict-card .drag-handle');
        const box = await handle.boundingBox();

        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();

        // Enter the top scroll zone
        await page.mouse.move(box.x + box.width / 2, SCROLL_ZONE / 2, { steps: 5 });

        await page.waitForTimeout(250);

        const scrollY = await page.evaluate(() => window.scrollY);
        expect(scrollY).toBeLessThan(maxScrollY);

        await page.mouse.up();
    });

    test('stops auto-scrolling when pointer moves back into the safe zone', async ({ page }) => {
        const handle = page.locator('#drone-card .drag-handle');
        const box = await handle.boundingBox();
        const midX = box.x + box.width / 2;

        await page.mouse.move(midX, box.y + box.height / 2);
        await page.mouse.down();

        // Trigger downward auto-scroll
        await page.mouse.move(midX, VIEWPORT_H - SCROLL_ZONE / 2, { steps: 5 });
        await page.waitForTimeout(200);
        const scrollWhileInZone = await page.evaluate(() => window.scrollY);
        expect(scrollWhileInZone).toBeGreaterThan(0);

        // Move pointer back to the middle of the viewport — scroll should stop
        await page.mouse.move(midX, VIEWPORT_H / 2, { steps: 5 });

        // Record position immediately after leaving the zone, then again after a pause
        const scrollOnExit = await page.evaluate(() => window.scrollY);
        await page.waitForTimeout(200);
        const scrollAfterPause = await page.evaluate(() => window.scrollY);

        expect(scrollAfterPause).toBe(scrollOnExit);

        await page.mouse.up();
    });

    test('can drag first card to last position by scrolling through the full page', async ({ page }) => {
        const handle = page.locator('#drone-card .drag-handle');
        const box = await handle.boundingBox();

        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();

        // Hold at the bottom scroll zone — 2000ms at 8px/frame × ~60fps ≈ 960px scrolled,
        // which exceeds a single viewport height and brings genuinely off-screen cards into view
        await page.mouse.move(box.x + box.width / 2, VIEWPORT_H - SCROLL_ZONE / 2, { steps: 5 });
        await page.waitForTimeout(2000);

        // Confirm the page scrolled further than the full initial viewport height
        const scrollY = await page.evaluate(() => window.scrollY);
        expect(scrollY).toBeGreaterThan(VIEWPORT_H);

        // Drop the card
        await page.mouse.up();

        // drone-card should have moved from the first position
        const order = await page.locator('.card').evaluateAll(cards => cards.map(c => c.id));
        expect(order[0]).not.toBe('drone-card');
    });
});
