// World look bench: the real Bellhollow world (game/bellhollow/world.js) + hero + guardian model at the gameplay camera
// (main.js: fov 42, yaw atan2(.615,.788), pitch atan(.48), arm 10.8 m / 11.5 m portrait, focus 1 m above the anchor).
// ?shot=<anchor> (see SHOTS)  ?restored=1  ?look=0 (world preview's plain lights, for before/after)  ?tier=  ?shot=1 hides UI
import * as THREE from 'three';
import { buildBellhollow } from '../bellhollow/world.js';
import { ASSET } from '../assetlib.js';
import { loadCodeCharacter } from '../code-character.js';
import buildApprovedHero from '../assets/hero-study-a.js';
import { createLook } from './look.js';

const q = new URLSearchParams(location.search), useLook = q.get('look') !== '0';
if (q.has('hud') || q.get('ui') === '0') document.body.classList.add('shot');
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, .1, 160);   // main.js values
// Host lights exactly as main.js v2 creates them (look adopts them).
scene.background = new THREE.Color('#d9dccb'); scene.fog = new THREE.FogExp2('#d9dccb', .016);
const hemi = new THREE.HemisphereLight(0xffefcd, 0x274d54, 1.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe1ae, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: .5, far: 65 }); sun.shadow.bias = -.0003; sun.shadow.normalBias = .025;
scene.add(sun, sun.target);

const t0 = performance.now();
const world = buildBellhollow({ THREE, scene, loadAsset: ASSET });
const buildMs = performance.now() - t0;
const restored = +(q.get('restored') || 0);
for (const a of ['terrace', 'sails', 'pipes', 'ladders', 'hollow', 'finale']) world.setRestored(a, restored);
const wstate = { skyPlanks: restored ? 3 : 1, terraceGate: 1, sailBridge: 1, pipesBridge: 1, ladderShutter: 1, hollowGate: 1 };
world.update(10, 0, wstate); for (let i = 0; i < 20; i++) world.update(.5, i * .5, wstate);

const P = world.points, W = P.guardianWell.rings;
// Anchors are read defensively: the world module is still moving; missing ones are skipped.
const get = f => { try { return f(); } catch { return undefined; } };
const SHOTS = Object.fromEntries(Object.entries({
  start: () => P.start, morningBell: () => P.morningBell, mara: () => P.maraLever, seedWheel: () => P.seedWheel, loftVent: () => P.loftVent, loft: () => P.loftLedge,
  sailsBranch: () => (P.sails ?? P.millSails).source, sailsBridge: () => (P.sails ?? P.millSails).bridgeFrom, sailsMill: () => (P.sails ?? P.millSails).restore,
  pipesBranch: () => (P.pipes ?? P.millPipes).branchStart, pipesMill: () => (P.pipes ?? P.millPipes).restore,
  laddersLedge1: () => (P.ladders ?? P.millLadders).ledge1, laddersMill: () => (P.ladders ?? P.millLadders).restore, skyBridge: () => (P.skyBridge?.stages ?? P.bridge?.stages)?.[1]?.mid ?? P.bridge?.start,
  hollowGate: () => P.hollowGate, gallery: () => P.gallery.carvings[1].stand, wellHigh: () => W.high.safe, wellMid: () => W.mid.safe, wellLow: () => W.low.safe,
}).map(([k, f]) => [k, get(f)]).filter(([, v]) => v));
const AREA = { terrace: 'terrace-dawn', loft: 'terrace-dawn', skybridge: 'branches-day', sails: 'branches-day', pipes: 'branches-day', ladders: 'branches-day', hollow: 'hollow', well: 'hollow' };
const shot = q.get('shot') && SHOTS[q.get('shot')] ? q.get('shot') : 'start';
const anchor = SHOTS[shot].clone ? SHOTS[shot].clone() : new THREE.Vector3(...SHOTS[shot]);
const zone = world.zoneAt(anchor.x, anchor.y + .2, anchor.z);
const area = q.get('area') || AREA[zone] || 'terrace-dawn';

const [character, guardian] = await Promise.all([loadCodeCharacter(buildApprovedHero), ASSET(new URL('../assets/bh-guardian.js', import.meta.url).href, { keepHierarchy: true, height: 4 })]);
const hero = character.root; hero.position.copy(anchor); hero.rotation.y = .6; scene.add(hero);
hero.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
const well = P.guardianWell.center ?? new THREE.Vector3(0, -14, 0);
guardian.position.set(well.x ?? 0, (W.low.safe.y ?? -14) + 1, well.z ?? 0); scene.add(guardian);

let look = null;
if (useLook) {
  look = createLook({ THREE, renderer, scene, camera, tier: q.get('tier') || undefined, beauty: q.get('beauty') !== '0' });
  look.applyTo(hero, 'character'); look.applyTo(guardian, 'outline', { dynamic: true, occluder: false });
  await look.ready;
}
const portrait = () => camera.aspect < .85;
function place() {
  const yaw = Math.atan2(.615, .788), pitch = Math.atan(.48), L = portrait() ? 11.5 : 10.8, target = anchor.clone().add(new THREE.Vector3(0, 1, 0));
  camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * L, target.y + Math.sin(pitch) * L, target.z + Math.cos(yaw) * Math.cos(pitch) * L);
  camera.lookAt(target); sun.target.position.copy(target);
  if (!useLook) sun.position.set(target.x - 9, target.y + 20, target.z + 8);
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); place(); }
addEventListener('resize', resize); resize();

let last = performance.now(), t = 0;
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now; t += dt;
  character.update(dt, 0); world.update(dt, t, wstate);
  if (look) { look.setFocus(q.get('fade') === '0' ? null : { hero: hero.position }); look.update(dt, { area, restored, t }); look.render(); } else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function pixels() { const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return { w, h, px }; }
function valueStats() {
  const { w, h, px } = pixels(), n = w * h, L = new Float32Array(n); let sum = 0;
  for (let i = 0; i < n; i++) { L[i] = (.2126 * px[i * 4] + .7152 * px[i * 4 + 1] + .0722 * px[i * 4 + 2]) / 255; sum += L[i]; }
  L.sort(); const k = Math.floor(n * .1); let lo = 0, hi = 0; for (let i = 0; i < k; i++) { lo += L[i]; hi += L[n - 1 - i]; }
  return { mean: sum / n, dark10: lo / k, bright10: hi / k, range: (hi - lo) / k };
}
function bench(n = 40) {
  const gl = renderer.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const draw = () => { if (look) look.render(); else renderer.render(scene, camera); };
  for (let i = 0; i < 5; i++) draw(); sync(); const a = performance.now(); for (let i = 0; i < n; i++) { draw(); sync(); } return (performance.now() - a) / n;
}
window.__LOOKDEV__ = {
  ready: true, scene, renderer, probe: () => look?.focusProbe(), valueStats, bench, shot, zone, area,
  snap() { if (look) for (let i = 0; i < 40; i++) look.update(.25, { area, restored }); },
  perf: () => ({}), info: () => ({ draws: renderer.info.render.calls, tris: renderer.info.render.triangles, tier: look?.tier ?? 'v1', buildMs: Math.round(buildMs), worldStats: world.stats, shot, zone, area }),
};
