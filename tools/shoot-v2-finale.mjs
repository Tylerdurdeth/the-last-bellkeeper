// VISUAL INSPECTION ONLY (not end-to-end evidence): seeds a v2 save standing at the paired bells
// with the guardian calmed and the outward bell rung, then rings the return bell with a real key
// press and captures the finale crane, the far bell answer and the return to Mara.
//   node tools/shoot-v2-finale.mjs [outDir] [--phone]
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const phone = process.argv.includes('--phone');
const out = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || `evidence/v2/systems/finale-${phone ? 'phone' : 'desktop'}`;
await fs.mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1280, height: 720 });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = 'http://127.0.0.1:4173/the-last-bellkeeper/';
await page.goto(URL); await page.waitForFunction(() => window.__BELLHOLLOW__, { timeout: 60000 });
const P = await page.evaluate(() => window.__BELLHOLLOW__.points);
const all = ['bell', 'bypass', 'staff', 'seed', 'loft', 'sailsBridge', 'sails', 'pipesA', 'pipesB', 'pipes', 'ladders', 'skyBridge', 'hollow', 'carvingOut', 'carvingReturn', 'guardian', 'bellOut'];
await page.evaluate((s) => localStorage.setItem('bellkeeper-adventure-v2', JSON.stringify(s)), { version: 2, checkpoint: [P.bellOut.x, P.bellOut.y, P.bellOut.z], quest: { version: 2, progress: Object.fromEntries(all.map(k => [k, true])), reached: { loft: true, ladders1: true, ladders2: true, ladders3: true }, fragments: [], seen: [], charge: null, guardian: { phase: 3 } } });
await page.goto(URL); await page.waitForFunction(() => !document.querySelector('#continueb').hidden, { timeout: 60000 });
if (phone) await page.tap('#continueb'); else await page.click('#continueb');
await sleep(1500);
await page.waitForFunction(() => window.__GAME__.contextId === 'bellReturn', { timeout: 8000 });
await page.screenshot({ path: `${out}/00-at-bells.png` });
if (phone) await page.tap('#action'); else await page.keyboard.press('Space');
for (let i = 0; i < 14; i++) { await sleep(1000); await page.screenshot({ path: `${out}/${String(i + 1).padStart(2, '0')}-t${i + 1}.png` }); }
await page.waitForFunction(() => window.__GAME__.quest.finale, { timeout: 8000 });
await sleep(2800); await page.screenshot({ path: `${out}/20-arrival.png` });
console.log(JSON.stringify({ errors, finale: (await page.evaluate(() => window.__GAME__.quest.finale)) }));
await browser.close();
