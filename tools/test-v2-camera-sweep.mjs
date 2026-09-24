// Camera sweep in the Hollow: from a seeded save (visual/camera QA, not route evidence), stand at the gallery,
// each well ring and the top perch; turn the camera through 8 directions with Q/E; after it settles, check with
// __CAMERA_PROBE__ that the head is on screen, the line of sight is clear and the lens is not inside the trunk.
//   node tools/test-v2-camera-sweep.mjs [outDir]
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const out = process.argv[2] || 'evidence/v2/systems/camera-sweep'; await fs.mkdir(out, { recursive: true });
const b = await puppeteer.launch({ headless: true, args: ['--use-angle=metal'] }); const sleep = ms => new Promise(r => setTimeout(r, ms));
const U = 'http://127.0.0.1:4173/the-last-bellkeeper/', report = { fails: [], checks: 0 };
const flags = ['bell', 'bypass', 'staff', 'seed', 'loft', 'sailsBridge', 'sailsCap', 'sails', 'pipesA', 'pipesValve', 'pipesB', 'pipes', 'ladders', 'skyBridge', 'hollow', 'carvingOut', 'carvingReturn', 'guardian'];
const ALL = process.argv.includes('--checkpoints'), DIRS = ALL ? 1 : 8;
for (const [name, vp] of [...(ALL ? [] : [['desktop', { width: 1280, height: 720 }]]), ['phone', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const p = await b.newPage(); await p.setViewport(vp); await p.goto(U); await p.waitForFunction(() => window.__BELLHOLLOW__);
  const P = await p.evaluate(() => window.__BELLHOLLOW__.points), R = P.guardianWell.rings;
  let spots = { gallery: P.carvingReturn, galleryTop: P.carvingOut, low: R.low.safe, mid: R.mid.safe, high: R.high.safe, perch: R.top?.safe || P.ring3 };
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
      const c = await p.evaluate(() => window.__CAMERA_PROBE__()); report.checks++;
      report.checks += 0; const bad = !c.headInView || !c.unobstructed || c.insideTrunk;
      if (bad) { report.fails.push({ name, spot, dir, headInView: c.headInView, unobstructed: c.unobstructed, insideTrunk: c.insideTrunk, blockers: c.blockers?.slice(0, 2), arm: c.arm, pitch: c.pitch }); await p.screenshot({ path: `${out}/${name}-${spot}-${dir}-FAIL.png` }); }
      else if (ALL || dir % 4 === 0) await p.screenshot({ path: `${out}/${name}-${spot}-${dir}.png` });
    }
  }
  await p.close();
}
await b.close(); await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(`${report.checks} views, ${report.fails.length} failing`); for (const f of report.fails) console.log(JSON.stringify(f).slice(0, 220));
