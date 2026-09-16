# First-scene rebuild: observed benchmarks and original targets

Inspected 16 September 2026. Scope: one rich, replayable 3–5 minute first area. This is art direction, not a claim that the rebuild already meets the target. Zero paid generation. No reference-game assets downloaded or incorporated. Links identify copyrighted reference imagery for analysis only.

## What was actually inspected

| Source | Exact inspected view | Evidence limits |
|---|---|---|
| [Nintendo official Wind Waker HD gallery](https://www.nintendo.com/en-gb/Games/Wii-U-games/The-Legend-of-Zelda-The-Wind-Waker-HD-765386.html#Gallery) | Expanded `WiiU_TheLegendofZelda_TheWindWakerHD_01`: hero on bright grass with multi-level village behind; expanded `_05`: expressive close character with grass and white bird | Browser screenshot observed at 1280×720, imagery about 860×484. Still images, not animation inspection; hero scale in view 01 is deliberately much larger than our elevated gameplay camera can support. |
| [Blizzard official alpha article](https://news.blizzard.com/en-us/article/23658118/diablo-ii-resurrectedtm-technical-alpha-experience-the-legend) | Linked [Amazon portrait](https://bnetcmsus-a.akamaihd.net/cms/page_media/FX1CEKVCQ2FA1617672077856.jpg), 1920×1080 original, displayed 1280×720 | Character presentation, not gameplay. Brick arch, iron bars, broken timber, stones and grass observed. Article/product site requested age verification; no birthday supplied. Public linked image opened directly. |
| [PC Gamer beta article](https://www.pcgamer.com/you-can-get-a-diablo-2-resurrected-beta-key-by-watching-twitch-streams-right-now/) | [Cold Plains technical-alpha gameplay still](https://cdn.mos.cms.futurecdn.net/CAPJcpTffGNTjPNFQUUPLe.jpg), 1920×1080 original, displayed 1280×720 | Secondary-hosted screenshot, explicitly Diablo II: **Resurrected**, not original Diablo II. Shows field combat; cannot establish timings, audio quality, or exploration behavior. |
| Local Bellkeeper | `evidence/test-scene/start.png`, 1440×900; `STYLE.md`; `evidence/test-scene/delivery.md` | Current study visibly fails rich environment target; technical delivery explicitly records that failure. |

No footage was observed in this bounded review. Animation timing recommendations below are original production targets, not measurements from Zelda or Diablo. No audio assessment of either benchmark is claimed.

## Observations that change our decisions

Nintendo village still 01 has a broad quiet patch around the hero, but its background has overlapping walls, raised grass, steps, timber supports, asymmetric roof silhouettes, large trees, ocean and inhabitants. Surface detail follows construction. The near character has a clearly directed gaze and eyebrows. Still 05 pairs an expansive facial expression with a broad arm gesture; grass forms a coherent bank rather than isolated identical pots. The bird gives a recognizable sign of life.

The D2R gameplay still has grass and dirt variation across the entire ground, with quieter dark perimeter and bright localized spell shapes. Props sit within ground cover. Contrast concentrates around the action instead of making every piece equally bright. The official portrait separates rough masonry, sparse grass, weathered wood and reflective equipment within a consistent dark light treatment.

Our screenshot exposes the whole circular floor, source, conduit and destination simultaneously. Decorative plants repeat around an empty perimeter, the tree is a straight trunk topped with large balls, and the interface states the entire solution. This is a layout and directing failure before it is an asset-count failure. More objects scattered over the same disc will not fix it.

## Original design: the Waking Bough

Keep coral apprentice, copper bells, pale worn ceramics, living tree and turquoise wind. Borrow readability, environmental layering, material distinction and discovery rhythm. Do not borrow Zelda costumes, recognizable architecture, creatures, UI or melodies; do not import Diablo combat, loot systems or grimdark tone.

One compact area has five connected views, roughly 45×32m as a starting envelope. Never frame the entire solution at once. Total traversed route including return about 95–125m; walking distance alone is not the content or a duration gate. Running remains quick. First-time target 3–5 minutes comes from observation, decisions and optional exploration; repeat completion can be substantially quicker.

1. **Arrival, 0:00–0:30.** Emerge beneath close hanging branches onto a worn path. Through a gap see the dormant seedwheel above, beyond a broken garden crossing. A loose bell rings in the wind and a small bird departs toward the side route. Prompt says only “Wake the old windworks”; controls appear once. The wheel is a landmark, not an always-visible marker.
2. **Fork and first choice, 0:30–1:15.** Main path reaches the broken crossing and a readable empty bell socket. A copper conduit disappears into roots. One short side alcove contains an apprentice's workbench, repaired pots, tools, and a quiet keepsake. The real route curves uphill through a root arch. Wind stirs leaves in that direction. No arrow reveals it.
3. **Wind garden, 1:15–2:15.** A partly hidden clearing behind a trunk contains a wandering gust revealed by grass, suspended petals and directional sound. Two short safe jumps across stepping roots make locomotion useful. Capture requires facing/approaching a calm pocket after seeing the gust's rhythm, with generous timing and no punitive wait. A quick capture remains possible for a skilled player.
4. **Return with change, 2:15–3:15.** Carrying the gust makes seed flowers lean and small bells answer as the player passes. One new luminous detail reveals a narrow shortcut that overlooks the arrival area, making geography click. A harmless crosswind challenges movement once; failure drops wind nearby rather than resetting the whole trip. Walk/run/jump stay responsive while carrying.
5. **Restore and reward, 3:15–4:30.** Release into socket produces a visible causal sequence: bell resonates, channels fill, wheel catches, garden bridge unfurls. Crossing reveals a sheltered overlook with a vista and one optional discovered keepsake. Player control returns promptly after a short camera accent. Area stays explorable; no full-game expansion.

Scope can be simplified to four views if production cost requires it. Do not pad duration with forced slow movement, long interaction holds, unskippable text, or repeated identical deliveries.

## Concrete visual and performance targets

| Concern | Implementable target | Review evidence |
|---|---|---|
| Composition | Each authored view contains near silhouette, clear playable middle, distant tree/architecture layer. Main path bends out of sight at least twice. Ground fills the world rather than an exposed disc floating in flat sky. | Five desktop and phone captures, including arrival, fork, clearing, return and restoration. |
| Density | Cluster 3 scales: large roots/architecture; medium ferns/shrubs/workbench; small flowers/moss/leaf litter. Put detail at roots, cracks, banks and human activity. Preserve a 2.4m readable travel corridor. Avoid evenly spaced decorative objects. | Inspect at actual play scale, not only close-up sheets. |
| Surface | Distinct broad painted color breakup on wood, plaster and foliage, weathering located at joins and contact. Colored 2–3-band character light; softer environment transitions; shadow contact at feet and roots; metal gets restrained directional highlights. | Same camera before/after lighting and material work. Flat base colors with stronger bloom do not pass. |
| Hero | Strong swept hair wedge, visible eyebrows, open expressive face, offset coat hem and oversized practical cuff. Large head/hand shapes, clearly human bent-elbow poses, confident forward lean. Staff grip visible. Start 12–16% screen-height framing, tune phone occlusion. | Face and silhouette discernible on phone without zoom. Character turntable plus gameplay frame. |
| Life | Coherent breeze affects cloth, branches and seed trails. At least three distinct localized behaviors (bird hop/departure, moth orbit, grass response) rather than all objects wobbling. | Uncut idle and traversal clip; observe different rhythms. |
| World response | Restoration visibly changes at least architecture, foliage and light/sound; a wheel spin alone is insufficient. | Matched before/after frames and motion capture. |

Keep draw calls/triangles within existing tested gates through repeated instances, shared materials and sparse dynamic shadows. Budget is not a reason to accept visibly empty screens: compose reused pieces intelligently before buying more assets.

## Motion direction and interaction feel

These are tuning starting points to test, not benchmark timings. Run should be about 1.6–1.9× walk, with strong hip travel, alternating bent arms, a clear airborne phase and stride-distance matching; no sliding feet. Launch acceleration around 0.12–0.18s and braking around 0.10–0.16s, with a body lean rather than an instant facing snap. Movement direction responds immediately even if upper-body animation follows.

Jump: quick 0.06–0.10s compression; about 0.5–0.7s flight; distinct knee lift, coat/staff follow-through; 0.10–0.14s landing settle that does not immobilize the player. Add forgiving coyote time/input buffering and safe recoveries. Capture: eyes/head commit first, free hand reaches, body and staff form a clear arc, the wind visibly converges at the bell. Release: 0.12–0.18s wind-up, crisp contact/response, about 0.2s follow-through. Avoid long slow gestures to sell importance.

Record start, stop, turn, run, jump, landing, capture, carry and release from the real camera. A posed screenshot cannot approve these. Review the worst transition, not just the best loop.

## Prompt lessons for the next Atlas calls

Separate environment composition, hero identity, isolated construction reference and sound purpose. One prompt cannot do all four well. Ask for a single view, concrete foreground/middle/background placement, 2–3 distinctive human-made details, localized signs of life and quiet navigable space. Avoid “reference board,” headings and invented typography. Explicitly ask for no labels/text/UI.

Hero reference: original apprentice with asymmetric human gesture, broad readable facial shapes, bent elbows, visible separate hands/boots, purposeful bell-tool handling; no rigid robot proportions. Request full body on a quiet background for modelling, then a separate expressive pose if needed. Do not burn credits generating further panoramic concepts if the geometry/material translation remains the failing step.

Audio: request one precise use per file, with a physical source and temporal structure. Example: warm copper bell struck with felt, airy inhale converging before the strike, soft irregular metal partials, short natural decay; no square-wave bleeps, harsh bass, speech or recognizable melody. Ambience needs layered near leaves, distant canopy and occasional living calls with room between them. Generated files require actual listening; waveforms and successful downloads are not artistic approval.

## Exit bar

Independent review must answer: would this single frame make someone want to explore; does the apprentice look intentional and alive; does movement feel energetic; can an unbriefed player discover the route without text stating the solution; does restoration reward the journey? Record the largest remaining defect and iterate on it. A technical gate pass is necessary but does not answer those questions.
