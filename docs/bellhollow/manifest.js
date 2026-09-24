// Which optional v2 modules exist on disk. main.js only imports a module whose flag is true, so a
// file that has not landed yet never costs a 404 (the jam gate counts 404s as errors). Flip a flag
// when its owner lands the file:
//   world    game/bellhollow/world.js     buildBellhollow({THREE, scene, loadAsset, art})
//   guardian game/bellhollow/guardian.js createGuardian({THREE, scene, world, wind, movement, sound, caption, onEvent})
//   look     game/render/look.js         createLook({THREE, renderer, scene, camera})
// URL overrides for testing: ?stub (stub world), ?look=0 (plain renderer), ?guardian=stub.
export const MODULES = { world: true, guardian: true, look: true };
