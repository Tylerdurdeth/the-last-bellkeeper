# The Last Bellkeeper

An original woodland adventure in development. The current build is a small playable terrace study, not the complete game or a submission-ready entry.

[Play the study](https://tylerdurdeth.github.io/the-last-bellkeeper/)

Move with WASD/arrows or the touch joystick. Find the wandering gust, press Space or Catch wind, carry it toward the copper seed wheel and release it. A pressure puff is harmless; the bell retains its wind. Escape/pause opens sound, gentle-motion and restart controls.

## Development

Node22 or later. Run `npm ci`, `npm run build`, then `npm run serve`. Open http://127.0.0.1:4173/the-last-bellkeeper/. Source is in `game/`; `docs/` is the self-contained published output. It includes Three.js locally and needs no API keys, account or remote generation at runtime.

`tools/test-scene.mjs` is the development real-input regression driver. Install the supported Chrome test browser with `npx puppeteer browsers install chrome` if it is not already cached. It does not change game state to complete the puzzle.

## Provenance

Every object is authored as Three.js geometry through the 404 recipe's reference → three independent code candidates → multi-view render → visual selection process. All candidate sources/reports are outside the runtime in `evidence/geometry/`. Selection reasoning is in `evidence/provenance/geometry.md`.

Three.js0.180.0 is MIT licensed; its license is included in the build. `assetlib.js` and `surfaces.js` are copied from the 404 recipe at4effad311c5e137bca316257259fe5bffd6737de, following its explicit copy/use instructions. Original project geometry, game code, design and synthesized audio are developed for this entry. Atlas created one concept reference and one pilot SFX. The SFX has not been downloaded/listening-approved and is not shipped; current sound is clearly labelled provisional synthesized feedback.

The complete planned adventure remains12–15 minutes. No full-route, physical-phone, final-art or submission-readiness claim is made by this prototype.
