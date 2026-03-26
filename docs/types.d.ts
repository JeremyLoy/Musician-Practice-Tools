// ─── Shared Type Definitions ────────────────────────────────────────────────
// These types are used across modules and referenced via JSDoc imports.

/** Metronome meter configuration. */
interface Meter {
    /** Pulse counts per beat group (e.g. [3,3] = 6/8, [2,2,3] = 7/8). */
    groups: number[];
    /** Note value denominator (notation-only, doesn't affect timing). */
    denom: number;
    /** Sub-clicks per pulse: 1, 2, 3, or 4. */
    subdivision: number;
}

/** A single pulse in the metronome schedule. */
interface Pulse {
    /** True if this pulse is the first in its beat group. */
    isGroupBeat: boolean;
    /** Duration of this subdivision in seconds. */
    subDur: number;
}

/** Drone machine state. */
interface DroneState {
    /** Root note as semitone index (0=C, 9=A, 11=B). */
    root: number;
    /** Active interval semitone offsets. */
    intervals: Set<number>;
    /** Tuning system. */
    tuning: 'just' | 'equal';
    /** Oscillator waveform type (named "color" for historical reasons). */
    color: OscillatorType;
    /** Whether the drone is currently playing. */
    running: boolean;
    /** Octave (1–6). */
    octave: number;
    /** Volume (0–1). */
    volume: number;
}

/** Drone interval ratio entry. */
interface DroneRatio {
    /** Short interval name (e.g. "P5", "m3"). */
    n: string;
    /** Semitone offset from root. */
    s: number;
    /** Just intonation frequency ratio. */
    r: number;
    /** Ratio as fraction string (e.g. "3/2"). */
    f: string;
}

/** An active drone oscillator with its gain node. */
interface ActiveOsc {
    osc: OscillatorNode;
    g: GainNode;
}

/** Musical dictionary entry. */
interface DictEntry {
    /** Musical term in its original language. */
    term: string;
    /** Language code: IT, DE, FR, EN, LA, or ES. */
    lang: 'IT' | 'DE' | 'FR' | 'EN' | 'LA' | 'ES';
    /** English definition. */
    def: string;
    /** Normalized (lowercase, no diacritics) version of term. */
    normTerm: string;
    /** Normalized (lowercase, no diacritics) version of definition. */
    normDef: string;
}

/** Note information returned by the tuner's frequency analysis. */
interface NoteInfo {
    /** Note name with Unicode accidentals (e.g. "C♯", "E♭"). */
    noteName: string;
    /** Octave number. */
    octave: number;
    /** Deviation from target pitch in cents. */
    cents: number;
    /** MIDI note number. */
    midi: number;
}

/** A saved audio memo in IndexedDB. */
interface Memo {
    /** Unique ID (timestamp string). */
    id: string;
    /** Raw audio blob. */
    blob: Blob;
    /** MIME type of the recording. */
    mimeType: string;
    /** Recording timestamp (ms since epoch). */
    ts: number;
    /** User-assigned or auto-generated name. */
    name: string;
}

/** Persisted user preferences (stored in localStorage). */
interface SavedPrefs {
    // Metronome
    bpm?: number;
    meter?: Meter;
    metroSound?: boolean;
    metroLight?: boolean;
    metroVolume?: number;
    clickSound?: string;

    // Drone
    droneRoot?: number;
    droneIntervals?: number[];
    droneTuning?: string;
    droneColor?: string;
    droneOctave?: number;
    droneVolume?: number;

    // Reference pitch
    refA?: number;
    /** @deprecated Use refA instead. */
    droneRef?: number;

    // Card UI state
    cardOrder?: string[];
    collapsedCards?: string[];
}

/** Metronome preferences emitted via onPrefsChange callback. */
interface MetronomePrefs {
    bpm: number;
    meter: Meter;
    metroSound: boolean;
    metroLight: boolean;
    metroVolume: number;
    clickSound: string;
}

/** Options for initializing the metronome module. */
interface MetronomeInitOptions {
    /** Returns the shared AudioContext (creates lazily). */
    getCtx: () => AudioContext;
    /** Initial metronome settings. */
    initialPrefs: MetronomePrefs;
    /** Called when metronome starts or stops. */
    onRunningChange: (running: boolean) => void;
    /** Called when any metronome preference changes. */
    onPrefsChange: (prefs: MetronomePrefs) => void;
}

/** Public API returned by initMetronome(). */
interface MetronomeAPI {
    /** Re-syncs timing after the page becomes visible again. */
    handleVisibilityResume: () => void;
}

/** Options for initializing the tuner module. */
interface TunerInitOptions {
    /** Returns the shared AudioContext (creates lazily). */
    getCtx: () => AudioContext;
    /** Returns the current A4 reference frequency in Hz. */
    getRefA: () => number;
    /** Called when the user changes the reference frequency. */
    onRefAChange: (newVal: number) => void;
    /** Called when the tuner starts or stops. */
    onRunningChange: (running: boolean) => void;
    /** Returns the shared microphone MediaStream. */
    getMicStream: () => Promise<MediaStream>;
    /** Releases the shared mic when both consumers are idle. */
    releaseMicStream: () => void;
}

/** Public API returned by initTuner(). */
interface TunerAPI {
    /** Stops the tuner and releases resources. */
    stop: () => void;
}

/** Options for initializing the recorder module. */
interface RecorderInitOptions {
    /** IndexedDB database handle. */
    db: IDBDatabase;
    /** Returns the shared AudioContext (creates lazily). */
    getCtx: () => AudioContext;
    /** Called when recording starts or stops. */
    onRecordingChange: (recording: boolean) => void;
    /** Returns the shared microphone MediaStream. */
    getMicStream: () => Promise<MediaStream>;
    /** Releases the shared mic when both consumers are idle. */
    releaseMicStream: () => void;
}

// ─── Global augmentations ───────────────────────────────────────────────────

interface Window {
    /** Pitchfinder library (loaded from bundled script). */
    Pitchfinder: {
        YIN: (opts: { sampleRate: number; threshold?: number }) => (buf: Float32Array) => number | null;
    };
    /** WaveSurfer library (loaded from bundled script). */
    WaveSurfer: {
        create: (opts: Record<string, unknown>) => {
            on: (event: string, cb: (...args: unknown[]) => void) => void;
            playPause: () => void;
            destroy: () => void;
        };
    };
    /** Delete a memo by ID (attached to window for inline onclick handlers). */
    deleteMemo: (id: string) => void;
}

/** AudioSession API (Safari/iOS 16.4+). */
interface Navigator {
    audioSession?: {
        type: string;
    };
}
