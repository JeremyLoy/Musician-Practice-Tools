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
        await page.waitForSelector('body[data-ready]');
        // Clear saved prefs so tests start from a clean state
        await page.evaluate(() => {
            localStorage.removeItem('toolkit_prefs_v2');
        });
        await page.reload();
        await page.waitForSelector('body[data-ready]');
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

        // Use yFraction=0.75 so the cursor lands in the lower half of the target,
        // which inserts AFTER (not before) — ensuring a reorder even when the
        // source and target are adjacent in DOM order (as in CSS grid layout).
        const { before, after } = await drag(page, col1[0].id, col2[0], 0.75);
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
        // Use a taller viewport so all cards are visible (CSS grid rows stack
        // vertically and can exceed 1024px).
        await page.setViewportSize({ width: 768, height: 2200 });
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

test.describe('Column-isolated drag', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 2200 });
        await page.goto('/');
        await page.waitForSelector('body[data-ready]');
        await page.evaluate(() => { localStorage.removeItem('toolkit_prefs_v2'); });
        await page.reload();
        await page.waitForSelector('body[data-ready]');
    });

    test('dragging within col1 does not change col2 order', async ({ page }) => {
        const { col1, col2 } = await getCardColumns(page);
        expect(col1.length).toBeGreaterThan(1);
        const col2IdsBefore = col2.map(c => c.id);

        // Drag the first card in col1 to below the last card in col1
        await drag(page, col1[0].id, col1[col1.length - 1], 0.75);

        const { col2: col2After } = await getCardColumns(page);
        expect(col2After.map(c => c.id)).toEqual(col2IdsBefore);
    });

    test('dragging card from col1 to col2 does not shift remaining col1 cards relative to each other', async ({ page }) => {
        const { col1 } = await getCardColumns(page);
        expect(col1.length).toBeGreaterThan(1);
        const col1RestBefore = col1.slice(1).map(c => c.id); // cards that should stay in col1

        // Drag the first card in col1 to the second card in col2
        const { col2 } = await getCardColumns(page);
        await drag(page, col1[0].id, col2[0], 0.75);

        const { col1: col1After } = await getCardColumns(page);
        // The remaining cards in col1 should still be in the same relative order
        const col1AfterIds = col1After.map(c => c.id).filter(id => col1RestBefore.includes(id));
        expect(col1AfterIds).toEqual(col1RestBefore);
    });
});

test.describe('Card span cycling (resize grip)', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 2200 });
        await page.goto('/');
        await page.waitForSelector('body[data-ready]');
        await page.evaluate(() => { localStorage.removeItem('toolkit_prefs_v2'); });
        await page.reload();
        await page.waitForSelector('body[data-ready]');
    });

    test('each card has a resize grip with 44px touch target', async ({ page }) => {
        const grips = page.locator('.card-resize-handle');
        await expect(grips).toHaveCount(6);
        for (let i = 0; i < 6; i++) {
            const box = await grips.nth(i).boundingBox();
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
        }
    });

    test('tapping grip cycles card to full-width (2 columns: 1 → full)', async ({ page }) => {
        const grip = page.locator('#drone-card .card-resize-handle');
        await grip.click();

        await expect(page.locator('#drone-card')).toHaveClass(/card-is-full-width/);
    });

    test('tapping grip again returns card to single-column span', async ({ page }) => {
        const grip = page.locator('#drone-card .card-resize-handle');
        // First tap: 1 → full
        await grip.click();
        await expect(page.locator('#drone-card')).toHaveClass(/card-is-full-width/);
        // Second tap: full → 1
        await grip.click();
        await expect(page.locator('#drone-card')).not.toHaveClass(/card-is-full-width/);
    });

    test('full-width state persists across reload', async ({ page }) => {
        const grip = page.locator('#drone-card .card-resize-handle');
        await grip.click();

        await page.reload();
        await page.waitForSelector('body[data-ready]');

        await expect(page.locator('#drone-card')).toHaveClass(/card-is-full-width/);
    });

    test('in 3-column mode, tapping cycles through 1 → 2 → full → 1', async ({ page }) => {
        // Switch to 3 columns
        await page.locator('#colCountPlus').click();
        await expect(page.locator('#colCountVal')).toHaveText('3');

        const card = page.locator('#drone-card');
        const grip = card.locator('.card-resize-handle');

        // Initial: span 1, not full-width
        await expect(card).not.toHaveClass(/card-is-full-width/);

        // Tap 1: span 1 → span 2 (still not full-width since numColumns=3)
        await grip.click();
        await expect(card).not.toHaveClass(/card-is-full-width/);
        // Verify it spans 2 columns via CSS custom property
        const span2 = await card.evaluate(el => getComputedStyle(el).getPropertyValue('--card-col-span'));
        expect(span2.trim()).toBe('2');

        // Tap 2: span 2 → full (span 3 = numColumns)
        await grip.click();
        await expect(card).toHaveClass(/card-is-full-width/);

        // Tap 3: full → span 1
        await grip.click();
        await expect(card).not.toHaveClass(/card-is-full-width/);
        const span1 = await card.evaluate(el => getComputedStyle(el).getPropertyValue('--card-col-span'));
        expect(span1.trim()).toBe('1');
    });

    test('span-2 card and span-1 card share same row in 3-column mode', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 2200 });
        await page.evaluate(() => { localStorage.removeItem('toolkit_prefs_v2'); });
        await page.reload();
        await page.waitForSelector('body[data-ready]');

        // Switch to 3 columns
        await page.locator('#colCountPlus').click();
        await expect(page.locator('#colCountVal')).toHaveText('3');

        // Make drone-card span 2 (tap once: 1 → 2)
        await page.locator('#drone-card .card-resize-handle').click();

        // drone-card should span 2 columns and metro-card should be 1 column
        // They should share the same grid row (same top position)
        await page.locator('#drone-card').scrollIntoViewIfNeeded();
        const positions = await page.evaluate(() => {
            const ids = ['drone-card', 'metro-card'];
            return ids.map(id => {
                const el = document.getElementById(id);
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { id, top: r.top, left: r.left, width: r.width };
            });
        });
        expect(positions.every(p => p !== null)).toBe(true);
        const [drone, metro] = /** @type {Array<{id:string,top:number,left:number,width:number}>} */ (positions);

        // Same top position means same row
        expect(Math.abs(drone.top - metro.top)).toBeLessThan(5);
        // drone should be wider than metro (2 cols vs 1 col)
        expect(drone.width).toBeGreaterThan(metro.width * 1.5);
    });

    test('three span-1 cards share same row in 3-column mode', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 2200 });
        await page.evaluate(() => { localStorage.removeItem('toolkit_prefs_v2'); });
        await page.reload();
        await page.waitForSelector('body[data-ready]');

        // Switch to 3 columns
        await page.locator('#colCountPlus').click();
        await expect(page.locator('#colCountVal')).toHaveText('3');

        // Default layout: all span 1, distributed across 3 columns
        // First 3 cards should share the same row
        await page.locator('#drone-card').scrollIntoViewIfNeeded();
        const positions = await page.evaluate(() => {
            const ids = ['drone-card', 'metro-card', 'memos-card'];
            return ids.map(id => {
                const el = document.getElementById(id);
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { id, top: r.top, left: r.left, width: r.width };
            });
        });

        // All three should be present
        expect(positions.every(p => p !== null)).toBe(true);
        const [drone, metro, memos] = /** @type {Array<{id:string,top:number,left:number,width:number}>} */ (positions);

        // All three on the same row
        expect(Math.abs(drone.top - metro.top)).toBeLessThan(5);
        expect(Math.abs(metro.top - memos.top)).toBeLessThan(5);
        // All three at different X positions
        const xPositions = [drone.left, metro.left, memos.left].sort((a, b) => a - b);
        expect(xPositions[1] - xPositions[0]).toBeGreaterThan(50);
        expect(xPositions[2] - xPositions[1]).toBeGreaterThan(50);
    });
});

test.describe('Column count stepper', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('body[data-ready]');
        await page.evaluate(() => { localStorage.removeItem('toolkit_prefs_v2'); });
        await page.reload();
        await page.waitForSelector('body[data-ready]');
    });

    test('column stepper is visible at 768px', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await expect(page.locator('#colCountCtrl')).toBeVisible();
    });

    test('column stepper is hidden at 390px', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.locator('#colCountCtrl')).toBeHidden();
    });

    test('clicking plus increases column count display', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.locator('#colCountPlus').click();
        await expect(page.locator('#colCountVal')).toHaveText('3');
    });

    test('clicking minus decreases column count display', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.locator('#colCountMinus').click();
        await expect(page.locator('#colCountVal')).toHaveText('1');
    });

    test('clicking minus below 1 has no effect', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.locator('#colCountMinus').click();
        await page.locator('#colCountMinus').click();
        await expect(page.locator('#colCountVal')).toHaveText('1');
    });

    test('clicking plus above 3 has no effect', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        for (let i = 0; i < 5; i++) await page.locator('#colCountPlus').click();
        await expect(page.locator('#colCountVal')).toHaveText('3');
    });

    test('column count persists across reload', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.locator('#colCountPlus').click();
        await page.reload();
        await page.waitForSelector('body[data-ready]');
        await expect(page.locator('#colCountVal')).toHaveText('3');
    });

    test('all 6 cards are present in the DOM after switching to 3 columns', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 2200 });
        await page.locator('#colCountPlus').click();
        await expect(page.locator('#colCountVal')).toHaveText('3');
        const cardIds = await page.locator('.card').evaluateAll(cards => cards.map(c => c.id));
        expect(cardIds).toHaveLength(6);
        expect(cardIds).toContain('drone-card');
        expect(cardIds).toContain('metro-card');
        expect(cardIds).toContain('memos-card');
        expect(cardIds).toContain('tuner-card');
        expect(cardIds).toContain('spectrum-card');
        expect(cardIds).toContain('dict-card');
    });

    test('all 6 cards are visible in 3-column layout', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 2200 });
        await page.locator('#colCountPlus').click();
        await expect(page.locator('#colCountVal')).toHaveText('3');
        const cards = page.locator('.card');
        await expect(cards).toHaveCount(6);
        for (let i = 0; i < 6; i++) {
            await expect(cards.nth(i)).toBeVisible();
        }
    });

    test('switching from 3 columns back to 2 keeps all 6 cards', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 2200 });
        await page.locator('#colCountPlus').click();
        await page.locator('#colCountMinus').click();
        await expect(page.locator('#colCountVal')).toHaveText('2');
        await expect(page.locator('.card')).toHaveCount(6);
    });

    test('3-column layout renders cards in exactly 3 columns', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 2200 });
        await page.locator('#colCountPlus').click();
        await expect(page.locator('#colCountVal')).toHaveText('3');
        const xPositions = await page.locator('.card').evaluateAll(cards =>
            [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().left)))]
        );
        expect(xPositions.length).toBe(3);
    });
});

test.describe('Card collapse', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('body[data-ready]');
        await page.evaluate(() => {
            localStorage.removeItem('toolkit_prefs_v2');
        });
        await page.reload();
        await page.waitForSelector('body[data-ready]');
    });

    test('collapse button is present on each card', async ({ page }) => {
        const buttons = page.locator('.card-collapse-btn');
        await expect(buttons).toHaveCount(6);
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
        await page.waitForSelector('body[data-ready]');
        await expect(page.locator('#drone-card')).toHaveClass(/collapsed/);
        await expect(page.locator('#drone-card .drone-section')).toBeHidden();
    });

    test('expanded state persists across page reload', async ({ page }) => {
        // Collapse then re-expand
        const btn = page.locator('#metro-card .card-collapse-btn');
        await btn.click();
        await btn.click();
        await page.reload();
        await page.waitForSelector('body[data-ready]');
        await expect(page.locator('#metro-card')).not.toHaveClass(/collapsed/);
    });
});
