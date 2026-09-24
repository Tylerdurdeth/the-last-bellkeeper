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
  // forested crags (pillars with leafy crowns) and cloud banks
  const crags = [];
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * 360 + rnd() * 10, r = 115 + rnd() * 45;
    if (a > 10 && a < 70) continue; // keep the camera-side foreground open
    const [x, z] = polar(a, r), top = -16 + rnd() * 18, w = 8 + rnd() * 8;
    const g = new T.CylinderGeometry(w * .75, w * 1.2, top + 42, 7, 3); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { p.setX(k, p.getX(k) * (.8 + rnd() * .4)); p.setZ(k, p.getZ(k) * (.8 + rnd() * .4)); }
    g.computeVertexNormals(); g.translate(x, (top - 42) / 2, z);
    B.add(g, rnd() < .5 ? 'far' : 'stoneShade');
    B.add(blob(T, w * 1.1, i + 3, 1, .55).translate(x, top + w * .3, z), rnd() < .5 ? 'leaf' : 'far');
    B.add(blob(T, w * .7, i + 9, 1, .6).translate(x + w * .4, top + w * .7, z - w * .3), 'leafLight');
    crags.push({x, z, top, w, a, r});
    // waterfall ribbon down the face towards the trunk
    if (rnd() < .5) { const [dx, dz] = polar(a + 180, 1); const fall = new T.PlaneGeometry(w * .25, top + 38, 1, 1); fall.rotateY(Math.atan2(dx, dz)); fall.translate(x + dx * w * .9, (top - 38) / 2, z + dz * w * .9); B.add(fall, 'mist'); }
  }
  for (let i = 0; i < 14; i++) { const [x, z] = polar(rnd() * 360, 45 + rnd() * 70); B.add(blob(T, 9 + rnd() * 8, 40 + i, 1, .3).translate(x, -30 + rnd() * 6, z), 'mist'); }
  // an old aqueduct between two crags (title-art callback)
  {
    const c1 = crags[2], c2 = crags[4];
    if (c1 && c2) {
      const y = Math.min(c1.top, c2.top) - 2, n = 6;
      for (let k = 0; k <= n; k++) { const f = k / n, x = c1.x + (c2.x - c1.x) * f, z = c1.z + (c2.z - c1.z) * f; B.add(new T.BoxGeometry(2.4, y + 40, 2.4).translate(x, (y - 40) / 2, z), 'stone'); }
      const L = Math.hypot(c2.x - c1.x, c2.z - c1.z), yaw = Math.atan2(c2.x - c1.x, c2.z - c1.z);
      B.add(new T.BoxGeometry(3, 1.6, L).rotateY(yaw).translate((c1.x + c2.x) / 2, y + .8, (c1.z + c2.z) / 2), 'stone');
      for (let k = 0; k < n; k++) { const f = (k + .5) / n, x = c1.x + (c2.x - c1.x) * f, z = c1.z + (c2.z - c1.z) * f; B.add(new T.TorusGeometry(L / n / 2 - 1.2, .8, 4, 10, Math.PI).rotateY(yaw + Math.PI / 2).translate(x, y - 1.5, z), 'stoneShade'); }
    }
  }
  // mid-distance neighbour giants (30-120 m): trunks rising out of the mist, clumped crowns,
  // so the branches never sit against a white void. Kept off the camera-side foreground.
  B.block('backdrop-trees');
  for (const [a, r, top, tr] of [[-150, 72, 30, 4.5], [-120, 95, 24, 4], [-60, 88, 20, 3.6], [-30, 110, 26, 4.2], [-175, 104, 33, 5], [150, 80, 28, 4.4], [120, 100, 22, 3.8], [178, 62, 18, 3.2], [-95, 64, -2, 2.6], [-135, 58, 4, 2.8]]) {
    const [x, z] = polar(a, r);
    B.add(taperTube(T, [[x, -30, z], [x + 1.5, top * .45, z - 1], [x - 1, top, z + 1]], tr, tr * .55, 8, 8, .1, a), 'bark');
    for (let k = 0; k < 5; k++) { const [dx, dz] = polar(k * 72 + a, k === 0 ? 0 : tr * 2.4); leafClump(T, B, x + dx, top + 3 + (k === 0 ? 3 : 0), z + dz, tr * (k === 0 ? 2.2 : 1.7), k + a, 4, 7); }
  }
  // forest canopy band far below (tree tops poking through the mist)
  for (let i = 0; i < 26; i++) { const [x, z] = polar(rnd() * 360, 40 + rnd() * 75); if (Math.hypot(x, z) < 38) continue; leafClump(T, B, x, -24 + rnd() * 5, z, 4 + rnd() * 3, i + 300, 3, 6); }
  // the far bell: a crag to the west with a bell tower on top
  const fa = -96, fr = 108, [fx, fz] = polar(fa, fr), ftop = 3;
  const crag = new T.CylinderGeometry(8, 14, ftop + 44, 8, 2); crag.translate(fx, (ftop - 44) / 2, fz); B.add(crag, 'stoneShade');
  B.add(blob(T, 9, 77, 1, .45).translate(fx - 3, ftop - 1, fz + 2), 'leaf');
  B.add(taperTube(T, [[fx + 7, ftop - 2, fz], [fx + 10, ftop - 12, fz + 3], [fx + 12, ftop - 30, fz + 2]], 1.6, .6, 8, 6, .1, 5), 'bark');
  const scale = 1.6;
  const {parts} = place(bellTower, {seed: 8, id: 'far-bell'}, fx, ftop, fz, Math.atan2(-fx, -fz), {collide: null, scale, moving: ['bell']});
  const bellPos = parts.bell ? parts.bell.position.clone() : new T.Vector3(fx, ftop + 12, fz);
  if (parts.bell) parts.bell.name = 'bh-far-bell';
  void root;
  return bellPos;
}
