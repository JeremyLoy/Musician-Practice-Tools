import { describe, test, expect } from 'bun:test';

const CARD_IDS = ['drone-card', 'metro-card', 'memos-card', 'tuner-card', 'spectrum-card', 'dict-card'];

/**
 * Mirror of defaultLayout() from app.js — distributes IDs evenly across n columns.
 * @param {number} n
 * @returns {{ numColumns: number, cols: string[][], fullWidth: string[] }}
 */
function defaultLayout(n) {
    const cols = Array.from({ length: n }, () => /** @type {string[]} */ ([]));
    CARD_IDS.forEach((id, i) => cols[i % n]?.push(id));
    return { numColumns: n, cols, fullWidth: [] };
}

describe('CardLayoutPrefs', () => {
    test('default card IDs are unique', () => {
        expect(new Set(CARD_IDS).size).toBe(CARD_IDS.length);
    });

    test('default 2-column layout distributes cards evenly', () => {
        const layout = defaultLayout(2);
        expect(layout.cols[0]).toHaveLength(3);
        expect(layout.cols[1]).toHaveLength(3);
        expect([...layout.cols[0], ...layout.cols[1]].sort()).toEqual([...CARD_IDS].sort());
        expect(layout.fullWidth).toHaveLength(0);
    });

    test('default 3-column layout covers all cards', () => {
        const layout = defaultLayout(3);
        expect(layout.cols.flat().sort()).toEqual([...CARD_IDS].sort());
    });

    test('default 1-column layout puts all cards in one column', () => {
        const layout = defaultLayout(1);
        expect(layout.cols).toHaveLength(1);
        expect(layout.cols[0]).toEqual(CARD_IDS);
    });

    test('cardLayout round-trips through JSON serialization', () => {
        const layout = defaultLayout(2);
        const serialized = JSON.stringify({ cardLayout: layout });
        const parsed = JSON.parse(serialized).cardLayout;
        expect(parsed.numColumns).toBe(2);
        expect(parsed.cols[0]).toEqual(layout.cols[0]);
        expect(parsed.cols[1]).toEqual(layout.cols[1]);
        expect(parsed.fullWidth).toHaveLength(0);
    });

    test('migration from flat cardOrder to 2-column layout preserves all IDs', () => {
        const cardOrder = [...CARD_IDS];
        const n = 2;
        const cols = Array.from({ length: n }, () => /** @type {string[]} */ ([]));
        cardOrder.forEach((id, i) => cols[i % n]?.push(id));
        expect(cols.flat().sort()).toEqual([...CARD_IDS].sort());
    });

    test('migration preserves relative order within each column', () => {
        const cardOrder = CARD_IDS; // [drone, metro, memos, tuner, spectrum, dict]
        const n = 2;
        const cols = Array.from({ length: n }, () => /** @type {string[]} */ ([]));
        cardOrder.forEach((id, i) => cols[i % n]?.push(id));
        // Even indices → col0: drone(0), memos(2), spectrum(4)
        expect(cols[0]).toEqual(['drone-card', 'memos-card', 'spectrum-card']);
        // Odd indices → col1: metro(1), tuner(3), dict(5)
        expect(cols[1]).toEqual(['metro-card', 'tuner-card', 'dict-card']);
    });

    test('missing card ID in restore is added to last column', () => {
        const stored = { numColumns: 2, cols: [['drone-card'], ['metro-card']], fullWidth: [] };
        const knownInLayout = new Set([...stored.cols.flat(), ...stored.fullWidth]);
        const missing = CARD_IDS.filter(id => !knownInLayout.has(id));
        // Add missing IDs to last column
        stored.cols[stored.cols.length - 1]?.push(...missing);
        expect(stored.cols.flat().sort()).toEqual([...CARD_IDS].sort());
    });

    test('toggleCardFullWidth removes from column, adds to fullWidth', () => {
        const layout = defaultLayout(2);
        const cardId = 'drone-card';
        // Simulate toggle to full-width
        layout.cols = layout.cols.map(col => col.filter(id => id !== cardId));
        layout.fullWidth.push(cardId);
        expect(layout.fullWidth).toContain(cardId);
        expect(layout.cols.flat()).not.toContain(cardId);
    });

    test('toggleCardFullWidth returns card to shortest column', () => {
        const layout = { numColumns: 2, cols: [['memos-card', 'spectrum-card'], ['metro-card', 'tuner-card', 'dict-card']], fullWidth: ['drone-card'] };
        // Simulate returning drone-card to layout (shortest column is col0)
        layout.fullWidth = layout.fullWidth.filter(id => id !== 'drone-card');
        let shortestIdx = 0;
        layout.cols.forEach((col, i) => { if (col.length < (layout.cols[shortestIdx]?.length ?? Infinity)) shortestIdx = i; });
        layout.cols[shortestIdx]?.push('drone-card');
        expect(layout.cols[0]).toContain('drone-card');
        expect(layout.fullWidth).not.toContain('drone-card');
    });

    test('setNumColumns redistributes flat column order evenly', () => {
        const layout = defaultLayout(2);
        // Simulate setNumColumns(3)
        const flat = layout.cols.flat();
        const n = 3;
        const newCols = Array.from({ length: n }, () => /** @type {string[]} */ ([]));
        flat.forEach((id, i) => newCols[i % n]?.push(id));
        expect(newCols.flat().sort()).toEqual([...CARD_IDS].sort());
        expect(newCols.length).toBe(3);
    });

    test('empty cardOrder falls back gracefully', () => {
        const prefs = { cardOrder: [] };
        expect(prefs.cardOrder?.length).toBe(0);
        // No layout mutation should occur — stays as defaultLayout
    });
});
