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
const a=fixture(); a.key('ArrowUp');a.tick(1);assert(a.m.position.x< -1 && a.m.position.z < -1);assert(Math.abs(a.m.speed-2.2)<.01);
a.key('ShiftLeft');a.tick(.5);assert(a.m.speed>4.4);assert.equal(a.m.mode,'run');
a.key('ArrowUp',false);a.key('ShiftLeft',false);a.tick(.25);assert(a.m.speed<.01);
// Space belongs to contextual action; A launches a real ballistic jump.
a.key('Space');a.tick(.05);assert.equal(a.m.grounded,true);a.key('KeyA');a.tick(.15);assert(a.m.position.y>.6);assert.equal(a.m.mode,'jump');a.tick(.6);assert.equal(a.m.grounded,true);assert.equal(a.m.position.y,0);
// Buffered jump just before touchdown fires once on the next ground contact.
a.key('KeyA',false);a.m.jump();a.tick(.57);a.m.jump();a.tick(.12);assert(a.m.position.y>.1);assert(!a.m.grounded);
a.m.update(.01,{enabled:false});const frozen=a.m.position.clone();a.key('ArrowUp');a.m.update(.05,{enabled:false});assert(a.m.position.equals(frozen));a.m.reset();a.m.update(.01);a.tick(.2);assert.equal(a.m.speed,0);
// Wall collision preserves tangential movement and never penetrates its radius.
const wall=fixture({blocked:(x,z,r)=>x+r>.5});wall.key('ArrowRight');wall.key('ShiftLeft');wall.tick(2);assert(wall.m.position.x<=.271);assert(wall.m.position.z< -4);
// A raised ledge above the step limit blocks walking.
const ledge=fixture({sampleGround:(x,z)=>x>.5?.5:0});ledge.key('ArrowRight');ledge.tick(1);assert(ledge.m.position.x<=.5);assert.equal(ledge.m.position.y,0);
// 1 metre stream crossed at a run, with an airborne landing on the far bank.
const gap=fixture({sampleGround:(x,z)=>x>.8&&x<1.8?null:0});gap.key('ArrowRight');gap.key('ShiftLeft');gap.tick(.2);gap.m.jump();gap.tick(.8);assert(gap.m.position.x>1.8);assert(gap.m.grounded);
// Coyote jump is still accepted immediately after running off a bank.
const edge=fixture({sampleGround:(x,z)=>x<.8?0:null});edge.key('ArrowRight');edge.key('ShiftLeft');while(edge.m.grounded)edge.m.update(1/120);edge.m.jump();edge.m.update(1/120);assert(edge.m.verticalVelocity>5);
edge.tick(2);assert(edge.m.position.y>=-4); // no unbounded fall / softlock
edge.key('ArrowRight',false);edge.key('ShiftLeft',false);edge.tick(2);assert(edge.m.grounded);assert(edge.m.position.x<.8);
// A true void returns before the avatar can descend 1.25m below its safe bank.
// Observe every frame; recovery flag is a one-update event and does not teleport speed.
const shallowVoid=fixture({sampleGround:(x,z)=>x<.8?0:null});
shallowVoid.key('ArrowRight');shallowVoid.key('ShiftLeft');let lowest=0,recoveryCount=0;
for(let i=0;i<180;i++){shallowVoid.m.update(1/120);lowest=Math.min(lowest,shallowVoid.m.position.y);if(shallowVoid.m.recovered){recoveryCount++;assert(shallowVoid.m.grounded);assert(shallowVoid.m.position.x<.8);assert.equal(shallowVoid.m.speed,0);}}
assert.equal(recoveryCount,1);assert(lowest>=-1.25);assert(lowest<-.8);assert(!shallowVoid.m.recovered);
shallowVoid.m.reset();assert(!shallowVoid.m.recovered);
// A legitimate 2m lower floor is not a void: keep falling to it instead of
// applying the shallow void cutoff to an ordinary traversable landing.
const lowerFloor=fixture({sampleGround:(x,z)=>x<.8?0:-2});lowerFloor.key('ArrowRight');lowerFloor.key('ShiftLeft');let floorRecoveries=0;
for(let i=0;i<120;i++){lowerFloor.m.update(1/120);if(lowerFloor.m.recovered)floorRecoveries++;}
assert.equal(floorRecoveries,0);assert(lowerFloor.m.grounded);assert.equal(lowerFloor.m.position.y,-2);
// Constant input with varied frame periods retains near-identical distance.
const distances=[];for(const hz of [30,60,120]){const f=fixture();f.key('ArrowUp');f.key('ShiftLeft');f.tick(2,hz);distances.push(f.m.position.length());f.m.dispose();}
assert(Math.max(...distances)-Math.min(...distances)<.015);
// Blur clears keyboard state; disposing detaches inputs.
const blur=fixture();blur.key('ArrowUp');blur.tick(.3);blur.target.dispatchEvent(new Event('blur'));blur.tick(.3);assert(blur.m.speed<.01);blur.m.dispose();blur.key('ArrowUp');const old=blur.m.position.clone();blur.tick(1);assert(blur.m.position.equals(old));
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
const slope=fixture({sampleGround:(x,z)=>x*.25});slope.key('ArrowRight');slope.tick(1);assert(slope.m.grounded);assert(Math.abs(slope.m.position.y-slope.m.position.x*.25)<1e-8);
// Facing an action subject uses the short arc, retains translation, and keeps
// the same yaw after the action ends instead of snapping back to old intent.
const facing=fixture(), angularError=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
const subject=new THREE.Vector3(0,0,-10);
facing.m.update(1/60,{faceTarget:subject});assert(facing.m.yaw>0 && facing.m.yaw<1); // smooth 180-degree anticipation
for(let i=0;i<30;i++)facing.m.update(1/60,{faceTarget:subject});assert(angularError(facing.m.yaw,Math.PI)<.003);
const acrossSeam=new THREE.Vector3(-.1,0,-10), beforeSeam=facing.m.yaw;
facing.m.update(1/60,{faceTarget:acrossSeam});assert(Math.abs(facing.m.yaw-beforeSeam)<.01); // no full spin across ±pi
const heldYaw=facing.m.yaw;facing.tick(.2);assert.equal(facing.m.yaw,heldYaw);
facing.key('ArrowRight');for(let i=0;i<30;i++)facing.m.update(1/60,{actionSlow:true,faceTarget:subject});
assert(facing.m.position.x>.3);assert(facing.m.speed>1 && facing.m.speed<1.11);
assert(angularError(facing.m.yaw,Math.atan2(subject.x-facing.m.position.x,subject.z-facing.m.position.z))<.02);
facing.tick(.4);assert(angularError(facing.m.yaw,Math.atan2(.788,-.615))<.01); // player direction resumes
const turning=[];for(const hz of [30,60,120]){const f=fixture();for(let i=0;i<hz*.2;i++)f.m.update(1/hz,{faceTarget:subject});turning.push(f.m.yaw);f.m.dispose();}
assert(Math.max(...turning)-Math.min(...turning)<1e-10);
facing.m.dispose();
for(const f of [a,wall,ledge,gap,edge,touch,slope,shallowVoid,lowerFloor])f.m.dispose();
console.log('PASS: walk/run, screen axes, stop, jump, landing, buffered jump, pause/reset, wall slide, ledge, gap, coyote, recovery, frame rate, blur/dispose, smooth target-facing and retained intent');
const arrowsOnly=fixture();for(const key of ['KeyW','KeyS','KeyD'])arrowsOnly.key(key);arrowsOnly.tick(.3);assert.equal(arrowsOnly.m.speed,0,'letter keys must not move the player');
arrowsOnly.key('KeyA');arrowsOnly.tick(.15);assert(arrowsOnly.m.position.y>.6);assert.equal(arrowsOnly.m.position.x,0);assert.equal(arrowsOnly.m.position.z,0,'A must jump without strafing');arrowsOnly.m.dispose();
console.log('PASS: arrows-only movement; A jumps without strafing');
// ---- v2: layered ground, updraft columns, knock-back ----
// ArrowRight with the default camera moves along (.788,-.615); a ledge band lies that way.
const right=[.788,-.615],along=(x,z)=>x*right[0]+z*right[1];
const ledgeTop=3,layered=(x,z,y)=>{const s=along(x,z);return s>1.4&&s<4&&y>=ledgeTop-.35?ledgeTop:0;};
const seen=[];const under=fixture({sampleGround:layered,blocked:(x,z,r,y)=>{seen.push(y);return false;}});
under.key('ArrowRight');under.tick(2.2);assert(along(under.m.position.x,under.m.position.z)>4.2,'walks under an overhead ledge');assert.equal(under.m.position.y,0);assert(under.m.grounded);
assert(seen.length&&seen.every(Number.isFinite),'blocked() receives the current y');under.m.dispose();
// Column: rises smoothly to its top, hovers, player steers out and lands on the ledge.
const up=fixture({sampleGround:layered});const col=up.m.lift({x:0,z:0,radius:1.2,top:ledgeTop+.8,duration:4});
assert(col&&col.active);let prevY=0,monotonic=true;let reached=false,overshoot=0;for(let i=0;i<90;i++){up.m.update(1/60);if(!reached&&up.m.position.y<prevY-1e-6)monotonic=false;reached||=up.m.position.y>ledgeTop+.6;overshoot=Math.max(overshoot,up.m.position.y-(ledgeTop+.8));prevY=up.m.position.y;}
assert(overshoot<.5,'gentle hover overshoot '+overshoot);
assert(monotonic,'rise is smooth, not a pop');assert(up.m.position.y>ledgeTop+.3&&up.m.position.y<ledgeTop+1.3,'hovers near the column top: '+up.m.position.y);assert(!up.m.grounded);assert.equal(up.m.mode,'lift');assert.equal(up.m.lifting,true);
up.key('ArrowRight');up.tick(.9);up.key('ArrowRight',false);for(let i=0;i<240&&!up.m.grounded;i++)up.m.update(1/60);
assert(up.m.grounded,'lands on the ledge');assert.equal(up.m.position.y,ledgeTop);assert(!up.m.recovered);up.tick(.5);assert.equal(up.m.checkpoint.y,ledgeTop,'ledge becomes the safe checkpoint');up.m.dispose();
// Jumping inside the column adds lift above its normal hover height.
const peaks=[];for(const jumpIn of [false,true]){const f=fixture();f.m.lift({x:0,z:0,radius:1.2,top:4,duration:4});f.tick(1.6);if(jumpIn)f.key('KeyA');let peak=0;for(let i=0;i<60;i++){f.m.update(1/60);peak=Math.max(peak,f.m.position.y);}peaks.push(peak);f.m.dispose();}
assert(peaks[1]>peaks[0]+.8,'jump inside a column adds lift: '+peaks);
// Column expiry: gravity resumes and the hero lands safely on the floor below (no recovery).
const expire=fixture();expire.m.lift({x:0,z:0,radius:1.2,top:3.5,duration:2});expire.tick(1.8);assert(expire.m.position.y>2.8);let expireRecovered=false;for(let i=0;i<150;i++){expire.m.update(1/60);expireRecovered||=expire.m.recovered;}
assert(expire.m.grounded&&expire.m.position.y===0&&!expireRecovered&&!expire.m.lifting);expire.m.dispose();
// Lift height is frame-rate independent.
const liftHeights=[];for(const hz of [30,60,120]){const f=fixture();f.m.lift({x:0,z:0,radius:1.2,top:5,duration:4});f.tick(1,hz);liftHeights.push(f.m.position.y);f.m.dispose();}
assert(Math.max(...liftHeights)-Math.min(...liftHeights)<.06,'lift frame-rate independence '+liftHeights);
// Knock-back to a known safe ledge: readable arc, input ignored, exact landing, new checkpoint.
const knock=fixture();knock.m.knockback({to:[2,0,-1],duration:.8});knock.key('ArrowUp');knock.m.update(1/60);assert.equal(knock.m.mode,'knock');assert(knock.m.knocked);
let arcPeak=0;for(let i=0;i<60&&!knock.m.grounded;i++){knock.m.update(1/60);arcPeak=Math.max(arcPeak,knock.m.position.y);}
assert(arcPeak>1,'visible hop arc');knock.key('ArrowUp',false);assert(knock.m.grounded);assert(Math.hypot(knock.m.position.x-2,knock.m.position.z+1)<.05,'lands on the safe point');assert.equal(knock.m.checkpoint.x,2);knock.m.dispose();
// Ballistic knock-back off a bank into the void recovers once to the safe bank.
const shove=fixture({sampleGround:(x,z)=>x<.8?0:null});shove.tick(.5);shove.m.knockback({x:1,z:0,power:1});let shoveRecoveries=0;
for(let i=0;i<240;i++){shove.m.update(1/120);if(shove.m.recovered)shoveRecoveries++;}assert.equal(shoveRecoveries,1);assert(shove.m.grounded&&shove.m.position.x<.8&&shove.m.position.y===0);shove.m.dispose();
// Dropping off a 5 m ledge: the default 4 m budget recovers (v1), a v2 maxDrop lands on the floor.
for(const [drop,expectRecover] of [[4,true],[12,false]]){const f=fixture({start:[0,5,0],sampleGround:(x,z)=>x<.8?5:0,maxDrop:drop});f.tick(.4);f.key('ArrowRight');let rec=0;for(let i=0;i<300;i++){f.m.update(1/120);if(f.m.recovered)rec++;}f.key('ArrowRight',false);f.tick(1.2);
 if(expectRecover)assert(rec>=1);else{assert.equal(rec,0);assert(f.m.grounded);assert.equal(f.m.position.y,0);}f.m.dispose();}
// reset() cancels a hop; columns are world physics and persist until they expire.
const clear=fixture();clear.m.lift({x:5,z:5,top:4,duration:1});clear.m.knockback({to:[1,0,1]});clear.m.reset();assert(!clear.m.knocked);assert.equal(clear.m.columns.length,1);clear.tick(.5);assert(clear.m.grounded&&clear.m.position.y===0&&clear.m.position.x===0);clear.tick(.6);assert.equal(clear.m.columns.length,0);clear.m.dispose();
console.log('PASS: v2 layered ground (walk under ledges, y passed to blocked), updraft rise/hover/steer-out landing, jump lift, expiry, frame-rate lift, knock-back arc and ballistic void recovery, maxDrop');
// ---- stuck regressions (owner playtest: hero trapped inside a sky-bridge chain barrier) ----
// A thin barrier segment appears through the hero's body: arrows free him within 1 s, whichever way he presses.
for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
  const bar = (x, z, r) => Math.abs(z - .0) < .07 + r && Math.abs(x) < 3; // a 6 m chain barrier along x through the start
  const f = fixture({ blocked: bar }); f.key(key); let freeAt = null;
  for (let i = 0; i < 60; i++) { f.m.update(1 / 60); if (!bar(f.m.position.x, f.m.position.z, .23) && freeAt === null) freeAt = i / 60; }
  assert(freeAt !== null && freeAt <= 1, `freed from an overlapping barrier pressing ${key} (t=${freeAt})`);
  const p0 = f.m.position.clone(); f.tick(.5); assert(f.m.position.distanceTo(p0) > .3 || key === 'ArrowRight' || key === 'ArrowLeft', 'keeps moving after being freed'); f.m.dispose();
}
// Boxed in on every side (no free spot within 1.2 m): holding input for 2 s returns him to the last safe spot.
{
  let trap = false; const f = fixture({ blocked: (x, z, r) => trap && Math.hypot(x - 2, z) < 1.6 });
  f.m.reset([2, 0, 0]); f.tick(.5); f.m.setCheckpoint([-1, 0, 0]); trap = true; f.key('ArrowUp'); let rec = false, t = 0;
  for (; t < 3 && !rec; t += 1 / 60) { f.m.update(1 / 60); rec ||= f.m.recovered; }
  assert(rec && t >= 1.9 && t < 2.6, 'held-input failsafe after ~2 s, t=' + t.toFixed(2)); assert(f.m.position.x === -1 && !f.m.isSafe([2, 0, 0]));
  f.m.dispose();
}
// Walking into an ordinary wall (sideways steps exist) never triggers the failsafe.
{ const f = fixture({ blocked: (x, z, r) => x + r > .5 }); f.key('ArrowRight'); let rec = false; for (let i = 0; i < 240; i++) { f.m.update(1 / 60); rec ||= f.m.recovered; } assert(!rec, 'no failsafe against a plain wall'); f.m.dispose(); }
console.log('PASS: stuck regressions — depenetration out of an overlapping barrier (4 directions, <1 s), held-input failsafe at ~2 s, no false trigger against walls');
// Releasing Shift while still holding Up keeps walking (character report: 'idle' after Shift release).
{ const f = fixture({ walkSpeed: 1.65, runSpeed: 5.8, acceleration: 12, deceleration: 16 }); f.key('ArrowUp'); f.key('ShiftLeft'); f.tick(.8); assert.equal(f.m.mode, 'run');
  f.key('ShiftLeft', false); let walkAt = null; for (let i = 0; i < 90; i++) { f.m.update(1 / 60); assert.notEqual(f.m.mode, 'idle', 'never idle while Up is held'); if (walkAt === null && f.m.mode === 'walk') walkAt = i / 60; }
  assert(walkAt !== null && walkAt < .6, 'settles into walk'); assert(Math.abs(f.m.speed - 1.65) < .05); f.m.dispose(); }
console.log('PASS: Shift release while holding an arrow continues walking');
