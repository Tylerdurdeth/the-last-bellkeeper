# Hero B — curved profiles and extrusions

Independent candidate built from the inspected pilot reference. Generated image labels and name were ignored. Uses the approved coral, ivory, turquoise and warm-dark palette; no external geometry, textures, imports, or Atlas calls.

## Actual result

- Recipe verifier: **1/1 clean**, after a repair pass.
- 7,632 triangles, 48 meshes; measured 0.515 × 1.350 × 0.356 m.
- Render: `_verify/sheet.png`; measurements: `_verify/report.json`.
- Five rendered views inspected. Front silhouette and expressive eyes read; coat wraps front and back, hair sweeps forward, boots have rounded toes. Side view remains deliberately chunky and less organic than the illustrated reference. This is a visual-selection candidate, not an accepted hero.

First pass revealed oversized width and excessively square side head. Repairs reduced overall width, softened head/crown bevels, added rounded boot toes, and wrapped the coat tails around the legs. Final dimensions now satisfy the expectation file.

## Rig contract

`userData.joints` exposes hips, head, leftUpperLeg, leftLowerLeg, leftFoot, rightUpperLeg, rightLowerLeg, rightFoot, leftUpperArm, leftLowerArm, leftHand, rightUpperArm, rightLowerArm, rightHand, coatLeft and coatRight. Pivots sit at joints and children offset from each pivot. Right hand contains a named `rightGrip` child, also accessible through `joints.rightHand.userData.grip`. Attach the separately produced staff there and load with `keepHierarchy: true`.

## Remaining risks

- No motion pass claimed. Walk, knee bending, foot planting, cuff clearance and coat/leg clipping need actual recorded movement if this candidate is selected.
- Static open-hand shape is compact. Grip/staff intersection needs review when the staff is attached.
- The approved material names are set but the game's shared cel shading is not applied in this recipe sheet.
- Facial details will be small at gameplay scale. Hair, coral body and ivory collar provide the primary distant recognition.
- 48 raw meshes should be merged only within each rigid joint subtree if draw calls require it; merging the whole asset would destroy articulation.

Criteria: PROC03 has generated geometry/render evidence; ART02 has inspectable candidate evidence, pending comparative selection; ANIM01 provides articulated structure only, pending motion verification.
