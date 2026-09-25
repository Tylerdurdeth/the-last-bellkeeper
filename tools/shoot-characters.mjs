// Character evidence at the real gameplay camera: each villager and Mara (full 1920x1080 frame + a 2x close-up crop of the
// character), and the hero from behind while running (coat tails). Usage: node tools/shoot-characters.mjs [outDir] [only]
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const out = process.argv[2] || 'evidence/characters-2026-09-25', only = process.argv[3] || ''; await fs.mkdir(out, { recursive: true });
const U = process.env.URL || ('http://127.0.0.1:4173/the-last-bellkeeper/' + (process.env.VILLAGERS ? '?villagers=1' : '')), sleep = ms => new Promise(r => setTimeout(r, ms));
const W = 1920, H = 1080, DPR = +(process.env.DPR || 1.5);
const b = await puppeteer.launch({ headless: true, args: ['--use-angle=metal'] }); const p = await b.newPage(); await p.setViewport({ width: W, height: H, deviceScaleFactor: DPR });
p.on('pageerror', e => console.log('pageerror', e.message));
await p.evaluateOnNewDocument(() => { const t = new EventTarget(); t.addEventListener('observe', e => { const o = e.detail; if (o.isScene) window.__SCENE__ ??= o; if (o.isWebGLRenderer) { window.__R__ = o; const r = o.render.bind(o); o.render = (s, c) => { if (s === window.__SCENE__) window.__CAM__ = c; return r(s, c); }; } }); window.__THREE_DEVTOOLS__ = t; });
await p.goto(U); await p.waitForFunction(() => window.__BELLHOLLOW__);
const P = await p.evaluate(() => window.__BELLHOLLOW__.points);
async function boot(at, progress = { bell: true, bypass: true, staff: true, seed: true }) {
  await p.evaluate((c, pr) => localStorage.setItem('bellkeeper-adventure-v2', JSON.stringify({ version: 2, checkpoint: c, quest: { version: 2, progress: pr, reached: {}, fragments: [], seen: ['vent', 'firstCatch'] } })), at, progress);
  await p.goto(U); await p.waitForFunction(() => !document.querySelector('#continueb').hidden, { timeout: 60000 }); await p.click('#continueb'); await sleep(2500);
}
async function bootNear(x, y, z) { // checkpoint must be within 0.35 m of the ground: try a few heights
  for (const dy of [0, .15, .3, -.15]) { await boot([x, y + dy, z]); const g = await p.evaluate(() => window.__GAME__.pos); if (Math.hypot(g[0] - x, g[1] - z) < .6) return true; }
  return false;
}
async function walkTo(wps) { // like a player: hold up (+Shift), steer with Q/E so "up" points at each waypoint [x, z, near]
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('ArrowUp'); let g = [0, 0];
  for (const [wx, wz, near] of wps) for (let i = 0; i < 60; i++) { g = await p.evaluate(() => window.__GAME__.pos); const dx = wx - g[0], dz = wz - g[1]; if (Math.hypot(dx, dz) < near) break;
    const want = Math.atan2(-dx, -dz), y = await p.evaluate(() => window.__GAME__.cameraYaw), d = Math.atan2(Math.sin(want - y), Math.cos(want - y)); for (let j = 0; j < Math.min(4, Math.floor(Math.abs(d) / .13)); j++) await p.keyboard.press(d < 0 ? 'KeyQ' : 'KeyE'); await sleep(60); }
  await p.keyboard.up('ArrowUp'); await p.keyboard.up('ShiftLeft'); await sleep(900); return g;
}
const ring = (x0, z0, x1, z1, r = 20.3, n = 8) => { const a0 = Math.atan2(x0, z0), a1 = Math.atan2(x1, z1), out = []; for (let k = 1; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; out.push([Math.sin(a) * r, Math.cos(a) * r, 1.2]); } return out; };
async function faceYaw(want) { // Q/E until the gameplay camera yaw is within half a step of want (camera sits at hero + (sin,cos)*L)
  for (let i = 0; i < 60; i++) { const y = await p.evaluate(() => window.__GAME__.cameraYaw); let d = Math.atan2(Math.sin(want - y), Math.cos(want - y)); if (Math.abs(d) < .07) break; await p.keyboard.press(d < 0 ? 'KeyQ' : 'KeyE'); await sleep(30); }
  await sleep(900);
}
const project = name => p.evaluate(n => { const T = window.__SCENE__, o = T.getObjectByName(n); if (!o) return null; const c = window.__CAM__; const box = { l: 1e9, r: -1e9, t: 1e9, b: -1e9 }; o.updateMatrixWorld(true); const v = o.position.clone();
  o.traverse(m => { if (!m.isMesh || m.userData.lookHull || !m.geometry.boundingBox && !m.geometry.computeBoundingBox()) {} if (!m.isMesh) return; m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox; for (let i = 0; i < 8; i++) { v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(m.matrixWorld).project(c); const x = (v.x * .5 + .5) * innerWidth, y = (-v.y * .5 + .5) * innerHeight; box.l = Math.min(box.l, x); box.r = Math.max(box.r, x); box.t = Math.min(box.t, y); box.b = Math.max(box.b, y); } });
  return box; }, name);
async function shoot(tag, name) {
  await p.screenshot({ path: `${out}/${tag}-gameplay.png` });
  const bx = await project(name); if (!bx) { console.log('missing', name); return; }
  const h = Math.max(120, bx.b - bx.t) * 1.35, cx = (bx.l + bx.r) / 2, cy = (bx.t + bx.b) / 2, w = h * .8;
  const clip = { x: Math.max(0, cx - w / 2), y: Math.max(0, cy - h / 2), width: Math.min(w, W - Math.max(0, cx - w / 2)), height: Math.min(h, H - Math.max(0, cy - h / 2)) };
  await p.screenshot({ path: `${out}/${tag}-closeup-2x.png`, clip: { ...clip, scale: 4 / 3 } });
  const fh = (bx.b - bx.t) * .3, fc = { x: cx - fh * .6, y: bx.t - fh * .1, width: fh * 1.2, height: fh * 1.1 };
  await p.screenshot({ path: `${out}/${tag}-face-4x.png`, clip: { ...fc, scale: 4 / DPR } });
  console.log(tag, 'px tall', Math.round(bx.b - bx.t));
}
// Villagers + Mara: hero stands ~2.6 m in front of each, camera looks across the hero at the character's front (±0.55 rad).
if (!only || /vill/.test(only)) {
  await boot([P.start.x, P.start.y, P.start.z]);
  await p.waitForFunction(() => window.__SCENE__?.getObjectByName('villagers')?.children.length, { timeout: 20000 }).catch(() => {});
  const vs = await p.evaluate(() => (window.__SCENE__.getObjectByName('villagers')?.children || []).filter(o => /^villager-/.test(o.name)).map(o => { const d = o.getWorldDirection(o.position.clone()); return { name: o.name, x: o.position.x, y: o.position.y, z: o.position.z, yaw: Math.atan2(d.x, d.z) }; }));
  // Villagers off (shipping default): shoot their former spots so a reviewer can confirm nothing empty/odd is left behind.
  const vacated = !vs.length; if (vacated) vs.push(...[['baker', -9.17, 11.36, -.68], ['elder', -20.01, 13.77, 2.17], ['girl', -15.04, 18.47, 2.46], ['seller', -11.1, 20.75, 2.65]].map(([n, x, z, yaw]) => ({ name: 'villager-' + n, x, y: 0, z, yaw })));
  console.log(JSON.stringify(vs));
  for (const v of vs) {
    if (only && only !== 'vill' && !v.name.includes(only.replace('vill-', ''))) continue;
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), side = [-1, 1];
    for (const s of side) {
      // walk from the start along the boardwalk ring, then step to a spot in front of the villager
      await boot([P.start.x, P.start.y, P.start.z]);
      const a = v.yaw + s * .6, hx = v.x + Math.sin(a) * 2.6, hz = v.z + Math.cos(a) * 2.6;
      await walkTo([...ring(P.start.x, P.start.z, hx, hz), [hx, hz, .8]]);
      const hero = await p.evaluate(() => ({ x: window.__GAME__.pos[0], z: window.__GAME__.pos[1] }));
      // camera behind hero looking toward the villager, then swung so the villager is seen from the front three-quarter
      const toV = Math.atan2(v.x - hero.x, v.z - hero.z); await faceYaw(toV + Math.PI - s * .35);
      if (vacated) await p.screenshot({ path: `${out}/vacated-${v.name.replace('villager-', '')}-gameplay.png` }); else await shoot(`${v.name}-${s < 0 ? 'a' : 'b'}`, v.name);
      if (!process.env.BOTH) break;
    }
  }
}
if (!only || /mara/.test(only)) { // early game (before the staff handover): Mara at her post, read live from the scene
  await boot([P.start.x, P.start.y, P.start.z]);
  const m = await p.evaluate(() => { let o = null; window.__SCENE__.traverse(n => { if (!o && n.name === 'mara' && n.parent === window.__SCENE__) o = n; }); return { x: o.position.x, y: o.position.y, z: o.position.z, yaw: o.rotation.y }; }); console.log('P.mara', JSON.stringify(P.mara));
  const g = await walkTo([...ring(P.start.x, P.start.z, m.x, m.z), [m.x, m.z, 2.3]]); const hx = g[0], hz = g[1];
  console.log('mara', JSON.stringify(m), 'hero', hx.toFixed(2), hz.toFixed(2), await p.evaluate(() => { let o; window.__SCENE__.traverse(n => { if (!o && n.name === 'mara') o = n; }); let v = true; for (let q = o; q; q = q.parent) v = v && q.visible; return JSON.stringify({ vis: v, pos: o.position.toArray() }); }));
  const toM = Math.atan2(m.x - hx, m.z - hz); await faceYaw(toM + Math.PI - .35); await shoot('mara', 'mara');
}
if (!only || /hero/.test(only)) { // run along the open boardwalk (tangent to the ring) so the camera trails behind
  await boot([P.start.x, P.start.y, P.start.z]);
  const az = Math.atan2(P.start.x, P.start.z), tx = Math.cos(az), tz = -Math.sin(az);   // tangent, toward the market
  await faceYaw(Math.atan2(tx, tz));   // camera behind: forward = -(sin yaw, cos yaw) = -tangent
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('ArrowUp'); await sleep(900);
  for (const k of [0, 1, 2]) { await p.screenshot({ path: `${out}/hero-run-back-${k}-gameplay.png` }); const h = await p.evaluate(() => window.__CAMERA_PROBE__().hero); const pad = 90, cw = (h.r - h.l) + 2 * pad, ch = (h.b - h.t) + 2 * pad; await p.screenshot({ path: `${out}/hero-run-back-${k}-closeup-2x.png`, clip: { x: Math.max(0, h.l - pad), y: Math.max(0, h.t - pad), width: cw, height: ch, scale: 4 / 3 } }); await sleep(220); }
  await p.keyboard.up('ArrowUp'); await p.keyboard.up('ShiftLeft');
}
await b.close(); console.log('ok');
