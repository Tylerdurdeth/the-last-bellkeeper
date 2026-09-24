// Full v2 route with ordinary input: arrows/Shift/A/Space on desktop (1280x720), or the touch
// stick plus the Jump and action buttons with --touch (390x844). No state manipulation: the page
// is only read (window.__GAME__, plain-data anchors in window.__BELLHOLLOW__). Paths between
// anchors are planned by tools/route-planner.mjs over the same world module built in node and
// kept in the game's current state, so the driver follows the real layout (stub or world.js).
//   node tools/test-v2-route.mjs [outDir] [--touch] [--query=?world=1&guardian=1]
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { createPlanner } from './route-planner.mjs';
import { adaptWorld } from '../game/bellhollow/adapt-world.js';
const touch = process.argv.includes('--touch');
const out = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || `evidence/v2/systems/route-${touch ? 'touch' : 'keyboard'}`;
const query = (process.argv.find(a => a.startsWith('--query=')) || '--query=').slice(8);
await fs.mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(), client = await page.createCDPSession();
await page.setViewport(touch ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1280, height: 720 });
const result = { kind: 'Known-route real-input regression (not a human playtest)', touch, query, errors: [], steps: [], shots: [], beats: [], started: new Date().toISOString() };
page.on('pageerror', e => result.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) result.errors.push(`${r.status()} ${r.url()}`); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const read = () => page.evaluate(() => window.__GAME__);
let held = [], stick = null, stickActive = false, shotN = 0, t0 = Date.now();
const beat = label => { result.beats.push({ label, s: +((Date.now() - t0) / 1000).toFixed(1) }); console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${label}`); };
async function hold(keys) {
  if (touch) { if (stickActive && !keys.length) { await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); stickActive = false; } return; }
  for (const k of held) if (!keys.includes(k)) await page.keyboard.up(k);
  for (const k of keys) if (!held.includes(k)) await page.keyboard.down(k);
  held = keys;
}
async function steer(dx, dz, d, yaw) {
  const sx = dx * Math.cos(yaw) - dz * Math.sin(yaw), sy = -dx * Math.sin(yaw) - dz * Math.cos(yaw), n = Math.hypot(sx, sy) || 1, m = Math.min(1, Math.max(.3, d * .8));
  if (!stickActive) { await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: stick.x, y: stick.y }] }); stickActive = true; }
  stickPoint = { x: stick.x + sx / n * stick.r * m, y: stick.y - sy / n * stick.r * m };
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, ...stickPoint }] });
}
async function shot(name) { const file = `${String(++shotN).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: `${out}/${file}` }); result.shots.push(file); }
async function burst(name, n = 3, ms = 180) { for (let i = 0; i < n; i++) { await shot(`${name}-${i + 1}`); await sleep(ms); } }
async function waitFor(fn, label, timeout = 15000, arg) { try { await page.waitForFunction(fn, { timeout, polling: 50 }, arg); } catch { throw Error('Timed out waiting: ' + label + ' ' + JSON.stringify(await read()).slice(0, 900)); } }
// Touch jump is a second finger: the stick finger stays down (two thumbs), unlike page.tap.
let stickPoint = null;
async function jump() {
  if (!touch) return page.keyboard.press('KeyA');
  const j = await page.evaluate(() => { const r = document.querySelector('#jump').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (!stickActive || !stickPoint) return page.tap('#jump');
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, ...stickPoint }, { id: 2, ...j }] });
  await sleep(40);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id: 1, ...stickPoint }] });
}
// Arrow keys only give 8 directions; alternate between the two nearest each poll, weighted by
// angle, so the averaged heading follows the path (a player corrects continuously too).
const OCT = [['ArrowRight'], ['ArrowRight', 'ArrowUp'], ['ArrowUp'], ['ArrowLeft', 'ArrowUp'], ['ArrowLeft'], ['ArrowLeft', 'ArrowDown'], ['ArrowDown'], ['ArrowRight', 'ArrowDown']];
function dither(sx, sy) { const a = (Math.atan2(sy, sx) / (Math.PI / 4) + 8) % 8, lo = Math.floor(a), f = a - lo; return OCT[(Math.random() < f ? lo + 1 : lo) % 8]; }
// Steer toward (x,z). keep: don't release input on arrival (path following). jumpWhen(g): one jump.
async function go(x, z, label, { tol = .45, jumpWhen = null, walk = false, timeout = 400, keep = false } = {}) {
  let stuck = 0, old = await read(), jumped = false, best = Infinity, sinceBest = 0;
  for (let i = 0; i < timeout; i++) {
    const g = await read(), dx = x - g.pos[0], dz = z - g.pos[1], d = Math.hypot(dx, dz);
    if (d < best - .05) { best = d; sinceBest = 0; } else if (++sinceBest > 55 && !g.knocked && !g.lifting) { await hold([]); return { recovered: true }; } // circling: re-plan
    if (g.recovered) return { recovered: true };
    if (d < tol) { if (!keep) { await hold([]); await sleep(100); } return g; }
    if (jumpWhen && !jumped && jumpWhen(g)) { jumped = true; await jump(); }
    if (touch) await steer(dx, dz, d, g.cameraYaw);
    else {
      const sx = dx * Math.cos(g.cameraYaw) - dz * Math.sin(g.cameraYaw), sy = -dx * Math.sin(g.cameraYaw) - dz * Math.cos(g.cameraYaw), keys = d > 1.4 && !walk || jumpWhen ? ['ShiftLeft'] : [];
      keys.push(...dither(sx, sy)); await hold(keys);
    }
    await sleep(50);
    const n = await read(); if (n.recoveredCount > (g.recoveredCount ?? 0)) return { recovered: true };
    if (n.knocked) { // knock-back clears the game's input: release our keys so they are pressed afresh, then re-plan
      await hold([]); held = []; await waitFor(() => !window.__GAME__.knocked && window.__GAME__.grounded, 'knock settled', 6000); return { recovered: true }; }
    stuck = Math.hypot(n.pos[0] - old.pos[0], n.pos[1] - old.pos[1]) < .01 && !n.knocked && !n.lifting && !n.introActive && !n.finaleActive ? stuck + 1 : 0; old = n;
    if (stuck === 12 || stuck === 30) { // pinned on a corner: side-step briefly, like a player would
      const a = Math.atan2(dx, dz) + (stuck === 12 ? Math.PI / 2 : -Math.PI / 2); await hold([]);
      for (let j = 0; j < 5; j++) { const h = await read(); if (touch) await steer(Math.sin(a), Math.cos(a), 1, h.cameraYaw); else { const sx = Math.sin(a) * Math.cos(h.cameraYaw) - Math.cos(a) * Math.sin(h.cameraYaw), sy = -Math.sin(a) * Math.sin(h.cameraYaw) - Math.cos(a) * Math.cos(h.cameraYaw), k = []; if (Math.abs(sx) > .414 * Math.abs(sy)) k.push(sx > 0 ? 'ArrowRight' : 'ArrowLeft'); if (Math.abs(sy) > .414 * Math.abs(sx)) k.push(sy > 0 ? 'ArrowUp' : 'ArrowDown'); await hold(k); } await sleep(60); }
      await hold([]); if (stuck === 30) return { recovered: true }; // re-plan from here
    }
    if (stuck > 45) { await shot('blocked'); throw Error(`Blocked going to ${label}: ` + JSON.stringify({ pos: n.pos, y: n.y, mode: n.mode, ctx: n.contextId })); }
  }
  throw Error('Did not reach ' + label + ' ' + JSON.stringify((await read()).pos));
}
// ---- node-side world mirror + planner ----
let W = null;
async function mirror() {
  const g = await read();
  for (let i = 0; i < 150; i++) W.update(1 / 60, i / 60, { wind: { push: g.wind.push, wheels: g.wind.wheels }, restored: g.restoration });
  return g;
}
// Travel on foot to (near) p, re-planning after a recovery. Jumps: run up through the takeoff.
async function travel(p, label, { tol = .6 } = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await waitFor(() => window.__GAME__.grounded && !window.__GAME__.knocked, 'grounded before planning', 8000);
    const g = await mirror(), from = { x: g.pos[0], y: g.y, z: g.pos[1] };
    const planner = createPlanner(W), r = planner.plan(from, p);
    if (!r.ok) throw Error(`No path for ${label}: ${r.reason} from ${JSON.stringify(from)} to ${JSON.stringify(p)}`);
    const wps = planner.waypoints(r.path);
    let fell = false;
    for (let i = 1; i < wps.length; i++) {
      const w = wps[i], prev = wps[i - 1], last = i === wps.length - 1;
      if (prev.kind === 'jump' && (await read()).speed < 4.5) {
        // Too slow for the gap: back up along the jump line for a run-up, then run through the lip.
        const L = Math.hypot(w.x - prev.x, w.z - prev.z) || 1, back = planner.snap({ x: prev.x - (w.x - prev.x) / L * 2.4, y: prev.y, z: prev.z - (w.z - prev.z) / L * 2.4 });
        if (back) { await go(back.ix * .5, back.iz * .5, label + ' (run-up)', { tol: .4 }); await go(prev.x, prev.z, label + ' (to lip)', { tol: .45, keep: true }); }
      }
      const res = prev.kind === 'jump'
        ? await go(w.x, w.z, label + ' (jump)', { tol: .7, keep: !last, jumpWhen: () => true })
        : await go(w.x, w.z, label, { tol: last ? tol : .55, keep: !last, walk: false });
      if (res.recovered) { fell = true; const e = await read(); console.log(`  ${label}: re-plan at [${e.pos.map(v => v.toFixed(1))}] y=${e.y.toFixed(1)} heading to wp ${i}/${wps.length - 1} [${w.x},${w.y},${w.z}] ${prev.kind}->`); await shot('replan-' + label.replace(/\W+/g, '-')); result.steps.push({ label: label + ': recovered, re-planning' }); await hold([]); await sleep(900); break; }
    }
    if (!fell) { const e = await read(); result.steps.push({ label, pos: e.pos, y: +e.y.toFixed(2) }); return e; }
  }
  throw Error('Kept falling on the way to ' + label);
}
async function press(expectId, label) {
  await hold([]);
  await waitFor(id => window.__GAME__?.contextId === id && !document.querySelector('#action').disabled, `context ${expectId}`, 7000, expectId);
  const g = await read(); result.steps.push({ label: label || expectId, context: g.contextLabel, objective: g.objective });
  if (touch) await page.tap('#action'); else await page.keyboard.press('Space');
}
async function waitSource(id, timeout = 15000) { await waitFor(s => window.__GAME__?.wind.sources.some(x => x.id === s), 'gust ' + id, timeout, id); return (await read()).wind.sources.find(s => s.id === id); }
async function catchAt(id, name) { const s = await waitSource(id); await travel(s, 'catch ' + id, { tol: .5 }); await press(id); if (name) await burst(name, 3, 160); await waitFor(() => window.__GAME__.charged, 'charged ' + id, 3000); }
async function giveAt(target, id, name) { await travel(target, 'give ' + id, { tol: .9 }); await press(id); if (name) await burst(name, 3, 200); }
async function ride(vent, name) {
  // Board the grille, wait for its column, rise, steer onto the ledge. Knocked off, or the column
  // ran out mid-steer (timed guardian columns)? Go back and ride the next one.
  const deadline = Date.now() + 70000;
  for (let attempt = 0; ; attempt++) {
    if (Date.now() > deadline) throw Error('never rode ' + vent.id + ' ' + JSON.stringify(await read()).slice(0, 400));
    const r = await go(vent.x, vent.z, 'onto grille ' + vent.id, { tol: .3, walk: true });
    if (r.recovered) { await waitFor(() => !window.__GAME__.knocked && window.__GAME__.grounded, 'settle', 6000).catch(() => {}); continue; }
    await page.waitForFunction((y, x, z, rr) => { const g = window.__GAME__; return g.lifting && g.y > y || Math.hypot(g.pos[0] - x, g.pos[1] - z) > rr; }, { timeout: 12000, polling: 50 }, vent.ledge.y + .3, vent.x, vent.z, (vent.radius || .8) + .3).catch(() => {});
    let g = await read();
    if (!(g.lifting && g.y > vent.ledge.y + .3)) { await waitFor(() => !window.__GAME__.knocked && window.__GAME__.grounded, 'settle', 6000).catch(() => {}); continue; }
    if (name && attempt === 0) await burst(name, 2, 220);
    await go(vent.ledge.x, vent.ledge.z, 'steer onto ledge ' + vent.id, { tol: .7 });
    const landed = await page.waitForFunction(y => window.__GAME__.grounded && !window.__GAME__.lifting, { timeout: 6000, polling: 50 }).then(() => true, () => false);
    g = await read();
    if (landed && Math.abs(g.y - vent.ledge.y) < .1) return;
    result.steps.push({ label: `fell short of ${vent.id} ledge (y ${g.y.toFixed(1)}), riding again` });
  }
}
async function releaseInto(vent, name) { await travel(vent, 'grille ' + vent.id, { tol: .5 }); await press(vent.id, 'release into ' + vent.id); if (name) await burst(name, 2, 180); await ride(vent, name && name.replace('release', 'rise')); }

// ---- boot ----
await page.goto('http://127.0.0.1:4173/the-last-bellkeeper/' + query, { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ && window.__BELLHOLLOW__ && !document.querySelector('#startb').disabled, { timeout: 60000 });
result.ready = (Date.now() - t0) / 1000;
const B = await page.evaluate(() => window.__BELLHOLLOW__);
W = B.stub ? await (await import('../game/bellhollow/stub-world.js')).buildBellhollow({ THREE, scene: new THREE.Scene() })
  : adaptWorld(await (await import('../game/bellhollow/world.js')).buildBellhollow({ THREE, scene: new THREE.Scene() }), { THREE });
const P = W.points, vent = id => W.vents.find(v => v.id === id), wheel = id => W.wheels.find(v => v.id === id), sail = id => W.sails.find(v => v.id === id);
const measure = () => page.evaluate(() => { const r = document.querySelector('#stick').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width * .36 }; });
if (touch) await page.tap('#startb'); else await page.click('#startb');
await sleep(800); t0 = Date.now();
if (touch) { stick = await measure(); await steer(0, -1, 1, 0); await sleep(150); await hold([]); stick = await measure(); } else await page.keyboard.press('ArrowUp');
await waitFor(() => !window.__GAME__.introActive, 'intro skipped (move-to-skip)', 5000); await sleep(300);

// ---- Terrace ----
beat('terrace');
await travel(P.morningBell, 'morning bell', { tol: 1.2 }); await press('morningBell'); await burst('bell-ring', 2, 400);
await waitFor(() => window.__GAME__.quest.bypass, 'bypass', 6000);
await travel(P.mara, 'Mara', { tol: 1.4 }); await press('staff'); await burst('mara-gives-staff', 2, 400);
await catchAt('mara', 'catch-mara-gust'); await shot('held-charge');
await giveAt(wheel('seed'), 'seed', 'give-seed-wheel'); await sleep(1500); await shot('gate-open');
await catchAt('chain:seed', 'catch-chain-seed');
await releaseInto(vent('loft'), 'release-loft'); await sleep(300); await shot('loft-view'); beat('loft reached');
// ---- Mill of Sails ----
await catchAt(W.points.sailsSource ? 'sailsSource' : 'loftGust');
await travel(P.sails?.bridgePush || { x: sail('sailsBridge').x + 3, y: P.loft.y, z: sail('sailsBridge').z }, 'bridge push spot', { tol: .8 }); await press('sailsBridge', 'push bridge'); await burst('push-bridge', 4, 220);
await sleep(1500); await shot('bridge-placed');
await catchAt('sailsGust'); await giveAt(W.points.millSails, 'millSails', 'give-mill-sails'); await sleep(1200); await shot('mill-sails-restored'); beat('mill of sails');
// ---- Mill of Pipes ----
await catchAt(W.points.pipesSource ? 'pipesSource' : 'loftGust');
await giveAt(wheel('pipesA'), 'pipesA', 'chain-pipes-a');
await catchAt('chain:pipesA', 'catch-chain-a'); await shot('gap-crossed');
await giveAt(wheel('pipesB'), 'pipesB', 'chain-pipes-b');
await catchAt('chain:pipesB'); await giveAt(W.points.millPipes, 'millPipes'); await sleep(1400); await shot('mill-pipes-restored'); beat('mill of pipes');
// ---- Mill of Ladders ----
await catchAt('laddersGust1'); await releaseInto(vent('ladders1'), 'release-ladders1');
await catchAt('laddersGust2'); await releaseInto(vent('ladders2'), 'release-ladders2');
await catchAt('laddersGust3'); await giveAt(sail('laddersShutter'), 'laddersShutter', 'push-shutter'); await sleep(800); await shot('shutter-countdown');
await catchAt('laddersGust3'); await releaseInto(vent('ladders3'), 'release-ladders3');
await catchAt('laddersTop'); await giveAt(W.points.millLadders, 'millLadders'); await sleep(1400); await shot('mill-ladders-restored'); beat('mill of ladders');
// ---- Sky bridge, Hollow gallery ----
await travel(P.skyBridge, 'sky bridge start'); await shot('sky-bridge');
await travel(P.hollowGate, 'hollow gate', { tol: 1.2 }); beat('hollow');
await travel(P.carvingOut, 'carving out', { tol: 1 }); await press('carvingOut'); await shot('carving-out');
await travel(P.carvingReturn, 'carving return', { tol: 1 }); await press('carvingReturn'); await shot('carving-return');
await travel(P.ring1, 'down into the well', { tol: 1 }); beat('guardian');
// ---- Guardian: dodge, catch its spent breath, turn the vanes ----
for (let phase = 0; phase < 3; phase++) {
  if (phase === 1) await ride(vent('ring1'), 'ride-ring1');
  if (phase === 2) { await travel(vent('ring2'), 'pulse grille', { tol: .4 }); await ride(vent('ring2'), 'ride-pulse'); }
  await waitFor(() => window.__GAME__.quest.guardian?.stage === 'inhale', 'inhale', 25000); await shot(`guardian-inhale-${phase + 1}`);
  await waitFor(() => window.__GAME__.quest.guardian?.stage === 'exhale', 'exhale', 8000); await sleep(200); await shot(`guardian-exhale-${phase + 1}`);
  if ((await read()).knocked) { result.steps.push({ label: 'knocked back by the breath (safe, no progress lost)' }); await shot(`guardian-knock-${phase + 1}`); }
  await waitFor(() => !window.__GAME__.knocked, 'knock settled', 6000);
  for (let tries = 0; tries < 4; tries++) {
    const s = await waitSource('guardianBreath', 30000);
    try { await travel(s, 'breath', { tol: .5 }); await press('guardianBreath'); await waitFor(() => window.__GAME__.charged, 'caught breath', 2500); break; }
    catch (e) { if (tries === 3) throw e; result.steps.push({ label: 'missed the breath window, waiting for the next', err: String(e.message).slice(0, 120) }); await waitFor(() => !window.__GAME__.wind.sources.some(x => x.id === 'guardianBreath'), 'breath gone', 15000).catch(() => {}); }
  }
  if (!(await read()).charged) throw Error('never caught the guardian breath in phase ' + phase);
  await burst(`guardian-catch-${phase + 1}`, 1);
  await giveAt(P['vane' + (phase + 1)], 'vane', `vane-${phase + 1}`);
  await waitFor(n => window.__GAME__.quest.guardian?.phase >= n, 'vane turned', 5000, phase + 1);
}
beat('guardian calmed');
// ---- Paired bells, finale, Mara ----
await travel(P.bellOut, 'paired bells', { tol: 1 }); await press('bellOut'); await sleep(1000); await press('bellReturn'); beat('finale');
for (let i = 0; i < 6; i++) { await sleep(1900); await shot(`finale-${i + 1}`); }
await waitFor(() => window.__GAME__.quest.finale, 'finale done', 12000); await sleep(1500); await shot('terrace-with-mara');
await travel(P.morningBell, 'morning bell (finale)', { tol: 1.2 }); await press('morningBell', 'ring with Mara'); await sleep(1200); await shot('bell-rings-clear');
await waitFor(() => window.__GAME__.score === 1, 'complete', 5000); await sleep(7600); await shot('complete-card'); beat('complete');
await hold([]);
const end = await read();
result.finished = new Date().toISOString(); result.playSeconds = +((Date.now() - t0) / 1000).toFixed(1); result.end = { quest: end.quest, draws: end.draws, tris: end.tris, stub: end.stubWorld };
await fs.writeFile(`${out}/route.json`, JSON.stringify(result, null, 1));
await browser.close();
console.log(`PASS v2 route (${touch ? 'touch' : 'keyboard'}, ${end.stubWorld ? 'stub' : 'world.js'}) play ${result.playSeconds} s, ${result.shots.length} shots, errors: ${result.errors.length}`);
if (result.errors.length) { console.log(result.errors); process.exit(1); }
