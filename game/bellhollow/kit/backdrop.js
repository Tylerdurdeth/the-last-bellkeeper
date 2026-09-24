// Distant valley around Bellhollow: a mist sea far below, forested crags with falls
// and an old aqueduct, a ring of low-poly mountains, and the far bell tower on its crag
// (answers in the finale). Low poly, meant to sit in the renderer's fog.
import {polar, blob, taperTube, leafClump} from './core.js';

export function buildBackdrop(T, B, root, {bellTower, place}) {
  let s = 99; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  B.block('backdrop-far');
  // mist sea
  const sea = new T.CircleGeometry(170, 40); sea.rotateX(-Math.PI / 2); sea.translate(0, -26, 0); B.add(sea, 'mist');
  // (the painted valley panorama belongs to the renderer; no geometric mountain ring here)
  B.block('backdrop-mid');
  const crags = []; void crags;
  // mid-distance neighbour giants (30-120 m): trunks rising out of the mist, clumped crowns,
  // so the branches never sit against a white void. Kept off the camera-side foreground.
  B.block('backdrop-trees');
  for (const [a, r, top, tr] of [[-150, 72, 30, 4.5], [-120, 95, 24, 4], [-60, 88, 20, 3.6], [-30, 110, 26, 4.2], [-175, 104, 33, 5], [150, 80, 28, 4.4], [120, 100, 22, 3.8], [178, 62, 18, 3.2], [-95, 64, -2, 2.6], [-135, 58, 4, 2.8], [-80, 118, 30, 4.8], [-10, 135, 34, 5.2], [100, 128, 30, 4.6], [-45, 70, 8, 3]]) {
    const [x, z] = polar(a, r);
    B.add(taperTube(T, [[x, -30, z], [x + 1.5, top * .45, z - 1], [x - 1, top, z + 1]], tr, tr * .55, 8, 8, .1, a), 'bark');
    for (let k = 0; k < 5; k++) { const [dx, dz] = polar(k * 72 + a, k === 0 ? 0 : tr * 2.4); leafClump(T, B, x + dx, top + 3 + (k === 0 ? 3 : 0), z + dz, tr * (k === 0 ? 2.2 : 1.7), k + a, 9, 10); }
  }
  // near canopy layer below the branches (30-65 m out, 12-20 m under the terrace), so looking
  // down from a branch shows layered green, not a white void
  for (let i = 0; i < 20; i++) { const a = -175 + rnd() * 200, [x, z] = polar(a, 32 + rnd() * 34); leafClump(T, B, x, -14 + rnd() * 6, z, 5.5 + rnd() * 3, i + 500, 11, 10); if (i % 3 === 0) B.add(taperTube(T, [[x, -30, z], [x, -16, z]], 1.4, 1, 3, 6, .1, i), 'bark'); }
  // the far bell: a crag to the west with a bell tower on top
  const fa = -96, fr = 108, [fx, fz] = polar(fa, fr), ftop = 3;
  const crag = new T.CylinderGeometry(8, 14, ftop + 44, 8, 2); crag.translate(fx, (ftop - 44) / 2, fz); B.add(crag, 'stoneShade');
  leafClump(T, B, fx - 3, ftop, fz + 2, 7, 77, 12, 10); leafClump(T, B, fx + 5, ftop - 3, fz - 4, 5, 78, 10, 10);
  B.add(taperTube(T, [[fx + 7, ftop - 2, fz], [fx + 10, ftop - 12, fz + 3], [fx + 12, ftop - 30, fz + 2]], 1.6, .6, 8, 6, .1, 5), 'bark');
  const scale = 1.6;
  const {parts} = place(bellTower, {seed: 8, id: 'far-bell'}, fx, ftop, fz, Math.atan2(-fx, -fz), {collide: null, scale, moving: ['bell']});
  const bellPos = parts.bell ? parts.bell.position.clone() : new T.Vector3(fx, ftop + 12, fz);
  if (parts.bell) parts.bell.name = 'bh-far-bell';
  void root;
  return bellPos;
}
