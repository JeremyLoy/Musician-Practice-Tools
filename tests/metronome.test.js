import { describe, test, expect } from 'bun:test';
import { meterToString, parseTsInput, buildSchedule } from '../docs/metronome.js';

// ─── meterToString ──────────────────────────────────────────────────────────

describe('meterToString', () => {
    test('4/4 → "4/4"', () => {
        expect(meterToString({ groups: [1, 1, 1, 1], denom: 4 })).toBe('4/4');
    });

    test('3/4 → "3/4"', () => {
        expect(meterToString({ groups: [1, 1, 1], denom: 4 })).toBe('3/4');
    });

    test('6/8 (individual pulses) → "6/8"', () => {
        expect(meterToString({ groups: [1, 1, 1, 1, 1, 1], denom: 8 })).toBe('6/8');
    });

    test('6/8 (grouped as 3+3) → "6/8"', () => {
        expect(meterToString({ groups: [3, 3], denom: 8 })).toBe('6/8');
    });

    test('7/8 → "7/8"', () => {
        expect(meterToString({ groups: [1, 1, 1, 1, 1, 1, 1], denom: 8 })).toBe('7/8');
    });

    test('1/1 → "1/1"', () => {
        expect(meterToString({ groups: [1], denom: 1 })).toBe('1/1');
    });
});

// ─── parseTsInput ───────────────────────────────────────────────────────────

describe('parseTsInput', () => {
    test('"4/4" → groups=[1,1,1,1], denom=4', () => {
        const result = parseTsInput('4/4');
        expect(result).toEqual({ groups: [1, 1, 1, 1], denom: 4 });
    });

    test('"7/8" → groups of 7 ones, denom=8', () => {
        const result = parseTsInput('7/8');
        expect(result.groups).toHaveLength(7);
        expect(result.denom).toBe(8);
    });

    test('"3 / 4" with spaces → valid', () => {
        const result = parseTsInput('3 / 4');
        expect(result).toEqual({ groups: [1, 1, 1], denom: 4 });
    });

    test('"  6/8  " with surrounding spaces → valid', () => {
        const result = parseTsInput('  6/8  ');
        expect(result).toEqual({ groups: [1, 1, 1, 1, 1, 1], denom: 8 });
    });

    test('empty string → null', () => {
        expect(parseTsInput('')).toBeNull();
    });

    test('"abc" → null', () => {
        expect(parseTsInput('abc')).toBeNull();
    });

    test('"0/4" (zero numerator) → null', () => {
        expect(parseTsInput('0/4')).toBeNull();
    });

    test('"33/4" (numerator > 32) → null', () => {
        expect(parseTsInput('33/4')).toBeNull();
    });

    test('"4/65" (denominator > 64) → null', () => {
        expect(parseTsInput('4/65')).toBeNull();
    });

    test('"4" (no slash) → null', () => {
        expect(parseTsInput('4')).toBeNull();
    });

    test('"1/1" (boundary minimum) → valid', () => {
        expect(parseTsInput('1/1')).toEqual({ groups: [1], denom: 1 });
    });

    test('"32/64" (boundary maximum) → valid', () => {
        const result = parseTsInput('32/64');
        expect(result.groups).toHaveLength(32);
        expect(result.denom).toBe(64);
    });
});

// ─── buildSchedule ──────────────────────────────────────────────────────────

describe('buildSchedule', () => {
    test('4/4 sub=1 at 120 BPM → 4 pulses', () => {
        const meter = { groups: [1, 1, 1, 1], denom: 4, subdivision: 1 };
        const pulses = buildSchedule(120, meter);
        expect(pulses).toHaveLength(4);
    });

    test('4/4 sub=2 at 120 BPM → 8 pulses', () => {
        const meter = { groups: [1, 1, 1, 1], denom: 4, subdivision: 2 };
        const pulses = buildSchedule(120, meter);
        expect(pulses).toHaveLength(8);
    });

    test('3/4 sub=3 at 120 BPM → 9 pulses', () => {
        const meter = { groups: [1, 1, 1], denom: 4, subdivision: 3 };
        const pulses = buildSchedule(120, meter);
        expect(pulses).toHaveLength(9);
    });

    test('isGroupBeat flags are correct for sub=1', () => {
        const meter = { groups: [1, 1, 1, 1], denom: 4, subdivision: 1 };
        const pulses = buildSchedule(120, meter);
        expect(pulses.every(p => p.isGroupBeat)).toBe(true);
    });

    test('isGroupBeat flags for sub=2: alternates true/false', () => {
        const meter = { groups: [1, 1, 1, 1], denom: 4, subdivision: 2 };
        const pulses = buildSchedule(120, meter);
        for (let i = 0; i < pulses.length; i++) {
            expect(pulses[i].isGroupBeat).toBe(i % 2 === 0);
        }
    });

    test('subDur is 60/bpm for sub=1', () => {
        const meter = { groups: [1, 1, 1, 1], denom: 4, subdivision: 1 };
        const pulses = buildSchedule(120, meter);
        const expected = 60 / 120; // 0.5 seconds
        pulses.forEach(p => {
            expect(p.subDur).toBeCloseTo(expected, 10);
        });
    });

    test('subDur is (60/bpm)/2 for sub=2', () => {
        const meter = { groups: [1, 1, 1, 1], denom: 4, subdivision: 2 };
        const pulses = buildSchedule(120, meter);
        const expected = (60 / 120) / 2; // 0.25 seconds
        pulses.forEach(p => {
            expect(p.subDur).toBeCloseTo(expected, 10);
        });
    });

    test('grouped meter [3,3] sub=1 → 2 pulses', () => {
        const meter = { groups: [3, 3], denom: 8, subdivision: 1 };
        const pulses = buildSchedule(120, meter);
        expect(pulses).toHaveLength(2);
        // Each pulse covers 3 beats: subDur = 3 * 60/120 = 1.5s
        expect(pulses[0].subDur).toBeCloseTo(1.5, 10);
    });

    test('different BPM values produce correct subDur', () => {
        const meter = { groups: [1, 1, 1, 1], denom: 4, subdivision: 1 };
        const p60 = buildSchedule(60, meter);
        const p240 = buildSchedule(240, meter);
        expect(p60[0].subDur).toBeCloseTo(1.0, 10);   // 60/60 = 1s
        expect(p240[0].subDur).toBeCloseTo(0.25, 10);  // 60/240 = 0.25s
    });
});
