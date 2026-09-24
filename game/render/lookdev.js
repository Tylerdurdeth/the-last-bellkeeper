// Look-dev bench for game/render/look.js. ?look=0 shows the v1 treatment (main.js lights + art-direction) for before/after.
// ?area=terrace-dawn|branches-day|hollow  ?restored=1  ?view=game|close|wide  ?tier=high|low|min  ?shot=1 (hide UI)
import * as THREE from 'three';
import { ASSET } from '../assetlib.js';
import { loadCodeCharacter } from '../code-character.js';
import buildApprovedHero from '../assets/hero-study-a.js';
import { createArtDirection } from '../art-direction.js';
import { createLook } from './look.js';

const q = new URLSearchParams(location.search);
const useLook = q.get('look') !== '0';
if (q.get('shot') === '1') document.body.classList.add('shot');
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
// v1 host lights exactly as main.js creates them (look adopts them).
scene.background = new THREE.Color('#94b4ae'); scene.fog = new THREE.FogExp2('#94b4ae', .030);
const hemi = new THREE.HemisphereLight(0xffefcd, 0x274d54, 1.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe1ae, 2.4); sun.position.set(-9, 20, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: .5, far: 65 }); sun.shadow.bias = -.0003; sun.shadow.normalBias = .025;
scene.add(sun, sun.target);

const std = (color, name, o = {}) => Object.assign(new THREE.MeshStandardMaterial({ color, roughness: .9, ...o }), { name });
const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

// Ground: grass vertex colours with an ivory path.
function ground() {
  const g = new THREE.PlaneGeometry(80, 80, 80, 80); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = [], a = new THREE.Color('#9CBF66'), b = new THREE.Color('#6E9C52'), path = new THREE.Color('#E3D3AE'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const n = Math.sin(x * .7 + Math.sin(z * .5)) * Math.sin(z * .6 + x * .2) * .5 + .5;
    c.copy(a).lerp(b, n);
    const px = Math.sin(z * .18) * 2.2 + 1.2;
    const d = Math.abs(x - px);
    c.lerp(path, 1 - THREE.MathUtils.smoothstep(d, 1.1, 1.7));
    p.setY(i, Math.sin(x * .21) * Math.cos(z * .17) * .12);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = mesh(g, std(0xffffff, 'ground', { vertexColors: true, roughness: 1 })); m.castShadow = false; return m;
}
function house(x, z, rot) {
  const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = rot; scene.add(h);
  const ivory = std('#F2E6C9', 'plaster'), timber = std('#C8894A', 'timber'), dark = std('#7A4E33', 'timber'), stone = std('#CDBB95', 'stone');
  mesh(new THREE.BoxGeometry(4.3, .5, 4.3), stone, 0, .25, 0, h);
  mesh(new THREE.BoxGeometry(4, 2.8, 4), ivory, 0, 1.9, 0, h);
  mesh(new THREE.BoxGeometry(3.6, 2.2, 3.6), ivory, .1, 4.3, 0, h).rotation.y = .03;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(.26, 2.9, .26), timber, sx * 2.02, 1.95, sz * 2.02, h);
  mesh(new THREE.BoxGeometry(4.3, .22, 4.3), timber, 0, 3.3, 0, h);
  for (const s of [-1, 1]) { const r = mesh(new THREE.BoxGeometry(4.6, .22, 2.9), dark, 0, 6.0, s * 1.08, h); r.rotation.x = s * .72; }
  mesh(new THREE.BoxGeometry(1.1, 2.0, .15), dark, -.6, 1.5, 2.02, h);
  const aw = mesh(new THREE.BoxGeometry(1.6, .08, .9), std('#D96956', 'fabric'), -.6, 2.75, 2.35, h); aw.rotation.x = .35;
  const win = mesh(new THREE.CircleGeometry(.42, 20), std('#6b4a2e', 'glass'), .95, 2.0, 2.01, h); win.userData.glow = true;
  mesh(new THREE.BoxGeometry(.5, 1.1, .5), stone, 1.2, 6.2, -.8, h);
  return h;
}
function trunk() {
  const t = new THREE.Group(); scene.add(t);
  mesh(new THREE.CylinderGeometry(4.6, 6.2, 34, 18, 4), std('#6E4B36', 'timber'), -10, 15, -15, t);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, r = 5 + (i % 3);
    const f = mesh(new THREE.IcosahedronGeometry(2.6 + (i % 2), 1), std(i % 3 ? '#5E8F4E' : '#6E9C52', 'foliage', { flatShading: true }), -10 + Math.cos(a) * r, 13 + (i % 4) * 1.5, -15 + Math.sin(a) * r, t);
    f.castShadow = true;
  }
  return t;
}
function bushes() {
  const leaf = std('#5E8F4E', 'foliage', { flatShading: true }), tip = std('#A6C46A', 'foliage', { flatShading: true });
  for (const [x, z, s] of [[-4.5, 2.5, 1], [3.8, 3, .8], [-6.5, -3, 1.3], [7, -1, 1.1], [-2, 5.5, .7], [2.2, -7.5, 1.2]]) {
    mesh(new THREE.IcosahedronGeometry(.9 * s, 1), leaf, x, .6 * s, z);
    mesh(new THREE.IcosahedronGeometry(.55 * s, 1), tip, x + .3 * s, 1.1 * s, z + .2 * s);
  }
}
function lanterns() {
  const g = new THREE.Group(); scene.add(g);
  const post = std('#7A4E33', 'timber'), cop = std('#3E9C8C', 'metal', { metalness: .35, roughness: .5 });
  mesh(new THREE.CylinderGeometry(.08, .1, 3, 8), post, -2.6, 1.5, -1.5, g); mesh(new THREE.CylinderGeometry(.08, .1, 3, 8), post, 2.4, 1.5, -2.4, g);
  const lamps = new THREE.Group(); g.add(lamps);
  for (let i = 0; i < 5; i++) {
    const t = i / 4, x = -2.6 + 5 * t, z = -1.5 - .9 * t, y = 2.85 - Math.sin(t * Math.PI) * .45;
    mesh(new THREE.SphereGeometry(.16, 12, 8), std('#b0874a', 'glass'), x, y, z, lamps);
    mesh(new THREE.CylinderGeometry(.07, .1, .08, 8), cop, x, y + .17, z, g);
  }
  // Copper pipe + wind ribbon (cyan is wind only).
  const pipe = mesh(new THREE.CylinderGeometry(.18, .18, 5, 12), cop, 5.2, .9, 1.2); pipe.rotation.z = Math.PI / 2; pipe.rotation.y = .6;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(3, .5, 3.5), new THREE.Vector3(2, 1.4, 2.2), new THREE.Vector3(2.6, 2.4, .8), new THREE.Vector3(1.6, 3.1, -.5)]);
  const ribbon = mesh(new THREE.TubeGeometry(curve, 40, .07, 6), std('#8FD3E0', 'wind', { transparent: false }));
  ribbon.castShadow = false;
  return { lamps, ribbon, window: null };
}

ground(); const trunkG = trunk(); bushes(); const houseA = house(-6.5, -3.5, .5), houseB = house(8.5, -9, -.35); const lamp = lanterns();
const assetURL = n => new URL(`../assets/${n}.js`, import.meta.url).href;
const [bell, bridge, guardian, character] = await Promise.all([
  ASSET(assetURL('sanctuary-bell'), { height: 3.2 }), ASSET(assetURL('bridge'), { height: 2.2 }), ASSET(assetURL('campaign-guardian'), { height: 4 }),
  loadCodeCharacter(buildApprovedHero),
]);
bell.position.set(-2.6, 0, 1.6); bell.rotation.y = .7; scene.add(bell);
bridge.position.set(9, 0, -4); bridge.rotation.y = .15; scene.add(bridge);
guardian.position.set(.6, 1, -6.5); guardian.rotation.y = .5; scene.add(guardian);
const hero = character.root; hero.rotation.y = .75; scene.add(hero);
hero.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

let look = null, art = null;
if (useLook) {
  look = createLook({ THREE, renderer, scene, camera, tier: q.get('tier') || undefined });
  look.applyTo(hero, 'character');
  look.applyTo(guardian, 'outline');
  look.applyTo(bell, 'outline');
  look.applyTo(houseA, 'outline'); look.applyTo(houseB, 'outline');
  look.applyTo(lamp.lamps, 'lantern'); look.applyTo(lamp.ribbon, 'wind');
  scene.traverse(o => { if (o.userData.glow) look.applyTo(o, 'lantern', { strength: 1.0 }); });
  // Atlas tiles on large surfaces only (style lock): trunk bark, ivory walls/plinths, timber frames.
  look.applyTo(trunkG.children[0], 'bark');
  for (const h of [houseA, houseB]) h.traverse(o => { if (o.isMesh && !o.userData.lookHull) { const n = o.material.name; if (n === 'plaster') look.applyTo(o, 'stone-wall'); else if (n === 'stone') look.applyTo(o, 'stone-floor'); else if (n === 'timber') look.applyTo(o, 'timber'); } });
  // Updraft column over a copper vent (wind material, streaks rising).
  const vent = mesh(new THREE.CylinderGeometry(.8, .8, .08, 24), std('#3E9C8C', 'metal', { metalness: .35, roughness: .5 }), 3.4, .04, 1.6);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(.75, .95, 5, 24, 1, true), look.windMaterial({ shape: 'column', length: 3, speed: .9 }));
  column.position.set(3.4, 2.55, 1.6); scene.add(column);
  await look.ready;
} else {
  art = createArtDirection(THREE, renderer);
  for (const o of [...scene.children]) if (o !== hero && !o.isLight) art.style(o);
  lamp.lamps.traverse(o => { if (o.isMesh) { o.material.emissive?.set('#E9B949'); o.material.emissiveIntensity = 1.2; } });
}

const views = {
  game: { pos: [6.3, 5.7, 8.1], at: [0, 1.0, 0] },
  close: { pos: [2.2, 1.9, 2.6], at: [0, 1.0, 0] },
  wide: { pos: [13, 9.5, 15], at: [-1, 2, -4] },
  face: { pos: [.75, 1.5, .85], at: [0, 1.42, 0] },
};
const state = { area: q.get('area') || 'terrace-dawn', restored: q.get('restored') === '1' ? 1 : 0, view: q.get('view') || 'game' };
function setView(v) { state.view = v; const c = views[v] || views.game; camera.position.fromArray(c.pos); camera.lookAt(...c.at); sun.target.position.set(...c.at); if (!useLook) sun.position.set(c.at[0] - 9, c.at[1] + 20, c.at[2] + 8); }
setView(state.view);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// UI
const ui = document.getElementById('ui');
const btn = (label, on, pressed) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { on(); sync(); }; b.pressedFn = pressed; ui.append(b); return b; };
const buttons = [
  ...['terrace-dawn', 'branches-day', 'hollow'].map(a => btn(a, () => state.area = a, () => state.area === a)),
  btn('restored', () => state.restored = state.restored ? 0 : 1, () => !!state.restored),
  ...Object.keys(views).map(v => btn(v, () => setView(v), () => state.view === v)),
  btn(useLook ? 'before (v1)' : 'after (v2)', () => { q.set('look', useLook ? '0' : '1'); location.search = q; }, () => false),
];
function sync() { for (const b of buttons) b.setAttribute('aria-pressed', String(b.pressedFn())); }
sync();

let last = performance.now(), t = 0, cpuMs = 0, frames = 0, frameMs = 0;
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now; t += dt;
  character.update(dt, 0);
  const c0 = performance.now();
  if (look) { look.update(dt, { area: state.area, restored: state.restored, t }); look.render(); }
  else { art.update(t, false); renderer.render(scene, camera); }
  cpuMs += performance.now() - c0; frameMs += dt * 1000; frames++;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Measurement helpers (used by evidence/v2/render/scripts/capture.mjs).
function pixels() {
  const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return { w, h, px };
}
const luma = (r, g, b) => (.2126 * r + .7152 * g + .0722 * b) / 255;
function valueStats() {
  const { w, h, px } = pixels(), L = new Float32Array(w * h);
  let sum = 0; for (let i = 0; i < w * h; i++) { L[i] = luma(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); sum += L[i]; }
  const s = Float32Array.from(L).sort(), n = s.length, k = Math.floor(n * .1);
  let lo = 0, hi = 0; for (let i = 0; i < k; i++) { lo += s[i]; hi += s[n - 1 - i]; }
  lo /= k; hi /= k;
  return { mean: sum / n, dark10: lo, bright10: hi, range: hi - lo, p10: s[k], p90: s[n - 1 - k] };
}
/** Dominant tones in a square crop centred on a world point: greedy RGB clustering (distance ≤ 20/255). */
function tones(world, size = 64) {
  const { w, h, px } = pixels(), v = new THREE.Vector3(...world).project(camera);
  const cx = Math.round((v.x * .5 + .5) * w), cy = Math.round((v.y * .5 + .5) * h), cl = [];
  for (let y = cy - size / 2; y < cy + size / 2; y++) for (let x = cx - size / 2; x < cx + size / 2; x++) {
    const i = (y * w + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2];
    let best = null; for (const c of cl) { const d = Math.hypot(c.r - r, c.g - g, c.b - b); if (d <= 20) { best = c; break; } }
    if (best) { best.n++; } else cl.push({ r, g, b, n: 1 });
  }
  cl.sort((a, b) => b.n - a.n); const total = size * size;
  return { box: [cx - size / 2, h - cy - size / 2, size], top3: cl.slice(0, 3).reduce((s, c) => s + c.n, 0) / total, clusters: cl.length, tones: cl.slice(0, 5).map(c => ({ rgb: [c.r, c.g, c.b], share: +(c.n / total).toFixed(3) })) };
}
/** GPU-bound cost: n synchronous frames with gl.finish (headless vsync hides real frame time). */
function bench(n = 60) {
  const gl = renderer.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const draw = () => { if (look) look.render(); else renderer.render(scene, camera); };
  for (let i = 0; i < 5; i++) draw(); sync();
  const t0 = performance.now(); for (let i = 0; i < n; i++) { draw(); sync(); } return (performance.now() - t0) / n;
}
function perf() { const r = { avgFrameMs: frameMs / frames, avgCpuRenderMs: cpuMs / frames, frames }; cpuMs = frameMs = frames = 0; return r; }
// Coat sample point: front of the torso, below the scarf (chest joint, 9 cm down, 12 cm toward the facing direction).
function chest() { const j = hero.children[0].userData.joints?.chest; const p = new THREE.Vector3(); (j || hero).getWorldPosition(p); p.y -= .09; p.x += Math.sin(hero.rotation.y) * .12; p.z += Math.cos(hero.rotation.y) * .12; return p.toArray(); }
window.__LOOKDEV__ = {
  ready: true, state, setView, sync, scene, renderer,
  setArea(a) { state.area = a; sync(); }, setRestored(r) { state.restored = r ? 1 : 0; sync(); },
  snap() { if (look) { look.update(10, { area: state.area, restored: state.restored }); for (let i = 0; i < 40; i++) look.update(.25, { area: state.area, restored: state.restored }); } },
  valueStats, tones, chest, perf, bench,
  info: () => ({ draws: renderer.info.render.calls, tris: renderer.info.render.triangles, programs: renderer.info.programs.length, tier: look?.tier ?? 'v1', buffer: [renderer.getContext().drawingBufferWidth, renderer.getContext().drawingBufferHeight] }),
};
