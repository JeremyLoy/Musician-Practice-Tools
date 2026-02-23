# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## TODO Tracking

When completing a task from `TODO.md`, move it from the `- [ ]` list to a `## DONE` section at the bottom of that file, changing the checkbox to `- [x]`.

## Target Platform

**Primary users are musicians on mobile and tablet touch devices** (iPhone, iPad, Android). Desktop is supported but secondary. Every UI decision should be evaluated against a phone-sized screen first.

- Minimum supported width: ~390px (iPhone 15 Pro)
- Touch targets must be ≥ 44px in both dimensions
- No hover-dependent interactions — all controls must work by tap alone
- The BPM wheel drag, beat-group editor dividers, and all sliders are designed for finger use

## Running the App

Open `docs/index.html` directly in a browser — no build step, no package manager, no server required.

When using the MCP browser, a local server is running at `http://localhost:8000`.

## JavaScript Runtime

Use **bun** instead of node for any JS execution on the command line (e.g. `bun script.js`, `bun --input-type=module`). Node is not installed in this environment.

## File Structure

```
docs/index.html        — app shell: HTML + PWA meta tags
docs/style.css         — all CSS
docs/app.js            — all JavaScript (~1140 lines)
docs/dictionary.js     — ES module export, ~350 musical terms, ~375 lines
docs/dict.js           — Musical Dictionary module (search, render)
docs/manifest.json     — PWA manifest (name, icons, display mode)
docs/sw.js             — service worker (cache-first offline strategy)
docs/wavesurfer.min.js — WaveSurfer.js v7 bundled locally (do not CDN-ify)
docs/icon-192.png      — home screen icon (192×192)
docs/icon-512.png      — home screen icon (512×512)
scripts/bake_dict.py   — dev tool: regenerates normTerm/normDef fields in dictionary.js
tests/dict.test.js     — Bun test suite for dict.js pure functions and dictionary data
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

- **Script loading**: Every `<script>` tag must include either `defer` or `type="module"`. No synchronous (blocking) script tags.
- **State first, then UI**: mutate state variables, then call the reconciliation function (e.g., `droneSync()`, `updateBPMDisplay()`), which also calls `savePrefs()`.
- **Audio nodes are ephemeral**: oscillators and sound nodes are created fresh for each note/beat and disconnected when done — never reused.
- **iOS compatibility is intentional**: the `timeslice=250` in MediaRecorder, the silent MP3 unlock, MediaElement backend for WaveSurfer, and MIME type detection are all deliberate iOS workarounds — don't remove them.
- **No external frameworks** — vanilla JS throughout; WaveSurfer.js@7 is bundled locally at `docs/wavesurfer.min.js` (do not replace with a CDN link — offline PWA support depends on it).
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

## Testing

### Unit Tests (Bun)

    bun test

Tests live in `tests/`. Add unit tests here for new pure functions or data transforms.

### End-to-End Tests (Playwright)

    bun x playwright test

Tests live in `e2e/`. Uses Chromium. Expects the app at `http://localhost:8000`. If that
server isn't running, Playwright starts `python3 -m http.server 8000 --directory docs`
automatically.

**One-time setup** (after cloning or after deleting `node_modules`):

    ~/.bun/bin/bun install
    ~/.bun/bin/bun x playwright install chromium

### Stop Hook Enforcement

**All tests must pass before every commit, push, or task sign-off.**
The Claude Stop hook runs both suites automatically:

    bun test && bun x playwright test

Claude cannot finish a response if either suite exits non-zero.

When adding new testable logic (pure functions, data transforms), add tests in `tests/`.
When adding new UI features, add e2e coverage in `e2e/`.

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

## PWA: Deploying Updates

This app is a PWA with a service worker that caches all files for offline use. **Whenever you deploy any change to `docs/`**, you must also bump the cache version in `docs/sw.js`:

```js
// docs/sw.js
const CACHE_VERSION = 'toolkit-20260222-1430';  // YYYYMMDD-HHMM (24h UTC)

// docs/app.js
const APP_VERSION = 'toolkit-20260222-1430';    // must match CACHE_VERSION
```

**Why this matters:** The service worker serves all files from cache. Without bumping the version, users will receive stale cached files even after a deploy. Bumping the version causes the browser to detect `sw.js` changed, download all assets fresh, and delete the old cache. `APP_VERSION` in `app.js` mirrors the same string so the footer always shows which build is running.

**Rule:** one deploy = one version bump. Update **both** `CACHE_VERSION` in `sw.js` and `APP_VERSION` in `app.js` to the same `YYYYMMDD-HHMM` (24-hour UTC) timestamp. Also add the new asset to the `ASSETS` array in `sw.js` if you add a new file to `docs/`.
