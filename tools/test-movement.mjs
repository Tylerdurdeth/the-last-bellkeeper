import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMovement} from '../game/movement.js';
function fixture(options = {}) {
  const target = new EventTarget();
  const m = createMovement(THREE, {inputTarget: target, ...options});
  const key = (code, down = true) => { const e = new Event(down ? 'keydown' : 'keyup', {cancelable:true}); Object.defineProperty(e, 'code', {value:code}); target.dispatchEvent(e); };
  const tick = (seconds, hz = 60) => { for(let i=0;i<Math.round(seconds*hz);i++) m.update(1/hz); };
  return {m,key,tick,target};
}
const a=fixture(); a.key('KeyW');a.tick(1);assert(a.m.position.x< -1 && a.m.position.z < -1);assert(Math.abs(a.m.speed-2.2)<.01);
a.key('ShiftLeft');a.tick(.5);assert(a.m.speed>4.4);assert.equal(a.m.mode,'run');
a.key('KeyW',false);a.key('ShiftLeft',false);a.tick(.25);assert(a.m.speed<.01);
// Space belongs to contextual action; J launches a real ballistic jump.
a.key('Space');a.tick(.05);assert.equal(a.m.grounded,true);a.key('KeyJ');a.tick(.15);assert(a.m.position.y>.6);assert.equal(a.m.mode,'jump');a.tick(.6);assert.equal(a.m.grounded,true);assert.equal(a.m.position.y,0);
// Buffered jump just before touchdown fires once on the next ground contact.
a.key('KeyJ',false);a.m.jump();a.tick(.57);a.m.jump();a.tick(.12);assert(a.m.position.y>.1);assert(!a.m.grounded);
a.m.update(.01,{enabled:false});const frozen=a.m.position.clone();a.key('KeyW');a.m.update(.05,{enabled:false});assert(a.m.position.equals(frozen));a.m.reset();a.m.update(.01);a.tick(.2);assert.equal(a.m.speed,0);
// Wall collision preserves tangential movement and never penetrates its radius.
const wall=fixture({blocked:(x,z,r)=>x+r>.5});wall.key('KeyD');wall.key('ShiftLeft');wall.tick(2);assert(wall.m.position.x<=.271);assert(wall.m.position.z< -4);
// A raised ledge above the step limit blocks walking.
const ledge=fixture({sampleGround:(x,z)=>x>.5?.5:0});ledge.key('KeyD');ledge.tick(1);assert(ledge.m.position.x<=.5);assert.equal(ledge.m.position.y,0);
// 1 metre stream crossed at a run, with an airborne landing on the far bank.
const gap=fixture({sampleGround:(x,z)=>x>.8&&x<1.8?null:0});gap.key('KeyD');gap.key('ShiftLeft');gap.tick(.2);gap.m.jump();gap.tick(.8);assert(gap.m.position.x>1.8);assert(gap.m.grounded);
// Coyote jump is still accepted immediately after running off a bank.
const edge=fixture({sampleGround:(x,z)=>x<.8?0:null});edge.key('KeyD');edge.key('ShiftLeft');while(edge.m.grounded)edge.m.update(1/120);edge.m.jump();edge.m.update(1/120);assert(edge.m.verticalVelocity>5);
edge.tick(2);assert(edge.m.position.y>=-4); // no unbounded fall / softlock
edge.key('KeyD',false);edge.key('ShiftLeft',false);edge.tick(2);assert(edge.m.grounded);assert(edge.m.position.x<.8);
// A true void returns before the avatar can descend 1.25m below its safe bank.
// Observe every frame; recovery flag is a one-update event and does not teleport speed.
const shallowVoid=fixture({sampleGround:(x,z)=>x<.8?0:null});
shallowVoid.key('KeyD');shallowVoid.key('ShiftLeft');let lowest=0,recoveryCount=0;
for(let i=0;i<180;i++){shallowVoid.m.update(1/120);lowest=Math.min(lowest,shallowVoid.m.position.y);if(shallowVoid.m.recovered){recoveryCount++;assert(shallowVoid.m.grounded);assert(shallowVoid.m.position.x<.8);assert.equal(shallowVoid.m.speed,0);}}
assert.equal(recoveryCount,1);assert(lowest>=-1.25);assert(lowest<-.8);assert(!shallowVoid.m.recovered);
shallowVoid.m.reset();assert(!shallowVoid.m.recovered);
// A legitimate 2m lower floor is not a void: keep falling to it instead of
// applying the shallow void cutoff to an ordinary traversable landing.
const lowerFloor=fixture({sampleGround:(x,z)=>x<.8?0:-2});lowerFloor.key('KeyD');lowerFloor.key('ShiftLeft');let floorRecoveries=0;
for(let i=0;i<120;i++){lowerFloor.m.update(1/120);if(lowerFloor.m.recovered)floorRecoveries++;}
assert.equal(floorRecoveries,0);assert(lowerFloor.m.grounded);assert.equal(lowerFloor.m.position.y,-2);
// Constant input with varied frame periods retains near-identical distance.
const distances=[];for(const hz of [30,60,120]){const f=fixture();f.key('KeyW');f.key('ShiftLeft');f.tick(2,hz);distances.push(f.m.position.length());f.m.dispose();}
assert(Math.max(...distances)-Math.min(...distances)<.015);
// Blur clears keyboard state; disposing detaches inputs.
const blur=fixture();blur.key('KeyW');blur.tick(.3);blur.target.dispatchEvent(new Event('blur'));blur.tick(.3);assert(blur.m.speed<.01);blur.m.dispose();blur.key('KeyW');const old=blur.m.position.clone();blur.tick(1);assert(blur.m.position.equals(old));
// Native pointer events: full deflection runs, cancellation releases capture,
// pause/reset clears the joystick and does not resume movement from a stale drag.
class Stick extends EventTarget {
  constructor(){super();this.capture=null;this.knob={style:{transform:''}};}
  querySelector(){return this.knob;}
  getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}
  setPointerCapture(id){this.capture=id;}
  hasPointerCapture(id){return this.capture===id;}
  releasePointerCapture(){this.capture=null;}
}
const stick=new Stick(), touch=fixture({stickElement:stick});
function pointer(type,id,x=86,y=50){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:id,clientX:x,clientY:y});stick.dispatchEvent(e);}
pointer('pointerdown',1);touch.tick(.3);assert(touch.m.speed>4.4);assert.equal(stick.capture,1);
pointer('pointercancel',2);assert.equal(stick.capture,1); // another finger cannot release this drag
pointer('pointercancel',1);touch.tick(.3);assert(touch.m.speed<.01);assert.equal(stick.capture,null);
pointer('pointerdown',3);touch.tick(.1);touch.m.update(.01,{enabled:false});assert.equal(stick.capture,null);assert.equal(stick.knob.style.transform,'');touch.m.update(.01);touch.tick(.2);assert.equal(touch.m.speed,0);
const slope=fixture({sampleGround:(x,z)=>x*.25});slope.key('KeyD');slope.tick(1);assert(slope.m.grounded);assert(Math.abs(slope.m.position.y-slope.m.position.x*.25)<1e-8);
// Facing an action subject uses the short arc, retains translation, and keeps
// the same yaw after the action ends instead of snapping back to old intent.
const facing=fixture(), angularError=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
const subject=new THREE.Vector3(0,0,-10);
facing.m.update(1/60,{faceTarget:subject});assert(facing.m.yaw>0 && facing.m.yaw<1); // smooth 180-degree anticipation
for(let i=0;i<30;i++)facing.m.update(1/60,{faceTarget:subject});assert(angularError(facing.m.yaw,Math.PI)<.003);
const acrossSeam=new THREE.Vector3(-.1,0,-10), beforeSeam=facing.m.yaw;
facing.m.update(1/60,{faceTarget:acrossSeam});assert(Math.abs(facing.m.yaw-beforeSeam)<.01); // no full spin across ±pi
const heldYaw=facing.m.yaw;facing.tick(.2);assert.equal(facing.m.yaw,heldYaw);
facing.key('KeyD');for(let i=0;i<30;i++)facing.m.update(1/60,{actionSlow:true,faceTarget:subject});
assert(facing.m.position.x>.3);assert(facing.m.speed>1 && facing.m.speed<1.11);
assert(angularError(facing.m.yaw,Math.atan2(subject.x-facing.m.position.x,subject.z-facing.m.position.z))<.02);
facing.tick(.4);assert(angularError(facing.m.yaw,Math.atan2(.788,-.615))<.01); // player direction resumes
const turning=[];for(const hz of [30,60,120]){const f=fixture();for(let i=0;i<hz*.2;i++)f.m.update(1/hz,{faceTarget:subject});turning.push(f.m.yaw);f.m.dispose();}
assert(Math.max(...turning)-Math.min(...turning)<1e-10);
facing.m.dispose();
for(const f of [a,wall,ledge,gap,edge,touch,slope,shallowVoid,lowerFloor])f.m.dispose();
console.log('PASS: walk/run, screen axes, stop, jump, landing, buffered jump, pause/reset, wall slide, ledge, gap, coyote, recovery, frame rate, blur/dispose, smooth target-facing and retained intent');
