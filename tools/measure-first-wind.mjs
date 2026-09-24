// Pacing probe: browser time from the end of the intro (watched to the end, or skipped) to the
// first "Wind held in the bell", walking the obvious woodland route with ordinary arrow keys and
// Space only. No state writes, no teleports. Walk = no Shift (normal speed); run = Shift held on
// long legs, as the route drivers do. A short reading pause follows each story caption.
// Usage: node tools/measure-first-wind.mjs [outDir] [baseUrl]
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const out=process.argv[2]||'evidence/round-2/pacing/first-wind',base=process.argv[3]||'http://127.0.0.1:4173/the-last-bellkeeper/';await fs.mkdir(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),browser=await puppeteer.launch({headless:true}),runs=[];
const route=[['bell',[[-0.1,15.8]]],['porch',[[-1.5,16.4],[-5,13],[-6.3,11.7]]],['capture',[[-3.5,9.2],[0,7.3],[3.9,6.4]]]];
try{for(const [mode,skip,run] of [['skip-walk',true,false],['watch-walk',false,false],['skip-run',true,true]]){
 const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1280,height:720,deviceScaleFactor:1});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('bellkeeper-muted','1'));await page.goto(base);await page.waitForFunction(()=>window.__READY__&&!document.querySelector('#startb').disabled,{timeout:60000});
 const read=()=>page.evaluate(()=>({...window.__GAME__,now:performance.now(),caption:document.querySelector('#caption').textContent,objective:document.querySelector('#objective').textContent}));let held=[],spaces=0;
 const hold=async keys=>{for(const k of held)if(!keys.includes(k))await page.keyboard.up(k);for(const k of keys)if(!held.includes(k))await page.keyboard.down(k);held=keys;};
 async function go(x,z){for(let i=0;i<400;i++){const g=await read(),dx=x-g.pos[0],dz=z-g.pos[1],d=Math.hypot(dx,dz);if(d<.38){await hold([]);return;}const sx=dx*Math.cos(g.cameraYaw)-dz*Math.sin(g.cameraYaw),sy=-dx*Math.sin(g.cameraYaw)-dz*Math.cos(g.cameraYaw),keys=run&&d>1.2?['ShiftLeft']:[];if(Math.abs(sx)>.12)keys.push(sx>0?'ArrowRight':'ArrowLeft');if(Math.abs(sy)>.12)keys.push(sy>0?'ArrowUp':'ArrowDown');await hold(keys);await sleep(80);}throw Error('Timeout walking to '+x+','+z);}
 await page.click('#startb');if(skip)await page.click('#skipIntro');else await page.waitForFunction(()=>!__GAME__.introActive,{timeout:90000,polling:100});
 const t0=(await read()).now,marks=[];
 for(const [kind,points] of route){for(const p of points)await go(...p);const g=await read();if(g.context!==kind)throw Error(`${mode}: expected ${kind}, got ${g.context} at ${g.pos}`);await page.keyboard.press('Space');spaces++;await sleep(kind==='capture'?700:1800);const s=await read();marks.push({step:kind,seconds:+((s.now-t0)/1000).toFixed(1),caption:s.caption,objective:s.objective});}
 const final=await read();await page.screenshot({path:`${out}/${mode}-first-wind.png`});
 const row={mode,skipIntro:skip,run,secondsToFirstWind:+((final.now-t0)/1000).toFixed(1),charged:final.charged,requiredSpacesBeforeCapture:spaces-1,marks,errors};runs.push(row);console.log(JSON.stringify(row));await context.close();
}}finally{await browser.close();}
const pass=runs.length===3&&runs.every(r=>r.charged&&r.secondsToFirstWind<=90&&r.requiredSpacesBeforeCapture<=2&&!r.errors.length);
await fs.writeFile(out+'/result.json',JSON.stringify({kind:'Known-route ordinary-input pacing probe (not a human playtest)',base,pass,runs},null,2));console.log(pass?'PASS first wind within 90 s from intro end, <=2 required interactions':'FAIL');if(!pass)process.exitCode=1;
