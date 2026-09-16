import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const out='evidence/rebuild/nearbranch-retest3';await fs.mkdir(out,{recursive:true});
const browser=await puppeteer.launch({headless:true});
const result={kind:'Actual keyboard/touch input with read-only telemetry; known-route scripted regression, not a natural discovery playtest',startedAt:new Date().toISOString(),errors:[],requests:[],checks:{},waypoints:[],screenshots:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const page=await browser.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)result.requests.push({status:r.status(),url:r.url()});});
const read=()=>page.evaluate(()=>({...window.__GAME__}));
async function shot(label){const p=`${out}/runtime-${label}.png`;await page.screenshot({path:p});result.screenshots.push(p);}
async function load(phone=false){await page.setViewport({width:phone?430:1440,height:phone?932:900,isMobile:phone,hasTouch:phone,deviceScaleFactor:1});await page.goto('http://127.0.0.1:4173/the-last-bellkeeper/');await page.waitForFunction(()=>document.querySelector("#startb")?.disabled===false,{timeout:45000});if(phone)await page.tap('#startb');else await page.click('#startb');await sleep(250);}
let held=[];
async function hold(next){for(const k of held)if(!next.includes(k))await page.keyboard.up(k);for(const k of next)if(!held.includes(k))await page.keyboard.down(k);held=next;}
async function go(x,z,label,tolerance=.5){let stuck=0,last=await read();for(let i=0;i<200;i++){const g=await read(),dx=x-g.pos[0],dz=z-g.pos[1],distance=Math.hypot(dx,dz);if(distance<tolerance){await hold([]);await sleep(80);const end=await read();result.waypoints.push({label,target:[x,z],actual:end.pos,time:Date.now(),travel:end.travel});console.log('waypoint',label,end.pos);return end;}const sx=dx*.788-dz*.615,sy=-dx*.615-dz*.788,keys=['ShiftLeft'];if(Math.abs(sx)>.14)keys.push(sx>0?'KeyD':'KeyA');if(Math.abs(sy)>.14)keys.push(sy>0?'KeyW':'KeyS');await hold(keys);await sleep(110);const after=await read();if(Math.hypot(after.pos[0]-last.pos[0],after.pos[1]-last.pos[1])<.015)stuck++;else stuck=0;last=after;if(stuck>18){await hold([]);throw Error('Collision/route blocker '+label+' at '+JSON.stringify(after));}}await hold([]);throw Error('Route timeout '+label+' '+JSON.stringify(await read()));}
async function action(expected,label){const before=await read();if(before.context!==expected)throw Error('Expected '+expected+' context at '+label+', got '+JSON.stringify(before));await page.keyboard.press('Space');await sleep(1000);const after=await read();result.checks[label]=after;return after;}
try{
for(const phone of [false,true]){
 const prefix=phone?'phone':'desktop';await load(phone);
 await go(-5,13,'approach');await go(-4,8,'cottage');
 const chunks=[];const rec=await page.screencast({fps:60,speed:1,ffmpegPath:'/Users/seb/Documents/ChatGPT/Project BellKeeper/setup-tools/node_modules/ffmpeg-static/ffmpeg'});rec.on('data',c=>chunks.push(c));
 await go(-10,5,'roots');await shot(prefix+'-roots');
 await go(-11,4,'arc-west');await shot(prefix+'-west');
 await go(-9,4,'arc-east');await shot(prefix+'-east');
 await go(-6,7,'retreat');await shot(prefix+'-retreat');
 await go(-10,5,'roots-return');await shot(prefix+'-return');
 await rec.stop();await fs.writeFile(out+'/'+prefix+'-transition.webm',Buffer.concat(chunks));
 for(const [x,z]of [[-15,0],[-16,-7],[-10,-10],[-8,-15]])await go(x,z,'garden');
 await action('chime',prefix+'-chime');for(const [x,z]of [[-9,-19.5],[-11,-19.5],[-13.2,-17.5]])await go(x,z,'responsive');await shot(prefix+'-garden');
}
result.pass=true;
}catch(e){result.failure=e.message;await hold([]);await shot('failure');}finally{await fs.writeFile(out+'/result.json',JSON.stringify(result,null,2));await browser.close();}
