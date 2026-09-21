import * as T from 'three';
import {ASSET} from './assetlib.js';

// Selected R10 recipe assets only. No substitute geometry, locomotion, collision,
// or progression lives here. Controller telemetry supplies the encounter clock.
export async function createCampaignActors(scene,art,points){
 const specs=[['service',1.1],['guardian',3]];
 for(const [id] of specs)if(!points[id]||!['x','y','z'].every(k=>Number.isFinite(points[id][k])))throw new TypeError(`Actor needs points.${id} Vector3`);
 const models=await Promise.all(specs.map(([id])=>ASSET(new URL(`./assets/campaign-${id}.js`,import.meta.url).href,{keepHierarchy:true})));
 const root=new T.Group();root.name='campaign-actors';
 const actors=models.map((object,i)=>{
  const [id,height]=specs[i],j=object.userData.joints;
  for(const key of ['torso','head','bellows','rotor','leftArm','rightArm','leftLeg','rightLeg'])if(!j?.[key]?.isGroup)throw new Error(`Verified ${id} asset missing joint ${key}`);
  // Keep native scale: ASSET height fitting can include rotated local AABBs.
  const box=new T.Box3().setFromObject(object,true);
  if(Math.abs(box.getSize(new T.Vector3()).y-height)>.01)throw new Error(`Unexpected ${id} asset height`);
  object.name=`campaign-${id}-actor`;object.position.copy(points[id]);object.visible=true;
  art?.style?.(object,{character:true});root.add(object);
  return {id,object,j,rest:Object.fromEntries(Object.entries(j).map(([k,o])=>[k,{rotation:o.rotation.clone(),scale:o.scale.clone()}]))};
 });
 scene.add(root);
 let lastTime=null,clock=0;
 const ease=v=>{v=T.MathUtils.clamp(v,0,1);return v*v*(3-2*v);};
 function closurePose(a,closed){
  const {j,rest,object}=a;
  j.head.rotation.x=rest.head.rotation.x-.08*Math.sin(closed*Math.PI);
  j.head.rotation.y=rest.head.rotation.y;
  j.leftArm.rotation.z=rest.leftArm.rotation.z-.24*(1-closed);
  j.rightArm.rotation.z=rest.rightArm.rotation.z+.24*(1-closed);
  j.bellows.scale.y=rest.bellows.scale.y*(1+.08*Math.sin(closed*Math.PI));
  j.rotor.rotation.z=rest.rotor.rotation.z+.7*closed;
  if(j.leftPetal){j.leftPetal.rotation.z=rest.leftPetal.rotation.z+.015+.135*(1-closed);j.rightPetal.rotation.z=rest.rightPetal.rotation.z-.015-.135*(1-closed);}
  object.userData.campaignPose={phase:closed===1?'intro-closed':closed===0?'intro-open':'intro-closing',lane:null,closure:closed,grounded:true};
 }
 function update(dt,t,pos,state={},telemetry={}){
  if(!state.started||state.paused||!(dt>0))return;
  if(lastTime!==null&&t<lastTime)clock=0;lastTime=t;
  const delta=Math.min(dt,.1);clock+=delta;
  const progress=telemetry.progress||{},motion=state.gentle?.35:1;
  for(const a of actors){
   const {id,j,rest,object}=a,e=telemetry[id]||{};
   // Main passes introTime only during the opening. This authored five-second
   // closure is deterministic, not a simulation of a live encounter clock.
   if(id==='guardian'&&Number.isFinite(state.introTime)&&state.introTime>=0&&state.introTime<28){
    closurePose(a,ease((state.introTime-14)/5));a.wasIntro=true;continue;
   }
   // Skip and natural handoff both establish the identical closed pose, with
   // no lingering interpolation from whichever opening frame was interrupted.
   if(id==='guardian'&&a.wasIntro){closurePose(a,1);a.wasIntro=false;continue;}
   const solved=id==='service'?!!progress.service:!!progress.restored;
   const settling=id==='guardian'&&progress.outwardAligned;
   const enabled=progress.entered&&(id==='service'?progress.bridge&&!solved:progress.returnCleared&&!settling&&!solved);
   const phase=enabled?e.phase:'idle',cycleTime=Number.isFinite(e.clock)?e.clock%13:0;
   let inhale=0,reach=0,rotorSpeed=.10,petal=.015,aim=0;
   if(phase==='telegraph'){inhale=ease(cycleTime/3);reach=-.18*inhale;rotorSpeed=.15+.6*inhale;}
   if(phase==='vent'){inhale=1-2*ease((cycleTime-3)/.65);reach=.14;rotorSpeed=3;}
   if(phase==='recovery'){inhale=-.55*(1-ease((cycleTime-4)/2));reach=.12;rotorSpeed=.38;}
   if(enabled&&e.target){aim=T.MathUtils.clamp(Math.atan2(e.target.x-object.position.x,e.target.z-object.position.z),-.28,.28);}
   if(solved||settling){inhale=Math.sin(clock*.85)*.3;reach=.20+.035*Math.sin(clock*.7);petal=solved?.15:.08;rotorSpeed=solved?.20:.28;}
   // Critical intake/vent action is retained in gentle mode; only decorative
   // tending oscillation and idle sway are reduced. Feet and world root never move.
   const decorative=(solved||settling||!enabled)?motion:1;
   j.head.rotation.y=T.MathUtils.damp(j.head.rotation.y,rest.head.rotation.y+aim,5,delta);
   j.head.rotation.x=T.MathUtils.damp(j.head.rotation.x,rest.head.rotation.x+(solved?.10*motion:0),4,delta);
   j.bellows.scale.y=T.MathUtils.damp(j.bellows.scale.y,rest.bellows.scale.y*(1+.12*inhale*decorative),9,delta);
   j.leftArm.rotation.z=T.MathUtils.damp(j.leftArm.rotation.z,rest.leftArm.rotation.z+reach*decorative,6,delta);
   j.rightArm.rotation.z=T.MathUtils.damp(j.rightArm.rotation.z,rest.rightArm.rotation.z-reach*decorative,6,delta);
   j.rotor.rotation.z=(j.rotor.rotation.z+delta*rotorSpeed)%(Math.PI*2);
   if(j.leftPetal){j.leftPetal.rotation.z=T.MathUtils.damp(j.leftPetal.rotation.z,rest.leftPetal.rotation.z+petal,2,delta);j.rightPetal.rotation.z=T.MathUtils.damp(j.rightPetal.rotation.z,rest.rightPetal.rotation.z-petal,2,delta);}
   object.userData.campaignPose={phase:solved?'tending':settling?'settling':phase,lane:e.lane||null,inhale,grounded:true};
  }
 }
 return {update};
}
