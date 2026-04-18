// @ts-check
/** @import { MetronomePrefs, MetronomeAPI, Meter } from './metronome.js' */
/** @import { TunerAPI } from './tuner.js' */
/** @import { DroneAPI, DronePrefs } from './drone.js' */
/** @import { CardsAPI } from './cards.js' */
/** @import { GridLayoutPrefs } from './grid-layout.js' */
import { initDict } from './dict.js';
import { initTuner } from './tuner.js';
import { initRecorder } from './recorder.js';
import { initMetronome } from './metronome.js';
import { initSpectrum } from './spectrum.js';
import { initDrone } from './drone.js';
import { initCards } from './cards.js';

// ─── Type Definitions ────────────────────────────────────────────────────────

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
 * @property {string[]} [collapsedCards]
 * @property {GridLayoutPrefs} [cardLayout]
 */

// ─── VERSION ─────────────────────────────────────────────────
// Keep in sync with CACHE_VERSION in sw.js. Format: YYYYMMDD-HHMM (24h UTC).
/** @type {string} */
const APP_VERSION = 'toolkit-20260417-1845';

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

/** @type {CardsAPI | null} */
let cards = null;

/** Saves all current preferences (drone, metronome, card state) to localStorage. */
function savePrefs() {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({
            ...currentMetroPrefs,
            ...currentDronePrefs,
            cardLayout: cards?.getCardLayout(),
            collapsedCards: cards?.getCollapsedCardIds() ?? [],
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
    // Initialise card layout (collapse, drag, resize, columns) before any
    // savePrefs() call so the .collapsed classes are in place when saves run.
    cards = initCards({ savePrefs, loadPrefs });
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
        onRefAChange: (newVal) => { tuner?.setRefA(newVal); },
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
    document.body.dataset.ready = '1';
});

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
