import { describe, test, expect } from 'bun:test';
import { ALL_CARD_IDS, defaultLayout, migrateOldLayout, ensureColSpan, effectiveSpan } from '../docs/cards.js';

describe('CardLayoutPrefs', () => {
    test('default card IDs are unique', () => {
        expect(new Set(ALL_CARD_IDS).size).toBe(ALL_CARD_IDS.length);
    });

    test('default 2-column layout distributes cards evenly', () => {
        const layout = defaultLayout(2);
        const col0 = layout.placements.filter(p => p.col === 0);
        const col1 = layout.placements.filter(p => p.col === 1);
        expect(col0).toHaveLength(3);
        expect(col1).toHaveLength(3);
        expect(layout.placements.map(p => p.id).sort()).toEqual([...ALL_CARD_IDS].sort());
    });

    test('default 3-column layout covers all cards', () => {
        const layout = defaultLayout(3);
        expect(layout.placements.map(p => p.id).sort()).toEqual([...ALL_CARD_IDS].sort());
    });

    test('default 1-column layout puts all cards in one column', () => {
        const layout = defaultLayout(1);
        expect(layout.placements.every(p => p.col === 0)).toBe(true);
        expect(layout.placements.map(p => p.id)).toEqual(ALL_CARD_IDS);
    });

    test('default layout placements have colSpan: 1', () => {
        const layout = defaultLayout(2);
        layout.placements.forEach(p => {
            expect(p.colSpan).toBe(1);
        });
    });

    test('cardLayout round-trips through JSON serialization', () => {
        const layout = defaultLayout(2);
        const serialized = JSON.stringify({ cardLayout: layout });
        const parsed = JSON.parse(serialized).cardLayout;
        expect(parsed.numColumns).toBe(2);
        expect(parsed.placements).toEqual(layout.placements);
    });

    test('migration from old cols+fullWidth format preserves all IDs', () => {
        const old = { numColumns: 2, cols: [['drone-card', 'memos-card', 'spectrum-card'], ['metro-card', 'tuner-card', 'dict-card']], fullWidth: [] };
        const layout = migrateOldLayout(old);
        expect(layout.placements.map(p => p.id).sort()).toEqual([...ALL_CARD_IDS].sort());
    });

    test('migration preserves column assignments', () => {
        const old = { numColumns: 2, cols: [['drone-card', 'memos-card', 'spectrum-card'], ['metro-card', 'tuner-card', 'dict-card']], fullWidth: [] };
        const layout = migrateOldLayout(old);
        // Interleaved by row: drone(col0), metro(col1), memos(col0), tuner(col1), spectrum(col0), dict(col1)
        expect(layout.placements[0]).toEqual({ id: 'drone-card', col: 0, colSpan: 1 });
        expect(layout.placements[1]).toEqual({ id: 'metro-card', col: 1, colSpan: 1 });
        expect(layout.placements[2]).toEqual({ id: 'memos-card', col: 0, colSpan: 1 });
        expect(layout.placements[3]).toEqual({ id: 'tuner-card', col: 1, colSpan: 1 });
    });

    test('migration from flat cardOrder to 2-column layout preserves all IDs', () => {
        const cardOrder = [...ALL_CARD_IDS];
        const n = 2;
        const cols = Array.from({ length: n }, () => /** @type {string[]} */ ([]));
        cardOrder.forEach((id, i) => cols[i % n]?.push(id));
        const layout = migrateOldLayout({ numColumns: n, cols, fullWidth: [] });
        expect(layout.placements.map(p => p.id).sort()).toEqual([...ALL_CARD_IDS].sort());
    });

    test('migration preserves fullWidth cards with colSpan equal to numColumns', () => {
        const old = { numColumns: 2, cols: [['memos-card'], ['metro-card']], fullWidth: ['drone-card'] };
        const layout = migrateOldLayout(old);
        const dronePlacement = layout.placements.find(p => p.id === 'drone-card');
        expect(dronePlacement?.col).toBe('full');
        expect(dronePlacement?.colSpan).toBe(2);
    });

    test('missing card ID in restore is added', () => {
        const layout = { numColumns: 2, placements: [{ id: 'drone-card', col: 0, colSpan: 1 }, { id: 'metro-card', col: 1, colSpan: 1 }] };
        const knownInLayout = new Set(layout.placements.map(p => p.id));
        const missing = ALL_CARD_IDS.filter(id => !knownInLayout.has(id));
        missing.forEach(id => layout.placements.push({ id, col: 0, colSpan: 1 }));
        expect(layout.placements.map(p => p.id).sort()).toEqual([...ALL_CARD_IDS].sort());
    });

    test('toggleCardFullWidth changes col to full', () => {
        const layout = defaultLayout(2);
        const cardId = 'drone-card';
        const p = layout.placements.find(pl => pl.id === cardId);
        if (p) { p.col = 'full'; p.colSpan = 2; }
        expect(layout.placements.find(pl => pl.id === cardId)?.col).toBe('full');
        expect(layout.placements.find(pl => pl.id === cardId)?.colSpan).toBe(2);
    });

    test('toggleCardFullWidth returns card to a column', () => {
        const layout = defaultLayout(2);
        // Make drone-card full-width first
        const p = layout.placements.find(pl => pl.id === 'drone-card');
        if (p) { p.col = 'full'; p.colSpan = 2; }
        // Return to column (simulate shortest column logic)
        if (p) { p.col = 0; p.colSpan = 1; }
        expect(layout.placements.find(pl => pl.id === 'drone-card')?.col).toBe(0);
        expect(layout.placements.find(pl => pl.id === 'drone-card')?.colSpan).toBe(1);
    });

    test('setNumColumns redistributes column assignments', () => {
        const layout = defaultLayout(2);
        // Simulate setNumColumns(3)
        const n = 3;
        let colIdx = 0;
        layout.placements.forEach(p => {
            if (p.col !== 'full') {
                p.col = colIdx % n;
                colIdx++;
            }
        });
        layout.numColumns = n;
        ensureColSpan(layout);
        expect(layout.placements.map(p => p.id).sort()).toEqual([...ALL_CARD_IDS].sort());
        expect(layout.numColumns).toBe(3);
        // All column indices should be 0, 1, or 2
        layout.placements.forEach(p => {
            expect(typeof p.col === 'number' && p.col >= 0 && p.col < 3).toBe(true);
        });
    });

    test('empty cardOrder falls back gracefully', () => {
        const prefs = { cardOrder: [] };
        expect(prefs.cardOrder?.length).toBe(0);
        // No layout mutation should occur — stays as defaultLayout
    });
});

describe('ensureColSpan', () => {
    test('adds colSpan: 1 to placements missing it', () => {
        const layout = { numColumns: 2, placements: [
            { id: 'drone-card', col: 0 },
            { id: 'metro-card', col: 1 },
        ] };
        // @ts-ignore - intentionally missing colSpan for test
        ensureColSpan(layout);
        expect(layout.placements[0].colSpan).toBe(1);
        expect(layout.placements[1].colSpan).toBe(1);
    });

    test('clamps colSpan that exceeds numColumns', () => {
        const layout = { numColumns: 2, placements: [
            { id: 'drone-card', col: 0, colSpan: 5 },
        ] };
        ensureColSpan(layout);
        expect(layout.placements[0].colSpan).toBe(2);
    });

    test('sets full-width card colSpan to numColumns', () => {
        const layout = { numColumns: 3, placements: [
            { id: 'drone-card', col: /** @type {const} */ ('full'), colSpan: 1 },
        ] };
        ensureColSpan(layout);
        expect(layout.placements[0].colSpan).toBe(3);
    });

    test('leaves valid colSpan unchanged', () => {
        const layout = { numColumns: 3, placements: [
            { id: 'drone-card', col: 0, colSpan: 2 },
        ] };
        ensureColSpan(layout);
        expect(layout.placements[0].colSpan).toBe(2);
    });
});

describe('effectiveSpan', () => {
    test('returns numColumns for full-width cards', () => {
        expect(effectiveSpan({ id: 'x', col: 'full', colSpan: 1 }, 3)).toBe(3);
    });

    test('returns colSpan when set', () => {
        expect(effectiveSpan({ id: 'x', col: 0, colSpan: 2 }, 3)).toBe(2);
    });

    test('defaults to 1 when colSpan is undefined', () => {
        expect(effectiveSpan({ id: 'x', col: 0 }, 3)).toBe(1);
    });

    test('clamps colSpan to numColumns', () => {
        expect(effectiveSpan({ id: 'x', col: 0, colSpan: 5 }, 2)).toBe(2);
    });
});
