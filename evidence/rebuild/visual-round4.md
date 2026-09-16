# Independent visual rebuild review — round 4

16 September 2026. **FAIL: newly integrated broad canopy fully hides the hero during the garden arrival capture.** This failure overrides the improved crown style and successful scripted route. Subsequent lead fixes are outside this report.

Working-tree snapshot identified by `visual-round4/input-sha256.txt`. Own normal-input copies of test-rebuild generated desktop1440×900 and phone430×932 arrival/cottage/roots/chime/capture/bridge/finish captures. Separate `visual-round4-arc.mjs` approached the chime normally and moved through east[-7.3,-14.4], south[-8.5,-13.5], west[-10,-15] positions at both viewports. Read-only telemetry guided keyboard routes; no pose/state mutation. Scripts completed successfully; no art approval inferred. Concurrent browser runs are not valid performance measurements. Phone route uses responsive viewport with keyboard steering, not a physical phone.

## Targeted results

- **Canopy shape direction improves:** sharp feather/spear silhouettes are replaced by quieter rounded masses with branch gaps. Finish/runtime-overlook reads less spiky than round3, and the layered valley remains visible. This addresses the specific prior shape-language request. The deliberately simplified masses are still less nuanced than R02, but another speculative tree redesign is not the immediate next step.
- **Garden occlusion regression, major:** desktop/runtime-chimes and phone/runtime-chimes show opaque near leaves hiding almost the entire apprentice; phone frame contains no clearly locatable body. These are captures shortly after stopping at the chime approach, approximately80ms after input release plus screenshot latency. They prove a transition failure, not persistent invisibility for seconds. Capture-point frames clear again.
- **Small movement arc:** later east/south/west screenshots generally show the hero again, confirming the obstruction varies over space/time rather than establishing that the material never fades. West position can overlap lower body with chime cap; source/capture remains legible. This is why a settled isolated screenshot is inadequate to approve the fade repair.
- **Arrival and finish neighbors:** no comparable full-body loss in the inspected arrival/finish frames. Grounded woodland, cottage dressing, broad foliage banks and layered finish environment remain intact. Successful completion shows control logic works through the obstructed frame, not that the visual defect is harmless.

## Required bounded repair and acceptance

**Highest priority: make visibility continuous while approaching/turning, not only after settling.** Diagnose actual rendered transparency/material behavior with the current crown instead of adding more sample rays blindly. The report is observational: lead separately diagnosed an opaque-shader compile issue after these captures; that diagnosis is not independently verified here.

Retest the exact normal-input approach to[-8,-15], ring/capture, a small arc and retreat in both viewports with normal-speed or high-frequency transition capture. Hero's head, torso, feet and tool must remain locatable throughout; no opaque flash followed by delayed disappearance. Preserve canopy elsewhere and avoid a camera snap. Retest cottage transparency because shared material behavior may be affected. Keep these failed frames as baseline.

The main remaining failure is concrete and repairable inside the first scene. Replacing the tree again or buying a new concept would not address it. High-bar presentation acceptance remains withheld pending this visibility fix and adequate motion evidence; no blanket AAA/art-polish certification is supplied.
