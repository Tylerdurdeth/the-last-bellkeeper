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

// Carved panels sunk into the gallery back wall (azimuths; world.js places the reliefs inside them).
export const CARVINGS = [158, 197, 236, 276];
const CARVE_HALF_A = 6, CARVE_H0 = -1.05, CARVE_H1 = .95, CARVE_DEPTH = .42;   // deg; m below/above the panel centre; recess depth
/** Gallery walkway height at azimuth a (same curve as world.js galY). */
export const galleryY = (a) => 4 - 8 * Math.min(1, Math.max(0, (a - 100) / 250) / .9);
export const carvingCentreY = (az) => galleryY(az) + 1.9;
export const carvingRecessR = () => HOLLOW.gallery.r1 + CARVE_DEPTH;

// Interior bark wall: a real texture on cylindrical UVs (angle x radius, height) at even texel density, so the
// Hollow's curved wall has no triplanar facet seams (patchwork) and no grazing-angle streaks.
const WALL_TILE = 4.5;   // metres per bark tile on the interior wall
const wallMats = new WeakMap();
export function barkWallMaterial(T) {
  if (!wallMats.has(T)) wallMats.set(T, paintedWood(T, [0x6B, 0x5A, 0x45], 'bark', 'barkWall', .8));
  return wallMats.get(T);
}
/** Palette wood with the bark painting's value detail on its own UVs (loaded in the browser; flat colour in node). */
function paintedWood(T, base, name, key, contrast) {
  const m = new T.MeshStandardMaterial({color: (base[0] << 16) | (base[1] << 8) | base[2], roughness: .97, metalness: 0});
  m.name = name; m.userData.bhKey = key;
  if (typeof document === 'undefined' || typeof Image === 'undefined') return m;   // node (tests): flat colour
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data; let mean = 0;
    for (let i = 0; i < d.length; i += 4) mean += .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
    mean /= d.length / 4;
    // Palette bark with the painting's value detail (and 30% of its own hue): calm, never a loud pattern.
    for (let i = 0; i < d.length; i += 4) {
      const l = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2], rel = 1 + (l / mean - 1) * contrast;
      for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, base[k] * rel * .7 + d[i + k] * (base[k] / Math.max(1, mean)) * .3 * 1.0));
    }
    x.putImageData(id, 0, 0);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    m.map = t; m.color.set(0xffffff); m.needsUpdate = true;
  };
  img.src = new URL('../../textures/v2/bark.webp', import.meta.url).href;
  return m;
}

const at3 = (a, r, y) => [r * Math.sin(a * DEG), y, r * Math.cos(a * DEG)];
// Carving recess: a dark, flat cut (sides + floor) with an ink rim where it breaks the bark.
const recMats = new WeakMap();
function recessMats(T) {
  if (!recMats.has(T)) {
    // flat, dark, double-sided (no stretched bark, never see-through from a grazing angle) + a thin ink rim
    const floor = new T.MeshStandardMaterial({color: 0x2F2219, roughness: .95, metalness: 0, side: T.DoubleSide}); floor.name = 'timber'; floor.userData.bhKey = 'recessDark';
    recMats.set(T, {floor});
  }
  return recMats.get(T);
}
// The geode's cut faces: the same painted bark on (radius, height) UVs. These big flat faces meet the sun at grazing
// angles, where the shadow map stripes them with acne: they take no shadow map (the Hollow's darkness grade applies).
const cutMats = new WeakMap();
function heartwoodCutMaterial(T) {
  if (cutMats.has(T)) return cutMats.get(T);
  const m = paintedWood(T, [0x6B, 0x5A, 0x45], 'bark', 'barkCut', .8);
  m.onBeforeRender = (r, sc, cam, geo, obj) => { if (obj.receiveShadow) obj.receiveShadow = false; };
  cutMats.set(T, m); return m;
}

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
  const bark = [], barkUV = [], stone = [], stoneUV = [], cut = [], cutUV = [], cham = [], chamUV = [], shell = [], shellUV = [];
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
      // cylindrical UVs at the interior wall's texel density (painted bark map, no triplanar facet seams)
      // one constant u scale for every row (a per-row radius made the texture jump at each row: horizontal seams);
      // the circumference is a whole number of tiles, so the -180/180 wrap is seamless too
      const SHELL_TILES = 16, u0 = (a + 180) / 360 * SHELL_TILES, u1 = (a + AS + 180) / 360 * SHELL_TILES;
      quad(shell, shellUV, P(a, y0), P(a + AS, y0), P(a + AS, y1), P(a, y1), u0, y0 / (2 * Math.PI * 11.5 / SHELL_TILES), u1, y1 / (2 * Math.PI * 11.5 / SHELL_TILES));
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
      // the geode's cut faces show heartwood (sawn wood), not bark painted edge-on
      // both sides (seen from the wedge and from inside); per-vertex UVs = (radius, height) at the wall's density
      const uvOf = (p) => [Math.hypot(p[0], p[2]) / WALL_TILE, p[1] / WALL_TILE];
      for (const tri of [[A, D, C], [A, C, Bq], [A, Bq, C], [A, C, D]]) for (const p of tri) { cut.push(...p); cutUV.push(...uvOf(p)); }
    }
  };
  edgeFace(HOLLOW.open0, false); edgeFace(HOLLOW.open1, true);
  // Soffit under the opening's arch: from bark edge in to the ceiling cone.
  for (let a = HOLLOW.open0; a < HOLLOW.open1; a += AS) {
    const t0 = openTop(a), t1 = openTop(a + AS);
    const rc = (t) => HOLLOW.gallery.r1 * Math.min(1, Math.max(0, 1 - (t - HOLLOW.ceilBase) / (HOLLOW.ceilTop - HOLLOW.ceilBase)));   // never beyond the wall (no flap into the sky)
    const s0 = Math.sin(a * DEG), c0 = Math.cos(a * DEG), s1 = Math.sin((a + AS) * DEG), c1 = Math.cos((a + AS) * DEG);
    const o0 = trunkR(t0) + ridge(a * DEG, t0), o1 = trunkR(t1) + ridge((a + AS) * DEG, t1);
    quad(bark, barkUV, [s0 * o0, t0, c0 * o0], [s0 * rc(t0), t0, c0 * rc(t0)], [s1 * rc(t1), t1, c1 * rc(t1)], [s1 * o1, t1, c1 * o1], 0, 0, 1, 1);
  }
  // Cavity back wall (facing inward) from the gallery floor up to the ceiling base: one smooth indexed grid
  // (2 deg x 0.45 m) with cylindrical UVs, and a sunken panel (recess) cut into it for every carving.
  const Rg = HOLLOW.gallery.r1;
  const wob = (aa, yy) => Rg + .14 * Math.sin(aa * .7 + yy * 1.3) + .08 * Math.sin(aa * 1.9 - yy);
  const wall = {pos: [], uv: [], idx: [], ink: []};
  {
    const WA = 2, a0 = HOLLOW.open1, a1 = HOLLOW.open0 + 360, ny = Math.ceil((HOLLOW.ceilBase + 4.6) / .45), na = Math.round((a1 - a0) / WA);
    const yAt = (j) => -4.6 + (HOLLOW.ceilBase + 4.6) * j / ny;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= na; i++) {
      const a = a0 + i * WA, y = yAt(j), r = wob(a, y);
      wall.pos.push(r * Math.sin(a * DEG), y, r * Math.cos(a * DEG)); wall.uv.push(a * DEG * Rg / WALL_TILE, y / WALL_TILE);
    }
    const holes = CARVINGS.map((az) => { const cy = carvingCentreY(az); return {a0: az - CARVE_HALF_A, a1: az + CARVE_HALF_A, y0: cy + CARVE_H0, y1: cy + CARVE_H1}; });
    // snap each hole to the grid so the recess walls meet the wall's own vertices (watertight)
    for (const h of holes) {
      h.i0 = Math.round((h.a0 - a0) / WA); h.i1 = Math.round((h.a1 - a0) / WA);
      h.j0 = Math.max(0, Math.round((h.y0 + 4.6) / (HOLLOW.ceilBase + 4.6) * ny)); h.j1 = Math.min(ny, Math.round((h.y1 + 4.6) / (HOLLOW.ceilBase + 4.6) * ny));
    }
    const inHole = (i, j) => holes.some((h) => i >= h.i0 && i < h.i1 && j >= h.j0 && j < h.j1);
    const V = (i, j) => j * (na + 1) + i;
    for (let j = 0; j < ny; j++) for (let i = 0; i < na; i++) if (!inHole(i, j)) wall.idx.push(V(i, j), V(i, j + 1), V(i + 1, j + 1), V(i, j), V(i + 1, j + 1), V(i + 1, j));
    // recess: bevelled side walls from the opening back to a panel face CARVE_DEPTH deeper (world.js fills
    // the panel with the heartwood slab and its relief)
    const rec = [], recUV = [];
    const vtx = (i, j) => wall.pos.slice(V(i, j) * 3, V(i, j) * 3 + 3);
    const deep = (p, k = 1) => { const r = Math.hypot(p[0], p[2]), f = (Rg + CARVE_DEPTH * k) / r; return [p[0] * f, p[1], p[2] * f]; };
    const inset = (p, cx, cy, k) => { const d = deep(p); const a = Math.atan2(d[0], d[2]), ca = Math.atan2(cx[0], cx[2]); const na2 = ca + (a - ca) * k, r = Math.hypot(d[0], d[2]); return [r * Math.sin(na2), cy + (d[1] - cy) * k, r * Math.cos(na2)]; };
    for (const h of holes) {
      const c = at3((h.a0 + h.a1) / 2, Rg + CARVE_DEPTH, (h.y0 + h.y1) / 2), cy = c[1];
      const ring = [];
      for (let i = h.i0; i < h.i1; i++) ring.push([i, h.j0]);
      for (let j = h.j0; j < h.j1; j++) ring.push([h.i1, j]);
      for (let i = h.i1; i > h.i0; i--) ring.push([i, h.j1]);
      for (let j = h.j1; j > h.j0; j--) ring.push([h.i0, j]);
      const face = (A, Bp, C, D, want, out = rec, outUV = recUV) => {   // quad A-B-C-D, flipped so its normal faces `want`
        const u = [Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]], v = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) out.push(...A, ...D, ...C, ...A, ...C, ...Bp); else out.push(...A, ...Bp, ...C, ...A, ...C, ...D);
        outUV.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      };
      for (let k = 0; k < ring.length; k++) {
        const pa = vtx(...ring[k]), pb = vtx(...ring[(k + 1) % ring.length]);
        const qa = inset(pa, c, cy, .86), qb = inset(pb, c, cy, .86);   // sloped (chiselled) sides, slightly narrowing inward
        const mid = [(pa[0] + qb[0]) / 2, (pa[1] + qb[1]) / 2, (pa[2] + qb[2]) / 2], rr = Math.hypot(mid[0], mid[2]);
        // visible side: toward the panel centre and toward the trunk axis (the viewer)
        face(pa, pb, qb, qa, [c[0] - mid[0] - mid[0] / rr, c[1] - mid[1], c[2] - mid[2] - mid[2] / rr]);   // chiselled side (same bark, darker)
      }
      // ink rim: straight thin bars along the opening's edge (a drawn cut line, not a frame)
      for (let k = 0; k < ring.length; k++) {
        const p0 = vtx(...ring[k]), p1 = vtx(...ring[(k + 1) % ring.length]), sh = (p) => { const r = Math.hypot(p[0], p[2]), f = (r - .015) / r; return new T.Vector3(p[0] * f, p[1], p[2] * f); };
        const A3 = sh(p0), B3 = sh(p1), len = A3.distanceTo(B3); if (len < 1e-3) continue;
        const bar = new T.CylinderGeometry(.03, .03, len + .06, 4, 1); bar.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), B3.clone().sub(A3).normalize())); bar.translate((A3.x + B3.x) / 2, (A3.y + B3.y) / 2, (A3.z + B3.z) / 2);
        wall.ink.push(bar);
      }
      // the panel floor of the recess (sawn heartwood; world.js sets the carved relief on it)
      for (let j = h.j0; j < h.j1; j++) for (let i = h.i0; i < h.i1; i++) {
        const A = inset(vtx(i, j), c, cy, .86), Bp = inset(vtx(i + 1, j), c, cy, .86), C = inset(vtx(i + 1, j + 1), c, cy, .86), D = inset(vtx(i, j + 1), c, cy, .86);
        face(A, Bp, C, D, [-A[0], 0, -A[2]]);   // sunken floor (same bark, darker)
      }
    }
    // cylindrical UVs on the recess at the wall's texel scale
    for (let i = 0; i < rec.length; i += 3) recUV[i / 3 * 2] = Math.atan2(rec[i], rec[i + 2]) * Rg / WALL_TILE, recUV[i / 3 * 2 + 1] = rec[i + 1] / WALL_TILE;
    if (rec.length) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(rec, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(recUV, 2)); g.computeVertexNormals(); wall.recess = g; }
  }
  for (let a = -180; a < 180; a += AS) {
    const s0 = Math.sin(a * DEG), c0 = Math.cos(a * DEG), s1 = Math.sin((a + AS) * DEG), c1 = Math.cos((a + AS) * DEG);
    const yb = HOLLOW.ceilBase, yt = HOLLOW.ceilTop;
    bark.push(s0 * Rg, yb, c0 * Rg, 0, yt, 0, s1 * Rg, yb, c1 * Rg); barkUV.push(0, 0, .5, 1, 1, 0);
  }
  const mk = (pos, uv) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
  B.block('trunk');
  B.add(mk(bark, barkUV), 'bark');
  B.add(mk(shell, shellUV), barkWallMaterial(T));
  if (stone.length) B.add(mk(stone, stoneUV), 'paving');
  B.add(mk(cut, cutUV), heartwoodCutMaterial(T));
  { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(wall.pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(wall.uv, 2)); g.setIndex(wall.idx); g.computeVertexNormals();
    // the wall faces inward: make sure the normals point at the trunk axis
    const n = g.attributes.normal, p = g.attributes.position; if (n.getX(0) * p.getX(0) + n.getZ(0) * p.getZ(0) > 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
    B.add(g, barkWallMaterial(T)); if (wall.recess) B.add(wall.recess, recessMats(T).floor); for (const g of wall.ink) B.add(g, 'ink'); }

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
    B.add(taperTube(T, pts, 2.4, .9, 20, 14, .1, i + 3), 'bark');   // round, not faceted slabs
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
