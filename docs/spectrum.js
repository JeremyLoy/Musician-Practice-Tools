// @ts-check
// ─── SPECTRAL ANALYSIS ──────────────────────────────────────────────────────────

// ─── Type Definitions ────────────────────────────────────────────────────────

/**
 * A single point in the processed spectrum.
 * @typedef {object} SpectrumPoint
 * @property {number} freq - Frequency in Hz.
 * @property {number} db   - Amplitude in dB.
 */

/**
 * A detected spectral peak.
 * @typedef {object} SpectrumPeak
 * @property {number} freq  - Frequency of the peak bin in Hz.
 * @property {number} db    - Amplitude in dB.
 * @property {number} index - Bin index in the spectrum array.
 */

/**
 * Options for initializing the spectrum module.
 * @typedef {object} SpectrumInitOptions
 * @property {() => AudioContext} getCtx
 * @property {() => Promise<MediaStream>} getMicStream
 * @property {() => void} releaseMicStream
 * @property {(running: boolean) => void} onRunningChange
 */

/**
 * Public API returned by initSpectrum().
 * @typedef {object} SpectrumAPI
 * @property {() => void} stop
 */

// ─── Pure exports (testable in isolation) ────────────────────────────────────

/**
 * Maps raw FFT float frequency data to an array of {freq, db} points.
 * Skips bin 0 (DC offset).
 * @param {Float32Array} frequencyData - Float FFT data (dB values from getFloatFrequencyData).
 * @param {number} fftSize - The FFT size used by the AnalyserNode.
 * @param {number} sampleRate - The audio context sample rate in Hz.
 * @returns {SpectrumPoint[]}
 */
export function computeSpectrum(frequencyData, fftSize, sampleRate) {
    const binCount = frequencyData.length; // fftSize / 2
    const binWidth = sampleRate / fftSize;
    /** @type {SpectrumPoint[]} */
    const result = [];
    for (let i = 1; i < binCount; i++) {
        result.push({ freq: i * binWidth, db: /** @type {number} */ (frequencyData[i]) });
    }
    return result;
}

/**
 * Maps a frequency to an X pixel position using a logarithmic scale.
 * @param {number} freq - Frequency in Hz.
 * @param {number} width - Canvas width in pixels.
 * @param {number} minFreq - Lowest displayed frequency.
 * @param {number} maxFreq - Highest displayed frequency.
 * @returns {number} X pixel position, clamped to [0, width].
 */
export function frequencyToX(freq, width, minFreq, maxFreq) {
    if (freq <= 0) return 0;
    const logMin = Math.log2(minFreq);
    const logMax = Math.log2(maxFreq);
    const x = width * (Math.log2(freq) - logMin) / (logMax - logMin);
    return Math.max(0, Math.min(width, x));
}

/**
 * Maps an X pixel position back to a frequency using the inverse logarithmic scale.
 * @param {number} x - X pixel position.
 * @param {number} width - Canvas width in pixels.
 * @param {number} minFreq - Lowest displayed frequency.
 * @param {number} maxFreq - Highest displayed frequency.
 * @returns {number} Frequency in Hz.
 */
export function xToFrequency(x, width, minFreq, maxFreq) {
    const logMin = Math.log2(minFreq);
    const logMax = Math.log2(maxFreq);
    return Math.pow(2, logMin + (x / width) * (logMax - logMin));
}

/**
 * Finds local maxima (spectral peaks) above a dB threshold.
 * @param {SpectrumPoint[]} spectrum - Array of {freq, db} from computeSpectrum.
 * @param {number} threshold - Minimum dB to qualify as a peak.
 * @returns {SpectrumPeak[]} Peaks sorted by dB descending.
 */
export function findPeaks(spectrum, threshold) {
    /** @type {SpectrumPeak[]} */
    const peaks = [];
    for (let i = 1; i < spectrum.length - 1; i++) {
        const pt = /** @type {SpectrumPoint} */ (spectrum[i]);
        if (pt.db > threshold &&
            pt.db > /** @type {SpectrumPoint} */ (spectrum[i - 1]).db &&
            pt.db > /** @type {SpectrumPoint} */ (spectrum[i + 1]).db) {
            peaks.push({ freq: pt.freq, db: pt.db, index: i });
        }
    }
    return peaks.sort((a, b) => b.db - a.db);
}

/**
 * Maps a dB value to a canvas Y coordinate. 0 = top (loudest), height = bottom (quietest).
 * @param {number} db - Amplitude in dB.
 * @param {number} height - Canvas height in pixels.
 * @param {number} minDb - Floor dB (e.g. -100).
 * @param {number} maxDb - Ceiling dB (e.g. -10).
 * @returns {number} Y pixel position, clamped to [0, height].
 */
export function dbToY(db, height, minDb, maxDb) {
    const y = height * (1 - (db - minDb) / (maxDb - minDb));
    return Math.max(0, Math.min(height, y));
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/** @type {readonly {label: string, freq: number}[]} */
const FREQ_LABELS = [
    { label: 'C2', freq: 65.41 },
    { label: 'C3', freq: 130.81 },
    { label: 'A3', freq: 220 },
    { label: 'C4', freq: 261.63 },
    { label: 'A4', freq: 440 },
    { label: 'C5', freq: 523.25 },
    { label: 'C6', freq: 1046.5 },
    { label: 'C7', freq: 2093 },
    { label: 'C8', freq: 4186 },
];

const FFT_SIZE = 8192;
const MIN_FREQ = 60;
const MAX_FREQ = 8000;
const MIN_DB = -100;
const MAX_DB = -10;

/**
 * Initializes the spectral analysis module: mic input, FFT loop, and canvas UI.
 * @param {SpectrumInitOptions} options
 * @returns {SpectrumAPI}
 */
export function initSpectrum({ getCtx, getMicStream, releaseMicStream, onRunningChange }) {
    // Closure state
    let running = false;
    /** @type {MediaStream | null} */
    let stream = null;
    /** @type {MediaStreamAudioSourceNode | null} */
    let source = null;
    /** @type {AnalyserNode | null} */
    let analyser = null;
    /** @type {number | null} */
    let rafId = null;

    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('spectrumCanvas'));
    const ctx2d = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    const statusEl = /** @type {HTMLElement} */ (document.getElementById('spectrumStatus'));

    /** Resizes the canvas backing store to match CSS layout and device pixel ratio. */
    function resizeCanvas() {
        const wrap = /** @type {HTMLElement} */ (canvas.parentElement);
        const rect = wrap.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(/** @type {HTMLElement} */ (canvas.parentElement));
    resizeCanvas();

    /**
     * Draws grid lines and axis labels on the canvas.
     * @param {number} w - CSS width in pixels.
     * @param {number} h - CSS height in pixels.
     */
    function drawGrid(w, h) {
        ctx2d.strokeStyle = 'rgba(51, 65, 85, 0.6)';
        ctx2d.lineWidth = 0.5;
        ctx2d.font = '9px system-ui, sans-serif';
        ctx2d.fillStyle = '#94a3b8';

        // Frequency grid lines
        for (const fl of FREQ_LABELS) {
            if (fl.freq < MIN_FREQ || fl.freq > MAX_FREQ) continue;
            const x = frequencyToX(fl.freq, w, MIN_FREQ, MAX_FREQ);
            ctx2d.beginPath();
            ctx2d.moveTo(x, 0);
            ctx2d.lineTo(x, h);
            ctx2d.stroke();
            ctx2d.fillText(fl.label, x + 2, h - 4);
        }

        // dB grid lines
        for (let db = MIN_DB; db <= MAX_DB; db += 10) {
            const y = dbToY(db, h, MIN_DB, MAX_DB);
            ctx2d.beginPath();
            ctx2d.moveTo(0, y);
            ctx2d.lineTo(w, y);
            ctx2d.stroke();
            if (db > MIN_DB && db < MAX_DB) {
                ctx2d.fillText(`${db} dB`, 2, y - 2);
            }
        }
    }

    /**
     * Draws the filled spectrum curve on the canvas.
     * @param {Float32Array} frequencyData - Raw FFT data from getFloatFrequencyData.
     * @param {number} sampleRate - Audio context sample rate.
     */
    function draw(frequencyData, sampleRate) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        ctx2d.clearRect(0, 0, w, h);

        drawGrid(w, h);

        const spectrum = computeSpectrum(frequencyData, FFT_SIZE, sampleRate);

        ctx2d.beginPath();
        ctx2d.moveTo(0, h);
        let started = false;
        for (const pt of spectrum) {
            if (pt.freq < MIN_FREQ || pt.freq > MAX_FREQ) continue;
            const x = frequencyToX(pt.freq, w, MIN_FREQ, MAX_FREQ);
            const y = dbToY(pt.db, h, MIN_DB, MAX_DB);
            if (!started) {
                ctx2d.moveTo(x, h);
                ctx2d.lineTo(x, y);
                started = true;
            } else {
                ctx2d.lineTo(x, y);
            }
        }
        if (started) {
            const lastX = frequencyToX(MAX_FREQ, w, MIN_FREQ, MAX_FREQ);
            ctx2d.lineTo(lastX, h);
        }
        ctx2d.closePath();
        ctx2d.fillStyle = 'rgba(34, 197, 94, 0.25)';
        ctx2d.fill();
        ctx2d.strokeStyle = '#22c55e';
        ctx2d.lineWidth = 1.5;
        ctx2d.stroke();
    }

    /** Animation frame callback: reads FFT data and redraws the spectrum. */
    function tick() {
        if (!running || !analyser) return;
        const data = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(data);
        draw(data, getCtx().sampleRate);
        rafId = requestAnimationFrame(tick);
    }

    /** Starts the spectrum analyser: requests mic, creates AnalyserNode, begins draw loop. */
    async function start() {
        const ctx = getCtx();
        statusEl.textContent = 'Requesting microphone…';
        statusEl.className = 'spectrum-status';
        try {
            stream = await getMicStream();
        } catch (/** @type {any} */ err) {
            statusEl.textContent = err.name === 'NotAllowedError'
                ? 'Microphone access denied. Please allow mic access and try again.'
                : `Microphone error: ${err.message}`;
            statusEl.className = 'spectrum-status error';
            running = false;
            onRunningChange(false);
            updateBtn(false);
            return;
        }
        if (ctx.state !== 'running') await ctx.resume();
        source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        statusEl.textContent = '';
        running = true;
        onRunningChange(true);
        updateBtn(true);
        tick();
    }

    /** Stops the analyser, disconnects audio nodes, releases the mic, and resets UI. */
    function stop() {
        running = false;
        onRunningChange(false);
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        if (source) { try { source.disconnect(); } catch (_e) { /* already disconnected */ } source = null; }
        if (analyser) { try { analyser.disconnect(); } catch (_e) { /* already disconnected */ } analyser = null; }
        stream = null;
        releaseMicStream();
        updateBtn(false);
        statusEl.textContent = '';
        statusEl.className = 'spectrum-status';
    }

    /**
     * Updates the toggle button text and active state.
     * @param {boolean} isRunning
     */
    function updateBtn(isRunning) {
        const btn = /** @type {HTMLElement} */ (document.getElementById('spectrumToggle'));
        btn.textContent = isRunning ? 'Stop Analyser' : 'Start Analyser';
        btn.classList.toggle('is-active', isRunning);
    }

    /** @type {HTMLElement} */ (document.getElementById('spectrumToggle')).onclick = () => {
        running ? stop() : start();
    };

    return { stop };
}
