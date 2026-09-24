// Near-foreground probe: from main's gameplay camera at named points, casts a screen grid of rays
// and lists meshes hit in the first `near` metres (tall/dark objects between camera and hero).
//   node tools/near-fg-probe.mjs morningBell,seedWheel [near=7]
import * as T from 'three';
import {buildBellhollow} from '../game/bellhollow/world.js';
const [names = 'morningBell,seedWheel', nearA = '7'] = process.argv.slice(2), near = +nearA;
const w = buildBellhollow({THREE: T, scene: new T.Scene()});
w.update(1 / 60, 0, {terraceGate: 1, sailBridge: 1, ladderShutter: 1, skyPlanks: 3, hollowGate: 1});
w.root.updateMatrixWorld(true);
const meshes = []; w.root.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.visible) meshes.push(o); });
const yaw = Math.atan2(.615, .788), pitch = Math.atan(.48), arm = 10.8, sx = Math.sin(yaw), sz = Math.cos(yaw);
const cam = new T.PerspectiveCamera(42, 16 / 9, .1, 500), ray = new T.Raycaster();
for (const n of names.split(',')) {
  const p = n.split('.').reduce((o, k) => o?.[k], w.points); if (!p) { console.log('no point', n); continue; }
  const focus = new T.Vector3(p.x - sx * .8, p.y + 1, p.z - sz * .8);
  cam.position.set(focus.x + sx * Math.cos(pitch) * arm, focus.y + Math.sin(pitch) * arm, focus.z + sz * Math.cos(pitch) * arm); cam.lookAt(focus); cam.updateMatrixWorld();
  const found = new Map();
  for (let u = -.95; u <= .95; u += .1) for (let v = -.95; v <= .95; v += .1) {
    ray.setFromCamera(new T.Vector2(u, v), cam); ray.far = near;
    const h = ray.intersectObjects(meshes, false)[0]; if (!h) continue;
    const k = h.object.name + ' / ' + (h.object.material?.userData?.bhKey || h.object.material?.name);
    const e = found.get(k) || {n: 0, at: h.point.toArray().map((x) => +x.toFixed(1)), scr: [+u.toFixed(1), +v.toFixed(1)]}; e.n++; found.set(k, e);
  }
  console.log('==', n, [p.x, p.y, p.z].map((x) => +x.toFixed(1)));
  for (const [k, e] of [...found].sort((a, b) => b[1].n - a[1].n)) console.log(String(e.n).padStart(4), k, JSON.stringify(e.at), 'screen', JSON.stringify(e.scr));
}
