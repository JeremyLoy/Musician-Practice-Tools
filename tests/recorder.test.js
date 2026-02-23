import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { getSupportedMimeType, mimeToExt, getAutoName } from '../docs/recorder.js';

// ─── mimeToExt ───────────────────────────────────────────────────────────────

describe('mimeToExt', () => {
    test('audio/mp4 → mp4', () => {
        expect(mimeToExt('audio/mp4')).toBe('mp4');
    });

    test('audio/mp4;codecs=mp4a → mp4', () => {
        expect(mimeToExt('audio/mp4;codecs=mp4a')).toBe('mp4');
    });

    test('audio/ogg → ogg', () => {
        expect(mimeToExt('audio/ogg')).toBe('ogg');
    });

    test('audio/ogg;codecs=opus → ogg', () => {
        expect(mimeToExt('audio/ogg;codecs=opus')).toBe('ogg');
    });

    test('audio/webm → webm', () => {
        expect(mimeToExt('audio/webm')).toBe('webm');
    });

    test('audio/webm;codecs=opus → webm', () => {
        expect(mimeToExt('audio/webm;codecs=opus')).toBe('webm');
    });

    test('empty string → webm', () => {
        expect(mimeToExt('')).toBe('webm');
    });

    test('unknown type → webm', () => {
        expect(mimeToExt('audio/unknown')).toBe('webm');
    });
});

// ─── getSupportedMimeType ─────────────────────────────────────────────────────

describe('getSupportedMimeType', () => {
    let origMediaRecorder;

    beforeEach(() => {
        origMediaRecorder = global.MediaRecorder;
    });

    afterEach(() => {
        global.MediaRecorder = origMediaRecorder;
    });

    test('returns audio/webm;codecs=opus when it is the first supported type', () => {
        global.MediaRecorder = { isTypeSupported: t => t === 'audio/webm;codecs=opus' };
        expect(getSupportedMimeType()).toBe('audio/webm;codecs=opus');
    });

    test('returns audio/webm when only webm is supported', () => {
        global.MediaRecorder = { isTypeSupported: t => t === 'audio/webm' };
        expect(getSupportedMimeType()).toBe('audio/webm');
    });

    test('returns audio/mp4 when only mp4 is supported', () => {
        global.MediaRecorder = { isTypeSupported: t => t === 'audio/mp4' };
        expect(getSupportedMimeType()).toBe('audio/mp4');
    });

    test('returns empty string when no specific type is supported (fallback)', () => {
        global.MediaRecorder = { isTypeSupported: () => false };
        expect(getSupportedMimeType()).toBe('');
    });
});

// ─── getAutoName ──────────────────────────────────────────────────────────────

describe('getAutoName', () => {
    test('returns a non-empty string', () => {
        expect(getAutoName().length).toBeGreaterThan(0);
    });

    test('matches expected date+time pattern (e.g. "Feb 23 2:30 PM" or "Feb 23 14:30")', () => {
        // Month abbreviation, space, day number, space, time (h:mm AM/PM or HH:MM)
        expect(getAutoName()).toMatch(/^[A-Z][a-z]{2} \d{1,2} \d{1,2}:\d{2}/);
    });

    test('called twice within the same second returns the same value', () => {
        const a = getAutoName();
        const b = getAutoName();
        expect(a).toBe(b);
    });
});
