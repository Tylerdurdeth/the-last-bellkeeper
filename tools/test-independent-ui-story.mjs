import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='evidence/adventure/independent-ui-story-retest';await fs.mkdir(out,{recursive:true});
const hashes=async()=>Object.fromEntries(await Promise.all(['main.js','index.html','style.css'].map(async f=>[f,createHash('sha256').update(await fs.readFile('docs/'+f)).digest('hex')])));
const report={started:new Date().toISOString(),hashes:await hashes(),checks:[],errors:[]},browser=await puppeteer.launch({headless:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function open(width,height,touch){const context=await browser.createBrowserContext(),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.setViewport({width,height,deviceScaleFactor:1,isMobile:touch,hasTouch:touch});await page.goto('http://127.0.0.1:4173/the-last-bellkeeper/');await page.waitForFunction(()=>window.__READY__,{timeout:60000});return {context,page};}
const rects=page=>page.evaluate(()=>Object.fromEntries(['title','startb','continueb'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return [id,{hidden:e.hidden,x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}];})));
try{
 for(const [name,width,height,touch] of [['desktop',1360,900,false],['portrait',390,844,true],['landscape',844,390,true]]){
  const {context,page}=await open(width,height,touch),press=selector=>page[touch?'tap':'click'](selector);
  const fresh=await rects(page);await page.screenshot({path:`${out}/${name}-title.png`});
  report.checks.push({name:name+' title',pass:fresh.startb.y>=0&&fresh.startb.bottom<=height&&fresh.startb.height>=44,bounds:fresh});
  await press('#settingsb');await press('#subtitles');await press('#resume');await page.reload();await page.waitForFunction(()=>window.__READY__,{timeout:60000});await press('#settingsb');
  const label=await page.$eval('#subtitles',e=>e.textContent),stored=await page.evaluate(()=>localStorage.getItem('bellkeeper-captions'));await page.screenshot({path:`${out}/${name}-captions-reloaded.png`});
  report.checks.push({name:name+' saved captions',pass:label==='Captions: off'&&stored==='0',label,stored});
  await press('#subtitles');await press('#resume');await press('#startb');await delay(200);
  const before=await page.evaluate(()=>__GAME__.pos);
  if(touch){const stick=await page.$eval('#stick',e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}),client=await page.createCDPSession();await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...stick}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:stick.x,y:stick.y-40}]});await delay(550);await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else{await page.keyboard.down('ArrowUp');await delay(550);await page.keyboard.up('ArrowUp');}
  await delay(120);const after=await page.evaluate(()=>({pos:__GAME__.pos,intro:__GAME__.introActive,caption:document.querySelector('#caption').textContent,opacity:getComputedStyle(document.querySelector('#caption')).opacity}));
  report.checks.push({name:name+' first movement skips and is retained',pass:!after.intro&&Math.hypot(after.pos[0]-before[0],after.pos[1]-before[1])>.15,before,after});await page.screenshot({path:`${out}/${name}-movement-handoff.png`});
  await page.reload();await page.waitForFunction(()=>window.__READY__,{timeout:60000});const continued=await rects(page);report.checks.push({name:name+' continue title',pass:!continued.continueb.hidden&&continued.continueb.y>=0&&continued.continueb.bottom<=height&&continued.continueb.height>=44,bounds:continued});await page.screenshot({path:`${out}/${name}-continue-title.png`});await context.close();console.log('menus/gesture checked',name);
 }
 for(const [name,width,height,touch] of [['desktop',1360,900,false],['phone',390,844,true]]){
  const {context,page}=await open(width,height,touch);await page[touch?'tap':'click']('#startb');const started=Date.now();
  for(const second of [15,19]){await delay(Math.max(0,started+second*1000-Date.now()));const state=await page.evaluate(()=>({intro:__GAME__.introActive,pos:__GAME__.pos,caption:document.querySelector('#caption').textContent,draws:__GAME__.draws}));await page.screenshot({path:`${out}/${name}-intro-${second}.png`});report.checks.push({name:`${name} actual intro ${second}s`,observed:state});}
  await context.close();console.log('intro shots captured',name);
 }
}catch(e){report.errors.push(String(e));}finally{report.hashesAfter=await hashes();report.finished=new Date().toISOString();await fs.writeFile(out+'/results.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
