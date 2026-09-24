// Title + prologue cards at desktop and phone sizes (real clicks/taps). node tools/shoot-v2-title.mjs [outDir]
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const out = process.argv[2] || 'evidence/v2/systems/title-cards'; await fs.mkdir(out, { recursive: true });
const b = await puppeteer.launch({ headless: true, args: ['--use-angle=metal'] }); const errors = [];
for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const p = await b.newPage(); await p.setViewport(vp); p.on('pageerror', e => errors.push(e.message)); p.on('response', r => r.status() >= 400 && errors.push(r.url()));
  await p.goto('http://127.0.0.1:4173/the-last-bellkeeper/'); await p.waitForFunction(() => !document.querySelector('#startb').disabled, { timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500)); await p.screenshot({ path: `${out}/${name}-title.png` });
  if (vp.hasTouch) await p.tap('#startb'); else await p.click('#startb');
  for (let i = 0; i < 3; i++) { await new Promise(r => setTimeout(r, 1600)); await p.screenshot({ path: `${out}/${name}-card${i + 1}.png` }); if (vp.hasTouch) await p.tap('#storyNext'); else await p.click('#storyNext'); }
  await p.close();
}
await b.close(); console.log(JSON.stringify({ errors }));
