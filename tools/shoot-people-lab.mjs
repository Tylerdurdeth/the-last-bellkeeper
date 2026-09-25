// People lab shots: node tools/shoot-people-lab.mjs outPrefix "who=baker&view=face&t=1@500x500" ... (query@WxH per shot)
import puppeteer from 'puppeteer';
const [,, out, ...qs] = process.argv; const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ headless: true, args: ['--use-angle=metal'] }); const p = await b.newPage();
p.on('pageerror', e => console.log('pageerror', e.message)); p.on('console', m => { if (/error|warn/i.test(m.type())) console.log('console', m.text().slice(0, 200)); });
for (const [i, qq] of qs.entries()) {
  const [query, w = 1600, h = 900] = qq.split('@').flatMap(s => s.split('x'));
  await p.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
  await p.goto('http://127.0.0.1:4173/the-last-bellkeeper/bellhollow/people-lab.html?shot=1&' + query); await p.waitForFunction(() => window.__lab?.ready, { timeout: 60000 }); await sleep(1500);
  await p.screenshot({ path: `${out}-${i}.png` });
}
await b.close();
