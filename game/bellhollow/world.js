// Bellhollow v2 world: a village grown into a colossal tree.
//
//   buildBellhollow({THREE, scene, loadAsset}) -> {
//     ground(x,z,y), blocked(x,z,r,y), points, vents, wheels, sails, bridges, ledges,
//     zones, update(dt,t,state), setRestored(areaId, amount), setState(key,value), root, stats }
//
// Coordinates: metres; +z = south (towards the default SE camera), +x = east; the great
// trunk stands at the origin. Azimuths ("az") are degrees from +z towards +x.
// Dynamic pieces are driven by `state` (see STATE_KEYS) passed to update() or setState():
// the world holds no gameplay progression, only what those values say is open/in place.
import {PAL, materials, rng, polar, DEG, Bins, bevelBox, rod, taperTube, blob, leafClump, mossDrape, ivyClimb} from './kit/core.js';
import {createGroundModel} from './kit/ground.js';
import {Builder, beam, ribbonSide} from './kit/structures.js';
import {buildTrunk, trunkSolid, trunkR, HOLLOW, openTop as openTopY, carvingRecessR, carvingCentreY} from './kit/trunk.js';
import {buildBackdrop} from './kit/backdrop.js';
import {createLife} from './kit/life.js';
import house from '../assets/bh-house.js';
import bellTower from '../assets/bh-bell-tower.js';
import windmill from '../assets/bh-windmill.js';
import stall from '../assets/bh-market-stall.js';
import lanternPost from '../assets/bh-lantern-post.js';
import ventGrille from '../assets/bh-vent-grille.js';
import seedWheel from '../assets/bh-seed-wheel.js';
import bellFrame from '../assets/bh-bell-frame.js';

/** Keys update()/setState() understand (all 0..1 unless noted). */
export const STATE_KEYS = {
  terraceGate: 'terrace gate open amount (>=.9 passable)',
  sailBridge: 'Mill of Sails hanging bridge: 0 swung away .. 1 in place (>=.97 walkable)',
  ladderShutter: 'Mill of Ladders timed shutter over vent 2: 0 closed .. 1 open',
  skyPlanks: 'Sky Bridge stages present, 0..3 (fractional animates the next stage)',
  hollowGate: 'Hollow gate open amount (>=.9 passable)',
  bellSwing: 'morning bell swing impulse (set to 1 when rung; decays)',
  sailsCap: 'Mill of Sails cap: 0 turned away from the wind .. 1 facing the gust (push its tail sail)',
  pipesValve: 'Mill of Pipes valve: 0 venting to the side .. 1 routed to wheel B',
  frag2: 'fragment-2 swing sail: 0 away .. 1 platform bridge in place (>=.97 walkable)',
};
export const AREAS = ['terrace', 'sails', 'pipes', 'ladders', 'hollow', 'finale'];

export function buildBellhollow({THREE: T, scene, loadAsset} = {}) {
  void loadAsset;
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const root = new T.Group(); root.name = 'bellhollow';
  const gm = createGroundModel();
  const B = new Builder(T, gm, root);
  const M = materials(T);
  const R = rng(1207);
  const dyn = {terraceGate: 0, sailBridge: 0, ladderShutter: 0, skyPlanks: 0, hollowGate: 0, bellSwing: 0, sailsCap: 0, pipesValve: 0, frag2: 0};
  const restored = Object.fromEntries(AREAS.map((a) => [a, 0]));
  const at = (az, r, y = 0) => { const [x, z] = polar(az, r); return [x, y, z]; };
  const V = (p) => new T.Vector3(p[0], p[1], p[2]);
  const vents = [], wheels = [], sails = [], bridges = [], ledges = [], zones = [];
  const movers = []; // {obj, kind, area, axis, speed}
  const barriers = [];
  const planksSettled = () => Math.floor(dyn.skyPlanks + .02);
  const life = createLife(T, root);

  // ---- asset placement ------------------------------------------------------------
  const tmpM = new T.Matrix4();
  /**
   * Instantiate an asset at (x,y,z) facing yaw ry; bake static parts into the current
   * block; pull named moving parts out as their own baked pivots. Returns {group, parts}.
   */
  function place(fn, opts, x, y, z, ry = 0, {collide = 'box', pad = .15, moving = [], scale = 1, colliderScale = 1} = {}) {
    const g = fn(T, opts || {});
    g.updateMatrixWorld(true);
    const bb = new T.Box3().setFromObject(g);
    const placeM = new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), ry), new T.Vector3(scale, scale, scale));
    const parts = {}, nestPairs = [];
    for (const a of moving) for (const b of moving) { const pa = g.userData[a] || g.getObjectByName(a), pb = g.userData[b] || g.getObjectByName(b); if (a !== b && pa && pb) { let n = pa.parent; while (n) { if (n === pb) nestPairs.push([a, b]); n = n.parent; } } }
    for (const name of moving) {
      const part = g.userData[name] || g.getObjectByName(name);
      if (!part) continue;
      part.updateMatrixWorld(true);
      const pw = new T.Matrix4().multiplyMatrices(placeM, part.matrixWorld);
      const inv = part.matrixWorld.clone().invert();
      const bins = new Bins(T, 'part-' + name);
      part.traverse((n) => { if (!n.isMesh) return; const k = n.material.userData.bhKey; void k; });
      const local = new T.Group();
      bins.addObject(part, inv);
      const baked = bins.bake(local);
      const pivot = new T.Group(); pivot.name = 'bh-' + name;
      pw.decompose(pivot.position, pivot.quaternion, pivot.scale);
      pivot.add(...baked.children);
      root.add(pivot);
      part.parent.remove(part);
      parts[name] = pivot;
    }
    // Nested moving parts (a rotor inside a turning cap) keep their hierarchy.
    for (const [child, parent] of nestPairs) if (parts[child] && parts[parent]) { root.updateMatrixWorld(true); parts[parent].attach(parts[child]); }
    B.cur.addObject(g, placeM);
    if (collide === 'box') {
      const hw = (bb.max.x - bb.min.x) / 2 * scale * colliderScale - pad, hd = (bb.max.z - bb.min.z) / 2 * scale * colliderScale - pad;
      const cx = (bb.max.x + bb.min.x) / 2 * scale, cz = (bb.max.z + bb.min.z) / 2 * scale;
      const c = Math.cos(ry), s = Math.sin(ry);
      gm.addBox({id: opts?.id || 'asset', x: x + cx * c + cz * s, z: z - cx * s + cz * c, hw, hd, rot: -ry, y0: y, y1: y + (bb.max.y - bb.min.y) * scale});
    } else if (collide === 'circle') {
      gm.addCircle({id: opts?.id || 'asset', x, z, r: Math.min(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 * scale * colliderScale, y0: y, y1: y + (bb.max.y - bb.min.y) * scale});
    }
    return {group: g, parts, bb};
  }
  // Rotation so that local +Z faces towards azimuth `az` (outward) or back to the trunk.
  const faceOut = (az) => az * DEG;             // local +Z -> direction of az (away from trunk)
  const faceIn = (az) => az * DEG + Math.PI;    // local +Z -> towards the trunk

  // ================================================================================
  // TRUNK + HOLLOW SHELL
  // ================================================================================
  buildTrunk(T, B, 11);
  gm.addSolid(trunkSolid, 'trunk');

  // ================================================================================
  // CANOPY TERRACE (y 0, south-west face; the start)
  // ================================================================================
  B.block('terrace');
  const T_A0 = -100, T_A1 = -8, T_RIN = 12.9;
  const rOut = (a) => 29.3 + 1.1 * Math.sin(a * DEG * 5) + .6 * Math.sin(a * DEG * 13);
  const terracePts = [];
  for (let a = T_A1; a >= T_A0; a -= 3) terracePts.push(polar(a, rOut(a)));
  terracePts.push(polar(T_A0, rOut(T_A0)));
  for (let a = T_A0; a <= T_A1; a += 4) terracePts.push(polar(a, T_RIN));
  terracePts.push(polar(T_A1, T_RIN));
  B.deckPoly('terrace', terracePts, 0, {th: 1.2, mat: 'paving', side: 'stoneShade'});
  // Root shelf under the terrace: bark buttress sweeping back into the bole.
  {
    const pos = [], uv = [];
    for (let a = T_A0; a < T_A1; a += 4) {
      const b = Math.min(T_A1, a + 4), o0 = polar(a, rOut(a) - .1), o1 = polar(b, rOut(b) - .1), i0 = polar(a, 12.5), i1 = polar(b, 12.5);
      const drop = 9 + 2 * Math.sin(a * .2);
      pos.push(o0[0], -1.2, o0[1], i0[0], -drop, i0[1], i1[0], -drop, i1[1], o0[0], -1.2, o0[1], i1[0], -drop, i1[1], o1[0], -1.2, o1[1]);
      uv.push(0, 0, 0, 5, 1, 5, 0, 0, 1, 5, 1, 0);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    // Faces must point outward/down: check one normal and flip if needed.
    if (g.attributes.normal.getY(0) > 0) { const p = g.attributes.position; for (let i = 0; i < p.count; i += 3) { for (let k = 0; k < 3; k++) { const t = p.array[(i + 1) * 3 + k]; p.array[(i + 1) * 3 + k] = p.array[(i + 2) * 3 + k]; p.array[(i + 2) * 3 + k] = t; } } g.computeVertexNormals(); }
    B.add(g, 'bark');
    // hanging roots/ivy under the rim
    for (let a = T_A0 + 3; a < T_A1; a += 7) { const [x, z] = polar(a, rOut(a) - .6); B.add(taperTube(T, [[x, -1, z], [x * 1.02, -3.5, z * 1.02], [x * .98, -6 - R() * 3, z * .98]], .45, .12, 6, 5, .1, a), 'bark'); if (R() < .6) B.add(blob(T, .9 + R() * .5, a, 0, 1.4).translate(x * 1.01, -1.6, z * 1.01), 'leaf'); }
  }
  // Timber boardwalk ring (the village's main street), inlaid flush.
  {
    const st = [];
    for (let a = T_A0 + 1; a <= T_A1 - .5; a += 3) { const i = polar(a, 18.8), o = polar(a, 21.8); st.push({l: [i[0], .03, i[1]], r: [o[0], .03, o[1]], b: -.05}); }
    const {top} = B.stripGeo(st, {capStart: false, capEnd: false});
    B.add(top, 'deck');
  }
  // Layout rule (camera from the SE): tall buildings stand against the trunk and on the
  // west rim, which the camera sees side-on; the camera-side (south) rim carries only low
  // market stalls, planters and pinwheels so the street stays readable. More houses are
  // perched on the bole above the village for height (title-art verticality).
  // Raised bell plaza against the trunk (y 1.0) with stone steps down to the street.
  const PLZ = {a0: -69, a1: -42, r0: 12.9, r1: 17.6, y: 1.0};
  B.deckAnnulus('bell-plaza', {r0: PLZ.r0, r1: PLZ.r1, a0: PLZ.a0, a1: PLZ.a1, y0: PLZ.y, th: 1.2, mat: 'paving', side: 'stone'});
  const STA = {a0: -68.2, a1: -42.8, r0: 17.6, r1: 19.4};
  {
    const am = (STA.a0 + STA.a1) / 2, d = polar(am, 1), o = polar(am, STA.r0);
    const run = STA.r1 - STA.r0;
    void d; void o;
    // ramp surface through the step nosings: radial slope, built as narrow planar wedges
    const nW = 13;
    for (let k = 0; k < nW; k++) {
      const a0 = STA.a0 + (STA.a1 - STA.a0) * k / nW, a1 = STA.a0 + (STA.a1 - STA.a0) * (k + 1) / nW, am2 = (a0 + a1) / 2, dd = polar(am2, 1), oo = polar(am2, STA.r0);
      const pts = [polar(a0 - .05, STA.r0 - .02), polar(a1 + .05, STA.r0 - .02), polar(a1 + .05, STA.r1), polar(a0 - .05, STA.r1)];
      gm.addSurface({id: 'plaza-steps', type: 'poly', pts, y: PLZ.y, gx: -dd[0] * PLZ.y / run, gz: -dd[1] * PLZ.y / run, ox: oo[0], oz: oo[1]});
    }
    // four visible steps (0.25 rise) — the ground is the ramp through their nosings
    for (let k = 0; k < 4; k++) {
      const r0 = STA.r0 + k * run / 4, r1 = r0 + run / 4, h = PLZ.y - k * .25;
      const st = []; for (let a = STA.a0; a <= STA.a1 + .01; a += (STA.a1 - STA.a0) / 12) { const i = polar(a, r0), o2 = polar(a, r1); st.push({l: [i[0], h, i[1]], r: [o2[0], h, o2[1]], b: -.05}); }
      const {top, sides} = B.stripGeo(st); B.add(top, 'paving'); B.add(sides, 'stoneShade');
    }
  }
  // Terrace rails: stone balustrade round the rim; plaza and steps edged.
  {
    const rim = []; for (let a = T_A1; a > T_A0 + .6; a -= 3) { const [x, z] = polar(a, rOut(a) - .3); rim.push([x, 0, z]); }
    const [lx, lz] = polar(T_A0 + .6, rOut(T_A0 + .6) - .3); rim.push([lx, 0, lz]);
    B.rail('terrace-rim', rim, {style: 'stone'});
    B.rail('terrace-west', [at(T_A0 + .6, 13.3), at(T_A0 + .6, rOut(T_A0) - .3)], {style: 'stone'});
    // east edge: gap for the Sky Bridge (r 20.8..23.2) — a chain barrier closes it until stage 1
    B.rail('terrace-east-in', [at(T_A1 - .5, 13.3), at(T_A1 - .5, 20.6)], {style: 'stone'});
    B.rail('terrace-east-out', [at(T_A1 - .5, 23.4), at(T_A1 - .5, rOut(T_A1) - .3)], {style: 'stone'});
    const plzY = PLZ.y;
    B.rail('plaza-side-w', [at(PLZ.a0 + .4, 13.3, plzY), at(PLZ.a0 + .4, PLZ.r1 - .15, plzY)], {style: 'stone'});
    B.rail('plaza-side-e', [at(PLZ.a1 - .4, 13.3, plzY), at(PLZ.a1 - .4, PLZ.r1 - .15, plzY)], {style: 'stone'});
    for (const [id, a] of [['steps-w', STA.a0 - .3], ['steps-e', STA.a1 + .3]]) B.rail(id, [at(a, STA.r0, plzY), at(a, STA.r1, 0)], {style: 'timber', kind: 'fence'});
  }
  // Houses. [type, az, r, seed, facing, y, extra opts]
  const houseDefs = [
    ['workshop', -79.3, 26.1, 4, 'in', 0, {w: 5, d: 4}],
    ['small', -49.5, 26.4, 33, 'in', 0], ['tall', -69.3, 26.2, 21, 'in', 0],
  ];
  // Perched houses on bracket platforms up the bole (decor; unreachable, so not walkable ground).
  const perches = [['small', -25, 14.2, 12, 13.5], ['tower', -45, 11.4, 9, 17], ['tall', -11.5, 13.6, 27, 13], ['small', -128, 13.4, 55, 12.5], ['tower', -140, 12.6, 41, 9.5]];
  const houseParts = [];
  for (const [type, az, r, seed, f, y, extra] of houseDefs) {
    const [x, , z] = at(az, r);
    const ry = (f === 'in' ? faceIn(az) + .35 : faceOut(az)) + (R() - .5) * .12;
    const {parts, bb} = place(house, {type, seed, id: 'house-' + type + '-' + az, ...(extra || {})}, x, y, z, ry, {pad: type === 'workshop' ? 1.0 : .45, moving: type === 'workshop' ? ['workshopWheel'] : []});
    if (parts.workshopWheel) movers.push({obj: parts.workshopWheel, kind: 'spin', axis: 'z', area: 'terrace', speed: 2.2});
    houseParts.push({type, az, r, x, z, ry, y, h: bb.max.y - bb.min.y});
  }
  perches.push(['small', -104.5, 33.8, 71, 1.7], ['tall', -80, 36.2, 72, 2.6], ['tower', -125.5, 35.5, 73, 3.6]);
  for (const [type, az, r, seed, y] of perches) {
    if (r > 25) {
      // free-hanging house platform out in the air (slung under the branches on chains)
      const [cx, , cz] = at(az, r);
      B.add(new T.CylinderGeometry(3.3, 2.6, .5, 16).translate(cx, y - .25, cz), 'deck');
      B.add(new T.CylinderGeometry(2.4, .4, 2.4, 10).translate(cx, y - 1.7, cz), 'bark');
      for (let k = 0; k < 3; k++) { const [dx, dz] = polar(az + 60 + k * 120, 3); B.add(rod(T, [cx + dx, y, cz + dz], [cx + dx * .5, y + 6.5 + (type === 'small' ? 1.5 : 0), cz + dz * .5], .04, 4), 'copper'); }
      B.railArc('perch-' + az, {cx, cz, r: 3.15, a0: 0, a1: 360, y, step: 20, collide: false});
      place(house, {type, seed, id: 'perch-' + az}, cx, y, cz, faceIn(az) + .5, {collide: null});
      houseParts.push({type, az, r, x: cx, z: cz, y, perched: true});
      continue;
    }
    const rin = trunkR(y) - .6, rout = r + 3.1, half = 3.6 / r / DEG;
    const st = []; for (let a = az - half; a <= az + half + .01; a += half / 3) { const i = polar(a, rin), o = polar(a, rout); st.push({l: [i[0], y, i[1]], r: [o[0], y, o[1]], b: y - .5}); }
    const {top, sides} = B.stripGeo(st); B.add(top, 'deck'); B.add(sides, 'timberDark');
    for (const a of [az - half * .7, az + half * .7]) B.add(beam(T, at(a, rin + 2.2, y - .45), at(a, trunkR(y - 2.2) - .2, y - 2.2), .26, .26), 'timberDark');
    B.railArc('perch-' + az, {r: rout - .15, a0: az - half, a1: az + half, y, step: 4, collide: false});
    const [x, , z] = at(az, r);
    place(house, {type, seed, id: 'perch-' + az}, x, y, z, faceOut(az) + (R() - .5) * .2, {collide: null});
    houseParts.push({type, az, r, x, z, y, perched: true});
  }
  // Bell tower + morning bell on the plaza.
  const towerAz = -60, towerR = 26.9;
  {
    const [x, , z] = at(towerAz, towerR);
    const {parts} = place(bellTower, {seed: 3, id: 'bell-tower'}, x, 0, z, faceIn(towerAz), {collide: null, moving: ['bell']});
    gm.addCircle({id: 'bell-tower', x, z, r: 2.0, y0: 0, y1: 15});
    if (parts.bell) movers.push({obj: parts.bell, kind: 'swing', area: 'terrace', speed: 1.3, amp: .18});
  }
  const bellAz = -47.5, bellR = 15.1;
  {
    const [x, , z] = at(bellAz, bellR);
    const {parts} = place(bellFrame, {id: 'morning-bell'}, x, PLZ.y, z, faceOut(bellAz), {pad: .05, moving: ['bell']});
    if (parts.bell) movers.push({obj: parts.bell, kind: 'ring', area: 'terrace', speed: 5, amp: .35, key: 'bellSwing'});
  }
  // Market row on the camera-side rim (low: stalls, crates, planters).
  for (const [az, r, seed] of [[-21, 25.4, 2], [-32.5, 25.8, 5], [-44, 26.2, 7]]) { const [x, , z] = at(az, r); place(stall, {seed, id: 'stall'}, x, 0, z, faceIn(az), {pad: .1}); }
  // Seed wheel (catch & give target #1) — gate mechanism beside it.
  const swAz = -81.8, swR = 16.2;
  {
    const [x, , z] = at(swAz, swR);
    const {parts} = place(seedWheel, {id: 'seed-wheel'}, x, 0, z, faceIn(swAz) + Math.PI / 2, {pad: .1, moving: ['rotor']});
    wheels.push({id: 'seedWheel', x, y: 1.35, z, area: 'terrace', obj: parts.rotor});
    if (parts.rotor) movers.push({obj: parts.rotor, kind: 'spin', axis: 'z', area: 'terrace', speed: 2.6, key: 'terraceGate'});
  }
  // Mara's bypass lever + outlet pipe (the first gust), in front of her workshop.
  const leverP = at(-79.6, 22.9), outletP = at(-71.2, 22.9);  // outlet 2+ m from Mara so she and the gust read apart
  {
    B.add(bevelBox(T, .9, .5, .7).translate(leverP[0], .25, leverP[2]), 'stoneShade');
    B.add(rod(T, [leverP[0], .5, leverP[2]], [leverP[0] + .25, 1.45, leverP[2]], .06, 6), 'timberDark');
    B.add(new T.SphereGeometry(.13, 8, 6).translate(leverP[0] + .27, 1.5, leverP[2]), 'cloth');
    B.add(new T.TorusGeometry(.3, .06, 5, 12, Math.PI).rotateY(faceOut(-16)).translate(leverP[0], .5, leverP[2]), 'copper');
    gm.addCircle({id: 'mara-lever', x: leverP[0], z: leverP[2], r: .45, y0: 0, y1: 1.5});
    // copper outlet pipe from the workshop wall, bell-mouthed, facing the street
    const wall = at(-74.3, 24.6), mouth = [outletP[0], .9, outletP[2]];
    B.add(taperTube(T, [[wall[0], 2.2, wall[2]], [wall[0], .32, wall[2]], [wall[0] + (mouth[0] - wall[0]) * .5, .22, wall[2] + (mouth[2] - wall[2]) * .5], [mouth[0], .22, mouth[2]]], .17, .17, 14, 7, 0, 3), 'verdigris');
    for (const f of [.3, .7]) { const bx = wall[0] + (mouth[0] - wall[0]) * f, bz = wall[2] + (mouth[2] - wall[2]) * f; B.add(new T.BoxGeometry(.5, .12, .16).rotateY(Math.atan2(mouth[0] - wall[0], mouth[2] - wall[2]) + Math.PI / 2).translate(bx, .1, bz), 'timberDark'); }
    const bellMouth = new T.LatheGeometry([[.17, 0], [.2, .12], [.34, .3], [.4, .34]].map(([a, b]) => new T.Vector2(a, b)), 12);
    bellMouth.rotateX(Math.PI / 2); bellMouth.rotateY(Math.atan2(mouth[0] - wall[0], mouth[2] - wall[2])); bellMouth.translate(...mouth);
    B.add(bellMouth, 'copper');
    B.add(new T.CylinderGeometry(.16, .2, .9, 8).translate(mouth[0], .45, mouth[2]), 'copper');
    gm.addCircle({id: 'mara-outlet', x: mouth[0], z: mouth[2], r: .3, y0: 0, y1: 1.3});
  }
  // Terrace gate: stone wall across the terrace at az -86 with a sail-gate arch.
  const GATE = {az: -86, r0: 18.5, r1: 21.5};
  const gateDoors = [];
  {
    const a = GATE.az, wallH = 1.7;
    for (const [r0, r1] of [[13.3, GATE.r0 - .3], [GATE.r1 + .3, rOut(a) - .3]]) {
      const p0 = at(a, r0), p1 = at(a, r1), L = r1 - r0, mid = at(a, (r0 + r1) / 2);
      B.add(bevelBox(T, .6, wallH, L).rotateY(a * DEG).translate(mid[0], wallH / 2, mid[2]), 'stone');
      B.add(new T.BoxGeometry(.8, .16, L + .1).rotateY(a * DEG).translate(mid[0], wallH + .08, mid[2]), 'stoneShade');
      gm.addSegment({id: 'gate-wall', ax: p0[0], az: p0[2], bx: p1[0], bz: p1[2], ya: 0, yb: 0, h: wallH, t: .32});
    }
    // arch piers + arch + little sail on top (R-sail-gate)
    for (const r of [GATE.r0 - .3, GATE.r1 + .3]) { const p = at(a, r); B.add(bevelBox(T, .8, 3.4, .8).rotateY(a * DEG).translate(p[0], 1.7, p[2]), 'stone'); gm.addCircle({id: 'gate-pier', x: p[0], z: p[2], r: .45, y0: 0, y1: 3.4}); }
    const c = at(a, (GATE.r0 + GATE.r1) / 2);
    B.add(new T.TorusGeometry(1.8, .32, 6, 14, Math.PI).rotateY(a * DEG + Math.PI / 2).translate(c[0], 3.3, c[2]), 'stone');
    B.add(rod(T, [c[0], 4.9, c[2]], [c[0], 7.2, c[2]], .07), 'timberDark');
    const sail = new T.PlaneGeometry(1.3, 1.5, 1, 2); const sp = sail.attributes.position; for (let i = 0; i < sp.count; i++) sp.setZ(i, .15 * Math.cos(sp.getY(i) * 2));
    sail.computeVertexNormals(); sail.rotateY(a * DEG + Math.PI / 2); sail.translate(c[0], 6.1, c[2]);
    B.add(sail, 'cloth'); const sailBack = sail.clone(); { const p = sailBack.attributes.position; for (let i = 0; i < p.count; i += 3) for (let k = 0; k < 3; k++) { const t = p.array[(i + 1) * 3 + k]; p.array[(i + 1) * 3 + k] = p.array[(i + 2) * 3 + k]; p.array[(i + 2) * 3 + k] = t; } sailBack.computeVertexNormals(); } B.add(sailBack.toNonIndexed ? sailBack : sailBack, 'cloth');
    // doors (hinged at the piers; swing towards the yard)
    // one wide leaf hinged at the OUTER jamb: when open it lies along the outer edge, clear of the
    // wheel -> outlet -> loft-grille walk that hugs the inner jamb
    { const side = 1, W = GATE.r1 - GATE.r0, p = at(a, GATE.r1);
      const pivot = new T.Group(); pivot.position.set(p[0], 0, p[2]); pivot.rotation.y = a * DEG; root.add(pivot);
      const leaf = new T.Mesh(bevelBox(T, .12, 2.4, W).translate(0, 1.2, -W / 2), M.timber);
      const tb = new Bins(T, 'terrace-gate-' + side), zc = -W / 2;
      for (let z = -W / 2 + .25; z <= W / 2 - .2; z += .25) tb.add(new T.BoxGeometry(.16, 2.3, .03).translate(0, 1.2, zc + z), 'timberDark');
      for (const y of [.45, 1.95]) tb.add(new T.BoxGeometry(.17, .1, W - .08).translate(0, y, zc), 'metalWorn');
      for (const s2 of [-1, 1]) { const d = new T.BoxGeometry(.15, 1.75, .12); d.rotateX(s2 * Math.atan2(1.2, 1.5)); d.translate(0, 1.2, zc + s2 * W / 4); tb.add(d, 'timberDark'); }
      pivot.add(leaf); tb.bake(pivot);
      gateDoors.push({pivot, side});
    }
    const g0 = at(a, GATE.r0), g1 = at(a, GATE.r1);
    gm.addSegment({id: 'terrace-gate', ax: g0[0], az: g0[2], bx: g1[0], bz: g1[2], ya: 0, yb: 0, h: 2.4, t: .12, enabled: () => dyn.terraceGate < .9});
  }
  // Lantern posts along the street (outer side of the boardwalk).
  const lanternPts = [];
  for (const az of [-13.5, -22.5, -40, -58, -94]) { const [x, , z] = at(az, 22.3); const ry = faceIn(az) + Math.PI / 2, {group} = place(lanternPost, {id: 'lamp'}, x, 0, z, ry, {collide: 'circle', colliderScale: .35}); const [lx, ly, lz] = group.userData.postTop; lanternPts.push([x + lx * Math.cos(ry) + lz * Math.sin(ry), ly - .5, z - lx * Math.sin(ry) + lz * Math.cos(ry)]); }
  // Yard clutter (barrels, crates, hay) + planters around the village.
  // Village barrel: bulged lathe of honey staves with painted stave lines, three iron hoops and a
  // planked lid (the old plain cylinder with teal bands read as a black tube in shade).
  const barrel = (x, y, z, s = 1, rot = 0) => {
    const H = .8 * s, R0 = .27 * s, RB = .33 * s, prof = [];
    for (let k = 0; k <= 8; k++) { const f = k / 8; prof.push(new T.Vector2(R0 + (RB - R0) * Math.sin(f * Math.PI), f * H)); }
    B.add(new T.LatheGeometry(prof, 14).rotateY(rot).translate(x, y, z), 'timber');
    for (let k = 0; k < 10; k++) { const a = rot + k / 10 * Math.PI * 2 + .15, pts = prof.map((v) => new T.Vector3(Math.sin(a) * (v.x + .006), v.y, Math.cos(a) * (v.x + .006))); B.add(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 6, .011 * s, 3).translate(x, y, z), 'timberDark'); }
    for (const f of [.1, .5, .9]) { const r = R0 + (RB - R0) * Math.sin(f * Math.PI) + .012; B.add(new T.TorusGeometry(r, .022 * s, 4, 16).rotateX(Math.PI / 2).translate(x, y + f * H, z), 'metalWorn'); }
    B.add(new T.CircleGeometry(R0 - .01, 14).rotateX(-Math.PI / 2).translate(x, y + H - .03, z), 'deck');
    for (const o of [-.09, .09]) B.add(new T.BoxGeometry(.012, .01, 2 * Math.sqrt(Math.max(0, (R0 - .02) ** 2 - (o * s) ** 2))).rotateY(rot).translate(x + Math.cos(rot) * o * s, y + H - .025, z - Math.sin(rot) * o * s), 'timberDark');
    gm.addCircle({id: 'barrel', x, z, r: RB, y0: y, y1: y + H});
  };
  const crate = (x, y, z, s = .55, ry = 0) => { B.add(bevelBox(T, s, s, s, s * .08).rotateY(ry).translate(x, y + s / 2, z), 'timber'); B.add(new T.BoxGeometry(s * 1.02, .06, s * 1.02).rotateY(ry).translate(x, y + s * .5, z), 'timberDark'); gm.addCircle({id: 'crate', x, z, r: s * .6, y0: y, y1: y + s}); };
  const planter = (x, y, z, s = 1) => { B.add(bevelBox(T, .9 * s, .45, .9 * s).translate(x, y + .225, z), 'stone'); leafClump(T, B, x, y + .75, z, .5 * s, Math.round(Math.abs(x * 13 + z * 7)) + 3); if (R() < .6) B.add(new T.IcosahedronGeometry(.09, 0).translate(x + .2, y + .95, z), 'cloth'); gm.addCircle({id: 'planter', x, z, r: .5 * s, y0: y, y1: y + 1}); };
  for (const [az, r, sc, rot] of [[-88.7, 14.05, 1, .3], [-88.8, 14.8, .95, 1.4], [-90.6, 14.2, 1.05, 2.2]]) { const [x, , z] = at(az, r); barrel(x, 0, z, sc, rot); }
  for (const [az, r] of [[-89.5, 26], [-92.5, 26.4], [-91, 25.3]]) { const [x, , z] = at(az, r); crate(x, 0, z, .6, az); }
  { const [x, , z] = at(-97, 24.8); B.add(blob(T, 1.3, 5, 1, .55).translate(x, .4, z), 'leafLight'); B.add(blob(T, .9, 6, 1, .6).translate(x + .6, .9, z), 'leafLight'); gm.addCircle({id: 'hay', x, z, r: 1.2, y0: 0, y1: 1.2}); }
  for (const [az, r] of [[-14.5, 14.2], [-15, 25.6], [-27, 26], [-38.5, 26.4], [-50, 26.6], [-26, 15.2], [-33, 14.6]]) { const [x, , z] = at(az, r); planter(x, 0, z); }
  for (const [az, r] of [[-51.5, 13.9], [-60, 14.2], [-66, 16.2]]) { const [x, , z] = at(az, r); planter(x, PLZ.y, z, .9); }
  for (const [az, r] of [[-43, 22.4], [-49, 22.7]]) { const [x, , z] = at(az, r); barrel(x, 0, z, .9); }
  for (const [az, r] of [[-24, 25.6], [-26, 25.2]]) { const [x, , z] = at(az, r); crate(x, 0, z, .5, az * 2); }

  // ================================================================================
  // LANTERN LOFT (y 5) above the loft yard; reached by the first updraft
  // ================================================================================
  B.block('loft');
  const LOFT = {a0: -118, a1: -96, r0: 12.95, r1: 22.5, y: 5};
  B.deckAnnulus('loft', {r0: LOFT.r0, r1: LOFT.r1, a0: LOFT.a0, a1: LOFT.a1, y0: LOFT.y, th: .45, mat: 'deck', side: 'timberDark', step: 3});
  // struts from the deck's rim down into the bole
  for (let a = LOFT.a0 + 2; a < LOFT.a1; a += 5) { const o = at(a, LOFT.r1 - .5, LOFT.y + .1), t = at(a, trunkR(LOFT.y + 7) + .2, LOFT.y + 7); B.add(rod(T, o, t, .05, 5), 'copper'); B.add(beam(T, at(a, 15.2, LOFT.y - .45), at(a, 13.3, LOFT.y - 2.6), .26, .26), 'timberDark'); B.add(new T.TorusGeometry(.12, .035, 4, 8).translate(...o), 'verdigris'); }
  const SAILS_START = -110, PIPES_START = -100;
  {
    const rr = LOFT.r1 - .15, gapHalf = 1.6 / rr / DEG;
    B.railArc('loft-rim', {r: rr, a0: LOFT.a0, a1: LOFT.a1, y: LOFT.y, step: 2});


    B.rail('loft-west', [at(LOFT.a0 + .4, 13.5, LOFT.y), at(LOFT.a0 + .4, rr, LOFT.y)]);
    // east edge: rail near the trunk; open r 15..22.5 = updraft landing + intended drop to the yard
    B.rail('loft-east', [at(LOFT.a1 - .4, 13.5, LOFT.y), at(LOFT.a1 - .4, 15, LOFT.y)]);
  }
  // Lantern tower: a timber frame with a big lantern — the loft's landmark.
  const loftLampP = at(-107, 15.6, LOFT.y);
  {
    const [x, y, z] = loftLampP, h = 5.2;
    for (const [dx, dz] of [[-.7, -.7], [.7, -.7], [-.7, .7], [.7, .7]]) B.add(rod(T, [x + dx, y, z + dz], [x + dx * .5, y + h, z + dz * .5], .1), 'timberDark');
    for (const yy of [1.6, 3.4]) B.add(new T.BoxGeometry(1.3, .12, 1.3).translate(x, y + yy, z), 'timber');
    B.add(new T.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).translate(x, y + h + .5, z), 'tileCoral');
    life.lantern('terrace', x, y + h - .5, z, 1.5);
    gm.addCircle({id: 'loft-lamp', x, z, r: .95, y0: y, y1: y + h});
  }
  // Loft vent (in the yard below the loft's east edge).
  const loftVentP = at(-91.5, 20.5, 0);
  // Vents: {id,x,y,z,top,radius,ledge}; top = ledge + 0.8 (the column carries the hero over the lip).
  function vent(id, p, ledgeY, area, extra = {}) {
    place(ventGrille, {id}, p[0], p[1], p[2], 0, {collide: null});
    const v = {id, x: p[0], y: p[1], z: p[2], top: ledgeY + .8, radius: .8, area, ...extra};
    vents.push(v); return v;
  }
  vent('loft', loftVentP, LOFT.y, 'terrace', {to: 'loft'});
  // Landing lip: a plank tab reaching out to 1.05 m from the column, edged with a pale stone kerb
  // and a warm lantern on the rim so the landing reads from the default camera.
  { const lipA = -91.5 - 1.05 / 20.5 / DEG;
    B.deckAnnulus('loft-lip', {r0: 18.9, r1: LOFT.r1, a0: LOFT.a1 - .3, a1: lipA, y0: LOFT.y, th: .45, mat: 'deck', side: 'timberDark', step: 1});
    B.railArc('loft-lip-rim', {r: LOFT.r1 - .15, a0: LOFT.a1 - .3, a1: lipA - .9, y: LOFT.y, step: 1});
    const st = []; for (let r = 18.9; r <= LOFT.r1 + .01; r += .9) { const i = at(lipA - .6, Math.min(r, LOFT.r1)), o = at(lipA, Math.min(r, LOFT.r1)); st.push({l: [i[0], LOFT.y + .04, i[2]], r: [o[0], LOFT.y + .04, o[2]], b: LOFT.y - .5}); }
    const g = B.stripGeo(st); B.add(g.top, 'paving'); B.add(g.sides, 'stone'); if (g.caps) B.add(g.caps, 'stone');
    const lp = at(lipA - 1.3, LOFT.r1 - .45, LOFT.y); B.add(new T.CylinderGeometry(.07, .09, 1.5, 6).translate(lp[0], LOFT.y + .75, lp[2]), 'timberDark');
    gm.addCircle({id: 'loft-lip-lamp', x: lp[0], z: lp[2], r: .12, y0: LOFT.y, y1: LOFT.y + 1.6}); life.lantern('terrace', lp[0], LOFT.y + 1.5 + .24 * 1.1, lp[2], 1.1, {mount: 'base'}); }
  ledges.push({id: 'loft', x: at(-99.5, 20.5)[0], y: LOFT.y, z: at(-99.5, 20.5)[2], from: 'loftVent'});

  // ================================================================================
  // WINDMILL BRANCHES
  // ================================================================================
  const branch = (id, ctrl, w, opts = {}) => B.deckRibbon(id, ctrl, w, {mat: 'deckOld', side: 'timberDark', th: .4, log: {r0: 1.25, r1: .8, seed: id.length, extend: opts.extend ?? 0}, ...opts});
  const railBoth = (id, pts, w, o = {}) => B.railRibbon(id, pts, w, {style: 'rope', ...o});
  const polarCtrl = (list) => list.map(([az, r, y]) => at(az, r, y));
  // A branch walkway that arrives at a round deck ends just inside its rim (never runs into the platform): the branch's
  // own sampled centreline is cut where it crosses r - .45 (deck corners still overlap the disc), so its deck, rope
  // rails, end posts and lanterns stop at the edge. The rest of the walkway keeps its exact sampled points.
  const endAtRim = (ctrl, c, r) => {
    const curve = new T.CatmullRomCurve3(ctrl.map((p) => new T.Vector3(...p)), false, 'centripetal');
    const pts = curve.getSpacedPoints(Math.max(2, Math.ceil(curve.getLength()))).map((v) => [v.x, v.y, v.z]);
    const d = (p) => Math.hypot(p[0] - c[0], p[2] - c[1]), R = r - .45, n0 = pts.length;
    while (pts.length > 2 && d(pts.at(-2)) < R) pts.pop();
    const A = pts.at(-2), Bq = pts.at(-1);
    if (d(Bq) < R) { let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (d([A[0] + (Bq[0] - A[0]) * m, 0, A[2] + (Bq[2] - A[2]) * m]) > R) lo = m; else hi = m; }
      pts[pts.length - 1] = [A[0] + (Bq[0] - A[0]) * lo, A[1] + (Bq[1] - A[1]) * lo, A[2] + (Bq[2] - A[2]) * lo]; }
    pts.fullCount = n0; return pts;
  };
  const lanternAlong = (pts, area, every = 7, side = 1, w = 3) => {
    for (let i = 2; i < pts.length - 1; i += every) {
      const a = pts[i - 1], b = pts[i + 1], tx = b[0] - a[0], tz = b[2] - a[2], L = Math.hypot(tx, tz) || 1;
      const x = pts[i][0] - tz / L * (w / 2 - .12) * side, z = pts[i][2] + tx / L * (w / 2 - .12) * side, y = pts[i][1];
      B.add(new T.CylinderGeometry(.07, .08, 2.1, 6).translate(x, y + 1.05, z), 'timberDark');
      B.add(new T.BoxGeometry(.5, .06, .06).translate(x, y + 2.05, z), 'timberDark');
      life.lantern(area, x + .2, y + 1.7, z, 1);
    }
  };
  const disc = (id, c, r, y, o = {}) => { B.deckDisc(id, {cx: c[0], cz: c[1], r, y, th: o.th ?? .6, mat: o.mat ?? 'deck', side: o.side ?? 'timberDark', seg: 28}); return {id, c, r, y}; };
  /** Rail around a disc except angular windows [[a0,a1],...] measured about the disc centre. */
  const discRail = (id, c, r, y, skip = [], style = 'timber') => {
    const inSkip = (a) => skip.some(([s0, s1]) => { let x = a; while (x < s0) x += 360; while (x > s0 + 360) x -= 360; return x <= s1; });
    let run = [];
    const flush = () => { if (run.length > 1) B.rail(id + '-' + B.rails.length, run, {style}); run = []; };
    for (let a = -180; a <= 180; a += 10) {
      // also open the rim wherever another walkable surface continues outward at this level
      const [ox, oz] = polar(a, r + .4), g = gm.ground(c[0] + ox, c[1] + oz, y + .1);
      if (inSkip(a) || (g !== null && Math.abs(g - y) < .2)) { flush(); continue; }
      const [x, z] = polar(a, r - .15); run.push([c[0] + x, y, c[1] + z]);
    }
    flush();
  };
  const azAbout = (c, p) => Math.atan2(p[0] - c[0], p[1] - c[1]) / DEG;

  // ---------------- Mill of Sails (west-north-west) : push the hanging bridge ----------------
  B.block('sails');
  const sailsA = branch('sails-branch-a', polarCtrl([[SAILS_START, 22.2, 5], [-111.5, 25, 5.7], [-113, 27.9, 6.2]]), 3, {extend: 2});
  const sailsMillC = polar(-116.6, 40.4), sailsMillY = 7.5;
  const sailsBCtrl = polarCtrl([[-114.2, 33.2, 6.2], [-115, 35.4, 7], [-115.8, 36.9, 7.5]]), sailsBPts = endAtRim(sailsBCtrl, sailsMillC, 4.3);
  const sailsB = branch('sails-branch-b', sailsBCtrl, 3, {sampled: sailsBPts}), sailsBMid = Math.floor(sailsBPts.fullCount / 2);   // mid index of the untrimmed walkway (frag-2 bridge)
  disc('sails-mill-deck', sailsMillC, 4.3, sailsMillY);
  {
    const cum = [0]; for (let i = 1; i < sailsA.length; i++) cum.push(cum[i - 1] + Math.hypot(sailsA[i][0] - sailsA[i - 1][0], sailsA[i][2] - sailsA[i - 1][2]));
    const jp = at(-110.6, 25.5, 5.95), ji = sailsA.reduce((bi, p, i) => (Math.hypot(p[0] - jp[0], p[2] - jp[2]) < Math.hypot(sailsA[bi][0] - jp[0], sailsA[bi][2] - jp[2]) ? i : bi), 0);
    const side = ribbonSide(sailsA, ji, at(-106.6, 27.6)), win = [[cum[ji] - 2.3, cum[ji] + 2.3]];
    railBoth('sails-a', sailsA, 3); void side; void win;
  }
  {
    const cum = [0]; for (let i = 1; i < sailsB.length; i++) cum.push(cum[i - 1] + Math.hypot(sailsB[i][0] - sailsB[i - 1][0], sailsB[i][2] - sailsB[i - 1][2]));
    const kk = sailsBMid, side = ribbonSide(sailsB, kk, [polar(-104, 39.6)[0], 0, polar(-104, 39.6)[1]]), win = [[cum[kk] - 1.1, cum[kk] + 1.1]];
    railBoth('sails-b', sailsB, 3, side > 0 ? {skipRight: win} : {skipLeft: win});
  }
  lanternAlong(sailsA, 'sails', 3); lanternAlong(sailsB, 'sails', 3, -1);
  discRail('sails-mill-rail', sailsMillC, 4.3, sailsMillY, []);
  // Hanging bridge across the 5 m gap, hung from a gantry at the A end; swings about a pivot.
  const sgA = sailsA.at(-1), sgB = sailsB[0];
  const sailBridge = hangingBridge('sailBridge', sgA, sgB, 2.6, 'sails');
  // Optional fragment #2: a hanging planter platform south of branch B, reached only by pushing
  // its little swing sail (sail id 'frag2'): the plank span swings in from the platform side.
  const frag2C = polar(-104, 39.6), f2y = (() => { const k = sailsBMid; return sailsB[k][1]; })();
  const f2k = sailsBMid, f2p = sailsB[f2k];
  const f2side = ribbonSide(sailsB, f2k, [frag2C[0], 0, frag2C[1]]);
  const f2a = (() => { const a = sailsB[Math.max(0, f2k - 1)], b = sailsB[Math.min(sailsB.length - 1, f2k + 1)], tx = b[0] - a[0], tz = b[2] - a[2], L = Math.hypot(tx, tz); return [f2p[0] - tz / L * 1.5 * f2side, f2p[1], f2p[2] + tx / L * 1.5 * f2side]; })();
  disc('fragment2-ledge', frag2C, 1.9, f2y, {th: .5});
  // carried from below by a bark limb out of branch B (see carryDisc; no ropes to nothing)
  const frag2Carry = () => carryDisc(frag2C, 1.9, f2y, [f2p[0], f2p[1] - 2.2, f2p[2]], {seed: 8, limb: .5});
  const f2dir = [frag2C[0] - f2a[0], frag2C[1] - f2a[2]], f2L = Math.hypot(...f2dir);
  const f2b = [frag2C[0] - f2dir[0] / f2L * 1.75, f2y, frag2C[1] - f2dir[1] / f2L * 1.75];
  const frag2Bridge = hangingBridge('frag2', f2a, f2b, 1.8, 'sails', {lever: false, mast: 2.4});
  discRail('frag2-rail', frag2C, 1.9, f2y, [[azAbout(frag2C, [f2b[0], f2b[2]]) - 30, azAbout(frag2C, [f2b[0], f2b[2]]) + 30]]);
  // Carried platforms (beauty rule 2): a joist ring, radial joists and braces under every round
  // deck, gathered into a bark knot that continues as a limb back into the branch it grows from.
  const carryDisc = (c, r, y, anchor, {limb = 1.05, seed = 1} = {}) => {
    const hub = [c[0], y - 2.3, c[1]];
    B.add(new T.TorusGeometry(r - .45, .14, 5, 28).rotateX(Math.PI / 2).translate(c[0], y - .62, c[1]), 'timberDark');
    for (let k = 0; k < 7; k++) { const [dx, dz] = polar(k / 7 * 360 + seed * 11, r - .5); B.add(beam(T, [c[0], y - .85, c[1]], [c[0] + dx, y - .62, c[1] + dz], .22, .22), 'timberDark'); if (k % 2 === 0) B.add(beam(T, [c[0] + dx * .92, y - .75, c[1] + dz * .92], [hub[0] + dx * .12, hub[1] - .2, hub[2] + dz * .12], .2, .2), 'timberDark'); }
    B.add(taperTube(T, [[c[0], y - .8, c[1]], [c[0], y - 1.8, c[1]], hub, [hub[0] + (anchor[0] - hub[0]) * .45, hub[1] - .6 + (anchor[1] - hub[1]) * .4, hub[2] + (anchor[2] - hub[2]) * .45], anchor], limb * 1.2, limb * .75, 16, 9, .15, seed), 'bark');
    for (let k = 0; k < 3; k++) { const [dx, dz] = polar(seed * 70 + k * 120, r - .3); mossDrape(T, B, c[0] + dx, y - .45, c[1] + dz, 1.1, 1.2 + (k % 2) * .7, seed * 10 + k, Math.atan2(dx, dz) + Math.PI / 2); }
    leafClump(T, B, hub[0] + (anchor[0] - hub[0]) * .3, hub[1] + .3, hub[2] + (anchor[2] - hub[2]) * .3, .9, seed + 60, 10);
    for (let k = 0; k < 3; k++) { const az = seed * 37 + k * 120 + 40, m = polar(az, r * .55), o = polar(az + 6, r + .25), t = polar(az + 9, r + .1); B.add(taperTube(T, [hub, [c[0] + m[0], y - 1.9, c[1] + m[1]], [c[0] + o[0], y - 1.1, c[1] + o[1]], [c[0] + t[0], y - .45, c[1] + t[1]]], .3 * Math.min(1, r / 3), .12, 12, 6, .2, seed * 5 + k), 'bark'); }
    return hub;
  };
  frag2Carry();
  // Vines up a tower and a grounded clump at its foot.
  // Ivy climbing the tower: leafy, wandering stems hugging the tapered octagon (not strings of beads), a low bush at the foot.
  const millR = (yy) => { const ty = yy + .45; let r = Math.max(1.5, 2.1 - Math.max(0, ty - .5) * .095);
    for (const yb of [1.6, 3.2, 4.8]) if (Math.abs(ty - (.5 + yb)) < .16) r = Math.max(r, 2.1 - yb * .075 + .08);   // leaves ride over the stone belt bands
    return r * .93 + .04; };
  const vines = (x, y, z, h, seed, faces = [0, 140, 250]) => { for (const a of faces) { const [dx, dz] = polar(a + seed * 13, 2.05); ivyClimb(T, B, x, y + .45, z, h, millR, a + seed * 13, seed * 7 + a); leafClump(T, B, x + dx * 1.08, y + .45, z + dz * 1.08, .5, seed * 3 + a, 9); } };
  const sailsMill = placeMill('sails', sailsMillC, sailsMillY, -116.6);
  carryDisc(sailsMillC, 4.3, sailsMillY, [sailsB.at(-4)[0], sailsB.at(-4)[1] - 2.2, sailsB.at(-4)[2]], {seed: 2});
  vines(sailsMill.tower.x, sailsMillY, sailsMill.tower.z, 5.5, 2, [30, 160, 250]);

  // ---------------- Mill of Pipes (west) : chain two wheels, gust across the gap ----------------
  B.block('pipes');
  const pipesBr = branch('pipes-branch', polarCtrl([[PIPES_START, 22.2, 5], [-98, 26, 5.8], [-95.5, 29.5, 6.9], [-94.2, 31.4, 7.5], [-93.8, 32.4, 7.5]]), 3, {extend: 2});
  railBoth('pipes', pipesBr, 3); lanternAlong(pipesBr, 'pipes', 3);
  // Branch end platform P1 (wheel A), a 1.8 m running-jump gap, then the mill island (wheel B
  // and the Mill of Pipes). A's outlet puffs across the gap beside B; B's outlet beside the mill.
  const P1 = polar(-93, 35.2), P1r = 4.2, P1y = 7.5;
  disc('pipes-p1', P1, P1r, P1y);
  const u0 = polar(-91.5, 1), GAP = 1.8, ISLr = 4.6;
  const ISL = [P1[0] + u0[0] * (P1r + GAP + ISLr), P1[1] + u0[1] * (P1r + GAP + ISLr)];
  disc('pipes-island', ISL, ISLr, P1y);
  const du = u0, dt = [-du[1], du[0]];
  const E1 = [P1[0] + du[0] * P1r, P1y, P1[1] + du[1] * P1r], E2 = [ISL[0] - du[0] * ISLr, P1y, ISL[1] - du[1] * ISLr];
  const inAzP = azAbout(P1, [pipesBr.at(-2)[0], pipesBr.at(-2)[2]]), outAz = azAbout(P1, [E1[0], E1[2]]);
  // a small balcony on P1's side (laundry, a lookout)
  const balC = [P1[0] - dt[0] * 4.9 - du[0] * .4, P1[1] - dt[1] * 4.9 - du[1] * .4];
  disc('pipes-balcony', balC, 1.7, P1y, {th: .5});
  const f2Az = azAbout(P1, balC);
  // the gap lips stay open (an intended running jump, marked by copper lip plates)
  discRail('pipes-p1-rail', P1, P1r, P1y, [[outAz - 17, outAz + 17]]); void inAzP; void f2Az;
  discRail('balcony-rail', balC, 1.7, P1y, []);
  const inIsl = azAbout(ISL, [E2[0], E2[2]]);
  // fragment #3: a little ledge off the island, a second 1.8 m running jump away
  const f3d = [du[0] * .5 - dt[0] * .866, du[1] * .5 - dt[1] * .866], F3r = 1.7;
  const frag3C = [ISL[0] + f3d[0] * (ISLr + GAP + F3r), ISL[1] + f3d[1] * (ISLr + GAP + F3r)];
  disc('fragment3-ledge', frag3C, F3r, P1y, {th: .5});
  B.add(new T.CylinderGeometry(1.5, .25, 2.4, 10).translate(frag3C[0], P1y - 1.7, frag3C[1]), 'bark');
  const f3Isl = azAbout(ISL, [ISL[0] + f3d[0], ISL[1] + f3d[1]]), f3Back = azAbout(frag3C, ISL);
  discRail('frag3-rail', frag3C, F3r, P1y, [[f3Back - 26, f3Back + 26]]);
  discRail('pipes-island-rail', ISL, ISLr, P1y, [[inIsl - 15, inIsl + 15], [f3Isl - 15, f3Isl + 15]]);
  for (const [c, r, a] of [[P1, P1r, outAz], [ISL, ISLr, inIsl], [ISL, ISLr, f3Isl], [frag3C, F3r, f3Back]]) { const st = []; for (let k = -15; k <= 15; k += 5) { const i = polar(a + k, r - .3), o = polar(a + k, r + .02); st.push({l: [c[0] + i[0], P1y + .015, c[1] + i[1]], r: [c[0] + o[0], P1y + .015, c[1] + o[1]], b: P1y - .06}); } const {top, sides} = B.stripGeo(st); B.add(top, 'metalWorn'); B.add(sides, 'metalWorn'); }
  const Pl = (t, u) => [P1[0] + dt[0] * t + du[0] * u, P1y, P1[1] + dt[1] * t + du[1] * u];
  const Il = (t, u) => [ISL[0] + dt[0] * t + du[0] * u, P1y, ISL[1] + dt[1] * t + du[1] * u];
  const w1P = Pl(2.1, .6), w2P = Il(2.2, .2);
  const out1P = Il(-1.9, -2.2), out2P = Il(-2.4, 1.4);
  const pipesSourceP = Pl(-2.4, -1.2);
  const wheelYaw = Math.atan2(du[0], du[1]);
  for (const [id, p] of [['pipesWheel1', w1P], ['pipesWheel2', w2P]]) {
    const {parts} = place(seedWheel, {id}, p[0], p[1], p[2], wheelYaw, {pad: .1, moving: ['rotor']});
    wheels.push({id, x: p[0], y: p[1] + 1.35, z: p[2], area: 'pipes', obj: parts.rotor});
    if (parts.rotor) movers.push({obj: parts.rotor, kind: 'spin', axis: 'z', area: 'pipes', speed: 3, key: id});
  }
  // copper piping: wheel A under the gap to its outlet on the island; wheel B to the outlet by the mill
  const spout = (p, dirX, dirZ) => { const m = new T.LatheGeometry([[.16, 0], [.2, .12], [.34, .3], [.4, .34]].map(([a, b]) => new T.Vector2(a, b)), 12); m.rotateX(Math.PI / 2); m.rotateY(Math.atan2(dirX, dirZ)); m.translate(p[0], p[1] + .9, p[2]); B.add(m, 'copper'); B.add(new T.CylinderGeometry(.14, .18, .9, 8).translate(p[0], p[1] + .45, p[2]), 'verdigris'); gm.addCircle({id: 'spout', x: p[0], z: p[2], r: .25, y0: p[1], y1: p[1] + 1.2}); };
  const pipeRun = (a, b, lift = .35) => B.add(taperTube(T, [[a[0], a[1] + lift, a[2]], [(a[0] + b[0]) / 2, a[1] + lift + .1, (a[2] + b[2]) / 2], [b[0], b[1] + lift, b[2]]], .12, .12, 10, 6, 0, 1), 'verdigris');
  // VALVE junction between wheel A and the gap: one pipe dives under the gap to wheel B's side,
  // the other vents uselessly off the rim (flapping pennant). Pipes glow cyan while a gust passes.
  const valveP = Pl(1.05, 2.75), wrongP = Pl(3.35, 2.1);
  const glowMat = () => Object.assign(new T.MeshStandardMaterial({color: PAL.verdigris, roughness: .5, metalness: .3, emissive: PAL.wind, emissiveIntensity: 0}), {name: 'metal'});
  const pipeGlow = {in: glowMat(), good: glowMat(), wrong: glowMat()};
  const glowTube = (pts, mat, r = .14) => { const m = new T.Mesh(taperTube(T, pts, r, r, 14, 7, 0, 5), mat); m.name = 'bh-pipes-glow'; root.add(m); return m; };
  glowTube([[w1P[0], P1y + .2, w1P[2]], [(w1P[0] + valveP[0]) / 2, P1y + .16, (w1P[2] + valveP[2]) / 2], [valveP[0], P1y + .4, valveP[2]]], pipeGlow.in, .12);
  glowTube([[valveP[0], P1y + .55, valveP[2]], [E1[0] + dt[0] * 1.2, P1y - .5, E1[2] + dt[1] * 1.2], [E1[0] - du[0] * 1.2, P1y - 1.7, E1[2] - du[1] * 1.2], [(E1[0] + E2[0]) / 2, P1y - 2.05, (E1[2] + E2[2]) / 2], [E2[0] + du[0] * 1.2, P1y - 1.7, E2[2] + du[1] * 1.2], [out1P[0], P1y + .3, out1P[2]]], pipeGlow.good);
  glowTube([[valveP[0], P1y + .4, valveP[2]], [(valveP[0] + wrongP[0]) / 2, P1y + .16, (valveP[2] + wrongP[2]) / 2], [wrongP[0], P1y + .3, wrongP[2]]], pipeGlow.wrong, .12);
  for (const [a0, b0] of [[w1P, valveP], [valveP, wrongP]]) for (const f of [.3, .7]) { const x = a0[0] + (b0[0] - a0[0]) * f, z = a0[2] + (b0[2] - a0[2]) * f; B.add(new T.BoxGeometry(.4, .1, .12).rotateY(Math.atan2(b0[0] - a0[0], b0[2] - a0[2]) + Math.PI / 2).translate(x, P1y + .05, z), 'timberDark'); }
  // (the floor pipes are low and bracketed; they are stepped over, so they carry no wall collider:
  //  a knee-high pipe wall boxed the rim in)
  // valve body: copper drum on a stone pedestal, verdigris wheel-lever that turns with the pose
  B.add(bevelBox(T, .9, .5, .9).translate(valveP[0], P1y + .25, valveP[2]), 'stoneShade');
  B.add(new T.SphereGeometry(.42, 12, 8).translate(valveP[0], P1y + .8, valveP[2]), 'copper');
  B.add(new T.TorusGeometry(.44, .07, 6, 14).rotateX(Math.PI / 2).translate(valveP[0], P1y + .8, valveP[2]), 'verdigris');
  gm.addCircle({id: 'pipes-valve', x: valveP[0], z: valveP[2], r: .5, y0: P1y, y1: P1y + 1.5});
  const valveLever = new T.Group(); valveLever.position.set(valveP[0], P1y + 1.3, valveP[2]); root.add(valveLever);
  { const bins = new Bins(T, 'valve-lever'); bins.add(new T.TorusGeometry(.32, .05, 5, 12).rotateX(Math.PI / 2), 'verdigris'); for (let k = 0; k < 4; k++) bins.add(new T.BoxGeometry(.64, .04, .04).rotateY(k * Math.PI / 4), 'verdigris'); bins.add(new T.CylinderGeometry(.05, .05, .5, 6).translate(0, -.25, 0), 'copper'); bins.add(new T.BoxGeometry(.08, .08, .7).translate(0, .06, .45), 'cloth'); bins.bake(valveLever); }
  // useless vent spout on the rim + its flapping pennant
  { const m = new T.LatheGeometry([[.16, 0], [.2, .12], [.34, .3], [.4, .34]].map(([a, b]) => new T.Vector2(a, b)), 12); m.rotateX(Math.PI / 2); m.rotateY(Math.atan2(dt[0], dt[1])); m.translate(wrongP[0], P1y + .7, wrongP[2]); B.add(m, 'copper'); B.add(new T.CylinderGeometry(.14, .18, .7, 8).translate(wrongP[0], P1y + .35, wrongP[2]), 'verdigris'); gm.addCircle({id: 'vent-spout', x: wrongP[0], z: wrongP[2], r: .25, y0: P1y, y1: P1y + 1}); }
  const wrongFlag = new T.Group(); wrongFlag.position.set(wrongP[0] + dt[0] * .25, P1y + 1.9, wrongP[2] + dt[1] * .25); wrongFlag.rotation.y = Math.atan2(dt[0], dt[1]) - Math.PI / 2; root.add(wrongFlag);
  B.add(new T.CylinderGeometry(.03, .03, 1.2, 5).translate(wrongP[0] + dt[0] * .25, P1y + 1.3, wrongP[2] + dt[1] * .25), 'timberDark');
  { const f = new T.PlaneGeometry(.8, .4, 3, 1); f.translate(.4, -.2, 0); const fm = M.cloth.clone(); fm.side = T.DoubleSide; const flagMesh = new T.Mesh(f, fm); wrongFlag.add(flagMesh); }
  if (false) B.add(taperTube(T, [[w1P[0], P1y + .3, w1P[2]], [E1[0], P1y - .6, E1[2]], [(E1[0] + E2[0]) / 2, P1y - 1.1, (E1[2] + E2[2]) / 2], [E2[0], P1y - .6, E2[2]], [out1P[0], P1y + .3, out1P[2]]], .14, .14, 16, 6, 0, 2), 'verdigris');
  spout(out1P, dt[0], dt[1]);
  pipeRun(w2P, out2P); spout(out2P, -dt[0], -dt[1]);
  spout(pipesSourceP, dt[0], dt[1]);
  const pipesMill = placeMill('pipes', ISL, P1y, -91.2);
  const p1Hub = carryDisc(P1, P1r, P1y, [pipesBr.at(-5)[0], pipesBr.at(-5)[1] - 2.2, pipesBr.at(-5)[2]], {seed: 3});
  const islHub = carryDisc(ISL, ISLr, P1y, p1Hub, {seed: 4, limb: .9});
  carryDisc(frag3C, F3r, P1y, islHub, {seed: 5, limb: .55});
  carryDisc(balC, 1.7, P1y, p1Hub, {seed: 6, limb: .5});
  vines(pipesMill.tower.x, P1y, pipesMill.tower.z, 5, 5, [60, 200]);
  const pipesBridge = null; void pipesBridge;

  // ---------------- Mill of Ladders (south-east, over the Sky Bridge) : updraft ledges ----------------
  // Three ledges stacked up the great branch that leans out over the Hollow's west lip,
  // each reached by a floor vent from the one below; the second vent sits under a timed
  // shutter. Every ledge's inner end overhangs the one below (the intended safe drop back).
  B.block('ladders');
  const L0 = {a0: -14, a1: -4, r0: 15.4, r1: 20.2, y: 4.6};
  const L1 = {a0: -6, a1: 7, r0: 15.4, r1: 20.2, y: 9.1};
  const L2 = {a0: 5, a1: 21, r0: 15.4, r1: 20.2, y: 13.6};
  for (const [id, L] of [['ladders-l0', L0], ['ladders-l1', L1], ['ladders-l2', L2]]) B.deckAnnulus(id, {r0: L.r0, r1: L.r1, a0: L.a0, a1: L.a1, y0: L.y, th: .5, mat: 'deck', side: 'timberDark', step: 2.5});
  const ladMillC = polar(27, 22.4), ladMillY = L2.y;
  disc('ladders-mill-deck', ladMillC, 5.1, ladMillY);
  // rails: outer/inner rims everywhere; the east end of each ledge is railed; its west end
  // (overhanging the ledge below) is the open drop. L0's west end faces the vent column.
  B.railArc('l0-out', {r: L0.r1 - .15, a0: L0.a0, a1: L0.a1, y: L0.y, step: 2.5}); B.railArc('l0-in', {r: L0.r0 + .15, a0: L0.a0, a1: L0.a1, y: L0.y, step: 2.5});
  B.rail('l0-e', [at(L0.a1 - .3, L0.r0 + .15, L0.y), at(L0.a1 - .3, L0.r1 - .15, L0.y)]);
  B.railArc('l1-out', {r: L1.r1 - .15, a0: L1.a0, a1: L1.a1, y: L1.y, step: 2});
  B.railArc('l1-in', {r: L1.r0 + .15, a0: L1.a0, a1: L1.a1, y: L1.y, step: 2.5});
  B.rail('l1-e', [at(L1.a1 - .3, L1.r0 + .15, L1.y), at(L1.a1 - .3, L1.r1 - .15, L1.y)]);
  B.railArc('l2-out', {r: L2.r1 - .15, a0: L2.a0, a1: L2.a1, y: L2.y, step: 2});
  B.rail('l2-e', [at(L2.a1 - .3, L2.r0 + .15, L2.y), at(L2.a1 - .3, L2.r1 - .15, L2.y)]); B.railArc('l2-in', {r: L2.r0 + .15, a0: L2.a0, a1: L2.a1, y: L2.y, step: 2.5});
  discRail('lad-mill-rail', ladMillC, 5.1, ladMillY, []);
  // fragment #3: a perch off L1's outer rim
  const perchL = polar(1, 21.6);
  disc('ladders-perch', perchL, 1.5, L1.y, {th: .45});
  discRail('ladders-perch-rail', perchL, 1.5, L1.y, []);
  // vents: V0 terrace -> L0, V1 L0 -> L1, V2 L1 -> L2 (under the timed shutter)
  vent('ladders1', at(-16.6, 17.6, 0), L0.y, 'ladders', {to: 'ladders-l0'});
  vent('ladders2', at(-8.6, 17.6, L0.y), L1.y, 'ladders', {to: 'ladders-l1'});
  const v2 = vent('ladders3', at(2.3, 17.6, L1.y), L2.y, 'ladders', {to: 'ladders-l2', shutter: 'laddersShutter'});
  ledges.push({id: 'ladders-l0', x: at(-12, 17.6)[0], y: L0.y, z: at(-12, 17.6)[2], from: 'ladderVent0'});
  ledges.push({id: 'ladders-l1', x: at(-4, 17.6)[0], y: L1.y, z: at(-4, 17.6)[2], from: 'ladderVent1'});
  ledges.push({id: 'ladders-l2', x: at(7, 17.6)[0], y: L2.y, z: at(7, 17.6)[2], from: 'ladderVent2'});
  // timed shutter: copper leaf hinged beside vent 2 (visual; the quest reads ladderShutter)
  const shutter = new T.Group(); { const p = at(2.3, 17.6 - 1.05, L1.y); shutter.position.set(p[0], p[1] + .12, p[2]); shutter.rotation.y = 2.3 * DEG; root.add(shutter); const leaf = new T.Mesh(bevelBox(T, 1.9, .08, 1.9).translate(0, 0, 1.05), M.copper); const rib = new T.Mesh(new T.BoxGeometry(1.7, .1, .1).translate(0, .06, 1.05), M.verdigris); shutter.add(leaf, rib); v2.shutterObj = shutter; }
  const ladMill = placeMill('ladders', ladMillC, ladMillY, 27);
  carryDisc(ladMillC, 5.1, ladMillY, at(22, trunkR(8) + .2, 8), {seed: 7, limb: 1.1});
  vines(ladMill.tower.x, ladMillY, ladMill.tower.z, 5.5, 7, [100, 220, 320]);
  // The great branch the ledges hang from: a bark limb leaning out of the Hollow's west lip,
  // with timber struts to every ledge (reads as one vertical structure, not floating decks).
  // hung from the trunk on copper rods (supports stay above/behind the walkways and street)
  for (const L of [L0, L1, L2]) for (const a of [L.a0 + 1.5, L.a1 - 1.5]) { const o = at(a, L.r1 - .4, L.y + .1), t = at(a, trunkR(L.y + 7) + .2, L.y + 7); B.add(rod(T, o, t, .05, 5), 'copper'); B.add(beam(T, at(a, L.r0 + .4, L.y - .5), at(a, trunkR(L.y - 2.6) + .1, L.y - 2.6), .26, .26), 'timberDark'); }
  


  // ================================================================================
  // SKY BRIDGE (terrace east end -> Hollow gate landing), three stages
  // ================================================================================
  B.block('skybridge');
  const SB = {r: 22, a0: -8, a1: 86, y0: 0, y1: 4};
  const sbStages = [];
  const sbBounds = [SB.a0, SB.a0 + (SB.a1 - SB.a0) / 3, SB.a0 + 2 * (SB.a1 - SB.a0) / 3, SB.a1];
  const sbY = (a) => SB.y0 + (SB.y1 - SB.y0) * (a - SB.a0) / (SB.a1 - SB.a0);
  // permanent rope rails + posts (visible hint of the bridge-to-be)
  for (const side of [-1, 1]) {
    const pts = []; for (let a = SB.a0; a <= SB.a1 + .01; a += 3) pts.push(at(a, SB.r + side * 1.15, sbY(a)));
    B.rail('skybridge-' + (side < 0 ? 'in' : 'out'), pts, {style: 'rope', spacing: 2.6});
  }
  for (let k = 0; k < 3; k++) {
    const a0 = sbBounds[k], a1 = sbBounds[k + 1];
    const pts = []; for (let a = a0; a < a1 - .5; a += 2) pts.push(at(a, SB.r, sbY(a))); pts.push(at(a1, SB.r, sbY(a1)));
    const bins = new Bins(T, 'skybridge-' + k), prev = B.cur; B.cur = bins;
    B.deckRibbon('skybridge-' + k, null, 2.4, {sampled: pts, mat: 'deckOld', side: 'timberDark', th: .25, enabled: () => planksSettled() >= k + 1});
    // plank seams (dark battens) so each plank reads
    for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1], L = Math.hypot(q[0] - p[0], q[2] - p[2]) || 1, nx = -(q[2] - p[2]) / L * 1.18, nz = (q[0] - p[0]) / L * 1.18, cx = (p[0] + q[0]) / 2, cy = (p[1] + q[1]) / 2 + .01, cz = (p[2] + q[2]) / 2; B.add(beam(T, [cx - nx, cy, cz - nz], [cx + nx, cy, cz + nz], .06, .03), 'timberDark'); }
    const grp = bins.bake(root); B.cur = prev;
    grp.visible = false;
    sbStages.push({k, a0, a1, grp, from: V(at(a0, SB.r, sbY(a0))), to: V(at(a1, SB.r, sbY(a1))), mid: V(at((a0 + a1) / 2, SB.r, sbY((a0 + a1) / 2)))});
    // chain barrier at this stage's start while it is missing (so no edge is an unsafe drop)
    const c0 = at(a0 + (k === 0 ? -.4 : -.2), SB.r - 1.15, sbY(a0)), c1 = at(a0 + (k === 0 ? -.4 : -.2), SB.r + 1.15, sbY(a0));
    // collision follows the SETTLED stage count; a barrier only exists where the stage before it does
    chainBarrier('skybridge-barrier-' + k, c0, c1, () => planksSettled() >= k && planksSettled() < k + 1);
  }
  // landing end barrier (from the landing side) while stage 3 is missing
  chainBarrier('skybridge-barrier-end', at(SB.a1 + .4, SB.r - 1.15, SB.y1), at(SB.a1 + .4, SB.r + 1.15, SB.y1), () => planksSettled() < 3);
  // bridge posts with lanterns every stage boundary
  for (const a of sbBounds) for (const side of [-1, 1]) { const p = at(a, SB.r + side * 1.35, sbY(a)); B.add(new T.CylinderGeometry(.14, .17, 2.6, 7).translate(p[0], p[1] + .6, p[2]), 'timberDark'); life.lantern('finale', p[0], p[1] + 1.9 + .24, p[2], 1, {mount: 'base'}); }

  // ================================================================================
  // THE HOLLOW: gate landing, gallery, rings, well
  // ================================================================================
  B.block('hollow');
  const H = HOLLOW;
  const LND = {a0: 86, a1: 100, r0: H.gallery.r0, r1: 23.4, y: 4};
  // The landing is carried by a great root-limb growing out of the solid bark just east of the geode mouth
  // (az > 100; the mouth itself is open), with bark knees under each outer corner. Nothing ends in the air.
  B.add(taperTube(T, [at(104.5, 12.6, -8), at(101.5, 15.5, -3.5), at(96, 19.5, 1.6), at(90.5, 23.2, 3.1)], 1.15, .5, 18, 9, .12, 17), 'bark');
  for (const [a, r] of [[88.5, 16.5], [97.5, 16.5], [88.5, 21.5], [97.5, 21.5]]) {
    const top = at(a, r, 4 - .75), foot = at(102.2, 12.7 + (r - 16.5) * .2, -2.2 - (r - 16.5) * .9), mid = at((a + 102.2) / 2, (r + 13) / 2, (top[1] + foot[1]) / 2 - .6);
    B.add(taperTube(T, [foot, mid, top], .42, .2, 10, 7, .15, Math.round(a + r)), 'bark');
  }
  // timber joists under the deck, resting on the knees
  for (const r of [16.5, 21.5]) B.add(beam(T, at(LND.a0 + .8, r, 4 - .75), at(LND.a1 - .8, r, 4 - .75), .34, .3), 'timberDark');
  B.deckAnnulus('hollow-landing', {r0: LND.r0, r1: LND.r1, a0: LND.a0, a1: LND.a1, y0: LND.y, th: .7, mat: 'paving', side: 'heartwood', step: 2});
  B.railArc('landing-out', {r: LND.r1 - .15, a0: LND.a0, a1: LND.a1, y: LND.y, style: 'parapet', step: 3});
  B.railArc('landing-in', {r: LND.r0 + .15, a0: LND.a0, a1: LND.a1, y: LND.y, style: 'parapet', step: 3});
  B.rail('landing-w', [at(LND.a0 + .3, LND.r0 + .15, LND.y), at(LND.a0 + .3, SB.r - 1.3, LND.y)], {style: 'parapet'});
  B.rail('landing-e', [at(LND.a1 - .3, 13.4, LND.y), at(LND.a1 - .3, LND.r1 - .15, LND.y)], {style: 'parapet'});
  // Hollow gate: carved arch across the landing with copper-bound doors.
  const HG = {r: 19};  // out on the landing: behind (not beside) the camera from the gallery top
  const hollowDoors = [];
  {
    const aL = LND.a0 + .6, aR = LND.a1 - .6, pL = at(aL, HG.r, LND.y), pR = at(aR, HG.r, LND.y), c = at((aL + aR) / 2, HG.r, LND.y);
    const span = Math.hypot(pR[0] - pL[0], pR[2] - pL[2]);
    for (const p of [pL, pR]) { B.add(bevelBox(T, .9, 4.4, .9).translate(p[0], p[1] + 2.2, p[2]), 'heartwood'); gm.addCircle({id: 'hollow-gate-pier', x: p[0], z: p[2], r: .5, y0: p[1], y1: p[1] + 4.4}); }
    const yaw = Math.atan2(pR[0] - pL[0], pR[2] - pL[2]);
    B.add(new T.TorusGeometry(span / 2, .38, 6, 16, Math.PI).rotateY(yaw - Math.PI / 2).translate(c[0], c[1] + 4.2, c[2]), 'heartwoodLight');
    B.add(new T.TorusGeometry(span / 2 - .45, .12, 5, 16, Math.PI).rotateY(yaw - Math.PI / 2).translate(c[0], c[1] + 4.2, c[2]), 'copper');
    // bell keystone
    B.add(new T.LatheGeometry([[0, 0], [.2, -.03], [.26, -.25], [.32, -.5], [.44, -.72], [0, -.7]].reverse().map(([u, v]) => new T.Vector2(u, v)), 10).translate(c[0], c[1] + 6.2, c[2]), 'verdigris');
    for (const side of [0, 1]) {
      const p = side ? pR : pL, pivot = new T.Group(); pivot.position.set(p[0], p[1], p[2]); pivot.rotation.y = yaw + (side ? Math.PI : 0) - Math.PI / 2; root.add(pivot);
      const w = span / 2 - .45;
      const leaf = new T.Mesh(bevelBox(T, w, 3.4, .16).translate(w / 2 + .45, 1.7, 0), M.timberDark);
      const db = new Bins(T, 'hollow-door-' + side);
      for (let x = .45 + .38; x < w + .4; x += .38) db.add(new T.BoxGeometry(.035, 3.3, .2).translate(x, 1.7, 0), 'deckDark');
      for (const y of [.55, 3.0]) { db.add(new T.BoxGeometry(w - .1, .13, .22).translate(w / 2 + .45, y, 0), 'metalWorn'); for (let x = .6; x < w + .3; x += .45) db.add(new T.SphereGeometry(.035, 5, 3).translate(x, y, .12), 'metalWorn'); }
      for (const z of [-.1, .1]) {
        const cx = w + .45 - .62, cy = 1.95, pts = [];
        for (let k = 0; k <= 14; k++) { const f = k / 14, ang = Math.PI * .5 + f * Math.PI * 2.1, rad = .1 + f * .5; pts.push(new T.Vector3(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 1.25, z)); }
        pts.unshift(new T.Vector3(w + .45 - .05, cy + .15, z));
        db.add(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 28, .045, 4), 'copper');
        db.add(new T.SphereGeometry(.12, 8, 5).scale(1, 1, .4).translate(w + .45 - .08, 2.75, z), 'verdigris');
      }
      pivot.add(leaf); db.bake(pivot); hollowDoors.push({pivot, side});
    }
    gm.addSegment({id: 'hollow-gate', ax: pL[0], az: pL[2], bx: pR[0], bz: pR[2], ya: LND.y, yb: LND.y, h: 3.4, t: .14, enabled: () => dyn.hollowGate < .9});
  }
  // Gallery: spiral ramp +4 -> -4 round the back wall (flat for its last 10%).
  const galEase = (f) => Math.min(1, f / .9);
  const GAL = {a0: 100, a1: 350};
  B.deckAnnulus('hollow-gallery', {r0: H.gallery.r0, r1: H.gallery.r1, a0: GAL.a0, a1: GAL.a1, y0: 4, y1: -4, ease: galEase, bottom: -4.6, mat: 'paving', side: 'heartwood', step: 3});
  const galY = (a) => 4 - 8 * galEase((a - GAL.a0) / (GAL.a1 - GAL.a0));
  B.railArc('gallery-inner', {r: H.gallery.r0 + .15, a0: GAL.a0 + .5, a1: 311, yfn: (f) => galY(GAL.a0 + .5 + f * (311 - GAL.a0 - .5)), style: 'parapet', step: 4});
  // Rings.
  // The rings' open-side ends (az 100..116) are thin cantilevered tips, not tall walls: the
  // gameplay camera looks in past them. Low parapets guard the new edges; a few corbels carry them.
  const TIP = 136;
  B.deckAnnulus('ring-high', {r0: H.high.r0, r1: H.high.r1, a0: TIP, a1: 350, y0: H.high.y, bottom: H.mid.y - .6, mat: 'paving', side: 'heartwood', capStart: true, capMat: 'heartwood', step: 3});
  B.deckAnnulus('ring-high-tip', {r0: H.high.r0, r1: H.high.r1, a0: 100, a1: TIP + .5, y0: H.high.y, th: .55, mat: 'heartwoodLight', side: 'heartwood', capEnd: false, step: 3});
  B.deckAnnulus('ring-mid', {r0: H.mid.r0, r1: H.mid.r1, a0: TIP, a1: 350, y0: H.mid.y, bottom: H.low.y - .6, mat: 'pavingDeep', side: 'heartwood', capStart: true, capMat: 'heartwood', step: 3});
  B.deckAnnulus('ring-mid-tip', {r0: H.mid.r0, r1: H.mid.r1, a0: 100, a1: TIP + .5, y0: H.mid.y, th: .55, mat: 'pavingDeep', side: 'heartwood', capEnd: false, step: 3});
  // Close the trunk interior behind the thin ring tips (az 100..TIP): heartwood walls at each
  // ring's outer radius, so no view slips under a tip into the back-faced shell (sky leaks).
  { const wallIn = (r, y0, y1, a0, a1) => { const pos = []; for (let a = a0; a < a1; a += 4) { const b = Math.min(a1, a + 4), p00 = at(a, r, y0), p10 = at(b, r, y0), p01 = at(a, r, y1), p11 = at(b, r, y1); pos.push(...p00, ...p01, ...p11, ...p00, ...p11, ...p10, ...p00, ...p11, ...p01, ...p00, ...p10, ...p11); } const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); const uv = []; for (let i = 0; i < pos.length / 3; i++) uv.push(Math.atan2(pos[i * 3], pos[i * 3 + 2]) * r / 3, pos[i * 3 + 1] / 3); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
    B.add(wallIn(H.high.r1 + .05, H.low.y - .7, H.high.y - .5, 98, 352), 'heartwood');
    B.add(wallIn(H.mid.r1 + .05, H.low.y - .7, H.mid.y - .5, 98, TIP + 2), 'heartwood'); }
  B.railArc('ring-mid-tip-out', {r: H.mid.r1 - .15, a0: 100.5, a1: TIP, y: H.mid.y, style: 'parapet', step: 3});
  B.rail('well-front-tip-side', [at(99.6, H.low.r + .05, H.low.y), at(99.6, H.mid.r1 + .15, H.low.y)], {style: 'parapet'});
  B.railArc('ring-low-tip-edge', {r: H.low.r - .15, a0: 100.5, a1: TIP, y: H.low.y, style: 'parapet', step: 3});
  for (const [ring, k] of [[H.high, 0], [H.mid, 1]]) for (const a of [106, 122]) { B.add(taperTube(T, [at(a - 1, ring.r1 - .3, ring.y - .5), at(a, ring.r0 + 1, ring.y - 1.4), at(a + 1, ring.r0 + .5, ring.y - 2.6)], .22, .06, 6, 5, .2, a + k), 'bark'); }
  B.deckDisc('ring-low', {r: H.low.r, y: H.low.y, th: 1.4, mat: 'pavingDeep', side: 'heartwood', seg: 36});
  B.deckAnnulus('well-front', {r0: H.low.r - .05, r1: H.floorFront, a0: -10, a1: 100, y0: H.low.y, th: 1.4, mat: 'pavingDeep', side: 'heartwood', step: 3});
  for (const [id, ring] of [['high', H.high], ['mid', H.mid]]) {
    B.rail(`ring-${id}-end-e`, [at(100.4, ring.r0 + .1, ring.y), at(100.4, ring.r1 - .05, ring.y)], {style: 'parapet'});
    B.rail(`ring-${id}-end-w`, [at(349.6, ring.r0 + .1, ring.y), at(349.6, ring.r1 - .05, ring.y)], {style: 'parapet'});
  }
  B.rail('gallery-end-w', [at(349.6, H.gallery.r0, -4), at(349.6, H.gallery.r1 - .1, -4)], {style: 'parapet'});
  B.railArc('well-front-lip', {r: H.floorFront - .2, a0: -9.5, a1: 99.5, y: H.low.y, style: 'parapet', step: 4});
  // Ring vents, vanes, carvings, return channel, paired bells frame.
  const ringVents = {
    low: vent('ring1', at(102, 3.4, H.low.y), H.mid.y, 'hollow', {to: 'ring-mid'}),
    mid: vent('ring2', at(280, 5.75, H.mid.y), H.high.y, 'hollow', {to: 'ring-high'}),
    high: vent('ring3', at(184, 8, H.high.y), .5, 'hollow', {to: 'ring-top'}),
  };
  // mid ring widened (r 3.4) where the guardian's phase-2 lanes sweep (az 170..290)
  const MIDW = {a0: 170, a1: 290, r0: 3.4};
  B.deckAnnulus('ring-mid-wide', {r0: MIDW.r0, r1: H.mid.r0 + .05, a0: MIDW.a0, a1: MIDW.a1, y0: H.mid.y, bottom: H.low.y - .6, mat: 'pavingDeep', side: 'heartwood', step: 3});
  // top perch above the high ring (phase-3 two-column climb: ring2 then ring3)
  const TOP = {a0: 190, a1: 212, r0: 6.9, r1: 9.15, y: .5};
  B.deckAnnulus('ring-top', {r0: TOP.r0, r1: TOP.r1, a0: TOP.a0, a1: TOP.a1, y0: TOP.y, th: .5, mat: 'paving', side: 'heartwood', step: 3});
  B.railArc('ring-top-in', {r: TOP.r0 + .15, a0: TOP.a0 + 3, a1: TOP.a1, y: TOP.y, style: 'parapet', step: 3});
  B.rail('ring-top-e', [at(TOP.a1 - .3, TOP.r0 + .15, TOP.y), at(TOP.a1 - .3, TOP.r1 - .1, TOP.y)], {style: 'parapet'});
  for (const [a, k] of [[TOP.a0 + 3, 1], [TOP.a1 - 3, 2]]) B.add(taperTube(T, [at(a, TOP.r0 + .7, TOP.y - .35), at(a + 1, (TOP.r0 + H.gallery.r0) / 2 + .3, TOP.y - .9), at(a + 2, H.gallery.r0 + .1, galY(a + 2) - .2), at(a + 3, H.gallery.r1 - .2, galY(a + 3) - 1.2)], .34, .22, 10, 6, .15, 40 + k), 'heartwood');
  { const lp = at(TOP.a1 - 4, TOP.r1 - .45, TOP.y); B.add(new T.CylinderGeometry(.07, .09, 1.4, 6).translate(lp[0], TOP.y + .7, lp[2]), 'verdigris'); gm.addCircle({id: 'perch-lamp', x: lp[0], z: lp[2], r: .12, y0: TOP.y, y1: TOP.y + 1.5}); life.lantern('hollow', lp[0], TOP.y + 1.4 + .24 * 1.1, lp[2], 1.1, {mount: 'base'}); }
  const vanes = {};
  // ring vanes stand on stone corbels bracketed off the ring's open inner lip (vane over the drop), never on the
  // walkway; the player turns them from the path side (stand is outward of the plinth)
  for (const [ring, az, r, y] of [['low', 140, 3.0, H.low.y], ['mid', 220, MIDW.r0 - .25, H.mid.y], ['high', 300, H.high.r0 - .25, H.high.y]]) {
    const p = at(az, r, y); vanes[ring] = returnVane('vane-' + ring, p, az, ring === 'low' ? -1 : 1);
    if (ring !== 'low') { B.add(new T.CylinderGeometry(.5, .12, 1.1, 8).translate(p[0], y - .55, p[2]), 'stoneShade'); const q = at(az, r + .55, y); B.add(new T.BoxGeometry(.5, .5, .5).translate(q[0], y - .25, q[2]), 'stoneShade'); }   // corbel + tie-in under the lip
  }
  // top perch vane (the guardian's third vane when it fights from the perch); stand beside it on the perch
  vanes.top = returnVane('vane-top', at(209.5, 7.5, TOP.y), 209.5); vanes.top.stand = V(at(205.5, 8.2, TOP.y));
  // Carved panels on the gallery back wall (outward bell, returning bell, paired channels).
  const carvings = [];
  for (const [i, az] of [[0, 158], [1, 197], [2, 236], [3, 276]]) {  // from az 150 on, main's camera stays inside the cavity
    const wy = galY(az) + 1.9, wp = at(az, H.gallery.r1 - .12, wy);
    const glow = carving(i, wp, az);
    carvings.push({id: 'carving' + (i + 1), stand: V(at(az, 10.2, galY(az))), panel: V(wp), az, glow, intake: V(at(az, H.gallery.r1 - .55, galY(az) + .75))});
  }
  // Root-choked return channel: a carved groove down the back wall, knotted with roots.
  const returnChannel = {top: V(at(212, H.gallery.r1 - .2, 8)), bottom: V(at(212, H.high.r1 - .2, H.high.y))};
  {
    for (let y = -4; y < 8.5; y += .7) { const p = at(212, H.gallery.r1 - .05, y); B.add(new T.BoxGeometry(1.2, .72, .15).rotateY(212 * DEG).translate(p[0], y + .35, p[2]), 'stoneShade'); }
    for (let k = 0; k < 7; k++) {
      const y0 = 8 - k * 1.8, a0 = 212 + (k % 2 ? 4 : -4);
      B.add(taperTube(T, [at(a0 - 8, H.gallery.r1 - .1, y0 + .6), at(212, H.gallery.r1 - .5, y0), at(a0 + 8, H.gallery.r1 - .1, y0 - .9)], .32, .12, 10, 6, .15, k), 'bark');
    }
    for (let k = 0; k < 5; k++) mossDrape(T, B, ...at(212 + (k - 2) * 3, H.gallery.r1 - .35, 2 + k * 1.3), .8, 1.2, k + 70, (212 + (k - 2) * 3) * DEG + Math.PI / 2);
  }
  // Paired bells frame hanging over the well from the back wall (finale).
  const pbStand = at(225, 7.4, H.high.y);
  const pairedBells = {stand: V(pbStand), outward: V(at(232, 5.2, -1.6)), return: V(at(218, 5.2, -1.6)), frame: V(at(225, 9, 2.5))};
  {
    // hung high from the dome on a single beam (above the gameplay camera), long chains down to the pair
    const a = at(225, H.gallery.r1 - .3, 10.2), b = at(225, 4.2, 9.4);
    B.add(beam(T, a, b, .45, .45), 'timberDark');
    for (const aa of [218, 232]) { const top = at(aa, 5.2, 9.3), hang = at(aa, 5.2, -.6); B.add(beam(T, at(225, 5.2, 9.5), top, .2, .2), 'timberDark'); B.add(rod(T, top, hang, .022, 4), 'metalWorn'); }
    B.add(taperTube(T, [at(210, 11.4, 10.5), at(225, 8.6, 9.6), at(240, 11.4, 10.5)], .35, .2, 12, 6, .1, 9), 'bark');
  }
  // Windworks gears on the back wall + copper pipes spiralling down (old machinery).
  for (const [az, y, r] of []) {
    const p = at(az, H.gallery.r1 - .25, y);
    const gear = new T.TorusGeometry(r, .18, 5, 20); gear.rotateY(az * DEG); gear.translate(...p); B.add(gear, 'verdigris');
    for (let k = 0; k < 10; k++) { const t = new T.BoxGeometry(.3, .3, .3); const ang = k / 10 * Math.PI * 2; t.translate(Math.cos(ang) * (r + .2), Math.sin(ang) * (r + .2), 0); t.rotateY(az * DEG); t.translate(...p); B.add(t, 'verdigris'); }
    B.add(new T.CylinderGeometry(.3, .3, .5, 10).rotateX(Math.PI / 2).rotateY(az * DEG).translate(...p), 'copper');
  }
  { // one copper wind channel following the gallery, clamped to the wall
    for (let a = 118; a <= 340 && false; a += 24) { const c = at(a, H.gallery.r1 - .25, galY(a) + 3.2); B.add(new T.TorusGeometry(.3, .06, 5, 12).rotateY(a * DEG).translate(...c), 'copper'); }
    // the great root arch: one strong silhouette spanning the dome
    B.add(taperTube(T, [at(178, H.gallery.r1 - .3, 7.5), at(200, 8.5, 11.8), at(225, 2, 13.2), at(280, 8.5, 11.5), at(318, H.gallery.r1 - .3, 5.5)], 1.15, .8, 24, 10, .14, 42), 'bark');
    B.add(taperTube(T, [at(225, 2.5, 13), at(210, 5, 12.6), at(195, 9, 11), at(185, H.gallery.r1 - .3, 9.5)], .45, .2, 10, 7, .2, 43), 'bark');
  }
  // Hollow lanterns (dim until the hollow is restored) — along the gallery rail.
  for (let a = 140; a < 330; a += 88) { const p = at(a, H.gallery.r0 + .15, galY(a)); B.add(new T.CylinderGeometry(.06, .07, 1.6, 6).translate(p[0], p[1] + .8, p[2]), 'verdigris'); life.lantern('hollow', p[0], p[1] + 1.6 + .24 * .9, p[2], .9, {mount: 'base'}); }
  for (let a = 250; a < 350; a += 200) { const p = at(a, H.high.r0 + .9, H.high.y); life.lantern('hollow', p[0], p[1] + .24 * .7 + .01, p[2], .7, {mount: 'base'}); }
  // Well floor inlay: concentric copper rings + a lane compass.
  for (const rr of [1.6, 3.2]) { const ring = new T.TorusGeometry(rr, .06, 4, 40); ring.rotateX(Math.PI / 2); ring.translate(0, H.low.y + .02, 0); B.add(ring, 'copper'); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * 360; const p = at(a, 2.4, H.low.y + .02); B.add(new T.BoxGeometry(.08, .03, 1.5).rotateY(a * DEG).translate(p[0], p[1], p[2]), 'copper'); }

  // ---- Hollow dressing: structure on every riser so the well reads as carved windworks ----
  B.block('hollow-dressing');
  {
    const riser = (r, yTop, yBot, a0, a1, face, tone = 'stoneShade') => {
      // ribs (buttresses) every 18 deg, a cornice band and a base band, copper pipe runs
      for (let a = a0 + 12; a < a1 - 4 && false; a += 45) {
        const p = at(a, r - face * .18, (yTop + yBot) / 2);
        B.add(bevelBox(T, .7, yTop - yBot, .46, .06).rotateY(a * DEG).translate(p[0], p[1], p[2]), tone);
        const cap = at(a, r - face * .3, yTop - .35); B.add(bevelBox(T, .8, .5, .7, .06).rotateY(a * DEG).translate(cap[0], cap[1], cap[2]), 'stone');
      }
      for (const [yy, th, mat] of [[yTop - .12, .24, 'heartwoodLight'], [yBot + .18, .36, 'heartwood']]) {
        const st = []; for (let a = a0; a <= a1 + .01; a += 4) { const i = polar(a, r - face * .28), o = polar(a, r + face * .02); st.push({l: [i[0], yy + th / 2, i[1]], r: [o[0], yy + th / 2, o[1]], b: yy - th / 2}); }
        const g = B.stripGeo(st); B.add(g.top, mat); B.add(g.sides, mat);
      }
      // carved growth-ring relief: three shallow bands, the tree's years cut into the stone
      for (const off of [.3, .52, .74]) {
        const st = []; for (let a = a0; a <= a1 + .01; a += 4) { const yy = yBot + (yTop - yBot) * off + .08 * Math.sin(a * .21), i = polar(a, r - face * .06), o = polar(a, r + face * .02); st.push({l: [i[0], yy + .06, i[1]], r: [o[0], yy + .06, o[1]], b: yy - .06}); }
        const g = B.stripGeo(st, {capStart: false, capEnd: false}); B.add(g.sides, off === .52 ? (tone === 'stoneShade' ? 'inlayGold' : 'inlayCyan') : 'heartwoodLight');
      }
      // bell niches in alternate bays: dark recess, stone arch, small bell, lantern
      for (let a = a0 + 24; a < a1 - 9; a += 60) {
        const cy = (yTop + yBot) / 2 - .1, h = Math.min(2.6, (yTop - yBot) * .62);
        B.add(new T.PlaneGeometry(1.3, h).rotateY(a * DEG + Math.PI).translate(...at(a, r - face * .05, cy)), 'barkShade');
        B.add(new T.TorusGeometry(.72, .11, 5, 12, Math.PI).rotateY(a * DEG + Math.PI / 2).translate(...at(a, r - face * .06, cy + h / 2 - .1)), 'heartwood');
        for (const side of [-1, 1]) { const q = at(a + side * .72 / r / DEG, r - face * .12, cy - .2); B.add(new T.CylinderGeometry(.09, .12, h - .2, 6).translate(q[0], q[1], q[2]), 'heartwood'); }
        B.add(new T.LatheGeometry([[0, 0], [.13, -.02], [.16, -.15], [.19, -.34], [.26, -.48], [0, -.46]].reverse().map(([u, v]) => new T.Vector2(u, v)), 8).translate(...at(a, r - face * .4, cy + h / 2 - .25)), 'verdigris');
        { const lp = at(a + 5, r - face * .45, cy - .6), wallP = at(a + 5, r + face * .05, cy + .1); B.add(rod(T, wallP, [lp[0], lp[1] + .33 * .8, lp[2]], .03, 4), 'copper'); life.lantern('hollow', lp[0], lp[1], lp[2], .8); }
      }
    };
    riser(H.high.r0, H.high.y, H.mid.y, 100.5, 349.5, 1);
    riser(H.mid.r0, H.mid.y, H.low.y, 100.5, MIDW.a0, 1, 'stoneCool'); riser(H.mid.r0, H.mid.y, H.low.y, MIDW.a1, 349.5, 1, 'stoneCool'); riser(MIDW.r0, H.mid.y, H.low.y, MIDW.a0, MIDW.a1, 1, 'stoneCool');
    // root masses descending the ring faces between the niches (hugging the wall; visible, solid)
    for (const [a, ring, k] of [[160, H.high, 1], [238, H.high, 2], [330, H.high, 3], [164, H.mid, 4], [262, H.mid, 5], [336, H.mid, 6]]) {
      const yTop = ring.y, yBot = ring === H.high ? H.mid.y : H.low.y, r = ring.r0;
      const pts = [at(a, r + .1, yTop - .3), at(a + 1.5, r - .2, yTop - 1.2), at(a - 1, r - .25, (yTop + yBot) / 2), at(a + 2, r - .3, yBot + .6), at(a + 4, r - .75, yBot + .05)];
      B.add(taperTube(T, pts, .55, .22, 14, 8, .18, k * 3), 'bark');
      B.add(taperTube(T, [at(a - 1, r - .2, yTop - 1.5), at(a - 4, r - .2, yTop - 2.6), at(a - 6, r - .45, yBot + .2)], .28, .1, 8, 6, .2, k * 3 + 1), 'bark');
      for (const f of [.25, .75]) { const y = yTop + (yBot - yTop) * f; const c = at(a + .5, r - .25, y); gm.addCircle({id: 'hollow-root', x: c[0], z: c[2], r: .5, y0: yBot, y1: yTop}); }
      mossDrape(T, B, ...at(a + 1, r - .1, yTop + .1), .9, 1.1, k * 11, a * DEG + Math.PI / 2);
    }
    // gallery inner face: ribs following the ramp
    for (let a = 112; a < 318 && false; a += 15) { const top = galY(a), p = at(a, H.gallery.r0 - .16, (top + H.high.y) / 2); if (top - H.high.y < 1) continue; B.add(bevelBox(T, .5, top - H.high.y, .38, .05).rotateY(a * DEG).translate(p[0], p[1], p[2]), 'stoneShade'); }
    // carved bell arches in the bark wall above the gallery (R-trunk-gallery)
    for (let a = 124; a < 335 && false; a += 52) {
      const y0 = galY(a) + 4.2, c = at(a, H.gallery.r1 - .25, y0);
      for (const side of [-1, 1]) { const q = at(a + side * 1.05 / H.gallery.r1 / DEG, H.gallery.r1 - .35, y0 + .75); B.add(new T.CylinderGeometry(.12, .14, 1.6, 6).translate(q[0], q[1], q[2]), 'stone'); }
      B.add(new T.TorusGeometry(1.05, .16, 5, 12, Math.PI).rotateY(a * DEG + Math.PI / 2).translate(c[0], y0 + 1.55, c[2]), 'stone');
      B.add(new T.PlaneGeometry(2, 1.9).rotateY(a * DEG + Math.PI).translate(...at(a, H.gallery.r1 - .1, y0 + .9)), 'barkShade');
      B.add(new T.LatheGeometry([[0, 0], [.16, -.03], [.2, -.2], [.24, -.45], [.33, -.62], [0, -.6]].reverse().map(([u, v]) => new T.Vector2(u, v)), 8).translate(...at(a, H.gallery.r1 - .5, y0 + 1.5)), 'verdigris');
      if (false) B.add(new T.PlaneGeometry(.55, .9).rotateY(a * DEG + Math.PI).translate(...at(a, H.gallery.r1 - .72, y0 - .75)), 'cloth');
    }
    // root masses breaking through the upper wall and pouring over the ring risers (visual)
    for (const [a, k] of [[177, 0], [217, 1], [256, 2], [300, 3], [335, 4]]) {
      const top = at(a, H.gallery.r1 - .1, 9.5), mid = at(a + 3, H.gallery.r1 - .3, galY(a) + 3.4), lip = at(a + 5, H.high.r0 + .15, H.high.y + .15), low = at(a + 7, H.high.r0 - .02, H.mid.y + .8);
      B.add(taperTube(T, [top, mid, [mid[0] * .99, galY(a) + 2.4, mid[2] * .99]], .75, .45, 10, 7, .15, k), 'bark');
      B.add(taperTube(T, [[lip[0], lip[1] + .6, lip[2]], lip, low, at(a + 8, H.mid.r0 + .05, H.mid.y - 3)], .42, .16, 12, 6, .12, k + 9), 'bark');
      mossDrape(T, B, ...at(a + 2, H.gallery.r1 - .35, galY(a) + 4.4), 1.3, 1.5, k + 90, (a + 2) * DEG + Math.PI / 2);
    }
    // dramatic light shafts falling through the geode's opening into the well (soft, additive)
    for (const [a0, a1, w0, w1] of [[18, 205, 1.1, 2.6], [45, 238, 1.4, 3.2], [72, 268, 1, 2.2], [32, 170, .7, 1.6]]) {
      // an open cone from the opening to the floor: seen from anywhere its outline is edge-on and feathers away
      const top = at(a0, 11.2, openTopY(a0) - .6), bot = at(a1, 3, H.low.y + .1);
      const dir = new T.Vector3(bot[0] - top[0], bot[1] - top[1], bot[2] - top[2]), L = dir.length();
      const g = new T.CylinderGeometry(w0 * .75, w1 * .85, L, 14, 1, true);
      g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, -1, 0), dir.normalize()));
      g.translate((top[0] + bot[0]) / 2, (top[1] + bot[1]) / 2, (top[2] + bot[2]) / 2);
      B.add(g, 'shaft');
    }
    for (let a = 128; a < 340 && false; a += 53) mossDrape(T, B, ...at(a, H.gallery.r1 - .5, 9), 1.6, 2.2, a, a * DEG + Math.PI / 2);
  }

  // ---- Branch life: planters, lanterns hung under the limbs, perched birds, gallery frieze ----
  // Small songbird (ivory body, coral breast, dark wings, copper beak), 0.3 m, baked static.
  const bird = (x, y, z, yaw, s = 1) => {
    const q = (g, key) => { g.scale(s, s, s); g.rotateY(yaw); g.translate(x, y, z); B.add(g, key); };
    q(new T.SphereGeometry(.11, 8, 6).scale(1, .85, 1.45).translate(0, .12, 0), 'clothIvory');
    q(new T.SphereGeometry(.075, 7, 5).scale(1, .9, .8).translate(0, .11, .09), 'cloth');
    q(new T.SphereGeometry(.07, 7, 5).translate(0, .23, .1), 'clothIvory');
    q(new T.ConeGeometry(.022, .07, 5).rotateX(Math.PI / 2).translate(0, .23, .19), 'copper');
    q(new T.BoxGeometry(.03, .025, .14).translate(0, .14, -.16).rotateX(-.35), 'timberDark');
    for (const sd of [-1, 1]) q(new T.SphereGeometry(.07, 6, 4).scale(.35, .6, 1.3).translate(sd * .1, .14, -.02), 'timberDark');
  };
  B.block('sails');
  for (const [L, n] of [[sailsA, 3], [sailsB, 2]]) for (let i = 1; i < L.length - 1; i += n) {
    const p = L[i]; B.add(rod(T, [p[0], p[1] - .4, p[2]], [p[0], p[1] - 1.6, p[2]], .02, 4), 'copper'); life.lantern('sails', p[0], p[1] - 1.9, p[2], .9);
  }
  for (const a of [160, 118]) { const [dx, dz] = polar(a, 3.1); leafClump(T, B, sailsMillC[0] + dx, sailsMillY + .7, sailsMillC[1] + dz, .6, a + 5); B.add(bevelBox(T, .8, .5, .8).translate(sailsMillC[0] + dx, sailsMillY + .25, sailsMillC[1] + dz), 'stone'); gm.addCircle({id: 'planter', x: sailsMillC[0] + dx, z: sailsMillC[1] + dz, r: .45, y0: sailsMillY, y1: sailsMillY + 1}); }
  B.block('pipes');
  for (let i = 1; i < pipesBr.length - 2; i += 3) { const p = pipesBr[i]; B.add(rod(T, [p[0], p[1] - .4, p[2]], [p[0], p[1] - 1.6, p[2]], .02, 4), 'copper'); life.lantern('pipes', p[0], p[1] - 1.9, p[2], .9); }
  for (const [t, u] of [[-3.2, 1.6], [2.8, -2.4]]) { const p = Pl(t, u); leafClump(T, B, p[0], P1y + .7, p[2], .6, Math.round(t * 10 + 50)); B.add(bevelBox(T, .8, .5, .8).translate(p[0], P1y + .25, p[2]), 'stone'); gm.addCircle({id: 'planter', x: p[0], z: p[2], r: .45, y0: P1y, y1: P1y + 1}); }
  // stores stacked into the corner behind wheel A (no hero-sized pocket between the wheel, valve and rim)
  { barrel(-36.5, P1y, -5.0, 1.05, .7); gm.addCircle({id: 'stores', x: -36.5, z: -5.0, r: .95, y0: P1y, y1: P1y + 1.2});
    for (const [cx, cz, sz] of [[-37.25, -4.75, .7], [-35.6, -5.45, .6], [-36.2, -4.3, .5], [-36.9, -5.6, .55]]) { B.add(bevelBox(T, sz, sz, sz, sz * .08).rotateY(.4).translate(cx, P1y + sz / 2, cz), 'timber'); B.add(bevelBox(T, sz * .8, sz * .8, sz * .8, .05).rotateY(1.1).translate(cx + .05, P1y + sz + sz * .4, cz - .05), 'timber'); gm.addCircle({id: 'stores', x: cx, z: cz, r: sz * .62, y0: P1y, y1: P1y + sz * 1.8}); } }
  { const p = Il(3.2, -1.8); barrel(p[0], P1y, p[2], 1, 1.9); }
  B.block('ladders');
  for (const [L, a, rr] of [[L0, -12.5, L0.r0 + .7], [L1, 6.1, L1.r1 - .8], [L2, 17, L2.r0 + .7]]) { const p = at(a, rr, L.y); leafClump(T, B, p[0], L.y + .7, p[2], .55, Math.round(a * 3 + 99)); B.add(bevelBox(T, .7, .5, .7).translate(p[0], L.y + .25, p[2]), 'stone'); gm.addCircle({id: 'planter', x: p[0], z: p[2], r: .42, y0: L.y, y1: L.y + 1}); }
  // birds on rail posts, roofs and mill galleries (static; they scatter in a later pass)
  B.block('terrace');
  const railTops = [];
  for (const r of B.pending || []) { const [id, base, opts] = r; if (opts.collide === false || (opts.style && opts.style !== 'timber' && opts.style !== 'stone')) continue; railTops.push([base[Math.floor(base.length / 2)], id]); }
  let bi = 0;
  for (const [p, id] of railTops) { if ((bi++ % 5) !== 0) continue; bird(p[0], p[1] + .95, p[2], bi * 1.7, 1); void id; }
  for (const hp of houseParts.slice(0, 6)) bird(hp.x + .4, (hp.y || 0) + (hp.h || 7) - .1, hp.z, hp.az * DEG, 1.1);
  // Gallery frieze and pilasters (the Hollow wall reads as carved in bands)
  B.block('hollow-dressing');
  {
    const st = []; for (let a = 104; a <= 346; a += 3) { const y = galY(a) + 1.1, i = polar(a, H.gallery.r1 - .2), o = polar(a, H.gallery.r1 + .05); st.push({l: [i[0], y + 1.3, i[1]], r: [o[0], y + 1.3, o[1]], b: y}); }
    const g = B.stripGeo(st); void g;
    if (false) { const st2 = []; for (let a = 104; a <= 346; a += 3) { const y = galY(a) + 1.6, i = polar(a, H.gallery.r1 - .34), o = polar(a, H.gallery.r1 - .3); st2.push({l: [i[0], y + .04, i[1]], r: [o[0], y + .04, o[1]], b: y - .04}); } const g2 = B.stripGeo(st2, {capStart: false, capEnd: false}); B.add(g2.sides, 'inlayCyan'); }
    for (let a = 108; a <= 342 && false; a += 14) {
      const y = galY(a) + 1.75, p = at(a, H.gallery.r1 - .24, y);
      if (Math.round(a) % 14 === 10) B.add(new T.LatheGeometry([[0, 0], [.1, -.02], [.12, -.12], [.14, -.26], [.2, -.36], [0, -.35]].reverse().map(([u, v]) => new T.Vector2(u, v)), 7).translate(p[0], y + .2, p[2]), 'verdigris');
      else B.add(new T.TorusGeometry(.22, .05, 4, 10, Math.PI * 1.5).rotateY(a * DEG + Math.PI / 2).translate(p[0], y, p[2]), 'copper');
    }
    for (let a = 131; a < 335 && false; a += 52) { const y0 = galY(a), p = at(a, H.gallery.r1 - .25, y0 + 2.1); B.add(bevelBox(T, .5, 4.2, .34, .05).rotateY(a * DEG).translate(p[0], p[1], p[2]), 'stone'); }
  }

  // ---- The finale arena: floor mosaic, guardian grille, ring lips, hanging lantern chains ----
  B.block('hollow-dressing');
  {
    const yF = H.low.y + .025;
    // eight petal inlays around a copper breath grille (the guardian hovers above it)
    for (let k = 0; k < 8; k++) {
      const a = k * 45 + 22.5, sh = new T.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(.9, 1.4, 0, 3.1); sh.quadraticCurveTo(-.9, 1.4, 0, 0);
      const g = new T.ShapeGeometry(sh, 6); g.rotateX(-Math.PI / 2); g.translate(0, 0, 0); g.rotateY(a * DEG + Math.PI); g.translate(...polar(a, 1.25).flatMap((v, i) => i ? [yF, v] : [v]));
      B.add(g, k % 2 ? 'tileCoral' : 'tileVerdigris');
    }
    const grille = new T.RingGeometry(.35, 1.15, 24, 1); grille.rotateX(-Math.PI / 2); grille.translate(0, yF + .01, 0); B.add(grille, 'copper');
    for (let k = 0; k < 12; k++) { const g = new T.BoxGeometry(.06, .04, .8); g.translate(0, 0, .75); g.rotateY(k * Math.PI / 6); g.translate(0, yF + .02, 0); B.add(g, 'verdigris'); }
    // copper lips on each ring's inner edge so the drops read clearly
    for (const [ring, a0, a1] of [[H.high, 100.5, 349.5], [H.mid, 100.5, MIDW.a0], [H.mid, MIDW.a1, 349.5], [{r0: MIDW.r0, y: H.mid.y}, MIDW.a0, MIDW.a1]]) {
      const st = []; for (let a = a0; a <= a1 + .01; a += 3) { const i = polar(a, ring.r0 - .02), o = polar(a, ring.r0 + .28); st.push({l: [i[0], ring.y + .03, i[1]], r: [o[0], ring.y + .03, o[1]], b: ring.y - .12}); }
      const g = B.stripGeo(st); B.add(g.top, 'heartwoodLight'); B.add(g.sides, 'heartwood');
    }
    // lantern chains hanging from the dome at the back of the well
    for (const a of [182, 300]) {
      const y = galY(a) + 2.3, wallP = at(a, H.gallery.r1 - .05, y + .35), lp = at(a, H.gallery.r1 - .75, y);
      B.add(bevelBox(T, .34, .5, .18, .05).rotateY(a * DEG).translate(...at(a, H.gallery.r1 - .12, y + .35)), 'heartwood');
      B.add(rod(T, wallP, [lp[0], lp[1] + .33 * 1.1, lp[2]], .035, 4), 'copper');
      life.lantern('hollow', lp[0], lp[1], lp[2], 1.1);
    }
  }

  // ================================================================================
  // GUST SOURCES: copper breath spouts fed by trunk pipes (the quest spawns catchable gusts at
  // the stand point in front of each). Plus the seed wheel's outlet through the gate wall.
  // ================================================================================
  const breathSpout = (bin, base, face, climb = 3.2) => {
    B.block(bin);
    const [x, y, z] = base, d = polar(face, 1);
    B.add(new T.CylinderGeometry(.2, .26, 1.1, 8).translate(x, y + .55, z), 'verdigris');
    const m = new T.LatheGeometry([[.18, 0], [.22, .14], [.4, .34], [.48, .38]].map(([a, b]) => new T.Vector2(a, b)), 12);
    m.rotateX(Math.PI / 2); m.rotateY(face * DEG); m.translate(x + d[0] * .15, y + 1.05, z + d[1] * .15); B.add(m, 'copper');
    B.add(new T.TorusGeometry(.27, .06, 5, 12).rotateX(Math.PI / 2).translate(x, y + .75, z), 'copper');
    // fed from below: the riser drops through a bolted floor flange into the deck (no pipe across the air)
    void climb; B.add(new T.CylinderGeometry(.42, .46, .08, 10).translate(x, y + .04, z), 'copper');
    for (let k = 0; k < 6; k++) { const [bx, bz] = polar(k * 60, .36); B.add(new T.SphereGeometry(.04, 5, 3).translate(x + bx, y + .09, z + bz), 'verdigris'); }
    B.add(new T.CylinderGeometry(.16, .16, 1.4, 8).translate(x, y - .7, z), 'verdigris');
    gm.addCircle({id: 'spout-' + bin, x, z, r: .3, y0: y, y1: y + 1.4});
    return [x + d[0] * 1.1, y, z + d[1] * 1.1];
  };
  // loft pipe (feeds wheel A of the Mill of Pipes)
  const loftGustP = breathSpout('loft', at(-99.8, 14.1, LOFT.y), -99.8);
  // Mill of Sails branch pipe (to push the hanging bridge / give the mill)
  const sailsGustP = (() => { const p = at(-111.2, 25.4, 0); const g = gm.ground(p[0], p[2], 7); const L = sailsA; const i = L.reduce((bi, q, k) => (Math.hypot(q[0] - p[0], q[2] - p[2]) < Math.hypot(L[bi][0] - p[0], L[bi][2] - p[2]) ? k : bi), 0); const a = L[Math.max(0, i - 1)], b = L[Math.min(L.length - 1, i + 1)], tx = b[0] - a[0], tz = b[2] - a[2], n = Math.hypot(tx, tz); const side = -1; const base = [L[i][0] - tz / n * 1.05 * side, L[i][1], L[i][2] + tx / n * 1.05 * side]; void g; return breathSpout('sails', base, Math.atan2(-(- tz / n * side), -(tx / n * side)) / DEG, 2.5); })();
  // ladders: one pipe per ledge, each feeding the next vent
  const ladGustP = [breathSpout('terrace', at(-20.5, 16.2, 0), -20.5 + 180 - 180), breathSpout('ladders', at(-12.6, 16.1, L0.y), -12.6), breathSpout('ladders', at(-1.5, 15.9, L1.y), -1.5)];
  // seed wheel outlet: a pipe from the wheel through the gate wall to a spout in the yard
  const seedOutletP = (() => {
    B.block('terrace');
    const sw = wheels.find((w) => w.id === 'seedWheel'), sp = at(-89.6, 16.2, 0), mid = at(-86, 15.6, 0);
    B.add(taperTube(T, [[sw.x, 1.35, sw.z], [sw.x * .98 + mid[0] * .02, .5, sw.z], [mid[0], .45, mid[2]], [sp[0], .45, sp[2]]], .14, .14, 14, 6, 0, 3), 'verdigris');
    const m = new T.LatheGeometry([[.18, 0], [.22, .14], [.4, .34], [.48, .38]].map(([a, b]) => new T.Vector2(a, b)), 12);
    m.rotateX(Math.PI / 2); m.rotateY((-89.6) * DEG); m.translate(sp[0], .9, sp[2]); B.add(m, 'copper');
    B.add(new T.CylinderGeometry(.2, .26, 1, 8).translate(sp[0], .5, sp[2]), 'verdigris');
    gm.addCircle({id: 'seed-outlet', x: sp[0], z: sp[2], r: .3, y0: 0, y1: 1.3});
    return at(-89.6, 17.5, 0);
  })();

  // gallery gust source for the carvings (a breath spout on the gallery wall near its top)
  const galSrcP = (() => { const base = at(118, H.gallery.r1 - .35, galY(118)); return breathSpout('hollow', base, 118 + 180, 2.5); })();
  // ---- Fragment 1: a shrine ledge on the bole above the terrace, reached by an optional vent ----
  B.block('terrace');
  const F1 = {a0: -36, a1: -26, r0: 12.95, r1: 15.8, y: 4.6};
  B.deckAnnulus('fragment1-ledge', {r0: F1.r0, r1: F1.r1, a0: F1.a0, a1: F1.a1, y0: F1.y, th: .5, mat: 'deck', side: 'timberDark', step: 2});
  B.rail('frag1-w', [at(F1.a0 + .3, 13.4, F1.y), at(F1.a0 + .3, F1.r1 - .12, F1.y)]);
  B.rail('frag1-e', [at(F1.a1 - .3, 13.4, F1.y), at(F1.a1 - .3, F1.r1 - .12, F1.y)]);
  for (const a of [F1.a0 + 1.5, F1.a1 - 1.5]) B.add(beam(T, at(a, F1.r1 - .4, F1.y - .5), at(a, 13.3, F1.y - 3), .26, .26), 'timberDark');
  vent('frag1', at(-31, 16.85, 0), F1.y, 'terrace', {to: 'fragment1-ledge', optional: true});
  // shrine niche (stone arch in the bark, dark recess, glinting bell shard, lantern, carving)
  const shrine = (x, y, z, face, seed) => {
    const f = polar(face, 1), side = [f[1], -f[0]];
    B.add(bevelBox(T, 1.5, 2.1, .5).rotateY(face * DEG).translate(x, y + 1.05, z), 'stoneShade');
    // a wayside niche (raised sill, round-headed alcove), not a door: it never reaches the floor
    // shallow stone niche: pale grey-green stone back, a stone cill and head (no dark door-like panel)
    B.add(new T.PlaneGeometry(.9, .85).rotateY(face * DEG).translate(x + f[0] * .26, y + 1.12, z + f[1] * .26), 'stoneCool');
    B.add(new T.CircleGeometry(.45, 12, 0, Math.PI).rotateY(face * DEG).translate(x + f[0] * .26, y + 1.545, z + f[1] * .26), 'stoneCool');
    for (const sd of [-1, 1]) B.add(bevelBox(T, .12, .95, .14).rotateY(face * DEG).translate(x + f[0] * .3 + side[0] * sd * .47, y + 1.13, z + f[1] * .3 + side[1] * sd * .47), 'stone');
    B.add(new T.TorusGeometry(.5, .09, 5, 12, Math.PI).rotateY(face * DEG).translate(x + f[0] * .27, y + 1.545, z + f[1] * .27), 'stone');
    B.add(bevelBox(T, 1.15, .12, .22).rotateY(face * DEG).translate(x + f[0] * .32, y + .66, z + f[1] * .32), 'stone');
    // the shard: a broken bell lip, bright copper, tilted so it catches the light
    const shard = new T.LatheGeometry([[.18, 0], [.26, -.18], [.36, -.34], [.34, -.38]].map(([a, b]) => new T.Vector2(a, b)), 8, 0, Math.PI * .8);
    shard.rotateZ(.5); shard.rotateY(face * DEG + seed); shard.translate(x + f[0] * .45, y + 1.15, z + f[1] * .45); B.add(shard, 'copper');
    B.add(new T.CylinderGeometry(.22, .26, .5, 8).translate(x + f[0] * .5, y + .25, z + f[1] * .5), 'stone');
    life.lantern('finale', x + f[0] * .5 + side[0] * .9, y + 1.9, z + f[1] * .5 + side[1] * .9, .9);
    B.add(rod(T, [x + f[0] * .3 + side[0] * .9, y + 2.4, z + f[1] * .3 + side[1] * .9], [x + f[0] * .5 + side[0] * .9, y + 2.15, z + f[1] * .5 + side[1] * .9], .02, 4), 'copper');
    // small carving: paired bells in relief beside the niche
    for (const s of [-1, 1]) B.add(new T.LatheGeometry([[0, 0], [.07, -.01], [.09, -.1], [.12, -.2], [0, -.19]].reverse().map(([u, v]) => new T.Vector2(u, v)), 6).translate(x - side[0] * (.95 + s * .15) + f[0] * .28, y + 1.5 + s * .1, z - side[1] * (.95 + s * .15) + f[1] * .28), 'verdigris');
    gm.addCircle({id: 'shrine', x: x + f[0] * .1, z: z + f[1] * .1, r: .55, y0: y, y1: y + 2.2});
    return V([x + f[0] * 1.3, y, z + f[1] * 1.3]);
  };
  const sh1 = at(-31, 13.25, F1.y); const frag1Stand = shrine(sh1[0], F1.y, sh1[2], -31, 1);
  B.block('sails'); const sh2 = [frag2C[0] + polar(-104, 1.2)[0], f2y, frag2C[1] + polar(-104, 1.2)[1]]; const frag2Stand = shrine(sh2[0], f2y, sh2[2], -104 + 180, 2);
  // Glint over the fragment 2 shrine, readable from the little sail: a bright pulsing sparkle (one Points sprite,
  // natural light rather than a cel object: no pole, no outline) above the shrine's lip, plus a faint soft light beam.
  { const fo = polar(-104 + 180, 1), gx = sh2[0] + fo[0] * .95, gz = sh2[2] + fo[1] * .95, gy = f2y + 2.05;
    B.add(new T.CylinderGeometry(.22, .5, 7, 12, 1, true).translate(gx, gy + 3.55, gz), 'shaft');
    const gGeo = new T.BufferGeometry(); gGeo.setAttribute('position', new T.Float32BufferAttribute([gx, gy, gz], 3));
    const gMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } }, blending: T.CustomBlending, blendSrc: T.SrcAlphaFactor, blendDst: T.OneMinusSrcAlphaFactor, blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor,
      vertexShader: `uniform float uTime; varying float vP; void main() { vP = .5 + .5 * sin( uTime * 3.1 ); vec4 mv = modelViewMatrix * vec4( position, 1. );
        gl_PointSize = clamp( 3800. / max( 1., - mv.z ), 30., 200. ) * ( .8 + .3 * vP ); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; varying float vP; void main() { vec2 p = gl_PointCoord - .5; float d = length( p ), r = uTime * .35;
        vec2 q = mat2( cos( r ), -sin( r ), sin( r ), cos( r ) ) * p;
        float rays = exp( -abs( q.x ) * 70. ) * exp( -abs( q.y ) * 5.5 ) + exp( -abs( q.y ) * 70. ) * exp( -abs( q.x ) * 5.5 );
        vec2 q2 = mat2( .7071, -.7071, .7071, .7071 ) * q; float diag = ( exp( -abs( q2.x ) * 90. ) * exp( -abs( q2.y ) * 11. ) + exp( -abs( q2.y ) * 90. ) * exp( -abs( q2.x ) * 11. ) ) * ( .35 + .5 * vP );
        float core = exp( -d * d * 220. ), halo = exp( -d * d * 20. ) * ( .5 + .3 * vP );
        float a = clamp( rays * ( .75 + .35 * vP ) + diag + core * 1.4 + halo, 0., 1.6 ) * smoothstep( .5, .38, d );
        vec3 col = mix( vec3( .96, .58, .12 ), vec3( 1., .97, .84 ), clamp( core * 1.7, 0., 1. ) );   // gold rays and halo, white-hot core
        gl_FragColor = vec4( col, min( a, 1. ) ); }` });
    gMat.name = 'fx-frag2-glint'; gMat.userData.look = false;
    const glint = new T.Points(gGeo, gMat); glint.name = 'bh-frag2-glint'; glint.renderOrder = 11; glint.frustumCulled = false; glint.userData.noOutline = true; glint.userData.decoration = true;
    glint.onBeforeRender = () => { gMat.uniforms.uTime.value = performance.now() / 1000; };
    root.add(glint); }
  leafClump(T, B, ...[frag2C[0] + polar(-40, 1.25)[0], f2y + .7, frag2C[1] + polar(-40, 1.25)[1]], .55, 41); leafClump(T, B, ...[frag2C[0] + polar(-170, 1.25)[0], f2y + .7, frag2C[1] + polar(-170, 1.25)[1]], .55, 42);
  B.block('pipes'); const f3o = [f3d[0], f3d[1]]; const sh3 = [frag3C[0] + f3o[0] * .9, P1y, frag3C[1] + f3o[1] * .9]; const frag3Stand = shrine(sh3[0], P1y, sh3[2], Math.atan2(-f3o[0], -f3o[1]) / DEG, 3);

  // ================================================================================
  // LIFE (frozen -> alive): pinwheels, bunting, laundry, lantern strings
  // ================================================================================
  B.block('terrace');
  // bunting along the outer rim, sagging between rail posts
  for (let a = T_A1 - 2; a - 9 >= T_A0 + 1; a -= 9) {
    const p = at(a, rOut(a) - .3, .91), q = at(a - 9, rOut(a - 9) - .3, .91);
    life.bunting('terrace', V(p), V(q), .5, 7);
  }
  // high lantern strings: perched houses down to the street lamps (vertical village links)
  const perchDeck = (az) => { const h = houseParts.find((hh) => hh.perched && hh.az === az); return V(at(h.az, h.r + 3.1 - .15, h.y + .905)); };
  life.lanternString('terrace', perchDeck(-25), V([lanternPts[1][0], lanternPts[1][1] + .5, lanternPts[1][2]]), 1.2, 5);
  life.lanternString('terrace', perchDeck(-11.5), V([lanternPts[0][0], lanternPts[0][1] + .5, lanternPts[0][2]]), 1.2, 5);
  life.lanternString('terrace', perchDeck(-25), perchDeck(-11.5), .8, 3);
  life.bunting('terrace', perchDeck(-45), perchDeck(-25), 1.2, 8);
  life.lanternString('terrace', V(at(GATE.az, GATE.r1 + .3, 3.4)), V([lanternPts[4][0], lanternPts[4][1] + .5, lanternPts[4][2]]), .6, 3);
  // laundry: between the west-rim houses and across the yard
  const laundryPole = (p) => { const g = gm.ground(p[0], p[2], p[1]) ?? 0, h = p[1] - g; B.add(new T.CylinderGeometry(.06, .08, h + .12, 6).translate(p[0], g + (h + .12) / 2, p[2]), 'timberDark'); B.add(new T.BoxGeometry(.5, .07, .07).translate(p[0], p[1], p[2]), 'timberDark'); gm.addCircle({id: 'laundry-pole', x: p[0], z: p[2], r: .1, y0: g, y1: g + h}); return V([p[0], p[1] + .035, p[2]]); };
  const lineOn = (area, a, b, n) => life.laundry(area, laundryPole(a), laundryPole(b), n);
  lineOn('terrace', at(-58.5, 24.2, 3.3), at(-65.5, 24.1, 3.4), 4);
  lineOn('terrace', at(-88.5, 14.2, 3.2), at(-97.5, 16.5, 3.5), 4);
  // pinwheels on the rim and on planters
  for (let a = T_A1 - 6; a > T_A0 + 4; a -= 11) { const p = at(a, rOut(a) - .3, 0); life.pinwheel('terrace', p[0], 1.9, p[2], a * DEG, .45); B.add(new T.CylinderGeometry(.03, .03, 1, 5).translate(p[0], 1.4, p[2]), 'timberDark'); }
  for (const [az, r] of [[-15, 25.6], [-27, 26], [-38.5, 26.4], [-50, 26.6], [-63, 21.8]]) { const p = at(az + .8, r, 0); life.pinwheel('terrace', p[0], 1.9, p[2], (az + 180) * DEG, .35); B.add(new T.CylinderGeometry(.03, .03, 1.3, 5).translate(p[0], 1.2, p[2]), 'timberDark'); }
  // flags on the branches and mills
  for (const [pts, area] of [[sailsA, 'sails'], [pipesBr, 'pipes']]) {
    for (let i = 3; i < pts.length; i += 6) { const p = pts[i]; life.flag(area, p[0], p[1] + 2.4, p[2], .8); }
  }
  // life on the branches: pennants along the rails, lantern strings between ledges, laundry
  const bunt = (pts, area, side = 1, step = 4) => { for (let i = step * 2; i < pts.length - step - 1; i += step) { const a = pts[i - step], b = pts[i]; const nx = -(b[2] - a[2]), nz = b[0] - a[0], L = Math.hypot(nx, nz) || 1; const o = (p) => V([p[0] + nx / L * 1.38 * side, p[1] + .9, p[2] + nz / L * 1.38 * side]); life.bunting(area, o(a), o(b), .35, 5); } };
  bunt(sailsA, 'sails'); bunt(sailsB, 'sails', -1); bunt(pipesBr, 'pipes', -1);
  lineOn('pipes', [P1[0] - dt[0] * 3.3 - du[0] * .6, P1y + 2.2, P1[1] - dt[1] * 3.3 - du[1] * .6], [P1[0] - dt[0] * 2.4 + du[0] * 2.4, P1y + 2.3, P1[1] - dt[1] * 2.4 + du[1] * 2.4], 4);
  // lantern strings between the ledges' copper hanging rods (points exactly on the rods)
  const onRod = (L, a, f) => { const o = at(a, L.r1 - .4, L.y + .1), t = at(a, trunkR(L.y + 7) + .2, L.y + 7); return V([o[0] + (t[0] - o[0]) * f, o[1] + (t[1] - o[1]) * f, o[2] + (t[2] - o[2]) * f]); };
  life.lanternString('ladders', onRod(L0, L0.a1 - 1.5, .3), onRod(L1, L1.a0 + 1.5, .12), .5, 2);
  life.lanternString('ladders', onRod(L1, L1.a1 - 1.5, .3), onRod(L2, L2.a0 + 1.5, .12), .5, 2);
  // lantern chains on the trunk (one per mill; lit when that mill is restored)
  for (const [area, a0, a1, y] of [['sails', -165, -115, 22.6], ['pipes', -105, -55, 22.6], ['ladders', 95, 160, 22.6]]) {
    const pts = []; for (let a = a0; a <= a1; a += 5) pts.push(V(at(a, trunkR(y) + .8, y - 1.4 * Math.sin(((a - a0) / 5 % 2) * Math.PI / 2))));
    for (const p of pts) { const a = Math.atan2(p.x, p.z) / DEG; B.add(rod(T, at(a, trunkR(p.y) - .4, p.y + .15), p.toArray(), .035, 4), 'copper'); }
    for (let i = 1; i < pts.length; i++) life.lanternString(area, pts[i - 1], pts[i], .7, 1);
  }

  // ================================================================================
  // BACKDROP: valley, mist, far bell tower
  // ================================================================================
  const farBell = buildBackdrop(T, B, root, {bellTower, place});

  // ---- bake --------------------------------------------------------------------------
  B.flushRails();
  const blocks = B.bakeAll();
  for (const b of Object.values(blocks)) for (const m of b.children) if (/(far|mist)$/.test(m.name)) { m.castShadow = false; }
  life.finish();

  // ================================================================================
  // NAMED POINTS
  // ================================================================================
  const G = (p, yHint = p[1]) => { const y = gm.ground(p[0], p[2], yHint + .2); return new T.Vector3(p[0], y ?? p[1], p[2]); };
  const Pt = (az, r, yHint) => G(at(az, r, yHint), yHint);
  const [sw] = [wheels.find((w) => w.id === 'seedWheel')];
  const points = {
    start: Pt(-23, 20.3, 0),
    morningBell: Pt(bellAz, 16.7, PLZ.y),
    morningBellObject: V(at(bellAz, bellR, PLZ.y + 2.4)),
    maraLever: Pt(-79.6, 21.8, 0),
    maraLeverObject: V([leverP[0], 1.4, leverP[2]]),
    maraOutlet: Pt(-71.2, 21.7, 0),
    maraOutletMouth: V([outletP[0], .9, outletP[2]]),
    maraStand: Pt(-77, 22.2, 0),
    seedWheel: Pt(-81.8, 18.1, 0),
    seedWheelObject: V([sw.x, sw.y, sw.z]),
    terraceGate: Pt(GATE.az, (GATE.r0 + GATE.r1) / 2, 0),
    terraceGateInside: Pt(GATE.az - 3.5, 20, 0),
    loftVent: G(loftVentP, 0),
    loftLedge: Pt(-99.5, 20.5, LOFT.y),
    loftView: Pt(-106, 21, LOFT.y),
    sails: {
      branchStart: Pt(SAILS_START, 22.6, LOFT.y), source: G(sailsGustP),
      bridgePush: G([sgA[0] - (sgB[0] - sgA[0]) * .25, sgA[1], sgA[2] - (sgB[2] - sgA[2]) * .25]), bridgeSail: sailBridge.sailWorld,
      bridgeFrom: G(sgA), bridgeTo: G(sgB), resetLever: sailBridge.leverWorld,
      restore: G([sailsMillC[0] - polar(-116.6, 1)[0] * 2.4, sailsMillY, sailsMillC[1] - polar(-116.6, 1)[1] * 2.4]),
      mill: sailsMill.hub,
      // pose 0: the cap is turned a quarter away, its tail sail out to the side (not towards the camera)
      capTarget: V([sailsMill.tower.x - Math.cos(sailsMill.yaw) * 4.4, sailsMill.capY - 1.45, sailsMill.tower.z + Math.sin(sailsMill.yaw) * 4.4]),
      capSail: G([sailsMill.tower.x - Math.cos(sailsMill.yaw) * 3.1, sailsMillY, sailsMill.tower.z + Math.sin(sailsMill.yaw) * 3.1]),
      capPath: (() => { const tw = sailsMill.tower, rs = [sailsMillC[0] - polar(-116.6, 1)[0] * 2.4 - tw.x, sailsMillC[1] - polar(-116.6, 1)[1] * 2.4 - tw.z], cs = [-Math.cos(sailsMill.yaw), Math.sin(sailsMill.yaw)]; const nr = Math.hypot(...rs), m = [rs[0] / nr + cs[0], rs[1] / nr + cs[1]], nm = Math.hypot(...m) || 1; return [G([tw.x + m[0] / nm * 3.1, sailsMillY, tw.z + m[1] / nm * 3.1])]; })(),
      frag2Sail: frag2Bridge.sailWorld, frag2From: G(f2a), frag2To: G(f2b),
    },
    pipes: {
      branchStart: Pt(PIPES_START, 22.6, LOFT.y), source: G(loftGustP),
      wheelA: G(Pl(2.1, -.8)), wheelAObject: V([w1P[0], P1y + 1.35, w1P[2]]),
      gapFrom: G(Pl(0, P1r - .7)), gapTo: G(Il(0, -ISLr + .8)), outletA: G(Il(-.8, -2.2)),
      wheelB: G(Il(2.2, -1.2)), wheelBObject: V([w2P[0], P1y + 1.35, w2P[2]]), outletB: G(Il(-3.4, 1.4)),
      restore: G(Il(-.6, -1.9)), mill: pipesMill.hub,
      valve: G(Pl(.2, 1.95)), valveObject: V([valveP[0], P1y + 1.3, valveP[2]]), outletWrong: V([wrongP[0] + dt[0] * 1.1, P1y + .7, wrongP[2] + dt[1] * 1.1]),
      frag3From: G([ISL[0] + f3d[0] * (ISLr - .7), P1y, ISL[1] + f3d[1] * (ISLr - .7)]),
      frag3To: G([frag3C[0] - f3d[0] * (F3r - .6), P1y, frag3C[1] - f3d[1] * (F3r - .6)]),
      frag3Path: [Il(-.6, -1.9), Il(-3.2, -.3), [ISL[0] + f3d[0] * (ISLr - .7), P1y, ISL[1] + f3d[1] * (ISLr - .7)]].map((p) => G(p)),
      path: [...pipesBr.filter((_, i) => i % 3 === 1), Pl(0, -2.8), Pl(2.1, -.8), Pl(0, 0), Pl(0, P1r - .7)].map((p) => G(p)),
      islandPath: [Il(0, -ISLr + .8), Il(-.8, -2.2), Il(1.2, -2.4), Il(2.2, -1.2), Il(-.6, -1.9), Il(-3.2, -1.2), Il(-3.4, 1.4)].map((p) => G(p)),
    },
    ladders: {
      vent0: G(at(-16.6, 17.6, 0), 0), ledge0: Pt(-12, 17.6, L0.y),
      vent1: G(at(-8.6, 17.6, L0.y), L0.y), ledge1: Pt(-3.8, 17.6, L1.y),
      vent2: G(at(2.3, 17.6, L1.y), L1.y), shutter: V(at(2.3, 16.55, L1.y + .1)), shutterLever: Pt(5, 16.3, L1.y),
      ledge2: Pt(8, 17.6, L2.y), restore: G([ladMillC[0] + .615 * 1.4, ladMillY, ladMillC[1] + .788 * 1.4]), mill: ladMill.hub,
      path: [at(8, 17.6, L2.y), at(16.5, 18.6, L2.y), [ladMillC[0] - 1.8, L2.y, ladMillC[1] + 2.9], [ladMillC[0] + .615 * 1.4, L2.y, ladMillC[1] + .788 * 1.4]].map((p) => G(p)),
      gusts: [G(ladGustP[0]), G(ladGustP[1]), G(ladGustP[2])],
    },
    fragment1: G([frag1Stand.x, F1.y, frag1Stand.z]), fragment2: G([frag2Stand.x, f2y, frag2Stand.z]), fragment3: G([frag3Stand.x, P1y, frag3Stand.z]),
    bridge: {start: Pt(SB.a0 - 2.5, SB.r, 0), end: Pt(SB.a1 + 3, SB.r, SB.y1), stages: sbStages.map(({k, from, to, mid}) => ({k, from, to, mid}))},
    hollowGate: Pt(93, HG.r + 2.2, LND.y),
    hollowGateInside: Pt(96, 10.4, LND.y),
    gallery: {source: G(galSrcP), carvings: carvings.map((c) => ({id: c.id, stand: G([c.stand.x, c.stand.y, c.stand.z]), panel: c.panel, intake: c.intake})), returnChannel, top: Pt(104, 10.4, 4), bottom: Pt(338, 10.4, -4)},
    guardianWell: {
      centre: new T.Vector3(0, H.low.y, 0), hover: new T.Vector3(0, H.low.y + 1, 0),
      rings: {
        low: {y: H.low.y, centre: new T.Vector3(0, H.low.y, 0), r0: 0, r1: H.floorFront, safe: Pt(40, 8.5, H.low.y), vane: vanes.low, vent: ringVents.low, catchPoint: Pt(150, 2, H.low.y)},
        mid: {y: H.mid.y, centre: new T.Vector3(0, H.mid.y, 0), r0: H.mid.r0, r1: H.mid.r1, safe: Pt(130, 5.6, H.mid.y), vane: vanes.mid, vent: ringVents.mid, catchPoint: Pt(245, 5.6, H.mid.y)},
        high: {y: H.high.y, centre: new T.Vector3(0, H.high.y, 0), r0: H.high.r0, r1: H.high.r1, safe: Pt(250, 8, H.high.y), vane: vanes.high, vent: ringVents.high, catchPoint: Pt(275, 8, H.high.y)},
        top: Object.assign(Pt(204, 8, .5), {safe: Pt(200, 8, .5), vane: vanes.top, vaneStand: G([vanes.top.stand.x, vanes.top.stand.y, vanes.top.stand.z]), vent: null, a0: 190, a1: 212, r0: 6.9, r1: 9.15}),
      },
    },
    pairedBells,
    terraceView: {pos: new T.Vector3(...at(-12, 37, 8.5)), target: new T.Vector3(...at(-78, 27, 3)), maraStand: Pt(-77, 22.2, 0)},
    finaleRise: {from: new T.Vector3(0, -10, 6), to: new T.Vector3(20, 38, 42), lookAt: new T.Vector3(0, 8, 0)},
    farBell,
  };
  for (const k of ['low', 'mid', 'high']) points.guardianWell.rings[k].vaneStand = G([vanes[k].stand.x, vanes[k].stand.y, vanes[k].stand.z]);
  // ---- flat anchors in the quest.js contract (REQUIRED_POINTS) ----
  const RW = points.guardianWell.rings;
  Object.assign(points, {
    mara: points.maraStand, seedOutlet: G(seedOutletP), loft: points.loftLedge, loftGust: points.pipes.source,
    sailsGust: points.sails.millGust, sailsSource: points.sails.source, laddersGust1: points.ladders.gusts[0], laddersGust2: points.ladders.gusts[1], laddersGust3: points.ladders.gusts[2],
    millSails: points.sails.restore, millPipes: points.pipes.restore, millLadders: points.ladders.restore,
    skyBridge: points.bridge.start, carvingOut: points.gallery.carvings[0].stand, carvingReturn: points.gallery.carvings[1].stand,
    arena: RW.low.centre, guardian: new T.Vector3(0, H.low.y + 3, 0),
    vane1: G([vanes.low.x, vanes.low.y, vanes.low.z]), vane2: G([vanes.mid.x, vanes.mid.y, vanes.mid.z]), vane3: G([vanes.high.x, vanes.high.y, vanes.high.z]),
    ring1: RW.low.safe, ring2: RW.mid.safe, ring3: RW.high.safe,
    bellOut: Pt(229, 7.5, H.high.y), bellReturn: Pt(221, 7.5, H.high.y),
    finale: new T.Vector3(0, -2, 0), finaleSpot: Pt(-65.5, 20.4, 0),
  });
  // the gust that 'spills out by the mill' after the bridge swings: on the mill deck, 1.6 m from the
  // restore stand toward the bridge landing (landing -> gust < 10 m, no walking back over the bridge)
  { const r = points.sails.restore, b = points.sails.bridgeTo, L = Math.hypot(b.x - r.x, b.z - r.z), x = r.x + (b.x - r.x) / L * 1.6, z = r.z + (b.z - r.z) / L * 1.6;
    points.sails.millGust = G([x, r.y, z]); points.sailsGust = points.sails.millGust;
    const sx = r.x + (b.x - r.x) / L * .75, sz = r.z + (b.z - r.z) / L * .75, m = new T.LatheGeometry([[.16, 0], [.2, .12], [.34, .3], [.4, .34]].map(([u, v]) => new T.Vector2(u, v)), 12);
    m.rotateX(Math.PI / 2); m.rotateY(Math.atan2(x - sx, z - sz)); m.translate(sx, r.y + .35, sz); B.block('sails'); B.add(m, 'copper'); B.add(new T.CylinderGeometry(.12, .16, .35, 8).translate(sx, r.y + .17, sz), 'verdigris'); }
  // quest wheel/sail records
  const wheelRec = (id, p, outlet) => ({id, x: p.x, y: p.y, z: p.z, ...(outlet ? {outlet: {x: outlet.x, y: outlet.y, z: outlet.z, radius: 1.3}} : {})});
  const W0 = Object.fromEntries(wheels.map((w) => [w.id, w]));
  const questWheels = [
    wheelRec('seed', G([W0.seedWheel.x, 0, W0.seedWheel.z]), points.seedOutlet),
    wheelRec('pipesA', G([W0.pipesWheel1.x, P1y, W0.pipesWheel1.z]), points.pipes.outletA),
    wheelRec('pipesB', G([W0.pipesWheel2.x, P1y, W0.pipesWheel2.z]), points.pipes.outletB),
    wheelRec('millSails', sailsMill.tower), wheelRec('millPipes', pipesMill.tower), wheelRec('millLadders', ladMill.tower),
  ];
  wheels.length = 0; wheels.push(...questWheels);
  const ledgeFor = {loft: points.loftLedge, ladders1: points.ladders.ledge0, ladders2: points.ladders.ledge1, ladders3: points.ladders.ledge2, ring1: G(at(111, 5.6, H.mid.y)), ring2: G(at(280, 7.6, H.high.y)), ring3: G(at(193, 8, .5)), frag1: G(at(-31, 14.6, 4.6))};
  for (const v of vents) { const l = ledgeFor[v.id]; if (l) v.ledge = {x: l.x, y: l.y, z: l.z}; }
  const questSails = [
    {id: 'sailsBridge', kind: 'bridge', x: sailBridge.sailWorld.x, y: sailBridge.from.y, z: sailBridge.sailWorld.z, lever: {x: sailBridge.leverWorld.x, y: sailBridge.leverWorld.y, z: sailBridge.leverWorld.z}},
    {id: 'frag2', kind: 'bridge', x: frag2Bridge.sailWorld.x, y: frag2Bridge.from.y, z: frag2Bridge.sailWorld.z, optional: true},
    {id: 'laddersShutter', kind: 'shutter', x: points.ladders.vent2.x, y: points.ladders.vent2.y, z: points.ladders.vent2.z, vent: 'ladders3', hold: 8},
  ];
  sails.length = 0; sails.push(...questSails);

  // Zones: coarse areas for audio/lighting/camera (point-in-zone by az/r/y band).
  zones.push(
    {id: 'terrace', test: (x, y, z) => y < 3 && y > -2 && inAz(x, z, T_A0 - 2, T_A1 + 2) && Math.hypot(x, z) < 31},
    {id: 'loft', test: (x, y, z) => y >= 3 && y < 8 && inAz(x, z, LOFT.a0, LOFT.a1) && Math.hypot(x, z) < 23},
    {id: 'sails', test: (x, y, z) => inAz(x, z, -125, -100) && Math.hypot(x, z) >= 22 && y > 3},
    {id: 'pipes', test: (x, y, z) => inAz(x, z, -100, -80) && Math.hypot(x, z) >= 22 && y > 3},
    {id: 'ladders', test: (x, y, z) => y >= 4.4 && (inAz(x, z, -15, 34) && Math.hypot(x, z) > 14.5 && Math.hypot(x, z) < 27)},
    {id: 'skybridge', test: (x, y, z) => y >= -1 && y < 5 && inAz(x, z, -8, 86) && Math.abs(Math.hypot(x, z) - SB.r) < 1.6},
    {id: 'hollow', test: (x, y, z) => Math.hypot(x, z) < 13 && y < 8 && y > -4.5},
    {id: 'well', test: (x, y, z) => Math.hypot(x, z) < 13.5 && y <= -4.5},
  );
  function inAz(x, z, a0, a1) { const a = Math.atan2(x, z) / DEG; return a >= a0 && a <= a1; }
  const zoneAt = (x, y, z) => zones.find((zz) => zz.test(x, y, z))?.id ?? null;

  // ================================================================================
  // DYNAMIC PIECES
  // ================================================================================
  // Hanging bridge: deck swings about a vertical pivot at the A end.
  function hangingBridge(id, a, b, w, area, {lever: withLever = true, mast = 3.2} = {}) {
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
    const pivot = new T.Group(); pivot.position.set(a[0], a[1], a[2]); pivot.rotation.y = yaw; root.add(pivot);
    const bins = new Bins(T, id);
    // deck of planks in pivot-local space (+z along the span), slung .1 below the lip
    for (let k = 0; k < Math.floor(L / .42); k++) bins.add(bevelBox(T, w - .1, .14, .36, .03).translate(0, -.07, .25 + k * .42), 'deck');
    for (const sx of [-1, 1]) { bins.add(beam(T, [sx * (w / 2 - .05), -.12, 0], [sx * (w / 2 - .05), -.12, L], .12, .12), 'timberDark'); bins.add(beam(T, [sx * (w / 2 - .05), .85, 0], [sx * (w / 2 - .05), .85, L], .05, .05), 'timber'); for (let z = .6; z < L; z += 1.2) bins.add(rod(T, [sx * (w / 2 - .05), -.1, z], [sx * (w / 2 - .05), .85, z], .025, 4), 'timber'); }
    // mast + coral sail (the push target) mid-span
    bins.add(rod(T, [w / 2 - .1, 0, L * .5], [w / 2 - .1, Math.max(mast, 3.2), L * .5], .07, 6), 'timberDark');
    // square cloth sail bent to a top yard and a bottom boom (timber trim), bellied between them, with a darker hem
    const sx0 = w / 2 - .1, sz = L * .5, sy0 = 1.2, sy1 = 3.0;
    const sailG = new T.PlaneGeometry(1.4, sy1 - sy0, 6, 6); { const sp = sailG.attributes.position;
      for (let i = 0; i < sp.count; i++) { const fx = sp.getX(i) / 1.4 + .5, fy = sp.getY(i) / (sy1 - sy0) + .5; sp.setZ(i, Math.sin(fy * Math.PI) * (.12 + .2 * Math.sin(fx * Math.PI)) + .05 * Math.sin(fx * 7 + fy * 3)); } }
    sailG.computeVertexNormals(); sailG.rotateY(Math.PI / 2); sailG.translate(sx0, (sy0 + sy1) / 2, sz + .02);
    bins.add(sailG, 'cloth');
    const back = sailG.clone(); back.scale(-1, 1, 1); back.translate(2 * sx0, 0, 0); { const ix = back.index; if (ix) { const a = ix.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } } } back.computeVertexNormals(); bins.add(back, 'cloth');
    for (const y of [sy0, sy1]) bins.add(rod(T, [sx0, y, sz - .78], [sx0, y, sz + .78], y === sy1 ? .055 : .045, 6), 'timberDark');   // yard + boom
    for (const y of [sy0 + .06, sy1 - .06]) bins.add(new T.BoxGeometry(.03, .08, 1.4).translate(sx0 + .06, y, sz + .02), 'timber');   // hem bands
    const baked = bins.bake(pivot); void baked;
    // gantry at the A end (static): two posts and a beam; chains down to the deck ends (visual)
    const gl = at(0, 0, 0); void gl;
    const nx = Math.cos(yaw), nz = -Math.sin(yaw);
    // one short pivot post with a verdigris hinge collar (no tall gantry framing the foreground)
    { const px = a[0] + nx * (w / 2 + .35), pz = a[2] + nz * (w / 2 + .35); B.add(new T.CylinderGeometry(.16, .2, 1.3, 8).translate(px, a[1] + .65, pz), 'timberDark'); B.add(new T.TorusGeometry(.2, .06, 5, 12).rotateX(Math.PI / 2).translate(px, a[1] + .9, pz), 'verdigris'); B.add(new T.CylinderGeometry(.24, .28, .18, 8).translate(px, a[1] + 1.35, pz), 'copper'); gm.addCircle({id: id + '-post', x: px, z: pz, r: .24, y0: a[1], y1: a[1] + 1.45}); }

    // reset lever beside the gantry
    const lever = [a[0] - nx * (w / 2 + .5) - Math.sin(yaw) * 1.2, a[1], a[2] - nz * (w / 2 + .5) - Math.cos(yaw) * 1.2];
    if (withLever) {
    B.add(bevelBox(T, .5, .4, .5).translate(lever[0], lever[1] + .2, lever[2]), 'stoneShade'); B.add(rod(T, [lever[0], lever[1] + .4, lever[2]], [lever[0] + .2, lever[1] + 1.2, lever[2]], .05), 'copper');
    gm.addCircle({id: id + '-lever', x: lever[0], z: lever[2], r: .3, y0: a[1], y1: a[1] + 1.2});
    }
    // walkable only when in place
    const ok = () => dyn[id] >= .97;
    const pts = []; for (let k = 0; k <= 6; k++) pts.push([a[0] + (b[0] - a[0]) * k / 6, a[1] + (b[1] - a[1]) * k / 6, a[2] + (b[2] - a[2]) * k / 6]);
    gm.addSurface({id, type: 'ribbon', pts, w, enabled: ok, body: .3});
    for (const sx of [-1, 1]) gm.addSegment({id: id + '-rope', ax: a[0] + nx * sx * (w / 2 - .05), az: a[2] + nz * sx * (w / 2 - .05), bx: b[0] + nx * sx * (w / 2 - .05), bz: b[2] + nz * sx * (w / 2 - .05), ya: a[1], yb: b[1], h: .95, enabled: ok});
    chainBarrier(id + '-barrier-a', [a[0] + nx * (w / 2 + .3), a[1], a[2] + nz * (w / 2 + .3)], [a[0] - nx * (w / 2 + .3), a[1], a[2] - nz * (w / 2 + .3)], () => !ok(), -.35 * Math.sin(yaw), -.35 * Math.cos(yaw));
    chainBarrier(id + '-barrier-b', [b[0] + nx * (w / 2 + .3), b[1], b[2] + nz * (w / 2 + .3)], [b[0] - nx * (w / 2 + .3), b[1], b[2] - nz * (w / 2 + .3)], () => !ok(), .35 * Math.sin(yaw), .35 * Math.cos(yaw));
    // the mast + sail swing with the deck: a collider that follows the pivot pose (updated in update()), so the hero
    // can never stand inside the sail while it swings past the landing
    const sailCol = gm.addSegment({id: id + '-sail', ax: 0, az: 0, bx: 0, bz: 0, ya: a[1], yb: a[1], h: 3.1, t: .14});
    const poseSail = () => { const r = pivot.rotation.y, c = Math.cos(r), sn = Math.sin(r), sx = w / 2 - .1;
      const W = (lz) => [a[0] + sx * c + lz * sn, a[2] - sx * sn + lz * c]; [sailCol.ax, sailCol.az] = W(L * .5 - .75); [sailCol.bx, sailCol.bz] = W(L * .5 + .75); };
    poseSail();
    const rec = {id, kind: 'hanging', area, pivot, yaw, poseSail, from: V(a), to: V(b), sailWorld: V([a[0] + (b[0] - a[0]) * .5 + nx * (w / 2 - .1), a[1] + 2.1, a[2] + (b[2] - a[2]) * .5 + nz * (w / 2 - .1)]), leverWorld: V(lever), state: id};
    bridges.push(rec);
    return rec;
  }
  // Drawbridge: hinged at the island edge, stands upright when raised.
  function drawBridge(id, a, b, w, area) {
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), yaw = Math.atan2(a[0] - b[0], a[2] - b[2]);
    const pivot = new T.Group(); pivot.position.set(b[0], b[1], b[2]); pivot.rotation.y = yaw; root.add(pivot);
    const hinge = new T.Group(); pivot.add(hinge);
    const bins = new Bins(T, id);
    for (let k = 0; k < Math.floor(L / .42); k++) bins.add(bevelBox(T, w - .1, .16, .36, .03).translate(0, -.08, .2 + k * .42), 'deck');
    for (const sx of [-1, 1]) { bins.add(beam(T, [sx * (w / 2 - .06), -.14, 0], [sx * (w / 2 - .06), -.14, L], .14, .14), 'timberDark'); bins.add(beam(T, [sx * (w / 2 - .06), .85, .2], [sx * (w / 2 - .06), .85, L - .2], .06, .06), 'copper'); for (let z = .3; z < L; z += 1.2) bins.add(rod(T, [sx * (w / 2 - .06), -.1, z], [sx * (w / 2 - .06), .85, z], .03, 4), 'verdigris'); }
    bins.bake(hinge);
    // lift frame on the island: two copper posts + chain pulley
    const nx = Math.cos(yaw), nz = -Math.sin(yaw);
    for (const sx of [-1, 1]) { const px = b[0] + nx * sx * (w / 2 + .4), pz = b[2] + nz * sx * (w / 2 + .4); B.add(new T.CylinderGeometry(.18, .22, 5.6, 8).translate(px, b[1] + 2.8, pz), 'verdigris'); B.add(new T.SphereGeometry(.28, 8, 6).translate(px, b[1] + 5.7, pz), 'copper'); gm.addCircle({id: id + '-post', x: px, z: pz, r: .24, y0: b[1], y1: b[1] + 5.6}); }
    const ok = () => dyn[id] >= .97;
    const pts = []; for (let k = 0; k <= 4; k++) pts.push([a[0] + (b[0] - a[0]) * k / 4, a[1], a[2] + (b[2] - a[2]) * k / 4]);
    gm.addSurface({id, type: 'ribbon', pts, w, enabled: ok, body: .3});
    for (const sx of [-1, 1]) gm.addSegment({id: id + '-rail', ax: a[0] + nx * sx * (w / 2 - .06), az: a[2] + nz * sx * (w / 2 - .06), bx: b[0] + nx * sx * (w / 2 - .06), bz: b[2] + nz * sx * (w / 2 - .06), ya: a[1], yb: b[1], h: .95, enabled: ok});
    chainBarrier(id + '-barrier-a', [a[0] + nx * (w / 2 + .3), a[1], a[2] + nz * (w / 2 + .3)], [a[0] - nx * (w / 2 + .3), a[1], a[2] - nz * (w / 2 + .3)], () => !ok());
    const rec = {id, kind: 'draw', area, pivot, hinge, from: V(a), to: V(b), state: id};
    bridges.push(rec); return rec;
  }
  // Chain barrier across an edge that is only open when something is in place.
  function chainBarrier(id, p, q, when, ox = 0, oz = 0) {
    // A chain slung between two visible posts with eyelets: a sagging rope with close-set links.
    // Solid only once the hero is clear of it (never closes through the hero's body; see update()).
    const grp = new T.Group(); grp.name = 'bh-' + id; root.add(grp);
    const bins = new Bins(T, id), P0 = [p[0] + ox, p[1], p[2] + oz], Q0 = [q[0] + ox, q[1], q[2] + oz], top = .95;
    for (const e of [P0, Q0]) { bins.add(new T.CylinderGeometry(.1, .13, top + .1, 7).translate(e[0], e[1] + (top + .1) / 2, e[2]), 'verdigris'); bins.add(new T.SphereGeometry(.12, 7, 5).translate(e[0], e[1] + top + .1, e[2]), 'copper'); bins.add(new T.TorusGeometry(.06, .02, 4, 8).rotateY(Math.atan2(Q0[0] - P0[0], Q0[2] - P0[2])).translate(e[0], e[1] + top - .08, e[2]), 'copper'); }
    const L = Math.hypot(Q0[0] - P0[0], Q0[2] - P0[2]), n = Math.max(6, Math.ceil(L / .13)), yaw = Math.atan2(Q0[0] - P0[0], Q0[2] - P0[2]);
    const cat = (f) => [P0[0] + (Q0[0] - P0[0]) * f, P0[1] + (Q0[1] - P0[1]) * f + top - .08 - .22 * Math.sin(f * Math.PI), P0[2] + (Q0[2] - P0[2]) * f];
    for (let k = 0; k <= n; k++) { const f = k / n, c = cat(f), t = new T.TorusGeometry(.075, .022, 4, 8); t.rotateY(yaw + (k % 2) * Math.PI / 2 + Math.PI / 2); t.translate(...c); bins.add(t, 'copper'); }
    bins.bake(grp);
    const rec = {id, grp, when, solid: when(), a: P0, b: Q0};
    gm.addSegment({id, ax: P0[0], az: P0[2], bx: Q0[0], bz: Q0[2], ya: p[1], yb: q[1], h: .95, t: .1, enabled: () => rec.solid});
    life.hangers.push({kind: 'chain', note: id, pts: [[P0[0], P0[1] + top - .08, P0[2]], [Q0[0], Q0[1] + top - .08, Q0[2]]]});
    barriers.push(rec);
  }
  function returnVane(id, p, az, standSide = -1) {
    const pivot = new T.Group(); pivot.position.set(p[0], p[1], p[2]); root.add(pivot);
    B.add(new T.CylinderGeometry(.35, .45, .5, 8).translate(p[0], p[1] + .25, p[2]), 'stoneShade');
    B.add(new T.CylinderGeometry(.08, .08, 2.1, 6).translate(p[0], p[1] + 1.3, p[2]), 'copper');
    const rot = new T.Group(); rot.position.y = 2.1; pivot.add(rot);
    const bins = new Bins(T, id);
    for (const s of [-1, 1]) { const petal = new T.SphereGeometry(.55, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2); petal.scale(1, .25, 1.6); petal.rotateZ(s * Math.PI / 2); petal.translate(0, 0, s * .8); bins.add(petal, s < 0 ? 'verdigris' : 'copper'); }
    bins.add(new T.SphereGeometry(.18, 8, 6), 'copper');
    bins.bake(rot);
    gm.addCircle({id, x: p[0], z: p[2], r: .45, y0: p[1], y1: p[1] + 2.2});
    const out = polar(az, 1);
    const rec = {id, x: p[0], y: p[1], z: p[2], rotor: rot, target: V([p[0], p[1] + 2.1, p[2]]), stand: V([p[0] + standSide * out[0] * 1.3, p[1], p[2] + standSide * out[1] * 1.3])};
    movers.push({obj: rot, kind: 'vane', area: 'hollow', speed: 1.6, key: id});
    return rec;
  }
  function carving(i, p, az) {
    // stone slab with raised relief: bell (i even = outward phrase, odd = returning phrase),
    // two channels spiralling from it — the paired-bell story told in the wall.
    // carved INTO the wall: trunk.js cuts a chiselled recess for each carving; the relief sits on its sawn
    // heartwood floor (no applied slab or frame)
    const ry = az * DEG + Math.PI;
    p = at(az, carvingRecessR() - .02, carvingCentreY(az) - .05);
    const inward = [-Math.sin(az * DEG) * .06, 0, -Math.cos(az * DEG) * .06];   // toward the viewer: relief half-sunk into the recess floor
    const bellG = new T.LatheGeometry([[0, 0], [.12, -.02], [.15, -.14], [.18, -.3], [.26, -.44], [0, -.42]].reverse().map(([u, v]) => new T.Vector2(u, v)), 8);
    bellG.scale(1.3, 1.3, .55); bellG.rotateY(ry); bellG.translate(p[0] + inward[0], p[1] + .45, p[2] + inward[2]); B.add(bellG, 'plaster');   // warm ivory inlay: reads on the dark bark
    // Channel reliefs as their own mesh: they glow wind-cyan in sequence when the carving is
    // fed through its copper intake (state.restored['carving' + i], 0..1).
    const mat = Object.assign(new T.MeshStandardMaterial({color: 0xE2C58E, roughness: .7, emissive: PAL.wind, emissiveIntensity: 0}), {name: 'stone'});   // honey-ivory inlay until fed, then wind-cyan
    const geos = [];
    const lp = (lx, ly) => new T.Vector3(lx * Math.cos(ry) + p[0] + inward[0], p[1] + ly, -lx * Math.sin(ry) + p[2] + inward[2]);
    // the feed channel: from the intake mouth up the slab into the bell
    geos.push(new T.TubeGeometry(new T.CatmullRomCurve3([lp(0, -.82), lp(.07, -.6), lp(-.04, -.3), lp(0, .05)]), 10, .075, 5));
    for (const s of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 10; k++) { const f = k / 10, ang = f * Math.PI * 1.4 * s; const lx = s * (.22 + f * .55), ly = .2 - f * .35 + Math.sin(ang) * .12; pts.push(lp(lx, ly)); }   // stays inside the panel
      // outward phrase: both channels leave the bell; returning phrase: the second one comes back
      if (i % 2 && s > 0) pts.reverse();
      geos.push(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 12, .07, 5));
      const tip = pts[i % 2 && s > 0 ? 0 : pts.length - 1]; geos.push(new T.SphereGeometry(.09, 6, 4).translate(tip.x, tip.y, tip.z));
    }
    const bins = new Bins(T, 'carving-' + i); for (const g of geos) bins.add(g, mat);
    const grp = bins.bake(root); grp.name = 'bh-carving-glow-' + i;
    // copper intake mouth under the panel
    const mouthP = at(az, H.gallery.r1 - .45, p[1] - 1.15);
    const m = new T.LatheGeometry([[.16, 0], [.2, .1], [.36, .26], [.44, .3]].map(([a, b]) => new T.Vector2(a, b)), 12);
    m.rotateX(Math.PI / 2); m.rotateY(az * DEG + Math.PI); m.translate(mouthP[0], mouthP[1], mouthP[2]); B.add(m, 'copper');
    B.add(new T.TorusGeometry(.3, .05, 5, 12).rotateY(az * DEG + Math.PI / 2).translate(...at(az, H.gallery.r1 - .2, p[1] - 1.15)), 'verdigris');
    // the intake's pipe runs back into the bark (seated, not a ring floating in front of the wall)
    { const a0 = V(at(az, H.gallery.r1 - .42, p[1] - 1.15)), a1 = V(at(az, H.gallery.r1 + .45, p[1] - 1.15)), g = new T.CylinderGeometry(.19, .19, a0.distanceTo(a1), 10, 1, true);
      g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), a1.clone().sub(a0).normalize())); g.translate((a0.x + a1.x) / 2, (a0.y + a1.y) / 2, (a0.z + a1.z) / 2); B.add(g, 'copper');
      B.add(new T.TorusGeometry(.24, .06, 5, 12).rotateY(az * DEG + Math.PI / 2).translate(...at(az, H.gallery.r1 - .05, p[1] - 1.15)), 'verdigris'); }
    return mat;
  }
  function placeMill(variant, c, y, az) {
    // tower stands on the platform's outer half, sails facing the camera side (+z-ish)
    // sails/pipes: tower on the outer side (the camera sees past it); ladders sits on the
    // camera side of the trunk, so its tower goes to the far (north-west) side of its deck.
    const out = variant === 'ladders' ? [-.615, -.788] : polar(az, 1), off = variant === 'ladders' ? 1.5 : 1.0, pos = [c[0] + out[0] * off, y, c[1] + out[1] * off];
    const yaw = Math.atan2(.615, .788) + (variant === 'ladders' ? .2 : -.1);
    const g = windmill(T, {variant});
    const tw = g.userData.tower;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const ox = tw.x * cy + tw.z * sy, oz = -tw.x * sy + tw.z * cy; // tower offset rotated
    const px = pos[0] - ox, pz = pos[2] - oz;
    const {parts} = place(() => g, {id: 'mill-' + variant}, px, y, pz, yaw, {collide: null, moving: ['rotor', 'cap']});
    if (parts.cap && variant === 'sails') movers.push({obj: parts.cap, kind: 'cap', area: variant, speed: 0, key: 'sailsCap'});
    gm.addCircle({id: 'mill-' + variant, x: pos[0], z: pos[2], r: 2.3, y0: y, y1: y + 8});
    if (parts.rotor) movers.push({obj: parts.rotor, kind: 'spin', axis: 'z', area: variant, speed: 1.4, idle: .02, key: 'mill' + variant[0].toUpperCase() + variant.slice(1)});
    root.updateMatrixWorld(true);
    const hub = parts.rotor ? parts.rotor.getWorldPosition(new T.Vector3()) : V([pos[0], y + 7, pos[2]]);
    return {hub, tower: V(pos), yaw, capY: y + 6.4};
  }

  // ================================================================================
  // UPDATE
  // ================================================================================
  const WHEEL_ALIAS = {seedWheel: 'seed', pipesWheel1: 'pipesA', pipesWheel2: 'pipesB', terraceGate: 'seed'};
  const setState = (k, v) => { if (k in dyn) dyn[k] = v; };
  const setRestored = (area, amount) => { if (area in restored || /^carving\d$/.test(area)) restored[area] = Math.max(0, Math.min(1, amount)); };
  let introWake = 0, introShut = false;
  const alive = (area) => Math.max(restored[area] || 0, restored.finale || 0, introWake);
  const smooth = (cur, target, dt, k = 3) => cur + (target - cur) * Math.min(1, dt * k);
  const vis = {terraceGate: 0, sailBridge: 0, ladderShutter: 0, skyPlanks: 0, hollowGate: 0, sailsCap: 0, pipesValve: 0, frag2: 0};
  let wheelSpin = {}; const vaneTurn = {low: 0, mid: 0, high: 0, top: 0};
  const zAxis = new T.Vector3(0, 0, 1), yAxis = new T.Vector3(0, 1, 0), qTmp = new T.Quaternion();
  function update(dt = 1 / 60, t = 0, state = {}) {
    for (const k of Object.keys(dyn)) if (state[k] !== undefined) dyn[k] = state[k];
    const push = state.wind?.push, rs = state.restored;
    if (push) { if (push.terraceGate !== undefined) dyn.terraceGate = push.terraceGate; if (push.sailsBridge !== undefined) dyn.sailBridge = push.sailsBridge; if (push.laddersShutter !== undefined) dyn.ladderShutter = push.laddersShutter; for (const k of ['sailsCap', 'pipesValve', 'frag2']) if (push[k] !== undefined) dyn[k] = push[k]; }
    if (state.wind?.wheels) wheelSpin = state.wind.wheels;
    if (rs) {
      for (const [a, v] of Object.entries(rs)) setRestored(a === 'village' ? 'finale' : a, v);
      if (rs.skyBridge !== undefined && state.skyPlanks === undefined) dyn.skyPlanks = rs.skyBridge * 3;
      if (state.hollowGate === undefined) dyn.hollowGate = state.intro ? 0 : (rs.skyBridge ?? 0) >= .999 ? 1 : 0;
      for (const [i, k] of [[1, 'low'], [2, 'mid'], [3, 'high'], [3, 'top']]) if (rs['vane' + i] !== undefined) vaneTurn[k] = rs['vane' + i];
      for (let i = 0; i < 4; i++) if (rs['carving' + i] !== undefined) restored['carving' + i] = rs['carving' + i];
    }
    // Intro (state.intro {t, phase}): dawn/bell = the village briefly alive; sag = lanterns droop and
    // dim, flags fall, pinwheels stop; shutter = the Hollow gate slams shut; settle = frozen.
    const intro = state.intro;
    if (intro) {
      const ph = intro.phase;
      introWake = ph === 'dawn' || ph === 'bell' ? 1 : ph === 'sag' ? Math.max(0, introWake - dt * .7) : 0;
      dyn.hollowGate = ph === 'dawn' || ph === 'bell' || ph === 'sag' ? 1 : 0;
      if (ph === 'shutter' && !introShut) { introShut = true; vis.hollowGate = Math.max(vis.hollowGate, 1); }
    } else { introWake = 0; introShut = false; }
    for (const k of Object.keys(vis)) vis[k] = smooth(vis[k], dyn[k], dt, k === 'hollowGate' && intro?.phase === 'shutter' ? 7 : 2.5);
    // gate doors
    for (const {pivot, side} of gateDoors) pivot.rotation.y = GATE.az * DEG + (side ? 1.75 : -1.45) * vis.terraceGate;  // wide leaf folds out into the yard, beyond the grille
    for (const {pivot, side} of hollowDoors) { const base = pivot.userData.base ??= pivot.rotation.y; pivot.rotation.y = base + (side ? -1 : 1) * vis.hollowGate * 1.5; }
    // hanging bridge swings; drawbridge lowers
    sailBridge.pivot.rotation.y = sailBridge.yaw + (1 - vis.sailBridge) * 1.15 + Math.sin(t * .9) * .02 * (1 - vis.sailBridge);
    frag2Bridge.pivot.rotation.y = frag2Bridge.yaw + (1 - vis.frag2) * 1.25 + Math.sin(t * 1.1) * .03 * (1 - vis.frag2);   // swings away along branch B, never over the mill deck
    sailBridge.poseSail(); frag2Bridge.poseSail();
    valveLever.rotation.y = (vis.pipesValve - .5) * 1.8;
    const flowA = Math.min(1, wheelSpin.pipesA ?? 0);
    pipeGlow.in.emissiveIntensity = flowA * (1.1 + .4 * Math.sin(t * 9));
    pipeGlow.good.emissiveIntensity = flowA * vis.pipesValve * (1.1 + .4 * Math.sin(t * 9 - 1));
    pipeGlow.wrong.emissiveIntensity = flowA * (1 - vis.pipesValve) * (1.1 + .4 * Math.sin(t * 9 - 1));
    wrongFlag.children[0].rotation.y = flowA * (1 - vis.pipesValve) * (.35 + .35 * Math.sin(t * 11)) - (1 - flowA * (1 - vis.pipesValve)) * .1;
    wrongFlag.children[0].rotation.z = -(1 - flowA * (1 - vis.pipesValve)) * 1.2;
    for (let i = 0; i < carvings.length; i++) carvings[i].glow.emissiveIntensity = Math.max(0, Math.min(1, restored['carving' + i] ?? 0)) * (1.5 + .3 * Math.sin(t * 3 + i));
    shutter.rotation.z = 0; shutter.children.forEach((c) => { c.rotation.x = -vis.ladderShutter * 1.9; });
    // sky bridge stages: reveal plank by plank (scale in along the span)
    for (const s of sbStages) { const f = Math.max(0, Math.min(1, vis.skyPlanks - s.k)); s.grp.visible = f > .02; }
    const hero = state.hero?.isVector3 ? state.hero : state.hero?.position ?? (state.hero && Number.isFinite(state.hero.x) ? state.hero : null);
    for (const b of barriers) {
      const want = b.when(); b.grp.visible = want;
      if (!want) { b.solid = false; continue; }
      if (!b.solid) {
        // arm only when the hero is clear of the chain by more than r + 0.3 (or not at its level)
        let clear = true;
        if (hero) { const dx = b.b[0] - b.a[0], dz = b.b[2] - b.a[2], L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((hero.x - b.a[0]) * dx + (hero.z - b.a[2]) * dz) / L2)); const d = Math.hypot(hero.x - b.a[0] - u * dx, hero.z - b.a[2] - u * dz), yb = b.a[1] + (b.b[1] - b.a[1]) * u; clear = d > .23 + .3 + .1 || hero.y > yb + 1 || hero.y + 1.6 < yb; }
        if (clear) b.solid = true;
      }
    }
    // movers
    for (const m of movers) {
      const a = m.key ? Math.max(alive(m.area), vis[m.key] ?? dyn[m.key] ?? wheelSpin[WHEEL_ALIAS[m.key] ?? m.key] ?? 0) : alive(m.area);
      m.phase = (m.phase || 0) + dt * m.speed * (a + (m.idle || 0));
      m.base ??= m.obj.quaternion.clone();
      let ang = 0, axis = zAxis;
      if (m.kind === 'spin') ang = m.phase;
      else if (m.kind === 'cap') { ang = (1 - vis.sailsCap) * Math.PI / 2; axis = yAxis; }
      else if (m.kind === 'vane') { const turn = vaneTurn[m.key.slice(5)] || 0; ang = turn * Math.PI / 2 + m.phase * turn; axis = yAxis; }
      else if (m.kind === 'swing') ang = Math.sin(t * m.speed) * m.amp * a;
      else if (m.kind === 'ring') { dyn.bellSwing = Math.max(0, dyn.bellSwing - dt * .35); ang = Math.sin(t * m.speed) * m.amp * dyn.bellSwing; }
      m.obj.quaternion.copy(m.base).multiply(qTmp.setFromAxisAngle(axis, ang));
    }
    life.update(dt, t, alive);
  }
  update(0, 0, {});

  // Painted tiles on the large world surfaces only (bark, paving, plank walkways).
  // Browser only; UVs are in metres, one tile spans 3 m. Kit assets keep flat palette colours.
  if (typeof document !== 'undefined' && T.TextureLoader) {
    const loader = new T.TextureLoader();
    for (const [key, file, tint] of [['bark', 'bark.webp', 0xf2ece4], ['paving', 'ivory-stone.webp', 0xe9e2d4], ['deck', 'timber.webp', 0xc7b8a4], ['deckOld', 'timber.webp', 0xada497], ['heartwood', 'bark.webp', 0xc9a88a], ['heartwoodLight', 'timber.webp', 0x8a6446], ['pavingDeep', 'ivory-stone.webp', 0x9d968a]]) {
      const tex = loader.load(new URL('../textures/v2/' + file, import.meta.url).href);
      tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(1 / 3, 1 / 3); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      M[key].map = tex; M[key].color.setHex(tint); M[key].needsUpdate = true;
    }
  }
  scene?.add(root);
  const buildMs = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
  let tris = 0, meshes = 0; root.traverse((o) => { if (o.isMesh) { meshes++; const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; tris += o.isInstancedMesh ? n * o.count : n; } });
  const stats = {buildMs: Math.round(buildMs), meshes, tris: Math.round(tris), surfaces: gm.surfaces.length, colliders: gm.colliders.length};
  root.userData.stats = stats;
  root.userData.rails = B.rails;
  root.userData.surfaces = {bark: 'bark', paving: 'paving', deck: 'deck'};

  return {
    ground: gm.ground, blocked: gm.blocked, blocker: gm.blocker, layers: gm.layers,
    cameraGround: (x, z) => gm.ground(x, z, Infinity), area: (p) => zoneAt(p.x, p.y, p.z),
    points, vents, wheels, sails, bridges, ledges, zones, zoneAt, hangers: life.hangers,
    update, setRestored, setState, state: dyn, restored, root, stats, rails: B.rails, ground_model: gm,
  };
}
