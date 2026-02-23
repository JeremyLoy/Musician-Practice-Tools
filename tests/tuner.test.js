import { describe, test, expect } from 'bun:test';
import { detectPitch, freqToNoteInfo } from '../docs/tuner.js';

// Minimal mock AnalyserNode — provides fftSize and getFloatTimeDomainData
function mockAnalyser(fftSize, fillFn) {
    const data = new Float32Array(fftSize); // all zeros by default
    if (fillFn) fillFn(data);
    return {
        fftSize,
        getFloatTimeDomainData(buf) { buf.set(data); }
    };
}

describe('freqToNoteInfo', () => {
    test('A4 at 440 Hz with refA=440 → midi 69, noteName A, octave 4, cents ≈ 0', () => {
        const { noteName, octave, cents, midi } = freqToNoteInfo(440, 440);
        expect(midi).toBe(69);
        expect(noteName).toBe('A');
        expect(octave).toBe(4);
        expect(Math.abs(cents)).toBeLessThan(0.01);
    });

    test('C4 (~261.63 Hz) → noteName C, octave 4', () => {
        const freq = 261.6255653005986; // exact C4 with refA=440
        const { noteName, octave } = freqToNoteInfo(freq, 440);
        expect(noteName).toBe('C');
        expect(octave).toBe(4);
    });

    test('sharp frequency gives positive cents', () => {
        // 442 Hz is slightly above A4 (440 Hz)
        const { cents } = freqToNoteInfo(442, 440);
        expect(cents).toBeGreaterThan(0);
    });

    test('flat frequency gives negative cents', () => {
        // 438 Hz is slightly below A4 (440 Hz)
        const { cents } = freqToNoteInfo(438, 440);
        expect(cents).toBeLessThan(0);
    });

    test('overrideMidi forces note name regardless of freq', () => {
        // Pass 440 Hz (A4) but override midi to 60 (C4)
        const { noteName, octave, midi } = freqToNoteInfo(440, 440, 60);
        expect(midi).toBe(60);
        expect(noteName).toBe('C');
        expect(octave).toBe(4);
    });

    test('refA=432 shifts A4 cents to positive (440 Hz is sharp vs 432 reference)', () => {
        // With refA=432, A4 midi=69 target is 432 Hz; 440 Hz is sharp
        const { cents } = freqToNoteInfo(440, 432);
        expect(cents).toBeGreaterThan(0);
    });
});

describe('detectPitch', () => {
    test('returns null for a silent buffer (all zeros)', () => {
        const analyser = mockAnalyser(4096); // default: all zeros
        const result = detectPitch(analyser, 44100);
        expect(result).toBeNull();
    });

    test('returns null for a below-RMS-threshold buffer (very quiet signal)', () => {
        // Values are non-zero but rms < 0.01
        const analyser = mockAnalyser(4096, data => {
            for (let i = 0; i < data.length; i++) data[i] = 0.001;
        });
        const result = detectPitch(analyser, 44100);
        expect(result).toBeNull();
    });
});
