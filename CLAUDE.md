# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

Open `index.html` directly in a browser — no build step, no package manager, no server required. There are no tests or linting tools.

## Architecture

The entire application lives in a single file: **`index.html`** (~982 lines). HTML, CSS, and JavaScript are all inline. The JS is a `<script type="module">` block starting around line 266.

### Three Feature Modules (in order in the file)

1. **Drone Machine** (~lines 337–515) — Plays sustained tones using Web Audio oscillators. Supports just intonation and equal temperament. State lives in `droneState` object (root note, interval Set, tuning, waveform, octave, volume). `startDrone()` / `stopDrone()` manage oscillator lifecycle; `droneSync()` is the main reconciliation function called after any state change.

2. **Metronome** (~lines 517–799) — Audio scheduling with 25ms tick interval and 100ms lookahead buffer. Four synthesized click sounds (`playClave`, `playClick`, `playRim`, `playCowbell`). BPM state is a plain `let` variable; most metronome state is individual variables. The wheel drag interaction uses fractional BPM accumulation for smooth control. `sched()` is the core scheduling loop.

3. **Audio Recorder** (~lines 801–971) — Uses MediaRecorder API. Detects supported MIME type at startup (mp4 on iOS, webm/ogg elsewhere). Recordings are stored as blobs in IndexedDB. WaveSurfer.js (loaded from CDN) handles playback visualization.

### Shared Infrastructure

- **`getCtx()`** — Lazy AudioContext initialization; called before any audio work. All three modules share one context.
- **iOS audio unlock** (~lines 269–301) — On first user gesture, plays a silent embedded MP3 to bypass the iOS mute switch. This runs before any real audio.
- **Persistence** — `localStorage` (`PREFS_KEY = 'toolkit_prefs_v1'`) stores user preferences as JSON. IndexedDB (initialized by `initDB()`) stores audio memo blobs. `loadPrefs()` / `savePrefs()` sync all state on startup and after every change.

### Initialization Order (lines 973–978)
```
initDB() → updateBPM() → droneSync() → renderMemos()
```

## Key Patterns

- **State first, then UI**: mutate state variables, then call the reconciliation function (e.g., `droneSync()`, `updateBPMDisplay()`), which also calls `savePrefs()`.
- **Audio nodes are ephemeral**: oscillators and sound nodes are created fresh for each note/beat and disconnected when done — never reused.
- **iOS compatibility is intentional**: the `timeslice=250` in MediaRecorder, the silent MP3 unlock, MediaElement backend for WaveSurfer, and MIME type detection are all deliberate iOS workarounds — don't remove them.
- **No external frameworks** — vanilla JS throughout; WaveSurfer.js is the only dependency (CDN).
