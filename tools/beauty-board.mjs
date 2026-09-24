// Beauty board: canonical frames at main's gameplay camera with the render look ON, desktop and phone,
// assembled into contact sheets.   node tools/beauty-board.mjs [outDir=evidence/v2/world/beauty/now] [--sizes=1280x720,390x844]
import puppeteer from 'puppeteer';
import {mkdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const args = process.argv.slice(2), out = args.find((a) => !a.startsWith('--')) || 'evidence/v2/world/beauty/now';
const sizes = (args.find((a) => a.startsWith('--sizes=')) || '--sizes=1280x720,390x844').slice(8).split(',').map((s) => s.split('x').map(Number));
const SHOTS = ['street', 'maraWorkshop', 'maraOutlet', 'morningBell', 'yardStores', 'gateOpen', 'loftLip', 'seedWheelGate', 'loftVent', 'loft', 'sailsBridge', 'sailsMillIdle', 'sailsCapSail', 'sailsMillRestored', 'pipesValve', 'pipesMillIdle', 'pipesMillRestored', 'laddersShutter', 'laddersMillRestored', 'fragment1', 'frag2FromSail', 'sailsLanding', 'fragment2', 'fragment3', 'skyBridge', 'hollowGate', 'galleryCarvings', 'wellHigh', 'wellMid', 'wellLow', 'topPerch', 'pairedBells', 'finale'];
const only = args.find((a) => a.startsWith('--only=')); const list = only ? only.slice(7).split(',') : SHOTS;
await mkdir(out, {recursive: true});
const browser = await puppeteer.launch({headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const report = [];
for (const [w, h] of sizes) {
  const page = await browser.newPage(); await page.setViewport({width: w, height: h, deviceScaleFactor: 1});
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  for (const s of list) {
    await page.goto(`http://127.0.0.1:4173/the-last-bellkeeper/bellhollow/board.html?shot=${s}`, {waitUntil: 'load'});
    await page.waitForFunction(() => window.__BH__?.ready, {timeout: 90000});
    const info = await page.evaluate(() => window.__BH__);
    await page.screenshot({path: `${out}/${s}-${w}x${h}.png`});
    report.push({shot: s, size: `${w}x${h}`, draws: info.draws, tris: info.tris, errors: [...errors]}); errors.length = 0;
  }
  await page.close();
}
await browser.close();
await writeFile(`${out}/board.json`, JSON.stringify(report, null, 1));
// contact sheets (python/PIL)
const py = `
import json
from PIL import Image, ImageDraw
out='${out}'; shots=${JSON.stringify(list)}
for size,W,H,cols in [('1280x720',480,270,4),('390x844',195,422,9)]:
    try:
        rows=(len(shots)+cols-1)//cols; o=Image.new('RGB',(W*cols,H*rows),'black'); d=ImageDraw.Draw(o)
        for i,s in enumerate(shots):
            im=Image.open(f'{out}/{s}-{size}.png').convert('RGB').resize((W,H)); o.paste(im,((i%cols)*W,(i//cols)*H)); d.text(((i%cols)*W+5,(i//cols)*H+4),s,fill='white')
        o.save(f'{out}/board-{size}.jpg',quality=88)
    except FileNotFoundError: pass
`;
execFileSync('python3', ['-c', py]);
console.log(report.map((r) => `${r.shot} ${r.size} draws ${r.draws} tris ${r.tris}${r.errors.length ? ' ERR ' + r.errors : ''}`).join('\n'));
