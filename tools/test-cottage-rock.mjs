import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const label=process.argv[2]||'after',out=`evidence/rebuild/rock-contact-${label}`;await fs.mkdir(out,{recursive:true});
const browser=await puppeteer.launch({headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1280,height:720});await page.goto('http://127.0.0.1:4173/the-last-bellkeeper/');await page.waitForFunction(()=>!document.querySelector('#startb').disabled);await page.click('#startb');
const wait=ms=>new Promise(r=>setTimeout(r,ms)),read=()=>page.evaluate(()=>({...window.__GAME__}));
async function move(keys,ms){for(const k of keys)await page.keyboard.down(k);await wait(ms);for(const k of keys)await page.keyboard.up(k);await wait(100);return read();}
const result={kind:'Exact normal-input replay of unbriefed reviewer cottage-rock encounter; read-only telemetry',label,errors,states:{}};
await move(['ArrowUp'],2000);await move(['ArrowUp'],2500);await page.keyboard.press('Space');await move(['ArrowRight'],1800);result.states.approach=await move(['ArrowUp'],3000);await page.screenshot({path:out+'/approach.png'});
result.states.run=await move(['ArrowUp','ShiftLeft'],3500);await page.screenshot({path:out+'/run.png'});
result.states.jump=await move(['ArrowUp','KeyA'],1300);await page.screenshot({path:out+'/jump.png'});
result.runTravel=Math.hypot(result.states.run.pos[0]-result.states.approach.pos[0],result.states.run.pos[1]-result.states.approach.pos[1]);result.jumpTravel=Math.hypot(result.states.jump.pos[0]-result.states.run.pos[0],result.states.jump.pos[1]-result.states.run.pos[1]);result.clearancePass=(result.runTravel>.8||result.jumpTravel>.8)&&errors.length===0;
await fs.writeFile(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();
