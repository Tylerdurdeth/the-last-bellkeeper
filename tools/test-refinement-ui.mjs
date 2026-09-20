import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.argv[2]||'evidence/rebuild/refinement-20/ui';await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({headless:true});const page=await browser.newPage(),errors=[],checks=[];const client=await page.createCDPSession();
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const rect=id=>page.$eval(id,e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};});
try{
 for(const [name,width,height,touch] of [['desktop',1440,900,false],['phone',390,844,true],['landscape',844,390,true]]){
  await page.setViewport({width,height,hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:4173/the-last-bellkeeper/');await page.waitForFunction(()=>window.__READY__===true,{timeout:45000});
  await page.click('#startb');await delay(180);
  if(!touch){
   const before=await page.evaluate(()=>__GAME__.pos);for(const k of ['KeyW','KeyS','KeyD'])await page.keyboard.down(k);await delay(220);for(const k of ['KeyW','KeyS','KeyD'])await page.keyboard.up(k);
   assert.deepEqual(await page.evaluate(()=>__GAME__.pos),before,'letters must not move');
   await page.keyboard.press('KeyA');await delay(140);const air=await page.evaluate(()=>({pos:__GAME__.pos,grounded:__GAME__.grounded}));assert(!air.grounded);assert.deepEqual(air.pos,before,'A jumps without strafing');await delay(650);
   await page.keyboard.down('ArrowUp');await delay(240);await page.keyboard.up('ArrowUp');assert(await page.evaluate(()=>__GAME__.travel)>.1,'arrow movement');
  }else{
   await page.tap('#mapToggle');assert.equal(await page.$eval('#mapToggle',e=>e.getAttribute('aria-expanded')),'true');
   const chart=await rect('#map'),button=await rect('#mapToggle');assert(chart.x>=0&&chart.y>=0&&chart.right<=width&&chart.bottom<=height,'enlarged chart fits');assert(button.width>=44&&button.height>=44,'touch target');
   const drag=async(x,y,dx)=>{await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(70);};
   const yaw=await page.evaluate(()=>__GAME__.cameraYaw);await drag(chart.x+50,chart.y+70,70);assert.equal(await page.evaluate(()=>__GAME__.cameraYaw),yaw,'chart drag must not orbit scenery');
   await drag(10,height*.45,20);assert.notEqual(await page.evaluate(()=>__GAME__.cameraYaw),yaw,'exposed scenery must still orbit');
   await page.screenshot({path:out+'/'+name+'-chart.png'});await page.tap('#pause');assert(await page.$eval('#map',e=>e.hidden),'pause hides chart');await page.tap('#resume');assert.equal(await page.$eval('#mapToggle',e=>e.getAttribute('aria-expanded')),'false');
  }
  await page.screenshot({path:out+'/'+name+'.png'});checks.push({name,pass:true});
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({pass:true,checks,errors},null,2));console.log('PASS keyboard arrows/A, phone and landscape chart expansion, touch sizing, pause/resume and error-free loading');
}finally{await browser.close();}
