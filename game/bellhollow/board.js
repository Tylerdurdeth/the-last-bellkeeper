// Dev-only beauty board frame: the real Bellhollow world + hero (+ guardian in the well) at main.js's
// gameplay camera (fov 42, yaw atan2(.615,.788), pitch atan(.48), arm 10.8 / 11.5 portrait, focus 1 m up
// and 0.8 m ahead) with main's host lights and the render worker's look (toon, outline, sky, fog).
//   board.html?shot=<name>  (see BOARD)   &look=0 for plain lights
import * as T from 'three';
import {buildBellhollow} from './world.js';
import {ASSET} from '../assetlib.js';
import {loadCodeCharacter} from '../code-character.js';
import buildHero from '../assets/hero-study-a.js';
import {createLook} from '../render/look.js';

const q = new URLSearchParams(location.search), useLook = q.get('look') !== '0';
const renderer = new T.WebGLRenderer({canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new T.Scene(); scene.background = new T.Color('#bfe1ea'); scene.fog = new T.FogExp2('#d9dccb', .016);
const camera = new T.PerspectiveCamera(42, 1, .1, 400);
const hemi = new T.HemisphereLight(0xffefcd, 0x2c4a45, 1.8); scene.add(hemi);
const sun = new T.DirectionalLight(0xffe1ae, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {left: -16, right: 16, top: 16, bottom: -16, near: .5, far: 65}); sun.shadow.bias = -.0003; sun.shadow.normalBias = .025; scene.add(sun, sun.target);

const world = buildBellhollow({THREE: T, scene, loadAsset: ASSET});
const P = world.points, W = P.guardianWell.rings;
const OPEN = {terraceGate: 1, sailBridge: 1, ladderShutter: 1, skyPlanks: 3, hollowGate: 1};
// [name, anchor, world state, restored areas, look area, fixed camera?]
const BOARD = {
  street: [P.start, {}, {}, 'terrace-dawn'],
  maraWorkshop: [P.maraLever, {}, {}, 'terrace-dawn'],
  maraOutlet: [P.maraOutlet, {}, {}, 'terrace-dawn'],
  morningBell: [P.morningBell, {}, {}, 'terrace-dawn'],
  gateOpen: [P.seedOutlet, {terraceGate: 1}, {terrace: 1}, 'terrace-dawn'],
  loftLip: [P.loftLedge, OPEN, {terrace: 1}, 'terrace-dawn'],
  seedWheelGate: [P.seedWheel, {terraceGate: 1}, {terrace: 1}, 'terrace-dawn'],
  loftVent: [P.loftVent, OPEN, {terrace: 1}, 'terrace-dawn'],
  loft: [P.loftLedge, OPEN, {terrace: 1}, 'terrace-dawn'],
  sailsBridge: [P.sails.bridgeFrom, OPEN, {terrace: 1}, 'branches-day'],
  sailsMillIdle: [P.sails.restore, {...OPEN, sailsCap: 0}, {terrace: 1}, 'branches-day'],
  sailsCapSail: [P.sails.capSail, {...OPEN, sailsCap: 0}, {terrace: 1}, 'branches-day'],
  sailsMillRestored: [P.sails.restore, {...OPEN, sailsCap: 1}, {terrace: 1, sails: 1}, 'branches-day'],
  pipesValve: [P.pipes.valve, {...OPEN, pipesValve: 0, wind: {wheels: {pipesA: 1}}}, {terrace: 1}, 'branches-day'],
  pipesMillIdle: [P.pipes.restore, OPEN, {terrace: 1}, 'branches-day'],
  pipesMillRestored: [P.pipes.restore, {...OPEN, pipesValve: 1}, {terrace: 1, pipes: 1}, 'branches-day'],
  laddersShutter: [P.ladders.ledge1, {...OPEN, ladderShutter: 0}, {terrace: 1}, 'branches-day'],
  laddersMillRestored: [P.ladders.restore, OPEN, {terrace: 1, ladders: 1}, 'branches-day'],
  fragment1: [P.fragment1, OPEN, {terrace: 1}, 'terrace-dawn'],
  frag2FromSail: [P.sails.frag2From, OPEN, {terrace: 1}, 'branches-day'],
  sailsLanding: [P.sails.bridgeTo, OPEN, {terrace: 1}, 'branches-day'],
  fragment2: [P.fragment2, {...OPEN, frag2: 1}, {terrace: 1}, 'branches-day'],
  fragment3: [P.fragment3, OPEN, {terrace: 1}, 'branches-day'],
  skyBridge: [P.bridge.stages[1].mid, OPEN, {terrace: 1, sails: 1, pipes: 1, ladders: 1}, 'branches-day'],
  hollowGate: [P.hollowGate, OPEN, {terrace: 1}, 'hollow'],
  galleryCarvings: [P.gallery.carvings[0].stand, {...OPEN, restored: {carving0: 1}}, {}, 'hollow'],
  wellHigh: [W.high.safe, OPEN, {}, 'hollow'],
  wellMid: [W.mid.safe, OPEN, {}, 'hollow'],
  wellLow: [W.low.safe, OPEN, {}, 'hollow'],
  topPerch: [W.top, OPEN, {}, 'hollow'],
  pairedBells: [P.pairedBells.stand, OPEN, {hollow: .5}, 'hollow'],
  finale: [P.terraceView.maraStand, OPEN, {terrace: 1, sails: 1, pipes: 1, ladders: 1, hollow: 1, finale: 1}, 'terrace-dawn', P.terraceView],
};
const name = BOARD[q.get('shot')] ? q.get('shot') : 'street';
const [anchor0, wstate, rest, area, fixed] = BOARD[name];
const anchor = anchor0.clone();
for (const [a, v] of Object.entries(rest)) world.setRestored(a, v);
world.update(10, 0, wstate); for (let i = 0; i < 20; i++) world.update(.5, i * .5, wstate);
const restoredAll = Math.max(0, ...Object.values(rest));

const [character, guardian] = await Promise.all([loadCodeCharacter(buildHero), ASSET(new URL('../assets/bh-guardian.js', import.meta.url).href, {keepHierarchy: true, height: 4}).catch(() => null)]);
const hero = character.root; hero.position.copy(anchor); hero.rotation.y = .6 + Math.PI; scene.add(hero);
hero.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
if (guardian) { guardian.position.set(0, -13, 0); scene.add(guardian); }
let look = null;
if (useLook) { look = createLook({THREE: T, renderer, scene, camera}); look.applyTo(hero, 'character'); if (guardian) look.applyTo(guardian, 'outline', {dynamic: true, occluder: false}); await look.ready; }
const portrait = () => camera.aspect < .85;
function place() {
  if (fixed) { camera.position.copy(fixed.pos); camera.lookAt(fixed.target); sun.target.position.copy(fixed.target); return; }
  const yaw = Math.atan2(.615, .788), pitch = Math.atan(.48), L = portrait() ? 11.5 : 10.8, sx = Math.sin(yaw), sz = Math.cos(yaw);
  const target = anchor.clone().add(new T.Vector3(-sx * .8, 1, -sz * .8));
  camera.position.set(target.x + sx * Math.cos(pitch) * L, target.y + Math.sin(pitch) * L, target.z + sz * Math.cos(pitch) * L);
  camera.lookAt(target); sun.target.position.copy(target); sun.position.copy(target).add(new T.Vector3(-9, 20, 8));
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); place(); }
addEventListener('resize', resize); resize();
let last = performance.now(), t = 0, frames = 0;
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now; t += dt; frames++;
  character.update(dt, 0); world.update(dt, t, wstate);
  if (look) { look.setFocus({hero: hero.position}); look.update(frames < 3 ? 5 : dt, {area, restored: restoredAll, t}); look.render(); } else renderer.render(scene, camera);
  window.__BH__ = {ready: frames > 30, shot: name, draws: renderer.info.render.calls, tris: renderer.info.render.triangles, stats: world.stats, buildMs: world.stats.buildMs};
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.getElementById('hud').classList.add('hide'); document.getElementById('shots').remove();
export const SHOTS = Object.keys(BOARD);
