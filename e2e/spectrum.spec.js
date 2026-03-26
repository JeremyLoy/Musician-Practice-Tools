import { test, expect } from '@playwright/test';

test.describe('Spectral Analysis', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('spectrum card is visible on page load', async ({ page }) => {
        await expect(page.locator('#spectrum-card')).toBeVisible();
        await expect(page.locator('#spectrum-card h2')).toContainText('Spectral Analysis');
    });

    test('toggle button initial text is "Start Analyser"', async ({ page }) => {
        await expect(page.locator('#spectrumToggle')).toHaveText('Start Analyser');
    });

    test('canvas element exists inside the card', async ({ page }) => {
        await expect(page.locator('#spectrumCanvas')).toBeVisible();
    });

    test('collapse button hides spectrum body', async ({ page }) => {
        const body = page.locator('#spectrum-card .spectrum-body');
        await expect(body).toBeVisible();
        await page.locator('#spectrum-card .card-collapse-btn').click();
        await expect(body).not.toBeVisible();
        // Expand again
        await page.locator('#spectrum-card .card-collapse-btn').click();
        await expect(body).toBeVisible();
    });
});

test.describe('Spectral Analysis – live analyser', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            // Fake mic stream
            navigator.mediaDevices.getUserMedia = async () => new MediaStream();

            const OrigAC = window.AudioContext || window.webkitAudioContext;

            // Return a GainNode so source.connect(analyser) succeeds
            OrigAC.prototype.createMediaStreamSource = function () {
                return this.createGain();
            };

            // Override getFloatFrequencyData to inject a sawtooth-like harmonic series
            const origCA = OrigAC.prototype.createAnalyser;
            OrigAC.prototype.createAnalyser = function () {
                const analyser = origCA.call(this);
                analyser.getFloatFrequencyData = function (buf) {
                    const sr = 44100;
                    const fftSize = analyser.fftSize || 8192;
                    const binWidth = sr / fftSize;
                    buf.fill(-100);
                    // Inject sawtooth harmonics at 440 Hz
                    const fundamental = 440;
                    for (let n = 1; n <= 6; n++) {
                        const bin = Math.round((fundamental * n) / binWidth);
                        if (bin < buf.length) {
                            buf[bin] = -10 + 20 * Math.log10(1 / n);
                        }
                    }
                };
                return analyser;
            };
        });
        await page.goto('/');
    });

    test('start/stop toggle changes button text and class', async ({ page }) => {
        const btn = page.locator('#spectrumToggle');
        await btn.click();
        await expect(btn).toHaveText('Stop Analyser');
        await expect(btn).toHaveClass(/is-active/);

        await btn.click();
        await expect(btn).toHaveText('Start Analyser');
        await expect(btn).not.toHaveClass(/is-active/);
    });

    test('canvas has non-empty pixel data while running', async ({ page }) => {
        await page.locator('#spectrumToggle').click();
        // Wait a frame for drawing to occur
        await page.waitForTimeout(200);

        const hasContent = await page.evaluate(() => {
            const canvas = document.getElementById('spectrumCanvas');
            const ctx = canvas.getContext('2d');
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            // Check if any non-zero, non-transparent pixels exist
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) return true;
            }
            return false;
        });
        expect(hasContent).toBe(true);
    });
});
