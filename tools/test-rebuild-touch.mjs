import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const out=process.argv[2]||'evidence/rebuild/touch-round3';await fs.mkdir(out,{recursive:true});
const result={kind:'Phone-emulated full quest and keepsakes, real touch contacts only, read-only telemetry, known-route test',startedAt:new Date().toISOString(),errors:[],requests:[],waypoints:[],checks:{},jumps:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await puppeteer.launch({headless:true});const page=await browser.newPage();await page.setViewport({width:430,height:932,deviceScaleFactor:1,isMobile:true,hasTouch:true});const client=await page.createCDPSession();page.on('pageerror',e=>result.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)result.requests.push(r.url());});
let stick=null,active=false;
const read=()=>page.evaluate(()=>({...window.__GAME__}));
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
async function release(){if(active){await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});active=false;}}
async function steer(dx,dz,magnitude){const sx=dx*.788-dz*.615,sy=-dx*.615-dz*.788,n=Math.hypot(sx,sy)||1;if(!active){await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:stick.x,y:stick.y}]});active=true;}await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:stick.x+sx/n*stick.r*magnitude,y:stick.y-sy/n*stick.r*magnitude}]});}
async function tap(selector){await release();await page.tap(selector);}
async function jump(){await release();const before=await read();await page.tap('#jump');await sleep(80);result.jumps.push({before,after:await read()});}
async function go(x,z,label,{tolerance=.35,jumpNear=false}={}){
 let last=await read(),stuck=0,jumped=false;
 for(let i=0;i<240;i++){
  const g=await read(),dx=x-g.pos[0],dz=z-g.pos[1],d=Math.hypot(dx,dz);
  if(d<tolerance){await release();await sleep(160);const end=await read();result.waypoints.push({label,target:[x,z],actual:end.pos,y:end.y,grounded:end.grounded,travel:end.travel});console.log('touch waypoint',label,end.pos,end.y);return end;}
  if(jumpNear&&!jumped&&d<1.5&&g.grounded){await jump();jumped=true;}
  await steer(dx,dz,Math.min(1,Math.max(.18,d*.85)));await sleep(90);const after=await read();if(Math.hypot(after.pos[0]-last.pos[0],after.pos[1]-last.pos[1])<.008)stuck++;else stuck=0;last=after;
  if(stuck>18){await release();throw Error('Touch route blocked '+label+' '+JSON.stringify(after));}
 }
 await release();throw Error('Touch route timeout '+label+' '+JSON.stringify(await read()));
}
async function action(context,label){await release();await sleep(250);const before=await read();if(before.context!==context)throw Error('Expected context '+context+' for '+label+' '+JSON.stringify(before));await page.tap('#action');await sleep(850);const after=await read();result.checks[label]=after;console.log('touch action',label,after.keepsakes,after.score);await shot(label);return after;}
try{
 await page.goto('http://127.0.0.1:4173/the-last-bellkeeper/');await page.waitForFunction(()=>document.querySelector('#startb')?.disabled===false,{timeout:45000});await page.tap('#startb');await sleep(200);stick=await page.$eval('#stick',e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,r:Math.min(r.width,r.height)*.36};});const begin=Date.now();result.checks.counterHidden={pass:!(await page.$eval('#chargeText',e=>e.textContent)).includes('keepsakes')};
 for(const [x,z,label]of [[-5,13,'bend'],[-6.5,11,'porch'],[-4,8,'cottage'],[-10,5,'roots'],[-15,0,'west-path'],[-17,-3,'rock-approach']]){await go(x,z,label);if(label==='porch'){await action('porch','porch-story');result.checks.porchStory={pass:(await read()).porchRead===true};}}
 await go(-19,-5,'rock-keepsake',{tolerance:.24,jumpNear:true});await sleep(750);await action('memory','keepsake-rock');
 for(const [x,z,label]of [[-17,-6,'rock-return'],[-16,-7,'upper-bend'],[-10,-10,'garden-approach'],[-8,-15,'chimes']])await go(x,z,label);
 await action('chime','awakened');
 await go(-10,-10,'echo-approach');await go(-7.97,-11.13,'wrong-note',{tolerance:.18});await action('discovery','wrong-echo');result.checks.wrongOrder={pass:(await read()).discoveries.stoneStep===0};
 for(const [i,x,z]of [[0,-8.8,-10.9],[1,-7.97,-11.13],[2,-7.14,-11.36]]){await go(x,z,'echo-'+i,{tolerance:.18});await action('discovery','echo-'+i);}result.checks.echo={pass:(await read()).discoveries.echoSolved};await go(-10,-10,'echo-return');await go(-8,-15,'garden-return');
 for(const [x,z,label]of [[-9,-19.5,'quiet-approach'],[-7,-19.5,'quiet-near'],[-7,-18.7,'quiet-bed']])await go(x,z,label);result.checks.quietPocket={pass:!(await read()).charged&&(await read()).context!=='capture'&&(await read()).quietObserved};await shot('quiet-bed');for(const [x,z,label]of [[-9,-19.5,'current-trail'],[-11,-19.5,'current-approach'],[-13.2,-17.5,'garden']])await go(x,z,label);await action('capture','captured');
 for(const [x,z,label]of [[-10,-10,'return-garden'],[-8,-7,'shortcut-approach']])await go(x,z,label);await go(-7,-5,'second-keepsake',{tolerance:.24,jumpNear:true});await sleep(700);await action('memory','keepsake-shortcut');
 for(const [x,z,label]of [[-5,1.5,'shortcut-shore'],[-3,2,'shortcut-return'],[0,6,'wheel-approach'],[4,4,'wheel-path'],[5,3.7,'wheel']])await go(x,z,label);
 await action('wheel','restored');for(const [x,z,label]of [[8,4,'around-wheel'],[8,.1,'bridge-near'],[8,-3.35,'bridge'],[8,-6.5,'bridge-far'],[8,-10,'overlook']])await go(x,z,label);
 await action('finish','completed');await go(11,-11,'third-keepsake');await action('memory','keepsake-overlook');const finished=await read();result.checks.fullTouch={pass:finished.score===1&&finished.keepsakes===3,seconds:(Date.now()-begin)/1000,travel:finished.travel,state:finished};
 await tap('#pause');await sleep(100);await page.tap('#reset');await sleep(200);const reset=await read();result.checks.reset={pass:!reset.porchRead&&!reset.quietObserved&&reset.keepsakes===0&&reset.score===0&&!reset.charged&&!reset.awakened&&!reset.restored&&!reset.discoveries.echoSolved&&!reset.discoveries.flowersAwake,state:reset};await shot('reset');result.pass=Object.values(result.checks).filter(c=>'pass'in c).every(c=>c.pass)&&!result.errors.length&&!result.requests.length;
}catch(e){await release();result.pass=false;result.failure=e.message;result.failureState=await read().catch(()=>null);await shot('failure');console.error(e.message);}
finally{result.finishedAt=new Date().toISOString();await fs.writeFile(`${out}/result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({pass:result.pass,failure:result.failure,fullTouch:result.checks.fullTouch,reset:result.checks.reset}));await browser.close();if(!result.pass)process.exitCode=1;}
