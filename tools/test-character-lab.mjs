import puppeteer from 'puppeteer';import assert from 'node:assert/strict';
const b=await puppeteer.launch({headless:true});const p=await b.newPage();const errors=[],meshRequests=[],failedAssets=[];let faceLoaded=false;p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)failedAssets.push(`${r.status()} ${r.url()}`);if(r.url().includes('/textures/face-r07.png')&&r.ok())faceLoaded=true;});p.on('request',r=>{if(/\.(glb|gltf|fbx|obj)(\?|$)/i.test(r.url()))meshRequests.push(r.url());});p.on('pageerror',e=>errors.push(e.message));const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 await p.setViewport({width:1280,height:800});await p.goto(process.argv[2]||'http://127.0.0.1:4173/the-last-bellkeeper/character-lab.html');await p.waitForFunction(()=>window.__LAB__);
 await p.screenshot({path:'evidence/character-lab/desktop.png'});
 assert.equal(await p.evaluate(()=>__LAB__.source),'character');
 for(const clip of ['walk','jog','run','jump','turn']){await p.select('#clip',clip);await sleep(120);assert.equal(await p.evaluate(()=>__LAB__.clip),clip);}
 await p.select('#clip','walk');await sleep(500);assert.equal(await p.evaluate(()=>__LAB__.authoredClip),'Walk_Loop');await p.screenshot({path:'evidence/character-lab/authored-walk.png'});
 await p.select('#clip','run');await sleep(500);assert.equal(await p.evaluate(()=>__LAB__.authoredClip),'Sprint_Loop');await p.screenshot({path:'evidence/character-lab/authored-run.png'});
 await p.select('#source','baseline');for(const mode of ['capture','release']){await p.select('#clip',mode);await sleep(80);assert.equal(await p.evaluate(()=>__LAB__.clip),mode);}
 for(const source of ['profile','sculpt','character']){await p.select('#source',source);await p.waitForFunction(s=>__LAB__.source===s,{},source);}
 await p.select('#source','character');await p.waitForFunction(()=>__LAB__.source==='character');
 await p.click('#freeze');await sleep(80);const t=await p.evaluate(()=>__LAB__.time);await sleep(100);assert.equal(await p.evaluate(()=>__LAB__.time),t);await p.click('#step');await sleep(40);assert(Math.abs((await p.evaluate(()=>__LAB__.time))-t-1/60)<.0001);
 await p.click('#freeze');await p.select('#clip','free');await p.keyboard.down('KeyW');await sleep(350);await p.keyboard.up('KeyW');assert(Math.hypot(...(await p.evaluate(()=>__LAB__.position)))>.1);
 await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await p.waitForFunction(()=>window.__LAB__);await p.select('#clip','free');
 const s=await p.$eval('#stick',e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});const c=await p.createCDPSession();
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...s}]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:s.x,y:s.y-35}]});await sleep(300);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(Math.hypot(...(await p.evaluate(()=>__LAB__.position)))>.1);
 await p.select('#clip','idle');await sleep(100);await p.screenshot({path:'evidence/character-lab/phone.png'});await p.select('#view','face');await sleep(100);await p.screenshot({path:'evidence/character-lab/face.png'});assert.deepEqual(meshRequests,[],'Studio must not load downloaded meshes');assert.deepEqual(errors,[]);assert.deepEqual(failedAssets,[]);assert(faceLoaded,'Atlas facial colour map must load successfully');console.log('PASS modes, freeze, frame step, keyboard movement, real emulated touch, desktop and phone rendering');
}finally{await b.close();}
