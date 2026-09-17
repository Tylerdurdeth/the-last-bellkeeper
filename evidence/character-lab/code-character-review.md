# Code-built character correction

Reference: Atlas R06 character sheet. Three head constructions: A deformed sphere with integrated nose/eye sockets; B revolved jaw profile; C flatter frontal plane with narrower jaw. All have swept tapered hair volumes, curved eye surfaces and a fine mouth seam. A selected for the more consistent eye fit and softer jaw. Existing code-generated body adapted with skin forearms, cream cuffs, reduced scarf and bell pendant. Blinking added.

Every visible mesh is now constructed in Three.js. Downloaded models removed from game/docs and retained under experiments only. CC0 animation tracks and rest transforms are extracted into motion.json, without any geometry; unused finger tracks removed. No mesh is encoded as numeric arrays or reconstructed from source vertices.

Retargeting fixes: mirrored bone naming, source/target rest arm direction, and boot-ground correction preserving source flight height. First round’s sideways arms and hovering boots were rejected. Remaining limitation: segmented limb construction and simplified facial features still read more like a stylized prototype than the Zelda references. Cloth motion is simple; no claim of final art approval.

Validation: official recipe verifier 3/3 clean, approximately23–24k triangles per study; official ship checker all modules parse and paths stay inside directory. Desktop and emulated-touch studio checks pass, including all studies/baseline, motion clips, freeze/step, keyboard/touch movement, zero mesh-file requests and no browser errors. Physical iPhone and final jam acceptance unverified. Source recipe revision4effad311c5e137bca316257259fe5bffd6737de.

Atlas additional cost0. Woodland runtime unchanged.
