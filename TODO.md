# TODO

- [ ] Convert to TypeScript
- [ ] Split the JS into separate components — extract `cards.js` (card layout, drag-to-reorder, collapse, column controls — ~370 lines)
- [ ] Split the JS into separate components — extract `audio.js` (getCtx, getMicStream, releaseMicStream, unlockAudio, updateWakeLock — shared audio infrastructure)
- [ ] Fullscreen iPhone viewport light doesn't work
- [ ] Audio playback on speakers
- [ ] Resume bug still is an issue

## DONE

- [x] Tablet mode: 2-3 column layout, rearrange and hide tools

- [x] Split the JS into separate components — dictionary extracted into dict.js; tuner extracted into tuner.js
- [x] Extract recorder into recorder.js
- [x] Extract metronome into metronome.js
- [x] Extract drone into drone.js
- [x] Add version to footer
- [x] Tuner is not accurate — replaced NSDF with pitchfinder YIN algorithm
