// @ts-check
/** @import { MetronomePrefs, MetronomeAPI, Meter } from './metronome.js' */
/** @import { TunerAPI } from './tuner.js' */
/** @import { DroneAPI, DronePrefs } from './drone.js' */
import { initDict } from './dict.js';
import { initTuner } from './tuner.js';
import { initRecorder } from './recorder.js';
import { initMetronome } from './metronome.js';
import { initSpectrum } from './spectrum.js';
import { initDrone } from './drone.js';

// ─── Type Definitions ────────────────────────────────────────────────────────

/**
 * Per-column card layout configuration.
 * @typedef {object} CardLayoutPrefs
 * @property {number} numColumns - Number of columns (default 2, range 1–4).
 * @property {string[][]} cols - Ordered card IDs per column. cols[0] = leftmost.
 * @property {string[]} fullWidth - Card IDs shown full-width below the column grid.
 */

/**
 * Persisted user preferences (stored in localStorage).
 * @typedef {object} SavedPrefs
 * @property {number} [bpm]
 * @property {Meter} [meter]
 * @property {boolean} [metroSound]
 * @property {boolean} [metroLight]
 * @property {number} [metroVolume]
 * @property {string} [clickSound]
 * @property {number} [droneRoot]
 * @property {number[]} [droneIntervals]
 * @property {string} [droneTuning]
 * @property {string} [droneColor]
 * @property {number} [droneOctave]
 * @property {number} [droneVolume]
 * @property {number} [refA]
 * @property {number} [droneRef] - Deprecated. Use refA instead.
 * @property {string[]} [cardOrder] - Deprecated. Use cardLayout instead.
 * @property {string[]} [collapsedCards]
 * @property {CardLayoutPrefs} [cardLayout]
 */

// ─── VERSION ─────────────────────────────────────────────────
// Keep in sync with CACHE_VERSION in sw.js. Format: YYYYMMDD-HHMM (24h UTC).
/** @type {string} */
const APP_VERSION = 'toolkit-20260327-1430';

// 1. Inline the base64 string directly (No import needed!)
const silenceDataURI = "data:audio/mpeg;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAADAAAGhgBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVWqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr///////////////////////////////////////////8AAAA5TEFNRTMuOThyAc0AAAAAAAAAABSAJAiqQgAAgAAABobxtI73AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQxAACFEII9ACZ/sJZwWEoEb8w/////N//////JcxjHjf+7/v/H2PzCCFAiDtGeyBCIx7bJJ1mmEEMy6g8mm2c8nrGABB4h2Mkmn//4z/73u773R5qHHu/j/w7Kxkzh5lWRWdsifCkNAnY9Zc1HvDAhjhSHdFkHFzLmabt/AQxSg2wwzLhHIJOBnAWwVY4zrhIYhhc2kvhYDfQ4hDi2Gmh5KyFn8EcGIrHAngNgIwVIEMf5bzbAiTRoAD///8z/KVhkkWEle6IX+d/z4fvH3BShK1e5kmjkCMoxVmXhd4ROlTKo3iipasvTilY21q19ta30/v/0/idPX1v8PNxJL6ramnOVsdvMv2akO0iSYIzdJFirtzWXCZicS9vHqvSKyqm5XJBdqBwPxyfJdykhWTZ0G0ZyTZGpLKxsNwwoRhsx3tZfhwmeOBVISm3impAC/IT/8hP/EKEM1KMdVdVKM2rHV4x7HVXZvbVVKN/qq8CiV9VL9jjH/6l6qf7MBCjZmOqsAibjcP+qqqv0oxqpa/NVW286hPo1nz2L/h8+jXt//uSxCmDU2IK/ECN98KKtE5IYzNoCfbw+u9i5r8PoadUMFPKqWL4LK3T/LCraMSHGkW4bpLXR/E6LlHOVQxmslKVJ8IULktMN06N0FKCpHCoYsjC4F+Z0NVqdNFoGSTjSiyjzLdnZ2fNqTi2eHKONONKLMPMKLONKLMPQRJGlFxZRoKcJFAYEeIFiRQkUWUeYfef//Ko04soswso40UJAgMw8wosososy0EalnZyjQUGBRQGIFggOWUacWUeYmuadrZziQKKEgQsQLAhQkUJAgMQDghltLO1onp0cpkNInSFMqlYeSEJ5AHsqFdOwy1DA2sRmRJKxdKRfLhfLw5BzUxBTUUzLjk4LjJVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjk4LjJVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7ksRRA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";

// 2. Setup the audio tag
const audioTag = document.createElement("audio");
audioTag.controls = false;
audioTag.preload = "auto";
audioTag.loop = true; // looping is usually fine here, but we'll pause it right away
audioTag.src = silenceDataURI;

// 3. Unlock audio on the FIRST user interaction
let isAudioUnlocked = false;

/** Plays a silent audio clip to bypass the iOS mute switch on first user gesture. */
const unlockAudio = () => {
    if (isAudioUnlocked) return;

    // Play the silent audio file to bypass the mute switch
    audioTag.play().then(() => {
        // As soon as it plays, we can pause it. The session is now unlocked.
        audioTag.pause();
        isAudioUnlocked = true;

        // Remove the event listeners to keep things clean
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('click', unlockAudio);
    }).catch(err => {
        // If it fails (e.g., browser policies), we'll just quietly ignore it
        console.warn("Audio unlock failed:", err);
    });
};

// Bind to both touch and click to ensure we catch the user's first action
document.addEventListener('touchstart', unlockAudio, { once: true });
document.addEventListener('click', unlockAudio, { once: true });

// ─── SCREEN WAKE LOCK ────────────────────────────────────────
// Prevents iOS/Android from dimming or locking the screen while
// the drone, metronome, or recorder is active.
/** @type {WakeLockSentinel | null} */
let wakeLock = null;

/** Acquires or releases the screen wake lock based on whether any audio feature is active. */
async function updateWakeLock() {
    const audioActive = drone?.isRunning() || metroRunning || recorderRunning || tunerRunning || spectrumRunning;
    if (audioActive && !wakeLock && 'wakeLock' in navigator) {
        try { wakeLock = await navigator.wakeLock.request('screen'); }
        catch(e) { /* permission denied or not supported — silently ignore */ }
    } else if (!audioActive && wakeLock) {
        try { wakeLock.release(); } catch(e) {}
        wakeLock = null;
    }
}

// ─── AUDIO CONTEXT ───────────────────────────────────────────
/** @type {AudioContext | undefined} */
let audioCtx;
/** @type {IDBDatabase | undefined} */
let db;

/** Returns the shared AudioContext, creating it lazily and resuming if suspended. */
const getCtx = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
    if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') audioCtx.resume();
    return audioCtx;
};

// ─── AUDIO SESSION HINT (Safari/iOS 16.4+) ──────────────────
// Tells the OS this page does simultaneous playback + recording.
// Improves iOS audio routing when drone/metronome play alongside
// the tuner or recorder mic. No-op on browsers without the API.
if (/** @type {any} */ (navigator).audioSession) {
    /** @type {any} */ (navigator).audioSession.type = 'play-and-record';
}

// ─── SHARED MIC STREAM ──────────────────────────────────────
// Single getUserMedia({ audio: true }) shared by tuner + recorder.
// Uses the simple constraint form for iOS Safari compatibility.
// Only releases the OS mic handle when *both* consumers are idle.
/** @type {MediaStream | null} */
let sharedMicStream = null;

/**
 * Returns the shared microphone MediaStream, requesting access if needed.
 * @returns {Promise<MediaStream>}
 */
async function getMicStream() {
    if (sharedMicStream && sharedMicStream.getTracks().every(t => t.readyState === 'live')) {
        return sharedMicStream;
    }
    sharedMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return sharedMicStream;
}

/** Releases the shared mic stream when both the tuner and recorder are idle. */
function releaseMicStream() {
    if (!tunerRunning && !recorderRunning && !spectrumRunning && sharedMicStream) {
        sharedMicStream.getTracks().forEach(t => t.stop());
        sharedMicStream = null;
    }
}

// When the page becomes visible again after being backgrounded, resume the AudioContext
// and resync audio. iOS suspends (or interrupts) the context when the app is backgrounded.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
        // iOS kills mic access when backgrounded — stop the tuner cleanly
        if (tunerRunning) tuner?.stop();
        return;
    }
    if (!audioCtx) return;

    audioCtx.resume().then(() => {
        // Drone: oscillators are killed by iOS when the context is suspended.
        drone?.handleVisibilityResume();

        // Metronome: handled by metronome module's handleVisibilityResume()
        metronome?.handleVisibilityResume();

        // Wake lock is released automatically when the page is hidden; re-acquire it.
        updateWakeLock();
    });
});

// ─── PERSISTENCE ─────────────────────────────────────────────
const PREFS_KEY = 'toolkit_prefs_v2';

/**
 * Loads saved preferences from localStorage.
 * @returns {SavedPrefs}
 */
function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch { return {}; } }

// ─── MULTI-COLUMN LAYOUT ─────────────────────────────────────
// At ≥700px, cards are placed into explicit per-column lists. Moving a card
// within a column only affects that column; cross-column moves do not shift
// other cards. Full-width cards span all columns and appear below the grid.

/** Canonical list of all card element IDs in their default visual order. */
const ALL_CARD_IDS = ['drone-card', 'metro-card', 'memos-card', 'tuner-card', 'spectrum-card', 'dict-card'];

/**
 * Returns a default CardLayoutPrefs distributing cards evenly across n columns.
 * @param {number} n - Number of columns.
 * @returns {CardLayoutPrefs}
 */
function defaultLayout(n) {
    const cols = Array.from({ length: n }, () => /** @type {string[]} */ ([]));
    ALL_CARD_IDS.forEach((id, i) => cols[i % n]?.push(id));
    return { numColumns: n, cols, fullWidth: [] };
}

/** @type {CardLayoutPrefs} */
let cardLayout = defaultLayout(2);
/** @type {HTMLDivElement | null} */
let cardGrid = null;
/** @type {HTMLDivElement | null} */
let fullWidthContainer = null;

/**
 * Returns card elements in reading order: interleaved left→right per row across
 * columns, then full-width cards appended. Used for mobile single-column layout.
 * @returns {Element[]}
 */
function getReadingOrder() {
    const max = cardLayout.cols.reduce((m, c) => Math.max(m, c.length), 0);
    /** @type {Element[]} */
    const order = [];
    for (let i = 0; i < max; i++) {
        cardLayout.cols.forEach(col => {
            const id = col[i];
            if (id) { const el = document.getElementById(id); if (el) order.push(el); }
        });
    }
    cardLayout.fullWidth.forEach(id => { const el = document.getElementById(id); if (el) order.push(el); });
    return order;
}

/** Syncs the .card-is-full-width class on each card to match cardLayout.fullWidth. */
function syncCardFullWidthClasses() {
    document.querySelectorAll('.card').forEach(card => {
        card.classList.toggle('card-is-full-width', cardLayout.fullWidth.includes(card.id));
    });
}

/**
 * Distributes cards into the multi-column grid (≥700px) or flat single-column
 * order (<700px). Safe to call multiple times — always re-populates from cardLayout.
 */
function distributeCards() {
    const isWide = window.innerWidth >= 700;
    const footer = document.getElementById('app-version-footer');
    if (isWide) {
        // Build/rebuild cardGrid if absent or column count changed
        if (!cardGrid || cardGrid.children.length !== cardLayout.numColumns) {
            if (cardGrid) {
                // Rescue card elements before removing the grid so getElementById still finds them
                [...cardGrid.querySelectorAll('.card')].forEach(card => document.body.insertBefore(card, footer));
                cardGrid.remove();
            }
            cardGrid = document.createElement('div');
            cardGrid.className = 'card-grid';
            for (let i = 0; i < cardLayout.numColumns; i++) {
                const col = document.createElement('div');
                col.className = 'card-grid-col';
                cardGrid.appendChild(col);
            }
            const insertRef = (fullWidthContainer?.parentNode) ? fullWidthContainer : footer;
            document.body.insertBefore(cardGrid, insertRef);
        }
        // Place cards into their columns (appendChild moves them from any prior parent)
        const grid = cardGrid;
        cardLayout.cols.forEach((ids, colIdx) => {
            const col = grid.children[colIdx];
            if (!col) return;
            ids.forEach(id => { const el = document.getElementById(id); if (el) col.appendChild(el); });
        });
        // Build fullWidthContainer if absent
        if (!fullWidthContainer) {
            fullWidthContainer = document.createElement('div');
            fullWidthContainer.className = 'card-full-width';
            document.body.insertBefore(fullWidthContainer, footer);
        }
        const fwc = fullWidthContainer;
        cardLayout.fullWidth.forEach(id => { const el = document.getElementById(id); if (el) fwc.appendChild(el); });
    } else {
        // Single column: cards in reading order placed directly in body
        getReadingOrder().forEach(card => document.body.insertBefore(card, footer));
        if (cardGrid) { cardGrid.remove(); cardGrid = null; }
        if (fullWidthContainer) { fullWidthContainer.remove(); fullWidthContainer = null; }
    }
    syncCardFullWidthClasses();
}

/**
 * Toggles a card between normal column placement and full-width below the grid.
 * @param {string} cardId
 */
function toggleCardFullWidth(cardId) {
    if (cardLayout.fullWidth.includes(cardId)) {
        cardLayout.fullWidth = cardLayout.fullWidth.filter(id => id !== cardId);
        // Return to the shortest column
        let shortestIdx = 0;
        cardLayout.cols.forEach((col, i) => {
            if (col.length < (cardLayout.cols[shortestIdx]?.length ?? Infinity)) shortestIdx = i;
        });
        cardLayout.cols[shortestIdx]?.push(cardId);
    } else {
        cardLayout.cols = cardLayout.cols.map(col => col.filter(id => id !== cardId));
        cardLayout.fullWidth.push(cardId);
    }
    distributeCards();
    savePrefs();
}

/**
 * Changes the number of columns, redistributing cards from the current flat order.
 * @param {number} n - New column count (clamped to 1–4).
 */
function setNumColumns(n) {
    if (n < 1 || n > 4) return;
    const flat = cardLayout.cols.flat();
    const newCols = Array.from({ length: n }, () => /** @type {string[]} */ ([]));
    flat.forEach((id, i) => newCols[i % n]?.push(id));
    cardLayout = { numColumns: n, cols: newCols, fullWidth: cardLayout.fullWidth };
    distributeCards();
    savePrefs();
}

/** Saves all current preferences (drone, metronome, card state) to localStorage. */
function savePrefs() {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({
            ...currentMetroPrefs,
            ...currentDronePrefs,
            cardLayout: { numColumns: cardLayout.numColumns, cols: cardLayout.cols.map(c => [...c]), fullWidth: [...cardLayout.fullWidth] },
            collapsedCards: [...document.querySelectorAll('.card.collapsed')].map(c => c.id),
        }));
    } catch(e) {}
}

// ─── INDEXEDDB ───────────────────────────────────────────────
/**
 * Opens the IndexedDB database, creating the 'memos' object store if needed.
 * @returns {Promise<void>}
 */
const initDB = () => new Promise(res => {
    const req = indexedDB.open('MusiciansToolkit', 1);
    req.onupgradeneeded = e => /** @type {IDBOpenDBRequest} */ (e.target).result.createObjectStore('memos', { keyPath: 'id' });
    req.onsuccess = e => { db = /** @type {IDBOpenDBRequest} */ (e.target).result; res(undefined); };
});

// ─── CARD LAYOUT RESTORE ─────────────────────────────────────
{
    const prefs0 = loadPrefs();
    if (prefs0.cardLayout?.cols?.length) {
        cardLayout = prefs0.cardLayout;
        // Validate: add any card IDs missing from the saved layout to the last column
        const knownInLayout = new Set([...cardLayout.cols.flat(), ...cardLayout.fullWidth]);
        ALL_CARD_IDS.forEach(id => {
            if (!knownInLayout.has(id)) cardLayout.cols[cardLayout.cols.length - 1]?.push(id);
        });
    } else if (prefs0.cardOrder?.length) {
        // Migrate from old flat cardOrder to column-aware layout
        const n = 2;
        const cols = Array.from({ length: n }, () => /** @type {string[]} */ ([]));
        prefs0.cardOrder.forEach((id, i) => cols[i % n]?.push(id));
        const storedSet = new Set(prefs0.cardOrder);
        ALL_CARD_IDS.forEach(id => { if (!storedSet.has(id)) cols[cols.length - 1]?.push(id); });
        cardLayout = { numColumns: n, cols, fullWidth: [] };
    }
    // else: cardLayout stays as defaultLayout(2) from initialization above
}

// ─── DRONE ────────────────────────────────────────────────────
/** @type {SavedPrefs} */
const prefs = loadPrefs();

/** @type {DronePrefs} */
let currentDronePrefs = {
    droneRoot:      prefs.droneRoot      ?? 9,
    droneIntervals: prefs.droneIntervals ?? [0],
    droneTuning:    prefs.droneTuning    ?? 'just',
    droneColor:     prefs.droneColor     ?? 'sine',
    droneOctave:    prefs.droneOctave    ?? 4,
    droneVolume:    prefs.droneVolume    ?? 0.7,
    refA:           prefs.refA ?? prefs.droneRef ?? 440,
};

/** @type {DroneAPI | null} */
let drone = null;

let metroRunning = false;
/** @type {MetronomePrefs | {}} */
let currentMetroPrefs = {};
/** @type {MetronomeAPI | null} */
let metronome = null;
/** @type {TunerAPI | null} */
let tuner = null;
let recorderRunning = false;
let tunerRunning = false;
let spectrumRunning = false;

/** @type {HTMLElement} */ (document.getElementById('app-version-footer')).textContent = APP_VERSION;

// ─── INIT ────────────────────────────────────────────────────
initDB().then(()=>{
    // Restore collapse state before any savePrefs() call (droneSync etc.) so
    // the .collapsed classes are in place when those saves capture collapsedCards.
    initCardCollapse();
    const savedMeter = Object.assign({ groups:[1,1,1,1], denom:4, subdivision:1 }, prefs.meter ?? {});
    if (!Array.isArray(savedMeter.groups)) savedMeter.groups = [1,1,1,1];
    metronome = initMetronome({
        getCtx,
        initialPrefs: {
            bpm: prefs.bpm ?? 120,
            meter: savedMeter,
            metroSound: prefs.metroSound ?? true,
            metroLight: prefs.metroLight ?? true,
            metroVolume: prefs.metroVolume ?? 0.7,
            clickSound: prefs.clickSound ?? 'clave',
        },
        onRunningChange: (v) => { metroRunning = v; updateWakeLock(); },
        onPrefsChange: (mp) => { currentMetroPrefs = mp; savePrefs(); },
    });
    drone = initDrone({
        getCtx,
        onRefAChange: (newVal) => {
            /** @type {HTMLElement} */ (document.getElementById('tunerRefVal')).textContent = String(newVal);
        },
        onRunningChange: (_v) => { updateWakeLock(); },
        onPrefsChange: (dp) => { currentDronePrefs = dp; savePrefs(); },
        initialPrefs: currentDronePrefs,
    });
    drone.sync();
    initRecorder({
        db: /** @type {IDBDatabase} */ (db),
        getCtx,
        onRecordingChange: (v) => { recorderRunning = v; updateWakeLock(); },
        getMicStream,
        releaseMicStream
    });
    initDict();
    tuner = initTuner({
        getCtx,
        getRefA: () => drone?.getRefA() ?? 440,
        onRefAChange: (newVal) => { drone?.setRefA(newVal); },
        onRunningChange: (isRunning) => { tunerRunning = isRunning; updateWakeLock(); },
        getMicStream,
        releaseMicStream
    });
    initSpectrum({
        getCtx,
        getMicStream,
        releaseMicStream,
        onRunningChange: (v) => { spectrumRunning = v; updateWakeLock(); },
    });
    initCardLayoutControls();
    initCardDrag();
    distributeCards();
    window.matchMedia('(min-width: 700px)').addEventListener('change', distributeCards);
    document.body.dataset.ready = '1';
});

// ─── CARD DRAG-TO-REORDER ─────────────────────────────────────
/** Sets up pointer-based drag-to-reorder for feature cards with auto-scroll. */
function initCardDrag() {
    /** @type {HTMLElement | null} */
    let dragging = null;
    /** @type {number | null} */
    let scrollRaf = null;
    let hasMoved = false;
    const DRAG_THRESHOLD = 5; // px of movement before we consider it a real drag
    let startX = 0, startY = 0;
    const SCROLL_ZONE = 80; // px from viewport edge to trigger auto-scroll
    const SCROLL_SPEED = 8; // px per frame

    function stopAutoScroll() {
        if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = null; }
    }

    /** @param {number} direction */
    function startAutoScroll(direction) {
        stopAutoScroll();
        function step() { window.scrollBy(0, direction * SCROLL_SPEED); scrollRaf = requestAnimationFrame(step); }
        scrollRaf = requestAnimationFrame(step);
    }

    /** @param {number} clientY */
    function tickAutoScroll(clientY) {
        if (clientY < SCROLL_ZONE) startAutoScroll(-1);
        else if (clientY > window.innerHeight - SCROLL_ZONE) startAutoScroll(1);
        else stopAutoScroll();
    }

    function getCards() { return [...document.querySelectorAll('.card:not(.dragging)')]; }

    // Find the best drop target using 2D position — works in both single-column
    // and multi-column (CSS columns) layouts. Tries a direct hit test first, then
    // falls back to the nearest card by Euclidean distance to its centre.
    /**
     * @param {number} clientX
     * @param {number} clientY
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

        if (!cardGrid) {
            // Mobile single-column: reorder the flat reading list then redistribute
            const flat = getReadingOrder().filter(el => el !== dragging).map(el => el.id);
            const pos = flat.indexOf(targetId);
            flat.splice(before ? pos : pos + 1, 0, draggingId);
            const n = cardLayout.numColumns;
            const newCols = Array.from({ length: n }, () => /** @type {string[]} */ ([]));
            flat.filter(id => !cardLayout.fullWidth.includes(id)).forEach((id, i) => newCols[i % n]?.push(id));
            cardLayout.cols = newCols;
        } else {
            // Desktop multi-column: column-aware — only mutate source and destination columns
            const srcColIdx = cardLayout.cols.findIndex(col => col.includes(draggingId));
            const srcIsFullWidth = cardLayout.fullWidth.includes(draggingId);
            const dstColIdx = cardLayout.cols.findIndex(col => col.includes(targetId));
            const dstIsFullWidth = cardLayout.fullWidth.includes(targetId);
            if (srcColIdx < 0 && !srcIsFullWidth) return;
            if (dstColIdx < 0 && !dstIsFullWidth) return;
            // Remove from source
            if (srcColIdx >= 0) {
                cardLayout.cols[srcColIdx] = cardLayout.cols[srcColIdx]?.filter(id => id !== draggingId) ?? [];
            } else {
                cardLayout.fullWidth = cardLayout.fullWidth.filter(id => id !== draggingId);
            }
            // Insert at destination
            if (dstColIdx >= 0) {
                const dstCol = cardLayout.cols[dstColIdx];
                if (dstCol) {
                    const pos = dstCol.indexOf(targetId);
                    dstCol.splice(before ? pos : pos + 1, 0, draggingId);
                }
            } else {
                const pos = cardLayout.fullWidth.indexOf(targetId);
                cardLayout.fullWidth.splice(before ? pos : pos + 1, 0, draggingId);
            }
        }
        distributeCards();
    }

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

// ─── CARD LAYOUT CONTROLS ────────────────────────────────────────────────────
/**
 * Adds a resize grip to each card's bottom-right corner and wires up the
 * column-count stepper. The resize grip lets users drag to toggle full-width.
 */
function initCardLayoutControls() {
    const RESIZE_THRESHOLD = 60; // px of horizontal drag needed to toggle span

    document.querySelectorAll('.card').forEach(card => {
        const grip = document.createElement('span');
        grip.className = 'card-resize-handle';
        grip.setAttribute('aria-label', 'Drag to toggle full width');
        grip.textContent = '⊿';
        card.appendChild(grip);

        let startX = 0;
        let hasMoved = false;

        grip.addEventListener('pointerdown', e => {
            e.preventDefault();
            startX = e.clientX;
            hasMoved = false;
            grip.setPointerCapture(e.pointerId);
        });

        grip.addEventListener('pointermove', e => {
            if (Math.abs(e.clientX - startX) > 5) hasMoved = true;
        });

        grip.addEventListener('pointerup', e => {
            if (!hasMoved) return;
            const dx = e.clientX - startX;
            const isFullWidth = cardLayout.fullWidth.includes(card.id);
            if (!isFullWidth && dx >= RESIZE_THRESHOLD) {
                toggleCardFullWidth(card.id);
            } else if (isFullWidth && dx <= -RESIZE_THRESHOLD) {
                toggleCardFullWidth(card.id);
            }
        });

        grip.addEventListener('pointercancel', () => { hasMoved = false; });
    });

    // Column count stepper (desktop only — hidden below 700px via CSS)
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

// ─── CARD COLLAPSE ───────────────────────────────────────────────────────────
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

// ─── SERVICE WORKER REGISTRATION ─────────────────────────────────────────────
// Registers the service worker so the app works offline and can be installed.
// Runs on 'load' so SW registration doesn't compete with audio/UI startup work.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
            .then(reg => reg.update())
            .catch(err => console.warn('Service worker registration failed:', err));
    });
}
