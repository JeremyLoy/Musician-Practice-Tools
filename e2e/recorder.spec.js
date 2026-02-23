import { test, expect } from '@playwright/test';

// ─── Mocks ───────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
    // Stub WaveSurfer so we don't need the real audio library for e2e tests.
    // Must use route() because the <script defer> tag loads wavesurfer.min.js
    // from the network after addInitScript runs, which would overwrite a global.
    await page.route('**/wavesurfer.min.js', route => {
        route.fulfill({
            contentType: 'application/javascript',
            body: `
                window.WaveSurfer = {
                    create(opts) {
                        const handlers = {};
                        return {
                            on(event, cb) { handlers[event] = cb; },
                            playPause() {
                                if (this._playing) {
                                    this._playing = false;
                                    handlers['pause'] && handlers['pause']();
                                } else {
                                    this._playing = true;
                                    handlers['play'] && handlers['play']();
                                }
                            },
                            _playing: false
                        };
                    }
                };
            `
        });
    });

    await page.addInitScript(() => {
        // Mock getUserMedia — returns an empty MediaStream (no real mic needed)
        navigator.mediaDevices.getUserMedia = async () => new MediaStream();

        // Mock MediaRecorder — fires ondataavailable after 50ms, then calls onstop
        window.MediaRecorder = class MockMediaRecorder {
            constructor(stream, opts) {
                this.stream = stream;
                this.mimeType = (opts && opts.mimeType) || 'audio/webm';
                this.state = 'inactive';
                this.ondataavailable = null;
                this.onstop = null;
            }
            start(timeslice) {
                this.state = 'recording';
                // Fire ondataavailable once with a small fake blob
                setTimeout(() => {
                    if (this.ondataavailable) {
                        this.ondataavailable({ data: new Blob(['fake'], { type: this.mimeType }) });
                    }
                }, 50);
            }
            stop() {
                this.state = 'inactive';
                if (this.onstop) this.onstop();
            }
            static isTypeSupported(type) {
                return type === '' || type === 'audio/webm';
            }
        };

        // AudioContext.createMediaStreamSource stub (same pattern as tuner.spec.js)
        const OrigAC = window.AudioContext || window.webkitAudioContext;
        OrigAC.prototype.createMediaStreamSource = function() { return this.createGain(); };
    });

    await page.goto('/');
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function recordOneMemo(page) {
    await page.locator('#recordToggle').click();
    await expect(page.locator('#recordToggle')).toHaveText('⏹️ Stop Recording');
    await page.waitForTimeout(200);   // let ondataavailable fire
    await page.locator('#recordToggle').click();
    await page.waitForSelector('.recording-item');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Audio Recorder', () => {
    test('recorder card is visible on page load', async ({ page }) => {
        await expect(page.locator('#recordToggle')).toBeVisible();
        await expect(page.locator('#recordToggle')).toHaveText('🎙️ Start Recording');
    });

    test('memo list is empty initially', async ({ page }) => {
        await expect(page.locator('.recording-item')).toHaveCount(0);
    });

    test('can record and see a memo in the list', async ({ page }) => {
        await recordOneMemo(page);
        await expect(page.locator('.recording-item')).toHaveCount(1);
    });

    test('recorded memo has Play, Export, and Delete buttons', async ({ page }) => {
        await recordOneMemo(page);
        const item = page.locator('.recording-item').first();
        await expect(item.locator('button', { hasText: '▶ Play' })).toBeVisible();
        await expect(item.locator('button', { hasText: '⬇ Export' })).toBeVisible();
        await expect(item.locator('button', { hasText: '🗑 Delete' })).toBeVisible();
    });

    test('Play button toggles to Pause then back to Play', async ({ page }) => {
        await recordOneMemo(page);
        const playBtn = page.locator('.recording-item').first().locator('button', { hasText: '▶ Play' });
        await playBtn.click();
        await expect(page.locator('.recording-item').first().locator('button', { hasText: '⏸ Pause' })).toBeVisible();
        await page.locator('.recording-item').first().locator('button', { hasText: '⏸ Pause' }).click();
        await expect(page.locator('.recording-item').first().locator('button', { hasText: '▶ Play' })).toBeVisible();
    });

    test('can rename a memo', async ({ page }) => {
        await recordOneMemo(page);
        const item = page.locator('.recording-item').first();
        // Click the rename button (✏️)
        await item.locator('button', { hasText: '✏️' }).click();
        // Clear and type new name
        const input = item.locator('input[type="text"]');
        await input.fill('My Test Memo');
        await input.press('Enter');
        // The label should now show the new name
        await expect(item.locator('strong')).toHaveText('My Test Memo');
    });

    test('can export (download) a memo', async ({ page }) => {
        await recordOneMemo(page);
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.recording-item').first().locator('button', { hasText: '⬇ Export' }).click()
        ]);
        expect(download.suggestedFilename()).toMatch(/\.(webm|mp4|ogg)$/);
    });

    test('can delete a memo', async ({ page }) => {
        await recordOneMemo(page);
        await expect(page.locator('.recording-item')).toHaveCount(1);
        page.on('dialog', dialog => dialog.accept());
        await page.locator('.recording-item').first().locator('button', { hasText: '🗑 Delete' }).click();
        await expect(page.locator('.recording-item')).toHaveCount(0);
    });

    test('deleted memo is gone after page reload', async ({ page }) => {
        await recordOneMemo(page);
        page.on('dialog', dialog => dialog.accept());
        await page.locator('.recording-item').first().locator('button', { hasText: '🗑 Delete' }).click();
        await expect(page.locator('.recording-item')).toHaveCount(0);
        await page.reload();
        await page.waitForSelector('#recordToggle');
        await expect(page.locator('.recording-item')).toHaveCount(0);
    });
});
