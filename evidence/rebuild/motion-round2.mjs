import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const dir='evidence/rebuild/motion-round2';await fs.mkdir(dir,{recursive:true});
const b=await puppeteer.launch({headless:true});const p=await b.newPage();await p.setViewport({width:1280,height:800});const log={started:new Date().toISOString(),frames:[],errors:[]};p.on('pageerror',e=>log.errors.push(e.message));await p.goto('http://127.0.0.1:4173/the-last-bellkeeper/');await p.waitForFunction(()=>document.querySelector('#startb')?.disabled===false,{timeout:60000});await p.click('#startb');
const wait=ms=>new Promise(r=>setTimeout(r,ms));const read=()=>p.evaluate(()=>({...window.__GAME__}));let n=0;let held=[];
async function hold(keys){for(const k of held)if(!keys.includes(k))await p.keyboard.up(k);for(const k of keys)if(!held.includes(k))await p.keyboard.down(k);held=keys;}
async function shot(label){const file=String(n++).padStart(3,'0')+'.png';await p.screenshot({path:dir+'/'+file});log.frames.push({file,label,t:Date.now(),state:await read()});}
async function sample(label,keys,count=7,gap=100){await hold(keys);for(let i=0;i<count;i++){await wait(gap);await shot(label);}}
async function go(x,z){let stuck=0,last=await read();for(let i=0;i<230;i++){const g=await read(),dx=x-g.pos[0],dz=z-g.pos[1];if(Math.hypot(dx,dz)<.5){await hold([]);await wait(100);return;}const sx=dx*.788-dz*.615,sy=-dx*.615-dz*.788,keys=['ShiftLeft'];if(Math.abs(sx)>.14)keys.push(sx>0?'KeyD':'KeyA');if(Math.abs(sy)>.14)keys.push(sy>0?'KeyW':'KeyS');await hold(keys);await wait(100);const a=await read();if(Math.hypot(a.pos[0]-last.pos[0],a.pos[1]-last.pos[1])<.015)stuck++;else stuck=0;last=a;if(stuck>20)throw Error('stuck '+x+','+z);}throw Error('route timeout');}
try{
await sample('idle',[],4,180);await sample('walk-right',['KeyD'],7,80);await sample('run-left',['KeyA','ShiftLeft'],8,75);await sample('run-up',['KeyW','ShiftLeft'],6,75);await hold([]);await p.keyboard.press('KeyJ');await sample('jump-land',[],8,70);await sample('settle',[],3,100);
await p.keyboard.press('Escape');await p.click('#reset');for(const [x,z] of [[-5,13],[-4,8],[-10,5],[-15,0],[-16,-7],[-10,-10],[-8,-15]]){await go(x,z);if(x===-10&&z===5)await shot('cottage-occlusion-retest');}
await p.keyboard.press('Space');await sample('chime-release',[],7,55);await go(-10,-17);await p.keyboard.press('Space');await sample('capture',[],8,55);
for(const [x,z]of [[-10,-10],[-16,-7],[-15,0],[-10,5],[-4,8],[0,6],[4,4],[5,3.7]])await go(x,z);await p.keyboard.press('Space');await sample('wheel-release',[],8,55);await shot('settled');
}catch(e){log.failure=e.message;await hold([]);await shot('failure');}finally{await fs.writeFile(dir+'/result.json',JSON.stringify(log,null,2));await b.close();console.log(JSON.stringify({frames:n,failure:log.failure,errors:log.errors}));}
