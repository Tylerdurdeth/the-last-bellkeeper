// Bellhollow kit core: palette, shared materials, seeded random, geometry helpers
// and per-block material bins that bake static scenery to one mesh per material.
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// STYLE-LOCK-V2 palette. Nothing else in the world invents a colour.
export const PAL = {
  ivory: 0xF2E6C9, ivoryShade: 0xCDBB95, honey: 0xC8894A, timberDark: 0x7A4E33,
  verdigris: 0x3E9C8C, copper: 0xB8733F, coral: 0xD96956, gold: 0xE9B949,
  leaf: 0x5E8F4E, leafLight: 0xA6C46A, shade: 0x2C4A45, wind: 0x8FD3E0,
  skyTop: 0xBFE1EA, dawn: 0xF6D9B0, ink: 0x2A1E1C,
};

// Material catalogue: [palette colour, recipe name, roughness, metalness].
// `bark` and `deck` are world surfaces the renderer may texture; the others are flat.
const MAT_DEFS = {
  plaster: [PAL.ivory, 'plaster', .92, 0], stone: [PAL.ivory, 'stone', .9, 0], stoneShade: [PAL.ivoryShade, 'stone', .92, 0],
  // Beauty pass: large timber surfaces are weathered (honey pulled towards ivory-shade / deep shade);
  // saturated honey is kept for small accents only.
  timber: [0xAD8A63, 'timber', .88, 0], timberDark: [PAL.timberDark, 'timber', .88, 0],
  tileCoral: [PAL.coral, 'tile', .8, 0], tileCopper: [PAL.copper, 'tile', .75, 0], tileVerdigris: [PAL.verdigris, 'tile', .78, 0], tileDark: [PAL.timberDark, 'tile', .82, 0],
  verdigris: [PAL.verdigris, 'metal', .5, .3], copper: [PAL.copper, 'metal', .45, .4],
  cloth: [PAL.coral, 'fabric', .95, 0], clothIvory: [PAL.ivory, 'fabric', .95, 0],
  leaf: [PAL.leaf, 'foliage', .95, 0], leafLight: [PAL.leafLight, 'foliage', .95, 0], leafShade: [PAL.shade, 'foliage', .97, 0],
  bark: [0x6B5A45, 'bark', .97, 0], barkShade: [PAL.shade, 'bark', .98, 0],
  deck: [0xB39A7C, 'timber', .9, 0], deckOld: [0x9C8F7D, 'timber', .92, 0], deckDark: [0x6E5E4E, 'timber', .95, 0], stoneCool: [0xA9A898, 'stone', .94, 0], heartwood: [0x4A3020, 'timber', .95, 0], heartwoodLight: [0x6B4428, 'timber', .9, 0], pavingDeep: [0x9D968A, 'stone', .95, 0], stoneDeep: [0x7E8A82, 'stone', .96, 0], metalWorn: [0x8C7560, 'metal', .7, .25], paving: [PAL.ivory, 'stone', .92, 0], ink: [PAL.ink, 'metal', .7, .1],
  glass: [PAL.dawn, 'glass', .3, 0], far: [0x6F8F86, 'foliage', 1, 0], farLight: [0x9DB7A6, 'foliage', 1, 0],
  mist: [0xE8EEE6, 'fabric', 1, 0],
};

const matCache = new WeakMap();
/** Shared palette materials for this THREE instance (one object per name, so bins merge). */
export function materials(THREE) {
  let m = matCache.get(THREE);
  if (m) return m;
  m = {};
  for (const [key, [color, name, roughness, metalness]] of Object.entries(MAT_DEFS)) {
    const mat = new THREE.MeshStandardMaterial({color, roughness, metalness});
    mat.name = name; mat.userData.bhKey = key; m[key] = mat;
  }
  // the ancient channels: dark inlays that glow faintly (cyan = wind, gold = the old bells)
  m.inlayCyan = Object.assign(new THREE.MeshStandardMaterial({color: 0x2C4A45, roughness: .6, emissive: PAL.wind, emissiveIntensity: .3}), {name: 'glass'}); m.inlayCyan.userData.bhKey = 'inlayCyan';
  m.inlayGold = Object.assign(new THREE.MeshStandardMaterial({color: 0x5A4020, roughness: .6, emissive: PAL.gold, emissiveIntensity: .35}), {name: 'glass'}); m.inlayGold.userData.bhKey = 'inlayGold';
  m.shaft = Object.assign(new THREE.MeshBasicMaterial({color: 0xFFD68A, transparent: true, opacity: .085, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false}), {name: 'shaft'}); m.shaft.userData.bhKey = 'shaft';
  m.lanternOff = Object.assign(new THREE.MeshStandardMaterial({color: 0xD9C9A0, roughness: .6, emissive: PAL.gold, emissiveIntensity: 0}), {name: 'glass'});
  matCache.set(THREE, m);
  return m;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.pick = (arr) => arr[Math.floor(f() * arr.length) % arr.length];
  f.sign = () => (f() < .5 ? -1 : 1);
  return f;
}

export const DEG = Math.PI / 180;
/** Polar helper: azimuth measured from +z (south, towards the camera) towards +x (east). */
export const polar = (azDeg, r) => [r * Math.sin(azDeg * DEG), r * Math.cos(azDeg * DEG)];
export const azOf = (x, z) => Math.atan2(x, z) / DEG;
export const wrapAz = (a) => ((a % 360) + 540) % 360 - 180;

/**
 * Bins collect world-space geometry per material key, then bake to one mesh per
 * material. One Bins per spatial block keeps frustum culling useful.
 */
export class Bins {
  constructor(THREE, name) { this.T = THREE; this.name = name; this.map = new Map(); this.mats = materials(THREE); this._m = new THREE.Matrix4(); }
  /** Add a geometry (consumed) in world space. */
  add(geo, matKey, matrix) {
    if (!geo) return;
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (matrix) g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new this.T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.morphAttributes = {}; g.clearGroups();
    const key = typeof matKey === 'string' ? matKey : matKey.userData.bhKey;
    if (!this.map.has(key)) this.map.set(key, {mat: typeof matKey === 'string' ? this.mats[matKey] : matKey, geos: []});
    this.map.get(key).geos.push(g);
  }
  /** Add every mesh of an Object3D (after its world matrix), mapping materials to keys. */
  addObject(obj, matrix) {
    const T = this.T;
    obj.updateMatrixWorld(true);
    const base = matrix || new T.Matrix4();
    obj.traverse((n) => {
      if (!n.isMesh) return;
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      const key = mats[0].userData.bhKey || keyFor(this.mats, mats[0]);
      const push = (m) => { const g = n.geometry.clone(); g.applyMatrix4(m); this.add(g, key); };
      if (n.isInstancedMesh) { const im = new T.Matrix4(); for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, im); push(new T.Matrix4().multiplyMatrices(base, new T.Matrix4().multiplyMatrices(n.matrixWorld, im))); } }
      else push(new T.Matrix4().multiplyMatrices(base, n.matrixWorld));
    });
  }
  bake(parent) {
    const T = this.T, group = new T.Group(); group.name = 'bh-block-' + this.name;
    for (const [key, {mat, geos}] of this.map) {
      if (!geos.length) continue;
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere(); merged.computeBoundingBox();
      const mesh = new T.Mesh(merged, mat); mesh.name = `bh-${this.name}-${key}`;
      mesh.castShadow = !['mist', 'far', 'farLight', 'shaft'].includes(key); mesh.receiveShadow = key !== 'shaft';
      if (key === 'shaft') { mesh.renderOrder = 5; mesh.userData.noOutline = true; }
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      group.add(mesh);
    }
    this.map.clear();
    if (parent) parent.add(group);
    return group;
  }
}

/** Find a palette key for an arbitrary asset material (nearest palette colour of same recipe). */
function keyFor(mats, mat) {
  if (mat.emissiveIntensity > 0 && mat.emissive && mat.emissive.getHex()) return 'lanternOff';
  const hex = mat.color ? mat.color.getHex() : 0xffffff;
  let best = 'plaster', bd = Infinity;
  for (const [k, m] of Object.entries(mats)) {
    if (k === 'lanternOff') continue;
    const c = m.color.getHex();
    const d = ((c >> 16) - (hex >> 16)) ** 2 + (((c >> 8) & 255) - ((hex >> 8) & 255)) ** 2 + ((c & 255) - (hex & 255)) ** 2 + (m.name === mat.name ? 0 : 900);
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

/** Composable matrix: translate/rotate(Y, then X/Z)/scale. */
export function mat4(THREE, x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
  return m;
}

/**
 * Chamfered box (all 12 edges bevelled by b). Centred on origin. Cheap:
 * an extruded chamfered rectangle whose own bevel is subtracted from the profile.
 */
export function bevelBox(THREE, w, h, d, b = Math.min(w, h, d) * .08) {
  b = Math.min(b, w / 2.2, h / 2.2, d / 2.2);
  const s = new THREE.Shape(), hw = w / 2 - b, hh = h / 2 - b, c = b * .9;
  s.moveTo(-hw + c, -hh); s.lineTo(hw - c, -hh); s.lineTo(hw, -hh + c); s.lineTo(hw, hh - c); s.lineTo(hw - c, hh); s.lineTo(-hw + c, hh); s.lineTo(-hw, hh - c); s.lineTo(-hw, -hh + c); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 1});
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}

/** Plain box placed by its centre. */
export function boxAt(THREE, w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

/** Cylinder between two points (for posts, pipes, struts). */
export function rod(THREE, a, b, r = .06, seg = 6, r2 = r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r2, r, len, seg, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q); g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}

/** Tube along points (copper pipes, roots, vines). */
export function tube(THREE, pts, r = .12, seg = 16, radial = 7, closed = false) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed);
  return new THREE.TubeGeometry(curve, seg, r, radial, closed);
}

/** Tapered tube with per-sample radius (roots, branches). Returns BufferGeometry with metre UVs. */
export function taperTube(THREE, pts, r0, r1, seg = 20, radial = 8, wobble = .08, seed = 1) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const fr = curve.computeFrenetFrames(seg, false), len = curve.getLength(), pos = [], uv = [], idx = [], n = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, c = curve.getPointAt(t);
    const r = (r0 + (r1 - r0) * Math.pow(t, .85)) * (1 + wobble * Math.sin(t * 17 + seed * 3.1));
    for (let k = 0; k <= radial; k++) {
      const a = k / radial * Math.PI * 2, ridge = 1 + .06 * Math.sin(a * 5 + seed);
      n.copy(fr.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(fr.binormals[i], Math.sin(a));
      pos.push(c.x + n.x * r * ridge, c.y + n.y * r * ridge, c.z + n.z * r * ridge);
      uv.push(k / radial * Math.max(1, r0 * 6), t * len / 1.5);
    }
  }
  for (let i = 0; i < seg; i++) for (let k = 0; k < radial; k++) { const a = i * (radial + 1) + k, b = a + radial + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Leaf mass: a lumpy low-poly icosphere blob (canopy clusters). */
export function blob(THREE, r, seed = 1, detail = 1, squash = .75) {
  const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + .16 * Math.sin(v.x * 2.1 / r * 3 + seed) * Math.cos(v.z * 1.7 / r * 3 + seed * 2) + .08 * Math.sin(v.y * 5 / r + seed);
    p.setXYZ(i, v.x * k, v.y * k * squash, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Smooth-shaded icosahedron lobe (normals from the centre: rounded, not faceted). */
const lobeCache = new Map();
function lobe(THREE, detail) {
  if (!lobeCache.has(detail)) {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { const l = Math.hypot(p.getX(i), p.getY(i), p.getZ(i)); n.setXYZ(i, p.getX(i) / l, p.getY(i) / l, p.getZ(i) / l); }
    lobeCache.set(detail, g);
  }
  return lobeCache.get(detail);
}
function putLobe(THREE, B, key, x, y, z, rx, ry = rx, rz = rx, detail = 1) {
  const g = lobe(THREE, detail).clone();
  g.scale(rx, ry, rz); g.translate(x, y, z);
  B.add(g, key);
}

/**
 * Leaf cluster in the R-foliage-tree language: many small rounded lobes on a domed mass,
 * sunlit light-green caps, mid-green body, a deep-shade underside, a few coral blossoms.
 * Adds to bins `B`. `seg` < 8 selects the low-detail lobes used for distant masses.
 */
export function leafClump(THREE, B, x, y, z, r, seed = 1, lobes = 0, seg = 10) {
  const rnd = rng(seed * 7919 + 13), detail = seg < 8 ? 0 : 1;
  const n = lobes > 5 ? lobes : Math.max(7, Math.min(18, Math.round(5 + r * 2.4)));
  putLobe(THREE, B, 'leafShade', x, y - r * .12, z, r * .78, r * .5, r * .78, detail);
  for (let i = 0; i < n; i++) {
    const u = rnd(), th = rnd() * Math.PI * 2, dy = -.35 + u * 1.3, h = Math.sqrt(Math.max(0, 1 - dy * dy));
    const d = r * (.58 + rnd() * .2), lr = r * (.3 + rnd() * .12);
    const px = x + Math.cos(th) * h * d, py = y + dy * d * .72, pz = z + Math.sin(th) * h * d;
    const key = dy > .45 ? 'leafLight' : dy > -.05 ? 'leaf' : 'leafShade';
    putLobe(THREE, B, key, px, py, pz, lr, lr * .82, lr, detail);
    if (key === 'leaf' && rnd() < .5) putLobe(THREE, B, 'leafLight', px + Math.cos(th) * lr * .2, py + lr * .55, pz + Math.sin(th) * lr * .2, lr * .62, lr * .4, lr * .62, detail);
  }
  putLobe(THREE, B, 'leafLight', x, y + r * .52, z, r * .42, r * .3, r * .42, detail);
  if (detail && r > .7 && seed % 3 === 0) for (let k = 0; k < 2 + (seed % 4); k++) { const th = rnd() * Math.PI * 2, d = r * (.3 + rnd() * .35); putLobe(THREE, B, 'cloth', x + Math.cos(th) * d, y + r * .6 - d * .3, z + Math.sin(th) * d, Math.max(.07, r * .05), Math.max(.07, r * .05), Math.max(.07, r * .05), 0); }
}

/** Hanging moss / ivy drape: a short curtain of small lobes (bark walls, gallery soffits). */
export function mossDrape(THREE, B, x, y, z, w = 1.2, h = 1.6, seed = 1, face = 0) {
  const rnd = rng(seed * 31 + 7), c = Math.cos(face), s = Math.sin(face);
  const rows = Math.max(2, Math.round(h / .35));
  for (let j = 0; j < rows; j++) {
    const f = j / rows, span = w * (1 - f * .6), cnt = Math.max(1, Math.round(span / .3));
    for (let k = 0; k < cnt; k++) {
      const lx = (k / Math.max(1, cnt - 1) - .5) * span + (rnd() - .5) * .15, lr = .16 + rnd() * .12;
      // flattened against the surface it hangs on (reads as a drape, not a string of beads)
      putLobe(THREE, B, j === 0 ? 'leaf' : rnd() < .35 ? 'leafLight' : rnd() < .5 ? 'leafShade' : 'leaf', x + lx * c, y - f * h - rnd() * .1, z - lx * s, lr * (1 - .55 * Math.abs(s)) * 1.25, lr * 1.15, lr * (1 - .55 * Math.abs(c)) * 1.25, 1);
    }
  }
}
