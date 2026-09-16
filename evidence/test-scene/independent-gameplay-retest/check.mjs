import puppeteer from '/Users/seb/Documents/ChatGPT/Project BellKeeper/recipe-reference/node_modules/puppeteer/lib/puppeteer/puppeteer.js';
import ffmpeg from '/Users/seb/Documents/ChatGPT/Project BellKeeper/setup-tools/node_modules/ffmpeg-static/index.js';
import fs from 'node:fs/promises';
const out=new URL('./',import.meta.url);const browser=await puppeteer.launch({headless:true});const p=await browser.newPage();const result={build:'f9c57fb49a3bd95beaff85388f23b6a54fe43530',errors:[],observations:[],kind:'normal inputs; telemetry read only; headless emulated phone, no physical performance/audio claim'};p.on('pageerror',e=>result.errors.push(e.message));const sleep=ms=>new Promise(r=>setTimeout(r,ms));const read=()=>p.evaluate(()=>window.__GAME__);async function log(label){result.observations.push({label,state:await read(),caption:await p.$eval('#caption',e=>e.textContent)});}async function shot(name){await p.screenshot({path:new URL(name+'.png',out).pathname});}
async function record(name,task){const rec=await p.screencast({ffmpegPath:ffmpeg,fps:20});const chunks=[];rec.on('data',c=>chunks.push(c));try{await task();}finally{await rec.stop();await fs.writeFile(new URL(name+'.webm',out),Buffer.concat(chunks));}}
let mobile=false,client;async function go(x,z,limit=160){for(let i=0;i<limit;i++){const s=await read();const dx=x-s.pos[0],dz=z-s.pos[1];if(Math.hypot(dx,dz)<.26)return;const sx=dx*.788-dz*.615,sy=-dx*.615-dz*.788;if(mobile){const r=await p.$eval('#stick',e=>{const a=e.getBoundingClientRect();return{x:a.x+a.width/2,y:a.y+a.height/2}});const m=Math.hypot(sx,sy);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x,y:r.y}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+sx/m*36,y:r.y-sy/m*36}]});await sleep(200);await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{const keys=[];if(Math.abs(sx)>.14)keys.push(sx>0?'KeyD':'KeyA');if(Math.abs(sy)>.14)keys.push(sy>0?'KeyW':'KeyS');for(const k of keys)await p.keyboard.down(k);await sleep(150);for(const k of keys)await p.keyboard.up(k);}}return false;}

const act=()=>mobile?p.tap('#action'):p.keyboard.press('Space');
const pause=()=>mobile?p.tap('#pause'):p.keyboard.press('Escape');
async function reset(){await pause();await sleep(100);await (mobile?p.tap('#reset'):p.click('#reset'));await sleep(350);}
async function gateProbe(label){await go(4.45,-1.65);await go(5.12,-2.80,14);await sleep(200);await log(label);await shot(label);}
try{
for(const mode of ['desktop','phone']){
mobile=mode==='phone';await p.setViewport(mobile?{width:430,height:932,isMobile:true,hasTouch:true,deviceScaleFactor:1}:{width:1280,height:800});await p.goto('http://127.0.0.1:4173/the-last-bellkeeper/');await p.waitForFunction(()=>window.__READY__);await(mobile?p.tap('#startb'):p.click('#startb'));client=await p.createCDPSession();
await record(mode+'-gate-and-transfer',async()=>{
await gateProbe(mode+'-closed-gate');await reset();await go(-3,1.4);await act();await sleep(1000);await log(mode+'-capture');await act();await sleep(950);await log(mode+'-miss-retained');
await go(1.5,-.4);await act();await sleep(260);await shot(mode+'-transfer');await log(mode+'-transfer-pending');await sleep(1300);await log(mode+'-restored');await gateProbe(mode+'-open-gate');await reset();await gateProbe(mode+'-reset-gate');
});
if(!mobile){await reset();await record('charged-hazard-and-turn',async()=>{await go(-3,1.4);await act();await sleep(1000);await go(1.65,-1.2);await sleep(8500);await log('charged-after-impact');await shot('charged-impact');await go(0,1);await sleep(7500);await log('evaded-outside-ring');await p.keyboard.down('KeyA');await sleep(850);await p.keyboard.up('KeyA');await p.keyboard.down('KeyD');await sleep(850);await p.keyboard.up('KeyD');await sleep(500);});}
}
}catch(e){result.testError=e.stack;}finally{await fs.writeFile(new URL('result.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();}
