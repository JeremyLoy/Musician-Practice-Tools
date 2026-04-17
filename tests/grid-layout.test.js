import { describe, test, expect } from 'bun:test';
import {
    GRID_COLS,
    ROW_HEIGHT_PX,
    CARD_SPECS,
    ALL_CARD_IDS,
    specFor,
    defaultGridLayout,
    collides,
    clampItem,
    validate,
    compactVertical,
    moveItem,
    resizeItem,
    sortByPosition,
} from '../docs/grid-layout.js';

describe('constants', () => {
    test('GRID_COLS is 12', () => {
        expect(GRID_COLS).toBe(12);
    });
    test('ROW_HEIGHT_PX is 40', () => {
        expect(ROW_HEIGHT_PX).toBe(40);
    });
    test('ALL_CARD_IDS has 6 unique entries', () => {
        expect(ALL_CARD_IDS).toHaveLength(6);
        expect(new Set(ALL_CARD_IDS).size).toBe(6);
    });
    test('every CardSpec has minW and minH within grid bounds', () => {
        for (const s of CARD_SPECS) {
            expect(s.minW).toBeGreaterThanOrEqual(1);
            expect(s.minW).toBeLessThanOrEqual(GRID_COLS);
            expect(s.minH).toBeGreaterThanOrEqual(1);
            expect(s.defaultW).toBeGreaterThanOrEqual(s.minW);
            expect(s.defaultH).toBeGreaterThanOrEqual(s.minH);
            expect(s.defaultX + s.defaultW).toBeLessThanOrEqual(GRID_COLS);
        }
    });
});

describe('specFor', () => {
    test('returns spec for known card', () => {
        expect(specFor('drone-card')?.id).toBe('drone-card');
    });
    test('returns null for unknown id', () => {
        expect(specFor('nope-card')).toBeNull();
    });
});

describe('defaultGridLayout', () => {
    test('contains all 6 cards', () => {
        const layout = defaultGridLayout();
        expect(layout.items.map(i => i.id).sort()).toEqual([...ALL_CARD_IDS].sort());
    });
    test('no two default items overlap', () => {
        const items = defaultGridLayout().items;
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const a = /** @type {import('../docs/grid-layout.js').GridItem} */ (items[i]);
                const b = /** @type {import('../docs/grid-layout.js').GridItem} */ (items[j]);
                expect(collides(a, b)).toBe(false);
            }
        }
    });
    test('every default item fits in 12 cols', () => {
        for (const it of defaultGridLayout().items) {
            expect(it.x).toBeGreaterThanOrEqual(0);
            expect(it.x + it.w).toBeLessThanOrEqual(GRID_COLS);
        }
    });
    test('round-trips through JSON', () => {
        const layout = defaultGridLayout();
        const restored = JSON.parse(JSON.stringify(layout));
        expect(restored).toEqual(layout);
    });
});

describe('collides', () => {
    test('disjoint rectangles do not collide', () => {
        expect(collides({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 })).toBe(false);
        expect(collides({ x: 0, y: 0, w: 2, h: 2 }, { x: 0, y: 2, w: 2, h: 2 })).toBe(false);
    });
    test('touching edges do not collide', () => {
        // Right edge of a == left edge of b
        expect(collides({ x: 0, y: 0, w: 3, h: 3 }, { x: 3, y: 0, w: 3, h: 3 })).toBe(false);
    });
    test('overlapping rectangles collide', () => {
        expect(collides({ x: 0, y: 0, w: 3, h: 3 }, { x: 2, y: 2, w: 3, h: 3 })).toBe(true);
    });
    test('one fully inside the other collides', () => {
        expect(collides({ x: 0, y: 0, w: 5, h: 5 }, { x: 1, y: 1, w: 1, h: 1 })).toBe(true);
    });
});

describe('clampItem', () => {
    test('clamps width to GRID_COLS', () => {
        const it = clampItem({ id: 'drone-card', x: 0, y: 0, w: 99, h: 5 });
        expect(it.w).toBe(GRID_COLS);
    });
    test('enforces minW from spec', () => {
        const it = clampItem({ id: 'metro-card', x: 0, y: 0, w: 1, h: 12 });
        expect(it.w).toBeGreaterThanOrEqual(/** @type {import('../docs/grid-layout.js').CardSpec} */ (specFor('metro-card')).minW);
    });
    test('enforces minH from spec', () => {
        const it = clampItem({ id: 'tuner-card', x: 0, y: 0, w: 6, h: 1 });
        expect(it.h).toBeGreaterThanOrEqual(/** @type {import('../docs/grid-layout.js').CardSpec} */ (specFor('tuner-card')).minH);
    });
    test('shifts x left if x + w exceeds grid', () => {
        const it = clampItem({ id: 'drone-card', x: 11, y: 0, w: 6, h: 10 });
        expect(it.x + it.w).toBeLessThanOrEqual(GRID_COLS);
        expect(it.x).toBe(GRID_COLS - it.w);
    });
    test('clamps negative x and y to 0', () => {
        const it = clampItem({ id: 'drone-card', x: -3, y: -1, w: 6, h: 10 });
        expect(it.x).toBe(0);
        expect(it.y).toBe(0);
    });
    test('floors fractional values', () => {
        const it = clampItem({ id: 'drone-card', x: 1.7, y: 2.9, w: 5.3, h: 10.6 });
        expect(it.x).toBe(1);
        expect(it.y).toBe(2);
        expect(it.w).toBe(5);
        expect(it.h).toBe(10);
    });
});

describe('validate', () => {
    test('removes unknown ids', () => {
        const layout = { items: [
            { id: 'drone-card',   x: 0, y: 0, w: 6, h: 10 },
            { id: 'fake-card',    x: 0, y: 10, w: 6, h: 4 },
        ] };
        validate(layout);
        expect(layout.items.find(i => i.id === 'fake-card')).toBeUndefined();
    });
    test('appends missing known ids at the bottom', () => {
        const layout = { items: [
            { id: 'drone-card', x: 0, y: 0, w: 6, h: 10 },
        ] };
        validate(layout);
        expect(layout.items.map(i => i.id).sort()).toEqual([...ALL_CARD_IDS].sort());
    });
    test('appended cards land below existing ones', () => {
        const layout = { items: [
            { id: 'drone-card', x: 0, y: 0, w: 12, h: 20 },
        ] };
        validate(layout);
        for (const it of layout.items) {
            if (it.id === 'drone-card') continue;
            expect(it.y).toBeGreaterThanOrEqual(20);
        }
    });
    test('clamps every item to grid bounds', () => {
        const layout = { items: [
            { id: 'drone-card', x: 99, y: 0, w: 99, h: 5 },
        ] };
        validate(layout);
        const drone = /** @type {import('../docs/grid-layout.js').GridItem} */ (layout.items.find(i => i.id === 'drone-card'));
        expect(drone.x + drone.w).toBeLessThanOrEqual(GRID_COLS);
    });
    test('is idempotent', () => {
        const a = defaultGridLayout();
        validate(a);
        const snapshot = JSON.stringify(a);
        validate(a);
        expect(JSON.stringify(a)).toBe(snapshot);
    });
});

describe('compactVertical', () => {
    test('pulls a single floating item up to y=0', () => {
        const items = [{ id: 'drone-card', x: 0, y: 50, w: 6, h: 10 }];
        compactVertical(items);
        expect(items[0]?.y).toBe(0);
    });
    test('two side-by-side items both compact to y=0', () => {
        const items = [
            { id: 'drone-card', x: 0, y: 99, w: 6, h: 10 },
            { id: 'metro-card', x: 6, y: 88, w: 6, h: 10 },
        ];
        compactVertical(items);
        expect(items.find(i => i.id === 'drone-card')?.y).toBe(0);
        expect(items.find(i => i.id === 'metro-card')?.y).toBe(0);
    });
    test('stacked items compact to consecutive y values', () => {
        const items = [
            { id: 'drone-card', x: 0, y: 5,  w: 6, h: 10 },
            { id: 'tuner-card', x: 0, y: 50, w: 6, h: 8 },
        ];
        compactVertical(items);
        expect(items.find(i => i.id === 'drone-card')?.y).toBe(0);
        expect(items.find(i => i.id === 'tuner-card')?.y).toBe(10);
    });
    test('fixedId item keeps its y; others flow around', () => {
        const items = [
            { id: 'drone-card', x: 0, y: 5, w: 6, h: 10 },
            { id: 'metro-card', x: 0, y: 0, w: 6, h: 4 },
        ];
        compactVertical(items, 'drone-card');
        expect(items.find(i => i.id === 'drone-card')?.y).toBe(5);
        // metro-card collides with drone above (y=0..4 vs y=5..15) — they don't actually collide.
        // metro-card should stay at y=0.
        expect(items.find(i => i.id === 'metro-card')?.y).toBe(0);
    });
    test('fixedId pushes a colliding item below it', () => {
        const items = [
            { id: 'drone-card', x: 0, y: 3, w: 12, h: 5 },  // fixed: occupies y 3..8 full-width
            { id: 'metro-card', x: 0, y: 0, w: 6, h: 6 },   // wants y=0 but would collide
        ];
        compactVertical(items, 'drone-card');
        expect(items.find(i => i.id === 'drone-card')?.y).toBe(3);
        // metro-card cannot be at y=0..2 (only 3 rows; needs h=6) without colliding,
        // so it must land below drone (y=8).
        const metro = /** @type {import('../docs/grid-layout.js').GridItem} */ (items.find(i => i.id === 'metro-card'));
        expect(metro.y).toBeGreaterThanOrEqual(8);
    });
    test('preserves array order (does not reorder items)', () => {
        const items = [
            { id: 'drone-card', x: 0, y: 50, w: 6, h: 10 },
            { id: 'metro-card', x: 6, y: 99, w: 6, h: 10 },
            { id: 'tuner-card', x: 0, y: 88, w: 6, h: 8 },
        ];
        const idsBefore = items.map(i => i.id);
        compactVertical(items);
        expect(items.map(i => i.id)).toEqual(idsBefore);
    });
});

describe('moveItem', () => {
    test('places the moved item at the requested position', () => {
        const items = defaultGridLayout().items;
        moveItem(items, 'drone-card', 6, 0);
        const drone = /** @type {import('../docs/grid-layout.js').GridItem} */ (items.find(i => i.id === 'drone-card'));
        expect(drone.x).toBe(6);
        expect(drone.y).toBe(0);
    });
    test('clamps target x so card stays within grid', () => {
        const items = defaultGridLayout().items;
        moveItem(items, 'drone-card', 99, 0);
        const drone = /** @type {import('../docs/grid-layout.js').GridItem} */ (items.find(i => i.id === 'drone-card'));
        expect(drone.x + drone.w).toBeLessThanOrEqual(GRID_COLS);
    });
    test('moved card displaces no card it would overlap (others compact around)', () => {
        const items = defaultGridLayout().items;
        moveItem(items, 'dict-card', 0, 0);
        // No two items collide afterwards
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const a = /** @type {import('../docs/grid-layout.js').GridItem} */ (items[i]);
                const b = /** @type {import('../docs/grid-layout.js').GridItem} */ (items[j]);
                expect(collides(a, b)).toBe(false);
            }
        }
    });
    test('unknown id is a no-op', () => {
        const items = defaultGridLayout().items;
        const snap = JSON.stringify(items);
        moveItem(items, 'nope-card', 0, 0);
        expect(JSON.stringify(items)).toBe(snap);
    });
});

describe('resizeItem', () => {
    test('respects minW from spec', () => {
        const items = defaultGridLayout().items;
        resizeItem(items, 'metro-card', 1, 10);
        const metro = /** @type {import('../docs/grid-layout.js').GridItem} */ (items.find(i => i.id === 'metro-card'));
        expect(metro.w).toBeGreaterThanOrEqual(/** @type {import('../docs/grid-layout.js').CardSpec} */ (specFor('metro-card')).minW);
    });
    test('respects minH from spec', () => {
        const items = defaultGridLayout().items;
        resizeItem(items, 'tuner-card', 6, 1);
        const tuner = /** @type {import('../docs/grid-layout.js').GridItem} */ (items.find(i => i.id === 'tuner-card'));
        expect(tuner.h).toBeGreaterThanOrEqual(/** @type {import('../docs/grid-layout.js').CardSpec} */ (specFor('tuner-card')).minH);
    });
    test('clamps width so x + w never exceeds grid', () => {
        const items = defaultGridLayout().items;
        // metro-card defaults to x=6, so w=12 should clamp to 6
        resizeItem(items, 'metro-card', 12, 10);
        const metro = /** @type {import('../docs/grid-layout.js').GridItem} */ (items.find(i => i.id === 'metro-card'));
        expect(metro.x + metro.w).toBeLessThanOrEqual(GRID_COLS);
    });
    test('after resize, no two items overlap', () => {
        const items = defaultGridLayout().items;
        resizeItem(items, 'drone-card', 12, 20);
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const a = /** @type {import('../docs/grid-layout.js').GridItem} */ (items[i]);
                const b = /** @type {import('../docs/grid-layout.js').GridItem} */ (items[j]);
                expect(collides(a, b)).toBe(false);
            }
        }
    });
    test('unknown id is a no-op', () => {
        const items = defaultGridLayout().items;
        const snap = JSON.stringify(items);
        resizeItem(items, 'nope-card', 6, 6);
        expect(JSON.stringify(items)).toBe(snap);
    });
});

describe('sortByPosition', () => {
    test('sorts by y, then x', () => {
        const items = [
            { id: 'a', x: 6, y: 0, w: 6, h: 4 },
            { id: 'b', x: 0, y: 0, w: 6, h: 4 },
            { id: 'c', x: 0, y: 4, w: 6, h: 4 },
        ];
        const sorted = sortByPosition(items);
        expect(sorted.map(i => i.id)).toEqual(['b', 'a', 'c']);
    });
    test('does not mutate the input', () => {
        const items = [
            { id: 'a', x: 6, y: 0, w: 6, h: 4 },
            { id: 'b', x: 0, y: 0, w: 6, h: 4 },
        ];
        const before = JSON.stringify(items);
        sortByPosition(items);
        expect(JSON.stringify(items)).toBe(before);
    });
});
