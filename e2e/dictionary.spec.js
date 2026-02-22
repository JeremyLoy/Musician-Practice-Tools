import { test, expect } from '@playwright/test';

test.describe('Musical Dictionary', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.dict-item');
  });

  test('shows all terms on load (>300 items)', async ({ page }) => {
    const count = await page.locator('.dict-item').count();
    expect(count).toBeGreaterThan(300);
  });

  test('filters results when typing "allegro"', async ({ page }) => {
    const allCount = await page.locator('.dict-item').count();
    await page.locator('#dictSearch').fill('allegro');
    await page.waitForSelector('.dict-item');
    const filteredCount = await page.locator('.dict-item').count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(allCount);
    const firstTerm = await page.locator('.dict-item .dict-term').first().textContent();
    expect(firstTerm.toLowerCase()).toContain('allegro');
  });

  test('shows .dict-empty for unrecognised search string', async ({ page }) => {
    await page.locator('#dictSearch').fill('xqznotaword');
    await page.waitForSelector('.dict-empty');
    await expect(page.locator('.dict-empty')).toBeVisible();
    expect(await page.locator('.dict-item').count()).toBe(0);
  });

  test('clears search and restores all results', async ({ page }) => {
    const originalCount = await page.locator('.dict-item').count();
    await page.locator('#dictSearch').fill('xqznotaword');
    await page.waitForSelector('.dict-empty');
    await page.locator('#dictSearch').fill('');
    await page.waitForSelector('.dict-item');
    const restoredCount = await page.locator('.dict-item').count();
    expect(restoredCount).toBe(originalCount);
  });

  test('search is case-insensitive', async ({ page }) => {
    await page.locator('#dictSearch').fill('allegro');
    await page.waitForSelector('.dict-item');
    const lowerCount = await page.locator('.dict-item').count();
    await page.locator('#dictSearch').fill('ALLEGRO');
    await page.waitForSelector('.dict-item');
    const upperCount = await page.locator('.dict-item').count();
    expect(upperCount).toBe(lowerCount);
  });
});
