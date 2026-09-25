// People lab (dev page): hero, Mara and the four villagers side by side on ivory cobbles with the real look (toon, ink,
// occluder rules). URL: ?who=all|hero|mara|baker|elder|girl|seller  ?view=game (gameplay camera: 10.8 m arm, pitch
// atan .48, fov 42) | close (full-body) | face   ?yaw=deg (camera around the subject, 0 = front)  ?t=seconds (freeze time)
// ?act=idle|worried|cheer|wave.  window.__lab = {ready, names}
import * as THREE from 'three';
import { createLook } from '../render/look.js';
import buildMara from '../assets/bh-mara.js';
import buildVillager from '../assets/bh-villager.js';
import { loadNpcMotion, createNpcMotion } from '../npc-motion.js';
import { VILLAGER_CLIPS } from './villagers.js';
const q = new URLSearchParams(location.search), T = THREE;
const canvas = document.getElementById('c');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
const scene = new T.Scene(); scene.background = new T.Color('#BFE1EA'); scene.fog = new T.FogExp2('#d8e6e0', .004);
const camera = new T.PerspectiveCamera(42, 1, .05, 400);
scene.add(new T.HemisphereLight(0xffefcd, 0x5a6e5a, 1.4));
const sun = new T.DirectionalLight(0xffe1ae, 2.6); sun.position.set(-8, 16, 9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 60 }); sun.shadow.bias = -.0003; sun.shadow.normalBias = .03; scene.add(sun, sun.target);
const ground = new T.Mesh(new T.CircleGeometry(30, 64).rotateX(-Math.PI / 2), Object.assign(new T.MeshStandardMaterial({ color: '#E9DCBC', roughness: .95 }), { name: 'stone' }));
ground.receiveShadow = true; scene.add(ground);
const wall = new T.Mesh(new T.BoxGeometry(14, 3.2, .6), Object.assign(new T.MeshStandardMaterial({ color: '#F2E6C9', roughness: .9 }), { name: 'plaster' })); wall.position.set(0, 1.6, -2.2); wall.castShadow = wall.receiveShadow = true; scene.add(wall);
const who = q.get('who') || 'all', cast = who === 'all' ? ['hero', 'mara', 'baker', 'elder', 'girl', 'seller'] : who.split(',');
const people = {}, drives = {}; let heroChar = null; const npc = q.get('anim') === '0' ? null : await loadNpcMotion();
for (const [i, n] of cast.entries()) {
  let o;
  if (n === 'hero') { const { loadCodeCharacter } = await import('../code-character.js'); const { default: b } = await import('../assets/hero-study-a.js'); heroChar = await loadCodeCharacter(b); o = heroChar.root; }
  else if (n === 'mara') o = buildMara(T); else { o = buildVillager(T, { who: n }); if (npc) drives[n] = createNpcMotion(T, o, npc, VILLAGER_CLIPS[n]); }
  o.name = n; o.position.set((i - (cast.length - 1) / 2) * 1.3, 0, 0); o.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = m.receiveShadow ?? true; });
  scene.add(o); people[n] = o;
}
const look = q.get('look') === '0' ? null : createLook({ THREE: T, renderer, scene, camera });
if (look) { for (const o of Object.values(people)) look.applyTo(o, 'character'); await look.ready; }
function frame() {
  const view = q.get('view') || 'close', yaw = +(q.get('yaw') || 0) * Math.PI / 180, box = new T.Box3();
  for (const [n, o] of Object.entries(people)) if (!q.get('focus') || q.get('focus') === n) box.expandByObject(o);
  const c = box.getCenter(new T.Vector3()), h = box.max.y - box.min.y, wdt = box.max.x - box.min.x;
  let dist, pitch, target = c.clone();
  if (view === 'game') { dist = 10.8; pitch = Math.atan(.48); target.set(c.x, box.min.y + 1, c.z); }
  else if (view === 'face') { const top = box.max.y; target.set(c.x, top - .16 * h, c.z); dist = h / 1.6 * .95 + .05; pitch = .08; }
  else { camera.fov = 30; dist = Math.max(h * 1.15, wdt * .62) / (2 * Math.tan(15 * Math.PI / 180)) + .3; pitch = .1; target.y = box.min.y + h * .5; }
  camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist); camera.lookAt(target);
  if (view === 'face') camera.fov = 22; camera.updateProjectionMatrix();
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); frame(); }
addEventListener('resize', resize); resize();
const fixed = q.has('t') ? +q.get('t') : null, act = q.get('act') || 'idle'; let t = 0, last = performance.now();
function tick(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; t = fixed ?? t + dt;
  for (const [n, o] of Object.entries(people)) { if (n === 'hero') heroChar.update(fixed != null ? 0 : dt, 0); else o.userData.setPose?.(n === 'mara' ? { t, idle: 1 } : { t, act, motion: drives[n] }); }
  look ? (look.update(dt, { area: 'terrace', t }), look.render()) : renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.__lab = { ready: true, names: Object.keys(people) };
