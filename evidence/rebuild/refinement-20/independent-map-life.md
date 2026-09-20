# Independent integrated map / life review

Reviewed 20 September 2026 against the locally served `docs/` build at `http://127.0.0.1:4173/the-last-bellkeeper/`. This is a review, not an implementation change. No game, asset, build or UI source was edited. The terrain implementation is complete and `world.js` is released to the lead.

## Findings

1. **P2 — Enlarged phone chart passes drag gestures through to the camera.** On the current parallel-load build at 390 × 844, tap **Enlarge chart**, then drag inside the paper from `(140,270)` to `(240,270)`. Camera yaw changes from `0.662710272684869` to `0.06271027268486906` while the character remains at `(-1,18)`. The chart is expanded and its computed `pointer-events` remains `none`. This turns a gesture on the chart into a 0.6 radian scenery rotation and rotates the camera-up chart itself. Cause: `game/style.css:13` leaves the map non-interactive, including the expanded state; the underlying world canvas owns the drag handlers in `game/main.js:97`. Recommendation: let the expanded chart intercept pointer events and prevent touch panning there; retain pass-through behavior for the compact HUD if desired. Verify that chart dragging leaves camera yaw unchanged, while dragging exposed scenery still orbits. Not fixed in this review.

2. **Desktop draw-call headroom remains a performance concern, not a failed phone gate.** Normal desktop arrival at 1440 × 900 measured 983 colour-pass calls; a later attributed frame measured 997. Near the porch measured 982. Phone arrival measured 611 and the porch 534. Temporary browser-only attribution of the 997-call frame found 442 unnamed/static calls, 196 legacy `bird candidate b` calls, 136 hero/staff (`hips`) calls, 120 discovery calls, 33 rabbit calls, 20 kingfisher calls, 30 luna-moth calls, 12 backdrop calls, six chime calls and two terrain calls. The new animals account for 83 calls, so neither many terrain-cell meshes nor the new animals alone explain the desktop total. Shadow work adds further passes and is separate from the reported colour-call total. If reducing calls, batch rigid geometry within each animated joint, preserving named head/ear/wing pivots; do not flatten the complete articulated asset. This finding does not overturn the passing phone performance gate.

No additional route-blocking, water-overhang, floating-rabbit, rigid-wing flight or unreadable-expanded-chart defect was found in the checks below. This is a focused normal-frame/UI and bounded-motion review, not a replacement for the lead's full touch quest regression.

## Visual and interaction checks

- Inspected normal desktop arrival and grove frames at 1440 × 900, and phone arrival / expanded-chart frames at 390 × 844. Rabbits, moths and perched birds are recognizable background activity; the main path and character remain visible. The small chart's legend is necessarily tiny, but the expanded chart renders at 320 × 377.59 CSS pixels, within the viewport (`right=376`, `top=154`), and its legend and crossing state are readable.
- The chart opens and closes through the actual touch button. Its label and `aria-expanded` change correctly. Pause hides both chart and toggle. Desktop keyboard and phone joystick input each moved the character approximately 8.92 m to the porch without errors.
- The organic island and basin appear correctly in the integrated field chart. `node tools/test-map.mjs` passed 720 camera angles × four directions and finite drawing / locked / restored labels.
- The inspected `docs/woodland-life.js`, `docs/woodland-map.js` and stylesheet matched their `game/` counterparts. A final current-build touch check confirmed the parallel prototype load and startup changes were present; no application state or source was patched for the review.

Previously captured review evidence, created before the instruction limiting further writes to this report:

- [Desktop arrival](../island-terrain/independent-life/desktop-arrival.png)
- [Desktop grove](../island-terrain/independent-life/desktop-grove.png)
- [Phone arrival](../island-terrain/independent-life/phone-arrival.png)
- [Phone expanded chart](../island-terrain/independent-life/phone-map-expanded.png)
- [Desktop/phone input telemetry](../island-terrain/independent-life/result.json)
- [Draw attribution](../island-terrain/independent-life/draw-audit.json)

## Independent life / motion checks

Loaded the actual built recipe modules and ran the integrated life placement/update module with its real `height` and `shoreClearance` functions. Dynamic transforms were sampled for four seconds per animal; these diagnostics do not substitute for a renderer frame-rate measurement.

| Check | Result |
| --- | --- |
| Deterministic population | 4 brambles, 8 hostas, 3 shelf stumps, 3 rabbits, 2 kingfishers, 4 luna moths |
| Static bounding-box corners on dry terrain | Zero shoreline violations |
| Main-path clearance | Nearest new static instance centre was 2.68 m from PATH; placement separately reserves footprints, landmarks and shortcut/bridge approaches |
| Rabbit excursion | 0.58 m horizontal, returning to its home position |
| Rabbit ground contact | No sampled below-ground foot position; terrain-relative hop peak 0.129895 m |
| Gentle rabbit hop | 0.045487 m peak; horizontal excursion remains 0.58 m but animation is slower |
| Kingfisher movement | 0.045 m vertical perch hop, no folded-wing flight; actual perch support is raycast from stump geometry |
| Moth movement | 0.18 m horizontal orbit, 0.06 m vertical amplitude; roughly 0.19 m maximum 3D displacement |
| Zero-delta update | All sampled transforms unchanged in both normal and gentle modes |
| Backward-time module reset | Rabbit and kingfisher positions return home in both modes; this tests the module reset branch, not whether quest reset rewinds global time |

`node tools/test-island-navigation.mjs` also passed after life integration: 8.000 m polygon clearance, 264 jump approaches, 5.23 m elevated/coyote bound, rising-deck contact, both bridge directions at 30/60/120 Hz, and reset. Life adds decoration rather than new crossing colliders.

## Final performance evidence and limits

The lead's final throttled phone gate is [jam-local-final/verdict.json](jam-local-final/verdict.json): PASS, approximately 15.6 s ready, 7.5 MB, 611 peak calls, 774,609 peak triangles and 59.78 median FPS. The lead separately reports full touch completion with all keepsakes and reset in 53.79 s; that full route was not duplicated in this review.

My fresh UI startup samples were unthrottled and are deliberately not used to claim loading-budget improvement. The parallel-load structure awaits world, garden, discoveries and art readiness before exposing the start control. Independent asset imports can overlap; procedural geometry construction and shader compilation remain main-thread/GPU work, so the final throttled gate is the relevant loading evidence.

**Disposition:** integrated map/life visuals and bounded motion pass this review, with the concrete enlarged-chart gesture defect above and a desktop draw-call optimization follow-up. No geometry change or additional life blocker is recommended.

## Lead repair / verification follow-up

The enlarged-chart gesture defect is fixed with `pointer-events:auto` and `touch-action:none` on the expanded chart. `tools/test-refinement-ui.mjs` now performs real touch drags inside the paper and on exposed scenery: chart drags leave yaw unchanged, scenery drags still orbit. Desktop, 390×844 phone and 844×390 landscape checks pass. The same check caught and repaired a landscape pause-panel placement defect; pause/resume and chart bounds now pass at both phone orientations.

The legacy bird's rigid sibling meshes were batched without flattening wing pivots: 18→10 meshes with the same 570 triangles. Three pose comparisons retain positions, normals, UVs and bounds within floating-point tolerance; the unmodified verifier and the actual before/after strip pass. The lead also inspected that strip. Desktop jump attribution still reaches 957 calls, above the phone gate's 900-call numerical threshold; the official phone run is the required gate, and desktop batching remains a documented optimization follow-up rather than a claimed desktop-budget pass.
