// ─── METRONOME ──────────────────────────────────────────────────────────────

// ─── Pure exports (testable in isolation) ────────────────────────────────────

export function meterToString(m) {
    const n = m.groups.reduce((a, b) => a + b, 0);
    return `${n}/${m.denom}`;
}

export function parseTsInput(str) {
    const m = str.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) return null;
    const n = parseInt(m[1]), d = parseInt(m[2]);
    if (n < 1 || n > 32 || d < 1 || d > 64) return null;
    return { groups: Array(n).fill(1), denom: d };
}

export function buildSchedule(bpm, meter) {
    const pulses = [];
    const beatSec = 60 / bpm;
    meter.groups.forEach(groupSize => {
        const groupDurSec = groupSize * beatSec;
        const subDur = groupDurSec / meter.subdivision;
        for (let s = 0; s < meter.subdivision; s++) {
            pulses.push({ isGroupBeat: s === 0, subDur });
        }
    });
    return pulses;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function initMetronome({ getCtx, initialPrefs, onRunningChange, onPrefsChange }) {
    // ─── State ───────────────────────────────────────────────────────────────
    let bpm         = initialPrefs.bpm;
    let metroSound  = initialPrefs.metroSound;
    let metroLight  = initialPrefs.metroLight;
    let metroVolume = initialPrefs.metroVolume;
    let clickSound  = initialPrefs.clickSound;
    let meter       = initialPrefs.meter;

    let metroRunning = false, nextBeat = 0, schedTimer, pulseIndex = 0;
    let schedPulses = [], totalPulses = 0;
    let metroMaster = null;

    function emitPrefs() {
        onPrefsChange({ bpm, meter, metroSound, metroLight, metroVolume, clickSound });
    }

    // ─── Master gain ─────────────────────────────────────────────────────────
    function getMetroMaster() {
        const ctx = getCtx();
        if (!metroMaster || metroMaster.context !== ctx) {
            metroMaster = ctx.createGain();
            metroMaster.gain.value = metroVolume;
            metroMaster.connect(ctx.destination);
        }
        return metroMaster;
    }

    // ─── DOM refs ────────────────────────────────────────────────────────────
    const bpmDisplay = document.getElementById('bpm-display');
    const bpmInput   = document.getElementById('bpm-input');
    const metroCard  = document.getElementById('metro-card');
    const wheelEl    = document.getElementById('wheel');

    // ─── BPM ─────────────────────────────────────────────────────────────────
    const updateBPMDisplay = v => {
        bpm = Math.min(Math.max(v, 40), 280);
        bpmDisplay.textContent = bpm;
        bpmInput.value = bpm;
        wheelEl.style.transform = `rotate(${bpm * 1.5}deg)`;
    };
    const updateBPM = v => { updateBPMDisplay(v); rebuildSchedule(); emitPrefs(); };

    bpmDisplay.onclick = () => { bpmDisplay.style.display = 'none'; bpmInput.style.display = 'block'; bpmInput.focus(); };
    bpmInput.onblur    = () => { updateBPM(parseInt(bpmInput.value) || 120); bpmInput.style.display = 'none'; bpmDisplay.style.display = 'block'; };
    bpmInput.onkeydown = e => { if (e.key === 'Enter') bpmInput.blur(); };
    document.getElementById('bpmMinus').onclick = () => updateBPM(bpm - 1);
    document.getElementById('bpmPlus').onclick  = () => updateBPM(bpm + 1);

    // ─── Metro volume slider ─────────────────────────────────────────────────
    document.getElementById('metroVolume').value = metroVolume;
    document.getElementById('metroVolume').oninput = e => {
        metroVolume = parseFloat(e.target.value);
        if (metroMaster) metroMaster.gain.value = metroVolume;
        emitPrefs();
    };

    // ─── Time signature ──────────────────────────────────────────────────────
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

    // ─── Subdivision ─────────────────────────────────────────────────────────
    document.querySelectorAll('#subdivCtrl button').forEach(b =>
        b.classList.toggle('active', parseInt(b.dataset.val) === meter.subdivision));
    document.getElementById('subdivCtrl').onclick = e => {
        if (e.target.tagName !== 'BUTTON') return;
        document.querySelectorAll('#subdivCtrl button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        meter.subdivision = parseInt(e.target.dataset.val);
        applyMeterChange();
    };

    // ─── Click sound selector ────────────────────────────────────────────────
    document.querySelectorAll('#clickSoundCtrl button').forEach(b => b.classList.toggle('active', b.dataset.val === clickSound));
    document.getElementById('clickSoundCtrl').onclick = e => {
        if (e.target.tagName !== 'BUTTON') return;
        document.querySelectorAll('#clickSoundCtrl button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        clickSound = e.target.dataset.val; emitPrefs();
    };

    // ─── Click sounds ────────────────────────────────────────────────────────
    function playClave(atTime, isAccent) {
        const ctx = getCtx(), SR = ctx.sampleRate, out = getMetroMaster();
        const vol = isAccent ? 1.0 : 0.60, freq = isAccent ? 2750 : 2450;
        const body = ctx.createOscillator(), bG = ctx.createGain();
        body.type = 'sine';
        body.frequency.setValueAtTime(freq, atTime);
        body.frequency.exponentialRampToValueAtTime(freq * 0.87, atTime + 0.045);
        bG.gain.setValueAtTime(vol * 0.6, atTime);
        bG.gain.exponentialRampToValueAtTime(0.001, atTime + 0.045);
        body.connect(bG).connect(out); body.start(atTime); body.stop(atTime + 0.055);

        const cLen = Math.floor(SR * 0.013), nbuf = ctx.createBuffer(1, cLen, SR);
        const nd = nbuf.getChannelData(0); for (let i = 0; i < cLen; i++) nd[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource(); noise.buffer = nbuf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3100; bp.Q.value = 1.3;
        const cG = ctx.createGain();
        cG.gain.setValueAtTime(vol * 0.48, atTime); cG.gain.exponentialRampToValueAtTime(0.001, atTime + 0.013);
        noise.connect(bp).connect(cG).connect(out); noise.start(atTime); noise.stop(atTime + 0.016);

        const res = ctx.createOscillator(), rG = ctx.createGain();
        res.type = 'sine'; res.frequency.setValueAtTime(3700, atTime);
        rG.gain.setValueAtTime(vol * 0.18, atTime); rG.gain.exponentialRampToValueAtTime(0.001, atTime + 0.022);
        res.connect(rG).connect(out); res.start(atTime); res.stop(atTime + 0.028);
    }

    function playClick(atTime, isAccent) {
        const ctx = getCtx(), out = getMetroMaster();
        const vol = isAccent ? 1.0 : 0.65, freq = isAccent ? 1200 : 900;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(freq, atTime);
        o.frequency.exponentialRampToValueAtTime(freq * 0.5, atTime + 0.018);
        g.gain.setValueAtTime(vol * 0.4, atTime);
        g.gain.exponentialRampToValueAtTime(0.001, atTime + 0.018);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
        o.connect(lp).connect(g).connect(out); o.start(atTime); o.stop(atTime + 0.022);
    }

    function playRim(atTime, isAccent) {
        const ctx = getCtx(), SR = ctx.sampleRate, out = getMetroMaster();
        const vol = isAccent ? 1.0 : 0.6;
        const dur = isAccent ? 0.055 : 0.04;
        const len = Math.floor(SR * dur);
        const buf = ctx.createBuffer(1, len, SR);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.3));
        const src = ctx.createBufferSource(); src.buffer = buf;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = isAccent ? 900 : 700; hp.Q.value = 2;
        const bp = ctx.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 2500; bp.gain.value = 8;
        const g = ctx.createGain(); g.gain.setValueAtTime(vol * 0.9, atTime);
        src.connect(hp).connect(bp).connect(g).connect(out);
        src.start(atTime); src.stop(atTime + dur + 0.01);
        if (isAccent) {
            const ping = ctx.createOscillator(), pg = ctx.createGain();
            ping.type = 'sine'; ping.frequency.setValueAtTime(1600, atTime);
            pg.gain.setValueAtTime(0.3, atTime); pg.gain.exponentialRampToValueAtTime(0.001, atTime + 0.03);
            ping.connect(pg).connect(out); ping.start(atTime); ping.stop(atTime + 0.035);
        }
    }

    function playCowbell(atTime, isAccent) {
        const ctx = getCtx(), out = getMetroMaster();
        const vol = isAccent ? 1.0 : 0.62;
        const dur = isAccent ? 0.28 : 0.18;
        [[562, 1], [845, 0.6]].forEach(([f, fvol]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'square'; o.frequency.value = f;
            const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.4; bp.Q.value = 0.8;
            g.gain.setValueAtTime(vol * fvol * 0.3, atTime);
            g.gain.exponentialRampToValueAtTime(0.001, atTime + dur);
            o.connect(bp).connect(g).connect(out); o.start(atTime); o.stop(atTime + dur + 0.01);
        });
        const o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o2.type = 'triangle'; o2.frequency.setValueAtTime(3500, atTime); o2.frequency.exponentialRampToValueAtTime(1800, atTime + 0.015);
        g2.gain.setValueAtTime(vol * 0.5, atTime); g2.gain.exponentialRampToValueAtTime(0.001, atTime + 0.015);
        o2.connect(g2).connect(out); o2.start(atTime); o2.stop(atTime + 0.02);
    }

    function playBeat(atTime, isAccent) {
        if (clickSound === 'clave')        playClave(atTime, isAccent);
        else if (clickSound === 'click')   playClick(atTime, isAccent);
        else if (clickSound === 'rim')     playRim(atTime, isAccent);
        else if (clickSound === 'cowbell') playCowbell(atTime, isAccent);
    }

    function playSubdiv(atTime) {
        const ctx = getCtx(), out = getMetroMaster();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 1900;
        g.gain.setValueAtTime(0.11, atTime);
        g.gain.exponentialRampToValueAtTime(0.001, atTime + 0.02);
        o.connect(g).connect(out);
        o.start(atTime); o.stop(atTime + 0.025);
    }

    // ─── Visual flash ────────────────────────────────────────────────────────
    const viewportFlash = document.getElementById('viewport-flash');
    function triggerFlash(atTime, isAccent) {
        const delay = Math.max(0, (atTime - getCtx().currentTime) * 1000);
        const dur = isAccent ? 130 : 80;
        setTimeout(() => {
            wheelEl.classList.add('beat-flash');
            metroCard.classList.add('beat-flash');
            viewportFlash.classList.add('beat-flash');
            if (isAccent) viewportFlash.classList.add('accent');
            setTimeout(() => {
                wheelEl.classList.remove('beat-flash');
                metroCard.classList.remove('beat-flash');
                viewportFlash.classList.remove('beat-flash');
                viewportFlash.classList.remove('accent');
            }, dur);
        }, delay);
    }

    // ─── Scheduling ──────────────────────────────────────────────────────────
    function rebuildSchedule() {
        schedPulses = buildSchedule(bpm, meter);
        totalPulses = schedPulses.length;
    }

    function applyMeterChange() {
        rebuildSchedule();
        if (metroRunning) { pulseIndex = 0; nextBeat = getCtx().currentTime; }
        emitPrefs();
    }

    function sched() {
        const ctx = getCtx();
        while (nextBeat < ctx.currentTime + 0.1) {
            const pulse = schedPulses[pulseIndex % totalPulses];
            const isDownbeat = (pulseIndex % totalPulses === 0);
            if (metroSound) {
                if (pulse.isGroupBeat) playBeat(nextBeat, isDownbeat);
                else                   playSubdiv(nextBeat);
            }
            if (metroLight && pulse.isGroupBeat) triggerFlash(nextBeat, isDownbeat);
            pulseIndex++;
            nextBeat += pulse.subDur;
        }
        schedTimer = setTimeout(sched, 25);
    }

    // ─── Start / Stop ────────────────────────────────────────────────────────
    function updateMetroBtn() {
        const btn = document.getElementById('metroStartBtn');
        if (!btn) return;
        if (metroRunning) { btn.innerHTML = '■<br>Stop'; btn.classList.add('is-active'); }
        else { btn.innerHTML = '▶<br>Start'; btn.classList.remove('is-active'); }
    }

    function startMetro() {
        if (metroRunning) return;
        metroRunning = true; pulseIndex = 0;
        rebuildSchedule();
        nextBeat = getCtx().currentTime; sched();
        updateMetroBtn();
        onRunningChange(true);
    }

    function stopMetro() {
        if (!metroRunning) return;
        metroRunning = false; clearTimeout(schedTimer);
        wheelEl.classList.remove('beat-flash');
        metroCard.classList.remove('beat-flash');
        viewportFlash.classList.remove('beat-flash');
        viewportFlash.classList.remove('accent');
        updateMetroBtn();
        onRunningChange(false);
    }

    // ─── Output toggles ─────────────────────────────────────────────────────
    if (metroSound) document.getElementById('soundToggle').classList.add('active');
    if (metroLight) document.getElementById('lightToggle').classList.add('active');

    document.getElementById('soundToggle').onclick = function() {
        if (metroSound && !metroLight) return;
        metroSound = !metroSound; this.classList.toggle('active', metroSound); emitPrefs();
    };
    document.getElementById('lightToggle').onclick = function() {
        if (metroLight && !metroSound) return;
        metroLight = !metroLight; this.classList.toggle('active', metroLight); emitPrefs();
    };
    document.getElementById('metroStartBtn').onclick = function() {
        if (metroRunning) { stopMetro(); }
        else { startMetro(); }
        emitPrefs();
    };

    // ─── Tap tempo ───────────────────────────────────────────────────────────
    let tapTimes = [], tapResetTimer = null;
    document.getElementById('tapBtn').onclick = () => {
        const now = performance.now();
        clearTimeout(tapResetTimer);
        if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2000) tapTimes = [];
        tapTimes.push(now);
        if (tapTimes.length >= 2) {
            const gaps = tapTimes.slice(1).map((t, i) => t - tapTimes[i]);
            updateBPM(Math.round(60000 / (gaps.reduce((a, b) => a + b) / gaps.length)));
            if (metroRunning) { clearTimeout(schedTimer); pulseIndex = 0; nextBeat = getCtx().currentTime; sched(); }
        }
        if (tapTimes.length > 8) tapTimes = tapTimes.slice(-8);
        tapResetTimer = setTimeout(() => { tapTimes = []; }, 2000);
    };

    // ─── Wheel drag ──────────────────────────────────────────────────────────
    (function() {
        const outer = wheelEl.parentElement;
        let dragging = false, lastAngle = 0, fracBpm = 0;
        const getAngle = e => {
            const r = outer.getBoundingClientRect();
            const px = e.touches ? e.touches[0].clientX : e.clientX;
            const py = e.touches ? e.touches[0].clientY : e.clientY;
            return Math.atan2(py - (r.top + r.height / 2), px - (r.left + r.width / 2)) * (180 / Math.PI);
        };
        const onMove = e => {
            if (!dragging) return;
            const angle = getAngle(e);
            let d = angle - lastAngle; lastAngle = angle;
            if (d > 180) d -= 360; if (d < -180) d += 360;
            fracBpm += d / 1.5;
            const whole = Math.trunc(fracBpm);
            if (whole !== 0) { updateBPMDisplay(bpm + whole); fracBpm -= whole; }
        };
        const onEnd = () => {
            if (!dragging) return;
            dragging = false; wheelEl.style.cursor = 'grab';
            fracBpm = 0;
            if (metroRunning) { rebuildSchedule(); pulseIndex = 0; nextBeat = getCtx().currentTime; }
            emitPrefs();
        };
        wheelEl.addEventListener('mousedown', e => { e.preventDefault(); dragging = true; lastAngle = getAngle(e); fracBpm = 0; wheelEl.style.cursor = 'grabbing'; });
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        wheelEl.addEventListener('touchstart', e => { e.preventDefault(); dragging = true; lastAngle = getAngle(e); fracBpm = 0; }, { passive: false });
        window.addEventListener('touchmove', e => { if (!dragging) return; e.preventDefault(); onMove(e); }, { passive: false });
        window.addEventListener('touchend', onEnd);
    })();

    // ─── Initial schedule build + BPM display ────────────────────────────────
    updateBPMDisplay(bpm);
    rebuildSchedule();

    // ─── Public API ──────────────────────────────────────────────────────────
    return {
        handleVisibilityResume() {
            metroMaster = null;
            if (metroRunning) {
                clearTimeout(schedTimer);
                pulseIndex = 0;
                nextBeat = getCtx().currentTime;
                sched();
            }
        }
    };
}
