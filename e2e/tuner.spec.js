import { test, expect } from '@playwright/test';

test.describe('Chromatic Tuner – pitch detection accuracy', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            // Return an empty MediaStream — bypasses real mic, no permission needed
            navigator.mediaDevices.getUserMedia = async () => new MediaStream();

            const OrigAC = window.AudioContext || window.webkitAudioContext;

            // Return a GainNode so source.connect(analyser) succeeds
            OrigAC.prototype.createMediaStreamSource = function() {
                return this.createGain();
            };

            // Wrap the real AnalyserNode; override getFloatTimeDomainData to inject
            // a synthetic sine wave at window.__tunerTestFreq
            const origCA = OrigAC.prototype.createAnalyser;
            OrigAC.prototype.createAnalyser = function() {
                const analyser = origCA.call(this);
                const sr = this.sampleRate;
                analyser.getFloatTimeDomainData = function(buf) {
                    const freq = window.__tunerTestFreq ?? 440;
                    for (let i = 0; i < buf.length; i++) {
                        buf[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sr);
                    }
                };
                return analyser;
            };
        });
        await page.goto('/');
    });

    async function startAndWait(page, freq) {
        await page.evaluate((f) => { window.__tunerTestFreq = f; }, freq);
        await page.locator('#tunerToggle').click();
        await page.waitForFunction(
            () => document.getElementById('tunerNoteName').textContent.trim() !== '—',
            { timeout: 5000 }
        );
    }

    async function getCents(page) {
        const text = await page.locator('#tunerCentsDisplay').textContent();
        return parseInt(text.replace('¢', ''));
    }

    test('detects A4 (440 Hz) with near-zero cents', async ({ page }) => {
        await startAndWait(page, 440.000);
        await expect(page.locator('#tunerNoteName')).toHaveText('A4');
        const cents = await getCents(page);
        expect(Math.abs(cents)).toBeLessThanOrEqual(10);
    });

    test('detects A3 (220 Hz) with near-zero cents', async ({ page }) => {
        await startAndWait(page, 220.000);
        await expect(page.locator('#tunerNoteName')).toHaveText('A3');
        const cents = await getCents(page);
        expect(Math.abs(cents)).toBeLessThanOrEqual(10);
    });

    test('detects C4 (261.626 Hz) with near-zero cents', async ({ page }) => {
        await startAndWait(page, 261.626);
        await expect(page.locator('#tunerNoteName')).toHaveText('C4');
        const cents = await getCents(page);
        expect(Math.abs(cents)).toBeLessThanOrEqual(10);
    });

    test('detects E4 (329.628 Hz) with near-zero cents', async ({ page }) => {
        await startAndWait(page, 329.628);
        await expect(page.locator('#tunerNoteName')).toHaveText('E4');
        const cents = await getCents(page);
        expect(Math.abs(cents)).toBeLessThanOrEqual(10);
    });

    test('detects A4 sharp +15¢', async ({ page }) => {
        const freq = 440 * Math.pow(2, 15 / 1200);
        await startAndWait(page, freq);
        await expect(page.locator('#tunerNoteName')).toHaveText('A4');
        const cents = await getCents(page);
        expect(cents).toBeGreaterThan(0);
        expect(Math.abs(cents - 15)).toBeLessThanOrEqual(15);
    });

    test('detects A4 flat −20¢', async ({ page }) => {
        const freq = 440 * Math.pow(2, -20 / 1200);
        await startAndWait(page, freq);
        await expect(page.locator('#tunerNoteName')).toHaveText('A4');
        const cents = await getCents(page);
        expect(cents).toBeLessThan(0);
        expect(Math.abs(cents - (-20))).toBeLessThanOrEqual(15);
    });

    test('detects C4 sharp +30¢', async ({ page }) => {
        const freq = 261.626 * Math.pow(2, 30 / 1200);
        await startAndWait(page, freq);
        await expect(page.locator('#tunerNoteName')).toHaveText('C4');
        const cents = await getCents(page);
        expect(cents).toBeGreaterThan(0);
        expect(Math.abs(cents - 30)).toBeLessThanOrEqual(15);
    });

    test('detects E4 flat −10¢', async ({ page }) => {
        const freq = 329.628 * Math.pow(2, -10 / 1200);
        await startAndWait(page, freq);
        await expect(page.locator('#tunerNoteName')).toHaveText('E4');
        const cents = await getCents(page);
        expect(cents).toBeLessThan(0);
        expect(Math.abs(cents - (-10))).toBeLessThanOrEqual(15);
    });
});

test.describe('Chromatic Tuner', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('tuner card is visible on page load', async ({ page }) => {
        await expect(page.locator('#tunerToggle')).toBeVisible();
    });

    test('tunerToggle initial text is "🎤 Start Tuner"', async ({ page }) => {
        await expect(page.locator('#tunerToggle')).toHaveText('🎤 Start Tuner');
    });

    test('A Ref display shows 440 by default', async ({ page }) => {
        await expect(page.locator('#tunerRefVal')).toHaveText('440');
    });

    test('clicking "+" increments refA display to 441', async ({ page }) => {
        await page.locator('#tunerRefPlus').click();
        await expect(page.locator('#tunerRefVal')).toHaveText('441');
    });

    test('clicking "−" decrements refA display to 439', async ({ page }) => {
        await page.locator('#tunerRefMinus').click();
        await expect(page.locator('#tunerRefVal')).toHaveText('439');
    });

    test('clicking "+" enough times stops at 480 (upper bound)', async ({ page }) => {
        // Click 50 times — more than enough to reach 480 from 440
        for (let i = 0; i < 50; i++) {
            await page.locator('#tunerRefPlus').click();
        }
        await expect(page.locator('#tunerRefVal')).toHaveText('480');
    });

    test('clicking "−" enough times stops at 400 (lower bound)', async ({ page }) => {
        // Click 50 times — more than enough to reach 400 from 440
        for (let i = 0; i < 50; i++) {
            await page.locator('#tunerRefMinus').click();
        }
        await expect(page.locator('#tunerRefVal')).toHaveText('400');
    });

    test('refA stepper also updates droneRefVal', async ({ page }) => {
        await page.locator('#tunerRefPlus').click();
        await expect(page.locator('#droneRefVal')).toHaveText('441');
    });

    test('note display shows "—" initially', async ({ page }) => {
        await expect(page.locator('#tunerNoteName')).toHaveText('—');
    });

    test('cents display is empty initially', async ({ page }) => {
        await expect(page.locator('#tunerCentsDisplay')).toHaveText('');
    });
});
