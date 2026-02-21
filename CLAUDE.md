# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Target Platform

**Primary users are musicians on mobile and tablet touch devices** (iPhone, iPad, Android). Desktop is supported but secondary. Every UI decision should be evaluated against a phone-sized screen first.

- Minimum supported width: ~390px (iPhone 15 Pro)
- Touch targets must be ≥ 44px in both dimensions
- No hover-dependent interactions — all controls must work by tap alone
- The BPM wheel drag, beat-group editor dividers, and all sliders are designed for finger use

## Running the App

Open `docs/index.html` directly in a browser — no build step, no package manager, no server required. There are no tests or linting tools.

When using the MCP browser, a local server is running at `http://localhost:8000`.

## File Structure

```
docs/index.html      — entire app (~1170 lines): HTML + CSS + JS inline
docs/dictionary.js   — ES module export, ~350 musical terms, ~375 lines
scripts/bake_dict.py — dev tool: regenerates normTerm/normDef fields in dictionary.js
```

## Architecture

The application lives in two files: **`docs/index.html`** and **`docs/dictionary.js`**. HTML, CSS, and JavaScript are all inline in `docs/index.html`. The JS is a `<script type="module">` block that imports from `docs/dictionary.js`.

### Four Feature Modules (in order in the file)

1. **Drone Machine** — Plays sustained tones using Web Audio oscillators. Supports just intonation and equal temperament. State lives in `droneState` object (root note, interval Set, tuning, waveform/color, octave, volume). `startDrone()` / `stopDrone()` manage oscillator lifecycle; `droneSync()` is the main reconciliation function called after any state change.

2. **Metronome** — Audio scheduling with 25ms tick interval and 100ms lookahead buffer. Four synthesized click sounds (`playClave`, `playClick`, `playRim`, `playCowbell`). Core state is the `meter` object (`groups`, `denom`, `subdivision`). `buildSchedule()` pre-computes a flat pulse array; `sched()` is the core scheduling loop. The wheel drag interaction uses fractional BPM accumulation for smooth control.

3. **Audio Recorder** — Uses MediaRecorder API. Detects supported MIME type at startup (mp4 on iOS, webm/ogg elsewhere). Recordings are stored as blobs in IndexedDB. WaveSurfer.js (loaded from CDN) handles playback visualization.

4. **Musical Dictionary** — Searchable list of ~350 musical terms imported from `dictionary.js`. Each entry: `{ term, lang, def }`. Lang codes: IT, DE, FR, EN, LA, ES. Rendered with live filter on every `input` event.

### Shared Infrastructure

- **`getCtx()`** — Lazy AudioContext initialization; called before any audio work. All three audio modules share one context.
- **iOS audio unlock** — On first user gesture, plays a silent embedded MP3 (base64 data URI) to bypass the iOS mute switch.
- **Visibility change handler** — Resumes AudioContext after backgrounding. Restarts drone oscillators and resets metronome scheduler timing to avoid catch-up beats.
- **Persistence** — `localStorage` (`PREFS_KEY = 'toolkit_prefs_v2'`) stores user preferences as JSON. IndexedDB (initialized by `initDB()`) stores audio memo blobs. `loadPrefs()` / `savePrefs()` sync all state on startup and after every change.

### Metronome State

The `meter` object:
```js
meter = {
  groups: [1,1,1,1],  // pulse counts per beat group (e.g. [3,3] = 6/8, [2,2,3] = 7/8)
  denom: 4,           // note value denominator (notation-only, doesn't affect timing)
  subdivision: 1      // sub-clicks per pulse: 1/2/3/4
}
```
`buildSchedule()` must be called whenever `meter` or `bpm` changes. `applyMeterChange()` is the helper that calls `buildSchedule()`, resets `pulseIndex` if running, and saves prefs.

Time signature is entered as free text (e.g. "7/8") via `tsInput`. `parseTsInput()` validates and converts to `meter.groups` (array of 1s). The denominator is stored but only affects display — beat timing is always `60/bpm` seconds.

### Click Sounds

Four synthesized sounds, all taking `(atTime, isAccent)`:
- `playClave` — sine body + noise transient + resonance partial
- `playClick` — square wave with lowpass filter, fast decay
- `playRim` — noise with exponential envelope + optional accent ping
- `playCowbell` — two detuned square waves + metal transient
- `playSubdiv` — quiet sine tick for subdivision clicks (no accent variant)

### Initialization Order
```
initDB() → updateBPM(bpm) [calls buildSchedule()] → droneSync() → renderMemos()
```

## Key Patterns

- **State first, then UI**: mutate state variables, then call the reconciliation function (e.g., `droneSync()`, `updateBPMDisplay()`), which also calls `savePrefs()`.
- **Audio nodes are ephemeral**: oscillators and sound nodes are created fresh for each note/beat and disconnected when done — never reused.
- **iOS compatibility is intentional**: the `timeslice=250` in MediaRecorder, the silent MP3 unlock, MediaElement backend for WaveSurfer, and MIME type detection are all deliberate iOS workarounds — don't remove them.
- **No external frameworks** — vanilla JS throughout; WaveSurfer.js@7 (unpkg CDN) is the only dependency.
- **CSS scoping**: `.drone-row .control-group .stepper` and `.ts-spinner-group .stepper` are intentionally scoped to avoid conflicting with each other. The base `.stepper` styles the drone machine pill; the scoped rules adjust the metronome spinners. Be careful adding new `.stepper` rules.
- **`droneState.color`** holds the waveform type (sine/triangle) — named "color" for historical reasons. Maps to `OscillatorNode.type`.
- **Memo rendering**: `renderMemos()` always revokes all existing blob URLs before re-rendering to prevent memory leaks.

## Mobile Breakpoint

Single breakpoint at `max-width: 600px`. At this width:
- `.metro-layout` stacks to a single column (wheel on top, settings card below)
- `.wheel-row` becomes row: wheel centred, Start+Tap column to the right
- `.start-tap-col` becomes column (stacked vertically, 96px wide)
- `.wheel-outer` shrinks to 160×160px
- `.metro-controls` goes full-width
- `.card` padding reduces to `1rem`

## Self-Review Checklist

Before considering any UI change done, verify at **both** of these sizes using the MCP browser's `resize_window` tool:

1. **390 × 844** (iPhone — `mcp__Claude_in_Chrome__resize_window` width=390 height=844)
   - No horizontal overflow / scroll
   - All buttons reachable with a thumb (≥ 44px tap targets)
   - Metronome wheel, Start, Tap, and settings all visible and usable
   - Drone interval grid wraps cleanly (7 items per row at 390px)

2. **1280 × 900** (desktop)
   - Two-column metronome layout intact
   - No unexpected stretching or collapsing

Restore to desktop size after testing.
