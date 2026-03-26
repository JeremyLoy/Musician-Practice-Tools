// ─── Shared Type Definitions ────────────────────────────────────────────────
// JSDoc typedefs used across modules. Import with:
//   /** @import { Meter, Pulse } from './types.js' */

/**
 * Metronome meter configuration.
 * @typedef {object} Meter
 * @property {number[]} groups - Pulse counts per beat group (e.g. [3,3] = 6/8, [2,2,3] = 7/8).
 * @property {number} denom - Note value denominator (notation-only, doesn't affect timing).
 * @property {number} subdivision - Sub-clicks per pulse: 1, 2, 3, or 4.
 */

/**
 * A single pulse in the metronome schedule.
 * @typedef {object} Pulse
 * @property {boolean} isGroupBeat - True if this pulse is the first in its beat group.
 * @property {number} subDur - Duration of this subdivision in seconds.
 */

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
 * Musical dictionary entry.
 * @typedef {object} DictEntry
 * @property {string} term - Musical term in its original language.
 * @property {'IT' | 'DE' | 'FR' | 'EN' | 'LA' | 'ES'} lang - Language code.
 * @property {string} def - English definition.
 * @property {string} normTerm - Normalized (lowercase, no diacritics) version of term.
 * @property {string} normDef - Normalized (lowercase, no diacritics) version of definition.
 */

/**
 * Note information returned by the tuner's frequency analysis.
 * @typedef {object} NoteInfo
 * @property {string} noteName - Note name with Unicode accidentals (e.g. "C♯", "E♭").
 * @property {number} octave - Octave number.
 * @property {number} cents - Deviation from target pitch in cents.
 * @property {number} midi - MIDI note number.
 */

/**
 * A saved audio memo in IndexedDB.
 * @typedef {object} Memo
 * @property {string} id - Unique ID (timestamp string).
 * @property {Blob} blob - Raw audio blob.
 * @property {string} mimeType - MIME type of the recording.
 * @property {number} ts - Recording timestamp (ms since epoch).
 * @property {string} name - User-assigned or auto-generated name.
 */

/**
 * Persisted user preferences (stored in localStorage).
 * @typedef {object} SavedPrefs
 * @property {number} [bpm]
 * @property {Meter} [meter]
 * @property {boolean} [metroSound]
 * @property {boolean} [metroLight]
 * @property {number} [metroVolume]
 * @property {string} [clickSound]
 * @property {number} [droneRoot]
 * @property {number[]} [droneIntervals]
 * @property {string} [droneTuning]
 * @property {string} [droneColor]
 * @property {number} [droneOctave]
 * @property {number} [droneVolume]
 * @property {number} [refA]
 * @property {number} [droneRef] - Deprecated. Use refA instead.
 * @property {string[]} [cardOrder]
 * @property {string[]} [collapsedCards]
 */

/**
 * Metronome preferences emitted via onPrefsChange callback.
 * @typedef {object} MetronomePrefs
 * @property {number} bpm
 * @property {Meter} meter
 * @property {boolean} metroSound
 * @property {boolean} metroLight
 * @property {number} metroVolume
 * @property {string} clickSound
 */

/**
 * Options for initializing the metronome module.
 * @typedef {object} MetronomeInitOptions
 * @property {() => AudioContext} getCtx - Returns the shared AudioContext (creates lazily).
 * @property {MetronomePrefs} initialPrefs - Initial metronome settings.
 * @property {(running: boolean) => void} onRunningChange - Called when metronome starts or stops.
 * @property {(prefs: MetronomePrefs) => void} onPrefsChange - Called when any metronome preference changes.
 */

/**
 * Public API returned by initMetronome().
 * @typedef {object} MetronomeAPI
 * @property {() => void} handleVisibilityResume - Re-syncs timing after the page becomes visible again.
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

/**
 * Options for initializing the recorder module.
 * @typedef {object} RecorderInitOptions
 * @property {IDBDatabase} db - IndexedDB database handle.
 * @property {() => AudioContext} getCtx - Returns the shared AudioContext (creates lazily).
 * @property {(recording: boolean) => void} onRecordingChange - Called when recording starts or stops.
 * @property {() => Promise<MediaStream>} getMicStream - Returns the shared microphone MediaStream.
 * @property {() => void} releaseMicStream - Releases the shared mic when both consumers are idle.
 */

export {};
