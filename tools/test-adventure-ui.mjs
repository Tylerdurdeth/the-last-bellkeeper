import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import {readSave,writeSave,SAVE_KEY} from '../game/adventure-save.js';
const out='evidence/adventure/menus';await fs.mkdir(out,{recursive:true});
const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
assert.equal(readSave(storage),null);storage.setItem(SAVE_KEY,'broken');assert.equal(readSave(storage),null);
storage.setItem(SAVE_KEY,JSON.stringify({version:1,state:{},checkpoint:[Infinity,0,0]}));assert.equal(readSave(storage),null);
const s={keepsakes:new Set([1]),charged:true};assert(writeSave(s,null,null,[1,2,3],storage));assert.equal(readSave(storage).state.charged,true);
const browser=await puppeteer.launch({headless:true}),errors=[],checks=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(const seconds of [0,8,20]){
  const context=await browser.createBrowserContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:4173/the-last-bellkeeper/');await page.waitForFunction(()=>window.__READY__===true,{timeout:60000});
  if(seconds===0){await page.tap('#settingsb');await page.tap('#motion');await page.tap('#sound');await page.tap('#resume');assert(await page.$eval('#pausePanel',e=>e.hidden));await page.screenshot({path:out+'/title-phone.png'});}
  await page.tap('#startb');const before=await page.evaluate(()=>__GAME__.pos);await sleep(seconds*1000);await page.tap('#skipIntro');await sleep(200);
  const state=await page.evaluate(()=>__GAME__);assert(!state.introActive&&state.started&&!state.charged&&!state.porchRead&&!state.awakened);assert.deepEqual(state.pos,before);assert(await page.$eval('#skipIntro',e=>e.hidden));
  await page.reload();await page.waitForFunction(()=>window.__READY__===true,{timeout:60000});assert(await page.$eval('#continueb',e=>!e.hidden));await page.tap('#continueb');await sleep(200);assert(!(await page.evaluate(()=>__GAME__.introActive)));
  await page.tap('#pause');await page.screenshot({path:out+`/pause-${seconds}.png`});await page.tap('#reset');await sleep(100);assert.equal(await page.evaluate(()=>__GAME__.campaign.progress.entered),false);checks.push({skipAtSeconds:seconds,pass:true});await context.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/result.json',JSON.stringify({pass:true,checks,errors},null,2));console.log('PASS save validation, phone settings, intro skip at0/8/20s, continue and restart');
}catch(error){await fs.writeFile(out+'/failure.json',JSON.stringify({error:error.message,errors,checks},null,2));console.error(errors);throw error;}finally{await browser.close();}
