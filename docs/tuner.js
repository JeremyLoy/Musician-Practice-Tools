// ─── CHROMATIC TUNER ─────────────────────────────────────────────────────────
const NOTES    = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const BUF_SIZE  = 8;   // rolling median window (~133 ms @ 60 fps)
const NOTE_HOLD = 3;   // consecutive agreeing medians before note label switches

// ─── Pure exports (testable in isolation) ────────────────────────────────────

export function detectPitch(analyser, sampleRate) {
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
