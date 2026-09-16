# Independent gameplay/animation targeted retest

Build **f9c57fb49a3bd95beaff85388f23b6a54fe43530**, localhost served `docs/main.js` SHA-256 **54d5b7988a2dc24c59bf2a0e84653489570d1fc92959a1ccdc8001536de195c5**, matched checked-in deployed artifact. Prior evidence remains unchanged.

**Targeted repair verdict: PASS. All three prior major runtime defects and the heading-snap minor are resolved in the exercised routes.** A minor transitional objective-label issue remains below. TEST-03's previously failed collision/interaction cases now pass. TEST-04's previously failed reaction, transfer and turn cases pass at test-scene scale; this does not certify slopes, exhaustive clipping or full-adventure acting.

## Evidence

Own normal-input script and observations: `independent-gameplay-retest/check.mjs`, `result.json`. No runtime modification or state mutation. Fresh desktop 1280×800 and touch-enabled 430×932; real keyboard/CDP touch events; telemetry read only. No page errors.

New recordings: `desktop-gate-and-transfer.webm`, `phone-gate-and-transfer.webm`, `charged-hazard-and-turn.webm`. Inspected actual captured frames and temporal sheets `desktop-sheet.png`, `hazard-sheet.png`, `reaction-detail.png` (8fps detail), `turn-detail.png` (8fps detail), plus phone transfer image. Clips preserve normal-time captures; review observations are based on actual sampled temporal frames, not an asserted full real-time playback/listening pass. No physical-phone or hardware-performance inference from the reported headless frame rates.

## Closed / open / reset gate

The same attempted front-to-back crossing now stops at the gate when closed, succeeds when opened, and stops again following reset.

| Mode | Closed stopped position | Open crossed position | Reset stopped position |
|---|---|---|---|
| Keyboard | (4.510, -2.199) | (4.979, -2.916) | (4.564, -2.174) |
| Touch | (4.769, -2.074) | (5.019, -2.885) | (4.770, -2.074) |

Screenshots named `desktop/phone-closed-gate`, `-open-gate`, `-reset-gate` show the actual state and contact. No crossing through the closed door occurred. Both open passages had `restored=true`; both reset probes had `restored=false` and empty charge. This resolves the previous single worst defect.

## Transfer, charge and hazard

- Both fresh routes capture successfully; attempted release at the source retains charge and leaves restoration false.
- Successful release now has an observed pending period (`charged=false`, `restored=false`) with the caption “Let the current find its way back,” a visible curved travelling current, followed by restoration.
- `phone-transfer.png` shows the current between raised staff and wheel at actual 430px viewport width; it is discernible without crop enlargement. This resolves the missing transfer feedback.
- Charged hazard recording around 7.2–8.7 seconds shows warning ring, impact, raised arm/torso recoil, short displacement and return toward ordinary stance. Staff remains attached in these frames. Charged state remains true after the impact; it is not lost or silently restored.
- Moving out to approximately (-0.146, 1.097) and waiting through a further cycle avoids the pressure shove while retaining charge. Safe ordinary walking suffices; no dodge input needed.
- Restoration stops pressure hazard in the subsequently recorded gate route. No continuing shove observed after restoring.
- End-of-clip left/right reversal shows intermediate body headings, rather than one-frame 180° replacement. This resolves the heading snap at the exercised speed. Subtle foot sliding remains outside this bounded sampled-frame pass.

## Residual minor — objective briefly points back to source during transfer

**Single worst remaining observed issue (minor):** immediately after successful release, the objective changes to “Find the wandering gust” and marker points to “Wandering gust” until delayed restoration arrives approximately half a second later. This is visible in both transfer screenshots. The current correctly travels toward the wheel, and the explanatory release caption is correct, so it does not block progression, but the top-level instruction contradicts the pending action.

Repro: capture → approach wheel → release; inspect first 0.5 seconds. Repair acceptance: while pending restoration, show “Returning the current” (or equivalent) and retain the wheel marker or hide it; never invite another capture until the transfer resolves. Recheck successful and missed releases on desktop and touch.

## Limits / ownership

No review of self-authored B wheel/foliage/windworks geometry. No Atlas calls. No audio listening, physical iPhone, complete-adventure timing or broad art approval. Gate passage is tested after the opening animation settles; its exact intermediate moving-door collision timing has not been exhaustively probed. The first-scene milestone still depends on the other independent verdicts and human device/audio checks.
