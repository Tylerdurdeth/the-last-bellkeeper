// The great trunk: a root-flared bole (r 13.2 at the terrace) narrowing to the Ø18
// trunk above y 14, crowned by canopy masses. Its south-east face is split open like
// a geode (az -10..100) to show the Hollow: gallery, rings and well.
// Exposes the shape functions so collision uses exactly the drawn radii.
import {taperTube, blob, polar, DEG, leafClump, mossDrape} from './core.js';

export const HOLLOW = {
  open0: -10, open1: 100,          // opening wedge (az degrees)
  gallery: {r0: 9.2, r1: 11.6},    // outermost band, spirals +4 -> -4
  high: {r0: 6.8, r1: 9.2, y: -4}, mid: {r0: 4.4, r1: 6.8, y: -9}, low: {r: 4.4, y: -14},
  floorFront: 13.4, bottom: -14.6, ceilBase: 9, ceilTop: 14,
};

const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
/** Mean bark radius at height y. */
export function trunkR(y) {
  if (y >= 14) return 9;
  if (y >= 5) return 9 + 4.2 * smooth((14 - y) / 9);
  if (y >= -8) return 13.2;
  return 13.2 + (-8 - y) * .12;
}
/** Top edge of the geode opening at azimuth a (ragged arch). */
export function openTop(a) {
  const f = (a - HOLLOW.open0) / (HOLLOW.open1 - HOLLOW.open0);
  return 8 + 3.6 * Math.sin(Math.PI * Math.min(1, Math.max(0, f))) + .6 * Math.sin(a * .31);
}
const inOpen = (a) => a >= HOLLOW.open0 && a <= HOLLOW.open1;
/** Radius of the hollow cavity at height y (behind the ring decks). */
export function cavR(y) { return y >= -4.5 ? HOLLOW.gallery.r1 : y >= -9.5 ? HOLLOW.high.r1 : HOLLOW.mid.r1; }
const ceilY = (d) => HOLLOW.ceilBase + (HOLLOW.ceilTop - HOLLOW.ceilBase) * Math.max(0, 1 - d / HOLLOW.gallery.r1);

/** Solid test for collision: inside bark and not inside the hollow. */
export function trunkSolid(x, z, y) {
  if (y > 40 || y < -30) return false;
  const d = Math.hypot(x, z);
  if (d > trunkR(y) + .1) return false;
  const a = Math.atan2(x, z) / DEG;
  if (inOpen(a) && y >= HOLLOW.bottom - .5 && y <= openTop(a)) return false;
  if (y >= HOLLOW.bottom - .5 && y <= ceilY(d) && d < cavR(y)) return false;
  return true;
}

/**
 * Build trunk geometry into bins: bark shell with the geode hole, cut faces, cavity
 * wall + ceiling (ivory stone), canopy, limbs, roots, bell galleries, copper pipes.
 */
export function buildTrunk(T, B, seed = 11) {
  const bark = [], barkUV = [], stone = [], stoneUV = [];
  const ridge = (a, y) => .32 * Math.abs(Math.sin(a * 11 + Math.sin(y * .21 + a * 3) * 1.4)) + .12 * Math.sin(a * 23 + y * .5) - .18;
  const P = (a, y, dr = 0) => { const r = trunkR(y) + ridge(a * DEG, y) + dr; return [r * Math.sin(a * DEG), y, r * Math.cos(a * DEG)]; };
  const quad = (arr, uvs, a, b, c, d, u0, v0, u1, v1) => { arr.push(...a, ...b, ...c, ...a, ...c, ...d); uvs.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1); };
  const AS = 4; // azimuth step (deg)
  const ys = []; for (let y = -30; y <= 36; y += 1.5) ys.push(y);
  // Outer shell. Quads in the opening (above bottom, below the ragged top) are skipped.
  for (let a = -180; a < 180; a += AS) {
    for (let i = 1; i < ys.length; i++) {
      const y0 = ys[i - 1], y1 = ys[i], am = a + AS / 2;
      if (inOpen(am) && y1 > HOLLOW.bottom && y0 < openTop(am)) continue;
      const r0 = trunkR(y0), u0 = a * DEG * r0 / 3, u1 = (a + AS) * DEG * r0 / 3;
      quad(bark, barkUV, P(a, y0), P(a + AS, y0), P(a + AS, y1), P(a, y1), u0, y0 / 3, u1, y1 / 3);
    }
  }
  // Crown cap: close the top of the trunk under the canopy.
  for (let a = -180; a < 180; a += AS * 2) { const p = P(a, 36), q = P(a + AS * 2, 36); bark.push(...p, ...q, 0, 40, 0); barkUV.push(0, 0, 1, 0, .5, 1); }
  // Cut faces of the geode at the two wedge edges: from the cavity out to the bark.
  const edgeFace = (a, flip) => {
    const top = openTop(a);
    for (let i = 1; i < ys.length; i++) {
      let y0 = Math.max(ys[i - 1], HOLLOW.bottom), y1 = Math.min(ys[i], top);
      if (y1 <= y0) continue;
      const rin = (y) => y > HOLLOW.low.y + .01 ? cavR(Math.min(y, -4.6) === y ? y : y) : 0;
      const c0 = rin(y0 + .01), c1 = rin(y1 - .01);
      const s = Math.sin(a * DEG), c = Math.cos(a * DEG), ro0 = trunkR(y0) + ridge(a * DEG, y0), ro1 = trunkR(y1) + ridge(a * DEG, y1);
      const A = [s * c0, y0, c * c0], Bq = [s * ro0, y0, c * ro0], C = [s * ro1, y1, c * ro1], D = [s * c1, y1, c * c1];
      quad(bark, barkUV, A, D, C, Bq, 0, y0 / 3, 3, y1 / 3); quad(bark, barkUV, A, Bq, C, D, 0, y0 / 3, 3, y1 / 3);  // both sides: seen from the wedge and from inside
    }
  };
  edgeFace(HOLLOW.open0, false); edgeFace(HOLLOW.open1, true);
  // Soffit under the opening's arch: from bark edge in to the ceiling cone.
  for (let a = HOLLOW.open0; a < HOLLOW.open1; a += AS) {
    const t0 = openTop(a), t1 = openTop(a + AS);
    const rc = (t) => HOLLOW.gallery.r1 * Math.max(0, 1 - (t - HOLLOW.ceilBase) / (HOLLOW.ceilTop - HOLLOW.ceilBase));
    const s0 = Math.sin(a * DEG), c0 = Math.cos(a * DEG), s1 = Math.sin((a + AS) * DEG), c1 = Math.cos((a + AS) * DEG);
    const o0 = trunkR(t0) + ridge(a * DEG, t0), o1 = trunkR(t1) + ridge((a + AS) * DEG, t1);
    quad(bark, barkUV, [s0 * o0, t0, c0 * o0], [s0 * rc(t0), t0, c0 * rc(t0)], [s1 * rc(t1), t1, c1 * rc(t1)], [s1 * o1, t1, c1 * o1], 0, 0, 1, 1);
  }
  // Cavity back wall (facing inward) from the gallery floor up to the ceiling base, and ceiling cone.
  const Rg = HOLLOW.gallery.r1;
  for (let a = HOLLOW.open1; a < HOLLOW.open0 + 360; a += AS) {
    const s0 = Math.sin(a * DEG), c0 = Math.cos(a * DEG), s1 = Math.sin((a + AS) * DEG), c1 = Math.cos((a + AS) * DEG);
    const wob = (aa, yy) => Rg + .14 * Math.sin(aa * .7 + yy * 1.3) + .08 * Math.sin(aa * 1.9 - yy);
    for (let y = -4.6; y < HOLLOW.ceilBase; y += 1.35) {
      const y1 = Math.min(HOLLOW.ceilBase, y + 1.35), a1 = a + AS;
      const r00 = wob(a, y), r01 = wob(a, y1), r11 = wob(a1, y1), r10 = wob(a1, y);
      const gy = 4 - 8 * Math.min(1, Math.max(0, (a - 100) / 250) / .9), barky = y >= gy + 2.7;
      if (barky || true) quad(bark, barkUV, [s0 * r00, y, c0 * r00], [s0 * r01, y1, c0 * r01], [s1 * r11, y1, c1 * r11], [s1 * r10, y, c1 * r10], a * DEG * Rg / 3, y / 3, a1 * DEG * Rg / 3, y1 / 3);
      else quad(stone, stoneUV, [s0 * r00, y, c0 * r00], [s0 * r01, y1, c0 * r01], [s1 * r11, y1, c1 * r11], [s1 * r10, y, c1 * r10], a * DEG * Rg / 3, y / 3, a1 * DEG * Rg / 3, y1 / 3);
    }
  }
  for (let a = -180; a < 180; a += AS) {
    const s0 = Math.sin(a * DEG), c0 = Math.cos(a * DEG), s1 = Math.sin((a + AS) * DEG), c1 = Math.cos((a + AS) * DEG);
    const yb = HOLLOW.ceilBase, yt = HOLLOW.ceilTop;
    bark.push(s0 * Rg, yb, c0 * Rg, 0, yt, 0, s1 * Rg, yb, c1 * Rg); barkUV.push(0, 0, .5, 1, 1, 0);
  }
  const mk = (pos, uv) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
  B.block('trunk');
  B.add(mk(bark, barkUV), 'bark');
  B.add(mk(stone, stoneUV), 'paving');

  // Root buttresses flaring into the mist (kept below walk levels near the terrace).
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 14; i++) {
    const a = -180 + i / 14 * 360 + rnd() * 10, r = trunkR(-6);
    if (a > -28 && a < 118) continue; // keep the geode opening clear for the camera
    const p0 = polar(a, r - 1.2), p1 = polar(a + 3, r + 3.5), p2 = polar(a + 6, r + 8 + rnd() * 3), p3 = polar(a + 8, r + 11 + rnd() * 4), y0 = -3 - rnd() * 2;
    B.add(taperTube(T, [[p0[0], y0, p0[1]], [p1[0], y0 - 4, p1[1]], [p2[0], y0 - 11, p2[1]], [p3[0], -30, p3[1]]], 3.4, 1.4, 14, 9, .14, i), 'bark');
  }
  // Great limbs reaching into the canopy.
  const limbs = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * 360 + 15, a2 = a + 18 - rnd() * 36, y0 = 22 + rnd() * 6, L = 16 + rnd() * 10;
    const p0 = polar(a, 7), p1 = polar(a + 4, 14), p2 = polar(a2, L + 6);
    const pts = [[p0[0], y0, p0[1]], [p1[0], y0 + 3.5, p1[1]], [p2[0], y0 + 7 + rnd() * 5, p2[1]]];
    B.add(taperTube(T, pts, 2.4, .9, 12, 8, .1, i + 3), 'bark');
    limbs.push(pts[2]);
  }
  // Canopy: big lumpy leaf masses on limb ends + crown.
  B.block('canopy');
  const blobs = [];
  for (const [x, y, z] of limbs) { blobs.push([x, y + 2, z, 7 + rnd() * 3]); blobs.push([x * .75, y + 5, z * .75, 6 + rnd() * 3]); }
  for (let i = 0; i < 7; i++) { const [x, z] = polar(i / 7 * 360 + 25, 8 + rnd() * 5); blobs.push([x, 38 + rnd() * 5, z, 8 + rnd() * 3]); }
  blobs.push([0, 44, 0, 11]);
  // Clustered rounded clumps (R-foliage-tree): fewer, denser, dark undersides, light caps.
  blobs.forEach(([x, y, z, r], i) => {
    const n = r > 9 ? 4 : 3;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + i, d = k === 0 ? 0 : r * .5;
      leafClump(T, B, x + Math.cos(a) * d, y + (k === 0 ? r * .15 : -r * .1), z + Math.sin(a) * d, r * (k === 0 ? .62 : .5), i * 5 + k, 5);
    }
  });
  // Hanging moss/ivy strands down the bole (reads as the title art's greenery).
  for (let i = 0; i < 26; i++) {
    const a = rnd() * 360; if (inOpen(a) && rnd() < .7) continue;
    const y = 10 + rnd() * 14, [x, z] = polar(a, trunkR(y) + .35);
    mossDrape(T, B, x, y, z, 1.4 + rnd(), 2 + rnd() * 1.5, i + 40, a * DEG + Math.PI / 2);
  }

  // Carved bell galleries ringing the trunk (visual): stone band, arches, small bells.
  B.block('trunk-galleries');
  for (const [gy, n] of [[18.5, 14], [25.5, 12]]) {
    const r = trunkR(gy) + .2;
    for (let i = 0; i < n; i++) {
      const a = i / n * 360;
      if (inOpen(a) && gy < 12) continue;
      const [x, z] = polar(a, r + .9);
      const ry = a * DEG;
      B.add(new T.BoxGeometry(2.3 * r * Math.PI / n, .35, 2.1).rotateY(ry).translate(...polar(a, r + .7).flatMap((v, k) => k === 0 ? [v, gy] : [v])), 'stone');
      B.add(new T.BoxGeometry(.35, 2.4, .35).translate(x, gy + 1.35, z), 'stone');
      const [ax, az] = polar(a + 180 / n, r + 1.4);
      B.add(new T.TorusGeometry(.95, .14, 4, 10, Math.PI).rotateY(ry + Math.PI / 2 + Math.PI / n).translate(ax, gy + 1.6, az), 'stone');
      // bell
      const bell = new T.LatheGeometry([[0, 0], [.16, -.03], [.2, -.2], [.24, -.45], [.33, -.62], [0, -.6]].reverse().map(([u, v]) => new T.Vector2(u, v)), 8);
      B.add(bell.translate(ax, gy + 2.3, az), 'verdigris');
    }
    // cornice ring
    const ring = new T.TorusGeometry(r + 1.6, .18, 4, 48); ring.rotateX(Math.PI / 2); ring.translate(0, gy + 2.7, 0); B.add(ring, 'stoneShade');
    const ring2 = new T.TorusGeometry(r + 1.7, .12, 4, 48); ring2.rotateX(Math.PI / 2); ring2.translate(0, gy + .9, 0); B.add(ring2, 'copper');
  }
  // Copper pipes climbing the bark (wind carried up to the galleries).
  for (const a of [-150, -115, -60, -30, 115, 150, 175]) {
    const pts = [];
    for (let y = -2; y <= 25; y += 3) { const [x, z] = polar(a + Math.sin(y * .2) * 3, trunkR(y) + .55); pts.push([x, y, z]); }
    const tb = new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p))), 30, .28, 7);
    B.add(tb, 'verdigris');
    for (let k = 1; k < pts.length - 1; k += 2) { const tr = new T.TorusGeometry(.36, .09, 5, 10); tr.rotateX(Math.PI / 2); tr.translate(...pts[k]); B.add(tr, 'copper'); }
  }
}
