// @ts-check
// ─── DRONE MACHINE ────────────────────────────────────────────────────────────

// ─── Type Definitions ─────────────────────────────────────────────────────────

/**
 * Drone machine state.
 * @typedef {object} DroneState
 * @property {number} root - Root note as semitone index (0=C, 9=A, 11=B).
 * @property {Set<number>} intervals - Active interval semitone offsets.
 * @property {'just' | 'equal'} tuning - Tuning system.
 * @property {OscillatorType} color - Oscillator waveform type (named "color" for historical reasons).
 * @property {boolean} running - Whether the drone is currently playing.
 * @property {number} octave - Octave (1–6).
 * @property {number} volume - Volume (0–1).
 */

/**
 * Drone interval ratio entry.
 * @typedef {object} DroneRatio
 * @property {string} n - Short interval name (e.g. "P5", "m3").
 * @property {number} s - Semitone offset from root.
 * @property {number} r - Just intonation frequency ratio.
 * @property {string} f - Ratio as fraction string (e.g. "3/2").
 */

/**
 * An active drone oscillator with its gain node.
 * @typedef {object} ActiveOsc
 * @property {OscillatorNode} osc
 * @property {GainNode} g
 */

/**
 * Drone preferences for persistence.
 * @typedef {object} DronePrefs
 * @property {number} droneRoot
 * @property {number[]} droneIntervals
 * @property {string} droneTuning
 * @property {string} droneColor
 * @property {number} droneOctave
 * @property {number} droneVolume
 * @property {number} refA
 */

/**
 * Options for initializing the drone module.
 * @typedef {object} DroneInitOptions
 * @property {() => AudioContext} getCtx - Returns the shared AudioContext (creates lazily).
 * @property {(newVal: number) => void} onRefAChange - Called when the user changes the reference frequency.
 * @property {(running: boolean) => void} onRunningChange - Called when the drone starts or stops.
 * @property {(prefs: DronePrefs) => void} onPrefsChange - Called when any drone preference changes.
 * @property {DronePrefs} initialPrefs - Initial drone settings loaded from storage.
 */

/**
 * Public API returned by initDrone().
 * @typedef {object} DroneAPI
 * @property {() => void} sync - Reconciles drone state (restarts oscillators if running).
 * @property {() => boolean} isRunning - Returns whether the drone is currently playing.
 * @property {() => number} getRefA - Returns the current A4 reference frequency in Hz.
 * @property {(newVal: number) => void} setRefA - Updates the reference pitch from an external source (e.g. tuner).
 * @property {() => void} handleVisibilityResume - Re-syncs audio after the page becomes visible again.
 */

// ─── Static Data ──────────────────────────────────────────────────────────────

/** @type {readonly string[]} */
const noteNames = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];

/** @type {DroneRatio[]} */
const droneRatios = [
    {n:"Uni",s:0, r:1,      f:"1/1"},   {n:"m2", s:1,  r:16/15, f:"16/15"},
    {n:"M2", s:2, r:9/8,    f:"9/8"},   {n:"m3", s:3,  r:6/5,   f:"6/5"},
    {n:"M3", s:4, r:5/4,    f:"5/4"},   {n:"P4", s:5,  r:4/3,   f:"4/3"},
    {n:"TT", s:6, r:7/5,    f:"7/5"},   {n:"P5", s:7,  r:3/2,   f:"3/2"},
    {n:"m6", s:8, r:8/5,    f:"8/5"},   {n:"M6", s:9,  r:5/3,   f:"5/3"},
    {n:"m7", s:10,r:16/9,   f:"16/9"},  {n:"M7", s:11, r:15/8,  f:"15/8"},
    {n:"Oct",s:12,r:2,      f:"2/1"}
];

// ─── Module ───────────────────────────────────────────────────────────────────

/**
 * Initializes the drone machine, wiring up all DOM controls.
 * @param {DroneInitOptions} options
 * @returns {DroneAPI}
 */
export function initDrone({ getCtx, onRefAChange, onRunningChange, onPrefsChange, initialPrefs }) {
    /** @type {DroneState} */
    let droneState = {
        root:      initialPrefs.droneRoot,
        intervals: new Set(initialPrefs.droneIntervals),
        tuning:    /** @type {'just' | 'equal'} */ (initialPrefs.droneTuning),
        color:     /** @type {OscillatorType} */ (initialPrefs.droneColor),
        running:   false,
        octave:    initialPrefs.droneOctave,
        volume:    initialPrefs.droneVolume,
    };

    /** @type {ActiveOsc[]} */
    let activeOscs = [];
    /** @type {GainNode | null} */
    let droneMaster = null;
    let refA = initialPrefs.refA;

    /**
     * Returns the drone master gain node, creating it lazily.
     * @returns {GainNode}
     */
    function getDroneMaster() {
        const ctx = getCtx();
        if (!droneMaster || droneMaster.context !== ctx) {
            droneMaster = ctx.createGain();
            droneMaster.gain.value = droneState.volume;
            droneMaster.connect(ctx.destination);
        }
        return droneMaster;
    }

    /** Notifies app.js of current drone prefs for persistence. */
    function savePrefs() {
        onPrefsChange({
            droneRoot:      droneState.root,
            droneIntervals: [...droneState.intervals],
            droneTuning:    droneState.tuning,
            droneColor:     droneState.color,
            droneOctave:    droneState.octave,
            droneVolume:    droneState.volume,
            refA,
        });
    }

    /** Updates the debug console with current drone frequencies and ratios. */
    function updateDroneDebug() {
        const rootFreq = (refA * Math.pow(2,(droneState.root-9)/12)) * Math.pow(2,droneState.octave-4);
        let txt = `ROOT: ${noteNames[droneState.root]} @ ${rootFreq.toFixed(2)}Hz\nMODE: ${droneState.tuning.toUpperCase()}\n\n`;
        [...droneState.intervals].sort((a,b)=>a-b).forEach(s => {
            const iv = /** @type {DroneRatio} */ (droneRatios.find(r=>r.s===s));
            const freq = droneState.tuning==='equal' ? rootFreq*Math.pow(2,s/12) : rootFreq*iv.r;
            const ratio = droneState.tuning==='equal' ? `2^(${s}/12)` : `${iv.f} (${iv.r.toFixed(3)})`;
            txt += `${iv.n.padEnd(4)}: ${freq.toFixed(2)}Hz | ${ratio}\n`;
        });
        /** @type {HTMLElement} */ (document.getElementById('debug-console')).innerText = txt;
        savePrefs();
    }

    /** Creates and starts oscillators for all active drone intervals. */
    function startDrone() {
        const ctx = getCtx();
        const rootFreq = (refA * Math.pow(2,(droneState.root-9)/12)) * Math.pow(2,droneState.octave-4);
        const master = getDroneMaster();
        droneState.intervals.forEach(s => {
            const iv = /** @type {DroneRatio} */ (droneRatios.find(r=>r.s===s));
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

    /** Fades out and stops all active drone oscillators. */
    function stopDrone() {
        const ctx = getCtx();
        activeOscs.forEach(n => {
            try { n.g.gain.linearRampToValueAtTime(0, ctx.currentTime+0.1); } catch(e){}
            setTimeout(() => { try { n.osc.stop(); } catch(e){} }, 150);
        });
        activeOscs = [];
    }

    /** Reconciles drone state: updates debug display and restarts oscillators if running. */
    const droneSync = () => { updateDroneDebug(); if(droneState.running){ stopDrone(); startDrone(); } };

    // ─── DOM Bindings ─────────────────────────────────────────────────────────

    // Build root grid
    noteNames.forEach((n,i) => {
        const b = document.createElement('button');
        b.className='btn-toggle'; b.textContent=n;
        if(i===droneState.root) b.classList.add('active');
        b.onclick = () => {
            document.querySelectorAll('#rootGrid .btn-toggle').forEach(x=>x.classList.remove('active'));
            b.classList.add('active'); droneState.root=i; droneSync();
        };
        /** @type {HTMLElement} */ (document.getElementById('rootGrid')).appendChild(b);
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
        /** @type {HTMLElement} */ (document.getElementById('intervalGrid')).appendChild(b);
    });

    const droneToggleBtn = /** @type {HTMLButtonElement} */ (document.getElementById('droneToggle'));
    droneToggleBtn.onclick = () => {
        droneState.running = !droneState.running;
        onRunningChange(droneState.running);
        if(droneState.running){ startDrone(); droneToggleBtn.textContent='🎵 Stop Drone'; droneToggleBtn.classList.add('is-active'); }
        else { stopDrone(); droneToggleBtn.textContent='🎵 Start Drone'; droneToggleBtn.classList.remove('is-active'); }
    };

    /** @type {HTMLElement} */ (document.getElementById('droneClear')).onclick = () => {
        droneState.intervals = new Set([0]);
        document.querySelectorAll('#intervalGrid .btn-toggle').forEach((b,i)=>b.classList.toggle('active',i===0));
        droneSync();
    };

    const droneRefVal      = /** @type {HTMLElement} */ (document.getElementById('droneRefVal'));
    const droneOctaveInput = /** @type {HTMLInputElement} */ (document.getElementById('droneOctave'));
    const droneOctaveVal   = /** @type {HTMLElement} */ (document.getElementById('droneOctaveVal'));

    droneRefVal.textContent = String(refA);
    droneOctaveInput.value = String(droneState.octave);
    droneOctaveVal.textContent = String(droneState.octave);

    /** @type {HTMLElement} */ (document.getElementById('droneRefMinus')).onclick = () => {
        refA = Math.max(400, refA - 1);
        droneRefVal.textContent = String(refA);
        onRefAChange(refA);
        droneSync();
    };
    /** @type {HTMLElement} */ (document.getElementById('droneRefPlus')).onclick = () => {
        refA = Math.min(480, refA + 1);
        droneRefVal.textContent = String(refA);
        onRefAChange(refA);
        droneSync();
    };
    /** @type {HTMLElement} */ (document.getElementById('droneOctaveMinus')).onclick = () => {
        const v = Math.max(1, (parseInt(droneOctaveInput.value)||4) - 1);
        droneOctaveInput.value = String(v); droneOctaveVal.textContent = String(v); droneState.octave=v; droneSync();
    };
    /** @type {HTMLElement} */ (document.getElementById('droneOctavePlus')).onclick = () => {
        const v = Math.min(6, (parseInt(droneOctaveInput.value)||4) + 1);
        droneOctaveInput.value = String(v); droneOctaveVal.textContent = String(v); droneState.octave=v; droneSync();
    };

    // Volume slider
    const droneVolumeEl = /** @type {HTMLInputElement} */ (document.getElementById('droneVolume'));
    droneVolumeEl.value = String(droneState.volume);
    droneVolumeEl.oninput = (/** @type {Event} */ e) => {
        droneState.volume = parseFloat(/** @type {HTMLInputElement} */ (e.target).value);
        if(droneMaster) droneMaster.gain.value = droneState.volume;
        savePrefs();
    };

    // Tuning + wave switches — restore saved state
    /** @type {[string, string][]} */ ([['tuningSwitch', 'tuning'], ['colorSwitch', 'color']]).forEach(([id, key]) => {
        /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll(`#${id} button`)).forEach(
            b => b.classList.toggle('active', b.dataset.val === /** @type {any} */ (droneState)[key]));
        /** @type {HTMLElement} */ (document.getElementById(id)).onclick = (/** @type {Event} */ e) => {
            const btn = /** @type {HTMLButtonElement} */ (e.target);
            if(btn.tagName!=='BUTTON') return;
            /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll(`#${id} button`)).forEach(
                b=>b.classList.remove('active'));
            btn.classList.add('active');
            /** @type {any} */ (droneState)[key] = btn.dataset.val; droneSync();
        };
    });

    // Details toggle
    const detailsBtn = /** @type {HTMLElement} */ (document.getElementById('detailsToggle'));
    const debugEl    = /** @type {HTMLElement} */ (document.getElementById('debug-console'));
    detailsBtn.onclick = () => {
        const open = debugEl.style.display !== 'none';
        debugEl.style.display = open ? 'none' : 'block';
        detailsBtn.textContent = open ? '🔬 Show Details' : '🔬 Hide Details';
    };

    return {
        sync:    droneSync,
        isRunning: () => droneState.running,
        getRefA:   () => refA,
        setRefA: (newVal) => {
            refA = newVal;
            droneRefVal.textContent = String(newVal);
            droneSync();
        },
        handleVisibilityResume: () => {
            // Oscillators are killed by iOS when the AudioContext is suspended.
            // Null out the cached master gain so it is recreated fresh on resume.
            droneMaster = null;
            if (droneState.running) {
                stopDrone();
                startDrone();
            }
        },
    };
}
