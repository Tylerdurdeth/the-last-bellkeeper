// Stuck regression in the browser (owner playtest: trapped inside a sky-bridge chain barrier).
// Save fixture puts the checkpoint inside a barrier that is up; Continue must land somewhere the hero
// fits, arrows must move him within 1 s, and the pause menu's "Return to last safe spot" must work.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBellhollow } from '../game/bellhollow/world.js';
const w = await buildBellhollow({ THREE, scene: new THREE.Scene() });
for (let i = 0; i < 60; i++) w.update(1 / 60, i / 60, { wind: { push: { terraceGate: 1 } }, restored: { skyBridge: 2 / 3 } });
// Find a blocked spot on the last (unbuilt) sky-bridge stage start: the chain barrier.
const a = w.points.skyBridge.start || w.points.skyBridge, b = w.points.hollowGate; let trap = null;
const x0 = Math.min(a.x, b.x) - 8, x1 = Math.max(a.x, b.x) + 8, z0 = Math.min(a.z, b.z) - 8, z1 = Math.max(a.z, b.z) + 8;
for (let x = x0; x <= x1 && !trap; x += .2) for (let z = z0; z <= z1 && !trap; z += .2) for (const y of [0, 1.33, 2.67, 4]) {
  const g = w.ground(x, z, y + .3); if (g === null || Math.abs(g - y) > .7) continue;
  const c = w.blocker?.(x, z, .23, g); if (c && /skybridge-barrier/.test(String(c))) { trap = [x, g, z]; break; }
}
assert(trap, 'found a barrier-overlapping spot for the fixture');
const browser = await puppeteer.launch({ headless: true, args: ['--use-angle=metal'] }); const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const URL = 'http://127.0.0.1:4173/the-last-bellkeeper/'; const sleep = ms => new Promise(r => setTimeout(r, ms)), read = () => page.evaluate(() => window.__GAME__);
await page.goto(URL); await page.waitForFunction(() => window.__BELLHOLLOW__);
const flags = ['bell', 'bypass', 'staff', 'seed', 'loft', 'sailsBridge', 'sailsCap', 'sails', 'pipesA', 'pipesValve', 'pipesB', 'pipes'];
await page.evaluate((c, f) => localStorage.setItem('bellkeeper-adventure-v2', JSON.stringify({ version: 2, checkpoint: c, quest: { version: 2, progress: Object.fromEntries(f.map(k => [k, true])), reached: { loft: true }, fragments: [], seen: [], charge: null } })), trap, flags);
await page.goto(URL); await page.waitForFunction(() => !document.querySelector('#continueb').hidden, { timeout: 60000 }); await page.click('#continueb'); await sleep(800);
let g = await read(); assert(!g.blocked, 'Continue lands where the body fits (restore validation)');
const p0 = g.pos; await page.keyboard.down('ArrowUp'); await sleep(1000); await page.keyboard.up('ArrowUp'); g = await read();
assert(Math.hypot(g.pos[0] - p0[0], g.pos[1] - p0[1]) > .5, 'arrows move the hero within 1 s');
await page.keyboard.press('Escape'); await sleep(300); assert(await page.$eval('#safeSpot', e => !e.hidden));
await page.click('#safeSpot'); await sleep(500); g = await read(); assert(!g.paused && !g.blocked, 'return to last safe spot works');
assert.deepEqual(errors, []); await browser.close();
console.log('PASS: barrier-overlap save restores to a safe spot; arrows move within 1 s; pause "Return to last safe spot" works (unit tests cover live depenetration and the 2 s failsafe)');
