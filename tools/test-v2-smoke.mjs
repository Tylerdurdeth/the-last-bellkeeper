// Boot smoke for v2: title -> start -> intro (watched or skipped) -> control, at desktop and phone
// sizes. Real clicks/keys/touch only. Usage: node tools/test-v2-smoke.mjs [outDir] [--query=?stub]
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const out = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || 'evidence/v2/systems/smoke';
const query = (process.argv.find(a => a.startsWith('--query=')) || '--query=').slice(8);
const URL = 'http://127.0.0.1:4173/the-last-bellkeeper/' + query;
await fs.mkdir(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: true, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const report = { url: URL, runs: [] };
for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const page = await browser.newPage(); await page.setViewport(vp);
  const errors = [], warnings = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  const t0 = Date.now(); await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__READY__ && !document.querySelector('#startb').disabled, { timeout: 60000 });
  const ready = (Date.now() - t0) / 1000;
  await page.screenshot({ path: `${out}/${name}-title.png` });
  if (vp.hasTouch) await page.tap('#startb'); else await page.click('#startb');
  await sleep(1200); await page.screenshot({ path: `${out}/${name}-prologue.png` });
  // Advance the cards with the real button, then watch the in-engine intro shots.
  for (let i = 0; i < 3; i++) { if (vp.hasTouch) await page.tap('#storyNext').catch(() => {}); else await page.click('#storyNext').catch(() => {}); await sleep(300); }
  for (const at of [1.5, 6, 10, 14.5]) { await page.waitForFunction(t => (window.__GAME__?.introTime ?? 0) >= 21 + t || !window.__GAME__?.introActive, { timeout: 30000 }, at); await page.screenshot({ path: `${out}/${name}-intro-${String(at).replace('.', '_')}.png` }); }
  await page.keyboard.press('ArrowUp'); await sleep(600);
  const g = await page.evaluate(() => window.__GAME__);
  await page.screenshot({ path: `${out}/${name}-play.png` });
  report.runs.push({ name, ready, errors, warnings: warnings.slice(0, 5), introEnded: !g.introActive, objective: g.objective, stub: g.stubWorld, look: g.look, draws: g.draws, tris: g.tris });
  await page.close();
}
await browser.close();
await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
if (report.runs.some(r => r.errors.length || !r.introEnded)) process.exit(1);
