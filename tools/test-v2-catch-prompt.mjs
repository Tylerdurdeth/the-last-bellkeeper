// Catch prompt on arrival (playtest): every live gust in the real world, approached from 4 directions, offers
// "Catch" as soon as the hero reaches the painted ring (and a little outside it). Requirement >= 95%.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBellhollow } from '../game/bellhollow/world.js';
import { adaptWorld } from '../game/bellhollow/adapt-world.js';
import { createMovement } from '../game/movement.js';
import { createWind } from '../game/bellhollow/wind.js';
import { createQuest } from '../game/bellhollow/quest.js';
const scene = new THREE.Scene(), w = adaptWorld(await buildBellhollow({ THREE, scene }), { THREE });
const m = createMovement(THREE, { inputTarget: new EventTarget(), start: [w.points.start.x, w.points.start.y, w.points.start.z], sampleGround: w.ground, blocked: w.blocked });
const wind = createWind({ THREE, scene, movement: m }), q = createQuest({ THREE, scene, world: w, wind, movement: m });
Object.assign(q.progress, { bell: true, bypass: true, staff: true, seed: true, loft: true, sailsBridge: true }); Object.assign(q.reached, { loft: true, ladders1: true, ladders2: true, ladders3: true });
q.update(1 / 60, 0, m.position, { started: false });
let ok = 0, n = 0; const misses = [];
for (const s of wind.sources.values()) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const r of [s.radius, s.radius + .45]) {
  const x = s.x + dx * r, z = s.z + dz * r, g = w.ground(x, z, s.y + .4); if (g === null || Math.abs(g - s.y) > .4 || w.blocked(x, z, .23, g)) continue;
  n++; const c = q.context(new THREE.Vector3(x, g, z), Math.atan2(-dx, -dz)); if (c?.kind === 'catch') ok++; else misses.push({ src: s.id, dir: [dx, dz], r: +r.toFixed(2), got: c?.kind + '/' + c?.id });
}
console.log(`catch prompt on arrival: ${ok}/${n} (${(100 * ok / n).toFixed(1)}%)`); if (misses.length) console.log(JSON.stringify(misses.slice(0, 6)));
assert(ok / n >= .95); console.log('PASS: catch prompt >= 95% on arrival from 4 directions');
