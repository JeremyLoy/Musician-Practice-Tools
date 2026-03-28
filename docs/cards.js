// @ts-check
// ─── CARD LAYOUT, DRAG-TO-REORDER, COLLAPSE, COLUMN CONTROLS ────────────────

// ─── Type Definitions ────────────────────────────────────────────────────────

/**
 * Where a card is placed: column index (0-based) or 'full' for full-width.
 * @typedef {object} CardPlacement
 * @property {string} id - Card element ID.
 * @property {number | 'full'} col - Column index or 'full' for full-width.
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
    const placements = ALL_CARD_IDS.map((id, i) => ({ id, col: i % n }));
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
            if (id) placements.push({ id, col });
        }
    }
    (old.fullWidth ?? []).forEach(id => placements.push({ id, col: 'full' }));
    return { numColumns: old.numColumns, placements };
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
                cardLayout.placements.push({ id, col: shortestCol });
            }
        });
    }

    // ─── LAYOUT HELPERS ─────────────────────────────────────────

    /**
     * Returns card elements in placement order. Used for mobile single-column layout.
     * @returns {Element[]}
     */
    function getReadingOrder() {
        /** @type {Element[]} */
        const order = [];
        cardLayout.placements.forEach(p => {
            const el = document.getElementById(p.id);
            if (el) order.push(el);
        });
        return order;
    }

    /** Syncs the .card-is-full-width class on each card to match placements. */
    function syncCardFullWidthClasses() {
        const fullIds = new Set(cardLayout.placements.filter(p => p.col === 'full').map(p => p.id));
        document.querySelectorAll('.card').forEach(card => {
            card.classList.toggle('card-is-full-width', fullIds.has(card.id));
        });
    }

    /**
     * Distributes cards into the multi-column grid (≥700px) or flat single-column
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
            /** @type {Array<{ type: 'grid', cols: string[][] } | { type: 'full', id: string }>} */
            const sections = [];
            /** @type {{ type: 'grid', cols: string[][] } | null} */
            let currentGrid = null;
            for (const p of cardLayout.placements) {
                if (p.col === 'full') {
                    if (currentGrid) { sections.push(currentGrid); currentGrid = null; }
                    sections.push({ type: 'full', id: p.id });
                } else {
                    if (!currentGrid) {
                        currentGrid = { type: 'grid', cols: Array.from({ length: cardLayout.numColumns }, () => /** @type {string[]} */ ([])) };
                    }
                    currentGrid.cols[p.col]?.push(p.id);
                }
            }
            if (currentGrid) sections.push(currentGrid);
            for (const section of sections) {
                if (section.type === 'full') {
                    const el = document.getElementById(section.id);
                    if (el) {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'card-full-width';
                        wrapper.appendChild(el);
                        document.body.insertBefore(wrapper, footer);
                    }
                } else {
                    const grid = document.createElement('div');
                    grid.className = 'card-grid';
                    for (let i = 0; i < cardLayout.numColumns; i++) {
                        const col = document.createElement('div');
                        col.className = 'card-grid-col';
                        (section.cols[i] ?? []).forEach(id => {
                            const el = document.getElementById(id);
                            if (el) col.appendChild(el);
                        });
                        grid.appendChild(col);
                    }
                    document.body.insertBefore(grid, footer);
                }
            }
            document.body.dataset.numCols = String(cardLayout.numColumns);
        } else {
            getReadingOrder().forEach(card => document.body.insertBefore(card, footer));
            delete document.body.dataset.numCols;
        }
        syncCardFullWidthClasses();
    }

    /**
     * Toggles a card between normal column placement and full-width.
     * @param {string} cardId
     */
    function toggleCardFullWidth(cardId) {
        const idx = cardLayout.placements.findIndex(p => p.id === cardId);
        if (idx < 0) return;
        const p = /** @type {CardPlacement} */ (cardLayout.placements[idx]);
        if (p.col === 'full') {
            const colCounts = Array.from({ length: cardLayout.numColumns }, () => 0);
            cardLayout.placements.forEach(pl => { if (typeof pl.col === 'number' && pl.col < colCounts.length) colCounts[pl.col] = (colCounts[pl.col] ?? 0) + 1; });
            let shortestCol = 0;
            colCounts.forEach((c, i) => { if (c < (colCounts[shortestCol] ?? Infinity)) shortestCol = i; });
            p.col = shortestCol;
        } else {
            p.col = 'full';
        }
        distributeCards();
        savePrefs();
    }

    /**
     * Changes the number of columns, redistributing column cards via round-robin.
     * @param {number} n - New column count (clamped to 1–3).
     */
    function setNumColumns(n) {
        if (n < 1 || n > 3) return;
        let colIdx = 0;
        cardLayout.placements.forEach(p => {
            if (p.col !== 'full') {
                p.col = colIdx % n;
                colIdx++;
            }
        });
        cardLayout.numColumns = n;
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

            if (isDesktop && srcPlacement.col !== 'full' && typeof tgtPlacement.col === 'number') {
                cardLayout.placements.splice(insertIdx, 0, { id: draggingId, col: tgtPlacement.col });
            } else {
                cardLayout.placements.splice(insertIdx, 0, { id: draggingId, col: srcPlacement.col });
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
        const RESIZE_THRESHOLD = 60;

        document.querySelectorAll('.card').forEach(card => {
            const grip = document.createElement('span');
            grip.className = 'card-resize-handle';
            grip.setAttribute('aria-label', 'Drag to toggle full width');
            grip.textContent = '⊿';
            card.appendChild(grip);

            let gripStartX = 0;
            let gripHasMoved = false;

            grip.addEventListener('pointerdown', e => {
                e.preventDefault();
                gripStartX = e.clientX;
                gripHasMoved = false;
                grip.setPointerCapture(e.pointerId);
            });

            grip.addEventListener('pointermove', e => {
                if (Math.abs(e.clientX - gripStartX) > 5) gripHasMoved = true;
            });

            grip.addEventListener('pointerup', e => {
                if (!gripHasMoved) return;
                const dx = e.clientX - gripStartX;
                const isFullWidth = cardLayout.placements.some(p => p.id === card.id && p.col === 'full');
                if (!isFullWidth && dx >= RESIZE_THRESHOLD) {
                    toggleCardFullWidth(card.id);
                } else if (isFullWidth && dx <= -RESIZE_THRESHOLD) {
                    toggleCardFullWidth(card.id);
                }
            });

            grip.addEventListener('pointercancel', () => { gripHasMoved = false; });
        });

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
