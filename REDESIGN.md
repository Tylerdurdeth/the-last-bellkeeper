# The Last Bellkeeper — redesign (v2), 24 September 2026

Owner verdict on v1: graphics weak, design boring, world small and repetitive, guardian finale poor. v2 keeps the
foundation (movement, camera spring-arm, save/continue, HUD/touch, audio, build/test/deploy, jam gate) and rebuilds
world, art, gameplay and the finale. Freeze: 25 Sep 18:00 UTC. Jam rule: every 3D object is procedural Three.js
code; Atlas supplies images only (reference sheets, textures, sky/backdrops, sprites, audio).

## Pillars
1. **The wind is a physical tool, not a parcel.** Every beat changes what the player can reach or move.
2. **One vertical place you learn by heart.** Bellhollow, a village grown into a colossal tree, matching the title art.
3. **Show, don't caption.** Landmarks, light and motion carry direction; captions are short flavour, never instructions
   the world failed to show.
4. **A finale worth the climb.** The guardian is a readable, escalating set-piece, then a staged payoff.

## Story (unchanged spine, restaged)
Bellhollow borrows wind from the Heartwood through paired bells: one sends breath out, one lets it return. This morning
the bells are silent. Mara, the last bellkeeper, holds a manual bypass so the village can breathe; the apprentice takes
her staff and climbs down to the windworks. The guardian that sealed the chamber is not the villain: it is protecting
the tree, because generations only ever rang the *outward* bell and the Heartwood is exhausted. The apprentice finally
rings the forgotten return phrase; the tree breathes in; the far bell answers. Mara: "I taught you how to call it.
I forgot to teach you how to listen." The twist is discovered in the Hollow (carvings + guardian behaviour), never
stated before.

## Wind verbs (movement/gameplay foundation extensions)
- **Catch** (existing): stand in a gust, Space. Charge shown on the staff bell. One charge at a time.
- **Give** (existing): release into a wheel/rotor/sail at a marked target; generous assisted aim.
- **Updraft** (new): release the charge into a *floor vent* (copper grille) → a column lifts the hero ~4–6 m to a
  ledge above; the column persists ~4 s so the player can steer onto the ledge. Jump inside a column = extra lift.
  This is the main vertical traversal and makes jumping matter.
- **Push** (new): release toward a *sail* or *light object* (hanging bridge, shutter, seed-pod raft, weather vane) to
  swing/rotate/slide it. Objects stay where pushed (puzzle state), with a visible reset lever nearby.
- **Chain** (new): some wheels, once powered, spit a new gust at their outlet a few metres on — routing wind across
  gaps by ordering which wheel you power.
No combat, no inventory, no loot. Failure = safe knock-back to the last ledge, charge kept.

## World: Bellhollow (single connected space, ~90 × 90 m footprint, ~30 m tall)
Great trunk at the centre (Ø ~18 m, visible from everywhere, carved bell-galleries and copper pipes). The camera
looks down from the south-east as today. Walkable surfaces may overlap vertically (layered ground, see Interfaces).

1. **Canopy Terrace** (y ≈ 0, south face of the trunk; the start). A dense little village: 6–8 houses of 3 distinct
   types from one kit, bell towers, lantern lines, laundry, market stalls, Mara's workshop with her bypass lever, the
   morning bell. Frozen life: drooping flags, still pinwheels, sagging lanterns — they all come alive as wind returns.
2. **Windmill Branches** (y ≈ 5–14). Three great branches spiral up/out from the trunk, each ending at a windmill whose
   sails are stopped. Each branch is one small puzzle built from the verbs; the player chooses the order (real choice).
   Each windmill restored lights a lantern chain on the trunk and extends one plank of the **Sky Bridge** toward the
   Hollow gate. Optional: 3 bell fragments (one per branch, off the main line) → a lore carving + keepsake.
3. **The Hollow** (inside the trunk, open on the camera side like a split geode; y ≈ 0 down to −14). A descending
   spiral gallery of old windworks: carvings of the paired channels, the return channel choked with roots, the guardian
   at the bottom.

## Beat sheet (target 12–15 min for a first-time player, no padding)
| Time | Beat | Teaches / payoff |
|---|---|---|
| 0:00–0:40 | Illustrated title → 20 s in-engine intro: the terrace at dawn, bell tolls dull, lanterns sag, pinwheels stop; guardian silhouette shutters the Hollow. Settles into play. Skippable. | Tone, landmark (trunk + Hollow gate) |
| 0:40–2:00 | Ring the morning bell (dull). Mara throws the bypass; a gust puffs from her outlet. Take the staff. Catch → give to the terrace seed wheel: gate opens, laundry lifts, pinwheels spin, seed pods open. | Catch/Give, first consequences |
| 2:00–3:30 | Past the gate: a floor vent under a lantern loft. Mara: "Breath goes up before it goes anywhere." Updraft to the loft; view over the whole tree. | Updraft; verticality; the map of the level from above |
| 3:30–9:00 | Three branches, any order. **Mill of Sails**: push a hanging bridge into place, cross, restore. **Mill of Pipes**: chain two wheels to route a gust across a gap. **Mill of Ladders**: updraft-hop between three ledges, one with a timed shutter. Each restoration visibly changes the village (colour, motion, sound). | Push, Chain, combinations; choice of order; optional fragments |
| 9:00–10:00 | Sky Bridge complete; cross into the Hollow gate. Descending gallery: carvings show wind going out AND returning. | Discovery of the twist |
| 10:00–13:00 | **Guardian set-piece** (below). | Mastery of all verbs |
| 13:00–14:30 | Payoff: ring the paired bells (two-part phrase). Camera rises through the Hollow and out over Bellhollow as wind floods back: every flag, mill, lantern and pinwheel in the village animates, the guardian folds and tends the roots. Cut to Mara at the terrace; the far bell across the valley answers. Her line. Completion card (small, bottom). | Emotional payoff, cohesion |

## Guardian set-piece (replaces v1 disc encounter)
Arena: a tall circular well in the Hollow, three rings of ledges (low/mid/high), each ring with one **return vane**
that must be turned. The guardian (rebuilt, ~4 m tall, bell-bodied, petal-hood, rotor heart) hovers at the centre.
- **Phase 1 (low ring):** it inhales (3 s, body swells, petals flare, rotor glows), exhales a sweeping lane across the
  ring. Dodge (clear telegraph lane on the floor), then catch its spent breath at the lane's end and give it to vane 1.
  Vane 1 turns → a vent opens.
- **Phase 2 (mid ring):** updraft from the vent to the mid ring. Now it alternates two lanes; its spent breath can be
  caught only between them. Vane 2 → next vent.
- **Phase 3 (high ring):** it exhales straight up the well in pulses; ride a pulse (updraft) to the high ring, catch
  the last breath, give it to vane 3.
Knock-back on a hit returns you to the ring's safe ledge; phases never reset once done. Camera frames guardian + hero
(existing framing) and rises with the rings. Readability over difficulty; the whole fight ~3 min.

## Art direction
- **Style sentence (style lock, reused verbatim in every reference prompt):** "Hand-painted cel-shaded fantasy
  diorama, chunky readable shapes with soft bevels, warm ivory stone and honey timber, verdigris copper and coral cloth
  accents, two-tone shading with crisp soft-edged shadows and thin dark ink outlines, Studio Ghibli warmth meets
  Wind Waker clarity, single object on plain white background, three-quarter view, even lighting."
- Palette (hex, roles) and real sizes: see STYLE-LOCK.md.
- Rendering: toon ramp (2–3 bands) + coloured shadow tint + rim light on all characters and props; inverted-hull or
  post outline; painted Atlas sky dome and distant valley backdrop; per-area light rigs (dawn terrace, bright branches,
  cool-to-warm Hollow); restoration crossfades lighting.
- Assets from references: every new asset gets an Atlas reference sheet first (recipe), then procedural build, verifier
  renders, selection. A **kit** (house walls/roofs/timber frames/railings/stairs/lantern/pipe/grille/sail/wheel) builds
  the village with variation instead of one-off props.

## Interfaces (contract between workers)
- **Layered ground:** `sampleGround(x, z, y)` returns the height of the highest walkable surface at (x,z) that is
  ≤ y + 0.35 (step), or null for void. `blocked(x, z, r, y)` likewise uses y. movement.js passes its current y.
  Old single-height functions ignore the third argument (backwards compatible).
- **World module** `game/bellhollow/world.js`: `buildBellhollow({THREE, scene, assets})` → `{ground(x,z,y),
  blocked(x,z,r,y), points:{...named anchors}, vents:[{id,x,y,z,top}], wheels:[...], sails:[...], ledges, update(dt,t,
  state), atmosphere(...)}`. No gameplay state inside.
- **Quest module** `game/bellhollow/quest.js`: progression, contexts (`context(p)`→{kind,label,target}),
  `interact(...)`, objectives, save/restore (save key `bellkeeper-adventure-v2`; v1 saves ignored → start fresh with a
  friendly note), events `onChange(progress, event)`.
- **Guardian** `game/bellhollow/guardian.js`: actor + encounter clock + lanes; emits catchable gusts and knock-back.
- **Main** stays the host (renderer, camera, HUD, audio, opening), trimmed of v1 woodland/campaign specifics.

## Budgets
Phone gate: ready < 20 s (v1 is 17.6 s — must not grow; prefer procedural over big textures, lazy-create far areas),
≤ 10 MB, ≤ 900 draws (target ≤ 650), ≤ 1.5 M tris (target ≤ 900 k). Desktop 60 fps target.

## Cut from v1
Old woodland route and layout, Rootway, tender construct, disc Heartwood, v1 campaign progression, listening-garden
instruments as separate puzzle (their bell shapes are reused as windmill chimes), cottage-only village.
