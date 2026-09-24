// Air poses: jump rise, apex, fall and an updraft lift, cropped around the hero (visual QA from a seeded save).
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const out = process.argv[2] || 'evidence/v2/systems/poses'; await fs.mkdir(out, { recursive: true });
const b = await puppeteer.launch({ headless: true, args: ['--use-angle=metal'] }); const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
const U = 'http://127.0.0.1:4173/the-last-bellkeeper/', sleep = ms => new Promise(r => setTimeout(r, ms));
await p.goto(U); await p.waitForFunction(() => window.__BELLHOLLOW__);
const P = await p.evaluate(() => window.__BELLHOLLOW__.points), V = await p.evaluate(() => window.__BELLHOLLOW__.vents.find(v => v.id === 'loft'));
await p.evaluate((c) => localStorage.setItem('bellkeeper-adventure-v2', JSON.stringify({ version: 2, checkpoint: c, quest: { version: 2, progress: { bell: true, bypass: true, staff: true, seed: true }, reached: {}, fragments: [], seen: ['vent', 'firstCatch'], charge: { origin: 'x', kind: 'gust' } } })), [V.x + .6, V.y, V.z + .6]);
await p.goto(U); await p.waitForFunction(() => !document.querySelector('#continueb').hidden, { timeout: 60000 }); await p.click('#continueb'); await sleep(1500);
async function crop(name) { const h = await p.evaluate(() => window.__CAMERA_PROBE__().hero); const pad = 70, x = Math.max(0, h.l - pad), y = Math.max(0, h.t - pad); await p.screenshot({ path: `${out}/${name}.png`, clip: { x, y, width: Math.min(1280 - x, h.r - h.l + 2 * pad), height: Math.min(720 - y, h.b - h.t + 2 * pad) } }); }
await crop('0-ground'); await p.keyboard.press('KeyA'); await sleep(120); await crop('1-jump-rise'); await sleep(200); await crop('2-apex'); await sleep(220); await crop('3-fall');
await sleep(800); await p.keyboard.press('Space'); await sleep(1300); await crop('4-lift'); await sleep(500); await crop('5-lift-high');
await b.close(); console.log('ok');
