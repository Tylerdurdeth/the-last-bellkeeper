// v2 save/continue in the browser with real input: a v1 save shows the friendly note and is
// ignored; progress + held gust survive a reload via Continue. Usage: node tools/test-v2-save.mjs
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
const URL = 'http://127.0.0.1:4173/the-last-bellkeeper/?stub'; // save logic, on the simple stub layout
const browser = await puppeteer.launch({ headless: true, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
const sleep = ms => new Promise(r => setTimeout(r, ms)), read = () => page.evaluate(() => window.__GAME__);
const boot = async () => { await page.goto(URL, { waitUntil: 'load' }); await page.waitForFunction(() => window.__BELLHOLLOW__ && !document.querySelector('#startb').disabled, { timeout: 60000 }); };
await page.goto(URL); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('bellkeeper-adventure-v1', JSON.stringify({ version: 1, state: { charged: true }, checkpoint: [1, 0, 1] })); });
await boot();
assert.equal(await page.$eval('#legacyNote', e => !e.hidden), true, 'v1 save shows the friendly note');
assert.equal(await page.$eval('#continueb', e => e.hidden), true, 'v1 save is not offered as Continue');
await page.click('#startb'); await sleep(500); await page.keyboard.press('ArrowUp'); await page.waitForFunction(() => !window.__GAME__.introActive);
async function go(x, z) { for (let i = 0; i < 200; i++) { const g = await read(), dx = x - g.pos[0], dz = z - g.pos[1]; if (Math.hypot(dx, dz) < .5) break; const sx = dx * Math.cos(g.cameraYaw) - dz * Math.sin(g.cameraYaw), sy = -dx * Math.sin(g.cameraYaw) - dz * Math.cos(g.cameraYaw), keys = []; if (Math.abs(sx) > .414 * Math.abs(sy)) keys.push(sx > 0 ? 'ArrowRight' : 'ArrowLeft'); if (Math.abs(sy) > .414 * Math.abs(sx)) keys.push(sy > 0 ? 'ArrowUp' : 'ArrowDown'); for (const k of keys) await page.keyboard.down(k); await sleep(60); for (const k of keys) await page.keyboard.up(k); } }
const P = await page.evaluate(() => window.__BELLHOLLOW__.points);
await go(P.morningBell.x + 1.2, P.morningBell.z + 1.2); await page.waitForFunction(() => window.__GAME__.contextId === 'morningBell'); await page.keyboard.press('Space');
await page.waitForFunction(() => window.__GAME__.quest.bypass, { timeout: 6000 });
await go(P.mara.x - 1.1, P.mara.z + 1.1); await page.waitForFunction(() => window.__GAME__.contextId === 'staff'); await page.keyboard.press('Space'); await sleep(800);
await page.keyboard.press('Escape'); await sleep(300); // pausing saves
const before = await read();
await boot();
assert.equal(await page.$eval('#continueb', e => !e.hidden), true, 'Continue offered'); assert.equal(await page.$eval('#legacyNote', e => e.hidden), true);
await page.click('#continueb'); await sleep(600);
const after = await read();
assert(after.quest.staff && after.quest.bypass, 'progress restored (held-gust persistence: see test-v2-quest save/restore)');
assert(Math.hypot(after.pos[0] - before.pos[0], after.pos[1] - before.pos[1]) < 1.5, 'resumes at the safe checkpoint');
assert.equal(after.objective, 'Catch the gust at Mara’s copper outlet'); assert(!after.introActive);
assert.deepEqual(errors, []);
await browser.close();
console.log('PASS: v1 save ignored with a friendly note; v2 Continue restores progress and checkpoint');
