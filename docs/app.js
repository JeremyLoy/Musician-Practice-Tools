import DICT from './dictionary.js';

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
    const audioActive = droneState?.running || metroRunning || recorder?.state === 'recording' || tunerRunning;
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
        if (tunerRunning) stopTuner();
        return;
    }
    if (!audioCtx) return;

    audioCtx.resume().then(() => {
        // Null out cached master gain nodes so they are recreated fresh and
        // properly reconnected to the destination after the context resumes.
        droneMaster = null;
        metroMaster = null;

        // Drone: oscillators are killed by the browser when the context is suspended on iOS.
        // Restart them if the drone was running.
        if (droneState.running) {
            stopDrone();
            startDrone();
        }

        // Metronome: nextBeat will be far in the past after a long background gap.
        // Reset it to now so the scheduler doesn't flood with catch-up beats.
        if (metroRunning) {
            clearTimeout(schedTimer);
            pulseIndex = 0;
            nextBeat = audioCtx.currentTime;
            sched();
        }

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
            bpm, meter, metroSound, metroLight,
            metroVolume, clickSound,
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

// ─── METRONOME STATE ──────────────────────────────────────────
let bpm         = prefs.bpm         ?? 120;
let metroSound  = prefs.metroSound  ?? true;
let metroLight  = prefs.metroLight  ?? true;
let metroVolume = prefs.metroVolume ?? 0.7;
let clickSound  = prefs.clickSound  ?? 'clave';
const DEFAULT_METER = { groups:[1,1,1,1], denom:4, subdivision:1 };
let meter = Object.assign({}, DEFAULT_METER, prefs.meter ?? {});
meter.groups = Array.isArray(meter.groups) ? meter.groups : DEFAULT_METER.groups;
let metroRunning=false, nextBeat=0, schedTimer, pulseIndex=0;
let schedPulses=[], totalPulses=0;
let metroMaster = null;

function getMetroMaster() {
    const ctx = getCtx();
    if (!metroMaster || metroMaster.context !== ctx) {
        metroMaster = ctx.createGain();
        metroMaster.gain.value = metroVolume;
        metroMaster.connect(ctx.destination);
    }
    return metroMaster;
}

const bpmDisplay = document.getElementById('bpm-display');
const bpmInput   = document.getElementById('bpm-input');
const metroCard  = document.getElementById('metro-card');
const wheelEl    = document.getElementById('wheel');

const updateBPMDisplay = v => {
    bpm = Math.min(Math.max(v,40),280);
    bpmDisplay.textContent = bpm;
    bpmInput.value = bpm;
    wheelEl.style.transform = `rotate(${bpm*1.5}deg)`;
};
const updateBPM = v => { updateBPMDisplay(v); buildSchedule(); savePrefs(); };

bpmDisplay.onclick = () => { bpmDisplay.style.display='none'; bpmInput.style.display='block'; bpmInput.focus(); };
bpmInput.onblur   = () => { updateBPM(parseInt(bpmInput.value)||120); bpmInput.style.display='none'; bpmDisplay.style.display='block'; };
bpmInput.onkeydown = e => { if(e.key==='Enter') bpmInput.blur(); };
document.getElementById('bpmMinus').onclick = () => updateBPM(bpm-1);
document.getElementById('bpmPlus').onclick  = () => updateBPM(bpm+1);

// Metro volume slider
document.getElementById('metroVolume').value = metroVolume;
document.getElementById('metroVolume').oninput = e => {
    metroVolume = parseFloat(e.target.value);
    if(metroMaster) metroMaster.gain.value = metroVolume;
    savePrefs();
};

// ─── TIME SIGNATURE TEXT INPUT ────────────────────────────────
function meterToString(m) {
    const n = m.groups.reduce((a,b)=>a+b, 0);
    return `${n}/${m.denom}`;
}

function parseTsInput(str) {
    const m = str.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) return null;
    const n = parseInt(m[1]), d = parseInt(m[2]);
    if (n < 1 || n > 32 || d < 1 || d > 64) return null;
    return { groups: Array(n).fill(1), denom: d };
}

const tsInput = document.getElementById('tsInput');
tsInput.value = meterToString(meter);

function commitTsInput() {
    const parsed = parseTsInput(tsInput.value);
    if (parsed) {
        tsInput.classList.remove('error');
        tsInput.value = `${parsed.groups.length}/${parsed.denom}`;
        meter.groups = parsed.groups;
        meter.denom  = parsed.denom;
        applyMeterChange();
    } else {
        tsInput.classList.add('error');
    }
}

tsInput.addEventListener('blur', commitTsInput);
tsInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { tsInput.blur(); }
    if (e.key === 'Escape') { tsInput.value = meterToString(meter); tsInput.classList.remove('error'); tsInput.blur(); }
});
tsInput.addEventListener('input', () => {
    if (tsInput.classList.contains('error') && parseTsInput(tsInput.value)) {
        tsInput.classList.remove('error');
    }
});

// ─── SUBDIVISION ──────────────────────────────────────────────
document.querySelectorAll('#subdivCtrl button').forEach(b=>
    b.classList.toggle('active', parseInt(b.dataset.val)===meter.subdivision));
document.getElementById('subdivCtrl').onclick = e => {
    if(e.target.tagName!=='BUTTON') return;
    document.querySelectorAll('#subdivCtrl button').forEach(b=>b.classList.remove('active'));
    e.target.classList.add('active');
    meter.subdivision=parseInt(e.target.dataset.val);
    applyMeterChange();
};

// ─── CLICK SOUND ─────────────────────────────────────────────
document.querySelectorAll('#clickSoundCtrl button').forEach(b=>b.classList.toggle('active',b.dataset.val===clickSound));
document.getElementById('clickSoundCtrl').onclick = e => {
    if(e.target.tagName!=='BUTTON') return;
    document.querySelectorAll('#clickSoundCtrl button').forEach(b=>b.classList.remove('active'));
    e.target.classList.add('active');
    clickSound=e.target.dataset.val; savePrefs();
};

// ─── CLICK SOUNDS ────────────────────────────────────────────
function playClave(atTime, isAccent) {
    const ctx = getCtx(), SR = ctx.sampleRate, out = getMetroMaster();
    const vol = isAccent ? 1.0 : 0.60, freq = isAccent ? 2750 : 2450;
    const body = ctx.createOscillator(), bG = ctx.createGain();
    body.type='sine';
    body.frequency.setValueAtTime(freq, atTime);
    body.frequency.exponentialRampToValueAtTime(freq*0.87, atTime+0.045);
    bG.gain.setValueAtTime(vol*0.6, atTime);
    bG.gain.exponentialRampToValueAtTime(0.001, atTime+0.045);
    body.connect(bG).connect(out); body.start(atTime); body.stop(atTime+0.055);

    const cLen=Math.floor(SR*0.013), nbuf=ctx.createBuffer(1,cLen,SR);
    const nd=nbuf.getChannelData(0); for(let i=0;i<cLen;i++) nd[i]=Math.random()*2-1;
    const noise=ctx.createBufferSource(); noise.buffer=nbuf;
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=3100; bp.Q.value=1.3;
    const cG=ctx.createGain();
    cG.gain.setValueAtTime(vol*0.48, atTime); cG.gain.exponentialRampToValueAtTime(0.001, atTime+0.013);
    noise.connect(bp).connect(cG).connect(out); noise.start(atTime); noise.stop(atTime+0.016);

    const res=ctx.createOscillator(), rG=ctx.createGain();
    res.type='sine'; res.frequency.setValueAtTime(3700, atTime);
    rG.gain.setValueAtTime(vol*0.18, atTime); rG.gain.exponentialRampToValueAtTime(0.001, atTime+0.022);
    res.connect(rG).connect(out); res.start(atTime); res.stop(atTime+0.028);
}

function playClick(atTime, isAccent) {
    // Mechanical metronome click: sharp sine with very fast decay
    const ctx = getCtx(), out = getMetroMaster();
    const vol = isAccent ? 1.0 : 0.65, freq = isAccent ? 1200 : 900;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(freq, atTime);
    o.frequency.exponentialRampToValueAtTime(freq*0.5, atTime+0.018);
    g.gain.setValueAtTime(vol*0.4, atTime);
    g.gain.exponentialRampToValueAtTime(0.001, atTime+0.018);
    const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=2200;
    o.connect(lp).connect(g).connect(out); o.start(atTime); o.stop(atTime+0.022);
}

function playRim(atTime, isAccent) {
    // Snare rim shot: noise filtered to midrange with sharp transient
    const ctx = getCtx(), SR = ctx.sampleRate, out = getMetroMaster();
    const vol = isAccent ? 1.0 : 0.6;
    const dur = isAccent ? 0.055 : 0.04;
    const len = Math.floor(SR * dur);
    const buf = ctx.createBuffer(1, len, SR);
    const d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = (Math.random()*2-1) * Math.exp(-i/(len*0.3));
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value = isAccent ? 900 : 700; hp.Q.value=2;
    const bp = ctx.createBiquadFilter(); bp.type='peaking'; bp.frequency.value=2500; bp.gain.value=8;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol*0.9, atTime);
    src.connect(hp).connect(bp).connect(g).connect(out);
    src.start(atTime); src.stop(atTime+dur+0.01);
    // Add a ping for the accent
    if(isAccent) {
        const ping=ctx.createOscillator(), pg=ctx.createGain();
        ping.type='sine'; ping.frequency.setValueAtTime(1600, atTime);
        pg.gain.setValueAtTime(0.3, atTime); pg.gain.exponentialRampToValueAtTime(0.001, atTime+0.03);
        ping.connect(pg).connect(out); ping.start(atTime); ping.stop(atTime+0.035);
    }
}

function playCowbell(atTime, isAccent) {
    // Classic cowbell: two detuned square waves + metal resonance
    const ctx = getCtx(), out = getMetroMaster();
    const vol = isAccent ? 1.0 : 0.62;
    const dur = isAccent ? 0.28 : 0.18;
    [[562, 1], [845, 0.6]].forEach(([f, fvol]) => {
        const o=ctx.createOscillator(), g=ctx.createGain();
        o.type='square'; o.frequency.value=f;
        const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=f*1.4; bp.Q.value=0.8;
        g.gain.setValueAtTime(vol*fvol*0.3, atTime);
        g.gain.exponentialRampToValueAtTime(0.001, atTime+dur);
        o.connect(bp).connect(g).connect(out); o.start(atTime); o.stop(atTime+dur+0.01);
    });
    // Metal click transient
    const o2=ctx.createOscillator(), g2=ctx.createGain();
    o2.type='triangle'; o2.frequency.setValueAtTime(3500, atTime); o2.frequency.exponentialRampToValueAtTime(1800, atTime+0.015);
    g2.gain.setValueAtTime(vol*0.5, atTime); g2.gain.exponentialRampToValueAtTime(0.001, atTime+0.015);
    o2.connect(g2).connect(out); o2.start(atTime); o2.stop(atTime+0.02);
}

function playBeat(atTime, isAccent) {
    if(clickSound==='clave')   playClave(atTime, isAccent);
    else if(clickSound==='click') playClick(atTime, isAccent);
    else if(clickSound==='rim')   playRim(atTime, isAccent);
    else if(clickSound==='cowbell') playCowbell(atTime, isAccent);
}

function playSubdiv(atTime) {
    const ctx = getCtx(), out = getMetroMaster();
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type='sine'; o.frequency.value=1900;
    g.gain.setValueAtTime(0.11, atTime);
    g.gain.exponentialRampToValueAtTime(0.001, atTime+0.02);
    o.connect(g).connect(out);
    o.start(atTime); o.stop(atTime+0.025);
}

const viewportFlash = document.getElementById('viewport-flash');
function triggerFlash(atTime, isAccent) {
    const delay = Math.max(0, (atTime-getCtx().currentTime)*1000);
    const dur = isAccent ? 130 : 80;
    setTimeout(() => {
        wheelEl.classList.add('beat-flash');
        metroCard.classList.add('beat-flash');
        viewportFlash.classList.add('beat-flash');
        if(isAccent) viewportFlash.classList.add('accent');
        setTimeout(() => {
            wheelEl.classList.remove('beat-flash');
            metroCard.classList.remove('beat-flash');
            viewportFlash.classList.remove('beat-flash');
            viewportFlash.classList.remove('accent');
        }, dur);
    }, delay);
}

function buildSchedule() {
    schedPulses = [];
    // Each beat takes 60/bpm seconds; the denominator is notation-only and doesn't affect timing
    const beatSec = 60 / bpm;
    meter.groups.forEach(groupSize => {
        const groupDurSec = groupSize * beatSec;
        const subDur = groupDurSec / meter.subdivision;
        for(let s=0; s<meter.subdivision; s++) {
            schedPulses.push({ isGroupBeat: s===0, subDur });
        }
    });
    totalPulses = schedPulses.length;
}

function applyMeterChange() {
    buildSchedule();
    if(metroRunning) { pulseIndex=0; nextBeat=getCtx().currentTime; }
    savePrefs();
}

function sched() {
    const ctx = getCtx();
    while(nextBeat < ctx.currentTime+0.1) {
        const pulse = schedPulses[pulseIndex % totalPulses];
        const isDownbeat = (pulseIndex % totalPulses === 0);
        if(metroSound) {
            if(pulse.isGroupBeat) playBeat(nextBeat, isDownbeat);
            else                  playSubdiv(nextBeat);
        }
        if(metroLight && pulse.isGroupBeat) triggerFlash(nextBeat, isDownbeat);
        pulseIndex++;
        nextBeat += pulse.subDur;
    }
    schedTimer = setTimeout(sched, 25);
}

function updateMetroBtn() {
    const btn=document.getElementById('metroStartBtn');
    if(!btn) return;
    if(metroRunning){ btn.innerHTML='■<br>Stop'; btn.classList.add('is-active'); }
    else { btn.innerHTML='▶<br>Start'; btn.classList.remove('is-active'); }
}
function startMetro() {
    if(metroRunning) return;
    metroRunning=true; pulseIndex=0;
    buildSchedule();
    nextBeat=getCtx().currentTime; sched();
    updateMetroBtn();
    updateWakeLock();
}
function stopMetro() {
    if(!metroRunning) return;
    metroRunning=false; clearTimeout(schedTimer);
    wheelEl.classList.remove('beat-flash');
    metroCard.classList.remove('beat-flash');
    viewportFlash.classList.remove('beat-flash');
    viewportFlash.classList.remove('accent');
    updateMetroBtn();
    updateWakeLock();
}
// Restore output toggle states
if(metroSound) document.getElementById('soundToggle').classList.add('active');
if(metroLight) document.getElementById('lightToggle').classList.add('active');

document.getElementById('soundToggle').onclick = function() {
    if(metroSound && !metroLight) return; // can't turn off last active mode
    metroSound=!metroSound; this.classList.toggle('active',metroSound); savePrefs();
};
document.getElementById('lightToggle').onclick = function() {
    if(metroLight && !metroSound) return; // can't turn off last active mode
    metroLight=!metroLight; this.classList.toggle('active',metroLight); savePrefs();
};
document.getElementById('metroStartBtn').onclick = function() {
    if(metroRunning) { stopMetro(); }
    else { startMetro(); }
    savePrefs();
};

// Tap tempo
let tapTimes=[], tapResetTimer=null;
document.getElementById('tapBtn').onclick = () => {
    const now=performance.now();
    clearTimeout(tapResetTimer);
    if(tapTimes.length && now-tapTimes[tapTimes.length-1]>2000) tapTimes=[];
    tapTimes.push(now);
    if(tapTimes.length>=2) {
        const gaps=tapTimes.slice(1).map((t,i)=>t-tapTimes[i]);
        updateBPM(Math.round(60000/(gaps.reduce((a,b)=>a+b)/gaps.length)));
        if(metroRunning){ clearTimeout(schedTimer); beatCount=0; nextBeat=getCtx().currentTime; sched(); }
    }
    if(tapTimes.length>8) tapTimes=tapTimes.slice(-8);
    tapResetTimer=setTimeout(()=>{ tapTimes=[]; },2000);
};

// Wheel drag
(function(){
    const outer=wheelEl.parentElement;
    let dragging=false, lastAngle=0, fracBpm=0;
    const getAngle=e=>{
        const r=outer.getBoundingClientRect();
        const px=e.touches?e.touches[0].clientX:e.clientX;
        const py=e.touches?e.touches[0].clientY:e.clientY;
        return Math.atan2(py-(r.top+r.height/2), px-(r.left+r.width/2))*(180/Math.PI);
    };
    const onMove=e=>{
        if(!dragging)return;
        const angle=getAngle(e);
        let d=angle-lastAngle; lastAngle=angle;
        if(d>180)d-=360; if(d<-180)d+=360;
        fracBpm+=d/1.5;
        const whole=Math.trunc(fracBpm);
        if(whole!==0){ updateBPMDisplay(bpm+whole); fracBpm-=whole; }
    };
    const onEnd=()=>{
        if(!dragging)return;
        dragging=false; wheelEl.style.cursor='grab';
        fracBpm=0;
        if(metroRunning){ buildSchedule(); pulseIndex=0; nextBeat=getCtx().currentTime; }
        savePrefs();
    };
    wheelEl.addEventListener('mousedown',e=>{ e.preventDefault(); dragging=true; lastAngle=getAngle(e); fracBpm=0; wheelEl.style.cursor='grabbing'; });
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onEnd);
    wheelEl.addEventListener('touchstart',e=>{ e.preventDefault(); dragging=true; lastAngle=getAngle(e); fracBpm=0; },{passive:false});
    window.addEventListener('touchmove',e=>{ if(!dragging)return; e.preventDefault(); onMove(e); },{passive:false});
    window.addEventListener('touchend',onEnd);
})();

// ─── RECORDER ────────────────────────────────────────────────
let recorder, chunks=[], liveAnimFrame=null, liveAnalyser=null, memoUrls=[];

// ── Pick the best supported MIME type for this browser ──────────────────
// iOS Safari only supports audio/mp4; Chrome/Firefox prefer audio/webm
function getSupportedMimeType() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', ''];
    return types.find(t => !t || MediaRecorder.isTypeSupported(t)) || '';
}

function mimeToExt(mime) {
    if(mime.includes('mp4')) return 'mp4';
    if(mime.includes('ogg')) return 'ogg';
    return 'webm';
}

function drawLiveWaveform() {
    const canvas=document.getElementById('liveWaveform');
    const c2d=canvas.getContext('2d');
    canvas.width=canvas.offsetWidth;
    const buf=new Uint8Array(liveAnalyser.fftSize);
    (function draw(){
        if(!liveAnalyser) return;
        liveAnimFrame=requestAnimationFrame(draw);
        liveAnalyser.getByteTimeDomainData(buf);
        c2d.clearRect(0,0,canvas.width,canvas.height);
        c2d.strokeStyle='#22c55e'; c2d.lineWidth=2;
        c2d.beginPath();
        const sw=canvas.width/buf.length; let x=0;
        for(let i=0;i<buf.length;i++){
            const y=(buf[i]/128)*canvas.height/2;
            i===0?c2d.moveTo(x,y):c2d.lineTo(x,y); x+=sw;
        }
        c2d.lineTo(canvas.width,canvas.height/2); c2d.stroke();
    })();
}

function stopLiveWaveform() {
    if(liveAnimFrame){ cancelAnimationFrame(liveAnimFrame); liveAnimFrame=null; }
    liveAnalyser=null;
    const canvas=document.getElementById('liveWaveform');
    canvas.style.display='none';
    canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
}

function getAutoName() {
    const now=new Date();
    const d=now.toLocaleDateString([],{month:'short',day:'numeric'});
    const t=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    return `${d} ${t}`;
}

document.getElementById('recordToggle').onclick = async function() {
    if(recorder?.state==='recording') {
        recorder.stop(); stopLiveWaveform();
        this.textContent='🎙️ Start Recording'; this.classList.remove('is-active');
        document.getElementById('rec-status').textContent='';
        updateWakeLock();
        return;
    }
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const autoName=getAutoName();
    const mimeType=getSupportedMimeType();
    const recOpts=mimeType ? {mimeType} : {};
    recorder=new MediaRecorder(stream, recOpts); chunks=[];
    recorder.ondataavailable=e=>{ if(e.data.size>0) chunks.push(e.data); };
    recorder.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());
        const actualMime=recorder.mimeType||mimeType||'audio/webm';
        const blob=new Blob(chunks,{type:actualMime});
        const item={id:Date.now().toString(), blob, mimeType:actualMime, ts:Date.now(), name:autoName};
        const tx=db.transaction('memos','readwrite');
        tx.objectStore('memos').put(item);
        tx.oncomplete=renderMemos;
    };
    // iOS: resume AudioContext before creating source (requires user gesture — we're inside one)
    const ctx=getCtx();
    liveAnalyser=ctx.createAnalyser(); liveAnalyser.fftSize=2048;
    ctx.createMediaStreamSource(stream).connect(liveAnalyser);
    const canvas=document.getElementById('liveWaveform');
    canvas.style.display='block'; drawLiveWaveform();
    // timeslice=250ms ensures data flows on iOS (which may not fire ondataavailable without it)
    recorder.start(250);
    this.textContent='⏹️ Stop Recording'; this.classList.add('is-active');
    document.getElementById('rec-status').textContent='● Recording...';
    updateWakeLock();
};

function saveMemoName(m, name) {
    m.name=name.trim()||m.name;
    const tx=db.transaction('memos','readwrite');
    tx.objectStore('memos').put(m);
}

function renderMemos() {
    memoUrls.forEach(u => URL.revokeObjectURL(u)); memoUrls=[];
    const list=document.getElementById('memoList'); list.innerHTML='';
    db.transaction('memos').objectStore('memos').getAll().onsuccess=e=>{
        e.target.result.sort((a,b)=>b.ts-a.ts).forEach(m=>{
            const mime=m.mimeType||(m.blob&&m.blob.type)||'audio/webm';
            const ext=mimeToExt(mime);
            // Create a correctly-typed blob URL — critical for iOS to decode it
            const typedBlob=new Blob([m.blob],{type:mime});
            const url=URL.createObjectURL(typedBlob); memoUrls.push(url);
            const label=m.name||`Memo — ${new Date(m.ts).toLocaleString()}`;
            const d=document.createElement('div'); d.className='recording-item';
            d.innerHTML=`
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <strong id="lbl-${m.id}" style="flex:1;cursor:text;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="Click to rename">${label}</strong>
                    <input id="inp-${m.id}" type="text"
                        style="display:none;flex:1;background:var(--bg);border:1px solid var(--primary);color:var(--text);border-radius:6px;padding:4px 8px;font-size:0.95rem;font-weight:700;outline:none;min-width:0;">
                    <button class="secondary" id="ren-${m.id}" style="padding:0.6rem 0.8rem;font-size:0.85rem;flex-shrink:0;min-width:44px;min-height:44px;">✏️</button>
                </div>
                <div id="w-${m.id}" class="wf-box"></div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
                    <button class="main-action" id="p-${m.id}">▶ Play</button>
                    <button class="secondary" id="dl-${m.id}">⬇ Export</button>
                    <button class="secondary" onclick="deleteMemo('${m.id}')">🗑 Delete</button>
                </div>`;
            list.appendChild(d);

            // Use MediaElement backend: lets the browser's native <audio> handle decoding,
            // which is the only reliable approach on iOS Safari for blob URLs.
            const ws=WaveSurfer.create({
                container:`#w-${m.id}`,
                waveColor:'#475569',
                progressColor:'#22c55e',
                backend:'MediaElement',
                url
            });
            const pb=document.getElementById(`p-${m.id}`);
            ws.on('play',()=>pb.textContent='⏸ Pause');
            ws.on('pause',()=>pb.textContent='▶ Play');
            ws.on('finish',()=>pb.textContent='▶ Play');
            // iOS: playPause must be triggered directly from user tap (already is via onclick)
            pb.onclick=()=>ws.playPause();

            document.getElementById(`dl-${m.id}`).onclick=()=>{
                const a=document.createElement('a'); a.href=url;
                a.download=`${(m.name||'memo').replace(/[^\w\s\-]/g,'_').trim()}.${ext}`;
                a.click();
            };

            const lbl=document.getElementById(`lbl-${m.id}`);
            const inp=document.getElementById(`inp-${m.id}`);
            const ren=document.getElementById(`ren-${m.id}`);
            let renaming=false;

            function enterRename() {
                renaming=true; inp.value=lbl.textContent;
                lbl.style.display='none'; inp.style.display='block';
                ren.textContent='✓'; inp.focus(); inp.select();
            }
            function commitRename() {
                if(!renaming) return; renaming=false;
                const n=inp.value.trim()||lbl.textContent;
                lbl.textContent=n; lbl.style.display='';
                inp.style.display='none'; ren.textContent='✏️';
                saveMemoName(m,n);
            }
            ren.onclick=()=>renaming?commitRename():enterRename();
            lbl.onclick=enterRename;
            inp.onblur=()=>setTimeout(commitRename,80);
            inp.onkeydown=e=>{ if(e.key==='Enter')commitRename(); if(e.key==='Escape'){renaming=false;inp.style.display='none';lbl.style.display='';ren.textContent='✏️';} };
        });
    };
}

window.deleteMemo = id => {
    if(!confirm('Delete this memo?')) return;
    const tx=db.transaction('memos','readwrite');
    tx.objectStore('memos').delete(id);
    tx.oncomplete=renderMemos;
};

// ─── CHROMATIC TUNER ─────────────────────────────────────────
const TUNER_NOTES = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const TUNER_BUF_SIZE  = 8;   // rolling median window (~133 ms @ 60 fps)
const TUNER_NOTE_HOLD = 3;   // consecutive agreeing medians before note label switches
let tunerRunning  = false;
let tunerStream   = null;
let tunerSource   = null;
let tunerAnalyser = null;
let tunerRafId    = null;
let tunerFreqBuf  = [];      // raw Hz rolling buffer
let tunerLastMidi = null;    // midi of currently displayed note
let tunerNoteCandidateMidi  = null;
let tunerNoteCandidateCount = 0;

function tunerDetectPitch(analyser, sampleRate) {
    const bufLen = analyser.fftSize;
    const buf = new Float32Array(bufLen);
    analyser.getFloatTimeDomainData(buf);

    // RMS silence gate
    let rms = 0;
    for (let i = 0; i < bufLen; i++) rms += buf[i] * buf[i];
    if (Math.sqrt(rms / bufLen) < 0.01) return null;

    // Lag range: 60 Hz – 2000 Hz
    const minLag = Math.floor(sampleRate / 2000);
    const maxLag = Math.floor(sampleRate / 60);

    // Normalized autocorrelation (NSDF).
    // Strategy: compute all NSDF values, find the global maximum, then take the
    // FIRST local maximum that is at least 80% of that global max. This correctly
    // picks the fundamental period: the 2nd harmonic produces a larger NSDF peak
    // at 2× the lag, but the fundamental has the first significant peak.
    const nsdfVals = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
        let corr = 0, norm = 0;
        for (let i = 0; i < bufLen - lag; i++) {
            corr += buf[i] * buf[i + lag];
            norm += buf[i] * buf[i] + buf[i + lag] * buf[i + lag];
        }
        nsdfVals[lag] = norm > 0 ? (2 * corr / norm) : 0;
    }
    // Find global max
    let globalMax = 0;
    for (let lag = minLag; lag <= maxLag; lag++) if (nsdfVals[lag] > globalMax) globalMax = nsdfVals[lag];
    if (globalMax < 0.75) return null; // reject low-confidence / silent frames

    // Find the first local maximum >= 80% of globalMax (the fundamental)
    const threshold = globalMax * 0.8;
    let bestLag = -1;
    for (let lag = minLag + 1; lag < maxLag; lag++) {
        if (nsdfVals[lag] >= threshold &&
            nsdfVals[lag] >= nsdfVals[lag - 1] &&
            nsdfVals[lag] >= nsdfVals[lag + 1]) {
            bestLag = lag;
            break;
        }
    }
    if (bestLag === -1) return null;

    // Parabolic interpolation using the same NSDF values used to find the peak,
    // so the interpolated offset is consistent with how bestLag was selected.
    const y1 = nsdfVals[bestLag - 1];
    const y2 = nsdfVals[bestLag];
    const y3 = nsdfVals[bestLag + 1];
    const denom = 2 * (2 * y2 - y1 - y3);
    const refined = denom !== 0 ? bestLag + (y1 - y3) / denom : bestLag;
    return sampleRate / refined;
}

function tunerFreqToNoteInfo(freq, overrideMidi = null) {
    const midi       = overrideMidi ?? Math.round(69 + 12 * Math.log2(freq / refA));
    const noteName   = TUNER_NOTES[((midi % 12) + 12) % 12];
    const octave     = Math.floor(midi / 12) - 1;
    const targetFreq = refA * Math.pow(2, (midi - 69) / 12);
    const cents      = 1200 * Math.log2(freq / targetFreq);
    return { noteName, octave, cents, midi };
}

function tunerUpdateDisplay(freq, lockedMidi = null) {
    const nameEl   = document.getElementById('tunerNoteName');
    const centsEl  = document.getElementById('tunerCentsDisplay');
    const fillEl   = document.getElementById('tunerMeterFill');

    if (freq === null) {
        nameEl.innerHTML = '—';
        centsEl.textContent = '';
        centsEl.className = 'tuner-cents';
        fillEl.style.width = '0%';
        fillEl.style.left  = '50%';
        fillEl.className = 'tuner-meter-fill';
        return;
    }

    const { noteName, octave, cents } = tunerFreqToNoteInfo(freq, lockedMidi);

    // Note name: letter + optional accidental as <sup> + octave as <sub>
    const letter     = noteName.replace(/[♯♭]/g, '');
    const accidental = noteName.match(/[♯♭]/)?.[0] ?? '';
    nameEl.innerHTML = `${letter}${accidental ? `<sup>${accidental}</sup>` : ''}<sub>${octave}</sub>`;

    // Cents display
    const cr = Math.round(cents);
    centsEl.textContent = cr >= 0 ? `+${cr}¢` : `${cr}¢`;

    // Colour class
    const abs = Math.abs(cents);
    const col = abs <= 5 ? 'in-tune' : abs <= 20 ? 'near-tune' : 'out-tune';
    centsEl.className = `tuner-cents ${col}`;
    fillEl.className  = `tuner-meter-fill ${col}`;

    // Meter fill: centre at 50%, fill extends toward deviation
    const clamped = Math.max(-50, Math.min(50, cents));
    const pct     = clamped / 100 * 100; // -50 to +50 as percentage of track width
    if (cents >= 0) {
        fillEl.style.left  = '50%';
        fillEl.style.width = `${pct}%`;
    } else {
        fillEl.style.left  = `${50 + pct}%`;
        fillEl.style.width = `${-pct}%`;
    }
}

function tunerTick() {
    if (!tunerRunning || !tunerAnalyser) return;
    const raw = tunerDetectPitch(tunerAnalyser, getCtx().sampleRate);

    if (raw === null) {
        // Silence: flush buffer and clear display
        tunerFreqBuf = [];
        tunerLastMidi = null;
        tunerNoteCandidateMidi = null;
        tunerNoteCandidateCount = 0;
        tunerUpdateDisplay(null);
    } else {
        // Accumulate into rolling buffer
        tunerFreqBuf.push(raw);
        if (tunerFreqBuf.length > TUNER_BUF_SIZE) tunerFreqBuf.shift();

        // Wait for half the buffer to fill before showing anything
        if (tunerFreqBuf.length >= Math.ceil(TUNER_BUF_SIZE / 2)) {
            const sorted = [...tunerFreqBuf].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];

            // Hysteresis: only commit to a new note after TUNER_NOTE_HOLD confirmations
            const { midi } = tunerFreqToNoteInfo(median);
            if (tunerLastMidi === null) {
                // First lock — accept immediately
                tunerLastMidi = midi;
            } else if (midi !== tunerLastMidi) {
                if (midi === tunerNoteCandidateMidi) {
                    tunerNoteCandidateCount++;
                    if (tunerNoteCandidateCount >= TUNER_NOTE_HOLD) {
                        tunerLastMidi = midi;
                        tunerNoteCandidateMidi = null;
                        tunerNoteCandidateCount = 0;
                    }
                } else {
                    tunerNoteCandidateMidi = midi;
                    tunerNoteCandidateCount = 1;
                }
            }

            tunerUpdateDisplay(median, tunerLastMidi);
        }
    }

    tunerRafId = requestAnimationFrame(tunerTick);
}

function tunerUpdateBtn() {
    const btn = document.getElementById('tunerToggle');
    btn.textContent = tunerRunning ? '⏹ Stop Tuner' : '🎤 Start Tuner';
    btn.classList.toggle('is-active', tunerRunning);
}

async function startTuner() {
    const statusEl = document.getElementById('tunerStatus');
    statusEl.textContent = 'Requesting microphone…';
    statusEl.className   = 'tuner-status';
    try {
        tunerStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
    } catch (err) {
        statusEl.textContent = err.name === 'NotAllowedError'
            ? 'Microphone access denied. Please allow mic access and try again.'
            : `Microphone error: ${err.message}`;
        statusEl.className = 'tuner-status error';
        tunerRunning = false;
        tunerUpdateBtn();
        return;
    }
    const ctx      = getCtx();
    tunerSource    = ctx.createMediaStreamSource(tunerStream);
    tunerAnalyser  = ctx.createAnalyser();
    tunerAnalyser.fftSize = 4096;
    tunerAnalyser.smoothingTimeConstant = 0;
    tunerSource.connect(tunerAnalyser);
    // Not connected to ctx.destination — no audio passthrough / feedback
    statusEl.textContent = '';
    tunerRunning = true;
    tunerUpdateBtn();
    tunerTick();
    updateWakeLock();
}

function stopTuner() {
    tunerRunning = false;
    if (tunerRafId)    { cancelAnimationFrame(tunerRafId); tunerRafId = null; }
    if (tunerSource)   { try { tunerSource.disconnect(); }   catch(e) {} tunerSource = null; }
    if (tunerAnalyser) { try { tunerAnalyser.disconnect(); } catch(e) {} tunerAnalyser = null; }
    if (tunerStream)   { tunerStream.getTracks().forEach(t => t.stop()); tunerStream = null; }
    tunerFreqBuf = [];
    tunerLastMidi = null;
    tunerNoteCandidateMidi = null;
    tunerNoteCandidateCount = 0;
    tunerUpdateDisplay(null);
    tunerUpdateBtn();
    document.getElementById('tunerStatus').textContent = '';
    document.getElementById('tunerStatus').className   = 'tuner-status';
    updateWakeLock();
}

// Wire up tuner buttons
document.getElementById('tunerToggle').onclick = () => {
    tunerRunning ? stopTuner() : startTuner();
};

// Tuner A Ref stepper — syncs shared refA and drone display
document.getElementById('tunerRefVal').textContent = refA;
document.getElementById('tunerRefMinus').onclick = () => {
    refA = Math.max(400, refA - 1);
    document.getElementById('tunerRefVal').textContent  = refA;
    document.getElementById('droneRefVal').textContent  = refA;
    droneSync(); savePrefs();
};
document.getElementById('tunerRefPlus').onclick = () => {
    refA = Math.min(480, refA + 1);
    document.getElementById('tunerRefVal').textContent  = refA;
    document.getElementById('droneRefVal').textContent  = refA;
    droneSync(); savePrefs();
};

// ─── MUSICAL DICTIONARY ──────────────────────────────────────
function normStr(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function fuzzyScore(haystack, needle) {
    if (haystack.includes(needle)) return 2 + 1 / (haystack.indexOf(needle) + 1);
    let hi = 0;
    for (let i = 0; i < needle.length; i++) {
        const idx = haystack.indexOf(needle[i], hi);
        if (idx === -1) return 0;
        hi = idx + 1;
    }
    return 0.5;
}
function dictItemHTML(e) {
    return `<div class="dict-item">
            <span class="dict-term">${e.term}</span>
            <span class="dict-lang">${e.lang}</span>
            <span class="dict-def">${e.def}</span>
        </div>`;
}
function renderDict(query) {
    const q = normStr(query.trim());
    const el = document.getElementById('dictResults');
    if (!q) {
        el.innerHTML = DICT.map(dictItemHTML).join('');
        return;
    }
    const scored = DICT.flatMap(e => {
        const best = Math.max(fuzzyScore(e.normTerm, q) * 3, fuzzyScore(e.normDef, q));
        return best > 0 ? [{ e, score: best }] : [];
    });
    if (!scored.length) {
        el.innerHTML = `<div class="dict-empty">No results for "${query}"</div>`;
        return;
    }
    scored.sort((a, b) => b.score - a.score);
    el.innerHTML = scored.map(({ e }) => dictItemHTML(e)).join('');
}
document.getElementById('dictSearch').addEventListener('input', e => renderDict(e.target.value));
renderDict(''); // show all terms on load

// ─── INIT ────────────────────────────────────────────────────
initDB().then(()=>{
    updateBPM(bpm);
    droneSync();
    renderMemos();
});
