# Environment candidate C — sculpted organic construction

Eight independent modules authored from the inspected pilot image and STYLE.md. Did not read other candidates. Image labels ignored. No Atlas spending, downloads, imported geometry or literal mesh arrays. `build_assets.py` is a local source-writing helper; each output module is independently executable with the recipe default function(T) interface.

Strategy: rounded carved platform and posts, layered low-segment foliage masses, visible spreading roots, narrow structural copper framing, and discrete ivory/copper silhouettes. The obscured wheel mechanism is explicitly interpreted as an original seedwheel, rather than claimed as a faithful reconstruction. The gate is likewise an original functional interpretation using the reference materials.

## Actual gate and visual inspection

Official recipe verifier: **8/8 clean** at 560px per view. Inspected complete five-view sheet, then corrected tree grounding and made staff exactly 1.25m. Reran the official verifier and visually inspected final tree and staff views.

| Module | Triangles | Meshes | Width × height × depth, metres |
|---|---:|---:|---|
| foliage.js | 2,768 | 27 | 1.247 × .737 × 1.331 |
| gate.js | 1,800 | 18 | 2.04 × 1.84 × .46 |
| lantern.js | 1,176 | 16 | .337 × .599 × .300 |
| staff.js | 1,320 | 9 | .220 × 1.250 × .212 |
| terrace.js | 7,424 | 98 | 14.8 × 1.355 × 11.5 |
| tree.js | 5,720 | 47 | 6.046 × 6.831 × 5.300 |
| wheel.js | 3,280 | 27 | 2.040 × 2.025 × .680 |
| windworks.js | 3,656 | 34 | 3.460 × 3.920 × 1.098 |

No blank-side exemptions. Still sheets and machine report are in `_verify/`.

## Integration

- Terrace walk surface is .55m, front opening faces +Z. Visually modelled rail is approximately .8m above deck. Gameplay needs collision boundaries and a safe arrival route; geometry alone does not establish safe traversal. Terrace is a single-level prototype interpretation of the more complex image.
- Wheel outer rotor diameter 1.79m; total width includes stands. `userData.rotor` rotates around local Z at its hub. Keep hierarchy and preserve this pivot.
- Gate `userData.door` pivots around its left post; rotate local Y. Keep hierarchy.
- Staff `userData.gripY=.39` records uncentred vertical grip coordinate. Ground normalization translates its base by approximately -.025m, so the grip in the returned group is approximately .365m above ground. Attach with that offset or measure it during pose integration.
- Runtime should batch rigid scenery per material and retain moving pivots. Terrace's 98 authored meshes should not remain 98 independent draw calls after loading.

Remaining risks: still sheets do not establish gameplay readability, rich-scene composition, animated wheel/gate clearance, staff grip fit, collision safety or phone performance. Tree/foliage use broad rounded masses and need comparison under actual painterly runtime lighting; distant windworks roofs are simpler than the image. TEST01/08 remain integration outcomes, not passes from this gate.
