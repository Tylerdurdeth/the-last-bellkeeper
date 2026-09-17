import * as T from 'three';
// The JSON contains animation tracks/rest transforms only. Every visible mesh is code-built.
let motionPromise;
export async function loadCodeCharacter(build){
 const data=await(motionPromise??=fetch(new URL('./assets/quaternius/motion.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Motion load '+r.status);return r.json();}));
 const model=build(T),root=new T.Group();root.add(model);
 const source=new T.Group(),nodes=new Map();
 for(const n of data.nodes){const o=new T.Object3D();o.name=n.name;o.position.fromArray(n.position);o.quaternion.fromArray(n.quaternion);o.scale.fromArray(n.scale);nodes.set(n.name,o);}
 for(const n of data.nodes)(nodes.get(n.parent)||source).add(nodes.get(n.name));
 const map={hips:'pelvis',chest:'spine_03',head:'Head'};
 for(const [side,suffix]of [['left','r'],['right','l']])for(const [part,bone]of [['UpperArm','upperarm'],['LowerArm','lowerarm'],['Hand','hand'],['UpperLeg','thigh'],['LowerLeg','calf'],['Foot','foot']])map[side+part]=bone+'_'+suffix;
 source.updateMatrixWorld(true);root.updateMatrixWorld(true);
 const joints=model.userData.joints,links=Object.entries(map).map(([name,src])=>({dst:joints[name],src:nodes.get(src)}));
 const depth=o=>{let d=0;while(o.parent){d++;o=o.parent;}return d;};links.sort((a,b)=>depth(a.dst)-depth(b.dst));
 for(const l of links){l.inverse=l.src.getWorldQuaternion(new T.Quaternion()).invert();l.rest=l.dst.getWorldQuaternion(new T.Quaternion());if(/Arm|Hand/.test(l.dst.name)){const child=l.src.children[0];if(child){const direction=child.getWorldPosition(new T.Vector3()).sub(l.src.getWorldPosition(new T.Vector3())).normalize();const down=new T.Vector3(0,-1,0).applyQuaternion(l.rest);l.rest.premultiply(new T.Quaternion().setFromUnitVectors(down,direction));}}}
 const pelvisRest=nodes.get('pelvis').position.clone(),hipRest=joints.hips.position.clone();
 const ramp=new T.DataTexture(new Uint8Array([140,185,245]),3,1,T.RedFormat);ramp.needsUpdate=true;ramp.minFilter=ramp.magFilter=T.NearestFilter;
 model.traverse(n=>{if(n.isMesh){const convert=m=>new T.MeshToonMaterial({color:m.color,gradientMap:ramp,side:m.side});n.material=Array.isArray(n.material)?n.material.map(convert):convert(n.material);}});

 // Preserve authored flight height while grounding the different-sized procedural boots.
 const sourceFeet=[nodes.get('foot_l'),nodes.get('foot_r')];
 const sourceSole=Math.min(...sourceFeet.map(f=>f.getWorldPosition(new T.Vector3()).y));
 const bootSamples=[];for(const name of ['leftFoot','rightFoot']){const foot=joints[name];foot.updateWorldMatrix(true,true);const inverse=foot.matrixWorld.clone().invert(),points=[];foot.traverse(n=>{if(!n.isMesh)return;const matrix=inverse.clone().multiply(n.matrixWorld),p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)points.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix));});bootSamples.push({foot,points});}
 const sample=new T.Vector3();
 function groundBoots(){const flight=Math.max(0,Math.min(...sourceFeet.map(f=>f.getWorldPosition(sample).y))-sourceSole)*.85;let bottom=Infinity;for(const {foot,points}of bootSamples)for(const p of points)bottom=Math.min(bottom,sample.copy(p).applyMatrix4(foot.matrixWorld).y);model.position.y+=root.position.y+flight-bottom;model.updateMatrixWorld(true);}
 const mixer=new T.AnimationMixer(source),actions={};for(const c of data.clips){const clip=T.AnimationClip.parse(c);actions[clip.name]=mixer.clipAction(clip);}
 let current=null,elapsed=0;const nominal={Walk_Loop:.83,Jog_Fwd_Loop:4.55,Sprint_Loop:7.0};
 function play(name,{once=false}={}){const a=actions[name];if(!a||a===current)return;const old=current;a.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(once?T.LoopOnce:T.LoopRepeat,once?1:Infinity);a.clampWhenFinished=once;a.play();if(old){old.fadeOut(.16);a.fadeIn(.16);}current=a;}
 const q=new T.Quaternion(),parent=new T.Quaternion(),world=new T.Quaternion();
 function update(dt,speed){elapsed+=dt;const blinkPhase=elapsed%4.3;const blink=blinkPhase>3.7&&blinkPhase<3.88?Math.sin((blinkPhase-3.7)/.18*Math.PI):0;for(const eye of model.userData.eyeGroups||[])eye.scale.y=1-.97*blink;if(current)current.timeScale=speed!==undefined&&nominal[current.getClip().name]?Math.max(.1,Math.min(2,speed/nominal[current.getClip().name])):1;mixer.update(dt);source.updateMatrixWorld(true);root.updateMatrixWorld(true);const rootQ=root.getWorldQuaternion(new T.Quaternion());for(const l of links){l.src.getWorldQuaternion(q);world.copy(rootQ).multiply(q).multiply(l.inverse).multiply(l.rest);l.dst.parent.getWorldQuaternion(parent).invert();l.dst.quaternion.copy(parent.multiply(world));l.dst.updateMatrixWorld(true);}joints.hips.position.copy(hipRest).addScaledVector(nodes.get('pelvis').position.clone().sub(pelvisRest),.85);if(joints.cape)joints.cape.rotation.x=Math.sin(elapsed*8)*.035;model.updateMatrixWorld(true);groundBoots();}
 function reset(){mixer.stopAllAction();current=null;elapsed=0;root.position.set(0,0,0);root.rotation.set(0,0,0);play('Idle_Loop');update(0);}
 reset();return{root,nominal,play,update,reset,get clip(){return current?.getClip().name;}};
}
