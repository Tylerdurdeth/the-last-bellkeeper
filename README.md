# The Last Bellkeeper

An original woodland adventure in development. **The Waking Bough** is the current first-area study, rebuilt around a winding woodland route, a listening garden, a sleeping crossing and three small discoveries. It is not the complete game or a submission-ready entry.

[Play the study](https://tylerdurdeth.github.io/the-last-bellkeeper/)

Move with WASD/arrows; Shift runs, J jumps, Space interacts. Touch uses an analogue joystick plus Jump and the contextual action button. A full joystick push runs. Escape/pause opens sound, gentle motion and restart controls. Follow environmental clues to awaken and carry the wind back to the crossing. Inspect the cottage note, watch which garden flowers answer the chime, and notice how carried wind changes the way home. Optional keepsakes reward searching and jumping beyond the main path.

## Development

Node22 or later. Run `npm ci`, `npm run build`, then `npm run serve`. Open http://127.0.0.1:4173/the-last-bellkeeper/. Source is in `game/`; `docs/` is self-contained published output with Three.js included locally. No API keys, accounts or runtime generation are needed.

`tools/test-rebuild.mjs` exercises the full known route with actual keyboard input plus touch-control smoke checks. `tools/test-rebuild-touch.mjs` exercises the full route and discoveries with actual emulated touch events. Tests read telemetry but never teleport the player or set puzzle state. Movement, animation and rendered-ground contact tests accompany them. Install the supported test browser with `npx puppeteer browsers install chrome` if needed.

## Provenance and limits

Every modeled object is original Three.js geometry produced through the 404 recipe's reference → three independent candidates → multi-view render → visual selection workflow, followed by documented repairs. Background composition reuses reviewed tree/rock geometry. The rebuild's reference, selection, material and spending records are in `evidence/rebuild/provenance/`. Earlier rejected terrace evidence remains in history and `evidence/geometry/`.

Atlas supplied original hero/woodland references and painted ground/bark/stone textures, and the studio facial colour map. Rebuild generation has settled37 credits; lifetime53 including the earlier pilot. The latest verified Atlas balance is1,947; the new R07 facial map cost5 credits. Audio currently uses original procedural woodland/water textures, bird chirps and copper resonances. The paid pilot SFX is not shipped because reliable retrieval remains unresolved. Audio listening approval and physical iPhone performance are unverified.

Three.js0.180.0 is MIT licensed; the build includes its license. `assetlib.js` and `surfaces.js` originate from the 404 recipe at4effad311c5e137bca316257259fe5bffd6737de under its explicit copy/use instructions.

The scripted known route with all discoveries covers about116 metres in48 seconds; this is a regression test, not a first-time discovery-duration claim. Independent visual and motion reviews still drive refinement. Passing the technical gate does not certify Zelda/Diablo-level artistic quality. The eventual complete adventure remains a separate12–15 minute scope.

## Character studio

[Open the character studio](https://tylerdurdeth.github.io/the-last-bellkeeper/character-lab.html). Three code-built studies share CC0 locomotion tracks. Study A is the selected default and now includes shaped clothing, rolled cuffs, leather wrist guards, detailed boots and a continuous rear tunic hem; B/C retain the earlier body. The selected head has a cheek/jaw profile, individually swept hair ribbons, almond eyes with live irises and blinking, and an Atlas R07 facial colour map fitted around the animated eyes. Cel lighting uses a coherent face light plane. The geometry remains code-generated; the image supplies colour only. Reference-level artistic acceptance is still open. The woodland still uses the previous character while this study is reviewed.

The downloaded mannequin and character meshes introduced in earlier experiments were unsuitable for the jam’s geometry rule. They are now archived under `experiments/character-reference/`, outside both shipping directories. No GLB/GLTF is shipped or loaded. Animation-only JSON contains no geometry. The build rejects mesh files in `game/`; source licenses and motion provenance remain included. This correction does not itself certify final jam eligibility.

The studio includes a Start & stop preview. Authored gait changes preserve stride phase and blend continuously through interrupted inputs; acceleration/braking and turn lean provide secondary body movement. Jump/landing timing is tied to physical state, with complete landing recovery and boot-shaft deformation that follows the shin. These are studio changes; woodland movement retains its existing defaults. `tools/test-motion-blend.mjs`, `tools/test-boot-flex.mjs`, and `tools/test-studio-motion.mjs` cover the new behavior.
