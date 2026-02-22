import { describe, test, expect } from 'bun:test';
import { normStr, fuzzyScore } from '../docs/dict.js';
import DICT from '../docs/dictionary.js';

describe('normStr', () => {
    test('lowercases input', () => {
        expect(normStr('Allegro')).toBe('allegro');
    });

    test('strips diacritics from Più', () => {
        expect(normStr('Più')).toBe('piu');
    });

    test('strips diacritics from Ré', () => {
        expect(normStr('Ré')).toBe('re');
    });

    test('leaves already-normalized strings unchanged', () => {
        expect(normStr('allegro')).toBe('allegro');
    });

    test('strips diacritics and lowercases combined', () => {
        expect(normStr('Über')).toBe('uber');
    });
});

describe('fuzzyScore', () => {
    test('substring match at start gives score > 2', () => {
        const score = fuzzyScore('allegro', 'all');
        expect(score).toBeGreaterThan(2);
    });

    test('substring match later gives lower score than match at start', () => {
        const scoreStart = fuzzyScore('allegro vivace', 'all');
        const scoreLater = fuzzyScore('vivace allegro', 'all');
        expect(scoreStart).toBeGreaterThan(scoreLater);
    });

    test('character-sequence non-substring match returns exactly 0.5', () => {
        // 'ag' is in 'allegro' as subsequence (a...g) but not as substring
        expect(fuzzyScore('allegro', 'ag')).toBe(0.5);
    });

    test('no character match returns 0', () => {
        expect(fuzzyScore('allegro', 'xyz')).toBe(0);
    });

    test('exact full-string match returns > 2', () => {
        const score = fuzzyScore('allegro', 'allegro');
        expect(score).toBeGreaterThan(2);
    });

    test('empty needle is a substring match at position 0', () => {
        // ''.includes('') is true and indexOf is 0 → 2 + 1/(0+1) = 3
        expect(fuzzyScore('allegro', '')).toBe(3);
    });
});

describe('dictionary data integrity', () => {
    const VALID_LANGS = new Set(['IT', 'DE', 'FR', 'EN', 'LA', 'ES']);

    test('DICT has more than 300 entries', () => {
        expect(DICT.length).toBeGreaterThan(300);
    });

    test('every entry has non-empty term, lang, def, normTerm, normDef', () => {
        for (const entry of DICT) {
            expect(typeof entry.term).toBe('string');
            expect(entry.term.length).toBeGreaterThan(0);

            expect(typeof entry.lang).toBe('string');
            expect(entry.lang.length).toBeGreaterThan(0);

            expect(typeof entry.def).toBe('string');
            expect(entry.def.length).toBeGreaterThan(0);

            expect(typeof entry.normTerm).toBe('string');
            expect(entry.normTerm.length).toBeGreaterThan(0);

            expect(typeof entry.normDef).toBe('string');
            expect(entry.normDef.length).toBeGreaterThan(0);
        }
    });

    test('all lang values are valid codes', () => {
        for (const entry of DICT) {
            expect(VALID_LANGS.has(entry.lang)).toBe(true);
        }
    });

    test('normTerm matches normStr(term) for every entry', () => {
        for (const entry of DICT) {
            expect(entry.normTerm).toBe(normStr(entry.term));
        }
    });

    test('normDef matches normStr(def) for every entry', () => {
        for (const entry of DICT) {
            expect(entry.normDef).toBe(normStr(entry.def));
        }
    });
});
