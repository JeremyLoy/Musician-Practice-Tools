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

test.describe('Full-width resize grip', () => {
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

    test('dragging grip right by 80px makes card full-width', async ({ page }) => {
        const grip = page.locator('#drone-card .card-resize-handle');
        const box = await grip.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 10 });
        await page.mouse.up();

        await expect(page.locator('#drone-card')).toHaveClass(/card-is-full-width/);
    });

    test('full-width card has card-is-full-width class', async ({ page }) => {
        const grip = page.locator('#drone-card .card-resize-handle');
        const box = await grip.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 10 });
        await page.mouse.up();

        await expect(page.locator('#drone-card')).toHaveClass(/card-is-full-width/);
    });

    test('dragging grip left by 80px on full-width card returns it to a column', async ({ page }) => {
        // First expand to full-width
        const grip = page.locator('#drone-card .card-resize-handle');
        const box = await grip.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 10 });
        await page.mouse.up();
        await expect(page.locator('#drone-card')).toHaveClass(/card-is-full-width/);

        // Scroll card into view — it may have moved
        await page.locator('#drone-card').scrollIntoViewIfNeeded();

        // Now contract back
        const box2 = await grip.boundingBox();
        await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
        await page.mouse.down();
        await page.mouse.move(box2.x + box2.width / 2 - 80, box2.y + box2.height / 2, { steps: 10 });
        await page.mouse.up();

        await expect(page.locator('#drone-card')).not.toHaveClass(/card-is-full-width/);
        const parent = await page.locator('#drone-card').evaluate(el => el.parentElement?.className ?? '');
        expect(parent).toContain('card-grid-col');
    });

    test('full-width state persists across reload', async ({ page }) => {
        const grip = page.locator('#drone-card .card-resize-handle');
        const box = await grip.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 10 });
        await page.mouse.up();

        await page.reload();
        await page.waitForSelector('body[data-ready]');

        await expect(page.locator('#drone-card')).toHaveClass(/card-is-full-width/);
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
