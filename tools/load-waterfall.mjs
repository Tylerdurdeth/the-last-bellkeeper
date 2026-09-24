// Load waterfall under the jam gate's phone profile (390x844@3, 4G 4/1 Mbps 60 ms, CPU 2x): every response
// before window.__READY__ with start/end times and bytes. node tools/load-waterfall.mjs [out.json]
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const b = await puppeteer.launch({ headless: true, args: ['--use-angle=metal'] }); const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const c = await p.createCDPSession(); await c.send('Network.enable');
await c.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 4e6 / 8, uploadThroughput: 1e6 / 8 });
await c.send('Emulation.setCPUThrottlingRate', { rate: 2 });
const req = new Map(); let t0 = 0;
c.on('Network.requestWillBeSent', e => { if (!t0) t0 = e.timestamp; req.set(e.requestId, { url: e.request.url.replace(/.*the-last-bellkeeper\//, ''), start: e.timestamp }); });
c.on('Network.loadingFinished', e => { const r = req.get(e.requestId); if (r) { r.end = e.timestamp; r.bytes = e.encodedDataLength; } });
const T0 = Date.now(); await p.goto('http://127.0.0.1:4173/the-last-bellkeeper/'); await p.waitForFunction(() => window.__READY__ && !document.querySelector('#startb').disabled, { timeout: 90000, polling: 100 });
const ready = (Date.now() - T0) / 1000; await new Promise(r => setTimeout(r, 4000));
const rows = [...req.values()].map(r => ({ url: r.url.slice(0, 60), start: +(r.start - t0).toFixed(2), end: r.end ? +(r.end - t0).toFixed(2) : null, kb: r.bytes ? Math.round(r.bytes / 1024) : 0 })).sort((a, b) => a.start - b.start);
console.log('ready', ready, 's; total', Math.round(rows.reduce((s, r) => s + r.kb, 0)), 'KB,', rows.length, 'requests');
for (const r of rows) console.log(String(r.start).padStart(6), String(r.end).padStart(6), String(r.kb).padStart(6) + 'KB', r.url);
if (process.argv[2]) await fs.writeFile(process.argv[2], JSON.stringify({ ready, rows }, null, 1));
await b.close();
