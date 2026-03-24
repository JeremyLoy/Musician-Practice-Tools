import { test, expect } from '@playwright/test';

test.describe('Card drag-to-reorder', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('.drag-handle');
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
        await page.waitForSelector('.drag-handle');
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
