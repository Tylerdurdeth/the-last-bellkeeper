import * as T from 'three';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
// Original CC0 rig retained: avoids presenting unverified retargeting as a repair.
export async function loadAuthoredMotion(){
 const gltf=await new GLTFLoader().loadAsync('./assets/quaternius/locomotion.glb');
 const model=gltf.scene;model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model),height=box.max.y-box.min.y;
 model.scale.setScalar(1.6/height);model.position.y=-box.min.y*model.scale.x;
 model.traverse(n=>{if(n.isMesh){n.castShadow=n.receiveShadow=true;}});
 const root=new T.Group();root.add(model);const mixer=new T.AnimationMixer(model),actions={};
 for(const clip of gltf.animations)actions[clip.name]=mixer.clipAction(clip);
 let current=null;
 function play(name,{restart=false,once=false}={}){
  const next=actions[name];if(!next)return;
  if(current===next&&!restart)return;
  const old=current;next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);next.setLoop(once?T.LoopOnce:T.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;next.play();
  if(old&&old!==next){next.fadeIn(.16);old.fadeOut(.16);}current=next;
 }
 function reset(){mixer.stopAllAction();current=null;play('Idle_Loop');mixer.update(0);root.position.set(0,0,0);root.rotation.set(0,0,0);}
 const nominal={Walk_Loop:.975*model.scale.x,Jog_Fwd_Loop:(5/.9333333333)*model.scale.x,Sprint_Loop:8.25*model.scale.x};
 reset();return{root,play,reset,nominal,update:(dt,speed)=>{if(current)current.timeScale=speed!==undefined&&nominal[current.getClip().name]?Math.max(.1,Math.min(2,speed/nominal[current.getClip().name])):1;mixer.update(dt);},get clip(){return current?.getClip().name;}};
}
