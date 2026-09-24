// Dev-only standalone Bellhollow viewer (not part of gameplay).
// ?shot=<name>  gameplay-angle camera (SE, ~40°, 11 m) on a named anchor
// ?free=1       orbit/fly: drag = orbit, wheel = zoom, WASD/QE = move target
// ?planks=0..3 &restored=0..1 &gate=0..1 &sail=0..1 &pipes=0..1 &shutter=0..1 &hollow=0..1 &hud=0
import * as T from 'three';
import {buildBellhollow} from './world.js';

const q = new URLSearchParams(location.search), num = (k, d) => (q.has(k) ? +q.get(k) : d);
const canvas = document.getElementById('c');
const renderer = new T.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new T.Scene();
{ // dawn gradient sky
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#BFE1EA'); gr.addColorStop(.55, '#E9EEDC'); gr.addColorStop(1, '#F6D9B0'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; scene.background = tex;
}
scene.fog = new T.Fog(0xE8E4D2, 70, 300);
const hemi = new T.HemisphereLight(0xFFF3DA, 0x2C4A45, 1.25); scene.add(hemi);
const sun = new T.DirectionalLight(0xFFE2B8, 2.4); sun.position.set(40, 60, 35); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, {left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 200}); sun.shadow.bias = -.0006; sun.shadow.normalBias = .04;
scene.add(sun, sun.target);
const camera = new T.PerspectiveCamera(num('fov', 42), 1, .1, 900);

const t0 = performance.now();
const world = buildBellhollow({THREE: T, scene});
const buildMs = performance.now() - t0;
const state = {skyPlanks: num('planks', 0), terraceGate: num('gate', 0), sailBridge: num('sail', 0), ladderShutter: num('shutter', 0), hollowGate: num('hollow', 0), sailsCap: num('cap', 0), pipesValve: num('valve', 0), frag2: num('frag2', 0),
  wind: {wheels: {pipesA: num('flow', 0)}}, restored: Object.fromEntries([0, 1, 2, 3].map((i) => ['carving' + i, num('carve', 0) * (i < num('carves', 4) ? 1 : 0)]))};
const rest = num('restored', 0); for (const a of ['terrace', 'sails', 'pipes', 'ladders', 'hollow', 'finale']) world.setRestored(a, num('r-' + a, rest));
world.update(10, 0, state); for (let i = 0; i < 20; i++) world.update(.5, i * .5, state);

const P = world.points, W = P.guardianWell.rings;
const SHOTS = {
  start: P.start, morningBell: P.morningBell, mara: P.mara, seedWheel: P.seedWheel, gate: P.terraceGate, loftVent: P.loftVent, loft: P.loftLedge,
  sailsBranch: P.sails.source, sailsBridge: P.sails.bridgeFrom, sailsMill: P.sails.restore,
  pipesBranch: P.pipes.branchStart, pipesWheels: P.pipes.wheelA, pipesGap: P.pipes.gapFrom, pipesMill: P.pipes.restore,
  laddersL0: P.ladders.ledge0, laddersL1: P.ladders.ledge1, laddersL2: P.ladders.ledge2, laddersMill: P.ladders.restore,
  skyBridge: P.bridge.stages[1].mid, hollowGate: P.hollowGate, gallery: P.gallery.carvings[1].stand, galleryLow: P.gallery.bottom,
  wellHigh: W.high.safe, wellMid: W.mid.safe, wellLow: W.low.safe,
  sailsCap: P.sails.capSail, valve: P.pipes.valve, frag1: P.fragment1, frag2: P.fragment2, frag2From: P.sails.frag2From, frag3: P.fragment3, frag3Jump: P.pipes.frag3From, wellTop: W.top, carving0: P.gallery.carvings[0].stand, carving1: P.gallery.carvings[1].stand, gallerySource: P.gallery.source,
};
const shotName = q.get('shot') || 'start';
const target = new T.Vector3();
// Defaults = main.js gameplay camera: yaw atan2(.615,.788), pitch atan(.48), arm 10.8 (11.5 portrait), focus 1 m up, 0.8 m ahead.
const GAME_PITCH = Math.atan(.48) * 180 / Math.PI, GAME_ARM = () => (innerHeight > innerWidth ? 11.5 : 10.8);
let yaw = Math.atan2(.615, .788), pitch = num('pitch', GAME_PITCH) * Math.PI / 180, dist = num('dist', GAME_ARM());
const special = {
  overview: () => { target.set(-2, 4, 6); dist = 95; pitch = 34 * Math.PI / 180; },
  overviewWest: () => { target.set(-18, 6, 4); dist = 70; pitch = 28 * Math.PI / 180; yaw = -.35; },
  terraceView: () => { const v = P.terraceView; camera.position.copy(v.pos); camera.lookAt(v.target); return true; },
  sailsMillWide: () => { target.copy(P.sails.mill).add(new T.Vector3(0, -2, 0)); dist = 19; pitch = 18 * Math.PI / 180; },
  hollowWide: () => { target.set(0, -6, 0); dist = 36; pitch = 30 * Math.PI / 180; },
};
function applyShot(name) {
  yaw = Math.atan2(.615, .788); pitch = num('pitch', GAME_PITCH) * Math.PI / 180; dist = num('dist', GAME_ARM());
  if (special[name]) { if (special[name]()) return 'fixed'; } else target.copy(SHOTS[name] || P.start).add(new T.Vector3(-Math.sin(yaw) * .8, 1, -Math.cos(yaw) * .8));
  return 'orbit';
}
let mode = applyShot(shotName);
const free = q.has('free');
function place() {
  if (mode === 'fixed') return;
  const c = Math.cos(pitch) * dist; camera.position.set(target.x + Math.sin(yaw) * c, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * c); camera.lookAt(target);
}
// input (free mode or any drag)
let drag = null; const keys = new Set();
canvas.addEventListener('pointerdown', (e) => { drag = {x: e.clientX, y: e.clientY}; mode = 'orbit'; });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointermove', (e) => { if (!drag) return; yaw -= (e.clientX - drag.x) * .005; pitch = Math.max(-.3, Math.min(1.5, pitch + (e.clientY - drag.y) * .005)); drag = {x: e.clientX, y: e.clientY}; });
canvas.addEventListener('wheel', (e) => { dist = Math.max(2, Math.min(260, dist * (1 + Math.sign(e.deltaY) * .1))); mode = 'orbit'; }, {passive: true});
addEventListener('keydown', (e) => keys.add(e.code)); addEventListener('keyup', (e) => keys.delete(e.code));
const shotsDiv = document.getElementById('shots');
if (q.get('hud') !== '0') for (const n of [...Object.keys(special), ...Object.keys(SHOTS)]) { const b = document.createElement('button'); b.textContent = n; b.onclick = () => { mode = applyShot(n); }; shotsDiv.appendChild(b); }
else { document.getElementById('hud').classList.add('hide'); shotsDiv.remove(); }

function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let last = performance.now(), frames = 0, t = 0;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
  if (keys.size) { const f = new T.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), r = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), s = dt * (keys.has('ShiftLeft') ? 30 : 10);
    if (keys.has('KeyW')) target.addScaledVector(f, s); if (keys.has('KeyS')) target.addScaledVector(f, -s); if (keys.has('KeyD')) target.addScaledVector(r, s); if (keys.has('KeyA')) target.addScaledVector(r, -s);
    if (keys.has('KeyE')) target.y += s; if (keys.has('KeyQ')) target.y -= s; mode = 'orbit'; }
  world.update(dt, t, state);
  place();
  sun.position.copy(target).add(new T.Vector3(40, 60, 35)); sun.target.position.copy(target);
  renderer.render(scene, camera);
  frames++;
  const info = renderer.info.render;
  window.__BH__ = {ready: frames > 3, buildMs: Math.round(buildMs), stats: world.stats, draws: info.calls, tris: info.triangles, shot: shotName, cam: camera.position.toArray().map((v) => +v.toFixed(1)), zone: world.zoneAt(target.x, target.y - 1, target.z)};
  if (frames % 15 === 0 && q.get('hud') !== '0') document.getElementById('hud').textContent = `Bellhollow preview  build ${Math.round(buildMs)} ms\ndraws ${info.calls}  tris ${info.triangles}\nshot ${shotName}  zone ${window.__BH__.zone}\ndrag orbit · wheel zoom · WASD/QE move`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
void free;
