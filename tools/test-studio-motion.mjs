import puppeteer from 'puppeteer';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const out=process.argv[3]||'evidence/character-lab/motion-pass';await fs.mkdir(out,{recursive:true});
const browser=await puppeteer.launch({headless:true});
try{const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:1100,height:850});await p.goto(process.argv[2]||'http://127.0.0.1:4173/the-last-bellkeeper/character-lab.html');await p.waitForFunction(()=>window.__LAB__);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>p.evaluate(()=>window.__LAB__),samples=[];
async function sample(label){const s=await state();samples.push({label,...s});assert(Math.abs(Object.values(s.motion.weights).reduce((a,b)=>a+b,0)-1)<1e-5);await p.screenshot({path:`${out}/${label}.png`});return s;}
await p.select('#clip','free');await p.keyboard.down('ShiftLeft');await p.keyboard.down('ArrowUp');await wait(90);const start=await sample('start');assert(start.speed>0&&start.speed<6.9);
await wait(600);assert((await state()).speed>6.8);await p.keyboard.up('ArrowUp');await p.keyboard.down('ArrowRight');await wait(100);const turn=await sample('turn');assert(Math.abs(turn.motion.bank)>.015);
await wait(200);await p.keyboard.up('ArrowRight');await wait(50);const stop=await sample('brake');assert(stop.speed>0&&stop.speed<6.8);await p.keyboard.up('ShiftLeft');await wait(650);assert((await state()).speed<.02);assert.equal((await state()).authoredClip,'Idle_Loop');
for(let attempt=0;attempt<2;attempt++){await p.keyboard.press('KeyA');await wait(70);assert(!(await state()).grounded);await sample(`jump-${attempt}`);let landed=false;for(let i=0;i<30;i++){await wait(25);const s=await state();if(s.grounded){assert.equal(s.authoredClip,'Jump_Land');landed=true;break;}}assert(landed);await wait(100);await sample(`landing-${attempt}`);assert.equal((await state()).authoredClip,'Jump_Land');await wait(600);assert.equal((await state()).authoredClip,'Idle_Loop');}
await p.select('#clip','transitions');await wait(1300);assert((await state()).speed>6.5);assert.deepEqual(errors,[]);await fs.writeFile(`${out}/report.json`,JSON.stringify({samples,errors},null,2));console.log('PASS real-input acceleration, turn lean, braking, repeated takeoff/landing/recovery and transition preview');
}finally{await browser.close();}
