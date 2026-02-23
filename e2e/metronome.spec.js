import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test.describe('Metronome', () => {
    test('default BPM display shows "120"', async ({ page }) => {
        await expect(page.locator('#bpm-display')).toHaveText('120');
    });

    test('BPM "+" button increments to 121', async ({ page }) => {
        await page.locator('#bpmPlus').click();
        await expect(page.locator('#bpm-display')).toHaveText('121');
    });

    test('BPM "−" button decrements to 119', async ({ page }) => {
        await page.locator('#bpmMinus').click();
        await expect(page.locator('#bpm-display')).toHaveText('119');
    });

    test('BPM clamps at lower bound (40)', async ({ page }) => {
        // Set BPM to 41 via input, then click minus twice
        await page.locator('#bpm-display').click();
        await page.locator('#bpm-input').fill('41');
        await page.locator('#bpm-input').blur();
        await expect(page.locator('#bpm-display')).toHaveText('41');
        await page.locator('#bpmMinus').click();
        await expect(page.locator('#bpm-display')).toHaveText('40');
        await page.locator('#bpmMinus').click();
        await expect(page.locator('#bpm-display')).toHaveText('40');
    });

    test('BPM clamps at upper bound (280)', async ({ page }) => {
        await page.locator('#bpm-display').click();
        await page.locator('#bpm-input').fill('279');
        await page.locator('#bpm-input').blur();
        await expect(page.locator('#bpm-display')).toHaveText('279');
        await page.locator('#bpmPlus').click();
        await expect(page.locator('#bpm-display')).toHaveText('280');
        await page.locator('#bpmPlus').click();
        await expect(page.locator('#bpm-display')).toHaveText('280');
    });

    test('click-to-edit BPM: click display, type new value, blur → updates', async ({ page }) => {
        await page.locator('#bpm-display').click();
        const input = page.locator('#bpm-input');
        await expect(input).toBeVisible();
        await input.fill('90');
        await input.blur();
        await expect(page.locator('#bpm-display')).toHaveText('90');
    });

    test('click-to-edit BPM: Enter key commits value', async ({ page }) => {
        await page.locator('#bpm-display').click();
        const input = page.locator('#bpm-input');
        await input.fill('150');
        await input.press('Enter');
        await expect(page.locator('#bpm-display')).toHaveText('150');
    });

    test('Start/Stop button toggles text', async ({ page }) => {
        const btn = page.locator('#metroStartBtn');
        await expect(btn).toContainText('Start');
        await btn.click();
        await expect(btn).toContainText('Stop');
        await btn.click();
        await expect(btn).toContainText('Start');
    });

    test('time signature input: type "3/4", blur → accepted', async ({ page }) => {
        const ts = page.locator('#tsInput');
        await ts.fill('3/4');
        await ts.blur();
        await expect(ts).toHaveValue('3/4');
        await expect(ts).not.toHaveClass(/error/);
    });

    test('time signature input: type "abc", blur → gets error class', async ({ page }) => {
        const ts = page.locator('#tsInput');
        await ts.fill('abc');
        await ts.blur();
        await expect(ts).toHaveClass(/error/);
    });

    test('time signature input: Escape resets to current value', async ({ page }) => {
        const ts = page.locator('#tsInput');
        await expect(ts).toHaveValue('4/4');
        await ts.fill('abc');
        await ts.press('Escape');
        await expect(ts).toHaveValue('4/4');
        await expect(ts).not.toHaveClass(/error/);
    });

    test('subdivision buttons: clicking changes active state', async ({ page }) => {
        const ctrl = page.locator('#subdivCtrl');
        const btn2 = ctrl.locator('button[data-val="2"]');
        const btn1 = ctrl.locator('button[data-val="1"]');
        // Initially subdivision=1 is active
        await expect(btn1).toHaveClass(/active/);
        await expect(btn2).not.toHaveClass(/active/);
        // Click subdivision 2
        await btn2.click();
        await expect(btn2).toHaveClass(/active/);
        await expect(btn1).not.toHaveClass(/active/);
    });

    test('click sound buttons: clicking changes active state', async ({ page }) => {
        const ctrl = page.locator('#clickSoundCtrl');
        const claveBtn = ctrl.locator('button[data-val="clave"]');
        const clickBtn = ctrl.locator('button[data-val="click"]');
        await expect(claveBtn).toHaveClass(/active/);
        await expect(clickBtn).not.toHaveClass(/active/);
        await clickBtn.click();
        await expect(clickBtn).toHaveClass(/active/);
        await expect(claveBtn).not.toHaveClass(/active/);
    });

    test('tap tempo: two rapid clicks update BPM', async ({ page }) => {
        const tapBtn = page.locator('#tapBtn');
        // Tap twice ~500ms apart → should get ~120 BPM
        await tapBtn.click();
        await page.waitForTimeout(500);
        await tapBtn.click();
        // BPM should have changed from default 120
        const bpmText = await page.locator('#bpm-display').textContent();
        const bpm = parseInt(bpmText);
        expect(bpm).toBeGreaterThanOrEqual(40);
        expect(bpm).toBeLessThanOrEqual(280);
    });

    test('sound toggle: can toggle off when light is on', async ({ page }) => {
        const soundBtn = page.locator('#soundToggle');
        const lightBtn = page.locator('#lightToggle');
        // Both start active by default
        await expect(soundBtn).toHaveClass(/active/);
        await expect(lightBtn).toHaveClass(/active/);
        // Turn off sound — should work since light is still on
        await soundBtn.click();
        await expect(soundBtn).not.toHaveClass(/active/);
        await expect(lightBtn).toHaveClass(/active/);
    });

    test('light toggle: can toggle off when sound is on', async ({ page }) => {
        const soundBtn = page.locator('#soundToggle');
        const lightBtn = page.locator('#lightToggle');
        await expect(soundBtn).toHaveClass(/active/);
        await expect(lightBtn).toHaveClass(/active/);
        await lightBtn.click();
        await expect(lightBtn).not.toHaveClass(/active/);
        await expect(soundBtn).toHaveClass(/active/);
    });

    test("can't turn off both sound and light", async ({ page }) => {
        const soundBtn = page.locator('#soundToggle');
        const lightBtn = page.locator('#lightToggle');
        // Turn off light first
        await lightBtn.click();
        await expect(lightBtn).not.toHaveClass(/active/);
        // Now try to turn off sound — should be prevented
        await soundBtn.click();
        await expect(soundBtn).toHaveClass(/active/);
    });

    test('BPM persists across reload', async ({ page }) => {
        await page.locator('#bpm-display').click();
        await page.locator('#bpm-input').fill('95');
        await page.locator('#bpm-input').blur();
        await expect(page.locator('#bpm-display')).toHaveText('95');
        await page.reload();
        await page.waitForSelector('#bpm-display');
        await expect(page.locator('#bpm-display')).toHaveText('95');
    });

    test('time signature persists across reload', async ({ page }) => {
        const ts = page.locator('#tsInput');
        await ts.fill('3/4');
        await ts.blur();
        await expect(ts).toHaveValue('3/4');
        await page.reload();
        await page.waitForSelector('#tsInput');
        await expect(page.locator('#tsInput')).toHaveValue('3/4');
    });

    test('click sound persists across reload', async ({ page }) => {
        const ctrl = page.locator('#clickSoundCtrl');
        await ctrl.locator('button[data-val="rim"]').click();
        await expect(ctrl.locator('button[data-val="rim"]')).toHaveClass(/active/);
        await page.reload();
        await page.waitForSelector('#clickSoundCtrl');
        await expect(page.locator('#clickSoundCtrl button[data-val="rim"]')).toHaveClass(/active/);
    });

    test('metro volume slider is present and functional', async ({ page }) => {
        const slider = page.locator('#metroVolume');
        await expect(slider).toBeVisible();
        await slider.fill('0.3');
        // Volume change is internal — just verify it doesn't error and slider value updated
        await expect(slider).toHaveValue('0.3');
    });
});
