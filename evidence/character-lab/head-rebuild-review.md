# Head rebuild — 17 September 2026

Baseline: 39f43a2. Source and runtime are committed together with this report. Selected captures: head-release-5/face.png, side.png, back.png. Full local iterations remain outside the published payload.

## Changes

- Replaced the oval head with an interpolated cheek/jaw/chin profile and integrated nose volume.
- Replaced the hair mass with swept, root-and-tip tapered ribbons, overlapping crown/nape layers, asymmetric bangs and finer diagonal rear locks. Removed detached shadow seams on these thin surfaces.
- Atlas R07 supplies original facial colour fitted with UV controls and masks. Animated almond eyes use live iris shading and blinking; painted eyes and background are excluded.
- Coherent facial normals and a dedicated narrow soft-edged cel ramp replace fragmented cheek lighting. Reduced painted nostril shading and adjusted mouth mapping.
- Original code-built body and CC0 animation tracks remain. No generated/downloaded 3D mesh is shipped.

## Independent review and repairs

Distinct agent review against the user's Link/BOTW screenshots, not a human art-director certification. Initial review passed face silhouette and charisma but rejected bulbous hair, dark gaps and muddy facial rendering. Subsequent reviews caught a cheek lighting island and then a hard facial stripe; both were repaired and independently confirmed resolved in head-release-3. Face silhouette, charisma and hair readability passed. Small additional rear locks and root taper were inspected by the implementer after that review; they are not covered by an independent final approval.

Reference polish remains FAIL: broad hair grouping and nose/lip rendering still differ from BOTW's highly controlled graphic finish. This report does not claim the user's full aesthetic target is met. Stills cannot establish animation quality. Existing locomotion was retained, not independently re-rated as animation art.

## Validation

Local character regression passed: all source studies and movement modes, freeze/frame step, keyboard movement, emulated touch, desktop/phone layouts, facial texture response, no HTTP failures, no console/page errors, no downloaded mesh requests. Physical iPhone testing is not available here.

Official recipe verifier passed the code asset. Exact report is retained alongside this file. Geometry-only verifier does not certify runtime facial texturing or artistic quality. Main woodland is unchanged by this studio work.

## Cost

One new direct Atlas image, R07: 5 credits settled, 0 reserved. Rebuild 37/400; verified account balance 1,947. Prompt and provenance ship with the texture. No paid 3D or assistant retry.
