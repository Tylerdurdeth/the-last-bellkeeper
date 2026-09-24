// Updraft exit (playtest: the loft took ~30 min). For every vent of the real world, with main's movement settings:
// start on the grille (centre and off-centre), rise, and within 1.5 s of the peak hold ONE arrow key (no Shift) —
// whichever of the 4 is closest to the ledge direction under the current camera yaw (8 yaws). Pass = lands on the
// vent's ledge. Requirement: >= 9/10 per vent.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBellhollow } from '../game/bellhollow/world.js';
import { adaptWorld } from '../game/bellhollow/adapt-world.js';
import { createMovement } from '../game/movement.js';
const w = adaptWorld(await buildBellhollow({ THREE, scene: new THREE.Scene() }), { THREE });
for (let i = 0; i < 120; i++) w.update(1 / 60, i / 60, { wind: { push: { terraceGate: 1, laddersShutter: 1 } }, restored: { skyBridge: 1 } });
const ARROWS = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowRight: [1, 0], ArrowLeft: [-1, 0] };
const results = [];
for (const v of w.vents.filter(v => v.ledge)) {
  let ok = 0, n = 0; const misses = [];
  for (let k = 0; k < 8; k++) for (const [ox, oz] of [[0, 0], [.45, 0], [0, -.45]]) for (const delay of [.1, 1.4]) for (const late of [0, 1.2, 2.4]) {
    const yaw = k * Math.PI / 4 + .2, target = new EventTarget();
    const m = createMovement(THREE, { inputTarget: target, start: [v.x + ox, v.y, v.z + oz], sampleGround: w.ground, blocked: w.blocked, walkSpeed: 1.65, runSpeed: 5.8, acceleration: 12, deceleration: 16, turnResponse: 12, cameraYaw: () => yaw, maxDrop: 14 });
    m.lift({ x: v.x, z: v.z, radius: (v.radius || .8) + .25, top: v.top, base: v.y, duration: 4, ledge: process.argv.includes('--baseline') ? null : v.ledge });
    // Late entry: the gust was released from a few metres away; the hero steps onto the grille `late` s after.
    if (late) { m.reset([v.x + 2.6, v.y, v.z]); for (let s = 0; s < late; s += 1 / 60) m.update(1 / 60); m.reset([v.x + ox, v.y, v.z + oz]); }
    let peakT = null, t = 0, prev = -1e9;
    for (; t < 3 && peakT === null; t += 1 / 60) { m.update(1 / 60); if (m.position.y <= prev + 1e-4 && m.position.y > v.ledge.y) peakT = t; prev = m.position.y; }
    for (let s = 0; s < delay; s += 1 / 60) m.update(1 / 60);
    // The one arrow whose camera-relative direction points most toward the ledge.
    const cx = Math.cos(yaw), cz = Math.sin(yaw), lx = v.ledge.x - m.position.x, lz = v.ledge.z - m.position.z;
    const key = Object.entries(ARROWS).map(([k2, [x, y]]) => [k2, (cx * x - cz * y) * lx + (-cz * x - cx * y) * lz]).sort((a, b) => b[1] - a[1])[0][0];
    const e = new Event('keydown', { cancelable: true }); Object.defineProperty(e, 'code', { value: key }); target.dispatchEvent(e);
    let landed = false, rec = false;
    for (let s = 0; s < 4 && !landed; s += 1 / 60) { m.update(1 / 60); rec ||= m.recovered; landed = m.grounded && Math.abs(m.position.y - v.ledge.y) < .15 && !m.lifting; }
    n++; if (landed && !rec) ok++; else misses.push({ yaw: +yaw.toFixed(2), off: [ox, oz], delay, key, y: +m.position.y.toFixed(2) });
    m.dispose();
  }
  results.push({ vent: v.id, landed: `${ok}/${n}`, rate: +(ok / n).toFixed(3), misses: misses.slice(0, 3) });
}
console.table(results.map(r => ({ vent: r.vent, landed: r.landed, rate: r.rate })));
for (const r of results) if (r.rate < .9) console.log('MISSES', r.vent, JSON.stringify(r.misses));
assert(results.every(r => r.rate >= .9), 'every vent exit lands >= 9/10');
console.log('PASS: updraft exits land on the named ledge with one arrow, no Shift, within 1.5 s of the peak (>= 9/10 on every vent)');
