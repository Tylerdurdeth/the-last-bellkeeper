# Environment kit B — profiles, extrusions, sweeps

Eight independently authored candidates, based on the inspected pilot image's broad forms and approved STYLE palette. No generated labels adopted; no paid calls, downloads, imports or external geometry. Wheel support/rotor structure and gate mechanics are interpretations where the reference does not provide readable construction.

## Verification

Official recipe verifier: **8/8 clean**, and all five views per asset in `_verify/sheet.png` inspected after repairs. Measurements in `_verify/report.json`.

| Asset | Triangles | Meshes | Notes |
|---|---:|---:|---|
| terrace | 7124 | 3 | 14.771 × 1.320 × 11.471 m including rail. Material merge preserves all rail geometry. |
| tree | 5598 | 39 | 7.099 m tall; broad carved canopy, swept trunk and roots. |
| staff | 1236 | 7 | Exactly 1.25 m tall; hollow copper bell and loop crook. |
| wheel | 4048 | 26 | 1.8 m rotor, 2.09 m overall. Ivory seed-shaped paddles; rear bearing support. |
| lantern | 1188 | 8 | 0.617 m tall; enclosed turquoise seed and copper ribs. |
| foliage | 3120 | 28 | 1.498 m depth; individually extruded leaf silhouettes. |
| gate | 1792 | 17 | 1.8 m tall; 2.241 m outside post width, approx. 1.58 m clear opening. |
| windworks | 4284 | 43 | 3.844 m tall; three tapered towers, curved copper roofs and bridges. |

Initial terrace had 161 raw meshes. Merged its static generated geometry into three material meshes, then re-ran gate and visually checked the unchanged silhouette. Staff rescaled to exact target height. Moved wheel supports behind rotor and added a rear crossbar/axle, fixing the original post/paddle intersection in the static view.

## Runtime integration

- Every module independently returns a centered grounded Group, +Z front, material names set to recipe categories.
- Terrace front +Z rail is interrupted for entry. Its nominal deck is ~0.55m, but bevel grounding shifts the final top slightly; inspect actual surfaces for collider height rather than assume the original profile coordinate. No collision shapes supplied.
- Wheel exposes `userData.rotor`, centered on its axle; rotate around Z. Load with hierarchy retained and never merge across this joint.
- Gate exposes `userData.door`; hinge is at its left edge. Rotate around Y. Door sweep and collision transitions still need motion tests.
- Staff is grounded as an asset, not centered on the grip; attachment must offset shaft into the actual hand socket.
- Materials intentionally flat for the shared runtime shader; these neutral recipe renders do not establish final scene lighting.

## Risks and selection

The tree is deliberately more compact and toy-like than the illustration; windworks side elevations remain simple distant architecture. Lantern is a solid seed body, not transparent glass. The wheel's thin paddles read clearly in front views but need motion/occlusion assessment at the gameplay camera. The terrace is a large open stage that requires the other selected kit assets for scene richness. No animation, gameplay, frame-rate, phone, audio or final-art pass claimed. TEST01/08 receive candidate and visual-inspection evidence only, pending comparative selection and actual playable-scene checks.
