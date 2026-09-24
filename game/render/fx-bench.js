// Elements FX bench: real wind.js (catch source, updraft vent, chain gust over a gap, staff charge, give flights,
// a guardian-style breath lane) + lanterns + hero + guardian, with the look. ?fx=0 = previous cel ribbons (before).
// ?view=catch|updraft|gap|breath|wide  ?t=<seconds to pre-roll>  ?ui=0
import * as THREE from 'three';
import { ASSET } from '../assetlib.js';
import { loadCodeCharacter } from '../code-character.js';
import buildApprovedHero from '../assets/hero-study-a.js';
import { createWind } from '../bellhollow/wind.js';
import { createLook } from './look.js';

const q = new URLSearchParams(location.search), useFx = q.get('fx') !== '0';
if (q.get('ui') === '0') document.body.classList.add('shot');
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, .1, 160);
scene.fog = new THREE.FogExp2('#d9dccb', .016);
const hemi = new THREE.HemisphereLight(0xffefcd, 0x274d54, 1.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe1ae, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: .5, far: 65 }); scene.add(sun, sun.target);
const std = (color, name, o = {}) => Object.assign(new THREE.MeshStandardMaterial({ color, roughness: .9, ...o }), { name });
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; scene.add(o); return o; };
// Two decks with a gap (pipe gust crosses it), ivory walls, a vent grille, mist sea below.
const deck = std('#C8894A', 'timber'), ivory = std('#F2E6C9', 'plaster'), cop = std('#3E9C8C', 'metal', { metalness: .35, roughness: .5 });
mesh(new THREE.BoxGeometry(12, .4, 10), deck, -3, -.2, 0); mesh(new THREE.BoxGeometry(6, .4, 6), deck, 9, -.2, -1);
mesh(new THREE.BoxGeometry(5, 4, 1), ivory, -5, 2, -5); mesh(new THREE.BoxGeometry(1, 4, 5), ivory, -9, 2, -2.5);
mesh(new THREE.CylinderGeometry(1.1, 1.1, .08, 24), cop, 1.5, .04, -2);
mesh(new THREE.CylinderGeometry(.25, .25, 3, 12), cop, -6.5, 1.5, 2.5);
const sea = mesh(new THREE.CircleGeometry(170, 40), Object.assign(std('#E8EEE6', 'mist'), { userData: { bhKey: 'mist' } }), 0, -26, 0); sea.rotation.x = -Math.PI / 2; sea.castShadow = false;
// Lanterns in the life.js layout (instanced, named 'bh-lanterns-*', lit material) → fire FX attaches automatically.
const glass = Object.assign(new THREE.MeshStandardMaterial({ color: 0xF6D9B0, roughness: .5, emissive: 0xE9B949, emissiveIntensity: 1.5 }), { name: 'glass' });
const lanterns = new THREE.InstancedMesh(new THREE.CylinderGeometry(.16, .13, .36, 6), glass, 4); lanterns.name = 'bh-lanterns-bench';
[[-3.5, 2.2, -3.2], [-1, 2.4, -3.6], [4.5, 2.1, -3], [7.5, 2.3, -3.4]].forEach((p, i) => lanterns.setMatrixAt(i, new THREE.Matrix4().makeTranslation(...p)));
scene.add(lanterns);

const [character, guardian] = await Promise.all([loadCodeCharacter(buildApprovedHero), ASSET(new URL('../assets/bh-guardian.js', import.meta.url).href, { keepHierarchy: true, height: 4 })]);
const hero = character.root; hero.position.set(-1.5, 0, 1.6); hero.rotation.y = .9; scene.add(hero);
guardian.position.set(8.5, 1, -2.5); guardian.rotation.y = -.8; scene.add(guardian);

const look = createLook({ THREE, renderer, scene, camera, tier: q.get('tier') || 'high' });
look.applyTo(hero, 'character'); look.applyTo(guardian, 'outline', { dynamic: true, occluder: false });
const wind = createWind({ THREE, scene });
if (useFx) look.fx.wind.attach(wind.mesh);
else { wind.mesh.name = 'bench-wind-before'; look.fx.wind.points.visible = false; }   // keep the look's auto-attach off
await look.ready;

// Gameplay-like state: a catchable source, a vent reopened every 4 s, a chain flow over the gap, give flights.
wind.addSource('outlet', { x: -3.4, y: 0, z: 2.2, radius: 1.5 });
const vent = { id: 'v1', x: 1.5, y: 0, z: -2, top: 5.5, radius: 1.1 };
const outlet = { x: 8, y: 0, z: 0.5, radius: 1.3 };
wind.powerWheel('w1', { outlet, delay: .6 }); wind.chainFrom('w1', new THREE.Vector3(-6.5, 3, 2.5));
const staffTip = new THREE.Vector3();
const views = { lantern: [[-1.6, 2.9, -0.6], [-2.2, 2.2, -3.3]], catch: [[-1.4, 3.6, 7.6], [-2.6, .9, 1.9]], updraft: [[4.5, 4.4, 7], [1.5, 2.2, -2]], gap: [[5, 6.5, 10], [2.5, 1.8, 0]], breath: [[3, 4.5, 8], [7, 2, -1.5]], wide: [[6.3, 8, 14], [1, 1.5, -1]] };
const [cp, ct] = views[q.get('view')] || views.wide;
camera.position.set(...cp); camera.lookAt(...ct); sun.target.position.set(...ct);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

let t = 0, nextVent = 0, nextGive = 1, nextBreath = 2;
function step(dt) {
  t += dt; character.update(dt, 0);
  hero.children[0].userData.joints?.rightHand?.getWorldPosition(staffTip) ?? staffTip.set(-1.2, 1.3, 1.8);
  if (t >= nextVent) { wind.openVent(vent, { duration: 7.8 }); nextVent = t + 8; }
  if (t >= nextGive) { wind.setCharge('outlet'); wind.release('give', staffTip.clone(), new THREE.Vector3(4.5, 1.2, -3), { lift: 1.5 }); nextGive = t + 1.6; }
  wind.setCharge(t % 3 < 1.5 ? 'outlet' : null);
  wind.update(dt, t, { hero: hero.position, staffTip, camera });
  // guardian-style breath: a wide sweeping lane of strips from the guardian toward the deck
  if (t >= nextBreath - 1.2) {
    const k = Math.max(0, Math.sin(Math.PI * Math.min(1, (t - (nextBreath - 1.2)) / 1.2)));
    for (let i = -3; i <= 3; i++) wind.strip(28, (f, o) => o.set(8.5 - f * 7, 2.6 - f * 2.2 + Math.sin(f * 6 + t * 4 + i) * .2, -2.5 + i * .35 + f * 3.5), { width: .5, alpha: .9 * k });
    if (t >= nextBreath) nextBreath = t + 3;
  }
  if (useFx) { const st = wind.state().vents?.v1 ?? 0; if (st > .01) look.fx.wind.setUpdraft('v1', { ...vent, strength: st }); }
  wind.flush();
  look.update(dt, { area: 'terrace-dawn', restored: 0, t }); look.render();
}
for (let i = 0, n = +(q.get('t') || 2.5) * 60; i < n; i++) step(1 / 60);
let last = performance.now();
function frame(now) { step(Math.min(.05, (now - last) / 1000)); last = now; requestAnimationFrame(frame); }
requestAnimationFrame(frame);
window.__LOOKDEV__ = { ready: true, info: () => ({ draws: renderer.info.render.calls, tris: renderer.info.render.triangles, fx: look.fx.wind.stats(), flames: look.fx.fire.count }) };
