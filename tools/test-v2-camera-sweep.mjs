// Camera sweep in the Hollow: from a seeded save (visual/camera QA, not route evidence), stand at the gallery,
// each well ring and the top perch; turn the camera through 8 directions with Q/E; after it settles, check with
// __CAMERA_PROBE__ that the head is on screen, the line of sight is clear and the lens is not inside the trunk.
// Town spots (seed-wheel yard past the terrace gate, the gate, Mara's workshop, the loft, the market) also assert
// the spring arm: arm >= 4.5 m (MIN_ARM_ENCLOSED where truly enclosed), pitch not near straight down, lens not in a
// solid, above the floor. --town runs only the town spots, --hollow only the Hollow ones.
//   node tools/test-v2-camera-sweep.mjs [outDir] [--town|--hollow|--checkpoints]
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'evidence/v2/systems/camera-sweep'; await fs.mkdir(out, { recursive: true });
const b = await puppeteer.launch({ headless: true, args: ['--use-angle=metal'] }); const sleep = ms => new Promise(r => setTimeout(r, ms));
const U = 'http://127.0.0.1:4173/the-last-bellkeeper/', report = { fails: [], checks: 0 };
const flags = ['bell', 'bypass', 'staff', 'seed', 'loft', 'sailsBridge', 'sailsCap', 'sails', 'pipesA', 'pipesValve', 'pipesB', 'pipes', 'ladders', 'skyBridge', 'hollow', 'carvingOut', 'carvingReturn', 'guardian'];
const ALL = process.argv.includes('--checkpoints'), TOWN = process.argv.includes('--town'), HOLLOW = process.argv.includes('--hollow'), DIRS = ALL ? 1 : 8;
const DEG = Math.PI / 180, polar = (az, r, y = 0) => ({ x: r * Math.sin(az * DEG), y, z: r * Math.cos(az * DEG) });
const MIN_ARM = 4.5, MIN_ARM_ENCLOSED = { loftLedge: 3.5, yardC: 3.5 }, MAX_PITCH = 1.12; // ~64 degrees; 90 would be straight down
for (const [name, vp] of [...(ALL ? [] : [['desktop', { width: 1280, height: 720 }]]), ['phone', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const p = await b.newPage(); await p.setViewport(vp); await p.goto(U); await p.waitForFunction(() => window.__BELLHOLLOW__);
  const P = await p.evaluate(() => window.__BELLHOLLOW__.points), R = P.guardianWell.rings;
  const hollow = { gallery: P.carvingReturn, galleryTop: P.carvingOut, low: R.low.safe, mid: R.mid.safe, high: R.high.safe, perch: R.top?.safe || P.ring3 };
  const town = { seedWheel: P.seedWheel, terraceGate: P.terraceGate, terraceGateInside: P.terraceGateInside, yardA: polar(-90, 19.6), yardB: polar(-93.5, 20.4), yardC: polar(-96.5, 19.2),
    workshop: polar(-74, 21), loftLedge: P.loftLedge, loftView: P.loftView, market: polar(-32.5, 23.4) };
  for (const k of Object.keys(town)) if (!town[k]) delete town[k];
  let spots = TOWN ? town : HOLLOW ? hollow : { ...hollow, ...town };
  // --checkpoints: every place a Continue can put the hero (story anchors, ledges, gusts, gallery carvings, rings).
  if (ALL) { const V = await p.evaluate(() => window.__BELLHOLLOW__.vents); spots = { start: P.start, mara: P.mara, bell: P.morningBell, seedWheel: P.seedWheel, finaleSpot: P.finaleSpot, hollowGate: P.hollowGate,
    ...Object.fromEntries(V.filter(v => v.ledge).map(v => ['ledge-' + v.id, v.ledge])), ...Object.fromEntries((P.gallery?.carvings || []).map((c, i) => ['carving' + i, c.stand])), low: R.low.safe, mid: R.mid.safe, high: R.high.safe, perch: R.top?.safe,
    millSails: P.millSails, millPipes: P.millPipes, millLadders: P.millLadders, fragment1: P.fragment1, fragment2: P.fragment2, fragment3: P.fragment3 };
    for (const k of Object.keys(spots)) if (!spots[k]) delete spots[k]; }
  for (const [spot, q] of Object.entries(spots)) {
    await p.goto(U); await p.waitForFunction(() => window.__BELLHOLLOW__); // title screen: nothing autosaves over the fixture
    await p.evaluate((c, f) => localStorage.setItem('bellkeeper-adventure-v2', JSON.stringify({ version: 2, checkpoint: c, quest: { version: 2, progress: Object.fromEntries(f.map(k => [k, true])), reached: { loft: true }, fragments: [], seen: [], charge: null, guardian: { phase: 3 } } })), [q.x, q.y, q.z], flags);
    await p.goto(U); await p.waitForFunction(() => !document.querySelector('#continueb').hidden, { timeout: 60000 }); if (vp.hasTouch) await p.tap('#continueb'); else await p.click('#continueb'); await sleep(ALL ? 700 : 1800);
    const at = await p.evaluate(() => [...window.__GAME__.pos, window.__GAME__.y]); if (Math.hypot(at[0] - q.x, at[1] - q.z) > 1.5) { report.fails.push({ name, spot, placedAt: at, wanted: [q.x, q.y, q.z] }); continue; }
    for (let dir = 0; dir < DIRS; dir++) {
      if (dir) { for (let i = 0; i < 6; i++) await p.keyboard.press('KeyE'); }
      if (!ALL) await sleep(1600);
      let c = await p.evaluate(() => window.__CAMERA_PROBE__()); report.checks++;
      // Town: a crowded view gets the auto camera's slow swing toward open space (it waits 2.5 s after Q/E); probe again.
      if (spot in town && !ALL && (c.arm < (MIN_ARM_ENCLOSED[spot] ?? MIN_ARM) || (c.seen ? !c.seen.headVisible : !c.unobstructed))) { await sleep(4500); c = await p.evaluate(() => window.__CAMERA_PROBE__()); c.afterSwing = true; }
      const isTown = spot in town && !ALL, minArm = MIN_ARM_ENCLOSED[spot] ?? MIN_ARM;
      const armBad = isTown && (c.arm < minArm || c.pitch > MAX_PITCH || c.insideSolid || c.clear < .8);
      if (isTown) (report.town ??= []).push({ name, spot, dir, arm: c.arm, pitch: c.pitch, clear: c.clear, hitBy: c.hitBy, afterSwing: !!c.afterSwing });
      // Town: line of sight after the occluder fade (small props dither away; large architecture never does).
      const seen = isTown && c.seen ? c.seen.headVisible : c.unobstructed;
      const bad = !c.headInView || !seen || c.insideTrunk || armBad;
      if (bad) { report.fails.push({ name, spot, dir, headInView: c.headInView, unobstructed: c.unobstructed, insideTrunk: c.insideTrunk, insideSolid: c.insideSolid, blockers: isTown && c.seen ? c.seen.blockers : c.blockers?.slice(0, 2), arm: c.arm, pitch: c.pitch, clear: c.clear, hitBy: c.hitBy }); await p.screenshot({ path: `${out}/${name}-${spot}-${dir}-FAIL.png` }); }
      else if (ALL || dir % 4 === 0) await p.screenshot({ path: `${out}/${name}-${spot}-${dir}.png` });
    }
  }
  await p.close();
}
await b.close(); await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(`${report.checks} views, ${report.fails.length} failing`);
if (report.town) { const t = report.town; console.log(`town: min arm ${Math.min(...t.map(v => v.arm))} m, max pitch ${Math.max(...t.map(v => v.pitch))} rad, min clearance ${Math.min(...t.map(v => v.clear))} m`); } for (const f of report.fails) console.log(JSON.stringify(f).slice(0, 220));
