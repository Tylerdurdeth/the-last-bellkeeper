# The Last Bellkeeper

An original woodland adventure in development. **The Waking Bough** is the current first-area study, rebuilt around a winding woodland route, a listening garden, a sleeping crossing and three small discoveries. It is not the complete game or a submission-ready entry.

[Play the study](https://tylerdurdeth.github.io/the-last-bellkeeper/)

Move with WASD/arrows; Shift runs, J jumps, Space interacts. Touch uses an analogue joystick plus Jump and the contextual action button. A full joystick push runs. Escape/pause opens sound, gentle motion and restart controls. Follow environmental clues to awaken and carry the wind back to the crossing. Optional keepsakes reward searching beyond the main path.

## Development

Node22 or later. Run `npm ci`, `npm run build`, then `npm run serve`. Open http://127.0.0.1:4173/the-last-bellkeeper/. Source is in `game/`; `docs/` is self-contained published output with Three.js included locally. No API keys, accounts or runtime generation are needed.

`tools/test-rebuild.mjs` exercises the full known route with actual keyboard input plus touch-control smoke checks. `tools/test-rebuild-touch.mjs` exercises the full route and discoveries with actual emulated touch events. Tests read telemetry but never teleport the player or set puzzle state. Movement, animation and rendered-ground contact tests accompany them. Install the supported test browser with `npx puppeteer browsers install chrome` if needed.

## Provenance and limits

Every modeled object is original Three.js geometry produced through the 404 recipe's reference → three independent candidates → multi-view render → visual selection workflow, followed by documented repairs. Background composition reuses reviewed tree/rock geometry. The rebuild's reference, selection, material and spending records are in `evidence/rebuild/provenance/`. Earlier rejected terrace evidence remains in history and `evidence/geometry/`.

Atlas supplied original hero/woodland references and painted ground/bark/stone textures. Rebuild generation has settled25 credits; lifetime41 including the earlier pilot. Audio currently uses original procedural woodland/water textures, bird chirps and copper resonances. The paid pilot SFX is not shipped because reliable retrieval remains unresolved. Audio listening approval and physical iPhone performance are unverified.

Three.js0.180.0 is MIT licensed; the build includes its license. `assetlib.js` and `surfaces.js` originate from the 404 recipe at4effad311c5e137bca316257259fe5bffd6737de under its explicit copy/use instructions.

The scripted known route with all discoveries covers about130 metres in49 seconds; this is a regression test, not a first-time discovery-duration claim. Independent visual and motion reviews still drive refinement. Passing the technical gate does not certify Zelda/Diablo-level artistic quality. The eventual complete adventure remains a separate12–15 minute scope.
