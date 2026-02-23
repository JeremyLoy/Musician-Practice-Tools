import { initDict } from './dict.js';
import { initTuner } from './tuner.js';
import { initRecorder } from './recorder.js';
import { initMetronome } from './metronome.js';

// ─── VERSION ─────────────────────────────────────────────────
// Keep in sync with CACHE_VERSION in sw.js. Format: YYYYMMDD-HHMM (24h UTC).
const APP_VERSION = 'toolkit-20260223-1500';

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
let wakeLock = null;
async function updateWakeLock() {
    const audioActive = droneState?.running || metroRunning || recorderRunning || tunerRunning;
    if (audioActive && !wakeLock && 'wakeLock' in navigator) {
        try { wakeLock = await navigator.wakeLock.request('screen'); }
        catch(e) { /* permission denied or not supported — silently ignore */ }
    } else if (!audioActive && wakeLock) {
        try { wakeLock.release(); } catch(e) {}
        wakeLock = null;
    }
}

// ─── AUDIO CONTEXT ───────────────────────────────────────────
let audioCtx, db;
const getCtx = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') audioCtx.resume();
    return audioCtx;
};

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
        // Null out cached master gain nodes so they are recreated fresh and
        // properly reconnected to the destination after the context resumes.
        droneMaster = null;

        // Drone: oscillators are killed by the browser when the context is suspended on iOS.
        // Restart them if the drone was running.
        if (droneState.running) {
            stopDrone();
            startDrone();
        }

        // Metronome: handled by metronome module's handleVisibilityResume()
        metronome?.handleVisibilityResume();

        // Wake lock is released automatically when the page is hidden; re-acquire it.
        updateWakeLock();
    });
});

// ─── PERSISTENCE ─────────────────────────────────────────────
const PREFS_KEY = 'toolkit_prefs_v2';
function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } }
function savePrefs() {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({
            ...currentMetroPrefs,
            droneRoot: droneState.root,
            droneIntervals: [...droneState.intervals],
            droneTuning: droneState.tuning,
            droneColor: droneState.color,
            droneOctave: droneState.octave,
            droneVolume: droneState.volume,
            refA
        }));
    } catch(e) {}
}

// ─── INDEXEDDB ───────────────────────────────────────────────
const initDB = () => new Promise(res => {
    const req = indexedDB.open('MusiciansToolkit', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('memos', { keyPath: 'id' });
    req.onsuccess = e => { db = e.target.result; res(); };
});

// ─── DRONE DATA ───────────────────────────────────────────────
const noteNames = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
const droneRatios = [
    {n:"Uni",s:0, r:1,      f:"1/1"},   {n:"m2", s:1,  r:16/15, f:"16/15"},
    {n:"M2", s:2, r:9/8,    f:"9/8"},   {n:"m3", s:3,  r:6/5,   f:"6/5"},
    {n:"M3", s:4, r:5/4,    f:"5/4"},   {n:"P4", s:5,  r:4/3,   f:"4/3"},
    {n:"TT", s:6, r:7/5,    f:"7/5"},   {n:"P5", s:7,  r:3/2,   f:"3/2"},
    {n:"m6", s:8, r:8/5,    f:"8/5"},   {n:"M6", s:9,  r:5/3,   f:"5/3"},
    {n:"m7", s:10,r:16/9,   f:"16/9"},  {n:"M7", s:11, r:15/8,  f:"15/8"},
    {n:"Oct",s:12,r:2,      f:"2/1"}
];

// ─── DRONE STATE ──────────────────────────────────────────────
const prefs = loadPrefs();
let droneState = {
    root:     prefs.droneRoot     ?? 9,
    intervals:new Set(prefs.droneIntervals ?? [0]),
    tuning:   prefs.droneTuning   ?? 'just',
    color:    prefs.droneColor    ?? 'sine',
    running:  false,
    octave:   prefs.droneOctave   ?? 4,
    volume:   prefs.droneVolume   ?? 0.7
};
let activeOscs = [], droneMaster = null;
let refA = prefs.refA ?? prefs.droneRef ?? 440;

function getDroneMaster() {
    const ctx = getCtx();
    if (!droneMaster || droneMaster.context !== ctx) {
        droneMaster = ctx.createGain();
        droneMaster.gain.value = droneState.volume;
        droneMaster.connect(ctx.destination);
    }
    return droneMaster;
}

function getIntervalLabel() {
    return [...droneState.intervals].sort((a,b)=>a-b)
        .map(s => droneRatios.find(r=>r.s===s).n).join('+');
}

function updateDroneDebug() {
    const rootFreq = (refA * Math.pow(2,(droneState.root-9)/12)) * Math.pow(2,droneState.octave-4);
    let txt = `ROOT: ${noteNames[droneState.root]} @ ${rootFreq.toFixed(2)}Hz\nMODE: ${droneState.tuning.toUpperCase()}\n\n`;
    [...droneState.intervals].sort((a,b)=>a-b).forEach(s => {
        const iv = droneRatios.find(r=>r.s===s);
        const freq = droneState.tuning==='equal' ? rootFreq*Math.pow(2,s/12) : rootFreq*iv.r;
        const ratio = droneState.tuning==='equal' ? `2^(${s}/12)` : `${iv.f} (${iv.r.toFixed(3)})`;
        txt += `${iv.n.padEnd(4)}: ${freq.toFixed(2)}Hz | ${ratio}\n`;
    });
    document.getElementById('debug-console').innerText = txt;
    savePrefs();
}

function startDrone() {
    updateWakeLock();
    const ctx = getCtx();
    const rootFreq = (refA * Math.pow(2,(droneState.root-9)/12)) * Math.pow(2,droneState.octave-4);
    const master = getDroneMaster();
    droneState.intervals.forEach(s => {
        const iv = droneRatios.find(r=>r.s===s);
        const f = droneState.tuning==='equal' ? rootFreq*Math.pow(2,s/12) : rootFreq*iv.r;
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = droneState.color;
        osc.frequency.setValueAtTime(f, ctx.currentTime);
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.15, ctx.currentTime+0.12);
        osc.connect(g).connect(master);
        osc.start();
        activeOscs.push({osc, g});
    });
}

const stopDrone = () => {
    const ctx = getCtx();
    activeOscs.forEach(n => {
        try { n.g.gain.linearRampToValueAtTime(0, ctx.currentTime+0.1); } catch(e){}
        setTimeout(() => { try { n.osc.stop(); } catch(e){} }, 150);
    });
    activeOscs = [];
    updateWakeLock();
};

const droneSync = () => { updateDroneDebug(); if(droneState.running){ stopDrone(); startDrone(); } };

// Build root grid
noteNames.forEach((n,i) => {
    const b = document.createElement('button');
    b.className='btn-toggle'; b.textContent=n;
    if(i===droneState.root) b.classList.add('active');
    b.onclick = () => {
        document.querySelectorAll('#rootGrid .btn-toggle').forEach(x=>x.classList.remove('active'));
        b.classList.add('active'); droneState.root=i; droneSync();
    };
    document.getElementById('rootGrid').appendChild(b);
});

// Build interval grid
droneRatios.forEach(rt => {
    const b = document.createElement('button');
    b.className='btn-toggle'; b.textContent=rt.n;
    if(droneState.intervals.has(rt.s)) b.classList.add('active');
    b.onclick = () => {
        if(droneState.intervals.has(rt.s) && droneState.intervals.size>1) {
            droneState.intervals.delete(rt.s); b.classList.remove('active');
        } else {
            droneState.intervals.add(rt.s); b.classList.add('active');
        }
        droneSync();
    };
    document.getElementById('intervalGrid').appendChild(b);
});

document.getElementById('droneToggle').onclick = function() {
    droneState.running = !droneState.running;
    if(droneState.running){ startDrone(); this.textContent='🎵 Stop Drone'; this.classList.add('is-active'); }
    else { stopDrone(); this.textContent='🎵 Start Drone'; this.classList.remove('is-active'); }
};

document.getElementById('droneClear').onclick = () => {
    droneState.intervals = new Set([0]);
    document.querySelectorAll('#intervalGrid .btn-toggle').forEach((b,i)=>b.classList.toggle('active',i===0));
    droneSync();
};

// Restore saved values
const droneRefVal   = document.getElementById('droneRefVal');
const droneOctaveInput = document.getElementById('droneOctave');
const droneOctaveVal   = document.getElementById('droneOctaveVal');

droneRefVal.textContent = refA;
droneOctaveInput.value = droneState.octave;
droneOctaveVal.textContent = droneState.octave;

document.getElementById('droneRefMinus').onclick = () => {
    refA = Math.max(400, refA - 1);
    droneRefVal.textContent = refA;
    document.getElementById('tunerRefVal').textContent = refA;
    droneSync(); savePrefs();
};
document.getElementById('droneRefPlus').onclick = () => {
    refA = Math.min(480, refA + 1);
    droneRefVal.textContent = refA;
    document.getElementById('tunerRefVal').textContent = refA;
    droneSync(); savePrefs();
};
document.getElementById('droneOctaveMinus').onclick = () => {
    const v = Math.max(1, (parseInt(droneOctaveInput.value)||4) - 1);
    droneOctaveInput.value = v; droneOctaveVal.textContent = v; droneState.octave=v; droneSync();
};
document.getElementById('droneOctavePlus').onclick = () => {
    const v = Math.min(6, (parseInt(droneOctaveInput.value)||4) + 1);
    droneOctaveInput.value = v; droneOctaveVal.textContent = v; droneState.octave=v; droneSync();
};

// Volume slider
document.getElementById('droneVolume').value = droneState.volume;
document.getElementById('droneVolume').oninput = e => {
    droneState.volume = parseFloat(e.target.value);
    if(droneMaster) droneMaster.gain.value = droneState.volume;
    savePrefs();
};

// Tuning + wave switches — restore saved state
['tuningSwitch','colorSwitch'].forEach(id => {
    const key = id==='tuningSwitch' ? 'tuning' : 'color';
    document.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle('active', b.dataset.val===droneState[key]));
    document.getElementById(id).onclick = e => {
        if(e.target.tagName!=='BUTTON') return;
        document.querySelectorAll(`#${id} button`).forEach(b=>b.classList.remove('active'));
        e.target.classList.add('active');
        droneState[key]=e.target.dataset.val; droneSync();
    };
});

// Details toggle
const detailsBtn = document.getElementById('detailsToggle');
const debugEl    = document.getElementById('debug-console');
detailsBtn.onclick = () => {
    const open = debugEl.style.display !== 'none';
    debugEl.style.display = open ? 'none' : 'block';
    detailsBtn.textContent = open ? '🔬 Show Details' : '🔬 Hide Details';
};

let metroRunning = false;
let currentMetroPrefs = {};
let metronome = null;
let tuner = null;
let recorderRunning = false;
let tunerRunning = false;

document.getElementById('app-version-footer').textContent = APP_VERSION;

// ─── INIT ────────────────────────────────────────────────────
initDB().then(()=>{
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
    droneSync();
    initRecorder({
        db,
        getCtx,
        onRecordingChange: (v) => { recorderRunning = v; updateWakeLock(); }
    });
    initDict();
    tuner = initTuner({
        getCtx,
        getRefA: () => refA,
        onRefAChange: (newVal) => {
            refA = newVal;
            document.getElementById('droneRefVal').textContent = newVal;
            droneSync(); savePrefs();
        },
        onRunningChange: (isRunning) => { tunerRunning = isRunning; updateWakeLock(); }
    });
});

// ─── SERVICE WORKER REGISTRATION ─────────────────────────────────────────────
// Registers the service worker so the app works offline and can be installed.
// Runs on 'load' so SW registration doesn't compete with audio/UI startup work.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
            .then(reg => reg.update())
            .catch(err => console.warn('Service worker registration failed:', err));
    });
}
