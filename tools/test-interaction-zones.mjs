// Interaction zones match what is drawn: for each story target, walk onto its
// visible prop/ribbon/floor marker with real arrow keys from >=4 directions and
// require the specific prompt label (never the generic "Listen & explore").
// Uses saved-checkpoint fixtures (like test-campaign-gameplay-views) to start
// beside each target: a zone check, NOT end-to-end progression evidence.
// Usage: node tools/test-interaction-zones.mjs [outDir] [baseUrl]
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import * as T from 'three';
import {height} from '../game/world-layout.js';
import {buildCampaignWorld} from '../game/campaign-world.js';
globalThis.location={href:new URL('../game/index.html',import.meta.url).href};
const cw=await buildCampaignWorld(new T.Scene()),groundAt=(x,z)=>cw.ground(x,z)??height(x,z);
const out=process.argv[2]||'evidence/round-1/paths/zones',base=process.argv[3]||'http://127.0.0.1:4173/the-last-bellkeeper/';await fs.mkdir(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const camp=(keys,origin=null)=>({version:1,chargeOrigin:origin,progress:Object.fromEntries(['entered','bridge','service','inspection','returnCleared','returnAligned','outwardAligned','restored'].map(k=>[k,keys.includes(k)]))});
const wood={awakened:false,restored:false,porchRead:true};
// [name, save state, campaign, label substring, [[standX,standZ,startX,startZ],...]]
const targets=[
 ['porch staff',{...wood,porchRead:false},{},'Take the bell staff',[[-8.1,11.75,-8.1,14.2],[-8.4,11.8,-10.4,13.6],[-6.5,11.45,-6.5,14],[-6.1,11.1,-3.8,11.1],[-7.8,11.8,-5.6,13.8]]],
 ['morning bell rope',{...wood,porchRead:false,awakened:false},{},'Pull the morning bell rope',[[0.11,15.91,1.46,17.64],[-1.34,14.05,-2.69,12.32],[-1.54,15.99,-3.06,17.58],[0.59,14.33,2.5,13.24],[-0.72,16.3,-0.94,18.49]]],
 ['bypass gust ring',{...wood,awakened:true},{},'Catch the gust',[[5.72,6.5,7.82,6.5],[4.0,8.22,4.0,10.32],[2.28,6.5,0.18,6.5],[4.0,4.78,4.0,2.68],[2.78,7.72,1.3,9.2]]], // outer edge of the painted 1.5 m ring under Mara's outlet
 ['woodland wheel',{...wood,awakened:true,charged:true},{},'Give the gust',[[6.9,2.5,9.2,2.5],[6,3.4,6,5.6],[5.1,2.5,2.8,2.5],[6.7,3.2,8.3,4.8],[4.4,1.9,2.2,1.9]]],
 ['far bell',{...wood,restored:true},{},'Listen beyond',[[9.5,-11.3,11.6,-11.3],[8,-10.4,8,-8.2],[6.5,-11.3,5.3,-11.3],[9.3,-10.5,10.9,-8.9]]],
 ['rootway gust source',{},camp(['entered']),'Catch the rootway current',[[5.8,-21.8,8.2,-21.8],[4.6,-20.2,6.6,-19.6],[4.8,-22.9,4.8,-25.4],[3.8,-21.9,3.8,-24.2]]],
 ['bridge wheel',{charged:true},camp(['entered'],'source'),'Give wind to the service bridge',[[4.2,-28.2,4.2,-25.6],[5.3,-28.3,7.6,-26.6],[5.35,-28.45,8.2,-28.3],[3.75,-28.25,3.75,-25.6]]],
 ['tender rotor',{charged:true},camp(['entered','bridge'],'source'),'Give wind to the exposed rotor',[[9.95,-37,10.6,-37],[8,-38.95,8,-39.6],[6.05,-37,4.6,-37],[9.4,-35.65,10.3,-34.8]]], // ~1.95 m: beside the tender, as in review shot 168
 ['central bell',{},camp(['entered','bridge','service','inspection','returnCleared','returnAligned','outwardAligned']),'Ring the balanced bell',[[8,-66.3,8,-63.8],[9.6,-67,12,-67],[6.4,-67,3.6,-67.4],[9.2,-66.2,11.2,-64.4]]],
];
const browser=await puppeteer.launch({headless:true}),results=[];let failures=0;
try{for(const [name,st,campaign,label,runs] of targets){let i=0;for(const [sx,sz,ax,az] of runs){
 const page=await browser.newPage();await page.setViewport({width:1280,height:720,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluateOnNewDocument(s=>{localStorage.setItem('bellkeeper-muted','1');localStorage.setItem('bellkeeper-adventure-v1',JSON.stringify(s));},{version:1,state:{charged:false,awakened:true,restored:true,complete:false,porchRead:true,...st},campaign,discoveries:{echoSolved:true,stoneStep:3},keepsakes:[],checkpoint:[ax,groundAt(ax,az)+.05,az]});
 await page.goto(base);await page.waitForFunction(()=>window.__READY__&&!document.querySelector('#continueb').hidden,{timeout:60000});await page.click('#continueb');await sleep(900);
 const read=()=>page.evaluate(()=>({...window.__GAME__,label:document.querySelector('#action').textContent.replace('SPACE','').trim()}));
 let held=[],stuck=0,old=await read(),start=old.pos,recoveries=0;
 const hold=async keys=>{for(const k of held)if(!keys.includes(k))await page.keyboard.up(k);for(const k of keys)if(!held.includes(k))await page.keyboard.down(k);held=keys;};
 for(let n=0;n<90;n++){const g=await read(),dx=sx-g.pos[0],dz=sz-g.pos[1],d=Math.hypot(dx,dz);if(d<.16)break;
  const px=dx*Math.cos(g.cameraYaw)-dz*Math.sin(g.cameraYaw),py=-dx*Math.sin(g.cameraYaw)-dz*Math.cos(g.cameraYaw),keys=[];if(Math.abs(px)>.08*d)keys.push(px>0?'ArrowRight':'ArrowLeft');if(Math.abs(py)>.08*d)keys.push(py>0?'ArrowUp':'ArrowDown');
  await hold(keys);await sleep(d<.6?45:90);await hold([]);const m=await read();if(/carries you back/.test(await page.$eval('#caption',e=>e.textContent)))recoveries++;stuck=Math.hypot(m.pos[0]-old.pos[0],m.pos[1]-old.pos[1])<.008?stuck+1:0;old=m;if(stuck>6)break;}
 await hold([]);await sleep(300);const g=await read();const ok=g.label.includes(label)&&Math.hypot(g.pos[0]-sx,g.pos[1]-sz)<.45;
 if(!ok)failures++;const row={target:name,run:i,from:start,stand:[sx,sz],at:g.pos.map(v=>+v.toFixed(2)),label:g.label,expected:label,ok,errors};results.push(row);console.log((ok?'PASS ':'FAIL ')+name+' #'+i+' at '+row.at+' -> '+g.label);
 if(i===0||!ok)await page.screenshot({path:`${out}/${name.replace(/\W+/g,'-')}-${i}${ok?'':'-FAIL'}.png`});await page.close();i++;}}
}finally{await browser.close();}
const summary={kind:'Saved-checkpoint fixtures + real arrow-key approach; interaction-zone check only',base,pass:failures===0,failures,targets:[...new Set(results.map(r=>r.target))].map(t=>({target:t,passedDirections:results.filter(r=>r.target===t&&r.ok).length,of:results.filter(r=>r.target===t).length})),results};
await fs.writeFile(`${out}/result.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary.targets));
const short=summary.targets.filter(t=>t.passedDirections<4);if(short.length){console.error('Fewer than 4 directions:',short.map(t=>t.target).join(', '));process.exitCode=1;}
