// Capture Bellhollow preview shots (gameplay-angle SE camera) at desktop and phone sizes.
// usage: node tools/shoot-bellhollow.mjs [outDir] [shot,shot,...] [--query=planks=3&restored=1] [--sizes=1280x720,390x844]
import puppeteer from 'puppeteer';
import {mkdir, writeFile} from 'node:fs/promises';
const args = process.argv.slice(2), flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split(/=(.*)/s).slice(0, 2)));
const pos = args.filter((a) => !a.startsWith('--'));
const out = pos[0] || 'evidence/v2/world', base = flags.url || 'http://127.0.0.1:4173/the-last-bellkeeper/bellhollow/preview.html';
const shots = (pos[1] || 'overview,start,morningBell,mara,seedWheel,gate,loft,sailsBridge,sailsMill,pipesWheels,pipesMill,laddersL0,laddersL1,laddersMill,skyBridge,hollowGate,gallery,wellHigh,wellLow,hollowWide,terraceView').split(',');
const sizes = (flags.sizes || '1280x720,390x844').split(',').map((s) => s.split('x').map(Number));
await mkdir(out, {recursive: true});
const browser = await puppeteer.launch({headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const report = [];
for (const [w, h] of sizes) {
  const page = await browser.newPage();
  await page.setViewport({width: w, height: h, deviceScaleFactor: 1});
  const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  for (const shot of shots) {
    await page.goto(`${base}?shot=${shot}&hud=0&${flags.query || ''}`, {waitUntil: 'load'});
    await page.waitForFunction(() => window.__BH__?.ready, {timeout: 60000});
    await new Promise((r) => setTimeout(r, 900));
    const info = await page.evaluate(() => window.__BH__);
    const file = `${out}/${shot}-${w}x${h}${flags.tag ? '-' + flags.tag : ''}.png`;
    await page.screenshot({path: file});
    report.push({shot, size: `${w}x${h}`, file, draws: info.draws, tris: info.tris, buildMs: info.buildMs, errors: [...errors]});
    console.log(shot, `${w}x${h}`, 'draws', info.draws, 'tris', info.tris, 'build', info.buildMs, errors.length ? errors : '');
    errors.length = 0;
  }
  await page.close();
}
await browser.close();
await writeFile(`${out}/shots${flags.tag ? '-' + flags.tag : ''}.json`, JSON.stringify(report, null, 2));
