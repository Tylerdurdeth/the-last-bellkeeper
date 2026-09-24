// Vent lip probe: horizontal distance from each updraft column's centre to the first walkable
// cell of its destination ledge (marching straight toward the ledge point at the column top).
//   node tools/vent-lip-probe.mjs
import * as T from 'three';
import {buildBellhollow} from '../game/bellhollow/world.js';
const w = buildBellhollow({THREE: T, scene: new T.Scene()});
w.update(1 / 60, 0, {terraceGate: 1, sailBridge: 1, ladderShutter: 1, skyPlanks: 3, hollowGate: 1});
for (const v of w.vents) {
  if (!v.ledge) continue; const d = v.ledge, L = Math.hypot(d.x - v.x, d.z - v.z); let reach = null, near = null;
  for (let j = 0; j <= 400; j++) { const t = L * j / 400, x = v.x + (d.x - v.x) * t / L, z = v.z + (d.z - v.z) * t / L, g = w.ground(x, z, v.top); if (g !== null && Math.abs(g - d.y) < .1) { reach = t; break; } }
  // nearest walkable ledge cell in any direction
  for (let r = 0; r <= 3; r += .05) { for (let k = 0; k < 72 && near === null; k++) { const x = v.x + Math.cos(k * 5 * Math.PI / 180) * r, z = v.z + Math.sin(k * 5 * Math.PI / 180) * r, g = w.ground(x, z, v.top); if (g !== null && Math.abs(g - d.y) < .1 && !w.blocked(x, z, .23, d.y)) near = r; } if (near !== null) break; }
  console.log(v.id.padEnd(9), 'toward ledge', reach?.toFixed(2), 'nearest', near?.toFixed(2), 'ledgeDist', L.toFixed(2), 'radius', v.radius);
}
