// Layered ground + colliders for Bellhollow.
// ground(x,z,y): highest walkable surface at (x,z) whose height is <= y + STEP, or null.
// blocked(x,z,r,y): a visible solid/rail occupies the hero's body (y..y+1.5) within r.
// Every surface and collider registered here is paired with visible geometry by the
// structure builders (structures.js); nothing in this file draws.

export const STEP = .35;
const BODY = 1.5;

const inPoly = (pts, x, z) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
};
const azDeg = (x, z) => Math.atan2(x, z) * 180 / Math.PI;
/** Angle t of az within [a0,a1] (degrees, a1 > a0, may exceed 180) or -1 if outside. */
export function azFrac(az, a0, a1) {
  let a = az; while (a < a0) a += 360; while (a - 360 >= a0) a -= 360;
  return a <= a1 ? (a - a0) / (a1 - a0) : -1;
}

export function createGroundModel() {
  const surfaces = [], colliders = [], solids = [];

  function bbox(s) {
    if (s.type === 'poly') { const xs = s.pts.map((p) => p[0]), zs = s.pts.map((p) => p[1]); s.bb = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]; }
    else if (s.type === 'annulus' || s.type === 'disc') { const r = s.r1 ?? s.r; s.bb = [s.cx - r, s.cx + r, s.cz - r, s.cz + r]; }
    else if (s.type === 'ribbon') { const xs = s.pts.map((p) => p[0]), zs = s.pts.map((p) => p[2]); s.bb = [Math.min(...xs) - s.w, Math.max(...xs) + s.w, Math.min(...zs) - s.w, Math.max(...zs) + s.w]; }
  }

  /** Register a walkable surface. Returns it (mutable: enabled, dy). */
  function addSurface(s) {
    s.enabled ??= true; s.dy ??= 0; bbox(s); surfaces.push(s); return s;
  }

  function heightOf(s, x, z) {
    if (s.enabled === false || (typeof s.enabled === 'function' && !s.enabled())) return null;
    const [x0, x1, z0, z1] = s.bb;
    if (x < x0 || x > x1 || z < z0 || z > z1) return null;
    let h = null;
    if (s.type === 'poly') {
      if (!inPoly(s.pts, x, z)) return null;
      if (s.holes && s.holes.some((hp) => inPoly(hp, x, z))) return null;
      h = s.y + (s.gx || 0) * (x - (s.ox || 0)) + (s.gz || 0) * (z - (s.oz || 0));
    } else if (s.type === 'disc') {
      if ((x - s.cx) ** 2 + (z - s.cz) ** 2 > s.r * s.r) return null;
      h = s.y;
    } else if (s.type === 'annulus') {
      const d = Math.hypot(x - s.cx, z - s.cz);
      if (d < s.r0 || d > s.r1) return null;
      const f = azFrac(azDeg(x - s.cx, z - s.cz), s.a0, s.a1);
      if (f < 0) return null;
      const u = s.ease ? s.ease(f) : f;
      h = s.y0 + (s.y1 - s.y0) * u;
    } else if (s.type === 'ribbon') {
      const p = s.pts, hw = s.w / 2; let best = null, bestD = Infinity;
      for (let i = 1; i < p.length; i++) {
        const ax = p[i - 1][0], az = p[i - 1][2], bx = p[i][0], bz = p[i][2];
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
        let u = ((x - ax) * dx + (z - az) * dz) / L2;
        // Interior joints get round caps (no gaps on the outside of a bend); the ribbon's
        // two ends are cut square so they meet landings exactly.
        if (u < 0) { if (i === 1) continue; u = 0; }
        if (u > 1) { if (i === p.length - 1) continue; u = 1; }
        const d = Math.hypot(x - ax - u * dx, z - az - u * dz);
        if (d <= hw && d < bestD) { bestD = d; best = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * u; }
      }
      h = best;
    }
    if (h === null) return null;
    const dy = typeof s.dy === 'function' ? s.dy() : s.dy;
    return h + dy;
  }

  function ground(x, z, y) {
    const cap = y === undefined || y === null ? Infinity : y + STEP;
    let best = null;
    for (const s of surfaces) {
      const h = heightOf(s, x, z);
      if (h !== null && h <= cap && (best === null || h > best)) best = h;
    }
    return best;
  }

  /** All surface heights at x,z (for tests of layering). */
  function layers(x, z) {
    const out = [];
    for (const s of surfaces) { const h = heightOf(s, x, z); if (h !== null) out.push({id: s.id, h}); }
    return out.sort((a, b) => b.h - a.h);
  }

  /** Rail / wall segment. ya/yb: base heights at each end; h: height above base. */
  function addSegment(c) { c.type = 'seg'; c.t ??= .07; c.h ??= .95; c.enabled ??= true; colliders.push(c); return c; }
  function addCircle(c) { c.type = 'circle'; c.enabled ??= true; colliders.push(c); return c; }
  /** Oriented box footprint: centre x,z; half extents hw (local x), hd (local z); rot about Y. */
  function addBox(c) { c.type = 'box'; c.enabled ??= true; c.cos = Math.cos(c.rot || 0); c.sin = Math.sin(c.rot || 0); colliders.push(c); return c; }
  /** Volumetric solid predicate (x,z,y) -> bool; sampled around the hero's circle. */
  function addSolid(fn, id) { solids.push({fn, id}); }

  const live = (c) => !(c.enabled === false || (typeof c.enabled === 'function' && !c.enabled()));
  function hitsCollider(c, x, z, r, y) {
    if (!live(c)) return false;
    const dy = typeof c.dy === 'function' ? c.dy() : (c.dy || 0);
    if (c.type === 'seg') {
      const dx = c.bx - c.ax, dz = c.bz - c.az, L2 = dx * dx + dz * dz || 1e-9;
      const u = Math.max(0, Math.min(1, ((x - c.ax) * dx + (z - c.az) * dz) / L2));
      if (Math.hypot(x - c.ax - u * dx, z - c.az - u * dz) >= r + c.t) return false;
      const base = c.ya + (c.yb - c.ya) * u + dy;
      return y < base + c.h - .05 && y + BODY > base;
    }
    if (c.type === 'circle') {
      if (Math.hypot(x - c.x, z - c.z) >= r + c.r) return false;
      return y < c.y1 + dy - .05 && y + BODY > c.y0 + dy;
    }
    if (c.type === 'box') {
      const lx = (x - c.x) * c.cos - (z - c.z) * c.sin, lz = (x - c.x) * c.sin + (z - c.z) * c.cos;
      const qx = Math.max(Math.abs(lx) - c.hw, 0), qz = Math.max(Math.abs(lz) - c.hd, 0);
      if (Math.hypot(qx, qz) >= r) return false;
      return y < c.y1 + dy - .05 && y + BODY > c.y0 + dy;
    }
    return false;
  }

  function blocked(x, z, r = .23, y) {
    const yy = y === undefined || y === null ? (ground(x, z) ?? 0) : y;
    for (const c of colliders) if (hitsCollider(c, x, z, r, yy)) return true;
    // Thick decks are solid bodies: the hero cannot walk into a deck side that is more
    // than a step above their feet (it is drawn, so it collides).
    for (let k = 0; k <= 8; k++) {
      const a = k * Math.PI / 4, px = k === 8 ? x : x + Math.cos(a) * r, pz = k === 8 ? z : z + Math.sin(a) * r;
      for (const s of surfaces) {
        if (!s.body) continue;
        const h = heightOf(s, px, pz);
        if (h !== null && yy + STEP < h && yy + BODY > h - s.body) return true;
      }
    }
    if (solids.length) {
      for (let k = 0; k <= 8; k++) {
        const a = k * Math.PI / 4, px = k === 8 ? x : x + Math.cos(a) * r, pz = k === 8 ? z : z + Math.sin(a) * r;
        for (const s of solids) if (s.fn(px, pz, yy + .3) || s.fn(px, pz, yy + 1.3)) return true;
      }
    }
    return false;
  }

  /** Which collider/solid blocks (debug + tests). */
  function blocker(x, z, r = .23, y) {
    const yy = y ?? (ground(x, z) ?? 0);
    for (const c of colliders) if (hitsCollider(c, x, z, r, yy)) return c.id || c.type;
    for (let k = 0; k <= 8; k++) { const a = k * Math.PI / 4, px = k === 8 ? x : x + Math.cos(a) * r, pz = k === 8 ? z : z + Math.sin(a) * r; for (const s of surfaces) { if (!s.body) continue; const h = heightOf(s, px, pz); if (h !== null && yy + STEP < h && yy + BODY > h - s.body) return 'body:' + s.id; } }
    for (let k = 0; k <= 8; k++) { const a = k * Math.PI / 4, px = k === 8 ? x : x + Math.cos(a) * r, pz = k === 8 ? z : z + Math.sin(a) * r; for (const s of solids) if (s.fn(px, pz, yy + .3) || s.fn(px, pz, yy + 1.3)) return s.id; }
    return null;
  }

  return {surfaces, colliders, solids, addSurface, addSegment, addCircle, addBox, addSolid, ground, blocked, blocker, layers, heightOf};
}
