# TODO

- [ ] Convert to TypeScript
- [ ] Split the JS into separate components — extract `audio.js` (getCtx, getMicStream, releaseMicStream, unlockAudio, updateWakeLock — shared audio infrastructure)
- [ ] Fullscreen iPhone viewport light doesn't work
- [ ] Audio playback on speakers
- [ ] Resume bug still is an issue
- [ ] Finish per-card min/max + auto-grow-h for the remaining cards (metro, tuner, spectrum, memos, dict). Drone was done first as the template; memos and dict keep user-resizable height with internal scrolling, the rest should auto-grow h from content so the full card is always visible.
- [ ] Remove the right-edge and bottom-edge resize handles — keep only the bottom-right corner handle, and give it a visible icon (e.g. a small diagonal-grip glyph) so users can discover it without hovering.
- [ ] Collapse is broken — decide whether to fix it or remove the feature entirely.

## DONE

- [x] Tablet mode: 2-3 column layout, rearrange and hide tools

- [x] Split the JS into separate components — dictionary extracted into dict.js; tuner extracted into tuner.js
- [x] Extract recorder into recorder.js
- [x] Extract metronome into metronome.js
- [x] Extract drone into drone.js
- [x] Split the JS into separate components — extract `cards.js` (card layout, drag-to-reorder, collapse, column controls)
- [x] Add version to footer
- [x] Tuner is not accurate — replaced NSDF with pitchfinder YIN algorithm
