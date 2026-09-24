// The real Bellhollow world (game/bellhollow/world.js) through adapt-world.js satisfies what the
// quest, wind and movement need: every anchor is standable, every updraft column physically lands
// the hero on its ledge, and push/restoration state really opens the world's bridges and gates.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBellhollow } from '../game/bellhollow/world.js';
import { adaptWorld } from '../game/bellhollow/adapt-world.js';
import { validateWorld } from '../game/bellhollow/quest.js';
import { createMovement } from '../game/movement.js';

const raw = await buildBellhollow({ THREE, scene: new THREE.Scene() });
const w = adaptWorld(raw, { THREE });
assert.deepEqual(validateWorld(w), []);
console.log(w.adapted ? 'adapter engaged; notes: ' + JSON.stringify(w.adaptNotes) : 'world satisfies the contract natively (adapter pass-through)');
const P = w.points, fails = [];
const standable = (name, p, tol = .08) => { const g = w.ground(p.x, p.z, p.y + .3); if (g === null || Math.abs(g - p.y) > tol) fails.push(`${name} not on floor: y=${p.y.toFixed(2)} ground=${g}`); if (w.blocked(p.x, p.z, .23, p.y)) fails.push(`${name} blocked`); };
for (const k of ['start', 'mara', 'morningBell', 'maraOutlet', 'seedOutlet', 'loft', 'loftGust', 'sailsSource', 'pipesSource', 'laddersGust1', 'laddersGust2', 'laddersGust3', 'millLadders', 'hollowGate', 'carvingOut', 'carvingReturn', 'ring1', 'ring2', 'ring3', 'bellOut', 'finaleSpot', 'fragment1', 'fragment2', 'fragment3']) if (P[k]) standable(k, P[k]); else if (!/Source/.test(k)) fails.push('missing ' + k);
for (const wh of w.wheels) if (wh.outlet) standable('outlet of ' + wh.id, wh.outlet);
// Physically ride each column (no input needed while rising), then steer out to the ledge.
for (const v of w.vents) {
  const m = createMovement(THREE, { inputTarget: new EventTarget(), start: [v.x, v.y, v.z], sampleGround: w.ground, blocked: w.blocked, maxDrop: 14 });
  m.lift({ x: v.x, z: v.z, radius: v.radius + .25, top: v.top, base: v.y, duration: 4 });
  for (let i = 0; i < 100; i++) m.update(1 / 60);
  const peak = m.position.y;
  let landed = false;
  for (let i = 0; i < 200 && !landed; i++) { const dx = v.ledge.x - m.position.x, dz = v.ledge.z - m.position.z, d = Math.hypot(dx, dz) || 1; m.velocity.x = dx / d * 3; m.velocity.z = dz / d * 3; m.update(1 / 60); landed = m.grounded && Math.abs(m.position.y - v.ledge.y) < .05 && d < 1.2; }
  for (let i = 0; i < 60 && !landed; i++) { m.update(1 / 60); landed = m.grounded && Math.abs(m.position.y - v.ledge.y) < .05; }
  console.log(`column ${v.id}: base ${v.y} top ${v.top} peak ${peak.toFixed(2)} -> ${landed ? 'landed on ledge ' + v.ledge.y : 'MISSED (y ' + m.position.y.toFixed(2) + ')'}`);
  if (!landed) fails.push('column ' + v.id + ' does not land on its ledge');
  m.dispose();
}
// State through the adapter opens the world.
const probe = (label, p, expect) => { const g = w.ground(p.x, p.z, p.y + .3); const ok = expect ? g !== null && Math.abs(g - p.y) < .4 : g === null || g < p.y - 1; if (!ok) fails.push(`${label}: ground ${g} at y ${p.y}`); };
const mid = (a, b) => ({ x: (a[0] ?? a.x) / 2 + (b[0] ?? b.x) / 2, z: (a[2] ?? a.z) / 2 + (b[2] ?? b.z) / 2, y: (a[1] ?? a.y) });
const sb = raw.bridges.find(b => b.id === 'sailBridge'), pb = raw.bridges.find(b => b.id === 'pipesBridge');
const tick = st => { for (let i = 0; i < 240; i++) w.update(1 / 60, i / 60, st); };
const toArr = v => v.isVector3 ? [v.x, v.y, v.z] : Array.isArray(v) ? v : [v.x, v.y, v.z];
tick({ wind: { push: {} }, restored: {} });
if (sb?.from) probe('sail bridge before push', mid(toArr(sb.from), toArr(sb.to)), false);
if (pb?.from) probe('pipes drawbridge before', mid(toArr(pb.from), toArr(pb.to)), false);
tick({ wind: { push: { sailsBridge: 1, pipesBridge: 1, terraceGate: 1 } }, restored: { skyBridge: 1 } });
if (sb?.from) probe('sail bridge after push', mid(toArr(sb.from), toArr(sb.to)), true);
if (pb?.from) probe('pipes drawbridge after', mid(toArr(pb.from), toArr(pb.to)), true);
for (const st of raw.points.skyBridge?.stages || []) probe('sky bridge stage ' + st.k, { x: st.mid.x, y: st.mid.y, z: st.mid.z }, true);
const blockedGate = [0, .5, 1].some(f => w.blocked(P.terraceGate.x, P.terraceGate.z, .23, 0));
if (blockedGate) fails.push('terrace gate still blocks when open');
console.log(fails.length ? 'FAIL:\n - ' + fails.join('\n - ') : 'PASS: real world contract (anchors standable, all columns land, bridges/gate/planks open by state)');
if (fails.length) process.exit(1);
