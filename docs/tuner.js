// ─── CHROMATIC TUNER ─────────────────────────────────────────────────────────
const NOTES    = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const BUF_SIZE  = 8;   // rolling median window (~133 ms @ 60 fps)
const NOTE_HOLD = 3;   // consecutive agreeing medians before note label switches

// ─── Pure exports (testable in isolation) ────────────────────────────────────

let _yinDetector = null;
let _yinSampleRate = 0;

export function detectPitch(analyser, sampleRate) {
    const bufLen = analyser.fftSize;
    const buf = new Float32Array(bufLen);
    analyser.getFloatTimeDomainData(buf);

    // RMS silence gate (pitchfinder lacks one — keep ours)
    let rms = 0;
    for (let i = 0; i < bufLen; i++) rms += buf[i] * buf[i];
    if (Math.sqrt(rms / bufLen) < 0.01) return null;

    // Lazy-init YIN detector; recreate if sample rate changes
    if (!_yinDetector || _yinSampleRate !== sampleRate) {
        _yinDetector = window.Pitchfinder.YIN({ sampleRate, threshold: 0.15 });
        _yinSampleRate = sampleRate;
    }

    const freq = _yinDetector(buf);
    return (freq && freq > 0) ? freq : null;
}

export function freqToNoteInfo(freq, refA, overrideMidi = null) {
    const midi       = overrideMidi ?? Math.round(69 + 12 * Math.log2(freq / refA));
    const noteName   = NOTES[((midi % 12) + 12) % 12];
    const octave     = Math.floor(midi / 12) - 1;
    const targetFreq = refA * Math.pow(2, (midi - 69) / 12);
    const cents      = 1200 * Math.log2(freq / targetFreq);
    return { noteName, octave, cents, midi };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function updateDisplay(freq, refA, lockedMidi = null) {
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

function updateBtn(isRunning) {
    const btn = document.getElementById('tunerToggle');
    btn.textContent = isRunning ? '⏹ Stop Tuner' : '🎤 Start Tuner';
    btn.classList.toggle('is-active', isRunning);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function initTuner({ getCtx, getRefA, onRefAChange, onRunningChange }) {
    // Closure state
    let running        = false;
    let stream         = null;
    let source         = null;
    let analyser       = null;
    let rafId          = null;
    let freqBuf        = [];
    let lastMidi       = null;
    let candidateMidi  = null;
    let candidateCount = 0;

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
                const median = sorted[Math.floor(sorted.length / 2)];

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

    async function start() {
        // iOS requires AudioContext to be created/resumed synchronously inside a user
        // gesture handler. Calling getCtx() here — before any await — ensures the
        // context is resumed while we are still in the synchronous click-handler frame.
        const ctx = getCtx();

        const statusEl = document.getElementById('tunerStatus');
        statusEl.textContent = 'Requesting microphone…';
        statusEl.className   = 'tuner-status';
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            });
        } catch (err) {
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

    function stop() {
        running = false;
        onRunningChange(false);
        if (rafId)    { cancelAnimationFrame(rafId); rafId = null; }
        if (source)   { try { source.disconnect(); }   catch(e) {} source = null; }
        if (analyser) { try { analyser.disconnect(); } catch(e) {} analyser = null; }
        if (stream)   { stream.getTracks().forEach(t => t.stop()); stream = null; }
        freqBuf = [];
        lastMidi = null;
        candidateMidi = null;
        candidateCount = 0;
        updateDisplay(null, getRefA());
        updateBtn(false);
        document.getElementById('tunerStatus').textContent = '';
        document.getElementById('tunerStatus').className   = 'tuner-status';
    }

    // Wire up tuner toggle
    document.getElementById('tunerToggle').onclick = () => {
        running ? stop() : start();
    };

    // Tuner A Ref stepper — syncs shared refA and drone display via callbacks
    document.getElementById('tunerRefVal').textContent = getRefA();
    document.getElementById('tunerRefMinus').onclick = () => {
        const newVal = Math.max(400, getRefA() - 1);
        document.getElementById('tunerRefVal').textContent = newVal;
        onRefAChange(newVal);
    };
    document.getElementById('tunerRefPlus').onclick = () => {
        const newVal = Math.min(480, getRefA() + 1);
        document.getElementById('tunerRefVal').textContent = newVal;
        onRefAChange(newVal);
    };

    return { stop };
}
