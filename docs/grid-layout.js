// @ts-check
// ─── PURE GRID LAYOUT ENGINE ────────────────────────────────────────────────
// Grafana-style 12-column grid. Items have integer {x, y, w, h} in grid units
// (1 col = gridWidth/12 px, 1 row = ROW_HEIGHT_PX). Items never overlap; after
// any move or resize, callers run `compactVertical` to push items up and
// resolve collisions.

// ─── Type Definitions ────────────────────────────────────────────────────────

/**
 * One panel on the grid. All values are integer grid units.
 * @typedef {object} GridItem
 * @property {string} id - Card element ID.
 * @property {number} x - Column (0-based, 0 ≤ x < GRID_COLS).
 * @property {number} y - Row (0-based, ≥ 0).
 * @property {number} w - Width in columns (≥ 1).
 * @property {number} h - Height in rows (≥ 1).
 */

/**
 * Persisted grid layout.
 * @typedef {object} GridLayoutPrefs
 * @property {GridItem[]} items
 */

/**
 * Per-card size constraints and defaults.
 * @typedef {object} CardSpec
 * @property {string} id
 * @property {number} minW
 * @property {number} minH
 * @property {number} defaultW
 * @property {number} defaultH
 * @property {number} defaultX
 * @property {number} defaultY
 */

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

export const GRID_COLS = 12;
export const ROW_HEIGHT_PX = 40;

/**
 * Per-card default placement and minimum size. Mins are tuned to the intrinsic
 * dimensions of each card's content (e.g. the metronome wheel is 200×200 px,
 * which is 5 rows tall — paired with controls it needs ≥ 6 cols to read well).
 * @type {CardSpec[]}
 */
export const CARD_SPECS = [
    { id: 'drone-card',    minW: 4, minH: 10, defaultW: 6, defaultH: 14, defaultX: 0,  defaultY: 0 },
    { id: 'metro-card',    minW: 6, minH: 10, defaultW: 6, defaultH: 14, defaultX: 6,  defaultY: 0 },
    { id: 'tuner-card',    minW: 4, minH: 7,  defaultW: 6, defaultH: 8,  defaultX: 0,  defaultY: 14 },
    { id: 'spectrum-card', minW: 4, minH: 7,  defaultW: 6, defaultH: 8,  defaultX: 6,  defaultY: 14 },
    { id: 'memos-card',    minW: 4, minH: 6,  defaultW: 6, defaultH: 10, defaultX: 0,  defaultY: 22 },
    { id: 'dict-card',     minW: 4, minH: 6,  defaultW: 6, defaultH: 10, defaultX: 6,  defaultY: 22 },
];

/** Canonical list of all card element IDs in their default visual order. */
export const ALL_CARD_IDS = CARD_SPECS.map(s => s.id);

// ─── PURE FUNCTIONS ─────────────────────────────────────────────────────────

/**
 * Returns a CardSpec for the given id, or null if not registered.
 * @param {string} id
 * @returns {CardSpec | null}
 */
export function specFor(id) {
    return CARD_SPECS.find(s => s.id === id) ?? null;
}

/**
 * Returns the seed layout: every known card placed at its default position/size.
 * @returns {GridLayoutPrefs}
 */
export function defaultGridLayout() {
    return {
        items: CARD_SPECS.map(s => ({
            id: s.id, x: s.defaultX, y: s.defaultY, w: s.defaultW, h: s.defaultH,
        })),
    };
}

/**
 * True if two rectangles overlap (open intervals — touching edges do not count).
 * @param {{x: number, y: number, w: number, h: number}} a
 * @param {{x: number, y: number, w: number, h: number}} b
 * @returns {boolean}
 */
export function collides(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w
        && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Clamps an item to grid bounds and minimum size, mutating in place.
 * - x, y ≥ 0
 * - w ≥ minW (or 1 if no spec); h ≥ minH (or 1 if no spec)
 * - x + w ≤ GRID_COLS (shifts x left if needed)
 * @param {GridItem} item
 * @returns {GridItem}
 */
export function clampItem(item) {
    const spec = specFor(item.id);
    const minW = spec?.minW ?? 1;
    const minH = spec?.minH ?? 1;
    item.w = Math.max(minW, Math.min(GRID_COLS, Math.floor(item.w)));
    item.h = Math.max(minH, Math.floor(item.h));
    item.x = Math.max(0, Math.min(GRID_COLS - item.w, Math.floor(item.x)));
    item.y = Math.max(0, Math.floor(item.y));
    return item;
}

/**
 * Validates and clamps every item in the layout. Removes unknown IDs and
 * appends any missing known IDs at the bottom. Idempotent.
 * @param {GridLayoutPrefs} layout
 * @returns {GridLayoutPrefs}
 */
export function validate(layout) {
    const known = new Set(ALL_CARD_IDS);
    layout.items = layout.items.filter(it => known.has(it.id));
    layout.items.forEach(clampItem);
    // Add any missing cards at the bottom of the current layout
    const present = new Set(layout.items.map(it => it.id));
    const bottomY = layout.items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
    for (const spec of CARD_SPECS) {
        if (present.has(spec.id)) continue;
        layout.items.push(clampItem({
            id: spec.id, x: spec.defaultX, y: bottomY, w: spec.defaultW, h: spec.defaultH,
        }));
    }
    return layout;
}

/**
 * Grafana-style vertical compaction: each item is pulled up to the smallest
 * y where it doesn't overlap any already-placed item. Items are processed in
 * ascending (y, x) order so higher items settle first.
 *
 * If `fixedId` is given, that item keeps its current y (it is the one the user
 * is actively dragging or resizing); every other item flows around it.
 *
 * Mutates and returns the items array. Note: items array order is preserved
 * (we only mutate `y` values), so persistence keeps a stable id ordering.
 *
 * @param {GridItem[]} items
 * @param {string | null} [fixedId]
 * @returns {GridItem[]}
 */
export function compactVertical(items, fixedId = null) {
    // Process order: fixed item first (anchors its row), then others by (y, x).
    const order = [...items].sort((a, b) => {
        if (a.id === fixedId && b.id !== fixedId) return -1;
        if (b.id === fixedId && a.id !== fixedId) return 1;
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
    });

    /** @type {GridItem[]} */
    const placed = [];
    for (const item of order) {
        if (item.id === fixedId) {
            placed.push(item);
            continue;
        }
        let y = 0;
        // Bump y down until no collision. Bounded by sum of all heights.
        while (placed.some(p => collides({ x: item.x, y, w: item.w, h: item.h }, p))) {
            y++;
        }
        item.y = y;
        placed.push(item);
    }
    return items;
}

/**
 * Moves `id` to (x, y), then compacts the rest around it.
 * The moving item is anchored at its requested position; every other item
 * is repacked to the top of the grid, flowing around the anchored card.
 * @param {GridItem[]} items
 * @param {string} id
 * @param {number} x
 * @param {number} y
 * @returns {GridItem[]}
 */
export function moveItem(items, id, x, y) {
    const item = items.find(it => it.id === id);
    if (!item) return items;
    item.x = Math.max(0, Math.min(GRID_COLS - item.w, Math.floor(x)));
    item.y = Math.max(0, Math.floor(y));
    return compactVertical(items, id);
}

/**
 * Resizes `id` to (w, h), enforcing min sizes and the right edge of the grid,
 * then compacts the rest around it.
 * @param {GridItem[]} items
 * @param {string} id
 * @param {number} w
 * @param {number} h
 * @returns {GridItem[]}
 */
export function resizeItem(items, id, w, h) {
    const item = items.find(it => it.id === id);
    if (!item) return items;
    const spec = specFor(id);
    const minW = spec?.minW ?? 1;
    const minH = spec?.minH ?? 1;
    item.w = Math.max(minW, Math.min(GRID_COLS - item.x, Math.floor(w)));
    item.h = Math.max(minH, Math.floor(h));
    return compactVertical(items, id);
}

/**
 * Returns items sorted by visual reading order (y ascending, then x ascending).
 * Used to render a single-column stack on mobile.
 * @param {GridItem[]} items
 * @returns {GridItem[]}
 */
export function sortByPosition(items) {
    return [...items].sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
    });
}
