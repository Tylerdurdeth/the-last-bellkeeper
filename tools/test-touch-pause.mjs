import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
const browser=await puppeteer.launch({headless:true});
const page=await browser.newPage();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await page.goto(process.argv[2]||'http://127.0.0.1:4173/the-last-bellkeeper/');
 await page.waitForFunction(()=>!document.querySelector('#startb').disabled);
 await page.tap('#startb');await sleep(150);
 assert(await page.evaluate(()=>matchMedia('(any-pointer: coarse)').matches));
 const c=await page.createCDPSession();
 const s=await page.$eval('#stick',e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
 for(let i=0;i<8;i++){
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...s}]});
  await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:i%2?2:s.x+40,y:s.y-25}]});
  // Reproduce a visible mobile-window blur, separately from real touch input.
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await sleep(100);
  assert.equal(await page.$eval('#pausePanel',e=>e.hidden),true,'visible touch blur must not pause');
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 assert((await page.evaluate(()=>window.__GAME__.travel))>.1);
 await page.tap('#pause');await sleep(100);assert.equal(await page.$eval('#pausePanel',e=>e.hidden),false);
 await page.tap('#resume');await sleep(100);assert.equal(await page.$eval('#pausePanel',e=>e.hidden),true);
 // Simulate background visibility; this is a policy test, not physical Safari evidence.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
 assert.equal(await page.$eval('#pausePanel',e=>e.hidden),false);
 await page.tap('#resume');
 await page.setViewport({width:1280,height:720,isMobile:false,hasTouch:false});
 await page.waitForFunction(()=>!document.querySelector('#startb').disabled);
 await page.click('#startb');await sleep(100);
 assert.equal(await page.evaluate(()=>matchMedia('(any-pointer: coarse)').matches),false);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 assert.equal(await page.$eval('#pausePanel',e=>e.hidden),false,'desktop blur still pauses');
 assert.deepEqual(errors,[]);
 console.log('PASS repeated touch drags, visible mobile blur, explicit pause/resume, background visibility and desktop blur. Physical iPhone verification outstanding.');
}finally{await browser.close();}
