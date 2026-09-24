// Structure builders: every walkable deck and every rail is created here, and each call
// registers the matching ground surface / collider in the ground model at the same
// time, so collision can never drift from what is drawn.
import {Bins, rod, taperTube} from './core.js';

export class Builder {
  constructor(THREE, gm, root) {
    this.T = THREE; this.gm = gm; this.root = root; this.blocks = new Map(); this.cur = null;
    this.rails = []; // {id, pts:[[x,y,z]...], style, kind:'edge'|'fence'}
  }
  block(name) {
    if (!this.blocks.has(name)) this.blocks.set(name, new Bins(this.T, name));
    this.cur = this.blocks.get(name); return this.cur;
  }
  add(geo, mat, m) { this.cur.add(geo, mat, m); }
  bakeAll() { const out = {}; for (const [n, b] of this.blocks) out[n] = b.bake(this.root); return out; }

  /**
   * Solid strip from stations [{l:[x,y,z], r:[x,y,z], b: bottomY}] with metre UVs.
   * Returns {top, sides} geometries (top can take the deck material, sides the skirt).
   */
  stripGeo(st, {capStart = true, capEnd = true, detail = null} = {}) {
    const T = this.T, top = [], tuv = [], side = [], suv = [], capP = [], capU = [];
    let along = 0;
    const quad = (arr, uvs, a, b, c, d, ua, ub, uc, ud) => { arr.push(...a, ...b, ...c, ...a, ...c, ...d); uvs.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud); };
    for (let i = 1; i < st.length; i++) {
      const p = st[i - 1], q = st[i];
      const seg = Math.hypot((q.l[0] + q.r[0] - p.l[0] - p.r[0]) / 2, (q.l[2] + q.r[2] - p.l[2] - p.r[2]) / 2);
      const u0 = along, u1 = along + seg; along = u1;
      const wp = Math.hypot(p.r[0] - p.l[0], p.r[2] - p.l[2]), wq = Math.hypot(q.r[0] - q.l[0], q.r[2] - q.l[2]);
      // top (counter-clockwise seen from above: l->r->r'->l' needs orientation check below)
      quad(top, tuv, p.l, q.l, q.r, p.r, [0, u0], [0, u1], [wq, u1], [wp, u0]);
      const pl = [p.l[0], p.b ?? p.l[1] - .6, p.l[2]], ql = [q.l[0], q.b ?? q.l[1] - .6, q.l[2]];
      const pr = [p.r[0], p.b ?? p.r[1] - .6, p.r[2]], qr = [q.r[0], q.b ?? q.r[1] - .6, q.r[2]];
      quad(side, suv, p.l, pl, ql, q.l, [u0, p.l[1]], [u0, pl[1]], [u1, ql[1]], [u1, q.l[1]]);
      quad(side, suv, p.r, q.r, qr, pr, [u0, p.r[1]], [u1, q.r[1]], [u1, qr[1]], [u0, pr[1]]);
      quad(side, suv, pl, pr, qr, ql, [0, u0], [wp, u0], [wq, u1], [0, u1]);
    }
    const cap = (s, flip) => { const side = capP, suv = capU;
      const bl = [s.l[0], s.b ?? s.l[1] - .6, s.l[2]], br = [s.r[0], s.b ?? s.r[1] - .6, s.r[2]], w = Math.hypot(s.r[0] - s.l[0], s.r[2] - s.l[2]);
      if (flip) quad(side, suv, s.l, s.r, br, bl, [0, s.l[1]], [w, s.r[1]], [w, br[1]], [0, bl[1]]);
      else quad(side, suv, s.l, bl, br, s.r, [0, s.l[1]], [0, bl[1]], [w, br[1]], [w, s.r[1]]);
    };
    if (capStart) cap(st[0], true);
    if (capEnd) cap(st[st.length - 1], false);
    const mk = (pos, uv) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
    const topG = mk(top, tuv), sideG = mk(side, suv), capG = capP.length ? mk(capP, capU) : null;
    if (detail) this.plankDetail(st, detail);
    // Make sure the top faces up (orientation depends on l/r handedness).
    const n = topG.attributes.normal; let sum = 0; for (let i = 0; i < n.count; i++) sum += n.getY(i);
    if (sum < 0) { flipGeo(topG); flipGeo(sideG); if (capG) flipGeo(capG); }
    return {top: topG, sides: sideG, caps: capG};
  }

  /**
   * Plank variation laid over a strip deck: planks ~0.21 m across the walkway; about one in eight a
   * darker board, one in thirty a dark gap, and nail heads at both ends of every fourth board.
   */
  plankDetail(st, {seed = 1, pitch = .21} = {}) {
    const T = this.T; let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const dark = [], gap = [], nail = [];
    const push = (arr, a, b, c, d) => arr.push(...a, ...b, ...c, ...a, ...c, ...d);
    let along = 0, next = pitch * rnd();
    for (let i = 1; i < st.length; i++) {
      const p = st[i - 1], q = st[i], L = Math.hypot((q.l[0] + q.r[0] - p.l[0] - p.r[0]) / 2, (q.l[2] + q.r[2] - p.l[2] - p.r[2]) / 2);
      while (next < along + L) {
        const f = (next - along) / L, lerp = (A, Bq, t) => A.map((v, k) => v + (Bq[k] - v) * t);
        const l0 = lerp(p.l, q.l, f), r0 = lerp(p.r, q.r, f), f1 = Math.min(1, f + pitch * .92 / L), l1 = lerp(p.l, q.l, f1), r1 = lerp(p.r, q.r, f1);
        const up = (v, h) => [v[0], v[1] + h, v[2]], k = rnd();
        if (k < .12) push(dark, up(l0, .012), up(l1, .012), up(r1, .012), up(r0, .012));
        else if (k < .155) { const lm = lerp(l0, l1, .35), rm = lerp(r0, r1, .35); push(gap, up(l0, .013), up(lm, .013), up(rm, .013), up(r0, .013)); }
        if (Math.floor(next / pitch) % 4 === 0) for (const t of [.06, .94]) { const c = lerp(lerp(l0, l1, .5), lerp(r0, r1, .5), t), dx = (r0[0] - l0[0]) * .012, dz = (r0[2] - l0[2]) * .012; push(nail, [c[0] - dx - .025, c[1] + .015, c[2] - dz], [c[0] - dx + .025, c[1] + .015, c[2] - dz], [c[0] + dx + .025, c[1] + .015, c[2] + dz], [c[0] + dx - .025, c[1] + .015, c[2] + dz]); }
        next += pitch;
      }
      along += L;
    }
    const mk = (pos) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); const n = g.attributes.normal; let sy = 0; for (let i = 0; i < n.count; i++) sy += n.getY(i); if (sy < 0) flipGeo(g); return g; };
    if (dark.length) this.add(mk(dark), 'deckDark'); if (gap.length) this.add(mk(gap), 'barkShade'); if (nail.length) this.add(mk(nail), 'ink');
  }

  /** Flat (or planar-sloped) polygon deck. pts: [[x,z]...]. */
  deckPoly(id, pts, y, {th = .8, mat = 'stone', side = 'stoneShade', gx = 0, gz = 0, ox = 0, oz = 0, enabled, holes} = {}) {
    const T = this.T;
    this.gm.addSurface({id, type: 'poly', pts, y, gx, gz, ox, oz, enabled, holes, body: th});
    const shape = new T.Shape(pts.map(([x, z]) => new T.Vector2(x, -z)));
    if (holes) for (const h of holes) shape.holes.push(new T.Path(h.map(([x, z]) => new T.Vector2(x, -z))));
    const g = new T.ExtrudeGeometry(shape, {depth: th, bevelEnabled: false, curveSegments: 1});
    g.rotateX(-Math.PI / 2); // shape (x,-z) -> world (x, depth, z)
    g.translate(0, y - th, 0);
    if (gx || gz) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + gx * (p.getX(i) - ox) + gz * (p.getZ(i) - oz)); g.computeVertexNormals(); }
    // Split: top-facing triangles take the deck material; the rest the skirt.
    const [topG, sideG] = splitByNormal(T, g, .7);
    this.add(topG, mat); this.add(sideG, side);
    return {id};
  }

  /** Annular sector deck; height y0->y1 across a0->a1 (az degrees). */
  deckAnnulus(id, {cx = 0, cz = 0, r0, r1, a0, a1, y0, y1 = y0, ease, bottom, th = .7, mat = 'stone', side = 'stoneShade', capMat, enabled, dy, capStart = true, capEnd = true, step = 4}) {
    this.gm.addSurface({id, type: 'annulus', cx, cz, r0, r1, a0, a1, y0, y1, ease, enabled, dy, body: bottom !== undefined && typeof bottom !== 'function' ? Math.max(th, Math.max(y0, y1) - bottom) : th});
    const n = Math.max(2, Math.ceil((a1 - a0) / step)), st = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n, a = (a0 + (a1 - a0) * f) * Math.PI / 180, u = ease ? ease(f) : f, y = y0 + (y1 - y0) * u;
      st.push({l: [cx + r0 * Math.sin(a), y, cz + r0 * Math.cos(a)], r: [cx + r1 * Math.sin(a), y, cz + r1 * Math.cos(a)], b: bottom !== undefined ? (typeof bottom === 'function' ? bottom(f) : bottom) : y - th});
    }
    const {top, sides, caps} = this.stripGeo(st, {capStart, capEnd, detail: /deck/.test(mat) ? {seed: id.length * 7 + st.length} : null});
    this.add(top, mat); this.add(sides, side); if (caps) this.add(caps, capMat || side);
    return st;
  }

  /** Full disc deck. */
  deckDisc(id, {cx = 0, cz = 0, r, y, th = 1, mat = 'stone', side = 'stoneShade', seg = 40}) {
    const T = this.T;
    this.gm.addSurface({id, type: 'disc', cx, cz, r, y, body: th});
    const g = new T.CylinderGeometry(r, r * .96, th, seg, 1);
    g.translate(cx, y - th / 2, cz);
    const [a, b] = splitByNormal(T, g, .7); this.add(a, mat); this.add(b, side);
  }

  /**
   * Walkway ribbon along a smooth path through control points [[x,y,z]...].
   * Returns the sampled centreline used by both geometry and ground.
   */
  deckRibbon(id, ctrl, w, {mat = 'deck', side = 'timberDark', step = 1, th = .35, enabled, dy, log = null, sampled} = {}) {
    const T = this.T;
    let pts = sampled;
    if (!pts) {
      const curve = new T.CatmullRomCurve3(ctrl.map((p) => new T.Vector3(...p)), false, 'centripetal');
      const len = curve.getLength(), n = Math.max(2, Math.ceil(len / step));
      pts = curve.getSpacedPoints(n).map((v) => [v.x, v.y, v.z]);
      // Heights: linear by arc length between control points is what the curve gives; keep.
    }
    this.gm.addSurface({id, type: 'ribbon', pts, w, enabled, dy, body: th});
    const st = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[2] - a[2]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
      // Mitre: widen at bends so the drawn edge stays w/2 from both segments.
      let k = 1;
      if (i > 0 && i < pts.length - 1) {
        const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
        const d1 = norm2(p1[0] - p0[0], p1[2] - p0[2]), d2 = norm2(p2[0] - p1[0], p2[2] - p1[2]);
        const c = d1[0] * tx + d1[1] * tz; k = 1 / Math.max(.7, c);
        void d2;
      }
      const nx = -tz * w / 2 * k, nz = tx * w / 2 * k, y = pts[i][1];
      st.push({l: [pts[i][0] + nx, y, pts[i][2] + nz], r: [pts[i][0] - nx, y, pts[i][2] - nz], b: y - th});
    }
    const {top, sides, caps} = this.stripGeo(st, {detail: /deck/.test(mat) ? {seed: id.length * 13 + pts.length} : null});
    this.add(top, mat); this.add(sides, side); if (caps) this.add(caps, side);
    if (log) {
      // The great branch the boardwalk rides on: a tapered bark limb below the deck.
      const lp = pts.map((p, i) => [p[0], p[1] - th - log.r0 * (1 - i / pts.length * .4) * .8, p[2]]);
      const ext = log.extend || 0;
      if (ext) { const a = lp[0], b = lp[1], L = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1; lp.unshift([a[0] - (b[0] - a[0]) / L * ext, a[1] - .6, a[2] - (b[2] - a[2]) / L * ext]); }
      this.add(taperTube(T, lp, log.r0, log.r1, Math.max(8, lp.length), 9, .1, log.seed || 1), log.mat || 'bark');
    }
    return pts;
  }

  /**
   * Rail along base points [[x,y,z]...] (y = floor height under the rail).
   * style: 'timber' | 'stone' | 'copper'. Registers one collider per span.
   */
  rail(id, base, opts = {}) {
    if (opts.style === undefined || opts.style === 'timber') opts = {spacing: 2.3, ...opts};
    // Deferred: rails are built after every deck exists (flushRails), so a rail can drop the
    // stretches where walkable ground continues on both sides at its level (joins, spurs).
    if (!this.flushing) { this.pending ??= []; this.pending.push([id, base, opts, this.cur]); return; }
    const {kind = 'edge', collide = true, auto = true} = opts;
    if (collide && kind === 'edge' && auto) {
      const dense = [];
      for (let i = 1; i < base.length; i++) { const a = base[i - 1], b = base[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / .5)); for (let k = i === 1 ? 0 : 1; k <= n; k++) dense.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, a[2] + (b[2] - a[2]) * k / n]); }
      const open = dense.map((p, i) => {
        const q = dense[Math.min(dense.length - 1, i + 1)], o = dense[Math.max(0, i - 1)], tx = q[0] - o[0], tz = q[2] - o[2], L = Math.hypot(tx, tz) || 1;
        const nx = -tz / L * .45, nz = tx / L * .45, on = (x, z) => { const g = this.gm.ground(x, z, p[1] + .1); return g !== null && Math.abs(g - p[1]) < .4; };
        return on(p[0] + nx, p[2] + nz) && on(p[0] - nx, p[2] - nz);
      });
      let run = [];
      const flush = () => { if (run.length > 1) this._rail(id, run, opts); run = []; };
      dense.forEach((p, i) => { if (open[i]) flush(); else run.push(p); });
      flush();
      return;
    }
    this._rail(id, base, opts);
  }
  flushRails() { this.flushing = true; const prev = this.cur; for (const [id, base, opts, bin] of this.pending || []) { this.cur = bin; this.rail(id, base, opts); } this.pending = []; this.cur = prev; }
  _rail(id, base, {style = 'timber', kind = 'edge', enabled, dy, spacing = 1.7, visual = true, collide = true} = {}) {
    const T = this.T, H = .9;
    if (collide) this.rails.push({id, pts: base, style, kind, enabled});
    for (let i = 1; collide && i < base.length; i++) {
      const a = base[i - 1], b = base[i];
      this.gm.addSegment({id, ax: a[0], az: a[2], bx: b[0], bz: b[2], ya: a[1], yb: b[1], h: H + .05, t: style === 'stone' || style === 'parapet' ? .16 : .08, enabled, dy});
    }
    if (!visual) return;
    // Walk the polyline placing posts at even spacing.
    const posts = [], tops = [];
    let carry = 0;
    posts.push(base[0]);
    for (let i = 1; i < base.length; i++) {
      const a = base[i - 1], b = base[i], L = Math.hypot(b[0] - a[0], b[2] - a[2]);
      let s = spacing - carry;
      while (s < L - .05) { const f = s / L; posts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]); s += spacing; }
      carry = L - (s - spacing);
      posts.push(b);
    }
    // de-duplicate close posts
    const P = posts.filter((p, i) => i === 0 || Math.hypot(p[0] - posts[i - 1][0], p[2] - posts[i - 1][2]) > .25);
    if (style === 'rope') {
      // rope-and-post: stout posts every ~2.8 m, two sagging ropes; reads light against the sky
      const P2 = [base[0]]; let acc = 0;
      for (let i = 1; i < base.length; i++) { acc += Math.hypot(base[i][0] - base[i - 1][0], base[i][2] - base[i - 1][2]); if (acc >= 2.8 || i === base.length - 1) { P2.push(base[i]); acc = 0; } }
      for (const p of P2) { this.add(new T.CylinderGeometry(.07, .09, H + .08, 6).translate(p[0], p[1] + (H + .08) / 2, p[2]), 'timberDark'); this.add(new T.CylinderGeometry(.1, .1, .05, 6).translate(p[0], p[1] + H + .08, p[2]), 'timberDark'); }
      for (let i = 1; i < P2.length; i++) for (const [hh, sag] of [[H - .02, .1], [.5, .06]]) {
        const a = P2[i - 1], b = P2[i], pts = []; for (let k = 0; k <= 6; k++) { const f = k / 6; pts.push(new T.Vector3(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f + hh - sag * 4 * f * (1 - f), a[2] + (b[2] - a[2]) * f)); }
        this.add(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 8, .028, 4), 'timberDark');
      }
      return;
    }
    if (style === 'parapet') {
      // calm solid stone parapet with a coping: one big form instead of many thin posts
      for (let i = 1; i < base.length; i++) {
        const a = base[i - 1], b = base[i], L = Math.hypot(b[0] - a[0], b[2] - a[2]); if (L < .02) continue;
        const ext = .06, dx = (b[0] - a[0]) / L, dz = (b[2] - a[2]) / L;
        const A = [a[0] - dx * ext, a[1], a[2] - dz * ext], Bp = [b[0] + dx * ext, b[1], b[2] + dz * ext];
        this.add(beam(T, [A[0], A[1] + .4, A[2]], [Bp[0], Bp[1] + .4, Bp[2]], .3, .8), 'stoneShade');
        this.add(beam(T, [A[0], A[1] + .86, A[2]], [Bp[0], Bp[1] + .86, Bp[2]], .44, .12), 'stone');
      }
      return;
    }
    if (style === 'stone') {
      for (const p of P) this.add(new T.BoxGeometry(.34, H - .12, .34).translate(p[0], p[1] + (H - .12) / 2, p[2]), 'stone');
      for (let i = 1; i < P.length; i++) {
        const a = P[i - 1], b = P[i];
        this.add(beam(T, [a[0], a[1] + H - .06, a[2]], [b[0], b[1] + H - .06, b[2]], .3, .14), 'stone');
        this.add(beam(T, [a[0], a[1] + .1, a[2]], [b[0], b[1] + .1, b[2]], .22, .2), 'stoneShade');
        // balusters: bell-curved stubby columns
        const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.floor(L / .42));
        for (let k = 1; k < n; k++) { const f = k / n, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f; this.add(baluster(T).translate(x, y + .2, z), 'stone'); }
      }
    } else {
      const postMat = style === 'copper' ? 'verdigris' : 'timberDark', railMat = style === 'copper' ? 'copper' : 'timber';
      for (const p of P) { this.add(new T.BoxGeometry(.13, H, .13).translate(p[0], p[1] + H / 2, p[2]), postMat); this.add(new T.BoxGeometry(.17, .06, .17).translate(p[0], p[1] + H + .02, p[2]), style === 'copper' ? 'copper' : 'timberDark'); }
      for (let i = 1; i < P.length; i++) {
        const a = P[i - 1], b = P[i];
        this.add(beam(T, [a[0], a[1] + H - .04, a[2]], [b[0], b[1] + H - .04, b[2]], .1, .09), railMat);
        this.add(beam(T, [a[0], a[1] + .45, a[2]], [b[0], b[1] + .45, b[2]], .06, .06), railMat);
      }
    }
  }

  /** Rail following an arc at radius r (y from yfn(f)). */
  railArc(id, {cx = 0, cz = 0, r, a0, a1, y, yfn, style = 'timber', enabled, dy, step = 6, collide = true}) {
    const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / step)), pts = [];
    for (let i = 0; i <= n; i++) { const f = i / n, a = (a0 + (a1 - a0) * f) * Math.PI / 180; pts.push([cx + r * Math.sin(a), yfn ? yfn(f) : y, cz + r * Math.cos(a)]); }
    this.rail(id, pts, {style, enabled, dy, collide});
    return pts;
  }

  /** Rails on both sides of a sampled ribbon, skipping arc-length windows [[s0,s1],...]. */
  railRibbon(id, pts, w, {style = 'timber', skipLeft = [], skipRight = [], inset = .12, enabled, dy, trimStart = 0, trimEnd = 0} = {}) {
    let s = 0; const L = [], R = [], cum = [0];
    for (let i = 1; i < pts.length; i++) { s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]); cum.push(s); }
    if (trimStart) { skipLeft = [...skipLeft, [-1, trimStart]]; skipRight = [...skipRight, [-1, trimStart]]; }
    if (trimEnd) { skipLeft = [...skipLeft, [s - trimEnd, s + 1]]; skipRight = [...skipRight, [s - trimEnd, s + 1]]; }
    const off = (i, side) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[2] - a[2]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const h = (w / 2 - inset) * side; return [pts[i][0] - tz * h, pts[i][1], pts[i][2] + tx * h];
    };
    const runs = (skip, side, tag) => {
      let run = [];
      const flush = () => { if (run.length > 1) this.rail(`${id}-${tag}${this.rails.length}`, run, {style, enabled, dy}); run = []; };
      for (let i = 0; i < pts.length; i++) {
        const skipped = skip.some(([a, b]) => cum[i] > a && cum[i] < b);
        if (skipped) { flush(); continue; }
        run.push(off(i, side));
      }
      flush();
    };
    runs(skipLeft, -1, 'L'); runs(skipRight, 1, 'R');
    return cum;
  }

  /** Post / column collider + visual cylinder. */
  column(id, x, y0, z, h, r, mat = 'timberDark', seg = 8) {
    this.gm.addCircle({id, x, z, r, y0, y1: y0 + h});
    this.add(new this.T.CylinderGeometry(r, r * 1.05, h, seg).translate(x, y0 + h / 2, z), mat);
  }
}

/** Which railRibbon side (-1 'L' / +1 'R') faces point q at arc length index i. */
export function ribbonSide(pts, i, q) {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
  const tx = b[0] - a[0], tz = b[2] - a[2];
  // offset for side +1 is (-tz, tx)
  return ((q[0] - pts[i][0]) * -tz + (q[2] - pts[i][2]) * tx) > 0 ? 1 : -1;
}

function norm2(x, z) { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; }

function flipGeo(g) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i += 3) {
    for (const attr of [p, uv]) { if (!attr) continue; const n = attr.itemSize; for (let k = 0; k < n; k++) { const t = attr.array[(i + 1) * n + k]; attr.array[(i + 1) * n + k] = attr.array[(i + 2) * n + k]; attr.array[(i + 2) * n + k] = t; } }
  }
  g.computeVertexNormals();
}

/** Split a geometry into (up-facing, other) by face normal y. */
export function splitByNormal(T, geo, thresh = .7) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const p = g.attributes.position.array, uv = g.attributes.uv?.array;
  const A = [[], []], U = [[], []], v = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  for (let i = 0; i < p.length; i += 9) {
    a.set(p[i], p[i + 1], p[i + 2]); b.set(p[i + 3], p[i + 4], p[i + 5]); c.set(p[i + 6], p[i + 7], p[i + 8]);
    v.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const k = v.y > thresh ? 0 : 1;
    for (let j = 0; j < 9; j++) A[k].push(p[i + j]);
    const t = i / 3 * 2; for (let j = 0; j < 6; j++) U[k].push(uv ? uv[t + j] : 0);
  }
  return A.map((pos, k) => { const o = new T.BufferGeometry(); o.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); o.setAttribute('uv', new T.Float32BufferAttribute(U[k], 2)); o.computeVertexNormals(); return o; });
}

/** Box beam between two points with cross-section w x h (rotated to follow the slope). */
export function beam(T, a, b, w, h) {
  const A = new T.Vector3(...a), B = new T.Vector3(...b), L = A.distanceTo(B);
  const g = new T.BoxGeometry(w, h, L);
  const m = new T.Matrix4().lookAt(B, A, new T.Vector3(0, 1, 0));
  g.applyMatrix4(m); g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}

let _bal = null;
function baluster(T) {
  if (!_bal) {
    const pts = [[0, 0], [.1, 0], [.1, .06], [.06, .12], [.1, .3], [.06, .48], [.08, .52], [.1, .56], [0, .56]].map(([x, y]) => new T.Vector2(x, y));
    _bal = new T.LatheGeometry(pts, 6);
  }
  return _bal.clone();
}

export {rod};
