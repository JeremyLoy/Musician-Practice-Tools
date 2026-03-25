import { test, expect } from '@playwright/test';

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
        // Collect the left-edge x position of every card
        const xPositions = await page.locator('.card').evaluateAll(cards =>
            [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().left)))]
        );
        // With CSS columns there must be cards at two different x offsets
        expect(xPositions.length).toBeGreaterThan(1);
    });

    test('cards stack in a single column at 390px width', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const cards = page.locator('.card');
        const firstBox = await cards.nth(0).boundingBox();
        const secondBox = await cards.nth(1).boundingBox();
        // Single column: both cards start at the same x
        expect(Math.abs(firstBox.x - secondBox.x)).toBeLessThan(5);
        // Second card is below the first
        expect(secondBox.y).toBeGreaterThan(firstBox.y);
    });

    test('body is wider than 860px at 1100px viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1100, height: 900 });
        const bodyWidth = await page.evaluate(() => document.body.offsetWidth);
        expect(bodyWidth).toBeGreaterThan(860);
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
