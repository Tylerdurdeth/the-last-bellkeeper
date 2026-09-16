# Footfall/audio synchronization

Observed mismatch: main.js cued footsteps every0.65m travelled independently of the animator’s speed-dependent stride. Audio cadence therefore drifted relative to visible steps. The animator now emits alternating left/right events as each foot enters stance; main consumes them. Airborne frames, the actual landing frame, stationary frames and reset produce no locomotion event. Existing separate jump and landing sounds remain. No sound synthesis, movement physics or posed geometry changes.

The new test inspects actual hero foot bounds rather than only counting phase events: feet must be near the floor at cues and have lifted during the preceding swing; events alternate and remain consistent at30/60/120Hz. Existing foot-contact and animation tests still pass. This is flat-floor timing evidence, not terrain IK, sound-quality listening or overall motion approval. Full touch integration and independent correctness review are separate reports.
