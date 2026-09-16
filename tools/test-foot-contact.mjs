import assert from 'node:assert/strict';
import * as T from 'three';
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import makeHero from '../game/assets/hero.js';
const modulePath=resolve(process.argv[2]||'game/animation.js');
const {createAnimator}=await import(pathToFileURL(modulePath));
const results=[];
// A stationary floor is an external constraint: near-ground feet should remain
// almost stationary while the character travels. No gait formula is copied here.
for(const hz of [30,60,120])for(const speed of [2.2,4.5]){
 const hero=makeHero(T),movement={speed,yaw:0,grounded:true,verticalVelocity:0};
 const animator=createAnimator(T,hero,movement),joints=hero.userData.joints;
 const samples=[],lowestSoles=[],previous={};
 for(let frame=0;frame<hz*3;frame++){
  hero.position.z+=speed/hz;animator.update(1/hz,{time:frame/hz});hero.updateMatrixWorld(true);
  const heights=[];
  for(const side of ['left','right']){
   const foot=joints[side+'Foot'],p=foot.getWorldPosition(new T.Vector3());
   const sole=new T.Box3().setFromObject(foot).min.y,last=previous[side];heights.push(sole);
   if(frame>hz&&last&&sole<.025&&last.sole<.025)samples.push(Math.hypot(p.x-last.p.x,p.z-last.p.z)*hz);
   previous[side]={p,sole};
  }
  if(frame>hz)lowestSoles.push(Math.min(...heights));
 }
 samples.sort((a,b)=>a-b);
 results.push({hz,speed,samples:samples.length,medianDrift:samples[Math.floor(samples.length*.5)],p90Drift:samples[Math.floor(samples.length*.9)],soleMin:Math.min(...lowestSoles),soleMax:Math.max(...lowestSoles)});
}
if(process.argv[3])await fs.writeFile(process.argv[3],JSON.stringify({modulePath,results},null,2));
console.log(JSON.stringify(results));
for(const row of results){
 assert(row.samples>row.hz*.7,'both feet must supply actual near-ground contact observations');
 // Allow small ankle motion from foot roll: .1m/s is roughly a centimetre
 // over a running stance, versus the original ~.65m/s continuous slide.
 assert(row.medianDrift<.1,`planted foot slides at speed ${row.speed}/${row.hz}Hz: ${row.medianDrift}`);
 assert(row.p90Drift<.20,`excessive sustained contact drift: ${row.p90Drift}`);
 assert(row.soleMin>-.02&&row.soleMax<.03,'stance soles should stay near the floor');
}
console.log('PASS: near-ground foot contact during steady walking/running at 30/60/120Hz; not a visual acting approval');
