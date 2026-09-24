// Guardian lab: the v2 guardian encounter on a placeholder three-ring well, with the real hero,
// movement, wind and look modules (all read-only imports). Dev page only.
// Keys: arrows move, Shift run, A jump, Space interact.  URL: ?phase=0..3 ?at=x,y,z ?bot=1 ?shot=1
// ?gentle=1 ?look=0 ?hero=capsule ?view=wide.  window.__lab exposes telemetry and measurement hooks.
import * as THREE from 'three';
import { createMovement } from '../movement.js';
import { createWind } from './wind.js';
import { createGuardian } from './guardian.js';
import { createLook } from '../render/look.js';
import buildBells from '../assets/bh-paired-bells.js';
import buildMara from '../assets/bh-mara.js';

const q = new URLSearchParams(location.search);
if (q.get('shot') === '1') document.body.classList.add('shot');
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#5d7470'); scene.fog = new THREE.FogExp2('#5d7470', .012);
const camera = new THREE.PerspectiveCamera(42, 1, .1, 200);
const hemi = new THREE.HemisphereLight(0xffefcd, 0x274d54, 1.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe1ae, 2.4); sun.position.set(-9, 30, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: .5, far: 80 }); sun.shadow.bias = -.0003; sun.shadow.normalBias = .03;
scene.add(sun, sun.target);

// ---------------- placeholder three-ring well ----------------
const RINGS = [{ y: 0, inner: 0, outer: 7.5 }, { y: 4, inner: 6.3, outer: 10 }, { y: 8, inner: 9.4, outer: 13 }, { y: 12, inner: 9.5, outer: 12.5, sector: [2.05, 3.3] }];
const inSector = (R, x, z) => { if (!R.sector) return true; const a = Math.atan2(z, x); return a >= R.sector[0] && a <= R.sector[1]; };
const polar = (a, r, y) => ({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
const std = (color, name, o = {}) => Object.assign(new THREE.MeshStandardMaterial({ color, roughness: .9, ...o }), { name });
const add = (geo, m, x = 0, y = 0, z = 0, parent = scene) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
const ivory = std('#E9DCBC', 'stone'), ivorySh = std('#CDBB95', 'stone'), bark = std('#6E4B36', 'timber', { side: THREE.DoubleSide }), copperV = std('#3E9C8C', 'metal', { roughness: .5, metalness: .3 }), copper = std('#B8733F', 'metal', { roughness: .45, metalness: .4 }), timber = std('#7A4E33', 'timber');
// Mid/high rings leave the camera-facing sector open (the Hollow is a split geode open to the camera).
const GAP = [Math.PI / 4 - .95, Math.PI / 4 + .95], inGap = (x, z) => { const a = Math.atan2(z, x); return a > GAP[0] && a < GAP[1]; };
function annulus(inner, outer, y, thick, m) { const pts = [[inner, y - thick], [outer, y - thick], [outer, y], [inner, y], [inner, y - thick]].map(([r, h]) => new THREE.Vector2(Math.max(.01, r), h)); return add(new THREE.LatheGeometry(pts, 56, Math.PI / 4 + .95, Math.PI * 2 - 1.9), m); }
add(new THREE.CylinderGeometry(RINGS[0].outer, RINGS[0].outer, .6, 64), ivory, 0, -.3, 0);
add(new THREE.RingGeometry(2.2, 2.45, 48).rotateX(-Math.PI / 2), ivorySh, 0, .01, 0);
annulus(RINGS[1].inner, RINGS[1].outer, 4, .5, ivory); annulus(RINGS[2].inner, RINGS[2].outer, 8, .5, ivory);
{ const pts = [[9.5, 11.5], [12.5, 11.5], [12.5, 12], [9.5, 12], [9.5, 11.5]].map(([r, h]) => new THREE.Vector2(r, h)); add(new THREE.LatheGeometry(pts, 20, Math.PI / 2 - 3.3, 1.25), ivory); } // top perch
// Walls only on the far half (the Hollow is open toward the camera, south-east).
for (const [r, y0, y1] of [[7.55, 0, 4], [10.05, 4, 8], [13.05, 8, 14]]) add(new THREE.CylinderGeometry(r, r, y1 - y0, 48, 1, true, Math.PI * .75 + .2, Math.PI * 1.1), bark, 0, (y0 + y1) / 2, 0);
for (let i = 0; i < 9; i++) { // roots crawling down the far wall
  const a = Math.PI * 1.05 + i * .12, pts = []; for (let k = 0; k <= 8; k++) { const f = k / 8; pts.push(new THREE.Vector3(Math.sin(a + Math.sin(f * 6 + i) * .05) * (7.3 + 2.5 * (1 - f)), 12 - f * 12, Math.cos(a + Math.sin(f * 6 + i) * .05) * (7.3 + 2.5 * (1 - f)))); }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .22 - i * .012, 7), timber);
}
const vents = [
  { id: 'ring1', ...polar(-3.0, 5.0, 0), top: 4.9, radius: 1.0, ledge: polar(-3.0, 7.9, 4) },
  { id: 'ring2', ...polar(2.2, 8.3, 4), top: 8.9, radius: 1.05, ledge: polar(2.2, 10.6, 8) },
  { id: 'ring3', ...polar(1.85, 11.2, 8), top: 12.9, radius: 1.0, ledge: polar(2.25, 11, 12) },
];
for (const v of vents) { add(new THREE.CylinderGeometry(v.radius, v.radius, .08, 24), copperV, v.x, v.y + .04, v.z); add(new THREE.TorusGeometry(v.radius + .05, .06, 5, 24).rotateX(Math.PI / 2), copper, v.x, v.y + .08, v.z); }
const vanePts = [polar(-2.2, 6.4, 0), polar(-1.2, 8.7, 4), polar(3.1, 11, 12), polar(3.1, 11, 12)];
const vaneMeshes = vanePts.map(p => { const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); scene.add(g); add(new THREE.CylinderGeometry(.12, .16, 1.6, 8), timber, 0, .8, 0, g); const head = new THREE.Group(); head.position.y = 1.7; g.add(head); for (let i = 0; i < 4; i++) { const b = add(new THREE.BoxGeometry(.18, .9, .05), copperV, 0, .45, 0, new THREE.Group()); b.parent.rotation.z = i * Math.PI / 2; head.add(b.parent); } add(new THREE.SphereGeometry(.16, 12, 8), copper, 0, 0, 0, head); return head; });
const restored = {};
const well = {
  center: { x: 0, y: 0, z: 0 }, vents: { toMid: 'ring1', pulse: 'ring2' }, roots: polar(Math.PI * 1.25, 6.8, 0),
  rings: RINGS.map((r, k) => ({ ...r, vane: vanePts[k], safe: [polar(.95, 5.2, 0), polar(-3.0, 8.3, 4), polar(2.2, 11.2, 8), polar(2.3, 11, 12)][k], ...(k === 3 ? { catchPoint: polar(2.45, 11, 12) } : {}) })).filter((r, k) => q.get('climb') !== '0' || k < 3),
};
const world = {
  points: { guardianWell: well, bellOut: polar(Math.PI * 1.25, 11.5, 8), bellReturn: polar(Math.PI * 1.25 + .2, 11.5, 8) }, vents,
  ground(x, z, y = Infinity) { const r = Math.hypot(x, z); let best = null; for (const R of RINGS) if (r >= R.inner && r <= R.outer && (R.y === 0 || !inGap(x, z)) && inSector(R, x, z) && R.y <= y + .35 && (best === null || R.y > best)) best = R.y; return best; },
  blocked(x, z, rad, y = 0) { const r = Math.hypot(x, z); for (const [wr, y0, y1] of [[7.5, -1, 4], [10, 4, 8], [13, 8, 20]]) if (y >= y0 - .3 && y < y1 - .3 && r + rad > wr) return true;
    for (const R of RINGS.slice(1)) if (!inGap(x, z) && inSector(R, x, z) && R.y - .45 > y + .35 && R.y - .45 < y + 1.6 && r + rad > R.inner && r - rad < R.outer) return true; return false; },
  setRestored(k, v) { restored[k] = v; },
};
// Finale props for budget/look: paired bells on the high ring, Mara on the mid ring (preview only).
const bells = buildBells(THREE); { const p = polar(Math.PI * 1.25, 11.4, 8); bells.position.set(p.x, p.y, p.z); bells.rotation.y = Math.atan2(-p.x, -p.z); scene.add(bells); }
const mara = q.get('mara') === '1' ? buildMara(THREE) : null; if (mara) { mara.position.set(3, 0, 3); scene.add(mara); }

// ---------------- hero, movement, wind, guardian ----------------
let camYaw = Math.PI / 4;
const start = (q.get('at') || '').split(',').map(Number); const START = start.length === 3 && start.every(Number.isFinite) ? start : [well.rings[0].safe.x, 0, well.rings[0].safe.z];
const movement = createMovement(THREE, { start: START, sampleGround: world.ground, blocked: world.blocked, walkSpeed: 1.65, runSpeed: 5.8, acceleration: 12, deceleration: 16, turnResponse: 12, cameraYaw: () => camYaw });
const log = [];
const wind = createWind({ THREE, scene, movement, sound: s => log.push(['sound', s]) });
let caption = '', captionUntil = 0, time = 0;
const guardian = createGuardian({ THREE, scene, world, wind, movement, sound: s => log.push(['sound', s, +time.toFixed(2)]), caption: (s, d = 4) => { caption = s; captionUntil = time + d; },
  onEvent: e => { log.push(['event', e, +time.toFixed(2)]); if (e.knock?.to) movement.knockback({ to: e.knock.to }); if (e.checkpoint) movement.setCheckpoint(e.checkpoint); } });
const phase0 = +(q.get('phase') || 0); if (phase0) guardian.restore({ phase: phase0 });

let hero, animator = null, staffTip = new THREE.Vector3();
if (q.get('hero') !== 'capsule') {
  try {
    const { loadCodeCharacter } = await import('../code-character.js');
    const { createAdventureMotion } = await import('../adventure-motion.js');
    const { default: buildHero } = await import('../assets/hero-study-a.js');
    const character = await loadCodeCharacter(buildHero); hero = character.root; animator = createAdventureMotion(character, movement);
  } catch (e) { console.warn('hero fallback', e); }
}
if (!hero) { hero = new THREE.Group(); add(new THREE.CapsuleGeometry(.25, .9, 4, 10), std('#D96956', 'fabric'), 0, .7, 0, hero); add(new THREE.SphereGeometry(.18, 12, 8), std('#E0A882', 'skin'), 0, 1.45, 0, hero); }
scene.add(hero);

let look = null;
if (q.get('look') !== '0') {
  look = createLook({ THREE, renderer, scene, camera, tier: q.get('tier') || undefined });
  look.applyTo(hero, 'character'); look.applyTo(guardian.actor, 'character'); look.applyTo(bells, 'outline'); if (mara) look.applyTo(mara, 'character');
  look.setAreaParams?.('hollow', {});
}

// ---------------- input ----------------
let pressed = false;
addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) pressed = true; } });
const $b = document.getElementById('buttons');
const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; $b.append(b); };
const place = (p, dy = 0) => movement.reset([p.x, p.y + dy, p.z]);
btn('P1', () => { guardian.restore({ phase: 0 }); guardian.reset(); place(well.rings[0].safe); });
btn('P2', () => { guardian.restore({ phase: 1 }); place(well.rings[1].safe); });
btn('P3', () => { guardian.restore({ phase: 2 }); place(well.rings[1].safe); });
btn('Done', () => { guardian.restore({ phase: 3 }); });
let gentle = q.get('gentle') === '1'; btn('gentle', () => { gentle = !gentle; });
let bot = q.get('bot') === '1'; btn('bot', () => { bot = !bot; });

// ---------------- bot (real key events) for end-to-end runs ----------------
const keys = new Set();
function setKeys(dirX, dirZ, run = true) { // world direction -> arrow keys relative to camera yaw
  const want = new Set();
  if (Math.hypot(dirX, dirZ) > .05) {
    const f = { x: -Math.sin(camYaw), z: -Math.cos(camYaw) }, r = { x: Math.cos(camYaw), z: -Math.sin(camYaw) };
    const fw = dirX * f.x + dirZ * f.z, rt = dirX * r.x + dirZ * r.z, n = Math.hypot(fw, rt);
    if (fw / n > .38) want.add('ArrowUp'); if (fw / n < -.38) want.add('ArrowDown'); if (rt / n > .38) want.add('ArrowRight'); if (rt / n < -.38) want.add('ArrowLeft');
    if (run) want.add('ShiftLeft');
  }
  for (const k of keys) if (!want.has(k)) { dispatchEvent(new KeyboardEvent('keyup', { code: k })); keys.delete(k); }
  for (const k of want) if (!keys.has(k)) { dispatchEvent(new KeyboardEvent('keydown', { code: k })); keys.add(k); }
}
let botRing = 0;
function botStep() {
  const p = movement.position, tel = guardian.telemetry(), ph = guardian.phase;
  if (ph >= 3) return setKeys(0, 0);
  if (movement.grounded) botRing = p.y > 11.4 ? 3 : p.y > 7.4 ? 2 : p.y > 3.4 ? 1 : 0; const ringNow = botRing, need = ph === 2 ? (tel.climb ? 3 : 2) : ph >= 1 ? 1 : 0;
  // Rage shockwave: jump when the front is about to reach us.
  if (tel.rage?.front != null && Math.abs(p.y - RINGS[tel.rage.ring].y) < 1 && movement.grounded) { const d = Math.hypot(p.x, p.z) - tel.rage.front; if (d > 0 && d < 1.1) movement.jump(); }
  let goal = null;
  const breath = wind.sources.get('guardianBreath');
  if (ringNow < need) { // go ride the right vent, then steer onto its ledge
    const v = vents[Math.min(ringNow, vents.length - 1)];
    goal = (movement.lifting || !movement.grounded) && p.y > v.ledge.y + .2 ? v.ledge : v;
    if (ringNow === 1 && !movement.lifting && tel.beat !== 'exhale:up' && !movement.columns.some(c => c.id === 'vent:' + v.id)) goal = { x: v.x + (v.x) * .12, z: v.z + v.z * .12 };
  } else if (!wind.charged) goal = breath && Math.abs(breath.y - p.y) < 1 ? breath : well.rings[ringNow].safe;
  else goal = well.rings[ph].vane;
  // Dodge: inside a telegraphed lane -> step sideways out of it (wait if the path crosses it).
  const lane = guardian.lane;
  if (lane && (tel.beat || '').startsWith('inhale') && lane.kind !== 'up' && inLane(lane, p)) goal = dodgeGoal(lane, p);
  else if (lane && (tel.beat || '').startsWith('inhale') && lane.kind !== 'up' && goal && pathCrosses(lane, p, goal) && tel.beatLeft < 1.4) goal = null;
  const ctx = guardian.context(p, movement.yaw, wind.charged);
  if (ctx && ctx.kind !== 'info') { pressed = true; }
  if (!goal) return setKeys(0, 0);
  const dx = goal.x - p.x, dz = goal.z - p.z; setKeys(Math.hypot(dx, dz) > .35 ? dx : 0, Math.hypot(dx, dz) > .35 ? dz : 0, true);
}
function inLane(l, p, pad = .3) { if (l.kind === 'pillar') return Math.abs(p.y - l.y) < 1.2 && Math.hypot(p.x - l.x, p.z - l.z) < l.r + .7; const r = Math.hypot(p.x, p.z), a = Math.atan2(p.z, p.x); if (Math.abs(p.y - RINGS[l.ring].y) > 1.2 || r < l.lo - .5 || r > l.hi + .6) return false;
  const m = (l.a0 + l.a1) / 2, half = Math.abs(l.a1 - l.a0) / 2 + pad / Math.max(1, r), d = Math.atan2(Math.sin(a - m), Math.cos(a - m)); return Math.abs(d) < half; }
function dodgeGoal(l, p) { if (l.kind === 'pillar') { const dx = p.x - l.x, dz = p.z - l.z, n = Math.hypot(dx, dz) || 1; return { x: l.x + dx / n * (l.r + 1.6), z: l.z + dz / n * (l.r + 1.6) }; } const r = Math.hypot(p.x, p.z), a = Math.atan2(p.z, p.x), m = (l.a0 + l.a1) / 2, d = Math.atan2(Math.sin(a - m), Math.cos(a - m)), half = Math.abs(l.a1 - l.a0) / 2 + 1.4 / Math.max(1, r), t = m + (d >= 0 ? half : -half); return { x: Math.cos(t) * r, z: Math.sin(t) * r }; }
function pathCrosses(l, p, g) { for (let i = 1; i <= 6; i++) { const f = i / 6; if (inLane(l, { x: p.x + (g.x - p.x) * f, y: p.y, z: p.z + (g.z - p.z) * f })) return true; } return false; }

// ---------------- camera ----------------
const focus = new THREE.Vector3(), camPos = new THREE.Vector3(), tmp = new THREE.Vector3();
function frameCamera(dt, snap = false) {
  const p = movement.position, g = guardian.actor.position, portrait = innerHeight > innerWidth;
  tmp.set(p.x + (g.x - p.x) * .42, p.y + 1.2 + (g.y + 2.2 - p.y) * .4, p.z + (g.z - p.z) * .42);
  const k = snap ? 1 : 1 - Math.exp(-dt * 3); focus.lerp(tmp, k);
  const sep = Math.hypot(p.x - g.x, p.z - g.z, (p.y - g.y) * .7), dist = (q.get('view') === 'wide' ? 24 : Math.max(13, sep * .9 + 7)) * (portrait ? 1.5 : 1);
  camYaw = Math.PI / 4 + .25 * Math.sin(Math.atan2(p.x, p.z) - Math.PI / 4) * 0; // fixed yaw (south-east)
  tmp.set(Math.sin(camYaw) * .66, .56, Math.cos(camYaw) * .66).normalize().multiplyScalar(dist).add(focus);
  camPos.lerp(tmp, k); camera.position.copy(camPos); camera.lookAt(focus);
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------------- loop ----------------
const $tele = document.getElementById('tele'), $prompt = document.getElementById('prompt');
let last = performance.now(), frames = 0, fps = 0, fpsT = 0, paused = false, fixedDt = 0;
const hand = new THREE.Vector3();
function step(dt) {
  time += dt;
  if (bot) botStep();
  movement.update(dt, { enabled: true });
  hero.position.copy(movement.position); hero.rotation.y = movement.yaw;
  animator?.update(dt);
  hero.updateMatrixWorld(true);
  const rh = hero.getObjectByName?.('rightHand'); if (rh) rh.getWorldPosition(staffTip); else staffTip.copy(movement.position).add(hand.set(.3, 1.4, 0));
  staffTip.y += .35;
  wind.update(dt, time, { hero: movement.position, staffTip, camera, gentle }); // wind first: it clears the strip batch
  guardian.update(dt, time, { hero: movement.position, active: true, gentle });
  const ctx = guardian.context(movement.position, movement.yaw, wind.charged);
  $prompt.textContent = ctx ? ctx.label + (ctx.kind === 'info' ? '' : '  [Space]') : '';
  if (pressed) { pressed = false; if (ctx) guardian.interact(ctx, { staffTip }); }
  wind.flush();
  for (let k = 0; k < 3; k++) vaneMeshes[k].rotation.z += dt * (restored['vane' + (k + 1)] ? 4 : .05);
  // Bells ring their two-part phrase once the guardian is calm (preview of the finale hook).
  if (guardian.done) { const ph = bells.userData.phrase((time % 9)); bells.userData.setSwing(ph); }
  frameCamera(dt);
  sun.target.position.copy(focus); sun.position.copy(focus).add(tmp.set(-9, 30, 8));
}
function render() { if (look) { look.update(1 / 60, { area: 'hollow', restored: guardian.done ? 1 : 0 }); look.render(); } else renderer.render(scene, camera); }
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  frames++; fpsT += dt; if (fpsT > 1) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  if (!paused) step(fixedDt || dt);
  render();
  const t = guardian.telemetry();
  $tele.textContent = `phase ${t.phase}  ${t.stage}  ${t.beat || ''} ${t.beatLeft ?? ''}s\nlane ${t.lane ? t.lane.id + (t.lane.aimed ? ' (aimed)' : '') : '-'}  loiter ${t.loiter}\nbreath ${t.breath ? t.breath.left + 's' : '-'}  charge ${wind.charge?.kind || '-'}\nhits ${t.hits} catches ${t.catches} cycles ${t.cycles}  draws ${renderer.info.render.calls}  fps ${fps.toFixed(0)}` + (caption && time < captionUntil ? `\n“${caption}”` : '');
  requestAnimationFrame(loop);
}
frameCamera(0, true); camPos.copy(camera.position);
requestAnimationFrame(loop);

// ---------------- measurement hooks ----------------
function onlyActorPass(fn) { // white silhouette of the guardian actor alone, from the current camera
  const hidden = []; scene.traverse(o => { if ((o.isMesh || o.isSprite || o.isLine) && o.visible) { let a = false; for (let n = o; n; n = n.parent) if (n === guardian.actor) a = true; if (!a) { hidden.push(o); o.visible = false; } } });
  const bg = scene.background, fog = scene.fog; scene.background = new THREE.Color(0); scene.fog = null; scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const w = 320, h = Math.round(320 * innerHeight / innerWidth), rt = new THREE.WebGLRenderTarget(w, h), buf = new Uint8Array(w * h * 4);
  const out = fn(() => { renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf); const m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) m[i] = buf[i * 4] > 128 ? 1 : 0; return m; });
  scene.overrideMaterial = null; scene.background = bg; scene.fog = fog; hidden.forEach(o => o.visible = true); rt.dispose(); return out;
}
function silhouetteChange(pa, pb) {
  return onlyActorPass(shot => {
    const set = p => guardian.actor.userData.setPose(p);
    set(pa); const A = shot(); set(pb); const B = shot();
    let a = 0, b = 0, x = 0, u = 0; for (let i = 0; i < A.length; i++) { a += A[i]; b += B[i]; x += A[i] ^ B[i]; u += A[i] | B[i]; }
    return { calmPx: a, posePx: b, areaChange: +(b / a - 1).toFixed(3), xorOverUnion: +(x / u).toFixed(3), xorOverCalm: +(x / a).toFixed(3) };
  });
}
function lum(r, g, b) { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); }
const c2 = document.createElement('canvas'), x2 = c2.getContext('2d', { willReadFrequently: true });
function sample(p, rad = 3) { // average sRGB around a projected world point, from the drawn canvas (copied via 2D canvas)
  const v = new THREE.Vector3(p.x, p.y, p.z).project(camera), W = canvas.width, H = canvas.height;
  if (c2.width !== W || c2.height !== H) { c2.width = W; c2.height = H; }
  x2.drawImage(canvas, 0, 0);
  const x = Math.max(rad, Math.min(W - rad - 1, Math.round((v.x + 1) / 2 * W))), y = Math.max(rad, Math.min(H - rad - 1, Math.round((1 - v.y) / 2 * H))), px = x2.getImageData(x - rad, y - rad, rad * 2 + 1, rad * 2 + 1).data;
  let r = 0, g = 0, b = 0, n = px.length / 4; for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; } return [r / n, g / n, b / n];
}
window.__lab = {
  THREE, guardian, movement, wind, world, well, bells, camera, renderer, scene, look, log,
  get time() { return time; }, get bot() { return bot; }, set bot(v) { bot = v; }, set gentle(v) { gentle = v; }, set paused(v) { paused = v; }, set fixedDt(v) { fixedDt = v; },
  place, telemetry: () => ({ ...guardian.telemetry(), hero: movement.position.toArray().map(v => +v.toFixed(2)), charge: wind.charge?.kind || null, draws: renderer.info.render.calls, tris: renderer.info.render.triangles, fps: +fps.toFixed(1) }),
  silhouette() { const P = guardian.actor.userData.poses, r = {}; for (const k of ['inhale', 'exhale', 'slump', 'tend']) r[k] = silhouetteChange(P.calm, P[k]);
    // Inhale ramp as driven by the encounter (bloom leads): when does the change pass 20%?
    const ramp = []; for (let f = 0; f <= 1.001; f += .1) { const e = f * f * (3 - 2 * f), c = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
      ramp.push({ f: +f.toFixed(1), ...silhouetteChange(P.calm, { crouch: e, bloom: c(f * 1.5), spread: c(f * 1.25), lean: -.12 * e, swell: e, rotorGlow: f, look: { x: -.45 * e, y: 0 } }) }); }
    guardian.actor.userData.setPose(P.calm); return { ...r, ramp }; },
  contrast() { // lane band vs floor beside it (drawn frame), WCAG ratio
    const l = guardian.lane; if (!l || l.kind === 'up' || l.kind === 'pillar') return null; const R = RINGS[l.ring], mid = (l.lo + l.hi) / 2 + (l.kind === 'sweep' ? .8 : 0);
    const a = (l.a0 + l.a1) / 2, off = Math.abs(l.a1 - l.a0) / 2 + 1.5 / mid;
    // Band fill: darkest of 7 points along the lane (between chevrons, clear of the hero); floor: beyond both lane ends.
    const ins = []; for (let i = 1; i <= 7; i++) { const f = .1 + .8 * i / 8, aa = l.a0 + (l.a1 - l.a0) * f, p = polar(aa, mid, R.y); if (Math.hypot(p.x - movement.position.x, p.z - movement.position.z) > 1) ins.push(sample(p, 2)); }
    const inside = ins.sort((u, w) => lum(...u) - lum(...w))[0], outside = [sample(polar(a + off, mid, R.y)), sample(polar(a - off, mid, R.y))];
    const Li = lum(...inside), res = outside.map(o => { const Lo = lum(...o); return +((Math.max(Li, Lo) + .05) / (Math.min(Li, Lo) + .05)).toFixed(2); });
    return { inside: inside.map(Math.round), outside: outside.map(o => o.map(Math.round)), ratio: res };
  },
  budget() { // draws/tris of guardian + bells + bands alone
    const keep = new Set(); for (const o of [guardian.actor, bells]) o.traverse(n => keep.add(n)); scene.traverse(n => { if (n.name === 'guardian-lane-bands') keep.add(n); });
    const hidden = []; scene.traverse(o => { if ((o.isMesh) && o.visible && !keep.has(o)) { hidden.push(o); o.visible = false; } });
    const auto = renderer.info.autoReset; renderer.info.autoReset = false; renderer.info.reset(); renderer.render(scene, camera); const r = { draws: renderer.info.render.calls, tris: renderer.info.render.triangles }; renderer.info.autoReset = auto; hidden.forEach(o => o.visible = true); return r;
  },
};
window.__READY__ = true;
