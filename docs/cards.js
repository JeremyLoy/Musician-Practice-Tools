// @ts-check
// ─── CARD LAYOUT, DRAG-TO-REORDER, COLLAPSE, COLUMN CONTROLS ────────────────

// ─── Type Definitions ────────────────────────────────────────────────────────

/**
 * Where a card is placed: column index (0-based) or 'full' for full-width.
 * @typedef {object} CardPlacement
 * @property {string} id - Card element ID.
 * @property {number | 'full'} col - Column index or 'full' for full-width.
 * @property {number} [colSpan] - Number of grid columns the card spans (1–numColumns). Defaults to 1.
 */

/**
 * Per-column card layout configuration.
 * @typedef {object} CardLayoutPrefs
 * @property {number} numColumns - Number of columns (default 2, range 1–3).
 * @property {CardPlacement[]} placements - Ordered card placements.
 */

/**
 * Callbacks passed to initCards.
 * @typedef {object} CardsOptions
 * @property {() => void} savePrefs - Persist all prefs to localStorage.
 * @property {() => { collapsedCards?: string[], cardLayout?: CardLayoutPrefs, cardOrder?: string[] }} loadPrefs - Read saved prefs.
 */

/**
 * Public API returned by initCards.
 * @typedef {object} CardsAPI
 * @property {() => void} distributeCards - Re-layout cards into columns or single-column.
 * @property {() => CardLayoutPrefs} getCardLayout - Returns the current card layout state.
 * @property {() => string[]} getCollapsedCardIds - Returns IDs of currently collapsed cards.
 */

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

/** Canonical list of all card element IDs in their default visual order. */
export const ALL_CARD_IDS = ['drone-card', 'metro-card', 'memos-card', 'tuner-card', 'spectrum-card', 'dict-card'];

// ─── PURE FUNCTIONS ─────────────────────────────────────────────────────────

/**
 * Returns a default CardLayoutPrefs distributing cards evenly across n columns.
 * @param {number} n - Number of columns.
 * @returns {CardLayoutPrefs}
 */
export function defaultLayout(n) {
    /** @type {CardPlacement[]} */
    const placements = ALL_CARD_IDS.map((id, i) => ({ id, col: i % n, colSpan: 1 }));
    return { numColumns: n, placements };
}

/**
 * Migrates old { cols, fullWidth } format to unified placements array.
 * @param {{ numColumns: number, cols: string[][], fullWidth: string[] }} old
 * @returns {CardLayoutPrefs}
 */
export function migrateOldLayout(old) {
    /** @type {CardPlacement[]} */
    const placements = [];
    const maxLen = Math.max(...old.cols.map(c => c.length), 0);
    for (let row = 0; row < maxLen; row++) {
        for (let col = 0; col < old.cols.length; col++) {
            const id = old.cols[col]?.[row];
            if (id) placements.push({ id, col, colSpan: 1 });
        }
    }
    (old.fullWidth ?? []).forEach(id => placements.push({ id, col: 'full', colSpan: old.numColumns }));
    return { numColumns: old.numColumns, placements };
}

/**
 * Ensures every placement has a valid colSpan field and that col + colSpan
 * does not exceed numColumns (prevents grid overflow).
 * @param {CardLayoutPrefs} layout
 * @returns {CardLayoutPrefs}
 */
export function ensureColSpan(layout) {
    for (const p of layout.placements) {
        if (p.col === 'full') {
            p.colSpan = layout.numColumns;
        } else {
            if (typeof p.colSpan !== 'number' || p.colSpan < 1) {
                p.colSpan = 1;
            } else if (p.colSpan > layout.numColumns) {
                p.colSpan = layout.numColumns;
            }
            // Clamp col so the card fits: col + colSpan <= numColumns
            const col = /** @type {number} */ (p.col);
            if (col + p.colSpan > layout.numColumns) {
                p.col = Math.max(0, layout.numColumns - p.colSpan);
            }
        }
    }
    return layout;
}

/**
 * Returns the effective column span for a placement, defaulting to 1.
 * @param {CardPlacement} p
 * @param {number} numColumns
 * @returns {number}
 */
export function effectiveSpan(p, numColumns) {
    if (p.col === 'full') return numColumns;
    return Math.min(p.colSpan ?? 1, numColumns);
}

// ─── INIT ───────────────────────────────────────────────────────────────────

/**
 * Initialises the card layout system: restores layout from prefs, sets up
 * drag-to-reorder, collapse toggles, resize grips, and column-count stepper.
 * @param {CardsOptions} opts
 * @returns {CardsAPI}
 */
export function initCards(opts) {
    const { savePrefs, loadPrefs } = opts;

    // ─── CARD LAYOUT STATE ──────────────────────────────────────
    /** @type {CardLayoutPrefs} */
    let cardLayout = defaultLayout(2);

    // ─── RESTORE LAYOUT FROM PREFS ──────────────────────────────
    {
        const prefs0 = loadPrefs();
        if (prefs0.cardLayout?.placements?.length) {
            cardLayout = prefs0.cardLayout;
        } else if (/** @type {any} */ (prefs0.cardLayout)?.cols?.length) {
            cardLayout = migrateOldLayout(/** @type {any} */ (prefs0.cardLayout));
        } else if (prefs0.cardOrder?.length) {
            const n = 2;
            /** @type {string[][]} */
            const cols = Array.from({ length: n }, () => /** @type {string[]} */ ([]));
            prefs0.cardOrder.forEach((id, i) => cols[i % n]?.push(id));
            cardLayout = migrateOldLayout({ numColumns: n, cols, fullWidth: [] });
        }
        // Validate: add any card IDs missing from the saved layout
        const knownInLayout = new Set(cardLayout.placements.map(p => p.id));
        ALL_CARD_IDS.forEach(id => {
            if (!knownInLayout.has(id)) {
                const colCounts = Array.from({ length: cardLayout.numColumns }, () => 0);
                cardLayout.placements.forEach(pl => { if (typeof pl.col === 'number' && pl.col < colCounts.length) colCounts[pl.col] = (colCounts[pl.col] ?? 0) + 1; });
                let shortestCol = 0;
                colCounts.forEach((c, i) => { if (c < (colCounts[shortestCol] ?? Infinity)) shortestCol = i; });
                cardLayout.placements.push({ id, col: shortestCol, colSpan: 1 });
            }
        });
        // Ensure all placements have valid colSpan
        ensureColSpan(cardLayout);
    }

    // ─── LAYOUT HELPERS ─────────────────────────────────────────

    /** Syncs CSS classes and custom properties on each card to match placements. */
    function syncCardClasses() {
        const isWide = window.innerWidth >= 700;
        const placementMap = new Map(cardLayout.placements.map(p => [p.id, p]));
        document.querySelectorAll('.card').forEach(card => {
            const p = placementMap.get(card.id);
            if (!p) return;
            const span = effectiveSpan(p, cardLayout.numColumns);
            const isFull = p.col === 'full' || span >= cardLayout.numColumns;
            card.classList.toggle('card-is-full-width', isFull);
            const el = /** @type {HTMLElement} */ (card);
            el.style.setProperty('--card-col-span', String(span));
            if (isWide) {
                if (isFull) {
                    el.style.setProperty('grid-column', '1 / -1');
                } else {
                    // Explicit column placement: col is 0-based, grid-column is 1-based
                    el.style.setProperty('grid-column', `${/** @type {number} */ (p.col) + 1} / span ${span}`);
                }
            } else {
                el.style.removeProperty('grid-column');
            }
        });
    }

    /**
     * Returns true if two column ranges overlap.
     * @param {number} startA
     * @param {number} spanA
     * @param {number} startB
     * @param {number} spanB
     * @returns {boolean}
     */
    function rangesOverlap(startA, spanA, startB, spanB) {
        return startA < startB + spanB && startB < startA + spanA;
    }

    /**
     * After a card's span or col changes, checks all non-full cards for
     * column-range overlaps and moves conflicting cards to free columns.
     * Uses a greedy approach: processes cards in placement order, and for
     * each card that overlaps a previously-placed card, finds the first
     * column where it fits without overlapping.
     * @param {CardLayoutPrefs} layout
     */
    function resolveOverlaps(layout) {
        const n = layout.numColumns;
        // First pass: clamp col + span
        for (const p of layout.placements) {
            if (p.col === 'full') continue;
            const span = p.colSpan ?? 1;
            const col = /** @type {number} */ (p.col);
            if (col + span > n) {
                p.col = Math.max(0, n - span);
            }
        }
        // Group non-full cards by their current col to detect overlaps.
        // Process in placement order: each card checks against all prior
        // placed cards. If overlap, find first free column that fits.
        /** @type {Array<{p: CardPlacement, col: number, span: number}>} */
        const placed = [];
        for (const p of layout.placements) {
            if (p.col === 'full') continue;
            const span = p.colSpan ?? 1;
            let col = /** @type {number} */ (p.col);

            // Check if this card overlaps any already-placed card
            const hasOverlap = placed.some(other =>
                rangesOverlap(col, span, other.col, other.span)
            );

            if (hasOverlap) {
                // Find first column where this card fits without overlapping
                let found = false;
                for (let tryCol = 0; tryCol <= n - span; tryCol++) {
                    const ok = !placed.some(other =>
                        rangesOverlap(tryCol, span, other.col, other.span)
                    );
                    if (ok) {
                        col = tryCol;
                        found = true;
                        break;
                    }
                }
                // If no fit found in current "row", that's ok — CSS Grid will
                // push it to the next row automatically. Keep the original col.
                if (found) {
                    p.col = col;
                } else {
                    // Reset placed for the next "row"
                    placed.length = 0;
                    col = /** @type {number} */ (p.col);
                }
            }
            placed.push({ p, col, span });
        }
    }

    /**
     * Distributes cards into a CSS Grid (≥700px) or flat single-column
     * order (<700px). Safe to call multiple times — always re-populates from cardLayout.
     */
    function distributeCards() {
        const isWide = window.innerWidth >= 700;
        const footer = document.getElementById('app-version-footer');
        // Rescue all cards back into body before rebuilding layout containers
        document.querySelectorAll('.card-grid, .card-full-width').forEach(container => {
            [...container.querySelectorAll('.card')].forEach(card => document.body.insertBefore(card, footer));
            container.remove();
        });
        if (isWide) {
            const grid = document.createElement('div');
            grid.className = 'card-grid';
            grid.style.setProperty('--num-cols', String(cardLayout.numColumns));
            for (const p of cardLayout.placements) {
                const el = document.getElementById(p.id);
                if (el) grid.appendChild(el);
            }
            document.body.insertBefore(grid, footer);
            document.body.dataset.numCols = String(cardLayout.numColumns);
        } else {
            // Mobile: single-column reading order
            for (const p of cardLayout.placements) {
                const el = document.getElementById(p.id);
                if (el) document.body.insertBefore(el, footer);
            }
            delete document.body.dataset.numCols;
        }
        syncCardClasses();
    }

    /**
     * Cycles a card's colSpan: 1 → 2 → ... → numColumns → 1.
     * When span equals numColumns, also sets col to 'full' for clarity.
     * Clamps col so col + colSpan never exceeds numColumns, and
     * reassigns overlapping cards to non-overlapping positions.
     * @param {string} cardId
     */
    function cycleCardSpan(cardId) {
        const idx = cardLayout.placements.findIndex(p => p.id === cardId);
        if (idx < 0) return;
        const p = /** @type {CardPlacement} */ (cardLayout.placements[idx]);
        const currentSpan = effectiveSpan(p, cardLayout.numColumns);
        const nextSpan = (currentSpan % cardLayout.numColumns) + 1;
        if (nextSpan >= cardLayout.numColumns) {
            p.col = 'full';
            p.colSpan = cardLayout.numColumns;
        } else {
            // Return to a column if was full-width
            if (p.col === 'full') {
                p.col = 0;
            }
            p.colSpan = nextSpan;
            // Clamp col so card fits within the grid
            const col = /** @type {number} */ (p.col);
            if (col + nextSpan > cardLayout.numColumns) {
                p.col = Math.max(0, cardLayout.numColumns - nextSpan);
            }
        }
        // Fix any overlapping cards
        resolveOverlaps(cardLayout);
        distributeCards();
        savePrefs();
    }

    /**
     * Changes the number of columns, redistributing column cards.
     * Clamps colSpan values that exceed the new column count and ensures
     * col + colSpan fits within the grid.
     * @param {number} n - New column count (clamped to 1–3).
     */
    function setNumColumns(n) {
        if (n < 1 || n > 3) return;
        cardLayout.numColumns = n;
        // First clamp colSpan and col to fit the new column count
        ensureColSpan(cardLayout);
        // Redistribute non-full cards round-robin by column start position
        let colIdx = 0;
        cardLayout.placements.forEach(p => {
            if (p.col !== 'full') {
                const span = p.colSpan ?? 1;
                // Place at colIdx, but ensure it fits
                const startCol = colIdx % n;
                p.col = (startCol + span <= n) ? startCol : Math.max(0, n - span);
                colIdx++;
            }
        });
        distributeCards();
        savePrefs();
    }

    // ─── CARD DRAG-TO-REORDER ───────────────────────────────────

    /** Sets up pointer-based drag-to-reorder for feature cards with auto-scroll. */
    function initCardDrag() {
        /** @type {HTMLElement | null} */
        let dragging = null;
        /** @type {number | null} */
        let scrollRaf = null;
        let hasMoved = false;
        const DRAG_THRESHOLD = 5;
        let startX = 0, startY = 0;
        const SCROLL_ZONE = 80;
        const SCROLL_SPEED = 8;

        /** @returns {void} */
        function stopAutoScroll() {
            if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = null; }
        }

        /** @param {number} direction */
        function startAutoScroll(direction) {
            stopAutoScroll();
            /** @returns {void} */
            function step() { window.scrollBy(0, direction * SCROLL_SPEED); scrollRaf = requestAnimationFrame(step); }
            scrollRaf = requestAnimationFrame(step);
        }

        /** @param {number} clientY */
        function tickAutoScroll(clientY) {
            if (clientY < SCROLL_ZONE) startAutoScroll(-1);
            else if (clientY > window.innerHeight - SCROLL_ZONE) startAutoScroll(1);
            else stopAutoScroll();
        }

        /** @returns {Element[]} */
        function getCards() { return [...document.querySelectorAll('.card:not(.dragging)')]; }

        /**
         * @param {number} clientX
         * @param {number} clientY
         * @returns {Element | null}
         */
        function findDropTarget(clientX, clientY) {
            const others = getCards();
            const hit = others.find(c => {
                const r = c.getBoundingClientRect();
                return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
            });
            if (hit) return hit;
            let nearest = null, minDist = Infinity;
            others.forEach(c => {
                const r = c.getBoundingClientRect();
                const dist = Math.hypot(clientX - (r.left + r.width / 2), clientY - (r.top + r.height / 2));
                if (dist < minDist) { minDist = dist; nearest = c; }
            });
            return nearest;
        }

        /**
         * @param {number} clientX
         * @param {number} clientY
         */
        function updateDropIndicators(clientX, clientY) {
            getCards().forEach(c => c.classList.remove('drop-above', 'drop-below'));
            const target = findDropTarget(clientX, clientY);
            if (target) {
                const rect = target.getBoundingClientRect();
                target.classList.add(clientY < rect.top + rect.height / 2 ? 'drop-above' : 'drop-below');
            }
        }

        /**
         * @param {number} clientX
         * @param {number} clientY
         */
        function applyDrop(clientX, clientY) {
            const others = getCards();
            others.forEach(c => c.classList.remove('drop-above', 'drop-below'));
            const target = findDropTarget(clientX, clientY);
            if (!target || !dragging) return;
            const rect = target.getBoundingClientRect();
            const before = clientY < rect.top + rect.height / 2;
            const draggingId = dragging.id;
            const targetId = target.id;
            if (draggingId === targetId) return;

            const srcIdx = cardLayout.placements.findIndex(p => p.id === draggingId);
            if (srcIdx < 0) return;
            const srcPlacement = /** @type {CardPlacement} */ (cardLayout.placements[srcIdx]);
            cardLayout.placements.splice(srcIdx, 1);

            const tgtIdx = cardLayout.placements.findIndex(p => p.id === targetId);
            if (tgtIdx < 0) { cardLayout.placements.splice(srcIdx, 0, srcPlacement); return; }
            const tgtPlacement = /** @type {CardPlacement} */ (cardLayout.placements[tgtIdx]);

            const insertIdx = before ? tgtIdx : tgtIdx + 1;
            const isDesktop = window.innerWidth >= 700;

            const span = srcPlacement.colSpan ?? 1;
            if (isDesktop && srcPlacement.col !== 'full' && typeof tgtPlacement.col === 'number') {
                // Clamp target col so card fits: col + span <= numColumns
                const col = (tgtPlacement.col + span <= cardLayout.numColumns)
                    ? tgtPlacement.col
                    : Math.max(0, cardLayout.numColumns - span);
                cardLayout.placements.splice(insertIdx, 0, { id: draggingId, col, colSpan: span });
            } else {
                cardLayout.placements.splice(insertIdx, 0, { id: draggingId, col: srcPlacement.col, colSpan: span });
            }
            distributeCards();
        }

        /** @returns {void} */
        function endDrag() {
            stopAutoScroll();
            if (!dragging) return;
            getCards().forEach(c => c.classList.remove('drop-above', 'drop-below'));
            dragging.classList.remove('dragging');
            dragging = null;
        }

        /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.drag-handle')).forEach(handle => {
            handle.addEventListener('pointerdown', e => {
                e.preventDefault();
                dragging = handle.closest('.card');
                hasMoved = false;
                startX = e.clientX;
                startY = e.clientY;
                if (dragging) dragging.classList.add('dragging');
                handle.setPointerCapture(e.pointerId);
            });
            handle.addEventListener('pointermove', e => {
                if (!dragging) return;
                if (!hasMoved) {
                    const dx = e.clientX - startX, dy = e.clientY - startY;
                    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
                    hasMoved = true;
                }
                tickAutoScroll(e.clientY);
                updateDropIndicators(e.clientX, e.clientY);
            });
            handle.addEventListener('pointerup', e => {
                if (!dragging) return;
                if (hasMoved) {
                    applyDrop(e.clientX, e.clientY);
                    savePrefs();
                }
                endDrag();
            });
            handle.addEventListener('pointercancel', () => endDrag());
        });
    }

    // ─── CARD LAYOUT CONTROLS ───────────────────────────────────

    /** Adds resize grips to cards and wires up the column-count stepper. */
    function initCardLayoutControls() {
        document.querySelectorAll('.card').forEach(card => {
            const grip = document.createElement('button');
            grip.className = 'card-resize-handle';
            grip.setAttribute('aria-label', 'Cycle card width');
            grip.textContent = '⊿';
            card.appendChild(grip);

            grip.addEventListener('click', e => {
                e.stopPropagation();
                cycleCardSpan(card.id);
                updateGripLabel(card);
            });
        });

        /**
         * Updates the resize grip label to show current span.
         * @param {Element} card
         */
        function updateGripLabel(card) {
            const grip = card.querySelector('.card-resize-handle');
            if (!grip) return;
            const p = cardLayout.placements.find(pl => pl.id === card.id);
            if (!p) return;
            const span = effectiveSpan(p, cardLayout.numColumns);
            if (span >= cardLayout.numColumns) {
                grip.textContent = '⊿'; // full-width indicator
            } else {
                grip.textContent = '⊿';
            }
        }

        const colCountVal = document.getElementById('colCountVal');
        if (colCountVal) colCountVal.textContent = String(cardLayout.numColumns);

        document.getElementById('colCountMinus')?.addEventListener('click', () => {
            setNumColumns(cardLayout.numColumns - 1);
            if (colCountVal) colCountVal.textContent = String(cardLayout.numColumns);
        });

        document.getElementById('colCountPlus')?.addEventListener('click', () => {
            setNumColumns(cardLayout.numColumns + 1);
            if (colCountVal) colCountVal.textContent = String(cardLayout.numColumns);
        });
    }

    // ─── CARD COLLAPSE ──────────────────────────────────────────

    /** Restores collapsed card state from prefs and wires up collapse toggle buttons. */
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

    // ─── WIRE UP & RETURN API ───────────────────────────────────
    initCardCollapse();
    initCardLayoutControls();
    initCardDrag();
    distributeCards();
    window.matchMedia('(min-width: 700px)').addEventListener('change', distributeCards);

    return {
        distributeCards,
        getCardLayout: () => ({
            numColumns: cardLayout.numColumns,
            placements: cardLayout.placements.map(p => ({ ...p })),
        }),
        getCollapsedCardIds: () => [...document.querySelectorAll('.card.collapsed')].map(c => c.id),
    };
}
