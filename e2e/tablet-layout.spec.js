import { test, expect } from '@playwright/test';

// Returns cards grouped into col1/col2, each sorted top-to-bottom.
async function getCardColumns(page) {
    const positions = await page.locator('.card').evaluateAll(cards =>
        cards.map(c => {
            const r = c.getBoundingClientRect();
            return { id: c.id, left: Math.round(r.left), top: r.top, width: r.width, height: r.height };
        })
    );
    const xValues = [...new Set(positions.map(p => p.left))].sort((a, b) => a - b);
    expect(xValues.length).toBeGreaterThan(1); // sanity: two columns exist
    return {
        col1: positions.filter(p => p.left === xValues[0]).sort((a, b) => a.top - b.top),
        col2: positions.filter(p => p.left === xValues[xValues.length - 1]).sort((a, b) => a.top - b.top),
    };
}

// Drags the handle of srcId to (fraction) down tgtPos, returns before/after order arrays.
async function drag(page, srcId, tgtPos, yFraction = 0.25) {
    const handleBox = await page.locator(`#${srcId} .drag-handle`).boundingBox();
    const before = await page.locator('.card').evaluateAll(cs => cs.map(c => c.id));
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(tgtPos.left + tgtPos.width / 2, tgtPos.top + tgtPos.height * yFraction, { steps: 20 });
    await page.mouse.up();
    const after = await page.locator('.card').evaluateAll(cs => cs.map(c => c.id));
    return { before, after };
}

test.describe('Tablet 2-column layout', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('.card');
        // Clear saved prefs so tests start from a clean state
        await page.evaluate(() => {
            localStorage.removeItem('toolkit_prefs_v2');
        });
        await page.reload();
        await page.waitForSelector('.card');
    });

    test('cards occupy two distinct columns at 768px width', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        const xPositions = await page.locator('.card').evaluateAll(cards =>
            [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().left)))]
        );
        expect(xPositions.length).toBeGreaterThan(1);
    });

    test('cards stack in a single column at 390px width', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const cards = page.locator('.card');
        const firstBox = await cards.nth(0).boundingBox();
        const secondBox = await cards.nth(1).boundingBox();
        expect(Math.abs(firstBox.x - secondBox.x)).toBeLessThan(5);
        expect(secondBox.y).toBeGreaterThan(firstBox.y);
    });

    test('body is wider than 860px at 1100px viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1100, height: 900 });
        const bodyWidth = await page.evaluate(() => document.body.offsetWidth);
        expect(bodyWidth).toBeGreaterThan(860);
    });

    // ── Drag across X axis (different columns, similar Y) ──────────────────
    test('drag-to-reorder: X-axis (col1 top → col2 top)', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        const { col1, col2 } = await getCardColumns(page);
        expect(col1.length).toBeGreaterThan(0);
        expect(col2.length).toBeGreaterThan(0);

        const { before, after } = await drag(page, col1[0].id, col2[0], 0.25);
        expect(after).not.toEqual(before);
    });

    // ── Drag across Y axis (same column, different row) ─────────────────────
    test('drag-to-reorder: Y-axis (col1 top → col1 bottom)', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        const { col1 } = await getCardColumns(page);
        expect(col1.length).toBeGreaterThan(1); // need ≥2 cards in column 1

        const { before, after } = await drag(page, col1[0].id, col1[col1.length - 1], 0.75);
        expect(after).not.toEqual(before);
    });

    // ── Drag diagonally (different column AND different row) ─────────────────
    test('drag-to-reorder: diagonal (col2 bottom → col1 top)', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        const { col1, col2 } = await getCardColumns(page);
        expect(col1.length).toBeGreaterThan(0);
        expect(col2.length).toBeGreaterThan(0);

        // Source: bottom-most card in col2 (high Y, right side).
        // Target: top-most card in col1 (low Y, left side).
        // Both X and Y change substantially — a true diagonal motion.
        const src = col2[col2.length - 1];
        const tgt = col1[0];
        expect(Math.abs(src.top - tgt.top)).toBeGreaterThan(10); // confirm actual Y offset

        const { before, after } = await drag(page, src.id, tgt, 0.25);
        expect(after).not.toEqual(before);
    });
});

test.describe('Card collapse', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('.card-collapse-btn');
        await page.evaluate(() => {
            localStorage.removeItem('toolkit_prefs_v2');
        });
        await page.reload();
        await page.waitForSelector('.card-collapse-btn');
    });

    test('collapse button is present on each card', async ({ page }) => {
        const buttons = page.locator('.card-collapse-btn');
        await expect(buttons).toHaveCount(5);
    });

    test('collapse button meets 44px touch target', async ({ page }) => {
        const btn = page.locator('#drone-card .card-collapse-btn');
        const box = await btn.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
    });

    test('clicking collapse hides card content but keeps header visible', async ({ page }) => {
        const card = page.locator('#drone-card');
        const content = card.locator('.drone-section');
        const header = card.locator('h2');

        await expect(content).toBeVisible();
        await card.locator('.card-collapse-btn').click();
        await expect(content).toBeHidden();
        await expect(header).toBeVisible();
    });

    test('clicking collapse again re-shows card content', async ({ page }) => {
        const card = page.locator('#drone-card');
        const content = card.locator('.drone-section');
        const btn = card.locator('.card-collapse-btn');

        await btn.click();
        await expect(content).toBeHidden();
        await btn.click();
        await expect(content).toBeVisible();
    });

    test('collapsed state persists across page reload', async ({ page }) => {
        await page.locator('#drone-card .card-collapse-btn').click();
        await expect(page.locator('#drone-card')).toHaveClass(/collapsed/);
        await page.reload();
        await page.waitForSelector('.card-collapse-btn');
        await expect(page.locator('#drone-card')).toHaveClass(/collapsed/);
        await expect(page.locator('#drone-card .drone-section')).toBeHidden();
    });

    test('expanded state persists across page reload', async ({ page }) => {
        // Collapse then re-expand
        const btn = page.locator('#metro-card .card-collapse-btn');
        await btn.click();
        await btn.click();
        await page.reload();
        await page.waitForSelector('.card-collapse-btn');
        await expect(page.locator('#metro-card')).not.toHaveClass(/collapsed/);
    });
});
