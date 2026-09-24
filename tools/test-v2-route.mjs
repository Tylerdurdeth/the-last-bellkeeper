// Full v2 route with ordinary input: arrows/Shift/A/Space on desktop (1280x720) or the touch
// stick, Jump and action buttons with --touch (390x844). No state manipulation: it only reads
// window.__GAME__ and the plain-data anchors in window.__BELLHOLLOW__. Waypoints between anchors
// follow the current world (stub layout until game/bellhollow/world.js lands).
//   node tools/test-v2-route.mjs [outDir] [--touch] [--query=?stub]
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const touch = process.argv.includes('--touch');
const out = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || `evidence/v2/systems/route-${touch ? 'touch' : 'keyboard'}`;
const query = (process.argv.find(a => a.startsWith('--query=')) || '--query=').slice(8);
await fs.mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(), client = await page.createCDPSession();
await page.setViewport(touch ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1280, height: 720 });
const result = { kind: 'Known-route real-input regression (not a human playtest)', touch, errors: [], steps: [], shots: [], started: new Date().toISOString() };
page.on('pageerror', e => result.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) result.errors.push(`${r.status()} ${r.url()}`); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const read = () => page.evaluate(() => window.__GAME__);
let held = [], stick = null, stickActive = false, shotN = 0;
async function hold(keys) {
  if (touch) { if (stickActive && !keys.length) { await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); stickActive = false; } return; }
  for (const k of held) if (!keys.includes(k)) await page.keyboard.up(k);
  for (const k of keys) if (!held.includes(k)) await page.keyboard.down(k);
  held = keys;
}
async function steer(dx, dz, d, yaw) {
  const sx = dx * Math.cos(yaw) - dz * Math.sin(yaw), sy = -dx * Math.sin(yaw) - dz * Math.cos(yaw), n = Math.hypot(sx, sy) || 1, m = Math.min(1, Math.max(.25, d * .8));
  if (!stickActive) { await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: stick.x, y: stick.y }] }); stickActive = true; }
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: stick.x + sx / n * stick.r * m, y: stick.y - sy / n * stick.r * m }] });
}
async function shot(name) { const file = `${String(++shotN).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: `${out}/${file}` }); result.shots.push(file); }
async function burst(name, n = 3, ms = 180) { for (let i = 0; i < n; i++) { await shot(`${name}-${i + 1}`); await sleep(ms); } }
async function waitFor(fn, label, timeout = 15000, arg) { try { await page.waitForFunction(fn, { timeout, polling: 50 }, arg); } catch { throw Error('Timed out waiting: ' + label + ' ' + JSON.stringify(await read())); } }
async function jump() { if (touch) { await hold([]); await page.tap('#jump'); } else await page.keyboard.press('KeyA'); }
// Walk/run toward (x,z). opts.jumpWhen(g) triggers one jump; opts.air keeps steering while airborne.
async function go(x, z, label, { tol = .45, jumpWhen = null, walk = false, timeout = 320 } = {}) {
  let stuck = 0, old = await read(), jumped = false;
  for (let i = 0; i < timeout; i++) {
    const g = await read(), dx = x - g.pos[0], dz = z - g.pos[1], d = Math.hypot(dx, dz);
    if (d < tol) { await hold([]); await sleep(120); result.steps.push({ label, pos: g.pos, y: +g.y.toFixed(2) }); return g; }
    if (jumpWhen && !jumped && jumpWhen(g)) { jumped = true; await jump(); }
    if (touch) await steer(dx, dz, d, g.cameraYaw);
    else {
      const sx = dx * Math.cos(g.cameraYaw) - dz * Math.sin(g.cameraYaw), sy = -dx * Math.sin(g.cameraYaw) - dz * Math.cos(g.cameraYaw), keys = d > 1.4 && !walk ? ['ShiftLeft'] : [];
      // Nearest of the 8 arrow directions (a diagonal only within 22.5 degrees of it).
      if (Math.abs(sx) > .414 * Math.abs(sy)) keys.push(sx > 0 ? 'ArrowRight' : 'ArrowLeft'); if (Math.abs(sy) > .414 * Math.abs(sx)) keys.push(sy > 0 ? 'ArrowUp' : 'ArrowDown'); await hold(keys);
    }
    await sleep(60);
    const n = await read(); stuck = Math.hypot(n.pos[0] - old.pos[0], n.pos[1] - old.pos[1]) < .01 && !n.knocked && !n.lifting ? stuck + 1 : 0; old = n;
    if (stuck > 40) { await shot('blocked'); throw Error(`Blocked going to ${label}: ` + JSON.stringify({ pos: n.pos, y: n.y, mode: n.mode, grounded: n.grounded, ctx: n.contextId, held, paused: n.paused, speed: n.speed })); }
  }
  throw Error('Did not reach ' + label + ' ' + JSON.stringify((await read()).pos));
}
async function press(expectId, label) {
  await hold([]);
  await waitFor(id => window.__GAME__?.contextId === id && !document.querySelector('#action').disabled, `context ${expectId}`, 6000, expectId);
  const g = await read(); result.steps.push({ label: label || expectId, context: g.contextLabel, objective: g.objective });
  if (touch) await page.tap('#action'); else await page.keyboard.press('Space');
}
async function waitSource(id) { await waitFor(s => window.__GAME__?.wind.sources.some(x => x.id === s), 'gust ' + id, 15000, id); return (await read()).wind.sources.find(s => s.id === id); }
async function catchAt(id, name) { const s = await waitSource(id); await go(s.x, s.z, 'catch ' + id, { tol: .6 }); await press(id); if (name) await burst(name, 3, 160); await waitFor(() => window.__GAME__.charged, 'charged ' + id, 3000); }
// Ride a column: step onto the grille, rise, then steer onto the ledge while hovering.
async function ride(vent, name) {
  await go(vent.x, vent.z, 'onto grille ' + vent.id, { tol: .35, walk: true });
  await waitFor(y => window.__GAME__.lifting && window.__GAME__.y > y, 'rise ' + vent.id, 6000, vent.ledge.y + .35);
  if (name) await burst(name, 2, 200);
  await go(vent.ledge.x, vent.ledge.z, 'steer onto ledge ' + vent.id, { tol: .6 });
  await waitFor(y => window.__GAME__.grounded && Math.abs(window.__GAME__.y - y) < .05, 'landed ' + vent.id, 5000, vent.ledge.y);
}

const t0 = Date.now();
await page.goto('http://127.0.0.1:4173/the-last-bellkeeper/' + query, { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ && window.__BELLHOLLOW__ && !document.querySelector('#startb').disabled, { timeout: 60000 });
result.ready = (Date.now() - t0) / 1000;
const W = await page.evaluate(() => window.__BELLHOLLOW__), P = W.points, vent = id => W.vents.find(v => v.id === id), wheel = id => W.wheels.find(v => v.id === id), sail = id => W.sails.find(v => v.id === id);
stick = await page.evaluate(() => { const r = document.querySelector('#stick').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width * .36 }; });
if (touch) await page.tap('#startb'); else await page.click('#startb');
await sleep(800);
// Move-to-skip: the first ordinary movement input ends the intro.
const measure = () => page.evaluate(() => { const r = document.querySelector('#stick').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width * .36 }; });
if (touch) { stick = await measure(); await steer(0, -1, 1, 0); await sleep(150); await hold([]); stick = await page.evaluate(() => { const r = document.querySelector('#stick').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width * .36 }; }); }
else await page.keyboard.press('ArrowUp');
await waitFor(() => !window.__GAME__.introActive, 'intro skipped', 5000);
await sleep(400);

// ---- Terrace ----
await go(P.morningBell.x + 1.2, P.morningBell.z + 1.2, 'morning bell'); await press('morningBell'); await burst('bell-ring', 2, 400);
await waitFor(() => window.__GAME__.quest.bypass, 'bypass', 6000);
await go(P.mara.x - 1.1, P.mara.z + 1.1, 'Mara'); await press('staff'); await sleep(900);
await catchAt('mara', 'catch-mara-gust'); await shot('held-charge');
await go(P.seedWheel.x + .8, P.seedWheel.z + 1.6, 'seed wheel'); await press('seed', 'give seed wheel'); await burst('give-seed-wheel', 4, 140);
await sleep(1500); await shot('gate-open');
// Chain: the seed wheel puffs its gust beyond the gate.
await go(0, -3, 'gate'); await catchAt('chain:seed', 'catch-chain-seed');
const lv = vent('loft'); await go(lv.x + .9, lv.z + .9, 'loft grille'); await press('loft', 'release into grille'); await burst('vent-release', 3, 160);
await ride(lv, 'updraft-loft'); await sleep(300); await shot('loft-view');
// ---- Mill of Sails: push the hanging bridge, cross, give ----
await catchAt('loftGust');
await go(-6, -13, 'bridge push spot'); await press('sailsBridge', 'push bridge'); await burst('push-bridge', 4, 220);
await sleep(900); await shot('bridge-placed');
await go(-9.5, -13, 'bridge near end', { tol: .6 }); await go(-13.8, -13, 'bridge crossed', { tol: .6 });
await catchAt('sailsGust'); await go(-13.6, -12.4, 'mill of sails'); await press('millSails'); await burst('give-mill-sails', 3, 250); await sleep(1200); await shot('mill-sails-restored');
// ---- Mill of Pipes: chain two wheels across a gap ----
await go(-13.8, -13, 'back to bridge', { tol: .6 }); await go(-9.5, -13, 'bridge back'); await catchAt('loftGust');
await go(wheel('pipesA').x - 2, wheel('pipesA').z + 1, 'pipe wheel A'); await press('pipesA'); await burst('chain-pipes-a', 4, 250);
await go(11.2, -13, 'gap edge', { tol: .5 }); await go(15, -13, 'jump the gap', { jumpWhen: g => g.pos[0] > 11.55 }); await shot('gap-crossed');
await catchAt('chain:pipesA', 'catch-chain-a'); await go(wheel('pipesB').x - 1.2, wheel('pipesB').z - .6, 'pipe wheel B'); await press('pipesB'); await burst('chain-pipes-b', 3, 250);
await catchAt('chain:pipesB'); await go(16.2, -15.4, 'mill of pipes'); await press('millPipes'); await sleep(1400); await shot('mill-pipes-restored');
await go(14.3, -13, 'gap far edge', { tol: .5 }); await go(9.5, -13, 'jump back', { jumpWhen: g => g.pos[0] < 14.05 });
// ---- Mill of Ladders: three updrafts and the timed shutter ----
await catchAt('laddersGust1'); const l1 = vent('ladders1'); await go(l1.x - .9, l1.z + .6, 'ladders grille 1'); await press('ladders1'); await ride(l1, 'updraft-ladders1');
await catchAt('laddersGust2'); const l2 = vent('ladders2'); await go(l2.x - .8, l2.z - .6, 'ladders grille 2'); await press('ladders2'); await ride(l2, 'updraft-ladders2');
await catchAt('laddersGust3'); const l3 = vent('ladders3'); await go(l3.x + 1.2, l3.z + 1.6, 'shutter'); await press('laddersShutter', 'push shutter'); await sleep(900); await burst('shutter-countdown', 2, 700);
await catchAt('laddersGust3'); await go(l3.x + 1.2, l3.z + 1.6, 'grille 3'); await press('ladders3'); await ride(l3, 'updraft-ladders3');
await catchAt('laddersTop'); await go(P.millLadders.x, P.millLadders.z + 1.3, 'mill of ladders'); await press('millLadders'); await sleep(1400); await shot('mill-ladders-restored');
// Down again: off the ledges to the loft (ordinary drops).
await go(6.3, -25, 'L3 south edge', { tol: .5 }); await go(6.2, -21, 'jump down to L2', { tol: .6, jumpWhen: g => g.pos[1] > -24.6 }); await go(6, -19.2, 'L2 south', { tol: .6 }); await go(5.5, -17, 'drop to loft', { tol: .6 });
// ---- Sky bridge and the Hollow ----
await go(2, -14, 'loft middle', { tol: .8 }); await go(-6.5, -17.2, 'loft west corner', { tol: .6 }); await go(-8.6, -17.5, 'sky bridge start', { tol: .5 }); await shot('sky-bridge'); await go(-19.5, -17.5, 'sky bridge end', { tol: .6 }); await go(P.hollowGate.x, P.hollowGate.z, 'hollow gate', { tol: .8 });
await go(-23, -24, 'gallery top'); await go(-22, P.carvingOut.z, 'carving out', { tol: .6 }); await press('carvingOut'); await shot('carving-out');
await go(-23.8, P.carvingReturn.z, 'carving return', { tol: .6 }); await press('carvingReturn'); await shot('carving-return');
await go(P.ring1.x, P.ring1.z, 'arena');
// ---- Guardian: dodge, catch its spent breath, turn the vanes ----
for (let phase = 0; phase < 3; phase++) {
  if (phase === 1) { await ride(vent('ring1'), 'ride-ring1'); }
  if (phase === 2) { await go(-24.5, -46, 'drop off mid ring', { tol: .6 }); const r2 = vent('ring2'); await go(r2.x, r2.z, 'pulse grille', { tol: .35, walk: true }); await burst('guardian-pulse-wait', 1); await waitFor(() => window.__GAME__.lifting, 'upward breath', 20000); await ride(r2, 'ride-pulse'); }
  await waitFor(() => ['inhale'].includes(window.__GAME__.quest.guardian?.stage), 'inhale', 20000); await shot(`guardian-inhale-${phase + 1}`);
  await waitFor(() => window.__GAME__.quest.guardian?.stage === 'exhale', 'exhale', 8000); await sleep(250); await shot(`guardian-exhale-${phase + 1}`);
  if ((await read()).knocked) { result.steps.push({ label: 'knocked back by the breath (safe, no progress lost)' }); await shot(`guardian-knock-${phase + 1}`); }
  await waitFor(() => !window.__GAME__.knocked, 'knock settled', 5000);
  const s = await waitSource('guardianBreath'); await go(s.x, s.z, 'breath', { tol: .6 }); await press('guardianBreath'); await burst(`guardian-catch-${phase + 1}`, 2, 200);
  const v = P['vane' + (phase + 1)]; await go(v.x + (phase === 1 ? 1.4 : -1.2), v.z + 1.4, 'vane ' + (phase + 1)); await press('vane'); await burst(`vane-${phase + 1}`, 2, 300);
  await waitFor(n => window.__GAME__.quest.guardian?.phase >= n, 'vane turned', 4000, phase + 1);
}
// ---- Paired bells, finale, Mara ----
await go(P.bellOut.x, P.bellOut.z + 1.4, 'outward bell'); await press('bellOut'); await sleep(900);
await go(P.bellReturn.x, P.bellReturn.z + 1.4, 'return bell'); await press('bellReturn');
for (let i = 0; i < 4; i++) { await sleep(1500); await shot(`finale-rise-${i + 1}`); }
await waitFor(() => window.__GAME__.quest.finale, 'finale done', 8000); await sleep(600); await shot('terrace-with-mara');
await go(P.morningBell.x + 1.2, P.morningBell.z + 1.2, 'morning bell (finale)'); await press('morningBell', 'ring with Mara'); await sleep(700); await shot('bell-rings-clear');
await waitFor(() => window.__GAME__.score === 1, 'complete', 5000); await sleep(7600); await shot('complete-card');
await hold([]);
const end = await read();
result.finished = new Date().toISOString(); result.seconds = (Date.now() - t0) / 1000; result.end = { quest: end.quest, draws: end.draws, tris: end.tris, stub: end.stubWorld };
await fs.writeFile(`${out}/route.json`, JSON.stringify(result, null, 1));
await browser.close();
console.log(`PASS v2 route (${touch ? 'touch' : 'keyboard'}) in ${result.seconds.toFixed(0)} s, ${result.shots.length} shots, errors: ${result.errors.length}`);
if (result.errors.length) { console.log(result.errors); process.exit(1); }
