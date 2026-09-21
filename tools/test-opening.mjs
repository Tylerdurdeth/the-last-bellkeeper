import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.argv[2]||'evidence/title-opening';await fs.mkdir(out,{recursive:true});
const browser=await puppeteer.launch({headless:true}),results=[],errors=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{for(const [name,width,height,touch]of [['desktop',1440,900,false],['phone',390,844,true],['landscape',844,390,true]]){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.goto('http://127.0.0.1:4173/the-last-bellkeeper/');await page.waitForFunction(()=>window.__READY__&&!document.querySelector('#startb').disabled,{timeout:60000});await page.screenshot({path:`${out}/${name}-title.png`});
 const bounds=await page.evaluate(()=>['startb','titleSound','settingsb','creditsb'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,bottom:r.bottom,height:r.height,right:r.right};}));for(const r of bounds)assert(r.y>=0&&r.bottom<=height&&r.x>=0&&r.right<=width&&r.height>=44,JSON.stringify(r));
 const click=selector=>page[touch?'tap':'click'](selector);await click('#titleSound');await wait(300);assert.equal(await page.$eval('#titleSound',e=>e.getAttribute('aria-pressed')),'true');await click('#titleSound');assert.equal(await page.$eval('#titleSound',e=>e.getAttribute('aria-pressed')),'false');await click('#titleSound');
 await click('#startb');await wait(250);assert.equal(await page.$eval('#storyHeading',e=>e.textContent),'A village built on a breath.');await page.screenshot({path:`${out}/${name}-story.png`});
 const p0=await page.evaluate(()=>__GAME__.pos);await click('#storyNext');await wait(150);assert.equal(await page.$eval('#storyHeading',e=>e.textContent),'This morning, silence.');await click('#storyNext');await wait(150);assert.equal(await page.$eval('#storyHeading',e=>e.textContent),'One keeper. One apprentice.');await click('#storyNext');await wait(600);assert(await page.$eval('#prologue',e=>e.hidden));assert((await page.evaluate(()=>__GAME__.introTime))>=27);await page.screenshot({path:`${out}/${name}-guardian.png`});await click('#skipIntro');await wait(350);assert(!(await page.evaluate(()=>__GAME__.introActive)));assert.deepEqual(await page.evaluate(()=>__GAME__.pos),p0);assert(await page.$eval('#titleArt',e=>e.hidden));
 await page.reload();await page.waitForFunction(()=>window.__READY__,{timeout:60000});await click('#continueb');await wait(200);assert(!(await page.evaluate(()=>__GAME__.introActive)));assert(await page.$eval('#prologue',e=>e.hidden));assert(await page.$eval('#titleArt',e=>e.hidden));results.push({name,bounds,pass:true});await context.close();
 }assert.deepEqual(errors,[]);console.log('PASS title layouts, music toggle, three story cards, guardian transition, skip and Continue');
}finally{await fs.writeFile(out+'/results.json',JSON.stringify({results,errors},null,2));await browser.close();}
