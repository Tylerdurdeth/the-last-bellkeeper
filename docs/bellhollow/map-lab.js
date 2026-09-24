// Map lab: the real Bellhollow world (world.js + adapt-world + look, as main builds it) with the chart in the HUD corner.
// ?at=start|loft|millSails|millLadders|skyBridge|hollowGate|arena  ?expanded=1  ?reveal=route|all|none  ?yaw=rad  ?tier=min
import * as THREE from 'three';
import { ASSET } from '../assetlib.js';
import { createArtDirection } from '../art-direction.js';
import { buildBellhollow } from './world.js';
import { adaptWorld } from './adapt-world.js';
import { createLook } from '../render/look.js';
import { createMap } from './map.js';
import { createVillagers } from './villagers.js';
const q = new URLSearchParams(location.search);
const canvas = document.getElementById('world'), mapCanvas = document.getElementById('map');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#94b4ae'); scene.fog = new THREE.FogExp2('#94b4ae', .012);
const camera = new THREE.PerspectiveCamera(42, 1, .1, 400);
scene.add(new THREE.HemisphereLight(0xffefcd, 0x274d54, 1.8)); const sun = new THREE.DirectionalLight(0xffe1ae, 2.4); sun.position.set(-9, 30, 8); sun.castShadow = true; scene.add(sun, sun.target);
const art = createArtDirection(THREE, renderer);
const world = adaptWorld(await buildBellhollow({ THREE, scene, loadAsset: ASSET, art }), { THREE });
const look = q.get('look') === '0' ? null : createLook({ THREE, renderer, scene, camera, tier: q.get('tier') || undefined });
const P = world.points, at = P[q.get('at') || 'start'] || P.start, yaw = +(q.get('yaw') ?? Math.atan2(.615, .788));
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
camera.position.set(at.x + Math.sin(yaw) * 11, at.y + 8, at.z + Math.cos(yaw) * 11); camera.lookAt(at.x, at.y + 1, at.z);
world.update?.(0, 0, {});
if (look) { look.update(1, { area: 'terrace-dawn' }); look.render(); } else renderer.render(scene, camera);
const villagers = q.get('villagers') === '1' ? createVillagers({ THREE, scene, world, look }) : null;
const restoredQ = +(q.get('restored') || 0);
const map = createMap({ THREE, renderer, scene, world, canvas: mapCanvas, look, lowTier: q.get('tier') === 'min' });
const bakeMs = map.bake();
// Exploration so far: reveal along the route up to this anchor.
const ROUTE = ['start', 'morningBell', 'mara', 'seedWheel', 'terraceGate', 'loft', 'sailsGust', 'millSails', 'millPipes', 'laddersGust1', 'laddersGust2', 'laddersGust3', 'millLadders', 'skyBridge', 'hollowGate', 'carvingOut', 'carvingReturn', 'arena', 'ring2', 'ring3'];
const reveal = q.get('reveal') || 'route', stop = ROUTE.indexOf(q.get('at') || 'start');
if (reveal === 'all') map.revealAll();
else if (reveal === 'route') for (let i = 0; i <= Math.max(0, stop); i++) { const a = P[ROUTE[i]], b = P[ROUTE[i + 1]] || a; if (!a) continue; for (let k = 0; k <= 6; k++) map.update(0, { hero: { x: a.x + (b.x - a.x) * k / 6 * (i < stop ? 1 : 0), y: a.y + (b.y - a.y) * k / 6 * (i < stop ? 1 : 0), z: a.z + (b.z - a.z) * k / 6 * (i < stop ? 1 : 0) } }); }
const progress = { bell: true, bypass: true, staff: true, seed: stop > 3, loft: stop > 5, sails: stop > 7, pipes: stop > 8, ladders: stop > 12, skyBridge: stop > 13, hollow: stop > 13, carvingOut: stop > 15, carvingReturn: stop > 16 };
const objective = P[ROUTE[Math.min(ROUTE.length - 1, stop + (q.get('far') ? 6 : 2))]];
if (q.get('expanded') === '1') { mapCanvas.classList.add('expanded'); map.setExpanded(true); }
let t = 0, last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
  if (look) { look.update(dt, { area: world.area(at) === 'hollow' ? 'hollow' : world.area(at) === 'branches' ? 'branches-day' : 'terrace-dawn' }); look.render(); } else renderer.render(scene, camera);
  villagers?.update(dt, t, { hero: at, restored: { terrace: restoredQ, sails: restoredQ, pipes: restoredQ, ladders: restoredQ }, gentle: false });
  map.update(dt, { hero: at, heroYaw: yaw + Math.PI, camYaw: yaw, objective, progress, fragments: [] }); map.draw();
  document.getElementById('info').textContent = JSON.stringify({ ...map.telemetry(), bounds: undefined, bakeMs: +bakeMs.toFixed(1) });
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.__MAPLAB__ = { map, world, villagers, renderer, ready: true, bakeMs, save: () => map.serialize(), png: i => map.levelImages[i].toDataURL() };
