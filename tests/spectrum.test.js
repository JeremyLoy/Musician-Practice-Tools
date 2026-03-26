import { describe, test, expect } from 'bun:test';
import {
    computeSpectrum, frequencyToX, xToFrequency,
    findPeaks, dbToY
} from '../docs/spectrum.js';

const SAMPLE_RATE = 44100;
const FFT_SIZE = 8192;
const BIN_WIDTH = SAMPLE_RATE / FFT_SIZE; // ~5.383 Hz per bin
const BIN_COUNT = FFT_SIZE / 2;           // 4096 bins

/**
 * Creates a Float32Array of frequency-domain data (like getFloatFrequencyData output)
 * with all bins at floorDb, and specified peaks injected at their bin positions.
 * @param {{ freq: number, db: number }[]} peaks
 * @param {number} [floorDb=-100]
 * @returns {Float32Array}
 */
function makeFreqData(peaks, floorDb = -100) {
    const data = new Float32Array(BIN_COUNT).fill(floorDb);
    for (const { freq, db } of peaks) {
        const bin = Math.round(freq / BIN_WIDTH);
        if (bin > 0 && bin < BIN_COUNT) data[bin] = db;
    }
    return data;
}

/**
 * Generates sawtooth harmonic series: f, 2f, 3f, ... with amplitude 1/n.
 * dB values: 20*log10(1/n) relative to fundamental at 0 dB.
 * @param {number} fundamental - Fundamental frequency in Hz.
 * @param {number} numHarmonics - Number of harmonics to include.
 * @returns {{ freq: number, db: number }[]}
 */
function sawtoothHarmonics(fundamental, numHarmonics) {
    const peaks = [];
    for (let n = 1; n <= numHarmonics; n++) {
        peaks.push({ freq: fundamental * n, db: 20 * Math.log10(1 / n) });
    }
    return peaks;
}

/**
 * Generates square wave harmonic series: odd harmonics only (f, 3f, 5f, ...) with amplitude 1/n.
 * @param {number} fundamental
 * @param {number} numOddHarmonics
 * @returns {{ freq: number, db: number }[]}
 */
function squareHarmonics(fundamental, numOddHarmonics) {
    const peaks = [];
    for (let i = 0; i < numOddHarmonics; i++) {
        const n = 2 * i + 1; // 1, 3, 5, 7, ...
        peaks.push({ freq: fundamental * n, db: 20 * Math.log10(1 / n) });
    }
    return peaks;
}

// ─── computeSpectrum ─────────────────────────────────────────────────────────

describe('computeSpectrum', () => {
    test('output length is binCount - 1 (skips DC)', () => {
        const data = new Float32Array(BIN_COUNT).fill(-80);
        const result = computeSpectrum(data, FFT_SIZE, SAMPLE_RATE);
        expect(result.length).toBe(BIN_COUNT - 1);
    });

    test('bin frequencies are correctly mapped', () => {
        const data = new Float32Array(BIN_COUNT).fill(-80);
        const result = computeSpectrum(data, FFT_SIZE, SAMPLE_RATE);
        // First element is bin 1
        expect(result[0].freq).toBeCloseTo(BIN_WIDTH, 2);
        // Last element is bin BIN_COUNT-1
        expect(result[result.length - 1].freq).toBeCloseTo((BIN_COUNT - 1) * BIN_WIDTH, 2);
    });

    test('dB values pass through correctly', () => {
        const data = new Float32Array(BIN_COUNT).fill(-60);
        data[100] = -20;
        const result = computeSpectrum(data, FFT_SIZE, SAMPLE_RATE);
        // bin 100 maps to result index 99 (we skip bin 0)
        expect(result[99].db).toBe(-20);
        expect(result[0].db).toBe(-60);
    });
});

// ─── frequencyToX / xToFrequency ─────────────────────────────────────────────

describe('frequencyToX', () => {
    const W = 1000;
    const MIN = 60;
    const MAX = 8000;

    test('minFreq maps to x=0', () => {
        expect(frequencyToX(MIN, W, MIN, MAX)).toBe(0);
    });

    test('maxFreq maps to x=width', () => {
        expect(frequencyToX(MAX, W, MIN, MAX)).toBeCloseTo(W, 10);
    });

    test('frequency below minFreq clamps to 0', () => {
        expect(frequencyToX(20, W, MIN, MAX)).toBe(0);
    });

    test('frequency above maxFreq clamps to width', () => {
        expect(frequencyToX(20000, W, MIN, MAX)).toBe(W);
    });

    test('octave doublings produce equal X spacing (logarithmic)', () => {
        // C3=130.81 → C4=261.63 → C5=523.25 should have equal spacing
        const x3 = frequencyToX(130.81, W, MIN, MAX);
        const x4 = frequencyToX(261.63, W, MIN, MAX);
        const x5 = frequencyToX(523.25, W, MIN, MAX);
        const span34 = x4 - x3;
        const span45 = x5 - x4;
        expect(span34).toBeCloseTo(span45, 0); // within 1 pixel
    });

    test('freq=0 returns 0', () => {
        expect(frequencyToX(0, W, MIN, MAX)).toBe(0);
    });
});

describe('xToFrequency', () => {
    const W = 1000;
    const MIN = 60;
    const MAX = 8000;

    test('x=0 returns minFreq', () => {
        expect(xToFrequency(0, W, MIN, MAX)).toBeCloseTo(MIN, 2);
    });

    test('x=width returns maxFreq', () => {
        expect(xToFrequency(W, W, MIN, MAX)).toBeCloseTo(MAX, 0);
    });

    test('round-trip: frequencyToX → xToFrequency preserves frequency', () => {
        const testFreqs = [100, 220, 440, 880, 1760, 3520];
        for (const f of testFreqs) {
            const x = frequencyToX(f, W, MIN, MAX);
            const recovered = xToFrequency(x, W, MIN, MAX);
            expect(recovered).toBeCloseTo(f, 1);
        }
    });
});

// ─── dbToY ───────────────────────────────────────────────────────────────────

describe('dbToY', () => {
    const H = 400;
    const MIN_DB = -100;
    const MAX_DB = -10;

    test('maxDb maps to y=0 (top = loudest)', () => {
        expect(dbToY(MAX_DB, H, MIN_DB, MAX_DB)).toBe(0);
    });

    test('minDb maps to y=height (bottom = quietest)', () => {
        expect(dbToY(MIN_DB, H, MIN_DB, MAX_DB)).toBe(H);
    });

    test('midpoint dB maps to y=height/2', () => {
        const midDb = (MIN_DB + MAX_DB) / 2;
        expect(dbToY(midDb, H, MIN_DB, MAX_DB)).toBeCloseTo(H / 2, 2);
    });

    test('dB below minDb clamps to height', () => {
        expect(dbToY(-200, H, MIN_DB, MAX_DB)).toBe(H);
    });

    test('dB above maxDb clamps to 0', () => {
        expect(dbToY(10, H, MIN_DB, MAX_DB)).toBe(0);
    });
});

// ─── findPeaks with complex harmonic signals ─────────────────────────────────

describe('findPeaks', () => {
    test('sawtooth at A2 (110 Hz): finds all harmonics above threshold', () => {
        // Sawtooth: harmonics at 110, 220, 330, 440, 550, 660, 770, 880 Hz
        // Amplitudes: 0, -6.02, -9.54, -12.04, -13.98, -15.56, -16.90, -18.06 dB
        const harmonics = sawtoothHarmonics(110, 8);
        const data = makeFreqData(harmonics);
        const spectrum = computeSpectrum(data, FFT_SIZE, SAMPLE_RATE);
        const peaks = findPeaks(spectrum, -20);

        expect(peaks.length).toBe(8);
        // Verify each expected harmonic is found (within one bin width)
        for (const h of harmonics) {
            const found = peaks.find(p => Math.abs(p.freq - h.freq) < BIN_WIDTH * 1.5);
            expect(found).toBeDefined();
        }
        // Strongest peak should be the fundamental
        expect(Math.abs(peaks[0].freq - 110)).toBeLessThan(BIN_WIDTH * 1.5);
    });

    test('square wave at A3 (220 Hz): only odd harmonics present', () => {
        // Square: odd harmonics at 220, 660, 1100, 1540, 1980 Hz
        const harmonics = squareHarmonics(220, 5);
        const data = makeFreqData(harmonics);
        const spectrum = computeSpectrum(data, FFT_SIZE, SAMPLE_RATE);
        const peaks = findPeaks(spectrum, -20);

        // Should find the odd harmonics
        const oddFreqs = [220, 660, 1100, 1540];
        for (const f of oddFreqs) {
            const found = peaks.find(p => Math.abs(p.freq - f) < BIN_WIDTH * 1.5);
            expect(found).toBeDefined();
        }

        // Even harmonics (440, 880) should NOT be peaks
        const evenFreqs = [440, 880];
        for (const f of evenFreqs) {
            const found = peaks.find(p => Math.abs(p.freq - f) < BIN_WIDTH * 1.5);
            expect(found).toBeUndefined();
        }
    });

    test('clarinet-like at C4 (261.63 Hz): odd harmonics dominate', () => {
        // Clarinet: strong odd harmonics, weak even harmonics
        const fundamental = 261.63;
        const clarinetPeaks = [
            { freq: fundamental * 1, db: 0 },     // 1st (odd) — strongest
            { freq: fundamental * 2, db: -22 },    // 2nd (even) — weak
            { freq: fundamental * 3, db: -4 },     // 3rd (odd) — strong
            { freq: fundamental * 4, db: -26 },    // 4th (even) — weak
            { freq: fundamental * 5, db: -8 },     // 5th (odd) — strong
            { freq: fundamental * 6, db: -28 },    // 6th (even) — very weak
            { freq: fundamental * 7, db: -14 },    // 7th (odd) — moderate
        ];
        const data = makeFreqData(clarinetPeaks);
        const spectrum = computeSpectrum(data, FFT_SIZE, SAMPLE_RATE);
        const peaks = findPeaks(spectrum, -30);

        // Verify odd harmonics are found with higher dB than adjacent even harmonics
        const h1 = peaks.find(p => Math.abs(p.freq - fundamental) < BIN_WIDTH * 1.5);
        const h3 = peaks.find(p => Math.abs(p.freq - fundamental * 3) < BIN_WIDTH * 1.5);
        const h2 = peaks.find(p => Math.abs(p.freq - fundamental * 2) < BIN_WIDTH * 1.5);
        const h4 = peaks.find(p => Math.abs(p.freq - fundamental * 4) < BIN_WIDTH * 1.5);

        expect(h1).toBeDefined();
        expect(h3).toBeDefined();
        expect(h1.db).toBeGreaterThan(h2?.db ?? -Infinity);
        expect(h3.db).toBeGreaterThan(h4?.db ?? -Infinity);
    });

    test('two simultaneous notes (A3 + E4 perfect fifth): both fundamentals detected', () => {
        // A3 = 220 Hz with harmonics, E4 = 329.63 Hz with harmonics
        const aPeaks = sawtoothHarmonics(220, 4);     // 220, 440, 660, 880
        const ePeaks = sawtoothHarmonics(329.63, 3);   // 329.63, 659.26, 988.89
        const allPeaks = [...aPeaks, ...ePeaks];
        const data = makeFreqData(allPeaks);
        const spectrum = computeSpectrum(data, FFT_SIZE, SAMPLE_RATE);
        const peaks = findPeaks(spectrum, -15);

        // Both fundamentals should be detected
        const foundA = peaks.find(p => Math.abs(p.freq - 220) < BIN_WIDTH * 1.5);
        const foundE = peaks.find(p => Math.abs(p.freq - 329.63) < BIN_WIDTH * 1.5);
        expect(foundA).toBeDefined();
        expect(foundE).toBeDefined();

        // Their harmonics should also be present
        const foundA2 = peaks.find(p => Math.abs(p.freq - 440) < BIN_WIDTH * 1.5);
        expect(foundA2).toBeDefined();
    });

    test('threshold filtering: high threshold returns only strongest peaks', () => {
        const harmonics = sawtoothHarmonics(110, 8);
        const data = makeFreqData(harmonics);
        const spectrum = computeSpectrum(data, FFT_SIZE, SAMPLE_RATE);

        // Only the fundamental (0 dB) is above -3 dB threshold
        const peaks = findPeaks(spectrum, -3);
        expect(peaks.length).toBe(1);
        expect(Math.abs(peaks[0].freq - 110)).toBeLessThan(BIN_WIDTH * 1.5);
    });

    test('empty result: all bins below threshold returns empty array', () => {
        const data = new Float32Array(BIN_COUNT).fill(-100);
        const spectrum = computeSpectrum(data, FFT_SIZE, SAMPLE_RATE);
        const peaks = findPeaks(spectrum, -50);
        expect(peaks.length).toBe(0);
    });

    test('sawtooth harmonics decrease in dB as expected (1/n rolloff)', () => {
        const fundamental = 440;
        const harmonics = sawtoothHarmonics(fundamental, 6);
        const data = makeFreqData(harmonics);
        const spectrum = computeSpectrum(data, FFT_SIZE, SAMPLE_RATE);
        const peaks = findPeaks(spectrum, -20);

        // Peaks should be sorted by dB descending — fundamental first
        for (let i = 0; i < peaks.length - 1; i++) {
            expect(peaks[i].db).toBeGreaterThanOrEqual(peaks[i + 1].db);
        }
    });
});
