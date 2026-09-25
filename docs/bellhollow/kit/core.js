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
  plaster: [PAL.ivory, 'plaster', .92, 0], stone: [PAL.ivory, 'stone', .9, 0], stoneShade: [PAL.ivoryShade, 'stone', .92, 0], stoneWarm: [0xE2C9A0, 'stone', .92, 0],   // parapet body: warm (never teal in shade)
  // Beauty pass: large timber surfaces are weathered (honey pulled towards ivory-shade / deep shade);
  // saturated honey is kept for small accents only.
  timber: [0xAD8A63, 'timber', .88, 0], timberDark: [PAL.timberDark, 'timber', .88, 0],
  tileCoral: [PAL.coral, 'tile', .8, 0], tileCopper: [PAL.copper, 'tile', .75, 0], tileVerdigris: [PAL.verdigris, 'tile', .78, 0], tileDark: [PAL.timberDark, 'tile', .82, 0],
  verdigris: [PAL.verdigris, 'metal', .5, .3], copper: [PAL.copper, 'metal', .45, .4],
  cloth: [PAL.coral, 'fabric', .95, 0], clothIvory: [PAL.ivory, 'fabric', .95, 0],
  leaf: [PAL.leaf, 'foliage', .95, 0], leafLight: [PAL.leafLight, 'foliage', .95, 0], leafShade: [PAL.shade, 'foliage', .97, 0],
  // ivy / moss leaf cards: own keys (no foliage-role ragged rim, no shadow casting), double-sided, never near-black
  ivy: [0x5E8F4E, 'leafcard', .95, 0], ivyLight: [0x8DB35C, 'leafcard', .95, 0], ivyShade: [0x3F6E4A, 'leafcard', .97, 0],
  bark: [0x6B5A45, 'bark', .97, 0], barkShade: [PAL.shade, 'bark', .98, 0],
  deck: [0xB39A7C, 'timber', .9, 0], deckOld: [0x9C8F7D, 'timber', .92, 0], deckDark: [0x6E5E4E, 'timber', .95, 0], stoneCool: [0xA9A898, 'stone', .94, 0], heartwood: [0x4A3020, 'timber', .95, 0], heartwoodLight: [0x6B4428, 'timber', .9, 0], pavingDeep: [0x9D968A, 'stone', .95, 0], stoneDeep: [0x7E8A82, 'stone', .96, 0], metalWorn: [0x8C7560, 'metal', .7, .25], paving: [PAL.ivory, 'stone', .92, 0], ink: [PAL.ink, 'metal', .7, .1],
  glass: [PAL.dawn, 'glass', .3, 0], far: [0x6F8F86, 'foliage', 1, 0], farLight: [0x9DB7A6, 'foliage', 1, 0],
  mist: [0xE8EEE6, 'fabric', 1, 0],
};

const linCache = new WeakMap();
/** Soft linen: near-white warm weave, faint lengthwise seams and a gentle belly shading (multiplies the cloth colour). */
export function linenTexture(THREE) {
  if (linCache.has(THREE)) return linCache.get(THREE);
  let t = null;
  if (typeof document !== 'undefined') {
    const W = 128, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
    let sd = 11; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(120,100,70,${.03 + r() * .04})`; x.fillRect(r() * W, r() * H, 1 + r() * 4, 1); }   // soft weave slubs
    for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(120,100,70,${.02 + r() * .03})`; x.fillRect(r() * W, r() * H, 1, 1 + r() * 4); }
    for (const sx of [W * .33, W * .66]) { x.fillStyle = 'rgba(120,95,65,.12)'; x.fillRect(sx - 1, 0, 2, H); }   // faint seams
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(90,70,50,.16)'); g.addColorStop(.45, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(90,70,50,.2)'); x.fillStyle = g; x.fillRect(0, 0, W, H);   // belly shading
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  }
  linCache.set(THREE, t); return t;
}

const matCache = new WeakMap();
/**
 * Light shafts: soft volumetric-looking beams (the world builds them as open cones, so every silhouette is seen
 * edge-on and feathers away). Additive on colour only: the alpha channel (the post pass's ink/terrain mask) is left
 * untouched, so a beam never draws ink seams where it meets the floor. Not swapped by the renderer (own shader).
 */
function softShaft(THREE) {
  const m = new THREE.ShaderMaterial({
    uniforms: {uTime: {value: 0}, uColor: {value: new THREE.Color(0xFFD68A)}, uAmt: {value: .075}},
    vertexShader: 'varying vec3 vW, vN; void main() { vec4 w = modelMatrix * vec4( position, 1.0 ); vW = w.xyz; vN = normalize( mat3( modelMatrix ) * normal ); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime, uAmt; uniform vec3 uColor; varying vec3 vW, vN;
float h( vec3 p ) { return fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 ); }
float n3( vec3 p ) { vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( h( i ), h( i + vec3( 1, 0, 0 ) ), f.x ), mix( h( i + vec3( 0, 1, 0 ) ), h( i + vec3( 1, 1, 0 ) ), f.x ), f.y ), mix( mix( h( i + vec3( 0, 0, 1 ) ), h( i + vec3( 1, 0, 1 ) ), f.x ), mix( h( i + vec3( 0, 1, 1 ) ), h( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }
void main() {
  vec3 V = normalize( cameraPosition - vW ); float facing = abs( dot( normalize( vN ), V ) );
  float feather = pow( facing, 3.0 );
  float dust = 0.55 + 0.45 * n3( vW * 0.7 + vec3( 0.0, - uTime * 0.12, uTime * 0.05 ) );
  float d = length( cameraPosition - vW ), near = smoothstep( 3.0, 10.0, d ) * ( 1.0 - smoothstep( 45.0, 90.0, d ) );
  float a = feather * dust * near * uAmt;
  if ( a < 0.002 ) discard;
  gl_FragColor = vec4( uColor * a, 0.0 );
}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  m.name = 'shaft'; m.userData.bhKey = 'shaftSoft'; m.userData.look = false;
  m.onBeforeRender = () => { m.uniforms.uTime.value = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000; };
  return m;
}
/** Shared palette materials for this THREE instance (one object per name, so bins merge). */
export function materials(THREE) {
  let m = matCache.get(THREE);
  if (m) return m;
  m = {};
  for (const [key, [color, name, roughness, metalness]] of Object.entries(MAT_DEFS)) {
    const mat = new THREE.MeshStandardMaterial({color, roughness, metalness});
    mat.name = name; mat.userData.bhKey = key; m[key] = mat;
  }
  // double-sided cards, with a little self-light so a leaf in shadow (or seen from behind) is never near-black
  for (const k of ['ivy', 'ivyLight', 'ivyShade']) { m[k].side = THREE.DoubleSide; m[k].emissive = m[k].color.clone().multiplyScalar(.22); }
  // thin cloth: a soft linen weave (browser only) so sails and awnings read as fabric even without shadow receive
  const lin = linenTexture(THREE); if (lin) for (const k of ['cloth', 'clothIvory']) { m[k].map = lin; m[k].needsUpdate = true; }
  // the ancient channels: dark inlays that glow faintly (cyan = wind, gold = the old bells)
  m.inlayCyan = Object.assign(new THREE.MeshStandardMaterial({color: 0x2C4A45, roughness: .6, emissive: PAL.wind, emissiveIntensity: .3}), {name: 'glass'}); m.inlayCyan.userData.bhKey = 'inlayCyan';
  m.inlayGold = Object.assign(new THREE.MeshStandardMaterial({color: 0x5A4020, roughness: .6, emissive: PAL.gold, emissiveIntensity: .35}), {name: 'glass'}); m.inlayGold.userData.bhKey = 'inlayGold';
  m.shaft = softShaft(THREE);
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
// Large architecture (walls, houses, stalls, gate arches, big decks): the camera spring arm avoids it, so it never
// dithers away for the occluder fade. Small props (barrels, lamps, rails, crates) may still fade.
const isBig = (bb) => { if (bb.isEmpty()) return false; const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z, h = bb.max.y - bb.min.y, hi = Math.max(w, d), lo = Math.min(w, d);
  return (h >= 1.9 && hi >= 1.4) || lo >= 2.5; };
const SOFT_KEYS = /leaf|foliage|canopy|cloth|fabric|glass|lantern|shaft|mist|ivy|vine|moss|flower|petal|rope/i;
export class Bins {
  constructor(THREE, name) { this.T = THREE; this.name = name; this.map = new Map(); this.mats = materials(THREE); this._m = new THREE.Matrix4(); }
  /** Add a geometry (consumed) in world space. big: 1/0 tags the piece as large architecture (never fades for the
   *  camera occluder fade, render/toon.js); undefined = judge from this piece's own bounding box. */
  add(geo, matKey, matrix, big) {
    if (!geo) return;
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (matrix) g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new this.T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.morphAttributes = {}; g.clearGroups();
    const key = typeof matKey === 'string' ? matKey : matKey.userData.bhKey;
    g.computeBoundingBox(); const bb = g.boundingBox;
    if (big === undefined) big = isBig(bb);
    if (SOFT_KEYS.test(key)) big = /cloth|fabric/i.test(key) ? .5 : 0;   // foliage, glass: may fade; cloth (sails) .5 = hidden only right at the lens, never cut out around the hero
    // Tall large pieces of static blocks: boxes the camera arm keeps out of (main.js). Bark/trunk has its own solids.
    if (big && this.boxes && bb.max.y - bb.min.y >= 1.9 && Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) <= 10 && !/^(bark|barkShade|heartwood|heartwoodLight|trunk)/.test(key)) this.boxes.push([bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z]);
    g.setAttribute('bkBig', new this.T.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(big === .5 ? .5 : big ? 1 : 0), 1));
    if (!this.map.has(key)) this.map.set(key, {mat: typeof matKey === 'string' ? this.mats[matKey] : matKey, geos: []});
    this.map.get(key).geos.push(g);
  }
  /** Add every mesh of an Object3D (after its world matrix), mapping materials to keys. */
  addObject(obj, matrix) {
    const T = this.T;
    obj.updateMatrixWorld(true);
    const base = matrix || new T.Matrix4();
    // Size class of the whole asset (a house is large even if its roof is many small tiles; a barrel is small).
    const bb = new T.Box3().setFromObject(obj).applyMatrix4(base), big = isBig(bb) ? 1 : 0, boxes = this.boxes;
    this.boxes = null;   // sub-meshes of this asset are covered by its box (added below unless it is a tree)
    let organic = false;
    obj.traverse((n) => {
      if (!n.isMesh) return;
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      const key = mats[0].userData.bhKey || keyFor(this.mats, mats[0]);
      if (/^bark/.test(key)) organic = true;   // trees (bark) are handled by the bark ray; ivy/planters do not exempt a tower
      const own = !this.mats[key] && mats[0].userData.bhKey ? mats[0] : null;   // an asset's own keyed material (e.g. a textured sail) is kept
      // Small parts of a large asset (window boxes, posts, signs) may still fade; walls and roofs keep the asset's class.
      if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
      const nb = n.geometry.boundingBox, nd = Math.max(nb.max.x - nb.min.x, nb.max.y - nb.min.y, nb.max.z - nb.min.z) * n.matrixWorld.getMaxScaleOnAxis(), pb = big && (nd >= 1.3 || /^tile/.test(key)) ? 1 : 0;
      const push = (m) => { const g = n.geometry.clone(); g.applyMatrix4(m); this.add(g, own || key, null, pb); };
      if (n.isInstancedMesh) { const im = new T.Matrix4(); for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, im); push(new T.Matrix4().multiplyMatrices(base, new T.Matrix4().multiplyMatrices(n.matrixWorld, im))); } }
      else push(new T.Matrix4().multiplyMatrices(base, n.matrixWorld));
    });
    this.boxes = boxes;
    if (big && boxes && !organic && bb.max.y - bb.min.y >= 1.9) boxes.push([bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z]);
  }
  bake(parent) {
    const T = this.T, group = new T.Group(); group.name = 'bh-block-' + this.name;
    for (const [key, {mat, geos}] of this.map) {
      if (!geos.length) continue;
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere(); merged.computeBoundingBox();
      const mesh = new T.Mesh(merged, mat); mesh.name = `bh-${this.name}-${key}`;
      mesh.castShadow = !['mist', 'far', 'farLight', 'shaft'].includes(key) && !/^ivy/.test(key);   // ivy cards: no jagged shadow halos
      // thin cloth (sails, awnings, banners: coplanar front/back sheets) takes no shadow map: self-shadow acne there
      // flickers as the shadow camera follows the hero (the hero coat had the same fix)
      mesh.receiveShadow = key !== 'shaft' && !/^(cloth|ivy)/.test(key);
      if (key === 'shaft') { mesh.renderOrder = 5; mesh.userData.noOutline = true; }
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      group.add(mesh);
    }
    this.map.clear();
    if (this.boxes) group.userData.bigBoxes = this.boxes;
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
    if (k === 'lanternOff' || !m.color) continue;
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

/**
 * Leaf cards: small kite-shaped leaves (2 triangles per face, both faces) collected per palette key, so ivy is
 * leafy and irregular instead of strings of round beads. add(p, n, up, size, rot) places one leaf at p, facing n.
 */
export function leafCards(THREE, B) {
  const bins = {ivy: [], ivyLight: [], ivyShade: []}, nrm = {ivy: [], ivyLight: [], ivyShade: []}, t = new THREE.Vector3(), v = new THREE.Vector3(), N = new THREE.Vector3(), L2 = new THREE.Vector3();
  const KEY = {leaf: 'ivy', leafLight: 'ivyLight', leafShade: 'ivyShade'};
  // a rounded leaf: 12-point oval outline with a pointed tip (fan from the base), one double-sided face
  const SHAPE = [[0, .45]];   // fan centre
  for (let i = 0; i <= 12; i++) { const th = -Math.PI / 2 + Math.PI * 2 * i / 12; SHAPE.push(i === 6 ? [0, 1.1] : [Math.cos(th) * .42, .5 + Math.sin(th) * .5]); }   // oval, pointed tip at i = 6
  const add = (p, n, up, size, rot = 0, key = 'leaf', lift = .03) => {
    N.copy(n).normalize(); t.copy(up).cross(N).normalize(); v.copy(N).cross(t).normalize();
    // shading normal lifted toward the sky/sun so a leaf never goes near-black
    L2.copy(N).multiplyScalar(.55).add(new THREE.Vector3(0, .75, 0)).normalize();
    const c = Math.cos(rot), s = Math.sin(rot), Lf = size, W = size * .9;
    const P = ([x0, y0]) => { const x = x0 * W, y = y0 * Lf, cup = (1 - Math.abs(x0) * 2.2) * .025 * size * 4; return [p.x + (t.x * (x * c - y * s) + v.x * (x * s + y * c)) + N.x * (lift + cup), p.y + (t.y * (x * c - y * s) + v.y * (x * s + y * c)) + N.y * (lift + cup), p.z + (t.z * (x * c - y * s) + v.z * (x * s + y * c)) + N.z * (lift + cup)]; };
    const q = SHAPE.map(P), k = KEY[key] || key, arr = bins[k], na = nrm[k];
    for (let i = 1; i < q.length - 1; i++) { arr.push(...q[0], ...q[i], ...q[i + 1]); for (let j = 0; j < 3; j++) na.push(L2.x, L2.y, L2.z); }
  };
  const flush = () => { for (const [k, a] of Object.entries(bins)) if (a.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm[k], 3)); B.add(g, k); a.length = 0; nrm[k].length = 0; } };
  return {add, flush};
}

/** Hanging ivy drape: a curtain of irregular leafy strands of different lengths (bark walls, gallery soffits). */
export function mossDrape(THREE, B, x, y, z, w = 1.2, h = 1.6, seed = 1, face = 0) {
  const rnd = rng(seed * 31 + 7), c = Math.cos(face), s = Math.sin(face), cards = leafCards(THREE, B);
  const n = new THREE.Vector3(s, 0, c), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3();
  const strands = Math.max(3, Math.round(w / .16));
  for (let k = 0; k < strands; k++) {
    const lx0 = (k / (strands - 1) - .5) * w + (rnd() - .5) * .1, len = h * (.35 + rnd() * .65) * (1 - Math.abs(lx0 / w) * .5), ph = rnd() * 6;
    for (let d = 0; d < len; d += .085 + rnd() * .05) {
      const f = d / h, lx = lx0 + Math.sin(ph + d * 2.3) * .07;
      p.set(x + lx * c, y - d, z - lx * s);
      const key = f < .15 ? (rnd() < .5 ? 'leaf' : 'leafShade') : rnd() < .3 ? 'leafLight' : rnd() < .6 ? 'leaf' : 'leafShade';
      cards.add(p, n, up, .17 + rnd() * .11 - f * .04, Math.PI + (rnd() - .5) * 1.6, key, .02 + rnd() * .05);
    }
  }
  cards.flush();
}

/**
 * Climbing ivy on a round/octagonal tower centred at (cx, cz): stems wander up the surface from the foot, leaves
 * sit on the surface facing out (radius rAt(yLocal)). faceAz = azimuth (deg) the patch is centred on.
 */
export function ivyClimb(THREE, B, cx, y0, cz, h, rAt, faceAz, seed = 1, spread = 32) {
  const rnd = rng(seed * 131 + 17), cards = leafCards(THREE, B), p = new THREE.Vector3(), n = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const stems = 3 + (seed % 2);
  for (let k = 0; k < stems; k++) {
    let a = faceAz + (k - (stems - 1) / 2) * spread / stems + (rnd() - .5) * 8, yy = 0; const top = h * (.45 + rnd() * .55), drift = (rnd() - .5) * 26;
    while (yy < top) {
      a += drift * .06 + (rnd() - .5) * 5; yy += .1 + rnd() * .06;
      const r = rAt(yy), ar = a * DEG, taper = 1 - yy / top * .45;
      for (let q = 0; q < 2; q++) {
        const side = q ? 1 : -1, aa = ar + side * (.05 + rnd() * .09) * taper;
        n.set(Math.sin(aa), .15, Math.cos(aa)); p.set(cx + Math.sin(aa) * r, y0 + yy + (rnd() - .5) * .05, cz + Math.cos(aa) * r);
        if (rnd() < .3) continue;   // gaps: stem and wall show through
        const key = rnd() < .28 ? 'leafLight' : rnd() < .7 ? 'leaf' : 'leafShade';
        cards.add(p, n, up, (.2 + rnd() * .12) * (.7 + .3 * taper), side * (.5 + rnd() * .7), key, .03 + rnd() * .04);
      }
    }
    // a trailing runner falling away from the stem's top, off the wall
    { const ar = a * DEG, r = rAt(yy); for (let j = 1; j <= 4; j++) { n.set(Math.sin(ar), .3, Math.cos(ar)); p.set(cx + Math.sin(ar) * (r + .02), y0 + yy - j * .16, cz + Math.cos(ar) * (r + .02)); cards.add(p, n, up, .17, Math.PI + (rnd() - .5), j % 2 ? 'leaf' : 'leafShade', .04); } }
  }
  cards.flush();
}
