import assert from 'node:assert/strict';
import * as T from 'three';
import heroBuilder from '../game/assets/hero.js';
import {createAnimator} from '../game/animation.js';
const results=[];
for(const hz of [30,60,120]){
 const hero=heroBuilder(T),m={speed:0,yaw:0,grounded:true,verticalVelocity:0},a=createAnimator(T,hero,m),j=hero.userData.joints;
 for(let i=0;i<hz;i++)a.update(1/hz,{time:0});
 m.speed=4.5;for(let i=0;i<hz;i++)a.update(1/hz,{time:0});
 const moving=j.cape.rotation.x;m.speed=0;a.update(1/hz,{time:0});const first=j.cape.rotation.x;
 for(let i=0;i<hz;i++)a.update(1/hz,{time:0});const settled=j.cape.rotation.x;
 assert(Math.abs(first)>Math.abs(settled)+.01,'cloth must retain and then dissipate motion');
 m.grounded=false;m.verticalVelocity=6;a.update(1/hz);const tucked=j.leftLowerLeg.rotation.x;
 m.verticalVelocity=-5;a.update(1/hz);const ready=j.leftLowerLeg.rotation.x;assert(tucked-ready>.8,'descending legs should prepare for contact');
 for(const node of Object.values(j))assert(node.quaternion.toArray().every(Number.isFinite));
 a.reset();assert(Math.abs(j.cape.rotation.x)<1e-12);results.push({hz,moving,first,settled,tucked,ready});
}
console.log(JSON.stringify(results,null,2));
console.log('PASS cloth follow-through settles, descending pose unfolds, finite transforms, reset');
