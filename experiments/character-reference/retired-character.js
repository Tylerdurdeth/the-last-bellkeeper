import * as T from 'three';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
// CC0 source meshes are assembled on their shared humanoid rig; authored motion
// is transferred in bind-space, retaining the destination's bone lengths.
export async function loadBellkeeperCharacter(){
 const loader=new GLTFLoader();const [body,head,hair,source]=await Promise.all(['character/outfit.glb','character/head.glb','character/hair-long.glb','quaternius/locomotion.glb'].map(p=>loader.loadAsync('./assets/'+p)));
 const model=body.scene, bones=new Map();model.traverse(n=>{if(n.isBone)bones.set(n.name,n);});
 function crop(g){const pos=g.attributes.position,ids=g.index.array,kept=[];for(let i=0;i<ids.length;i+=3)if([ids[i],ids[i+1],ids[i+2]].every(v=>pos.getY(v)>1.51&&Math.abs(pos.getX(v))<.125))kept.push(ids[i],ids[i+1],ids[i+2]);const unique=[...new Set(kept)],map=new Map(unique.map((v,i)=>[v,i])),out=new T.BufferGeometry();for(const [name,a]of Object.entries(g.attributes)){const arr=new a.array.constructor(unique.length*a.itemSize);unique.forEach((v,i)=>{for(let k=0;k<a.itemSize;k++)arr[i*a.itemSize+k]=a.array[v*a.itemSize+k];});out.setAttribute(name,new T.BufferAttribute(arr,a.itemSize,a.normalized));}out.setIndex(kept.map(i=>map.get(i)));return out;}
 function addParts(gltf,isHead){const meshes=[];gltf.scene.traverse(n=>{if(n.isSkinnedMesh)meshes.push(n);});for(const mesh of meshes){if(isHead&&mesh.name==='SuperHero_Male')mesh.geometry=crop(mesh.geometry);if(isHead||mesh.name.includes('Hair')){
 const p=mesh.geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(mesh.name.includes('Hair')&&y<1.67){x*=.85;y=1.67+(y-1.67)*.52;}const sx=Math.sign(x)||1,eyeX=sx*.033,eyeY=1.696;
  if(isHead&&y>1.65&&y<1.74&&z>.025){const w=Math.exp(-(((x-eyeX)/.036)**2)-((y-eyeY)/.035)**2);x+=(x-eyeX)*.32*w;y+=(y-eyeY)*.9*w;}
  if(mesh.name==='Eyebrows'){y=1.725+(y-1.71)*.52-Math.abs(x)*.12;}
  if(mesh.name==='SuperHero_Male'&&y>1.60&&y<1.64&&z>.075){const smile=Math.exp(-(((y-1.622)/.012)**2));y+=.004*smile*Math.min(1,Math.abs(x)/.024);}
  if(mesh.name==='SuperHero_Male'&&Math.abs(x)<.023&&y>1.63&&y<1.70&&z>.075)z=.075+(z-.075)*.68;
  if(mesh.name==='SuperHero_Male'&&y>1.56&&y<1.66){const jaw=Math.exp(-(((y-1.606)/.039)**2));x*=1-.16*jaw;}
  const f=T.MathUtils.smoothstep(y,1.52,1.64);x*=1+.13*f;y=1.54+(y-1.54)*(1+.025*f);z*=1+.09*f;p.setXYZ(i,x,y,z);
 }p.needsUpdate=true;
 const sums=new Map(),idx=mesh.geometry.index.array,keys=[];for(let i=0;i<p.count;i++)keys.push([p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(','));
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();for(let i=0;i<idx.length;i+=3){a.fromBufferAttribute(p,idx[i]);b.fromBufferAttribute(p,idx[i+1]);c.fromBufferAttribute(p,idx[i+2]);const n=b.sub(a).cross(c.sub(a));for(const k of [idx[i],idx[i+1],idx[i+2]]){if(!sums.has(keys[k]))sums.set(keys[k],new T.Vector3());sums.get(keys[k]).add(n);}}
 const normal=mesh.geometry.attributes.normal;for(let i=0;i<p.count;i++){const n=sums.get(keys[i])?.clone().normalize();if(n)normal.setXYZ(i,n.x,n.y,n.z);}normal.needsUpdate=true;mesh.geometry.computeBoundingSphere();
 }
 const old=mesh.skeleton;mesh.bind(new T.Skeleton(old.bones.map(b=>bones.get(b.name)),old.boneInverses.map(m=>m.clone())),mesh.bindMatrix);model.add(mesh);}}
 addParts(head,true);addParts(hair,false);
 const faceRamp=new T.DataTexture(new Uint8Array(Array.from({length:256},(_,i)=>Math.round(170+75*T.MathUtils.smoothstep(i/255,.35,.65)))),256,1,T.RedFormat);faceRamp.minFilter=faceRamp.magFilter=T.LinearFilter;faceRamp.needsUpdate=true;
 const ramp=new T.DataTexture(new Uint8Array([115,175,245]),3,1,T.RedFormat);ramp.minFilter=ramp.magFilter=T.NearestFilter;ramp.needsUpdate=true;
 model.traverse(n=>{if(!n.isMesh)return;n.castShadow=n.receiveShadow=true;const convert=m=>{const mat=new T.MeshToonMaterial({map:m.map,color:m.color,gradientMap:ramp,side:T.DoubleSide});mat.name=m.name;
 if(m.name.includes('Hair'))mat.color.set('#805038');
 if(m.name.includes('Superhero')){n.receiveShadow=false;mat.gradientMap=faceRamp;mat.map=null;mat.color.set('#d7a375');}
 if(m.name.includes('Eyes')){n.receiveShadow=false;mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 float brown = (1.0-smoothstep(0.093,0.110,length(vMapUv-vec2(0.5))))*smoothstep(0.015,0.11,diffuseColor.r-diffuseColor.b);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.025,0.29,0.26)*(0.5+diffuseColor.r*1.5),brown);
 `);};}

 if(m.name==='MI_Peasant'){if(n.name.includes('Legs')){mat.map=null;mat.color.set('#294e51');}else mat.color.set(n.name.includes('Feet')?'#bea795':'#f09786');}
 return mat;};n.material=Array.isArray(n.material)?n.material.map(convert):convert(n.material);});

 model.updateMatrixWorld(true);
 const chest=bones.get('spine_03'),chestIndex=[...bones.values()].indexOf(chest);
 const scarfGeo=new T.BufferGeometry(),verts=[],indices=[];
 for(let r=0;r<=5;r++)for(let i=0;i<=64;i++){const t=i/64*Math.PI*2,u=r/5,front=Math.max(0,Math.cos(t));verts.push(Math.sin(t)*(.085+.045*u),1.578-.045*u-.030*u*front+Math.sin(t)*.009*u+Math.sin(u*Math.PI*3)*.006,Math.cos(t)*(.086+.032*u)+front*Math.sin(u*Math.PI*3)*.008);}
 for(let r=0;r<5;r++)for(let i=0;i<64;i++){const a=r*65+i;indices.push(a,a+65,a+1,a+1,a+65,a+66);}
 scarfGeo.setAttribute('position',new T.Float32BufferAttribute(verts,3));scarfGeo.setIndex(indices);scarfGeo.computeVertexNormals();
 const si=[],sw=[];for(let i=0;i<verts.length/3;i++){si.push(chestIndex,0,0,0);sw.push(1,0,0,0);}scarfGeo.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));scarfGeo.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));
 const scarf=new T.SkinnedMesh(scarfGeo,new T.MeshToonMaterial({color:'#dbcfb2',gradientMap:ramp,side:T.DoubleSide}));const allBones=[...bones.values()];scarf.bind(new T.Skeleton(allBones,allBones.map(b=>b.matrixWorld.clone().invert())),new T.Matrix4());scarf.castShadow=true;model.add(scarf);
 const clasp=new T.Group();const bronze=new T.MeshToonMaterial({color:'#b7894a',gradientMap:ramp}),teal=new T.MeshToonMaterial({color:'#4bbaac',gradientMap:ramp});const plate=new T.Mesh(new T.SphereGeometry(.021,16,10),bronze);plate.scale.set(1,1.13,.32);clasp.add(plate);const gem=new T.Mesh(new T.OctahedronGeometry(.016),teal);gem.scale.z=.4;gem.position.z=.009;clasp.add(gem);clasp.position.set(.063,1.515,.113);model.add(clasp);model.updateMatrixWorld(true);chest.attach(clasp);

 const bellAnchor=new T.Group();bellAnchor.position.set(-.13,1.08,.145);model.add(bellAnchor);model.updateMatrixWorld(true);bones.get('pelvis').attach(bellAnchor);
 const cord=new T.Mesh(new T.CylinderGeometry(.003,.003,.115,6),new T.MeshToonMaterial({color:'#4e3020',gradientMap:ramp}));cord.position.y=-.045;bellAnchor.add(cord);
 const bell=new T.Mesh(new T.LatheGeometry([new T.Vector2(.028,0),new T.Vector2(.026,.009),new T.Vector2(.018,.022),new T.Vector2(.012,.044),new T.Vector2(0,.049)],16),bronze);bell.position.y=-.14;bellAnchor.add(bell);
 const clapper=new T.Mesh(new T.SphereGeometry(.008,8,6),bronze);clapper.position.y=-.145;bellAnchor.add(clapper);
 // Capture rest rotations before any motion. Target ancestors precede descendants.
 const sourceBones=new Map();source.scene.traverse(n=>{if(n.isBone)sourceBones.set(n.name,n);});source.scene.updateMatrixWorld(true);model.updateMatrixWorld(true);
 const depth=n=>{let d=0;while(n.parent){d++;n=n.parent;}return d;};const targets=[...bones.values()].sort((a,b)=>depth(a)-depth(b));
 const rest=new Map(targets.filter(b=>sourceBones.has(b.name)).map(b=>[b,{srcInv:sourceBones.get(b.name).getWorldQuaternion(new T.Quaternion()).invert(),dst:b.getWorldQuaternion(new T.Quaternion()),position:b.position.clone()}]));
 const sourcePelvis=sourceBones.get('pelvis'),targetPelvis=bones.get('pelvis'),pelvisRest=sourcePelvis.position.clone();
 const mixer=new T.AnimationMixer(source.scene),actions={};for(const c of source.animations)actions[c.name]=mixer.clipAction(c);
 let current=null;function play(name,{once=false}={}){const a=actions[name];if(!a||current===a)return;const old=current;a.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(once?T.LoopOnce:T.LoopRepeat,once?1:Infinity);a.clampWhenFinished=once;a.play();if(old){a.fadeIn(.16);old.fadeOut(.16);}current=a;}
 const root=new T.Group();root.add(model);const scale=1.6/1.86;model.scale.setScalar(scale);
 const nominal={Walk_Loop:.975*scale,Jog_Fwd_Loop:5/.9333333333*scale,Sprint_Loop:8.25*scale};
 const q=new T.Quaternion(),parent=new T.Quaternion(),world=new T.Quaternion();
 function applyPose(){source.scene.updateMatrixWorld(true);root.updateMatrixWorld(true);const rootQ=root.getWorldQuaternion(new T.Quaternion());for(const b of targets){const r=rest.get(b);if(!r)continue;sourceBones.get(b.name).getWorldQuaternion(q);world.copy(rootQ).multiply(q).multiply(r.srcInv).multiply(r.dst);b.parent.getWorldQuaternion(parent).invert();b.quaternion.copy(parent.multiply(world));b.updateMatrixWorld(true);}targetPelvis.position.copy(rest.get(targetPelvis).position).add(sourcePelvis.position.clone().sub(pelvisRest));model.updateMatrixWorld(true);}
 let elapsed=0;function update(dt,speed){elapsed+=dt;bellAnchor.rotation.z=Math.sin(elapsed*9)*Math.min(.22,(speed??(current?.getClip().name==='Idle_Loop'?0:2))*.04);if(current)current.timeScale=speed!==undefined&&nominal[current.getClip().name]?Math.max(.1,Math.min(2,speed/nominal[current.getClip().name])):1;mixer.update(dt);applyPose();}
 function reset(){mixer.stopAllAction();current=null;root.position.set(0,0,0);root.rotation.set(0,0,0);play('Idle_Loop');update(0);}
 reset();return{root,play,reset,nominal,update,get clip(){return current?.getClip().name;}};
}
