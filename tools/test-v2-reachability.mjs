// Walkability QA for the real world: plan every on-foot leg of the v2 route with the world in the
// state it will be in at that moment (gate shut/open, bridges, sky planks). Updraft rides are
// covered by test-v2-world-contract.mjs. Prints path lengths so route time can be estimated.
import * as THREE from 'three';
import { buildBellhollow } from '../game/bellhollow/world.js';
import { adaptWorld } from '../game/bellhollow/adapt-world.js';
import { createPlanner } from './route-planner.mjs';
const w = adaptWorld(await buildBellhollow({ THREE, scene: new THREE.Scene() }), { THREE });
const P = w.points, V = id => w.vents.find(v => v.id === id), W = id => w.wheels.find(v => v.id === id), S = id => w.sails.find(v => v.id === id);
const setState = (push, restored) => { for (let i = 0; i < 200; i++) w.update(1 / 60, i / 60, { wind: { push, wheels: {} }, restored }); };
const planner = () => createPlanner(w);
const legs = [], fails = [];
function leg(label, a, b, pl) { const t0 = Date.now(), r = pl.plan(a, b); const len = r.ok ? r.path.reduce((s, p, i) => i ? s + Math.hypot(p.x - r.path[i - 1].x, p.z - r.path[i - 1].z) : 0, 0) : 0; legs.push({ label, ok: r.ok, len: +len.toFixed(1), jumps: r.ok ? r.path.filter(p => p.kind === 'jump').length : 0, drops: r.ok ? r.path.filter(p => p.kind === 'drop').length : 0, ms: Date.now() - t0, reason: r.reason }); if (!r.ok) fails.push(label + ': ' + r.reason); }
setState({}, {}); let pl = planner();
leg('start -> morning bell', P.start, P.morningBell, pl); leg('bell -> Mara', P.morningBell, P.mara, pl); leg('Mara -> outlet', P.mara, P.maraOutlet, pl); leg('outlet -> seed wheel', P.maraOutlet, W('seed'), pl);
leg('start -> ladders gust 1 (terrace)', P.start, P.laddersGust1, pl);
setState({ terraceGate: 1 }, { terrace: .5 }); pl = planner();
leg('seed wheel -> seed outlet (through gate)', W('seed'), P.seedOutlet, pl); leg('seed outlet -> loft grille', P.seedOutlet, V('loft'), pl);
leg('loft -> loft gust', V('loft').ledge, P.loftGust, pl); leg('loft gust -> sails bridge push spot', P.loftGust, S('sailsBridge').stand || P.sails?.bridgePush || S('sailsBridge'), pl);
leg('loft -> pipe wheel A', V('loft').ledge, W('pipesA'), pl); leg('wheel A -> outlet A', W('pipesA'), W('pipesA').outlet, pl);
leg('outlet A -> wheel B', W('pipesA').outlet, W('pipesB'), pl); leg('wheel B -> outlet B', W('pipesB'), W('pipesB').outlet, pl); leg('outlet B -> mill of pipes', W('pipesB').outlet, P.millPipes, pl);
leg('loft -> terrace (down)', V('loft').ledge, P.start, pl); leg('terrace -> ladders vent 1', P.start, V('ladders1'), pl);
leg('ledge 1 -> gust 2', V('ladders1').ledge, P.laddersGust2, pl); leg('gust 2 -> vent 2', P.laddersGust2, V('ladders2'), pl);
leg('ledge 2 -> gust 3', V('ladders2').ledge, P.laddersGust3, pl); leg('gust 3 -> vent 3', P.laddersGust3, V('ladders3'), pl);
leg('top ledge -> mill of ladders', V('ladders3').ledge, P.millLadders, pl);
setState({ terraceGate: 1, sailsBridge: 1, pipesBridge: 1 }, { terrace: .8, sails: 1, pipes: 1, ladders: 1, skyBridge: 1 }); pl = planner();
leg('sails push spot -> sails gust (over bridge)', S('sailsBridge').stand || P.sails?.bridgePush || P.loftGust, P.sailsGust, pl); leg('sails gust -> mill of sails', P.sailsGust, P.millSails, pl);
leg('mill of ladders -> terrace (down)', P.millLadders, P.start, pl);
leg('terrace -> sky bridge start', P.start, P.skyBridge, pl); leg('sky bridge -> hollow gate', P.skyBridge, P.hollowGate, pl);
leg('hollow gate -> carving out', P.hollowGate, P.carvingOut, pl); leg('carving out -> carving return', P.carvingOut, P.carvingReturn, pl);
leg('carving return -> low ring', P.carvingReturn, P.ring1, pl); leg('low ring -> vane 1', P.ring1, P.vane1, pl);
leg('mid ring -> vane 2', P.ring2, P.vane2, pl); leg('high ring -> vane 3', P.ring3, P.vane3, pl); leg('high ring -> bells', P.ring3, P.bellOut, pl);
leg('finale spot -> morning bell', P.finaleSpot, P.morningBell, pl);
setState({ terraceGate: 1, sailsBridge: 1, pipesBridge: 1, frag2: 1, sailsCap: 1, pipesValve: 1 }, { terrace: .8, sails: 1, pipes: 1, ladders: 1, skyBridge: 1 }); pl = planner();
const fromFor = { fragment1: V('frag1')?.ledge || V('loft').ledge, fragment2: V('loft').ledge, fragment3: V('ladders2').ledge };
for (const k of ['fragment1', 'fragment2', 'fragment3']) if (P[k]) { let ok = false; for (const f of [fromFor[k], V('ladders3').ledge, V('ladders1').ledge, V('loft').ledge]) { const r = pl.plan(f, P[k]); if (r.ok) { ok = true; legs.push({ label: '-> ' + k, ok, len: r.path.length / 2, jumps: r.path.filter(p => p.kind === 'jump').length, drops: 0, ms: 0 }); break; } } if (!ok) { legs.push({ label: '-> ' + k, ok }); fails.push(k + ': unreachable from its gate'); } }
console.table(legs);
const walk = legs.filter(l => l.ok).reduce((s, l) => s + l.len, 0);
console.log(`on-foot total ${walk.toFixed(0)} m across ${legs.length} legs`);
console.log(fails.length ? 'UNREACHABLE:\n - ' + fails.join('\n - ') : 'PASS: every route leg is walkable');
if (fails.length) process.exitCode = 1;
