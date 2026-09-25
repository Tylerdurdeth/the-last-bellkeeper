// Distant valley around Bellhollow: a mist sea far below, neighbour giant trees rising out of it, a
// valley forest over the mist, and the far bell tower on its hill (answers in the finale).
//
// The giants use their own materials (not the world's foliage role): the world foliage shader cuts a
// ragged alpha rim and the aerial fog washes 60-130 m meshes into translucent-looking ghosts. Here the
// aerial perspective is a fixed, painterly tint toward the current fog colour (fog off on these
// materials), so the giants stay SOLID silhouettes with clean, rounded crowns.
import {polar} from './core.js';

const mats = new WeakMap();
/** Backdrop materials for this THREE: {bark, leaf, leafLight, leafShade} per haze level. */
function backdropMaterials(T) {
  if (mats.has(T)) return mats.get(T);
  const make = (key, hex, name, haze) => {
    const m = new T.MeshStandardMaterial({color: hex, roughness: .96, metalness: 0, fog: false});
    m.name = name; m.userData.bhKey = key;
    const base = new T.Color(hex), last = new T.Color(-1, -1, -1);
    // Painterly aerial perspective that keeps the mesh opaque: the albedo is dimmed and the haze colour is ADDED as
    // emissive, so both the lit and the shadow side recede toward the area's fog colour (tracks the area rig).
    const apply = (fog) => { m.color.copy(base).multiplyScalar(1 - haze); m.emissive.copy(fog).multiplyScalar(haze * .82); };
    apply(new T.Color(0xDCE0D8));
    m.onBeforeRender = (r, scene) => {
      const f = scene && scene.fog; if (!f || last.equals(f.color)) return;
      last.copy(f.color); apply(f.color);
    };
    return m;
  };
  const set = (tag, haze, hazeLeaf) => ({
    bark: make('barkGiant' + tag, 0x4A3828, 'bark', haze),
    leaf: make('leafGiant' + tag, 0x467C3E, 'leafmass', hazeLeaf),
    leafLight: make('leafGiantLight' + tag, 0x7DA652, 'leafmass', hazeLeaf),
    leafShade: make('leafGiantShade' + tag, 0x26473D, 'leafmass', hazeLeaf),
  });
  const out = {near: set('', .5, .46), low: set('Low', .56, .5)};
  mats.set(T, out);
  return out;
}

// One smooth unit lobe (icosphere, detail 1); cloned per use.
const lobeGeo = new WeakMap();
function unitLobe(T) { if (!lobeGeo.has(T)) lobeGeo.set(T, new T.IcosahedronGeometry(1, 1)); return lobeGeo.get(T); }

/**
 * Rounded canopy clump: a dome of overlapping lobes with a rounded (not sliced) underside. Normals are
 * blended toward the clump centre ("mass normals"), so the toon bands wrap the whole crown instead of
 * shading every lobe as a separate ball. Sunlit lobes on top, mid body, cool shade below.
 */
function crown(T, B, M, x, y, z, r, seed, n = 9) {
  let s = (seed * 9301 + 49297) % 233280 || 1; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const put = (key, px, py, pz, lr, sy = .86) => {
    const g = unitLobe(T).clone(); g.scale(lr, lr * sy, lr); g.translate(px, py, pz);
    const p = g.attributes.position, nn = g.attributes.normal, v = new T.Vector3(), c = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      c.set(p.getX(i) - x, (p.getY(i) - y) * 1.3, p.getZ(i) - z).normalize();
      v.set(nn.getX(i), nn.getY(i), nn.getZ(i)).multiplyScalar(.58).addScaledVector(c, .42).normalize();
      nn.setXYZ(i, v.x, v.y, v.z);
    }
    B.add(g, M[key]);
  };
  // core mass (fills the gaps between lobes; round underside)
  put('leafShade', x, y - r * .08, z, r * .8, .66);
  put('leaf', x, y + r * .12, z, r * .78, .7);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2 + rnd() * .5, ring = i % 3, d = r * (ring === 0 ? .62 : ring === 1 ? .5 : .34);
    const py = y + (ring === 0 ? -.12 : ring === 1 ? .18 : .42) * r, lr = r * (.34 + rnd() * .1);
    put(ring === 2 ? 'leafLight' : ring === 1 ? 'leaf' : 'leafShade', x + Math.cos(th) * d, py, z + Math.sin(th) * d, lr);
  }
  put('leafLight', x, y + r * .48, z, r * .4, .7);
}

/** Tapered, gently bent tube (round, smooth-shaded) from a to b. */
function limb(T, pts, r0, r1, radial = 8, seg = 8) {
  const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p)));
  const g = new T.TubeGeometry(curve, seg, 1, radial, false), p = g.attributes.position, c = new T.Vector3(), v = new T.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, r = r0 + (r1 - r0) * Math.pow(t, .8); curve.getPointAt(t, c);
    for (let k = 0; k <= radial; k++) { const j = i * (radial + 1) + k; v.fromBufferAttribute(p, j).sub(c).multiplyScalar(r).add(c); p.setXYZ(j, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return g;
}

export function buildBackdrop(T, B, root, {bellTower, place}) {
  let s = 99; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const {near: MN, low: ML} = backdropMaterials(T);
  B.block('backdrop-far');
  // mist sea
  const sea = new T.CircleGeometry(360, 64);   // edge beyond the haze: no visible rim against the sky sea.rotateX(-Math.PI / 2); sea.translate(0, -26, 0); B.add(sea, 'mist');
  // (the painted valley panorama belongs to the renderer's sky dome)
  // Mid-distance neighbour giants (58-135 m): trunks rising out of the mist with limbs that visibly carry
  // every crown clump (nothing floats), kept off the camera-side foreground.
  B.block('backdrop-trees');
  for (const [a, r, top, tr] of [[-150, 72, 30, 4.5], [-120, 95, 24, 4], [-60, 88, 20, 3.6], [-30, 110, 26, 4.2], [-175, 104, 33, 5], [150, 80, 28, 4.4], [120, 100, 22, 3.8], [178, 62, 18, 3.2], [-95, 64, -2, 2.6], [-135, 58, 4, 2.8], [-80, 118, 30, 4.8], [-10, 135, 34, 5.2], [100, 128, 30, 4.6], [-45, 70, 8, 3]]) {
    const [x, z] = polar(a, r), topX = x - 1, topZ = z + 1;
    // bole: flared into the mist, running up INTO the main crown
    B.add(limb(T, [[x, -30, z], [x + 1.2, -12, z - .6], [x + 1.5, top * .45 - 8, z - 1], [topX, top + 4, topZ]], tr * 1.15, tr * .5, 10, 10), MN.bark);
    // main crown centred on the bole top
    crown(T, B, MN, topX, top + 6, topZ, tr * 2.1, a + 1, 8);
    // four outer crown clumps, each carried by a limb from the upper bole
    for (let k = 0; k < 4; k++) {
      const az = k * 90 + a * 1.7, [dx, dz] = polar(az, tr * 2.5), cy = top + 2.5 + (k % 2) * 1.5;
      const bx = topX + dx * .15, bz = topZ + dz * .15, by = top - 3;
      B.add(limb(T, [[bx, by, bz], [topX + dx * .55, cy - .8, topZ + dz * .55], [topX + dx * .9, cy, topZ + dz * .9]], tr * .34, tr * .16, 6, 5), MN.bark);
      crown(T, B, MN, topX + dx, cy + .6, topZ + dz, tr * 1.55, k + a * 3, 6);
    }
    // leafy tiers down the bole: limbs whose tips sit inside their clumps, so a giant reads as a tree
    for (const [f, n] of [[.42, 3], [.68, 3]]) {
      const y = -30 + (top + 30) * f, bxp = x + (topX - x) * f, bzp = z + (topZ - z) * f;
      for (let k = 0; k < n; k++) {
        const az = a * 3 + k * (360 / n) + f * 90, [dx, dz] = polar(az, tr * 3.2);
        B.add(limb(T, [[bxp, y - 2, bzp], [bxp + dx * .55, y + 1.2, bzp + dz * .55], [bxp + dx, y + 2.8, bzp + dz]], tr * .3, tr * .13, 6, 5), MN.bark);
        crown(T, B, MN, bxp + dx, y + 3.3, bzp + dz, tr * 1.4, az + 900, 5);
      }
    }
  }
  // valley forest far below, veiled by the mist: low rounded crowns over the mist sea
  for (let i = 0; i < 34; i++) { const a = rnd() * 360, [x, z] = polar(a, 75 + rnd() * 90); crown(T, B, ML, x, -26 + rnd() * 4, z, 8 + rnd() * 6, i + 1200, 4); }
  // near canopy layer below the branches (30-65 m out, 12-20 m under the terrace): layered green, never a
  // white void; every third crown stands on a visible trunk rising from the mist
  for (let i = 0; i < 20; i++) {
    const a = -175 + rnd() * 200, [x, z] = polar(a, 32 + rnd() * 34), y = -14 + rnd() * 6, cr = 5.5 + rnd() * 3;
    crown(T, B, ML, x, y, z, cr, i + 500, 6);
    if (i % 3 === 0) B.add(limb(T, [[x, -30, z], [x + .4, (y - 30) / 2, z], [x, y - cr * .2, z]], 1.5, 1, 7, 4), ML.bark);
  }
  // the far bell: a round grassy hill to the west with a bell tower on top
  const fa = -96, fr = 108, [fx, fz] = polar(fa, fr), ftop = 3;
  { const prof = []; for (let i = 0; i <= 12; i++) { const f = i / 12; prof.push(new T.Vector2(3 + 30 * Math.pow(f, 1.6), ftop - (ftop + 30) * (1 - Math.cos(f * Math.PI / 2)))); } const hill = new T.LatheGeometry(prof.reverse(), 28); hill.translate(fx, 0, fz); B.add(hill, 'leaf'); }
  for (let k = 0; k < 9; k++) { const [dx, dz] = polar(k * 40 + 15, 12 + (k % 3) * 5); crown(T, B, MN, fx + dx, ftop - 3 - (k % 3) * 5, fz + dz, 3.5 + (k % 2) * 1.5, 700 + k, 6); }
  crown(T, B, MN, fx - 3, ftop + 1, fz + 2, 6, 77, 9); crown(T, B, MN, fx + 5, ftop - 2, fz - 4, 4.5, 78, 8);
  B.add(limb(T, [[fx + 7, ftop - 2, fz], [fx + 10, ftop - 12, fz + 3], [fx + 12, ftop - 30, fz + 2]], 1.6, .6, 7, 6), MN.bark);
  const scale = 1.6;
  const {parts} = place(bellTower, {seed: 8, id: 'far-bell'}, fx, ftop, fz, Math.atan2(-fx, -fz), {collide: null, scale, moving: ['bell']});
  const bellPos = parts.bell ? parts.bell.position.clone() : new T.Vector3(fx, ftop + 12, fz);
  if (parts.bell) parts.bell.name = 'bh-far-bell';
  void root;
  return bellPos;
}
