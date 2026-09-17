# Desktop anatomy correction — 2026-09-17

Addresses the desktop screenshots of the profile neck bulge, oversized head, flat stringy hair, and malformed hands. Head and hair scale reduced to 80%; overlapping neck shapes replaced by one tapered neck. Hair rebuilt as broad closed swept locks with longer side/nape layers and an irregular underlayer edge. Both hands now have four graduated fingers, an opposed thumb, wrist joins, and an inward-facing relaxed pose. Added Face profile and Hands close-up views.

Independent agent review identified a straight nape edge, palm-forward rest pose, and cylindrical neck. Repairs passed targeted visual retest. Reviewer accepts this as a correction pass, not Zelda parity. Remaining polish: angular neck/jaw transition, simple finger joints, chunky hair masses. Review used still poses, not temporal animation assessment.

Validation: motion blend and negative-frame-time regression, boot deformation, character studio keyboard/emulated touch, real-input acceleration/turn/braking/repeated jumps, and recipe geometry verification. Final geometry: 54,708 triangles; no downloaded meshes. Approved animation clips unchanged. Wrist correction applies only to the new anatomical hands. Atlas facial texture retained. No new Atlas spending.

Selected final evidence is in desktop-anatomy-final/. Full local iteration captures remain excluded from the shipped payload.

## Handedness correction
User identified that both hands had mirrored finger layouts. Corrected the thumb side and mirrored the index-to-pinky order in the geometry template; palm, wrist pose, animation, and all other appearance remain unchanged. Fresh close-up and walking/running stills inspected. Studio keyboard/touch and rendering checks pass.

## Complete hand swap and axial rotation
The user rejected the earlier finger-only correction. Applied the requested complete hand swap and 180-degree rotation about the local arm axis using a geometry group beneath each unchanged animation joint. Includes palm, back patch, wrist, fingers, and thumb. Independent review verified the requested transformation and connected wrists in side/idle/running captures; this is not a claim of anatomical acceptance. Studio rendering, keyboard, and emulated-touch checks pass.
