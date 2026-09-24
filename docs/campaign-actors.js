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
  // Per-actor emissive clones: rotor warms and eyes brighten with the intake.
  const rotorMats=[],eyeMats=[],seen=new Map();
  j.rotor.traverse(n=>{if(n.isMesh){const m=n.material.clone();m.emissive=new T.Color('#ff9a3c');m.emissiveIntensity=0;n.material=m;rotorMats.push(m);}});
  object.traverse(n=>{if(n.isMesh&&n.material.name==='wind-glass'&&!rotorMats.includes(n.material)){if(!seen.has(n.material)){const m=n.material.clone();seen.set(n.material,m);eyeMats.push({m,base:m.emissiveIntensity});}n.material=seen.get(n.material);}});
  return {id,object,j,rotorMats,eyeMats,pose:{crouch:0,flare:0,pitch:0,slump:0,spread:0,forward:0,glow:0},rest:Object.fromEntries(Object.entries(j).map(([k,o])=>[k,{rotation:o.rotation.clone(),scale:o.scale.clone(),position:o.position.clone()}]))};
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
   const phase=enabled?e.phase:'idle',c=Number.isFinite(e.clock)?e.clock%13:0;
   // Authored breath curve, keyed to the controller's 3/1/8/1 s clock (never alters it).
   // crouch: intake squat; flare: petals/arms open; pitch: torso lean (+ forward);
   // slump: spent droop; forward: arms thrust; glow: rotor/eye heat.
   let crouch=0,flare=0,pitch=0,slump=0,forward=0,glow=0,rotorSpeed=.10,inhale=0,aim=0,rate=10;
   if(phase==='telegraph'){const k=ease(c/2.6);inhale=k;crouch=k;flare=ease(c/2.1);pitch=-.14*k;forward=-.25*k;glow=ease(c/3)**1.5;rotorSpeed=.2+9*glow;}
   else if(phase==='vent'){const u=c-3,snap=ease(u/.12),recoil=u<.12?0:Math.sin(Math.min(1,(u-.12)/.5)*Math.PI);
    inhale=1-2*snap;crouch=.55*(1-snap)-.25*recoil;flare=1-1.25*snap;pitch=.30*snap-.42*recoil+.12*ease((u-.62)/.38);forward=.9*snap-.5*recoil;glow=1-.35*ease(u/1);rotorSpeed=14;rate=u<.2?40:18;}
   else if(phase==='recovery'){const u=c-4,s=ease(u/.7)*(1-ease((u-5.6)/2.4));inhale=-.55*s;slump=s;crouch=.35*s;pitch=.22*s;flare=-.25*s;forward=.15*s;glow=.65*(1-ease(u/1.6));rotorSpeed=.6+3*glow;rate=5;}
   else if(phase==='rest'){rate=4;}
   if(enabled&&e.target){aim=T.MathUtils.clamp(Math.atan2(e.target.x-object.position.x,e.target.z-object.position.z),-.28,.28);}
   // Tending: slow even breaths leaning toward the seed bed; no vent posture remains.
   const tending=solved||settling;
   if(tending){const b=Math.sin(clock*.85);inhale=b*.3;flare=.25+.1*b;pitch=solved?.20:.1;crouch=solved?.25+.05*b:.1;forward=solved?.35:.15;rotorSpeed=solved?.35:.28;glow=solved?.12+.06*b:0;rate=2;}
   // Critical intake/vent action is retained in gentle mode; only decorative
   // tending oscillation and idle sway are reduced. Feet and world root never move.
   const decorative=(tending||!enabled)?motion:1,P=a.pose,D=(k,v)=>{P[k]=T.MathUtils.damp(P[k],v*decorative,rate,delta);return P[k];};
   crouch=D('crouch',crouch);flare=D('flare',flare);pitch=D('pitch',pitch);slump=D('slump',slump);forward=D('forward',forward);glow=T.MathUtils.damp(P.glow,glow,rate,delta);P.glow=glow;
   j.torso.position.y=rest.torso.position.y*(1-.08*crouch);
   j.torso.rotation.x=rest.torso.rotation.x+pitch;
   j.head.rotation.y=T.MathUtils.damp(j.head.rotation.y,rest.head.rotation.y+aim,5,delta);
   j.head.rotation.x=rest.head.rotation.x-.18*flare*(flare>0?1:0)+.42*slump+(solved?.12*motion:0);
   j.bellows.scale.y=T.MathUtils.damp(j.bellows.scale.y,rest.bellows.scale.y*(1+.22*inhale*decorative),12,delta);
   j.bellows.scale.x=j.bellows.scale.z=rest.bellows.scale.x*(1+.10*Math.max(0,inhale)*decorative);
   const open=Math.max(0,flare);
   j.leftArm.rotation.z=rest.leftArm.rotation.z-1.05*open+.18*slump;j.rightArm.rotation.z=rest.rightArm.rotation.z+1.05*open-.18*slump;
   for(const k of ['leftArm','rightArm'])j[k].rotation.x=rest[k].rotation.x-.7*forward+.25*slump;
   j.rotor.rotation.z=(j.rotor.rotation.z+delta*rotorSpeed)%(Math.PI*2);
   for(const m of a.rotorMats)m.emissiveIntensity=1.6*glow;
   for(const {m,base} of a.eyeMats)m.emissiveIntensity=base+2.2*glow;
   if(j.leftPetal){const petal=Math.max(-.04,.015+.95*flare-.10*slump);j.leftPetal.rotation.z=rest.leftPetal.rotation.z+petal;j.rightPetal.rotation.z=rest.rightPetal.rotation.z-petal;for(const k of ['leftPetal','rightPetal'])j[k].rotation.x=rest[k].rotation.x-.25*open;}
   object.userData.campaignPose={phase:solved?'tending':settling?'settling':phase,lane:e.lane||null,inhale,crouch,flare,slump,glow,grounded:true};
  }
 }
 return {update};
}
