// Occluder audit for the Bellhollow world with main's real camera: yaw atan2(.615,.788) (SE),
// pitch atan(.48), arm 10.8 m, focus = hero + 1 m up, 0.8 m ahead (away from the camera).
// Samples walkable spots on every layer, casts focus->camera and lists what the ray hits,
// grouped by block/material and nearest named surface area.
//   node tools/occluders-bellhollow.mjs [step=2] [--yaw=deg] [--json=out.json]
import * as T from 'three';
import {writeFile} from 'node:fs/promises';
import {buildBellhollow} from '../game/bellhollow/world.js';

const args = process.argv.slice(2), step = +(args.find((a) => !a.startsWith('--')) || 2);
const yawArg = args.find((a) => a.startsWith('--yaw='));
const yaw = yawArg ? +yawArg.slice(6) * Math.PI / 180 : Math.atan2(.615, .788), pitch = Math.atan(.48), arm = 10.8;
const w = buildBellhollow({THREE: T, scene: new T.Scene()});
w.update(1 / 60, 0, {terraceGate: 1, sailBridge: 1, ladderShutter: 1, skyPlanks: 3, hollowGate: 1});
w.root.updateMatrixWorld(true);
const meshes = []; w.root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.visible) meshes.push(o); });
const ray = new T.Raycaster(); ray.far = arm - .4;
const sx = Math.sin(yaw), sz = Math.cos(yaw), c = Math.cos(pitch), s = Math.sin(pitch);
const dir = new T.Vector3(sx * c, s, sz * c).normalize();
const hits = new Map(); let samples = 0, blocked = 0;
const cells = [];
for (let x = -50; x <= 50; x += step) for (let z = -50; z <= 50; z += step) for (const {h, id} of w.layers(x, z)) {
  if (w.ground(x, z, h) !== h || w.blocked(x, z, .23, h)) continue;
  samples++;
  const focus = new T.Vector3(x - sx * .8, h + 1, z - sz * .8);
  ray.set(focus, dir);
  const hit = ray.intersectObjects(meshes, false).find((r) => r.distance > .6);
  if (!hit) continue;
  blocked++;
  const key = hit.object.name;
  const e = hits.get(key) || {count: 0, examples: []}; e.count++;
  if (e.examples.length < 6) e.examples.push({from: id, at: [x, h, z].map((v) => +v.toFixed(1)), hit: hit.point.toArray().map((v) => +v.toFixed(1)), d: +hit.distance.toFixed(1)});
  hits.set(key, e); cells.push({x, z, h, id, by: key});
}
const sorted = [...hits.entries()].sort((a, b) => b[1].count - a[1].count);
console.log(`samples ${samples}, camera ray blocked for ${blocked} (${(100 * blocked / samples).toFixed(1)}%)`);
for (const [k, v] of sorted.slice(0, 25)) console.log(String(v.count).padStart(4), k, JSON.stringify(v.examples.slice(0, 2)));
const jsonArg = args.find((a) => a.startsWith('--json='));
if (jsonArg) await writeFile(jsonArg.slice(7), JSON.stringify({yaw, pitch, arm, samples, blocked, by: Object.fromEntries(sorted), cells}, null, 1));
