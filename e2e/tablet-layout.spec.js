import { test, expect } from '@playwright/test';

// Grid constants — must mirror docs/grid-layout.js
const GRID_COLS = 12;
const ROW_HEIGHT_PX = 40;

async function clearLayout(page) {
    await page.evaluate(() => { localStorage.removeItem('toolkit_prefs_v2'); });
    await page.reload();
    await page.waitForSelector('body[data-ready]');
}

test.describe('Default desktop layout', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 1200 });
        await page.goto('/');
        await page.waitForSelector('body[data-ready]');
        await clearLayout(page);
    });

    test('all 6 cards are visible', async ({ page }) => {
        await expect(page.locator('.card')).toHaveCount(6);
        for (const id of ['drone-card', 'metro-card', 'tuner-card', 'spectrum-card', 'memos-card', 'dict-card']) {
            await expect(page.locator(`#${id}`)).toBeVisible();
        }
    });

    test('cards occupy multiple columns (multi-column layout)', async ({ page }) => {
        const xs = await page.locator('.card').evaluateAll(cards =>
            [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().left)))]
        );
        expect(xs.length).toBeGreaterThan(1);
    });

    test('grid container exists with 12 columns', async ({ page }) => {
        const cols = await page.locator('.card-grid').evaluate(el =>
            getComputedStyle(el).gridTemplateColumns.split(' ').length
        );
        expect(cols).toBe(GRID_COLS);
    });

    test('drone and metro share the top row by default', async ({ page }) => {
        const drone = await page.locator('#drone-card').boundingBox();
        const metro = await page.locator('#metro-card').boundingBox();
        expect(Math.abs(drone.y - metro.y)).toBeLessThan(5);
        expect(metro.x).toBeGreaterThan(drone.x);
    });
});

test.describe('Mobile single-column layout', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await page.waitForSelector('body[data-ready]');
        await clearLayout(page);
    });

    test('cards stack with the same left edge', async ({ page }) => {
        const cards = page.locator('.card');
        const first = await cards.nth(0).boundingBox();
        const second = await cards.nth(1).boundingBox();
        expect(Math.abs(first.x - second.x)).toBeLessThan(5);
        expect(second.y).toBeGreaterThan(first.y);
    });

    test('resize handles are hidden on mobile', async ({ page }) => {
        await expect(page.locator('#drone-card .card-resize-handle').first()).toBeHidden();
    });

    test('all 6 cards remain visible', async ({ page }) => {
        await expect(page.locator('.card')).toHaveCount(6);
    });
});

test.describe('Free-form drag (desktop)', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 1600 });
        await page.goto('/');
        await page.waitForSelector('body[data-ready]');
        await clearLayout(page);
    });

    test('dragging drone-card to the right swaps its x with metro', async ({ page }) => {
        const droneBefore = await page.locator('#drone-card').boundingBox();
        const metroBefore = await page.locator('#metro-card').boundingBox();
        expect(droneBefore.x).toBeLessThan(metroBefore.x);

        const handle = page.locator('#drone-card .drag-handle');
        const hb = await handle.boundingBox();
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
        await page.mouse.down();
        // Move into the metro card's centre
        await page.mouse.move(
            metroBefore.x + metroBefore.width / 2,
            metroBefore.y + metroBefore.height / 2,
            { steps: 25 }
        );
        await page.mouse.up();
        await page.waitForTimeout(150);

        const droneAfter = await page.locator('#drone-card').boundingBox();
        // Drone now sits on the right side of the grid
        expect(droneAfter.x).toBeGreaterThan(droneBefore.x);
    });

    test('drag position persists across reload', async ({ page }) => {
        const droneBefore = await page.locator('#drone-card').boundingBox();
        const metroBefore = await page.locator('#metro-card').boundingBox();

        const handle = page.locator('#drone-card .drag-handle');
        const hb = await handle.boundingBox();
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
        await page.mouse.down();
        await page.mouse.move(
            metroBefore.x + metroBefore.width / 2,
            metroBefore.y + metroBefore.height / 2,
            { steps: 25 }
        );
        await page.mouse.up();
        await page.waitForTimeout(150);
        const droneAfterDrag = await page.locator('#drone-card').boundingBox();

        await page.reload();
        await page.waitForSelector('body[data-ready]');
        const droneAfterReload = await page.locator('#drone-card').boundingBox();
        expect(Math.abs(droneAfterReload.x - droneAfterDrag.x)).toBeLessThan(5);
    });

    test('drop ghost appears during drag', async ({ page }) => {
        const handle = page.locator('#drone-card .drag-handle');
        const hb = await handle.boundingBox();
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
        await page.mouse.down();
        await page.mouse.move(hb.x + 200, hb.y + 200, { steps: 10 });
        await expect(page.locator('.grid-drop-ghost')).toBeVisible();
        await page.mouse.up();
        await expect(page.locator('.grid-drop-ghost')).toHaveCount(0);
    });
});

test.describe('Two-axis resize (desktop)', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 1600 });
        await page.goto('/');
        await page.waitForSelector('body[data-ready]');
        await clearLayout(page);
    });

    test('each card has 3 resize handles (right, bottom, corner)', async ({ page }) => {
        await expect(page.locator('#drone-card .card-resize-right')).toHaveCount(1);
        await expect(page.locator('#drone-card .card-resize-bottom')).toHaveCount(1);
        await expect(page.locator('#drone-card .card-resize-corner')).toHaveCount(1);
    });

    test('dragging the bottom edge increases card height', async ({ page }) => {
        const card = page.locator('#drone-card');
        const before = await card.boundingBox();
        const handle = card.locator('.card-resize-bottom');
        const hb = await handle.boundingBox();
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
        await page.mouse.down();
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + ROW_HEIGHT_PX * 4, { steps: 20 });
        await page.mouse.up();
        await page.waitForTimeout(150);

        const after = await card.boundingBox();
        expect(after.height).toBeGreaterThan(before.height);
    });

    test('dragging the right edge increases card width', async ({ page }) => {
        // Use tuner-card (defaults to half-width starting at x=0) so growing right
        // has clear room — drone defaults to x=0, w=6 too, but resizing it would
        // collide with metro.
        const card = page.locator('#tuner-card');
        const before = await card.boundingBox();
        const handle = card.locator('.card-resize-right');
        const hb = await handle.boundingBox();
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
        await page.mouse.down();
        // Drag right by ~3 columns worth of pixels
        const colWidthPx = (await page.locator('.card-grid').boundingBox()).width / GRID_COLS;
        await page.mouse.move(hb.x + hb.width / 2 + colWidthPx * 3, hb.y + hb.height / 2, { steps: 25 });
        await page.mouse.up();
        await page.waitForTimeout(150);

        const after = await card.boundingBox();
        expect(after.width).toBeGreaterThan(before.width + 50);
    });

    test('dragging the corner resizes both width and height', async ({ page }) => {
        const card = page.locator('#tuner-card');
        const before = await card.boundingBox();
        const handle = card.locator('.card-resize-corner');
        const hb = await handle.boundingBox();
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
        await page.mouse.down();
        const colWidthPx = (await page.locator('.card-grid').boundingBox()).width / GRID_COLS;
        await page.mouse.move(
            hb.x + hb.width / 2 + colWidthPx * 2,
            hb.y + hb.height / 2 + ROW_HEIGHT_PX * 3,
            { steps: 25 }
        );
        await page.mouse.up();
        await page.waitForTimeout(150);

        const after = await card.boundingBox();
        expect(after.width).toBeGreaterThan(before.width + 30);
        expect(after.height).toBeGreaterThan(before.height + 30);
    });

    test('resize size persists across reload', async ({ page }) => {
        const card = page.locator('#tuner-card');
        const handle = card.locator('.card-resize-bottom');
        const hb = await handle.boundingBox();
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
        await page.mouse.down();
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + ROW_HEIGHT_PX * 4, { steps: 20 });
        await page.mouse.up();
        await page.waitForTimeout(150);
        const heightBefore = (await card.boundingBox()).height;

        await page.reload();
        await page.waitForSelector('body[data-ready]');
        const heightAfter = (await card.boundingBox()).height;
        expect(Math.abs(heightAfter - heightBefore)).toBeLessThan(5);
    });
});

test.describe('Card collapse', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 1200 });
        await page.goto('/');
        await page.waitForSelector('body[data-ready]');
        await clearLayout(page);
    });

    test('collapse button is present on each card', async ({ page }) => {
        await expect(page.locator('.card-collapse-btn')).toHaveCount(6);
    });

    test('clicking collapse hides the card body and keeps the header', async ({ page }) => {
        const card = page.locator('#drone-card');
        const body = card.locator('.drone-section');
        const header = card.locator('h2');
        await expect(body).toBeVisible();
        await card.locator('.card-collapse-btn').click();
        await expect(body).toBeHidden();
        await expect(header).toBeVisible();
    });

    test('collapsed state persists across reload', async ({ page }) => {
        await page.locator('#drone-card .card-collapse-btn').click();
        await expect(page.locator('#drone-card')).toHaveClass(/collapsed/);
        await page.reload();
        await page.waitForSelector('body[data-ready]');
        await expect(page.locator('#drone-card')).toHaveClass(/collapsed/);
    });
});
