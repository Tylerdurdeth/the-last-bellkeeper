# The Last Bellkeeper

**[Play it](https://tylerdurdeth.github.io/the-last-bellkeeper/)** · 404 game jam 001 entry · desktop (keyboard) and phone (touch)

## v2: Bellhollow (the jam build)

A village built into one colossal tree has lost its wind. You are the bellkeeper's apprentice. **Wind is a physical tool you carry**: catch a gust in your bell, hold it, and give it back to the world to turn a mill, ride an updraft, swing a hanging bridge, chain pipe wheels, open the Hollow, and calm the guardian at its heart. Every puzzle and the boss fight are solved with the same few verbs of wind, never with a weapon.

- **All 3D is Three.js code** (world kit, characters, guardian, mills); no meshes or vertex data are imported.
- **Images**: Atlas (Gemini image) on jam credits: title and prologue illustrations, bark, timber, ivory stone, sky, valley, the hero's face map, and reference sheets (provenance files beside each texture).
- **Sound and music**: synthesized in code with the Web Audio API, including the phase-driven boss score and boss sound effects. No audio files.
- **Animation**: CC0 Quaternius Universal Animation Library tracks only (no meshes), retargeted onto the code-built hero, Mara and villagers (`game/assets/quaternius/PROVENANCE.md`).
- **How it was made**: Claude Code (Claude Opus 5.5) as lead with parallel worker agents and independent critic and first-exposure reviewer agents on every visual change (reports in `evidence/review-2026-09-25/`); jam gate runs in `evidence/gate-2026-09-25/`. v1 (the woodland telling, below) was built with Codex/GPT and is kept in history.

Controls: arrows move, Shift runs, A jumps, Space catches/gives/uses, Q/E or drag turns the camera, Esc pauses. On phone: stick, Jump and the action button.

---

## v1 history

An original nonviolent windkeeping adventure. Explore the Waking Bough, descend through the Rootway, and restore the Heartwood Windworks before returning to Mara. Catch, carry and give back wind: first to machinery, then to a maintenance creature, finally to a protective guardian whose two breaths power the return and outward channels. Forgiving jumps, optional memories and a quiet ending reward attention rather than combat.

[Play The Last Bellkeeper](https://tylerdurdeth.github.io/the-last-bellkeeper/)

The opening now has original generated key art, a restrained full-screen title menu and a 48-second synthesized cinematic theme. Click **Enable title music** (or interact with the menu) to allow sound; mute and volume remain under player control. A new journey starts with three illustrated story beats, then the guardian and Mara in the live world. Continue bypasses the introduction; Next, Skip, or an explicit movement gesture let returning players move on. Reduced-motion preferences suppress drifting particles.

v1 history: the first title artwork was made with built-in OpenAI image generation, not Atlas. It is no longer used or shipped; the file and its provenance moved to `experiments/v1-title/`. v2's title and prologue art is Atlas (see `game/textures/v2/key-art-provenance.md`).

The complete main route has passed real-input keyboard and phone-emulated touch regression tests, including the ending and save/Continue. Title, skippable in-engine introduction, captions, volume, gentle motion and restart are included. Human first-time pacing, listening approval and physical-phone testing remain unverified; this is not a claim of AAA equivalence or final competition acceptance.

Full-route tests: `node tools/test-adventure.mjs` and `node tools/test-adventure.mjs evidence/adventure/touch --touch`. Controller: `node tools/test-campaign.mjs`; terrain: `node tools/test-campaign-world.mjs`; menus: `node tools/test-adventure-ui.mjs`. Older first-scene tests and notes below are historical. Release checks: `evidence/adventure/release/`.

Latest Atlas reconciliation, 21 September: 69 total credits settled, zero reserved, 1,931 remaining. New caretaker and Heartwood references cost 8 together. New assets remain original code geometry with candidate/render selection records. Music and soundscape are original procedural audio; previously paid Atlas SFX is not shipped because retrieval remains unresolved.

Move with the arrow keys; A jumps, Shift runs, Space interacts. Drag the scenery or use Q/E to orbit the camera; movement follows the camera. The woodland map rotates with the camera so screen-up travel maps up; its arrow shows your facing, and the crossing is marked locked or restored. Touch uses an analogue joystick plus Jump and the contextual action button. A full joystick push runs. Escape/pause opens sound, gentle motion and restart controls. Follow environmental clues to awaken the chime, play the gong, seed bells and harp in rising order, carry the wind back to the crossing, and cross to the restored bell sanctuary. Flowers and birds respond as optional discoveries; keepsakes reward searching and jumping beyond the main path.

## Development

The sanctuary is on an irregular rocky island with an eight-metre clear channel, reachable only on the restored bridge. A visible escarpment encloses the woodland. The field chart can be enlarged on phones. Thorn brambles, hostas, shelf fungi, rabbits, perched kingfishers and luna moths add distinct silhouettes and restrained motion. See `evidence/rebuild/refinement-20/` for references, selection sheets, reviews and regression evidence.

Node22 or later. Run `npm ci`, `npm run build`, then `npm run serve`. Open http://127.0.0.1:4173/the-last-bellkeeper/. Source is in `game/`; `docs/` is self-contained published output with Three.js included locally. No API keys, accounts or runtime generation are needed.

`tools/test-rebuild.mjs` exercises the full known route with actual keyboard input plus touch-control smoke checks. `tools/test-rebuild-touch.mjs` exercises the full route and discoveries with actual emulated touch events. Tests read telemetry but never teleport the player or set puzzle state. Movement, animation and rendered-ground contact tests accompany them. Install the supported test browser with `npx puppeteer browsers install chrome` if needed.

Additional focused checks: `node tools/test-map.mjs`, `node tools/test-world-ground.mjs`, `node tools/test-island-navigation.mjs`, `node tools/test-woodland-life.mjs`, and (with the server running) `node tools/test-refinement-ui.mjs`.

## Provenance and limits

Every modeled object is original Three.js geometry produced through the 404 recipe's reference → three independent candidates → multi-view render → visual selection workflow, followed by documented repairs. Background composition reuses reviewed tree/rock geometry. The rebuild's reference, selection, material and spending records are in `evidence/rebuild/provenance/`. Earlier rejected terrace evidence remains in history and `evidence/geometry/`.

Atlas supplied original hero/woodland references, painted ground/bark/stone textures, the studio facial colour map, and the latest instrument/flora/fauna reference sheets. The 20 September refinement used 8 credits of its 400-credit allowance; lifetime spending is 61 and the latest verified balance is 1,939. All reservations are settled. New objects are original code-built geometry, not Atlas-exported meshes. Audio uses procedural woodland/water textures, bird chirps and distinct instrument resonances. The paid pilot SFX is not shipped because reliable retrieval remains unresolved. Human listening approval and physical iPhone performance are unverified.

Three.js0.180.0 is MIT licensed; the build includes its license. `assetlib.js` and `surfaces.js` originate from the 404 recipe at4effad311c5e137bca316257259fe5bffd6737de under its explicit copy/use instructions.

The current scripted touch route with all three keepsakes covers approximately 142 metres in 54 seconds; this is a known-route regression test, not a first-time discovery-duration claim. Independent visual and motion reviews still drive refinement. Passing the technical gate does not certify Zelda/Diablo-level artistic quality. The eventual complete adventure remains a separate 12–15 minute scope.

## Character studio

[Open the character studio](https://tylerdurdeth.github.io/the-last-bellkeeper/character-lab.html). Three code-built studies share CC0 locomotion tracks. Study A is the selected default and now includes shaped clothing, rolled cuffs, leather wrist guards, detailed boots and a continuous rear tunic hem; B/C retain the earlier body. The selected head has a cheek/jaw profile, individually swept hair ribbons, almond eyes with live irises and blinking, and an Atlas R07 facial colour map fitted around the animated eyes. Cel lighting uses a coherent face light plane. The geometry remains code-generated; the image supplies colour only. Reference-level artistic acceptance is still open. The woodland still uses the previous character while this study is reviewed.

The downloaded mannequin and character meshes introduced in earlier experiments were unsuitable for the jam’s geometry rule. They are now archived under `experiments/character-reference/`, outside both shipping directories. No GLB/GLTF is shipped or loaded. Animation-only JSON contains no geometry. The build rejects mesh files in `game/`; source licenses and motion provenance remain included. This correction does not itself certify final jam eligibility.

The studio includes a Start & stop preview. Authored gait changes preserve stride phase and blend continuously through interrupted inputs; acceleration/braking and turn lean provide secondary body movement. Jump/landing timing is tied to physical state, with complete landing recovery and boot-shaft deformation that follows the shin. Study A is now the woodland character, using the same approved locomotion adapter and camera-relative movement. `tools/test-motion-blend.mjs`, `tools/test-boot-flex.mjs`, and `tools/test-studio-motion.mjs` cover the new behavior.
