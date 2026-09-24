# Bellhollow beauty pass (owner priority, 24 Sep)

Owner: "Visuals as close to AAA as possible. Environments must look coherent, not contrived to fit the gameplay loops. Every screenshot should look beautiful and coherent in the game style."

## The test
A fixed **beauty board** of canonical frames at the real gameplay camera (1280×720 and 390×844), captured by `tools/beauty-board.mjs` (world preview + real game where needed): every area, every mechanism, idle and active, day and restored. Each frame must pass all rules below. Any frame that fails is a bug.

## Rules
1. **Value and saturation hierarchy.** Large surfaces (floors, walls, decks, trunk) are calm: mid-value, lowered saturation, weathered. Saturation is reserved for accents: coral cloth, polished copper, lantern gold, wind, flowers. No big flat saturated orange/teal areas. Squint test: the hero, the objective and the path read first.
2. **Believable structure.** Nothing floats. Every platform is carried by beams, brackets, ropes or branches visibly attached to the trunk or a limb. Walkways follow branches. Houses sit on platforms with posts.
3. **Infrastructure belongs.** Gameplay objects are village machinery with a purpose and a history: vents are stone-rimmed "wind wells" set into floors with pipes feeding them; pipes run along walls, branches and under decks, clamped with brackets, and start and end at machines. Nothing crosses the air for convenience. Sails, levers and valves sit on housings with supports.
4. **Composition.** No tall dark objects in the near foreground at the gameplay camera. Foreground framing is low and soft (foliage, railings). Keep a clear read of the hero's path. Leave breathing space; group props into purposeful vignettes (A Short Hike lesson), not even scatter.
5. **Material richness.** Every large surface has painted detail: grain, joints, edge wear, moss in corners, grime under eaves, soft AO where things meet. No CAD-clean primitives at gameplay scale. Irregularity ±2–4° and varied proportions.
6. **Nature integration.** Moss and vines on timber and stone, leaf clusters grounded on branches, roots gripping masonry, flowers in planters. The tree is alive and old; the village grew into it.
7. **Depth.** Layered atmosphere: near (crisp), mid (neighbouring canopies as leaf-cluster masses, never faceted blocks), far (painted valley and sky). No white voids, no low-poly slabs in the distance.
8. **Clutter control.** Repeated elements (railings, lanterns, bushes, flags) vary in rhythm and spacing and are thinned where they compete with the subject. The Hollow must feel dramatic and legible, not busy.
9. **Characters and FX.** The hero, Mara and the guardian always read clearly. Wind, water and fire are natural (soft, particulate), in contrast to the cel world.
