// @ts-check
// ─── CHROMATIC TUNER ─────────────────────────────────────────────────────────

// ─── Type Definitions ────────────────────────────────────────────────────────

/**
 * Note information returned by the tuner's frequency analysis.
 * @typedef {object} NoteInfo
 * @property {string} noteName - Note name with Unicode accidentals (e.g. "C♯", "E♭").
 * @property {number} octave - Octave number.
 * @property {number} cents - Deviation from target pitch in cents.
 * @property {number} midi - MIDI note number.
 */

/**
 * Options for initializing the tuner module.
 * @typedef {object} TunerInitOptions
 * @property {() => AudioContext} getCtx - Returns the shared AudioContext (creates lazily).
 * @property {() => number} getRefA - Returns the current A4 reference frequency in Hz.
 * @property {(newVal: number) => void} onRefAChange - Called when the user changes the reference frequency.
 * @property {(running: boolean) => void} onRunningChange - Called when the tuner starts or stops.
 * @property {() => Promise<MediaStream>} getMicStream - Returns the shared microphone MediaStream.
 * @property {() => void} releaseMicStream - Releases the shared mic when both consumers are idle.
 */

/**
 * Public API returned by initTuner().
 * @typedef {object} TunerAPI
 * @property {() => void} stop - Stops the tuner and releases resources.
 */
/** @type {readonly string[]} */
const NOTES    = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const BUF_SIZE  = 8;   // rolling median window (~133 ms @ 60 fps)
const NOTE_HOLD = 3;   // consecutive agreeing medians before note label switches

// ─── Pure exports (testable in isolation) ────────────────────────────────────

/** @type {((buf: Float32Array) => number | null) | null} */
let _yinDetector = null;
/** @type {number} */
let _yinSampleRate = 0;

/**
 * Detects the fundamental frequency from an AnalyserNode using YIN pitch detection.
 * @param {AnalyserNode} analyser - The Web Audio analyser node connected to a source.
 * @param {number} sampleRate - The audio context sample rate.
 * @returns {number | null} Detected frequency in Hz, or null if silence/no pitch.
 */
export function detectPitch(analyser, sampleRate) {
    const bufLen = analyser.fftSize;
    const buf = new Float32Array(bufLen);
    analyser.getFloatTimeDomainData(buf);

    // RMS silence gate (pitchfinder lacks one — keep ours)
    let rms = 0;
    for (let i = 0; i < bufLen; i++) rms += /** @type {number} */ (buf[i]) * /** @type {number} */ (buf[i]);
    if (Math.sqrt(rms / bufLen) < 0.01) return null;

    // Lazy-init YIN detector; recreate if sample rate changes
    if (!_yinDetector || _yinSampleRate !== sampleRate) {
        _yinDetector = /** @type {any} */ (window).Pitchfinder.YIN({ sampleRate, threshold: 0.15 });
        _yinSampleRate = sampleRate;
    }

    const freq = /** @type {(buf: Float32Array) => number | null} */ (_yinDetector)(buf);
    return (freq && freq > 0) ? freq : null;
}

/**
 * Converts a frequency to note name, octave, cents deviation, and MIDI number.
 * @param {number} freq - Detected frequency in Hz.
 * @param {number} refA - Reference A4 frequency in Hz.
 * @param {number | null} [overrideMidi=null] - If set, locks to this MIDI note for cents calculation.
 * @returns {NoteInfo}
 */
export function freqToNoteInfo(freq, refA, overrideMidi = null) {
    const midi       = overrideMidi ?? Math.round(69 + 12 * Math.log2(freq / refA));
    const noteName   = /** @type {string} */ (NOTES[((midi % 12) + 12) % 12]);
    const octave     = Math.floor(midi / 12) - 1;
    const targetFreq = refA * Math.pow(2, (midi - 69) / 12);
    const cents      = 1200 * Math.log2(freq / targetFreq);
    return { noteName, octave, cents, midi };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Updates the tuner display with note name, cents deviation, and meter bar.
 * @param {number | null} freq - Detected frequency or null for silence.
 * @param {number} refA - Reference A4 frequency in Hz.
 * @param {number | null} [lockedMidi=null] - Locked MIDI note for hysteresis.
 */
function updateDisplay(freq, refA, lockedMidi = null) {
    const nameEl   = /** @type {HTMLElement} */ (document.getElementById('tunerNoteName'));
    const centsEl  = /** @type {HTMLElement} */ (document.getElementById('tunerCentsDisplay'));
    const fillEl   = /** @type {HTMLElement} */ (document.getElementById('tunerMeterFill'));

    if (freq === null) {
        nameEl.innerHTML = '—';
        centsEl.textContent = '';
        centsEl.className = 'tuner-cents';
        fillEl.style.width = '0%';
        fillEl.style.left  = '50%';
        fillEl.className = 'tuner-meter-fill';
        return;
    }

    const { noteName, octave, cents } = freqToNoteInfo(freq, refA, lockedMidi);

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

/**
 * Updates the tuner toggle button text and active state.
 * @param {boolean} isRunning
 */
function updateBtn(isRunning) {
    const btn = /** @type {HTMLElement} */ (document.getElementById('tunerToggle'));
    btn.textContent = isRunning ? '⏹ Stop Tuner' : '🎤 Start Tuner';
    btn.classList.toggle('is-active', isRunning);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Initializes the chromatic tuner module: mic input, pitch detection loop, and UI.
 * @param {TunerInitOptions} options
 * @returns {TunerAPI}
 */
export function initTuner({ getCtx, getRefA, onRefAChange, onRunningChange, getMicStream, releaseMicStream }) {
    // Closure state
    let running        = false;
    /** @type {MediaStream | null} */
    let stream         = null;
    /** @type {MediaStreamAudioSourceNode | null} */
    let source         = null;
    /** @type {AnalyserNode | null} */
    let analyser       = null;
    /** @type {number | null} */
    let rafId          = null;
    /** @type {number[]} */
    let freqBuf        = [];
    /** @type {number | null} */
    let lastMidi       = null;
    /** @type {number | null} */
    let candidateMidi  = null;
    let candidateCount = 0;

    /** Animation frame callback: detects pitch, applies hysteresis, updates display. */
    function tick() {
        if (!running || !analyser) return;
        const raw = detectPitch(analyser, getCtx().sampleRate);

        if (raw === null) {
            // Silence: flush buffer and clear display
            freqBuf = [];
            lastMidi = null;
            candidateMidi = null;
            candidateCount = 0;
            updateDisplay(null, getRefA());
        } else {
            // Accumulate into rolling buffer
            freqBuf.push(raw);
            if (freqBuf.length > BUF_SIZE) freqBuf.shift();

            // Wait for half the buffer to fill before showing anything
            if (freqBuf.length >= Math.ceil(BUF_SIZE / 2)) {
                const sorted = [...freqBuf].sort((a, b) => a - b);
                const median = /** @type {number} */ (sorted[Math.floor(sorted.length / 2)]);

                // Hysteresis: only commit to a new note after NOTE_HOLD confirmations
                const { midi } = freqToNoteInfo(median, getRefA());
                if (lastMidi === null) {
                    // First lock — accept immediately
                    lastMidi = midi;
                } else if (midi !== lastMidi) {
                    if (midi === candidateMidi) {
                        candidateCount++;
                        if (candidateCount >= NOTE_HOLD) {
                            lastMidi = midi;
                            candidateMidi = null;
                            candidateCount = 0;
                        }
                    } else {
                        candidateMidi = midi;
                        candidateCount = 1;
                    }
                }

                updateDisplay(median, getRefA(), lastMidi);
            }
        }

        rafId = requestAnimationFrame(tick);
    }

    /** Starts the tuner: requests mic access, creates analyser, begins detection loop. */
    async function start() {
        // iOS requires AudioContext to be created/resumed synchronously inside a user
        // gesture handler. Calling getCtx() here — before any await — ensures the
        // context is resumed while we are still in the synchronous click-handler frame.
        const ctx = getCtx();

        const statusEl = /** @type {HTMLElement} */ (document.getElementById('tunerStatus'));
        statusEl.textContent = 'Requesting microphone…';
        statusEl.className   = 'tuner-status';
        try {
            stream = await getMicStream();
        } catch (/** @type {any} */ err) {
            statusEl.textContent = err.name === 'NotAllowedError'
                ? 'Microphone access denied. Please allow mic access and try again.'
                : `Microphone error: ${err.message}`;
            statusEl.className = 'tuner-status error';
            running = false;
            onRunningChange(false);
            updateBtn(false);
            return;
        }
        // Ensure the context is fully running before reading audio data.
        // resume() is async; we must await it or getFloatTimeDomainData returns zeros.
        if (ctx.state !== 'running') await ctx.resume();
        source      = ctx.createMediaStreamSource(stream);
        analyser    = ctx.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0;
        source.connect(analyser);
        // Not connected to ctx.destination — no audio passthrough / feedback
        statusEl.textContent = '';
        running = true;
        onRunningChange(true);
        updateBtn(true);
        tick();
    }

    /** Stops the tuner, disconnects audio nodes, releases the mic, and resets UI. */
    function stop() {
        running = false;
        onRunningChange(false);
        if (rafId)    { cancelAnimationFrame(rafId); rafId = null; }
        if (source)   { try { source.disconnect(); }   catch(_e) {} source = null; }
        if (analyser) { try { analyser.disconnect(); } catch(_e) {} analyser = null; }
        stream = null;
        releaseMicStream();
        freqBuf = [];
        lastMidi = null;
        candidateMidi = null;
        candidateCount = 0;
        updateDisplay(null, getRefA());
        updateBtn(false);
        /** @type {HTMLElement} */ (document.getElementById('tunerStatus')).textContent = '';
        /** @type {HTMLElement} */ (document.getElementById('tunerStatus')).className   = 'tuner-status';
    }

    // Wire up tuner toggle
    /** @type {HTMLElement} */ (document.getElementById('tunerToggle')).onclick = () => {
        running ? stop() : start();
    };

    // Tuner A Ref stepper — syncs shared refA and drone display via callbacks
    const tunerRefVal = /** @type {HTMLElement} */ (document.getElementById('tunerRefVal'));
    tunerRefVal.textContent = String(getRefA());
    /** @type {HTMLElement} */ (document.getElementById('tunerRefMinus')).onclick = () => {
        const newVal = Math.max(400, getRefA() - 1);
        tunerRefVal.textContent = String(newVal);
        onRefAChange(newVal);
    };
    /** @type {HTMLElement} */ (document.getElementById('tunerRefPlus')).onclick = () => {
        const newVal = Math.min(480, getRefA() + 1);
        tunerRefVal.textContent = String(newVal);
        onRefAChange(newVal);
    };

    return { stop };
}
