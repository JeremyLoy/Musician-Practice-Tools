// @ts-check
// ─── GRID-BASED CARD LAYOUT ─────────────────────────────────────────────────
// Grafana-style: cards are placed at integer (x, y, w, h) in a 12-column grid
// of fixed-height rows. Drag-to-any-cell, two-axis resize, vertical
// compaction. Mobile (<700px) collapses to a single-column stack ordered by
// (y, x) — drag-to-reorder is supported there too via array re-ordering.

/** @import { GridItem, GridLayoutPrefs } from './grid-layout.js' */
import {
    GRID_COLS,
    ROW_HEIGHT_PX,
    GRID_GAP_PX,
    ALL_CARD_IDS,
    specFor,
    defaultGridLayout,
    validate,
    compactVertical,
    moveItem,
    resizeItem,
    sortByPosition,
    computeCols,
} from './grid-layout.js';

// ─── Type Definitions ────────────────────────────────────────────────────────

/**
 * @typedef {object} CardsOptions
 * @property {() => void} savePrefs - Persist all prefs to localStorage.
 * @property {() => { collapsedCards?: string[], cardLayout?: GridLayoutPrefs }} loadPrefs - Read saved prefs.
 */

/**
 * @typedef {object} CardsAPI
 * @property {() => void} render - Re-layout cards into grid or single-column stack.
 * @property {() => GridLayoutPrefs} getCardLayout - Returns the current grid layout state.
 * @property {() => string[]} getCollapsedCardIds - Returns IDs of currently collapsed cards.
 */

// Re-export for app.js typedef imports.
export { ALL_CARD_IDS };

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const MOBILE_BREAKPOINT = 700;
const DRAG_THRESHOLD_PX = 5;
const SCROLL_ZONE_PX = 80;
const SCROLL_SPEED_PX = 8;

// ─── INIT ───────────────────────────────────────────────────────────────────

/**
 * Initialises the grid card layout: restores layout from prefs, sets up
 * drag-to-cell, two-axis resize, and collapse toggles.
 * @param {CardsOptions} opts
 * @returns {CardsAPI}
 */
export function initCards(opts) {
    const { savePrefs, loadPrefs } = opts;

    /** @type {GridLayoutPrefs} */
    let layout = defaultGridLayout();
    /** The column count used for the current render. Recomputed per render
     *  from the container width so each column stays ≥ MIN_COL_PX. */
    let activeCols = GRID_COLS;
    {
        const prefs0 = loadPrefs();
        // Only accept prefs that match the new shape ({items: GridItem[]}).
        // Anything else (legacy {numColumns, placements} or absent) → defaults.
        if (Array.isArray(prefs0.cardLayout?.items)) {
            layout = { items: prefs0.cardLayout.items.map(it => ({ ...it })) };
            validate(layout);
            compactVertical(layout.items);
        }
    }

    // ─── DOM REFS ───────────────────────────────────────────────
    const footer = document.getElementById('app-version-footer');

    /** @returns {boolean} */
    function isDesktop() {
        return window.innerWidth >= MOBILE_BREAKPOINT;
    }

    /**
     * Measures the width available for the card grid and derives the active
     * column count from it. Called right before rendering so CSS reflows and
     * viewport changes are picked up automatically.
     * @returns {number}
     */
    function measureActiveCols() {
        // Body padding + any scrollbar take a bite out of window.innerWidth;
        // prefer the actual .card-grid width when the grid already exists.
        const existing = getGridEl();
        const widthPx = existing
            ? existing.getBoundingClientRect().width
            : document.body.clientWidth - 48; // approximate body padding fallback
        return computeCols(widthPx);
    }

    // ─── RENDER ─────────────────────────────────────────────────

    /**
     * Re-renders the layout. On desktop, builds a CSS grid with explicit
     * placement; on mobile, stacks cards in (y, x) reading order.
     * Safe to call repeatedly.
     */
    function render() {
        // Always rescue cards back to body before rebuilding container.
        document.querySelectorAll('.card-grid').forEach(grid => {
            [...grid.querySelectorAll('.card')].forEach(card => document.body.insertBefore(card, footer));
            grid.remove();
        });

        if (isDesktop()) {
            const grid = document.createElement('div');
            grid.className = 'card-grid';
            // Insert first so clientWidth reflects the real container width,
            // then measure to derive the active column count.
            document.body.insertBefore(grid, footer);
            activeCols = computeCols(grid.getBoundingClientRect().width);
            // Re-clamp the stored layout into the current column count. Items
            // wider than activeCols get narrowed; x gets shifted in range.
            validate(layout, activeCols);
            compactVertical(layout.items);
            grid.style.setProperty('--row-h', `${ROW_HEIGHT_PX}px`);
            grid.style.setProperty('--grid-cols', String(activeCols));
            for (const it of layout.items) {
                const el = /** @type {HTMLElement | null} */ (document.getElementById(it.id));
                if (!el) continue;
                applyGridStyle(el, it);
                grid.appendChild(el);
            }
        } else {
            activeCols = GRID_COLS;
            for (const it of sortByPosition(layout.items)) {
                const el = /** @type {HTMLElement | null} */ (document.getElementById(it.id));
                if (!el) continue;
                clearGridStyle(el);
                document.body.insertBefore(el, footer);
            }
        }
    }

    /**
     * Applies grid-column / grid-row styles to a card element.
     * @param {HTMLElement} el
     * @param {GridItem} it
     */
    function applyGridStyle(el, it) {
        el.style.gridColumn = `${it.x + 1} / span ${it.w}`;
        el.style.gridRow = `${it.y + 1} / span ${it.h}`;
    }

    /** @param {HTMLElement} el */
    function clearGridStyle(el) {
        el.style.gridColumn = '';
        el.style.gridRow = '';
    }

    // ─── PIXEL ↔ GRID CONVERSION ────────────────────────────────

    /**
     * Returns the grid container element on desktop, or null on mobile.
     * @returns {HTMLElement | null}
     */
    function getGridEl() {
        return /** @type {HTMLElement | null} */ (document.querySelector('.card-grid'));
    }

    /**
     * Converts a viewport pixel position to a grid cell. Both pitches include
     * the 24px CSS gap — without that, the placeholder drifts down faster
     * than the cursor as you drag (row pitch is 64px, not 40px).
     * @param {number} clientX
     * @param {number} clientY
     * @returns {{ x: number, y: number } | null}
     */
    function pxToCell(clientX, clientY) {
        const grid = getGridEl();
        if (!grid) return null;
        const r = grid.getBoundingClientRect();
        // Column pitch: total width = N*colW + (N-1)*gap, so colPitch = colW + gap = (width + gap) / N.
        const colPitch = (r.width + GRID_GAP_PX) / activeCols;
        const rowPitch = ROW_HEIGHT_PX + GRID_GAP_PX;
        const x = Math.round((clientX - r.left) / colPitch);
        const y = Math.round((clientY - r.top) / rowPitch);
        return { x, y };
    }

    // ─── DROP / RESIZE PLACEHOLDER ──────────────────────────────

    /** @type {HTMLElement | null} */
    let placeholder = null;

    /** Creates (or reuses) the placeholder ghost in the grid. */
    function ensurePlaceholder() {
        if (placeholder && placeholder.isConnected) return placeholder;
        const grid = getGridEl();
        if (!grid) return null;
        placeholder = document.createElement('div');
        placeholder.className = 'grid-drop-ghost';
        grid.appendChild(placeholder);
        return placeholder;
    }

    /**
     * Positions the placeholder over the grid at (x, y, w, h).
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     */
    function showPlaceholder(x, y, w, h) {
        const ph = ensurePlaceholder();
        if (!ph) return;
        ph.style.gridColumn = `${x + 1} / span ${w}`;
        ph.style.gridRow = `${y + 1} / span ${h}`;
    }

    function hidePlaceholder() {
        if (placeholder) {
            placeholder.remove();
            placeholder = null;
        }
    }

    // ─── AUTO-SCROLL DURING DRAG/RESIZE ─────────────────────────

    /** @type {number | null} */
    let scrollRaf = null;

    function stopAutoScroll() {
        if (scrollRaf !== null) {
            cancelAnimationFrame(scrollRaf);
            scrollRaf = null;
        }
    }

    /** @param {number} direction */
    function startAutoScroll(direction) {
        stopAutoScroll();
        function step() {
            window.scrollBy(0, direction * SCROLL_SPEED_PX);
            scrollRaf = requestAnimationFrame(step);
        }
        scrollRaf = requestAnimationFrame(step);
    }

    /** @param {number} clientY */
    function tickAutoScroll(clientY) {
        if (clientY < SCROLL_ZONE_PX) startAutoScroll(-1);
        else if (clientY > window.innerHeight - SCROLL_ZONE_PX) startAutoScroll(1);
        else stopAutoScroll();
    }

    // ─── DRAG: DESKTOP (free-form to any cell) ──────────────────

    /**
     * @param {HTMLElement} card
     * @param {PointerEvent} startEvent
     */
    function beginDesktopDrag(card, startEvent) {
        const found = layout.items.find(it => it.id === card.id);
        if (!found) return;
        // Snapshot dimensions so the closures don't have to re-narrow.
        const itemW = found.w;
        const itemH = found.h;
        const startX = startEvent.clientX;
        const startY = startEvent.clientY;
        let moved = false;

        // Pointer offset within the card (so the card "sticks" to the cursor)
        const cardRect = card.getBoundingClientRect();
        const offsetX = startX - cardRect.left;
        const offsetY = startY - cardRect.top;

        /** @param {PointerEvent} e */
        function onMove(e) {
            if (!moved) {
                if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD_PX) return;
                moved = true;
                card.classList.add('dragging');
            }
            tickAutoScroll(e.clientY);
            // The reference point for snapping is the card's top-left corner,
            // i.e. cursor minus the original pointer-to-corner offset.
            const cell = pxToCell(e.clientX - offsetX, e.clientY - offsetY);
            if (!cell) return;
            const x = Math.max(0, Math.min(activeCols - itemW, cell.x));
            const y = Math.max(0, cell.y);
            showPlaceholder(x, y, itemW, itemH);
        }

        /** @param {PointerEvent} e */
        function onUp(e) {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            stopAutoScroll();
            card.classList.remove('dragging');
            hidePlaceholder();
            if (!moved) return;
            const cell = pxToCell(e.clientX - offsetX, e.clientY - offsetY);
            if (!cell) return;
            const x = Math.max(0, Math.min(activeCols - itemW, cell.x));
            const y = Math.max(0, cell.y);
            moveItem(layout.items, card.id, x, y, activeCols);
            render();
            savePrefs();
        }

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }

    // ─── DRAG: MOBILE (reorder in single-column stack) ──────────

    /**
     * @param {HTMLElement} card
     * @param {PointerEvent} startEvent
     */
    function beginMobileDrag(card, startEvent) {
        const startX = startEvent.clientX;
        const startY = startEvent.clientY;
        let moved = false;

        /** @param {number} clientX @param {number} clientY @returns {HTMLElement | null} */
        function findTarget(clientX, clientY) {
            const others = [...document.querySelectorAll('.card:not(.dragging)')];
            const hit = others.find(c => {
                const r = c.getBoundingClientRect();
                return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
            });
            if (hit) return /** @type {HTMLElement} */ (hit);
            // Nearest by centre distance as fallback.
            let nearest = null, minDist = Infinity;
            for (const c of others) {
                const r = c.getBoundingClientRect();
                const d = Math.hypot(clientX - (r.left + r.width / 2), clientY - (r.top + r.height / 2));
                if (d < minDist) { minDist = d; nearest = c; }
            }
            return /** @type {HTMLElement | null} */ (nearest);
        }

        /** @param {number} clientX @param {number} clientY */
        function updateIndicators(clientX, clientY) {
            document.querySelectorAll('.card.drop-above, .card.drop-below').forEach(c => {
                c.classList.remove('drop-above', 'drop-below');
            });
            const target = findTarget(clientX, clientY);
            if (!target || target === card) return;
            const r = target.getBoundingClientRect();
            target.classList.add(clientY < r.top + r.height / 2 ? 'drop-above' : 'drop-below');
        }

        /** @param {PointerEvent} e */
        function onMove(e) {
            if (!moved) {
                if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD_PX) return;
                moved = true;
                card.classList.add('dragging');
            }
            tickAutoScroll(e.clientY);
            updateIndicators(e.clientX, e.clientY);
        }

        /** @param {PointerEvent} e */
        function onUp(e) {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            stopAutoScroll();
            document.querySelectorAll('.card.drop-above, .card.drop-below').forEach(c => {
                c.classList.remove('drop-above', 'drop-below');
            });
            card.classList.remove('dragging');
            if (!moved) return;
            const target = findTarget(e.clientX, e.clientY);
            if (!target || target === card) return;
            const r = target.getBoundingClientRect();
            const before = e.clientY < r.top + r.height / 2;
            reorderForMobile(card.id, target.id, before);
            render();
            savePrefs();
        }

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }

    /**
     * Reorders the items array so that `draggedId` lands immediately
     * before / after `targetId` in the mobile reading order. Because mobile
     * is a single-column stack, this also flattens every card to full width
     * (x=0, w=GRID_COLS) and stacks them with consecutive y values — which
     * means a mobile reorder also flattens the desktop multi-column layout.
     * Power users can re-arrange on a wide screen afterwards. Mutates layout.items.
     * @param {string} draggedId
     * @param {string} targetId
     * @param {boolean} before
     */
    function reorderForMobile(draggedId, targetId, before) {
        const sorted = sortByPosition(layout.items);
        const fromIdx = sorted.findIndex(i => i.id === draggedId);
        if (fromIdx < 0) return;
        const [dragged] = sorted.splice(fromIdx, 1);
        if (!dragged) return;
        const tgtIdx = sorted.findIndex(i => i.id === targetId);
        if (tgtIdx < 0) { sorted.splice(fromIdx, 0, dragged); return; }
        sorted.splice(before ? tgtIdx : tgtIdx + 1, 0, dragged);
        let y = 0;
        for (const it of sorted) {
            it.x = 0;
            it.w = GRID_COLS;
            it.y = y;
            y += it.h;
        }
    }

    // ─── DRAG WIRING ────────────────────────────────────────────

    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.drag-handle')).forEach(handle => {
        handle.addEventListener('pointerdown', e => {
            e.preventDefault();
            const card = /** @type {HTMLElement | null} */ (handle.closest('.card'));
            if (!card) return;
            handle.setPointerCapture(e.pointerId);
            if (isDesktop()) beginDesktopDrag(card, e);
            else beginMobileDrag(card, e);
        });
    });

    // ─── RESIZE HANDLES ─────────────────────────────────────────

    /**
     * @param {HTMLElement} card
     * @param {'right' | 'bottom' | 'corner'} edge
     * @param {PointerEvent} startEvent
     */
    function beginResize(card, edge, startEvent) {
        if (!isDesktop()) return;
        const found = layout.items.find(it => it.id === card.id);
        if (!found) return;
        const grid = getGridEl();
        if (!grid) return;
        const gridRect = grid.getBoundingClientRect();
        const colW = (gridRect.width - GRID_GAP_PX * (activeCols - 1)) / activeCols + GRID_GAP_PX;
        // Effective per-row height including gap (rows in CSS grid don't share the gap
        // boundary the same way, but using rowH alone is close enough for snap).
        const rowH = ROW_HEIGHT_PX + GRID_GAP_PX;
        const startW = found.w;
        const startH = found.h;
        const itemX = found.x;
        const itemY = found.y;
        const startCX = startEvent.clientX;
        const startCY = startEvent.clientY;
        const spec = specFor(card.id);
        const minW = spec?.minW ?? 1;
        const minH = spec?.minH ?? 1;
        let moved = false;

        /** @param {PointerEvent} e */
        function onMove(e) {
            const dx = e.clientX - startCX;
            const dy = e.clientY - startCY;
            if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
            moved = true;
            card.classList.add('resizing');
            tickAutoScroll(e.clientY);
            let w = startW;
            let h = startH;
            if (edge === 'right' || edge === 'corner') {
                w = Math.max(minW, Math.min(activeCols - itemX, startW + Math.round(dx / colW)));
            }
            if (edge === 'bottom' || edge === 'corner') {
                h = Math.max(minH, startH + Math.round(dy / rowH));
            }
            showPlaceholder(itemX, itemY, w, h);
        }

        /** @param {PointerEvent} e */
        function onUp(e) {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            stopAutoScroll();
            card.classList.remove('resizing');
            hidePlaceholder();
            if (!moved) return;
            const dx = e.clientX - startCX;
            const dy = e.clientY - startCY;
            let w = startW;
            let h = startH;
            if (edge === 'right' || edge === 'corner') w = startW + Math.round(dx / colW);
            if (edge === 'bottom' || edge === 'corner') h = startH + Math.round(dy / rowH);
            resizeItem(layout.items, card.id, w, h, activeCols);
            render();
            savePrefs();
        }

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }

    /** Adds three resize handles (right, bottom, corner) to every card. */
    function initResizeHandles() {
        document.querySelectorAll('.card').forEach(cardEl => {
            const card = /** @type {HTMLElement} */ (cardEl);
            /** @type {Array<'right' | 'bottom' | 'corner'>} */
            const edges = ['right', 'bottom', 'corner'];
            for (const edge of edges) {
                const h = document.createElement('div');
                h.className = `card-resize-handle card-resize-${edge}`;
                h.setAttribute('aria-label', `Resize ${edge}`);
                card.appendChild(h);
                h.addEventListener('pointerdown', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    h.setPointerCapture(e.pointerId);
                    beginResize(card, edge, e);
                });
            }
        });
    }

    // ─── COLLAPSE ───────────────────────────────────────────────

    function initCardCollapse() {
        const prefs0 = loadPrefs();
        const collapsed = new Set(prefs0.collapsedCards ?? []);
        document.querySelectorAll('.card-collapse-btn').forEach(btn => {
            const card = /** @type {HTMLElement} */ (btn.closest('.card'));
            if (collapsed.has(card.id)) card.classList.add('collapsed');
            btn.addEventListener('click', () => {
                card.classList.toggle('collapsed');
                savePrefs();
            });
        });
    }

    // ─── INIT ───────────────────────────────────────────────────
    initCardCollapse();
    initResizeHandles();
    render();
    window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`).addEventListener('change', render);

    // Re-render when the viewport crosses a column-count breakpoint. Debounced
    // with requestAnimationFrame so a continuous drag of the window edge
    // doesn't thrash; the viewport doesn't change often in practice.
    /** @type {number | null} */
    let resizeRaf = null;
    window.addEventListener('resize', () => {
        if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
            resizeRaf = null;
            if (!isDesktop()) return; // mobile stack doesn't care about cols
            const nextCols = measureActiveCols();
            if (nextCols !== activeCols) render();
        });
    });

    return {
        render,
        getCardLayout: () => ({
            items: layout.items.map(it => ({ ...it })),
        }),
        getCollapsedCardIds: () => [...document.querySelectorAll('.card.collapsed')].map(c => c.id),
    };
}
