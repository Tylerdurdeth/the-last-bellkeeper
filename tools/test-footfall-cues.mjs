import assert from 'node:assert/strict';
import * as T from 'three';
import makeHero from '../game/assets/hero.js';
import {createAnimator} from '../game/animation.js';

const rows=[];
for(const hz of [30,60,120])for(const speed of [2.2,4.5]){
 const hero=makeHero(T),move={speed,yaw:0,grounded:true,verticalVelocity:0};
 const anim=createAnimator(T,hero,move),history={left:[],right:[]};let lastSide=null,count=0,maxSole=-Infinity;
 for(let frame=0;frame<hz*4;frame++){
  anim.update(1/hz,{time:frame/hz});hero.updateMatrixWorld(true);
  for(const side of ['left','right']){
   const sole=new T.Box3().setFromObject(hero.userData.joints[side+'Foot']).min.y;
   if(frame>hz&&anim.footfalls.includes(side)){
    assert(sole<.03,`${side} cue while foot is above ground: ${sole}`);
    assert(Math.max(...history[side])>.045,`${side} cue without a preceding lifted swing`);
    assert.notEqual(side,lastSide,'locomotion footfalls must alternate');
    maxSole=Math.max(maxSole,sole);lastSide=side;count++;
   }
   history[side].push(sole);if(history[side].length>Math.ceil(hz*.14))history[side].shift();
  }
 }
 assert(count>8&&count<30,'sustained movement supplies plausible footfall events');
 move.grounded=false;move.verticalVelocity=4;
 for(let i=0;i<hz;i++){anim.update(1/hz);assert.equal(anim.footfalls.length,0,'airborne steps');}
 move.grounded=true;move.verticalVelocity=0;anim.update(1/hz);assert.equal(anim.footfalls.length,0,'landing duplicates step cue');
 move.speed=0;for(let i=0;i<hz;i++){anim.update(1/hz);assert.equal(anim.footfalls.length,0,'stationary steps');}
 anim.reset();assert.equal(anim.footfalls.length,0,'stale reset event');
 rows.push({hz,speed,count,maxSole});
}
for(const speed of [2.2,4.5]){const counts=rows.filter(r=>r.speed===speed).map(r=>r.count);assert(Math.max(...counts)-Math.min(...counts)<=1,'frame-rate changes audible cadence');}
console.log(JSON.stringify(rows,null,2));
console.log('PASS actual foot bounds at gait cues; preceding swing, alternation, frame-rate consistency, no air/idle/landing/reset duplicates. Not listening approval.');
