// @ts-check
/** @import { Memo, RecorderInitOptions } from './types.js' */
// ─── AUDIO RECORDER ──────────────────────────────────────────────────────────

// ─── Pure exports (testable in isolation) ────────────────────────────────────

/**
 * Detects the best supported audio MIME type for MediaRecorder.
 * @returns {string} Supported MIME type string, or empty string as fallback.
 */
export function getSupportedMimeType() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', ''];
    return types.find(t => !t || MediaRecorder.isTypeSupported(t)) || '';
}

/**
 * Converts a MIME type string to a file extension.
 * @param {string} mime
 * @returns {'mp4' | 'ogg' | 'webm'}
 */
export function mimeToExt(mime) {
    if (mime.includes('mp4')) return 'mp4';
    if (mime.includes('ogg')) return 'ogg';
    return 'webm';
}

/**
 * Generates an automatic name for a new recording based on current date/time.
 * @returns {string} e.g. "Mar 26 2:30 PM"
 */
export function getAutoName() {
    const now = new Date();
    const d = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const t = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${d} ${t}`;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Initializes the audio recorder module: MediaRecorder, waveform display, memo storage and playback.
 * @param {RecorderInitOptions} options
 */
export function initRecorder({ db, getCtx, onRecordingChange, getMicStream, releaseMicStream }) {
    // All state encapsulated in closure
    let recorder, chunks = [], liveAnimFrame = null, liveAnalyser = null, memoUrls = [];
    let stream = null;

    /** Draws a live waveform on the canvas during recording. */
    function drawLiveWaveform() {
        const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('liveWaveform'));
        const c2d = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
        canvas.width = canvas.offsetWidth;
        const buf = new Uint8Array(liveAnalyser.fftSize);
        (function draw() {
            if (!liveAnalyser) return;
            liveAnimFrame = requestAnimationFrame(draw);
            liveAnalyser.getByteTimeDomainData(buf);
            c2d.clearRect(0, 0, canvas.width, canvas.height);
            c2d.strokeStyle = '#22c55e'; c2d.lineWidth = 2;
            c2d.beginPath();
            const sw = canvas.width / buf.length; let x = 0;
            for (let i = 0; i < buf.length; i++) {
                const y = (buf[i] / 128) * canvas.height / 2;
                i === 0 ? c2d.moveTo(x, y) : c2d.lineTo(x, y); x += sw;
            }
            c2d.lineTo(canvas.width, canvas.height / 2); c2d.stroke();
        })();
    }

    /** Stops the live waveform animation and clears the canvas. */
    function stopLiveWaveform() {
        if (liveAnimFrame) { cancelAnimationFrame(liveAnimFrame); liveAnimFrame = null; }
        liveAnalyser = null;
        const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('liveWaveform'));
        canvas.style.display = 'none';
        /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')).clearRect(0, 0, canvas.width, canvas.height);
    }

    /**
     * Persists a renamed memo to IndexedDB.
     * @param {Memo} m - The memo object to update.
     * @param {string} name - New name for the memo.
     */
    function saveMemoName(m, name) {
        m.name = name.trim() || m.name;
        const tx = db.transaction('memos', 'readwrite');
        tx.objectStore('memos').put(m);
    }

    /** Renders all saved memos from IndexedDB with WaveSurfer playback and rename/delete controls. */
    function renderMemos() {
        memoUrls.forEach(u => URL.revokeObjectURL(u)); memoUrls = [];
        const list = /** @type {HTMLElement} */ (document.getElementById('memoList')); list.innerHTML = '';
        db.transaction('memos').objectStore('memos').getAll().onsuccess = e => {
            /** @type {Memo[]} */ (/** @type {IDBRequest} */ (e.target).result).sort((a, b) => b.ts - a.ts).forEach(m => {
                const mime = m.mimeType || (m.blob && m.blob.type) || 'audio/webm';
                const ext = mimeToExt(mime);
                // Create a correctly-typed blob URL — critical for iOS to decode it
                const typedBlob = new Blob([m.blob], { type: mime });
                const url = URL.createObjectURL(typedBlob); memoUrls.push(url);
                const label = m.name || `Memo — ${new Date(m.ts).toLocaleString()}`;
                const d = document.createElement('div'); d.className = 'recording-item';
                d.innerHTML = `
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
                const ws = /** @type {any} */ (window).WaveSurfer.create({
                    container: `#w-${m.id}`,
                    waveColor: '#475569',
                    progressColor: '#22c55e',
                    backend: 'MediaElement',
                    url
                });
                const pb = document.getElementById(`p-${m.id}`);
                ws.on('play', () => pb.textContent = '⏸ Pause');
                ws.on('pause', () => pb.textContent = '▶ Play');
                ws.on('finish', () => pb.textContent = '▶ Play');
                // iOS: playPause must be triggered directly from user tap (already is via onclick)
                pb.onclick = () => ws.playPause();

                document.getElementById(`dl-${m.id}`).onclick = () => {
                    const a = document.createElement('a'); a.href = url;
                    a.download = `${(m.name || 'memo').replace(/[^\w\s\-]/g, '_').trim()}.${ext}`;
                    a.click();
                };

                const lbl = /** @type {HTMLElement} */ (document.getElementById(`lbl-${m.id}`));
                const inp = /** @type {HTMLInputElement} */ (document.getElementById(`inp-${m.id}`));
                const ren = /** @type {HTMLElement} */ (document.getElementById(`ren-${m.id}`));
                let renaming = false;

                function enterRename() {
                    renaming = true; inp.value = lbl.textContent;
                    lbl.style.display = 'none'; inp.style.display = 'block';
                    ren.textContent = '✓'; inp.focus(); inp.select();
                }
                function commitRename() {
                    if (!renaming) return; renaming = false;
                    const n = inp.value.trim() || lbl.textContent;
                    lbl.textContent = n; lbl.style.display = '';
                    inp.style.display = 'none'; ren.textContent = '✏️';
                    saveMemoName(m, n);
                }
                ren.onclick = () => renaming ? commitRename() : enterRename();
                lbl.onclick = enterRename;
                inp.onblur = () => setTimeout(commitRename, 80);
                inp.onkeydown = e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { renaming = false; inp.style.display = 'none'; lbl.style.display = ''; ren.textContent = '✏️'; } };
            });
        };
    }

    const recordBtn = /** @type {HTMLElement} */ (document.getElementById('recordToggle'));
    recordBtn.onclick = async () => {
        if (recorder?.state === 'recording') {
            recorder.stop(); stopLiveWaveform();
            recordBtn.textContent = '🎙️ Start Recording'; recordBtn.classList.remove('is-active');
            /** @type {HTMLElement} */ (document.getElementById('rec-status')).textContent = '';
            onRecordingChange(false);
            return;
        }
        stream = await getMicStream();
        const autoName = getAutoName();
        const mimeType = getSupportedMimeType();
        const recOpts = mimeType ? { mimeType } : {};
        recorder = new MediaRecorder(stream, recOpts); chunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
            releaseMicStream();
            const actualMime = recorder.mimeType || mimeType || 'audio/webm';
            const blob = new Blob(chunks, { type: actualMime });
            const item = { id: Date.now().toString(), blob, mimeType: actualMime, ts: Date.now(), name: autoName };
            const tx = db.transaction('memos', 'readwrite');
            tx.objectStore('memos').put(item);
            tx.oncomplete = renderMemos;
        };
        // iOS: resume AudioContext before creating source (requires user gesture — we're inside one)
        const ctx = getCtx();
        liveAnalyser = ctx.createAnalyser(); liveAnalyser.fftSize = 2048;
        ctx.createMediaStreamSource(stream).connect(liveAnalyser);
        const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('liveWaveform'));
        canvas.style.display = 'block'; drawLiveWaveform();
        // timeslice=250ms ensures data flows on iOS (which may not fire ondataavailable without it)
        recorder.start(250);
        recordBtn.textContent = '⏹️ Stop Recording'; recordBtn.classList.add('is-active');
        /** @type {HTMLElement} */ (document.getElementById('rec-status')).textContent = '● Recording...';
        onRecordingChange(true);
    };

    /** @type {any} */ (window).deleteMemo = id => {         // must stay on window for inline onclick
        if (!confirm('Delete this memo?')) return;
        const tx = db.transaction('memos', 'readwrite');
        tx.objectStore('memos').delete(id);
        tx.oncomplete = renderMemos;
    };

    renderMemos();  // populate list on init
}
