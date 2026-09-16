# Hero candidate C — sculpted construction

Authored from `setup-evidence/atlas-pilot/style-reference.png` and STYLE.md, independently of other candidates. Generated image labels and invented names were ignored. No Atlas generation or paid operation.

Strategy: low-segment rounded masses for face, swept hair, torso, sleeves, trousers and boots. Four bevelled cloth panels and two rounded side gores form an asymmetric split coat. Broad ivory collar, turquoise cuffs/fastening and copper belt details carry the style at a distance. No literal triangle/mesh data, textures or imports. Materials are named fabric, plaster and metal.

The joint tree contains all requested names under `userData.joints`. Every limb segment is offset beneath an anatomical pivot; hips owns the body and the head and shoulders, knees descend from thighs, feet from shins, hands from forearms. `coatLeft` and `coatRight` pivot at the belt. Attach the separate staff to `userData.grip`, the `staffGrip` child of `joints.rightHand`; local grip position `(0,-0.027,0.04)`. Use `keepHierarchy: true`. Root has uniform height-normalization scale, so retain it.

## Actual verification

Ran recipe `harness/verify.mjs` against this folder at 560px. Final result **1/1 clean**, 8,396 triangles, 55 meshes, bounds **0.643 × 1.350 × 0.329m**. Height expectation tolerance 1.5%. Files: `_verify/report.json` and `_verify/sheet.png`.

Inspected front/right/back/left/three-quarter views. Initial profile exposed a coat-panel side gap; added rounded side gores and reran verifier. Inspected final sheet: clean front silhouette, rounded face and swept hair, readable collar, full back construction and separated feet. No missing-face exemptions.

PROC03 structural contract passes the recipe gate; ART02 evidence is the inspected still sheet, subject to comparative selection and actual runtime shading. ANIM01 is **not passed**: pivots exist, but this task did not test a motion cycle or a held staff. Remaining risks: coat/leg intersections in wide strides, finger closure around staff, and facial readability at 9–13% screen height. The neutral arms need runtime pose authoring. Fifty-five meshes should be baked by material within each joint, preserving hierarchy, before final performance review. No gameplay, phone performance or audio claim.
