import assert from 'node:assert/strict';
import * as THREE from 'three';
import makeHero from '../game/assets/hero.js';
import {createAnimator} from '../game/animation.js';
const hero=makeHero(THREE),j=hero.userData.joints;
const bind=new Map(Object.values(j).map(n=>[n,{p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()}]));
const move={speed:0,yaw:0,grounded:true,verticalVelocity:0};
const anim=createAnimator(THREE,hero,move),rootP=hero.position.clone(),rootQ=hero.quaternion.clone();
const staff=new THREE.Group();hero.userData.grip.add(staff);const grip=staff.parent;
let time=0;const sample=(opts={})=>{time+=1/60;anim.update(1/60,{time,...opts});hero.updateMatrixWorld(true);for(const n of Object.values(j)){assert(n.matrixWorld.elements.every(Number.isFinite));assert(n.scale.equals(bind.get(n).s));}assert(hero.position.equals(rootP));assert(hero.quaternion.equals(rootQ));assert.equal(staff.parent,grip);};
for(let i=0;i<180;i++)sample();
move.speed=4.5;const leg=[];for(let i=0;i<180;i++){move.yaw=i>80?Math.PI:0;sample();leg.push(j.leftUpperLeg.rotation.x);}assert(Math.max(...leg)-Math.min(...leg)>.5);
move.grounded=false;move.verticalVelocity=6;sample();assert(j.leftLowerLeg.rotation.x>.8);
for(let i=0;i<40;i++){move.verticalVelocity-=19/60;sample();}move.grounded=true;move.verticalVelocity=0;sample();
for(const action of ['capture','release'])for(let i=0;i<=60;i++)sample({action,actionProgress:i/60,charged:true,impact:i/60});
move.speed=0;for(let i=0;i<30;i++)sample();anim.reset();for(const [n,b]of bind){assert(n.position.equals(b.p));assert(n.quaternion.equals(b.q));assert(n.scale.equals(b.s));}
// Missing optional joints safely degrade instead of crashing the render loop.
const sparse=new THREE.Group();sparse.userData.joints={};createAnimator(THREE,sparse,move).update(.016,{time:0});
console.log('PASS: finite articulated poses, run swing, jump tuck, landing transition, action curves, unchanged root/scale/grip, exact bind reset, missing optional joints');
