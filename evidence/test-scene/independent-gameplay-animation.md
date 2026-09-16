# Independent gameplay and animation review

Build: **b5eb674ac6de701e200da9dd48678966bbb761e9**. Reviewed the actual served `docs/main.js`; SHA-256 `d87062e9c4127e3b558df79a40cceb258c5c875328959b5e3fe32d225cab88d4` matched the localhost response. Uncommitted source edits were not the served review build.

Reviewer authored candidate B geometry earlier, but did not judge or approve wheel, foliage or windworks geometry here. This review covers lead-authored runtime interactions and animation only. Hero selected C is not this reviewer's implementation.

## Verdict

- **TEST-03 FAIL (major)** despite a successful desktop and complete emulated-touch core interaction loop: the closed gate has no collision and can be crossed before restoration.
- **TEST-04 FAIL (major)**: hazard impact displaces the idle hero with no authored reaction/recovery; release has no travelling staff-to-wheel effect; heading changes snap.
- **TEST-09 incomplete**: this is an independent fixed-build verdict, not final approval. Repair and affected retest required before expansion.

**Single most damaging defect: the closed gate can be walked through.** It makes the promised gate-opening consequence mechanically empty and breaks collision trust at the scene's explicit objective.

## Evidence and method

`independent-gameplay/check.mjs` drives normal keyboard, pointer and CDP touch events. `window.__GAME__` is read only for observations and route steering; no state mutation or synthetic completion. `result.json` records observed states. `gate-check.mjs` separately reproduces gate crossing with normal inputs, in `gate-result.json`.

Recordings: `desktop-loop.webm`, `desktop-hazard-motion.webm`, `phone-loop.webm`, `closed-gate-crossing.webm`. Actual captured frames were inspected, including temporal contact sheets `desktop-motion-sheet.png`, `hazard-detail.png` and before/after gate screenshots. Videos were captured at requested 20fps; frame timing/performance is not a physical-device verdict. This review has no listening claim. The temporal sheets support the stated specific observations but do not justify blanket approval of every subtle contact detail.

Desktop viewport 1280×800; phone emulation 430×932 with actual touch dispatch. No page errors recorded. This was a knowledgeable agent route, not a first-time human playtest.

## Successful observations

- Empty action outside source does not falsely charge; source capture sets charged state on desktop and touch.
- Release away from target retains the gust and gives explanatory text on both routes.
- Carrying to target and assisted release restores the scene on desktop and touch; repeated desktop action does not undo restoration.
- Restoration remains through pause/resume. Desktop pause held position fixed while movement input was attempted.
- Reset returns to `(0,3.2)` and clears both charge and restoration on desktop and touch. Phone pause-panel interaction worked; its immediate telemetry observation preceded the next render and still read false, so that individual snapshot is not treated as a pause-state assertion.
- Staff follows the hand in observed walking/action frames; no detached staff observed. This is not a full clipping/contact pass.

## Ranked defects and repair acceptance

### 1. Major — closed gate is non-solid (TEST-03)

Fresh start, do not capture or restore. Walk to approximately `(4.45,-1.7)`, then to `(5.12,-2.80)`. Result: hero travels through the closed door. Recorded positions cross from `(4.278,-1.671)` to `(5.039,-2.867)` while `restored=false`; `gate-front.png`, `gate-rear.png`, `closed-gate-crossing.webm` show both sides. Runtime collision list contains only tree and wheel, confirming the missing gate collider.

Repair acceptance: repeat on keyboard and touch. Closed door blocks the crossing with stable sliding/contact; successful restoration opens it and permits crossing; reset restores blockage. Keep opened-state persistence and avoid trapping the hero inside the moving door.

### 2. Major — pressure impact has no bodily reaction or recovery (TEST-04)

After reset, approach `(1.9,-1.2)` and remain still through the pressure cycle. Runtime telegraphs a ring, then instantaneously adds a 0.45m displacement to position; recorded hazard wait shows the hero displaced while retaining the ordinary idle pose. No recoil, bracing, step recovery or impact state is authored. The safe shove works as state logic but fails the requested readable reaction and recovery.

Repair acceptance: normal-speed clip of stationary and moving impacts, with readable anticipation, synchronized shove/pose, grounded recovery and no lost charge. Also show walking evasion and hazard cessation after restoration.

### 3. Major — release does not visibly travel from staff to wheel (TEST-03/04)

Core release succeeds in `desktop-loop.webm` and `phone-loop.webm`, but its effect is another circle around the target, using the same line also used for hazard. The hero lifts the staff, charge vanishes, wheel changes; no connecting current travels across the gap. This weakens the central capture/carry/release lesson and action follow-through. This finding concerns runtime feedback, not wheel geometry.

Repair acceptance: desktop and phone clips show a brief clear staff-tip-to-target current synchronized with arm anticipation, impact, wheel acceleration and gate response. Missed release should retain charge and avoid displaying a successful target-impact cue.

### 4. Minor — instant heading reversal (TEST-04)

The end of `desktop-hazard-motion.webm` includes left/right input reversal. Heading follows the new velocity direction in one update; source directly adds the complete shortest angular delta, without turn rate or body lead. This can read as a pivot snap rather than a planted turn.

Repair acceptance: observed 90°/180° turn and start/stop clips show a short responsive turn with coherent shoulders/hips and foot contact, without adding control lag.

## Limits

Only flat terrace locomotion exists in this build; slope/step contact cannot be passed. Foot placement at this gameplay scale is plausible in inspected walking frames but has not earned a no-slide/no-clip blanket pass. Actual phone, audio listening, full adventure progression, physical GPU performance and self-authored geometry quality remain outside this verdict.
