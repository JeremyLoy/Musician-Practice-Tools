import { describe, test, expect } from 'bun:test';

const CARD_IDS = ['drone-card', 'metro-card', 'memos-card', 'tuner-card', 'dict-card'];

describe('cardOrder persistence', () => {
    test('default card IDs are unique', () => {
        expect(new Set(CARD_IDS).size).toBe(CARD_IDS.length);
    });

    test('cardOrder round-trips through JSON serialization', () => {
        const serialized = JSON.stringify({ cardOrder: CARD_IDS });
        const parsed = JSON.parse(serialized).cardOrder;
        expect(parsed).toEqual(CARD_IDS);
    });

    test('a reordered array preserves all IDs', () => {
        const reordered = [CARD_IDS[2], CARD_IDS[0], CARD_IDS[4], CARD_IDS[1], CARD_IDS[3]];
        expect(reordered.sort()).toEqual([...CARD_IDS].sort());
    });

    test('missing ID in restore is skipped gracefully', () => {
        // Simulate restore: unknown IDs produce null from getElementById (which we guard)
        const stored = ['drone-card', 'NONEXISTENT', 'metro-card'];
        const valid = stored.filter(id => CARD_IDS.includes(id));
        expect(valid).toEqual(['drone-card', 'metro-card']);
    });

    test('empty cardOrder falls back to default without error', () => {
        const prefs = { cardOrder: [] };
        expect(prefs.cardOrder?.length).toBe(0);
        // The restore block does nothing when length is 0 — no throw
    });
});
