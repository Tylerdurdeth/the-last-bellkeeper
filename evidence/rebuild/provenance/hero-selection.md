# Hero reconstruction — 16 September 2026

Reference directly visually inspected: `/Users/seb/Documents/ChatGPT/Project BellKeeper/setup-evidence/rebuild-atlas/hero-r01.png`. Original coral-coated human with long split tails, asymmetrical ivory shoulder cape, swept purple-brown locks, confident almond eyes/smile, teal trousers, wrapped copper-toe boots, fingerless glove and bell staff. Staff excluded from these constructions as requested.

## Selection: A, with explicit limits

A is the best base for animation and runtime shading. Its swept comma silhouette, lean waist/shoulders and comparatively natural face read more confidently than B and C. It does not reproduce the reference's beautiful flowing hair or tailored garment folds fully. The cape remains a stylized shell and the side silhouette is thin. Motion, actual-camera charisma and game lighting are not yet approved. Do not call this final character art solely because the recipe passed.

Observed all five rendered views for each candidate in `_verify/hero.png` after repairs. Initial eye extrusions looked like goggles; replaced with surface almond shapes, smaller irises and tighter lids/brows, lowering face projection. Initial cape was two flat boards; added procedural curvature and a broad fold. A's initial hair was blocky; replaced its polygon locks with closed curved comma profiles. Final sheets show clear human faces without the goggle problem, complete side/back costume and visible boots/hands.

| Candidate | Independent construction | Final triangles | Meshes | Final measured size (m) | Visual finding |
|---|---|---:|---:|---|---|
| A | Tapered/sculpted solid anatomy; separately shaped chest/waist/jaw; curved closed hair profiles | 9,256 | 78 | .604 × 1.600 × .296 | Best swept hair and approachable face; simplest usable silhouette. Cape/body side view still thin. Selected. |
| B | Lathed radial tailored torso and limbs; extruded contour face; layered front/back tails; profile boots | 7,612 | 74 | .650 × 1.600 × .290 | Long helmet-like face/hair, exaggerated shoulder width and rectangular boots. Reject versus A. |
| C | Curved tapered anatomical bone sweeps, faceted jaw and separate upper body masses; swept fingers | 8,884 | 79 | .595 × 1.600 × .308 | Better organic arm/leg bend, but cheeks/hair still awkward and less clean than A. Reject versus A. |

These are distinct body/face/hair/limb constructions, not parameter variants of one body. Shared material/rig utilities, facial-feature vocabulary and garment accessories maintain a controlled comparison. `build-candidates.py` contains three independently authored construction blocks and emits the modules; no imported mesh or literal vertex data used.

## Articulated rig contract

`root.userData.joints` maps names to pivot Groups: hips, head, cape, leftUpperLeg, leftLowerLeg, leftFoot, rightUpperLeg, rightLowerLeg, rightFoot, leftUpperArm, leftLowerArm, leftHand, rightUpperArm, rightLowerArm, rightHand, coatLeft, coatRight. Root has `keepHierarchy=true`.

Local axes: +Y up, +Z forward. Legs extend down from hips. Upper-leg pivot to knee is approximately .334–.335 local m, knee to ankle .300–.310; upper-arm to elbow .211–.217; elbow to hand .193–.199. Whole model is normalized to 1.60m; root scale applies equally to these lengths. Rest arm rotations have a mild outward angle and forearms flex slightly forward. Preserve each pivot's rest rotation before adding motion, especially arm z and forearm x. Animate cape independently through joints.cape; head pivot is at neck. Tails hang from hips and can swing independently.

Right hand has `userData.grip={position:[0,-.025,.036],rotation:[0,0,0]}`; root.userData.grip also points to the rightHand Group. It is a hand attachment reference, not a staff already attached. Fit actual staff hand contact during pose testing. Figure is relaxed neutral, not T-pose. Bind pose is intentionally not an expressive final idle.

## Verification

All three final unmodified recipe verifier runs PASS. Command pattern:

`/Users/seb/.local/bin/node '/Users/seb/Documents/ChatGPT/Project BellKeeper/recipe-reference/harness/verify.mjs' '/Users/seb/Documents/ChatGPT/Project BellKeeper/asset-work/rebuild-hero/a' --size=800`

Repeat for b/c. Evidence preserved separately per candidate, including `report.json`, multi-view `hero.png`, `sheet.png` and `sheet.html`. A has groundOffset0 and centreOffset[0,0]; front/back/side detail tests pass with no exemptions. No game runtime/assets modified, no spending, no animation PASS claimed.
