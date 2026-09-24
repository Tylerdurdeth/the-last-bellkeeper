// Walk-path probe: shortest walkable path (0.25 m grid, 0.45 m step-up, hero r 0.23) between
// two world points, in the "all open" state. Prints length and a coarse polyline.
//   node tools/walk-path-probe.mjs <fromPath> <toPath>   e.g. points.sails.bridgeTo adapted.points.sailsGust
import * as T from 'three';
import {buildBellhollow} from '../game/bellhollow/world.js';
import {adaptWorld} from '../game/bellhollow/adapt-world.js';
const w = buildBellhollow({THREE: T, scene: new T.Scene()});
w.update(1 / 60, 0, {terraceGate: 1, sailBridge: 1, ladderShutter: 1, skyPlanks: 3, hollowGate: 1, sailsCap: 1, pipesValve: 1, frag2: 1});
const A = adaptWorld(w, {THREE: T}); const get = (p) => p.split('.').reduce((o, k) => o?.[k], {points: w.points, adapted: A});
const a = get(process.argv[2]), b = get(process.argv[3]), goalR = +(process.argv[4] || .6), h = .25;
const key = (x, z, y) => `${Math.round(x / h)},${Math.round(z / h)},${Math.round(y * 4)}`;
const start = {x: a.x, z: a.z, y: w.ground(a.x, a.z, a.y + .3) ?? a.y, d: 0, prev: null};
const seen = new Map([[key(start.x, start.z, start.y), start]]); let q = [start], best = null;
while (q.length && !best) {
  q.sort((m, n) => m.d - n.d); const c = q.shift();
  if (Math.hypot(c.x - b.x, c.z - b.z) < goalR && Math.abs(c.y - b.y) < .5) { best = c; break; }
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = c.x + dx * h, z = c.z + dz * h, g = w.ground(x, z, c.y + .45); if (g == null || g < c.y - .45) continue;
    if (w.blocked(x, z, .23, g)) continue; const k = key(x, z, g); const d = c.d + Math.hypot(dx, dz) * h;
    if (seen.has(k) && seen.get(k).d <= d) continue; const n = {x, z, y: g, d, prev: c}; seen.set(k, n); q.push(n);
    if (seen.size > 400000) break;
  }
}
if (!best) { console.log('no path'); process.exit(); }
const pts = []; for (let n = best; n; n = n.prev) pts.push([+n.x.toFixed(1), +n.y.toFixed(1), +n.z.toFixed(1)]); pts.reverse();
console.log('straight', Math.hypot(a.x - b.x, a.z - b.z).toFixed(2), 'walk', best.d.toFixed(2)); console.log(JSON.stringify(pts.filter((_, i) => i % 6 === 0 || i === pts.length - 1)));
