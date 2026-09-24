// Apply the approved studio locomotion to physical movement, plus v2 acting layered on top of
// the clip: random blinks, a head look-at toward the current subject, an anticipation dip before
// interactions and squash/stretch on column entry/exit and hard landings.
export function createAdventureMotion(character,movement){
 let grounded=true,air=0,landing=0,time=0,lastPhase=0,footfalls=[];
 const joints=character.root.children[0].userData.joints,model=character.root.children[0];
 // Acting state: blink timer, damped head offsets, squash spring (value/velocity around 1).
 let nextBlink=1.5+Math.random()*2,blinkT=-1,headYaw=0,headPitch=0,sq=0,sqV=0,wasLifting=false,peakY=null,dip=0;
 const eyes=()=>character.root.userData.eyeGroups||model.userData.eyeGroups||[];
 function kick(amount){sqV+=amount;}
 function update(dt,{action=null,actionProgress=0,lookAt=null,gentle=false}={}){
  time+=dt;footfalls=[];
  if(movement.grounded&&!grounded){landing=time+(movement.speed>.5?.30:.46);const fall=peakY===null?0:peakY-movement.position.y;if(fall>1.2&&!gentle)kick(-Math.min(3.2,1+fall*.35));}
  air=movement.grounded?0:air+dt;peakY=movement.grounded?null:Math.max(peakY??-Infinity,movement.position.y);
  const previous=character.clip,speed=movement.speed;
  const gait=speed>(previous==='Sprint_Loop'?5.2:5.6)?'Sprint_Loop':speed>(previous==='Jog_Fwd_Loop'?1.8:2.2)?'Jog_Fwd_Loop':speed>(previous==='Idle_Loop'?.1:.06)?'Walk_Loop':'Idle_Loop';
  const next=!movement.grounded?(air<.14?'Jump_Start':'Jump_Loop'):time<landing?'Jump_Land':gait;
  if(next!==previous)character.play(next,{once:next==='Jump_Start'||next==='Jump_Land',rate:next==='Jump_Land'?(speed>.5?3:2.2):1});
  character.update(dt,speed,{grounded:movement.grounded,yaw:movement.yaw});
  const phase=character.motionState.phase;
  if(movement.grounded&&speed>.2&&gait===next&&previous===next&&Math.floor(lastPhase*2)!==Math.floor(phase*2))footfalls.push('step');
  lastPhase=phase;grounded=movement.grounded;
  if(action){const reach=Math.sin(Math.PI*Math.min(1,actionProgress));joints.rightUpperArm.rotation.x-=reach*.75;joints.rightLowerArm.rotation.x-=reach*.40;joints.chest.rotation.x+=reach*.07;}
  // Anticipation: a quick dip (knees give) in the first third of an action, then a small lift.
  const want=action?(actionProgress<.3?Math.sin(Math.PI*actionProgress/.3)*.07:-Math.sin(Math.PI*Math.min(1,(actionProgress-.3)/.5))*.025):0;
  dip+=(want-dip)*(1-Math.exp(-dt*30));if(action&&actionProgress<.05&&!gentle)kick(-.9);
  // Column entry stretches, leaving a column squashes; a spring settles both.
  const lifting=movement.lifting;if(lifting!==wasLifting&&!gentle)kick(lifting?2.4:-1.6);wasLifting=lifting;
  sqV+=(-sq*180-sqV*16)*dt;sq+=sqV*dt;sq=Math.max(-.22,Math.min(.22,sq));
  const sy=1+sq,sxz=1/Math.sqrt(sy);character.root.scale.set(sxz,sy,sxz);character.root.position.y-=dip;
  // Blinks every 3-6 s (overrides the clip's fixed blink), occasionally a double blink.
  if(blinkT<0&&time>=nextBlink){blinkT=0;nextBlink=time+3+Math.random()*3;if(Math.random()<.2)nextBlink=time+.35;}
  let blink=0;if(blinkT>=0){blinkT+=dt;blink=blinkT<.16?Math.sin(blinkT/.16*Math.PI):0;if(blinkT>=.16)blinkT=-1;}
  for(const eye of eyes())eye.scale.y=1-.97*blink;
  // Head look-at toward the current subject (context target / speaker), clamped and damped.
  let ty=0,tp=0;
  if(lookAt&&joints.head){const hx=character.root.position.x,hz=character.root.position.z,dx=lookAt.x-hx,dz=lookAt.z-hz,d=Math.hypot(dx,dz);
   if(d>.25&&d<9){const rel=Math.atan2(Math.sin(Math.atan2(dx,dz)-movement.yaw),Math.cos(Math.atan2(dx,dz)-movement.yaw));ty=Math.max(-.85,Math.min(.85,rel));tp=Math.max(-.35,Math.min(.4,-Math.atan2(lookAt.y-(character.root.position.y+1.5),d)*.8));if(Math.abs(rel)>2.2)ty=tp=0;}}
  const k=1-Math.exp(-dt*6);headYaw+=(ty-headYaw)*k;headPitch+=(tp-headPitch)*k;
  if(joints.head){joints.head.rotation.y+=headYaw*.75;joints.head.rotation.x+=headPitch;}if(joints.chest)joints.chest.rotation.y+=headYaw*.25;
  character.root.updateMatrixWorld(true);
 }
 function reset(){character.reset();grounded=true;air=landing=time=lastPhase=0;footfalls=[];sq=sqV=dip=headYaw=headPitch=0;wasLifting=false;peakY=null;character.root.scale.set(1,1,1);}
 return {update,reset,kick,get footfalls(){return footfalls;},get squash(){return sq;}};
}
