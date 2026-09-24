// A* over a world's layered walkable ground (world.ground/blocked), for known-route drivers and
// world QA. Nodes are 0.5 m cells at a surface height; edges are walks (step <= 0.28), drops
// (walk off onto a lower floor, one-way) and short running jumps across void. Cells hugging a
// void edge are avoided so 8-way keyboard steering stays safe.
export function createPlanner(world, { cell = .5, margin = .4, maxJump = 3.6, maxDrop = 5.5 } = {}) {
  const G = (x, z, y) => { const g = world.ground(x, z, y); return typeof g === 'number' && Number.isFinite(g) ? g : null; };
  const solid = (x, z, y) => world.blocked(x, z, .3, y);
  const key = (ix, iz, y) => ix + ',' + iz + ',' + Math.round(y * 10);
  // Standable: floor here, not blocked, floor also under the margin ring at about this height.
  const standCache = new Map();
  function stand(ix, iz, y) {
    const k = key(ix, iz, y); if (standCache.has(k)) return standCache.get(k);
    const x = ix * cell, z = iz * cell; let ok = !solid(x, z, y);
    if (ok) for (const [a, b] of [[margin, 0], [-margin, 0], [0, margin], [0, -margin]]) { const h = G(x + a, z + b, y + .3); if (h === null || Math.abs(h - y) > .3) { ok = false; break; } }
    standCache.set(k, ok); return ok;
  }
  // Paths keep clear of rails and walls where they can (8-way keyboard steering drifts).
  const wallCache = new Map();
  function nearWall(ix, iz, y) { const k = key(ix, iz, y); if (!wallCache.has(k)) wallCache.set(k, world.blocked(ix * cell, iz * cell, .75, y)); return wallCache.get(k); }
  // The hero's body swept along a straight segment at height y (rails between cells count).
  const clearLine = (ax, az, bx, bz, y, r = .26) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / .2)); for (let i = 1; i <= n; i++) if (world.blocked(ax + (bx - ax) * i / n, az + (bz - az) * i / n, r, y)) return false; return true; };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function neighbours(n) {
    const out = [];
    for (const [dx, dz] of DIRS) {
      const step = Math.hypot(dx, dz) * cell;
      // Walk to the adjacent cell when it is standable at about this height.
      const ix = n.ix + dx, iz = n.iz + dz, x = ix * cell, z = iz * cell, g = G(x, z, n.y + .42);
      if (g !== null && Math.abs(g - n.y) <= .4 && stand(ix, iz, g) && clearLine(n.ix * cell, n.iz * cell, x, z, Math.max(n.y, g))) { out.push({ ix, iz, y: g, cost: step * (nearWall(ix, iz, g) ? 3 : 1), kind: 'walk' }); continue; }
      // Otherwise look a little further along this direction: a drop to a lower floor (walk off an
      // edge) or, across void, a running jump to a floor at about the same height.
      if (!stand(n.ix - dx, n.iz - dz, n.y)) continue; // needs a run-up cell behind
      for (let k = 1; k * step <= Math.max(maxJump, 1.6); k++) {
        const jx = n.ix + dx * k, jz = n.iz + dz * k, px = jx * cell, pz = jz * cell;
        if (solid(px, pz, n.y)) break;
        const h = G(px, pz, n.y + .3);
        if (h !== null && h > n.y + .3) break;
        if (h !== null && Math.abs(h - n.y) <= .3) { if (k > 1 && stand(jx, jz, h) && stand(jx + dx, jz + dz, h) && clearLine(n.ix * cell, n.iz * cell, px, pz, n.y + .4)) { out.push({ ix: jx, iz: jz, y: h, cost: k * step + 3, kind: 'jump' }); break; } if (stand(jx, jz, h)) break; continue; } // lip cells keep scanning
        if (h !== null && h < n.y - .3 && h >= n.y - maxDrop && stand(jx, jz, h) && k <= 3 && clearLine(n.ix * cell, n.iz * cell, px, pz, n.y, .55) && clearLine(n.ix * cell, n.iz * cell, px, pz, n.y + .8, .55)) { out.push({ ix: jx, iz: jz, y: h, cost: k * step + (n.y - h) * .8 + 2, kind: 'drop' }); break; }
      }
    }
    return out;
  }
  function snap(p) {
    let best = null;
    for (let r = 0; r <= 3 && !best; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      const ix = Math.round(p.x / cell) + a, iz = Math.round(p.z / cell) + b, g = G(ix * cell, iz * cell, p.y + .4);
      if (g === null || Math.abs(g - p.y) > .6 || !stand(ix, iz, g)) continue;
      const d = Math.hypot(ix * cell - p.x, iz * cell - p.z); if (!best || d < best.d) best = { ix, iz, y: g, d };
    }
    return best;
  }
  function plan(from, to, { maxNodes = 120000 } = {}) {
    const s = snap(from), t = snap(to);
    if (!s || !t) return { ok: false, reason: !s ? 'start not standable' : 'goal not standable', from, to };
    const h = n => Math.hypot(n.ix - t.ix, n.iz - t.iz) * cell + Math.abs(n.y - t.y) * .5;
    const open = [{ ...s, g: 0, f: h(s) }], came = new Map(), gBest = new Map([[key(s.ix, s.iz, s.y), 0]]);
    let expanded = 0;
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const n = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (n.ix === t.ix && n.iz === t.iz && Math.abs(n.y - t.y) < .35) {
        const path = []; let k = key(n.ix, n.iz, n.y), cur = { ...n, kind: 'end' };
        while (cur) { path.push({ x: cur.ix * cell, y: cur.y, z: cur.iz * cell, kind: cur.kind }); const c = came.get(k); if (!c) break; k = key(c.ix, c.iz, c.y); cur = c; }
        return { ok: true, path: path.reverse(), expanded };
      }
      if (++expanded > maxNodes) return { ok: false, reason: 'search limit', expanded, from, to };
      for (const m of neighbours(n)) {
        const k = key(m.ix, m.iz, m.y), g = n.g + m.cost;
        if (g >= (gBest.get(k) ?? Infinity)) continue;
        gBest.set(k, g); came.set(k, { ix: n.ix, iz: n.iz, y: n.y, kind: m.kind });
        open.push({ ix: m.ix, iz: m.iz, y: m.y, g, f: g + h(m) });
      }
    }
    return { ok: false, reason: 'unreachable', expanded, from, to };
  }
  // Waypoints for a driver: collapse only runs that are straight in 3D (same step direction and
  // slope); keep every turn, height change, drop and both ends of a jump.
  function waypoints(path, maxRun = 8) {
    const out = [path[0]]; let run = 0;
    for (let i = 1; i < path.length; i++) {
      const p = path[i], prev = path[i - 1], next = path[i + 1];
      const same = next && p.kind === 'walk' && prev.kind === 'walk' && Math.sign(next.x - p.x) === Math.sign(p.x - prev.x) && Math.sign(next.z - p.z) === Math.sign(p.z - prev.z)
        && Math.abs((next.x - p.x) - (p.x - prev.x)) < 1e-6 && Math.abs((next.z - p.z) - (p.z - prev.z)) < 1e-6 && Math.abs((next.y - p.y) - (p.y - prev.y)) < .05;
      if (same && ++run < maxRun) continue;
      run = 0; out.push(p);
    }
    return out;
  }
  return { plan, waypoints, snap };
}
