// Bellhollow v2 world contract test (Node, no browser).
//   node tools/test-bellhollow-world.mjs [out.json]
// Checks: build time; every named stand point is on ground and unobstructed; continuous
// walkable routes between consecutive beat anchors (sampled every 5 cm, step <= .28,
// rails/solids respected), with rises only at vents and falls only at declared drops;
// every rail bounds a drop (ground on one side at its base, none/lower on the other);
// layered ground at every overlap; dynamic pieces gate their routes.
import assert from 'node:assert/strict';
import * as T from 'three';
import {writeFile} from 'node:fs/promises';
import {buildBellhollow} from '../game/bellhollow/world.js';
import {validateWorld} from '../game/bellhollow/quest.js';

const t0 = performance.now();
const w = buildBellhollow({THREE: T, scene: new T.Scene()});
const buildMs = performance.now() - t0;
const fails = [], log = (m) => fails.push(m);
const check = (cond, msg) => { if (!cond) log(msg); return cond; };
const P = w.points, R = P.guardianWell.rings;
const setAll = (o) => w.update(1 / 60, 0, o);
const OPEN = {terraceGate: 1, sailBridge: 1, ladderShutter: 1, skyPlanks: 3, hollowGate: 1, frag2: 1, sailsCap: 1, pipesValve: 1};
const CLOSED = {terraceGate: 0, sailBridge: 0, ladderShutter: 0, skyPlanks: 0, hollowGate: 0, frag2: 0, sailsCap: 0, pipesValve: 0};

check(buildMs < 2500, `build ${buildMs.toFixed(0)} ms >= 2500`);

// ---------------------------------------------------------------- stand points
const stand = {
  start: P.start, morningBell: P.morningBell, maraLever: P.maraLever, maraOutlet: P.maraOutlet, maraStand: P.maraStand,
  seedWheel: P.seedWheel, terraceGateInside: P.terraceGateInside, loftVent: P.loftVent, loftLedge: P.loftLedge, loftView: P.loftView,
  'sails.branchStart': P.sails.branchStart, 'sails.source': P.sails.source, 'sails.bridgePush': P.sails.bridgePush,
  'sails.bridgeFrom': P.sails.bridgeFrom, 'sails.bridgeTo': P.sails.bridgeTo, 'sails.restore': P.sails.restore,
  'pipes.branchStart': P.pipes.branchStart, 'pipes.source': P.pipes.source, 'pipes.wheelA': P.pipes.wheelA, 'pipes.gapFrom': P.pipes.gapFrom,
  'pipes.gapTo': P.pipes.gapTo, 'pipes.outletA': P.pipes.outletA, 'pipes.wheelB': P.pipes.wheelB, 'pipes.outletB': P.pipes.outletB, 'pipes.restore': P.pipes.restore,
  ...Object.fromEntries(P.ladders.gusts.map((g, i) => ['ladders.gust' + i, g])), seedOutlet: P.seedOutlet, finaleSpot: P.finaleSpot, bellOut: P.bellOut, bellReturn: P.bellReturn,
  'ladders.vent0': P.ladders.vent0, 'ladders.ledge0': P.ladders.ledge0,
  'ladders.vent1': P.ladders.vent1, 'ladders.ledge1': P.ladders.ledge1, 'ladders.shutterLever': P.ladders.shutterLever,
  'ladders.vent2': P.ladders.vent2, 'ladders.ledge2': P.ladders.ledge2, 'ladders.restore': P.ladders.restore,
  fragment1: P.fragment1, fragment2: P.fragment2, fragment3: P.fragment3,
  'bridge.start': P.bridge.start, 'bridge.end': P.bridge.end,
  ...Object.fromEntries(P.bridge.stages.map((s) => ['bridge.stage' + s.k, s.mid])),
  hollowGate: P.hollowGate, hollowGateInside: P.hollowGateInside, 'gallery.top': P.gallery.top, 'gallery.bottom': P.gallery.bottom,
  ...Object.fromEntries(P.gallery.carvings.map((c) => ['gallery.' + c.id, c.stand])),
  ...Object.fromEntries(['low', 'mid', 'high'].flatMap((k) => [[`well.${k}.safe`, R[k].safe], [`well.${k}.vaneStand`, R[k].vaneStand], [`well.${k}.catch`, R[k].catchPoint]])),
  'well.low.vent': new T.Vector3(R.low.vent.x, R.low.vent.y, R.low.vent.z), 'well.mid.vent': new T.Vector3(R.mid.vent.x, R.mid.vent.y, R.mid.vent.z),
  'pairedBells.stand': P.pairedBells.stand, 'terraceView.maraStand': P.terraceView.maraStand,
  'sails.capSail': P.sails.capSail, 'sails.frag2From': P.sails.frag2From, 'pipes.valve': P.pipes.valve, 'pipes.frag3From': P.pipes.frag3From, 'pipes.frag3To': P.pipes.frag3To,
  'gallery.source': P.gallery.source, 'well.top': P.guardianWell.rings.top, 'well.top.safe': R.top.safe, 'well.top.vaneStand': R.top.vaneStand,
};
setAll(OPEN);
let pointChecks = 0;
for (const [k, p] of Object.entries(stand)) {
  assert(p && p.isVector3, 'missing point ' + k);
  const g = w.ground(p.x, p.z, p.y);
  check(g !== null && Math.abs(g - p.y) < .05, `point ${k} not on ground: y=${p.y.toFixed(2)} ground=${g}`);
  check(!w.blocked(p.x, p.z, .23, p.y), `point ${k} blocked by ${w.blocker(p.x, p.z, .23, p.y)}`);
  pointChecks++;
}
// Objects/anchors that must exist (not stood on).
for (const k of ['morningBellObject', 'maraLeverObject', 'maraOutletMouth', 'seedWheelObject', 'farBell']) check(P[k]?.isVector3, 'missing anchor ' + k);
for (const k of ['bridgeSail', 'resetLever', 'mill']) check(P.sails[k]?.isVector3, 'missing millSails.' + k);
for (const k of ['wheelAObject', 'wheelBObject', 'mill']) check(P.pipes[k]?.isVector3, 'missing pipes.' + k);
for (const k of ['shutter', 'mill']) check(P.ladders[k]?.isVector3, 'missing millLadders.' + k);
check(P.terraceView.pos.isVector3 && P.terraceView.target.isVector3, 'terraceView camera');
check(P.farBell.distanceTo(P.start) > 80, 'far bell is distant');
check(w.vents.length >= 8, 'vents');
// M3 records
for (const id of ['frag1', 'ring3']) check(w.vents.some((v) => v.id === id), 'vent ' + id);
check(w.sails.some((v) => v.id === 'frag2' && v.kind === 'bridge'), 'sail frag2');
for (const k of ['capTarget', 'capSail']) check(P.sails[k]?.isVector3, 'sails.' + k);
for (const k of ['valve', 'valveObject', 'outletWrong']) check(P.pipes[k]?.isVector3, 'pipes.' + k);
for (const c of P.gallery.carvings) check(c.intake?.isVector3 && c.intake.distanceTo(c.panel) < 1.8, c.id + ' intake');
check(P.gallery.source?.isVector3 && P.gallery.source.distanceTo(P.gallery.carvings[0].stand) < 20, 'gallery source near the carvings');
check(P.sails.capTarget.y - P.sails.capSail.y > 3, 'cap tail sail above the stand (clear of the hero)');
for (const m of validateWorld(w)) log('quest contract: missing ' + m);
for (const k of ['low', 'mid', 'high', 'top']) { const r = P.guardianWell.rings[k]; check(r.vane && r.vaneStand && r.safe && Math.hypot(r.vane.x - r.vaneStand.x, r.vane.z - r.vaneStand.z) <= 1.6 && Math.abs(r.vane.y - r.vaneStand.y) < .1, `ring ${k}: vane, vaneStand (within 1.6 m, same level) and safe required`); }
for (const v of w.vents) check(v.ledge && Math.abs(v.top - v.ledge.y - .8) < .01, `vent ${v.id}: top must be ledge + 0.8`);

// ---------------------------------------------------------------- routes
// Route legs: ['walk', a, b, ...waypoints] | ['vent', ventId, dest] | ['drop', a, b]
const V = (p) => (p.isVector3 ? p : new T.Vector3(p[0], p[1], p[2]));
let routeSamples = 0;
function walk(label, pts) {
  let y = pts[0].y, prev = null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .05));
    for (let j = 1; j <= n; j++) {
      const x = a.x + (b.x - a.x) * j / n, z = a.z + (b.z - a.z) * j / n, g = w.ground(x, z, y);
      routeSamples++;
      if (!check(g !== null, `${label}: void at ${x.toFixed(2)},${z.toFixed(2)} (y ${y.toFixed(2)})`)) return false;
      if (!check(Math.abs(g - y) < .28, `${label}: step ${(g - y).toFixed(2)} at ${x.toFixed(2)},${z.toFixed(2)} (y ${y.toFixed(2)})`)) return false;
      y = g;
      if (!check(!w.blocked(x, z, .23, y), `${label}: blocked by ${w.blocker(x, z, .23, y)} at ${x.toFixed(2)},${z.toFixed(2)},${y.toFixed(2)}`)) return false;
      prev = [x, z];
    }
    if (!check(Math.abs(y - b.y) < .08, `${label}: waypoint ${i} height ${y.toFixed(2)} vs ${b.y.toFixed(2)}`)) return false;
  }
  void prev; return true;
}
function vent(label, id, dest) {
  const v = w.vents.find((vv) => vv.id === id);
  if (!check(v, `${label}: no vent ${id}`)) return false;
  check(v.top >= dest.y + .2 && v.top - v.y >= 3.5 && v.top - v.y <= 6.5, `${label}: vent ${id} lift ${(v.top - v.y).toFixed(2)} to ${dest.y}`);
  // steer from the column top to the destination ledge: the first sample over ground at the
  // ledge height must be within 2.6 m of the vent centre, and the rest of the way walkable.
  const n = 200; let reach = null;
  for (let j = 0; j <= n; j++) {
    const x = v.x + (dest.x - v.x) * j / n, z = v.z + (dest.z - v.z) * j / n, g = w.ground(x, z, v.top);
    if (w.blocked(x, z, .23, v.top)) { log(`${label}: column path blocked by ${w.blocker(x, z, .23, v.top)} at ${x.toFixed(2)},${z.toFixed(2)}`); return false; }
    if (g !== null && Math.abs(g - dest.y) < .1) { reach = Math.hypot(x - v.x, z - v.z); break; }
  }
  check(reach !== null && reach <= 2.6, `${label}: ledge not reachable from vent ${id} column (reach ${reach})`);
  // and the vent itself must be the only way: without the vent, the ledge is > 2.5 m above
  check(dest.y - v.y > 2.5, `${label}: ledge is not an updraft gap`);
  return true;
}
function jumpGap(label, a, b) {
  // an intended running-jump gap: void (no surface at this level) for 1.5..2.1 m along the line,
  // same height both sides, and no rail/solid across it (the lip is open and marked).
  const n = Math.ceil(a.distanceTo(b) / .05); let voidLen = 0, y = a.y;
  for (let j = 1; j <= n; j++) { const x = a.x + (b.x - a.x) * j / n, z = a.z + (b.z - a.z) * j / n; if (w.blocked(x, z, .23, y)) { log(`${label}: blocked by ${w.blocker(x, z, .23, y)}`); return false; } const g = w.ground(x, z, y); if (g === null || g < y - .5) voidLen += a.distanceTo(b) / n; }
  check(voidLen > 1.5 && voidLen < 2.1, `${label}: gap ${voidLen.toFixed(2)} m (want 1.5..2.1, jump reach ~3.7 running)`);
  check(Math.abs(a.y - b.y) < .05, `${label}: lips at different heights`);
  return true;
}
function drop(label, a, b) {
  // walk from a towards b at a's level until the ground falls away; must land on b's level
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .05); let y = a.y, fell = false, settle = 0;
  for (let j = 1; j <= n; j++) {
    const x = a.x + (b.x - a.x) * j / n, z = a.z + (b.z - a.z) * j / n, g = w.ground(x, z, y);
    if (settle > 0) settle--; else if (w.blocked(x, z, .23, y)) { log(`${label}: drop path blocked by ${w.blocker(x, z, .23, y)}`); return false; }
    if (g === null) { log(`${label}: drop into void at ${x.toFixed(2)},${z.toFixed(2)}`); return false; }
    if (y - g > .3) { fell = true; settle = 8; }
    y = g;
  }
  check(fell, `${label}: no drop found`); check(Math.abs(y - b.y) < .08, `${label}: landed at ${y.toFixed(2)} not ${b.y.toFixed(2)}`);
  return true;
}
const at = (az, r, y) => { const a = az * Math.PI / 180; return new T.Vector3(r * Math.sin(a), y, r * Math.cos(a)); };
const G = (az, r, y) => { const p = at(az, r, y); p.y = w.ground(p.x, p.z, y); return p; };
const arc = (a0, a1, r, y, step = 6) => { const out = [], n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / step)); for (let i = 0; i <= n; i++) out.push(G(a0 + (a1 - a0) * i / n, r, y + 0)); return out; };
const galArc = (a0, a1) => { const out = []; for (let a = a0; a <= a1; a += 5) { const g0 = 4 - 8 * Math.min(1, (a - 100) / 250 / .9); out.push(G(a, 10.5, g0 + .1)); } return out; };
const routes = [
  
  ['beat1 bell', 'walk', [P.start, G(-47.5, 20.3, 0), P.morningBell]],
  ['plaza steps anywhere', 'walk', [G(-52, 20, 0), G(-52, 16.4, 1), G(-44, 16.4, 1), G(-44, 20, 0)]],
  ['beat1 bell->mara->wheel', 'walk', [P.morningBell, G(-47.5, 17.8, 1), G(-47.5, 20.2, 0), G(-62, 20.2, 0), G(-73, 21.2, 0), P.maraOutlet, P.maraStand, P.maraLever, G(-80, 20.2, 0), P.seedWheel]],
  ['beat2 wheel->gate->vent', 'walk', [P.seedWheel, G(-83.5, 20.1, 0), P.terraceGate, P.terraceGateInside, P.seedOutlet, P.loftVent]],
  ['beat2 updraft to loft', 'vent', 'loft', P.loftLedge],
  ['loft views', 'walk', [P.loftLedge, P.loftView]],
  ['loft drop to yard', 'drop', P.loftLedge.clone().add(new T.Vector3(0, 0, 0)), G(-92.5, 17.5, 0)],
  // Mill of Sails
  ['sails branch', 'walk', [P.loftView, P.sails.branchStart, P.sails.source, P.sails.bridgePush, P.sails.bridgeFrom]],
  ['sails bridge crossing', 'walk', [P.sails.bridgeFrom, P.sails.bridgeTo, G(-115.8, 36.9, 7.5), P.sails.restore]],
  ['sails cap sail', 'walk', [P.sails.restore, ...P.sails.capPath, P.sails.capSail]],
  ['fragment2 swing platform', 'walk', [P.sails.bridgeTo, P.sails.frag2From, P.sails.frag2To, P.fragment2]],
  ['fragment1 approach', 'walk', [P.start, G(-31, 19.5, 0), G(-31, 17.5, 0)]],
  ['fragment1 updraft', 'vent', 'frag1', P.fragment1],
  ['fragment1 drop back', 'drop', P.fragment1, G(-31, 17.8, 0)],
  // Mill of Pipes
  ['pipes branch', 'walk', [P.loftLedge, P.pipes.source, P.loftLedge, P.pipes.branchStart, ...P.pipes.path, P.pipes.gapFrom]],
  ['pipes jump gap', 'jump', P.pipes.gapFrom, P.pipes.gapTo],
  ['pipes island', 'walk', [...P.pipes.islandPath]],
  ['pipes valve', 'walk', [P.pipes.wheelA, P.pipes.path.at(-2), P.pipes.valve]],
  ['fragment3 approach', 'walk', [P.pipes.restore, ...P.pipes.frag3Path]],
  ['fragment3 jump gap', 'jump', P.pipes.frag3From, P.pipes.frag3To],
  ['fragment3 shrine', 'walk', [P.pipes.frag3To, P.fragment3]],
  // Mill of Ladders
  ['ladders to vent0', 'walk', [P.start, P.ladders.vent0]],
  ['ladders updraft 0', 'vent', 'ladders1', P.ladders.ledge0],
  ['ladders L0', 'walk', [P.ladders.ledge0, P.ladders.vent1]],
  ['ladders updraft 1', 'vent', 'ladders2', P.ladders.ledge1],
  ['ladders ledge1', 'walk', [P.ladders.ledge1, P.ladders.vent2, P.ladders.shutterLever]],
  ['ladders updraft 2', 'vent', 'ladders3', P.ladders.ledge2],
  ['ladders mill', 'walk', [...P.ladders.path]],
  ['ladders drop L2->L1', 'drop', P.ladders.ledge2, G(3.5, 16.4, 9.1)],
  ['ladders drop L1->L0', 'drop', P.ladders.ledge1, G(-7.5, 16.3, 4.6)],
  ['ladders drop L0->terrace', 'drop', P.ladders.ledge0, G(-15.5, 16.3, 0)],
  // Sky Bridge and the Hollow
  ['sky bridge', 'walk', [P.start, G(-12, 22, 0), P.bridge.start, ...arc(-8, 86, 22, 0, 4).map((p) => G(Math.atan2(p.x, p.z) * 180 / Math.PI, 22, 4.2)).map((p, i, A) => { const a = -8 + 94 * i / (A.length - 1); return G(a, 22, (a + 8) / 94 * 4 + .1); }), P.bridge.end, P.hollowGate, P.hollowGateInside]],
  ['gallery descent', 'walk', [P.hollowGateInside, P.gallery.top, ...galArc(105, 340), P.gallery.bottom, G(340, 7.3, -4), ...arc(340, 250, 7.3, -4), R.high.safe, P.pairedBells.stand, ...arc(225, 300, 7.3, -4), R.high.vaneStand]],
  ['well drop high->mid', 'drop', G(250, 7.2, -4), G(250, 5.2, -9)],
  ['well mid ring', 'walk', [G(250, 5.2, -9), G(250, 5.0, -9), R.mid.catchPoint, ...arc(245, 130, 5.0, -9), R.mid.safe, ...arc(130, 220, 5.0, -9), R.mid.vaneStand]],
  ['well drop mid->low', 'drop', G(150, 4.8, -9), G(152, 3.8, -14)],
  ['well low ring', 'walk', [G(152, 3.8, -14), G(160, 2.4, -14), G(128, 1.6, -14), R.low.catchPoint, R.low.vaneStand, R.low.safe]],
  ['well updraft low->mid', 'vent', 'ring1', G(111, 5.6, -9)],
  ['well updraft mid->high', 'vent', 'ring2', G(280, 7.6, -4)],
  ['well to ring3 grille', 'walk', [R.high.safe, ...arc(250, 186, 7.3, -4), G(184, 8, -4)]],
  ['well updraft high->top', 'vent', 'ring3', R.top],
  ['well top perch vane', 'walk', [R.top, R.top.safe, R.top, R.top.vaneStand]],
  ['gallery source', 'walk', [P.hollowGateInside, P.gallery.top, P.gallery.source]],
  ['mid ring widened stretch', 'walk', [G(230, 3.7, -9), G(260, 3.7, -9), G(260, 5.6, -9)]],
];
setAll(OPEN);
const routeResults = [];
for (const [label, kind, a, b] of routes) {
  const before = fails.length;
  if (kind === 'walk') walk(label, a.map(V)); else if (kind === 'vent') vent(label, a, V(b)); else if (kind === 'jump') jumpGap(label, V(a), V(b)); else drop(label, V(a), V(b));
  routeResults.push({label, kind, ok: fails.length === before});
}

// ---------------------------------------------------------------- gating by dynamic state
setAll(CLOSED);
const blockedLeg = (label, a, b) => { const n = Math.ceil(a.distanceTo(b) / .05); let y = a.y; for (let j = 1; j <= n; j++) { const x = a.x + (b.x - a.x) * j / n, z = a.z + (b.z - a.z) * j / n, g = w.ground(x, z, y); if (g === null || Math.abs(g - y) >= .28 || w.blocked(x, z, .23, y)) return true; y = g; } log(`${label}: passable while closed`); return false; };
blockedLeg('gate closed', P.seedWheel, P.terraceGateInside);
blockedLeg('sail bridge away', P.sails.bridgeFrom, P.sails.bridgeTo);
blockedLeg('sky bridge absent', P.bridge.start, P.bridge.stages[0].mid);
blockedLeg('hollow gate shut', P.hollowGate, P.hollowGateInside);
blockedLeg('frag2 swing away', P.sails.frag2From, P.sails.frag2To);
// A closed/missing bridge is never an open edge: the barrier stops the walker before the lip.
for (const [label, a, b] of [['sails lip', P.sails.bridgePush, P.sails.bridgeTo], ['sky lip', P.start, P.bridge.stages[0].mid]]) {
  const n = Math.ceil(a.distanceTo(b) / .05); let y = a.y;
  for (let j = 1; j <= n; j++) { const x = a.x + (b.x - a.x) * j / n, z = a.z + (b.z - a.z) * j / n; if (w.blocked(x, z, .23, y)) break; const g = w.ground(x, z, y); if (g === null) { log(`${label}: walker can step into the void while closed`); break; } y = g; }
}
for (let k = 1; k <= 3; k++) { setAll({...CLOSED, skyPlanks: k}); const s = P.bridge.stages[k - 1]; check(w.ground(s.mid.x, s.mid.z, s.mid.y) !== null, `sky stage ${k - 1} present at planks=${k}`); if (k < 3) check(w.ground(P.bridge.stages[k].mid.x, P.bridge.stages[k].mid.z, P.bridge.stages[k].mid.y) === null, `sky stage ${k} absent at planks=${k}`); }
setAll(OPEN);

// ---------------------------------------------------------------- rails bound drops
let railSamples = 0; const railIssues = [];
for (const rail of w.rails) {
  if (rail.kind !== 'edge') continue;
  if (typeof rail.enabled === 'function' && !rail.enabled()) continue;
  const p = rail.pts;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], L = Math.hypot(b[0] - a[0], b[2] - a[2]); if (L < .3) continue;
    const nx = -(b[2] - a[2]) / L, nz = (b[0] - a[0]) / L;
    for (const f of [.3, .5, .7]) {
      const x = a[0] + (b[0] - a[0]) * f, z = a[2] + (b[2] - a[2]) * f, y = a[1] + (b[1] - a[1]) * f;
      const s1 = w.ground(x + nx * .45, z + nz * .45, y), s2 = w.ground(x - nx * .45, z - nz * .45, y);
      const on = (g) => g !== null && Math.abs(g - y) < .2, off = (g) => g === null || g < y - .45;
      railSamples++;
      if (!((on(s1) && off(s2)) || (on(s2) && off(s1)))) railIssues.push(`${rail.id} @${x.toFixed(1)},${z.toFixed(1)} y${y.toFixed(1)}: sides ${s1?.toFixed?.(2) ?? s1}/${s2?.toFixed?.(2) ?? s2}`);
    }
  }
}
for (const r of railIssues.slice(0, 25)) log('rail: ' + r);
if (railIssues.length > 25) log(`rail: ... ${railIssues.length - 25} more`);

// ---------------------------------------------------------------- layered ground
const layerCases = [
  ['loft over yard', at(-97.5, 18, 0), [5, 0]],
  ['pipes branch over yard', at(-98.2, 25.8, 0), [null, 0]],
  ['ladders L0 over terrace', at(-12, 17, 0), [4.6, 0]],
  ['ladders L1 over L0', at(-5.5, 17, 0), [9.1, 4.6]],
  ['ladders L2 over L1', at(5.5, 17, 0), [13.6, 9.1]],
  ['gallery vs high ring (adjacent radii)', at(200, 10.4, 0), [null]],
];
let layerChecks = 0;
for (const [label, p, hs] of layerCases) {
  const L = w.layers(p.x, p.z).map((l) => +l.h.toFixed(2));
  if (hs[0] === null) { check(L.length >= 1, `${label}: no layers`); layerChecks++; continue; }
  for (const h of hs) { const g = w.ground(p.x, p.z, h + .1); check(g !== null && Math.abs(g - h) < .05, `${label}: ground(y=${h}) = ${g} (layers ${L})`); layerChecks++; }
  // walking under an upper deck is allowed (head room) and its body blocks entry from the side only
  check(!w.blocked(p.x, p.z, .23, hs.at(-1)), `${label}: lower level blocked by ${w.blocker(p.x, p.z, .23, hs.at(-1))}`);
}
// Deck bodies are solid: stepping into a ring's side from below is blocked.
check(w.blocked(...[at(200, 4.3, -14)].map((p) => [p.x, p.z])[0], .23, -14), 'mid ring body blocks the low floor walker');
check(w.blocked(...[at(250, 6.6, -9)].map((p) => [p.x, p.z])[0], .23, -9), 'high ring body blocks the mid ring walker');

// ---------------------------------------------------------------- edge safety scan
// Every walkable spot, on every layer: stepping 0.4 m in any direction must either be blocked
// by something drawn, stay on ground, or fall onto ground below (a safe drop). Falling into
// the void is allowed only across the declared Pipes jump gap.
setAll(OPEN);
let edgeSamples = 0; const voidEdges = [];
const jumpLips = [P.pipes.gapFrom, P.pipes.gapTo, P.pipes.frag3From, P.pipes.frag3To];
for (let x = -52; x <= 52; x += .5) for (let z = -52; z <= 52; z += .5) {
  for (const {h} of w.layers(x, z)) {
    if (w.ground(x, z, h) !== h || w.blocked(x, z, .23, h)) continue;
    edgeSamples++;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, nx = x + Math.cos(a) * .45, nz = z + Math.sin(a) * .45;
      if (w.blocked(nx, nz, .23, h)) continue;
      if (w.ground(nx, nz, h) !== null) continue;
      if (jumpLips.some((l) => Math.hypot(l.x - x, l.z - z) < 3.2)) continue;
      voidEdges.push(`${x.toFixed(1)},${z.toFixed(1)} y${h.toFixed(1)} -> void`); break;
    }
  }
}
for (const e of voidEdges.slice(0, 20)) log('unsafe edge: ' + e);
if (voidEdges.length > 20) log(`unsafe edge: ... ${voidEdges.length - 20} more`);

// ---------------------------------------------------------------- nothing hangs in the air
// Every banner, flag, pennant, bunting/laundry line, lantern (chain) and pinwheel records the
// points it hangs from (world.hangers / userData.hangsFrom). Each must lie within 6 cm of real
// support geometry (baked scenery or moving parts; the decorations themselves do not count).
{
  w.root.updateMatrixWorld(true);
  const CELL = 1, grid = new Map(), keyOf = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
  const tris = []; const A = new T.Vector3(), Bv = new T.Vector3(), C = new T.Vector3();
  w.root.traverse((o) => {
    if (!o.isMesh || o.userData.decoration || o.isInstancedMesh || o.material?.name === 'shaft') return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
      A.fromBufferAttribute(pos, ia).applyMatrix4(o.matrixWorld); Bv.fromBufferAttribute(pos, ib).applyMatrix4(o.matrixWorld); C.fromBufferAttribute(pos, ic).applyMatrix4(o.matrixWorld);
      const t = new T.Triangle(A.clone(), Bv.clone(), C.clone()), id = tris.push(t) - 1, bb = new T.Box3().setFromPoints([t.a, t.b, t.c]).expandByScalar(.07);
      if (bb.max.x - bb.min.x > 60 || bb.max.z - bb.min.z > 60 || bb.max.y - bb.min.y > 60) continue;
      for (let gx = Math.floor(bb.min.x / CELL); gx <= Math.floor(bb.max.x / CELL); gx++) for (let gy = Math.floor(bb.min.y / CELL); gy <= Math.floor(bb.max.y / CELL); gy++) for (let gz = Math.floor(bb.min.z / CELL); gz <= Math.floor(bb.max.z / CELL); gz++) { const k = `${gx},${gy},${gz}`; (grid.get(k) || grid.set(k, []).get(k)).push(id); }
    }
  });
  const cp = new T.Vector3(); let hangChecks = 0; const floating = [];
  for (const h of w.hangers) for (const p of h.pts) {
    hangChecks++; const q = new T.Vector3(...p); let best = Infinity;
    const cx = Math.floor(q.x / CELL), cy = Math.floor(q.y / CELL), cz = Math.floor(q.z / CELL);
    outer: for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const i of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) || []) { tris[i].closestPointToPoint(q, cp); best = Math.min(best, cp.distanceTo(q)); if (best < .06) break outer; }
    if (best >= .06) floating.push(`${h.kind}${h.note ? ' (' + h.note + ')' : ''} at ${p.map((v) => v.toFixed(2))} (${best === Infinity ? '>1 m' : best.toFixed(2) + ' m'} from support)`);
  }
  for (const f of floating.slice(0, 30)) log('floating decoration: ' + f);
  if (floating.length > 30) log(`floating decoration: ... ${floating.length - 30} more`);
  globalThis.__hang = {hangChecks, floating: floating.length};
}

// ---------------------------------------------------------------- barriers never close through the hero
{
  const b0 = P.bridge.stages[0].from; // stage-0 barrier sits at the terrace edge of stage 0
  w.update(1 / 60, 0, {...OPEN, skyPlanks: 1}); w.update(1 / 60, 0, {...OPEN, skyPlanks: 1});
  const hero = new T.Vector3(b0.x, b0.y, b0.z);
  w.update(1 / 60, 0, {...OPEN, skyPlanks: 0, hero}); // the stage vanishes while the hero stands in the chain line
  check(!w.blocked(hero.x, hero.z, .23, hero.y), 'stage-0 chain closed through the hero');
  const away = new T.Vector3(...[P.start.x, P.start.y, P.start.z]);
  w.update(1 / 60, 0, {...OPEN, skyPlanks: 0, hero: away});
  check(w.blocked(hero.x, hero.z, .23, hero.y), 'stage-0 chain did not arm once the hero was clear');
  w.update(1 / 60, 0, {...OPEN, skyPlanks: 1.5}); check(w.ground(P.bridge.stages[1].mid.x, P.bridge.stages[1].mid.z, P.bridge.stages[1].mid.y) === null, 'animating stage must not be walkable yet');
  setAll(OPEN);
}

// ---------------------------------------------------------------- no closed boxes
// Reverse flood fill over 0.5 m cells on every layer: every cell the hero can stand on must have a
// path at least 0.6 m wide (walks, drops, vents, the declared jump gaps) to a checkpoint anchor, in
// every tested world state.
function reachCheck(label, state) {
  setAll(state);
  const CELL = .5, nodes = new Map(), list = [];
  const id = (ix, iz, h) => `${ix},${iz},${Math.round(h * 20)}`;
  for (const s of w.ground_model.surfaces) {
    const [x0, x1, z0, z1] = s.bb;
    for (let ix = Math.floor(x0 / CELL); ix <= Math.ceil(x1 / CELL); ix++) for (let iz = Math.floor(z0 / CELL); iz <= Math.ceil(z1 / CELL); iz++) {
      const x = ix * CELL, z = iz * CELL, h = w.ground_model.heightOf(s, x, z);
      if (h === null || w.ground(x, z, h) !== h || w.blocked(x, z, .23, h)) continue;
      const k = id(ix, iz, h); if (nodes.has(k)) continue;
      const n = {k, ix, iz, x, z, h, preds: []}; nodes.set(k, n); list.push(n);
    }
  }
  const nodeAt = (x, z, h) => { const ix = Math.round(x / CELL), iz = Math.round(z / CELL); for (const dh of [0, .05, -.05, .1, -.1]) { const n = nodes.get(id(ix, iz, h + dh)); if (n) return n; } let best = null; for (const n of list) if (Math.abs(n.h - h) < .3 && Math.hypot(n.x - x, n.z - z) < .8 && (!best || Math.hypot(n.x - x, n.z - z) < Math.hypot(best.x - x, best.z - z))) best = n; return best; };
  const link = (a, b) => { if (a && b && a !== b) b.preds.push(a); };
  for (const n of list) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = n.x + dx * CELL, z = n.z + dz * CELL, mx = (n.x + x) / 2, mz = (n.z + z) / 2;
    const g = w.ground(x, z, n.h + .3);
    if (g !== null && Math.abs(g - n.h) <= .3) { if (!w.blocked(x, z, .3, g) && !w.blocked(mx, mz, .3, n.h)) link(n, nodes.get(id(Math.round(x / CELL), Math.round(z / CELL), g)) || nodeAt(x, z, g)); continue; }
    const low = w.ground(x, z, n.h - .3);
    if (low !== null && n.h - low <= 14 && !w.blocked(x, z, .3, n.h)) link(n, nodes.get(id(Math.round(x / CELL), Math.round(z / CELL), low)) || nodeAt(x, z, low));
  }
  for (const v of w.vents) { if (!v.ledge) continue; const to = nodeAt(v.ledge.x, v.ledge.z, v.ledge.y); for (const n of list) if (Math.abs(n.h - v.y) < .3 && Math.hypot(n.x - v.x, n.z - v.z) < .8) link(n, to); }
  for (const [a, b] of [[P.pipes.gapFrom, P.pipes.gapTo], [P.pipes.frag3From, P.pipes.frag3To]]) { link(nodeAt(a.x, a.z, a.y), nodeAt(b.x, b.z, b.y)); link(nodeAt(b.x, b.z, b.y), nodeAt(a.x, a.z, a.y)); }
  const cps = [P.start, P.loftLedge, P.sails.bridgeFrom, P.sails.restore, P.pipes.wheelA, P.pipes.restore, P.ladders.ledge0, P.ladders.ledge1, P.ladders.ledge2, P.ladders.restore, P.bridge.start, P.hollowGateInside, P.gallery.top, R.low.safe, R.mid.safe, R.high.safe, R.top];
  const seen = new Set(), q = [];
  for (const c of cps) { const n = nodeAt(c.x, c.z, c.y); if (n && !seen.has(n)) { seen.add(n); q.push(n); } }
  while (q.length) { const n = q.pop(); for (const p of n.preds) if (!seen.has(p)) { seen.add(p); q.push(p); } }
  // cells the hero can actually get into in this state (forward from the checkpoints, with a
  // hero-sized 0.46 m clearance so tight squeezes count as reachable)...
  const fwd = new Set(), fq = [];
  const succ = new Map(); for (const n of list) for (const p of n.preds) (succ.get(p) || succ.set(p, []).get(p)).push(n);
  const squeeze = (n) => { for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = n.x + dx * CELL, z = n.z + dz * CELL, g = w.ground(x, z, n.h + .3); if (g !== null && Math.abs(g - n.h) <= .3 && !w.blocked(x, z, .23, g) && !w.blocked((n.x + x) / 2, (n.z + z) / 2, .23, n.h)) { const m = nodes.get(id(Math.round(x / CELL), Math.round(z / CELL), g)); if (m) (succ.get(n) || succ.set(n, []).get(n)).push(m); } } };
  for (const n of list) squeeze(n);
  for (const c of cps) { const n = nodeAt(c.x, c.z, c.y); if (n && !fwd.has(n)) { fwd.add(n); fq.push(n); } }
  while (fq.length) { const n = fq.pop(); for (const m of succ.get(n) || []) if (!fwd.has(m)) { fwd.add(m); fq.push(m); } }
  // ...must each have a >= 0.6 m-wide way back to a checkpoint
  const stuck = list.filter((n) => fwd.has(n) && !seen.has(n));
  // group stuck cells into pockets (a real closed box is a pocket of several cells)
  const pockets = []; const inP = new Set();
  for (const s0 of stuck) { if (inP.has(s0)) continue; const pk = [s0]; inP.add(s0); for (let i = 0; i < pk.length; i++) for (const o of stuck) if (!inP.has(o) && Math.abs(o.h - pk[i].h) < .35 && Math.hypot(o.x - pk[i].x, o.z - pk[i].z) < CELL * 1.5) { inP.add(o); pk.push(o); } pockets.push(pk); }
  for (const pk of pockets) log(`${label}: ${pk.length} stuck cell(s) near ${pk[0].x.toFixed(1)},${pk[0].h.toFixed(1)},${pk[0].z.toFixed(1)}`);
  return {label, nodes: list.length, stuck: stuck.length, pockets: pockets.length};
}
const reach = [
  reachCheck('closed', {...CLOSED}),
  reachCheck('planks1', {...OPEN, skyPlanks: 1, hollowGate: 0}),
  reachCheck('planks2', {...OPEN, skyPlanks: 2, hollowGate: 0}),
  reachCheck('open', {...OPEN}),
  reachCheck('pushes-off', {...OPEN, sailBridge: 0, frag2: 0, ladderShutter: 0, sailsCap: 0, pipesValve: 0}),
];
globalThis.__reach = reach;
setAll(OPEN);

// ---------------------------------------------------------------- stats
let tris = 0, meshes = 0; w.root.traverse((o) => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } });
check(meshes <= 450, `mesh count ${meshes} > 450`); check(tris <= 700000, `triangles ${tris} > 700k`);

const result = {timestamp: new Date().toISOString(), pass: fails.length === 0, hangChecks: globalThis.__hang?.hangChecks, floatingDecorations: globalThis.__hang?.floating, reach: globalThis.__reach, buildMs: Math.round(buildMs), meshes, tris: Math.round(tris), pointChecks, routeSamples, railSamples, layerChecks, edgeSamples, routes: routeResults, failures: fails};
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(result, null, 2));
console.log(JSON.stringify({...result, routes: routeResults.filter((r) => !r.ok).map((r) => r.label)}, null, 2));
process.exit(fails.length ? 1 : 0);
