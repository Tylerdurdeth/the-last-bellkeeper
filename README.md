# The Last Bellkeeper

An original woodland adventure in development. **The Waking Bough** is the current first-area study, rebuilt around a winding woodland route, a listening garden, a sleeping crossing, responsive bellflowers, a startled bird flock, and a low-to-high gong / seed-bell / harp puzzle. The approved code-built character now anchors the playable scene, with camera orbit by drag or Q/E and camera-relative movement. It is not the complete game or a submission-ready entry.

[Play the study](https://tylerdurdeth.github.io/the-last-bellkeeper/)

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
