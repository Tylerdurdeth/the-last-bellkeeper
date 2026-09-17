// Apply the approved studio locomotion to physical woodland movement.
export function createAdventureMotion(character,movement){
 let grounded=true,air=0,landing=0,time=0,lastPhase=0,footfalls=[];
 const joints=character.root.children[0].userData.joints;
 function update(dt,{action=null,actionProgress=0}={}){
  time+=dt;footfalls=[];
  if(movement.grounded&&!grounded)landing=time+(movement.speed>.5?.30:.46);
  air=movement.grounded?0:air+dt;
  const previous=character.clip,speed=movement.speed;
  const gait=speed>(previous==='Sprint_Loop'?5.2:5.6)?'Sprint_Loop':speed>(previous==='Jog_Fwd_Loop'?1.8:2.2)?'Jog_Fwd_Loop':speed>(previous==='Idle_Loop'?.1:.06)?'Walk_Loop':'Idle_Loop';
  const next=!movement.grounded?(air<.14?'Jump_Start':'Jump_Loop'):time<landing?'Jump_Land':gait;
  if(next!==previous)character.play(next,{once:next==='Jump_Start'||next==='Jump_Land',rate:next==='Jump_Land'?(speed>.5?3:2.2):1});
  character.update(dt,speed,{grounded:movement.grounded,yaw:movement.yaw});
  const phase=character.motionState.phase;
  if(movement.grounded&&speed>.2&&gait===next&&previous===next&&Math.floor(lastPhase*2)!==Math.floor(phase*2))footfalls.push('step');
  lastPhase=phase;grounded=movement.grounded;
  if(action){const reach=Math.sin(Math.PI*Math.min(1,actionProgress));joints.rightUpperArm.rotation.x-=reach*.75;joints.rightLowerArm.rotation.x-=reach*.40;joints.chest.rotation.x+=reach*.07;character.root.updateMatrixWorld(true);}
 }
 function reset(){character.reset();grounded=true;air=landing=time=lastPhase=0;footfalls=[];}
 return {update,reset,get footfalls(){return footfalls;}};
}
