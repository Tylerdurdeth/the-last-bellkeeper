# C1 independent critic — preview 3 (69e1bcc), 25 Sep 2026 (saved by lead)

Full keyboard route (1280×720, fragments, 218 frames, ~475 s) and touch route (390×844, 187 frames, ~305 s), 0 console errors, plus Q/E yaw triplets per area. Evidence: desk/, phone/, crops/.

Owner checks: rings nearly vanish on sunlit cobbles (crops/ring-on-cobbles.png; wind.js ~217 underlay too weak). Fragment-2 look fires but lasts ~0.5 s; the "glint" is a flat mustard diamond occluded by a rope and a copper pole (crops/frag2-glint-look*.png; world.js 973–978, quest.js 239).

Punch list (most damaging first)
1. Backdrop giant trees = fogged cardboard: translucent, jagged cut-out canopy, floating clumps, striped grey valley band wall (desk/58, crops/cap-bg.png, crops/ghost-tree.png). kit/backdrop.js, render/sky.js.
2. Hollow walls: grid of square texture seams, smeared well walls, carvings are hanging frames (crops/hollow-wall-tiles.png, crops/well-wall-stretch.png, desk/158). world.js ~670–680, kit/trunk.js.
3. Story beats framed without subject: morning bell small/hidden, lantern covers first ring; bridge swing, cap turn, Pipes/Ladders restored, finale wind flood not shown (desk/13, 47–49, 58, 109, 134, 208). main.js ~265–271, quest.js.
4. Updraft columns = hard-edged translucent boxes (crops/rise-column.png). render/fx/wind-fx.js.
5. Gusts = thick opaque cyan cel ribbons (crops/terrace-vents-ribbons.png). wind.js 220–223.
6. Floating geometry: cobble slabs off terrace edge, windmill islands/fragment platform as floating tubs, faceted unoutlined branch slabs.
7. Near-camera props: giant lantern cap, teal pillar, bark mass; screen-door dither on lamp posts. render/toon.js ~111–128.
8. Repetition/infrastructure: identical flower grilles, seed wheel = pipe wheel, loose pipes on cobbles, orange slab shutter, door arch to nowhere, bead-string ivy, sail reads as flag.
9. Phone: hero under stick/button, guardian out of frame, loft vista shows no mills, joystick visible in finale (style.css 60), action label wraps 3 lines, caption on hero's feet.
10. HUD/text: ghost "Look around" button (style.css 33–35), prologue 2 text over subject, phone eyebrows on busy art (opening.css), title tagline unreadable.
11. Materials/lighting: cobble on stair risers, oversized cobbles, blown-out cream ending terrace, guardian skirt translucent on exhale.
12. Ending card is a small toast over an ordinary frame, no bell.

Also seen (already being fixed): yard camera collapse (desk/32, 36), ghost walls (desk/17), character shading.

Verdict: route solid and bug-free; best frames (finale village desk/210, Hollow gate, sky bridge, first loft vista) hold up, but most branch-level frames lose a blind pair because of the backdrop; Hollow texturing reads as a bug; the game skips its own payoffs; the central wind still looks like cel ribbons and glass boxes. Top four: backdrop trees, Hollow walls, beat camera shots, softer updrafts/gusts.
