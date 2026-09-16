# Procedural soundscape — engineering evidence, listening pending

`game/audio.js` replaces the prior short oscillator bleeps with an original native Web Audio soundscape: independently colored stereo woodland air, filtered nearby-water texture, sparse irregular pitch-swept bird phrases, struck copper modes with inharmonic ratios/noisy mallet contact, short stereo convolution tail, airy intake/release, and noise-textured soil/wood contacts. This contains no retrieved audio, external model calls, Atlas spending, melodies or recordings.

API: `createSoundscape()` -> `start`, `setMuted`, `setPaused`, `update`, `cue`, `dispose`. No audio context/sources are created until explicit `start()`; call it in the real Start button handler. Call `setMuted` for persisted preference and `setPaused` with game pause. Ambient update accepts position (Vector3 or x/z array), speed, grounded, charged, restored, gardenDistance and waterDistance. Existing distance-driven footsteps should call `cue('step')`; update deliberately does not generate duplicate steps. Jump/land/capture/release/restore/chime/start/hazard cues are supported. Bridge coordinates select timber footfall; elsewhere soil. If world bridge layout changes, update this coordinate classification or later generalize an explicit surface field.

One small optional options argument injects an OfflineAudioContext and seeded random for reproducible engineering render. `cue(kind, {at})` can schedule ahead for this sample; regular live calls omit it.

## Checks actually run

Native Chromium Web Audio graph: pre-start cue/update safely ignored; start, all cue branches, mute, pause/unpause, disposal and repeated disposal executed without exceptions. OfflineAudioContext rendered 15 seconds of actual graph output into `audio-procedural.wav` (stereo PCM16, 22,050Hz). Metrics in `audio-procedural-metrics.json`: peak 0.09857, RMS 0.009806, mean absolute stereo difference 0.007093, non-finite samples 0. No numerical clipping. The WAV retains native quiet mix levels; it was not normalized after rendering.

Sample order: start bell 0.2s; soil steps 1.3/1.85; birds2.1; capture3.2; release6.2; restoration8.5; timber steps12/12.4; landing13.1. Ambient loops run underneath. This is a representative engineering sample, not a capture of integrated gameplay or proof of responsive spatial audio.

## Limitations

No listening review was performed. Successful graph execution, metrics and file export do not establish pleasantness, naturalness or artistic quality. The bird voices are synthesized chirps, not field recordings; brook is filtered noise, not individually simulated droplets; footsteps approximate surface texture. This is a tasteful-level procedural fallback intended to improve timbre immediately while generated/recorded assets await export and listening. It is not orchestral music, an Atlas audio substitute with claimed equivalence, or a claim of Zelda-quality audio. A human should listen to the sample, then the integrated game on speaker/headphones/phone, particularly copper brightness, repetition, relative footstep volume and whether the wind is too faint.
