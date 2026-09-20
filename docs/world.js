import * as T from 'three';
import {createBrook} from './brook.js';
import {createWoodlandLife} from './woodland-life.js';
import {buildBackdrop} from './backdrop.js';
import {ASSET,bakeStatic} from './assetlib.js';
import {height,pathDistance,POINTS,TERRAIN,terrainGround,ridgeBlocked,shoreClearance} from './world-layout.js';

// The named deck survives recipe loading. Only its real triangles support feet;
// ropes and posts never become an invisible floor. World matrices follow the rise.
export function createBridgeCrossing(bridge){
 const deck=bridge.getObjectByName('bridge-deck');
 if(!deck)throw new Error('Bridge recipe must retain its named deck');
 const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
 const {x,z,length,width}=TERRAIN.bridge;
 bridge.updateMatrixWorld(true);ray.ray.origin.set(x,30,z+length/2-.12);
 const end=ray.intersectObject(deck,true)[0];if(!end)throw new Error('Bridge endpoint has no deck');
 // A four-centimetre timber lip clears the bank without coplanar flicker.
 const raisedY=bridge.position.y+height(x,TERRAIN.south+.25)-end.point.y+.04;
 let lift=0;bridge.position.y=raisedY-3.6;bridge.visible=false;bridge.updateMatrixWorld(true);
 function update(dt,restored){lift=restored?T.MathUtils.damp(lift,1,7,dt):0;bridge.visible=restored;bridge.position.y=raisedY-(1-lift)*3.6;bridge.updateMatrixWorld(true);}
 function ground(px,pz){
  if(!bridge.visible||Math.abs(px-x)>width/2+.01||Math.abs(pz-z)>length/2+.01)return null;
  ray.ray.origin.set(px,30,pz);const hit=ray.intersectObject(deck,true)[0];
  return hit&&hit.point.y>TERRAIN.waterY?hit.point.y:null;
 }
 return {ground,update,get lift(){return lift;},raisedY};
}
// Authored landmarks, then deterministic natural scatter. Geometry comes from reviewed recipe assets.
export async function buildWorld(scene,art){
 const scatterRocks=[],colliders=[],chunks=new Map(),animated=[],birds=[],lanterns=[],trees=[];let seed=419;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const shortcutLine=[[-10,-9],[-3,2]];
 const shortcutDistance=(x,z)=>{const a=shortcutLine[0],b=shortcutLine[1],dx=b[0]-a[0],dz=b[1]-a[1],u=T.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-u*dx,z-a[1]-u*dz);};
 const gardenClearance=(x,z)=>[POINTS.garden,POINTS.quietGarden].some(([gx,gz])=>Math.hypot(x-gx,z-gz)<1.6);
 const prototypes={};
 await Promise.all(['terrain','cottage','tree','fern','rock','bridge','chimes','sanctuary-bell','bird','flower','wheel','lantern','bramble','hosta','shelf-stump','rabbit','kingfisher','luna-moth'].map(async name=>{
  prototypes[name]=await ASSET('./assets/'+name+'.js',{keepHierarchy:['terrain','bridge','bird','wheel','chimes','rabbit','kingfisher','luna-moth'].includes(name)});
  art.style(prototypes[name],{terrain:name==='terrain',wood:name==='tree'});
 }));
 function place(name,x,z,scale=1,rotation=0,{dynamic=false,y=height(x,z)}={}){
  // Bank dressing must not overhang the clear channel or create stepping stones.
  if(name!=='bridge'&&!shoreClearance(x,z,name==='rock'?scale*1.15:name==='tree'?.8:.15))return new T.Group();
  const o=prototypes[name].clone(true);for(const [key,val] of Object.entries(prototypes[name].userData)){if(val?.isObject3D)o.userData[key]=o.getObjectByName(val.name);}
  o.position.set(x,y,z);o.scale.multiplyScalar(scale);o.rotation.y=rotation;
  if(dynamic){scene.add(o);animated.push(o);}else{const key=Math.floor(x/10)+':'+Math.floor(z/10);if(!chunks.has(key))chunks.set(key,new T.Group());chunks.get(key).add(o);}return o;
 }
 const terrain=prototypes.terrain;terrain.position.y=-8;terrain.traverse(n=>{if(n.isMesh&&n.material.name==='ground'&&!n.geometry.attributes.color)n.visible=false;});scene.add(terrain);const brook=createBrook(T,terrain.getObjectByName('water'));
 const cottage=place('cottage',-8,9,1,.7,{dynamic:true});colliders.push({x:-8,z:9,r:2.25});const cottageMats=[];cottage.traverse(o=>{if(o.isMesh){o.material=o.material.clone();art.style(o);o.material.transparent=true;cottageMats.push(o.material);}});
 const wheel=place('wheel',6,2.5,1.2,-.45,{dynamic:true});colliders.push({x:6,z:2.5,r:.62});
 const bridge=place('bridge',TERRAIN.bridge.x,TERRAIN.bridge.z,1,0,{dynamic:true,y:0});
 const crossing=createBridgeCrossing(bridge);
 const chimes=place('chimes',-9.5,-14.5,1.05,0,{dynamic:true});
 // Reviewed moss rocks frame dry banks; actual rock surfaces replace circular
 // ravine blockers. The eight metre channels remain completely clear.
 for(const [x,z,s] of [[-5.5,-8,.8],[5.2,-9,.7],[12.8,-9,.75],[24.5,-8,.8]]){
  const o=place('rock',x,z,s,rnd()*6.28);scatterRocks.push({o,x,z,r:s*1.5});
 }
 // The continuous 5.5m cliff in the terrain mesh is the physical outer boundary.
 // Existing reviewed rocks and ferns break up its foot without replacing its shape.
 for(let a=-25;a<=25;a+=3.5)for(const [x,z] of [[-27,a],[27,a],[a,-27],[a,27]]){
  const s=.8+rnd()*.3,o=place('rock',x,z,s,rnd()*6.28);scatterRocks.push({o,x,z,r:s*1.5});
  place('fern',x*.97,z*.97,.9+rnd()*.4,rnd()*6.28);
 }
 for(const [x,z] of [[-5,14],[-10,3],[-16,-6],[-10,-17],[5,0],[8,-9]])lanterns.push(place('lantern',x,z,.7,rnd()*6.28,{dynamic:true}));
 // Trunks frame bends, roofs and clearings; never place a trunk on the walking route.
 const trunks=[[-7,17],[3,15],[-13,12],[-1,10],[-13,5],[-20,2],[-8,-2],[-20,-8],[-13,-13],[-5,-12],[-16,-20],[-5,-21],[1,-20],[16,-19],[20,-8],[16,4],[12,12],[-24,-14],[-24,12],[2,23]].filter(([x,z])=>shoreClearance(x,z,.8));
 // Soil/moss banks bind exposed roots to terrain rather than placing them on an unbroken carpet.
 terrain.traverse(n=>{const geo=n.geometry,c=geo?.attributes.color,p=geo?.attributes.position;if(!c||!p)return;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);let edge=99;for(const [tx,tz] of trunks)edge=Math.min(edge,Math.hypot(x-tx,z-tz));const w=(1-T.MathUtils.smoothstep(edge,1.1,3.4))*.48;const col=new T.Color().fromBufferAttribute(c,i);col.lerp(new T.Color(0x495e3b),w);c.setXYZ(i,col.r,col.g,col.b);}c.needsUpdate=true;});
 // Per-instance root contact; prototypes and gameplay surfaces remain unchanged.
 function conformRoots(tree){
  tree.updateMatrixWorld(true);const treeInverse=tree.matrixWorld.clone().invert(),v=new T.Vector3(),local=new T.Vector3();
  tree.traverse(mesh=>{if(!mesh.isMesh||mesh.material?.name!=='timber')return;
   const geometry=mesh.geometry.clone(),position=geometry.attributes.position,oldNormals=geometry.attributes.normal?.array.slice(),inverse=mesh.matrixWorld.clone().invert(),weights=[];
   for(let i=0;i<position.count;i++){v.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);local.copy(v).applyMatrix4(treeInverse);const weight=1-T.MathUtils.smoothstep(local.y,.06,1.55);weights.push(weight);if(weight<=0)continue;v.y+=(height(v.x,v.z)-tree.position.y)*weight;v.applyMatrix4(inverse);position.setXYZ(i,v.x,v.y,v.z);}
   geometry.computeVertexNormals();const normal=geometry.attributes.normal,groups=new Map();
   // Merged assets are non-indexed. Reconnect duplicated corners for soft lower-root normals.
   for(let i=0;i<position.count;i++){if(weights[i]<=0){if(oldNormals)normal.setXYZ(i,oldNormals[i*3],oldNormals[i*3+1],oldNormals[i*3+2]);continue;}const key=[position.getX(i),position.getY(i),position.getZ(i)].map(v=>Math.round(v*1e5)).join(',');if(!groups.has(key))groups.set(key,{sum:new T.Vector3(),indices:[]});const group=groups.get(key);group.sum.add(v.fromBufferAttribute(normal,i));group.indices.push(i);}
   for(const group of groups.values()){group.sum.normalize();for(const i of group.indices)normal.setXYZ(i,group.sum.x,group.sum.y,group.sum.z);}
   position.needsUpdate=true;normal.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
  });
 }
 for(const [x,z] of trunks){const scale=.72+rnd()*.34;const tree=place('tree',x,z,scale,rnd()*6.28,{dynamic:true});conformRoots(tree);const fadeMats=[];tree.traverse(n=>{if(n.isMesh){n.material=n.material.clone();art.style(n,{wood:true});n.material.forceSinglePass=true;n.material.transparent=true;fadeMats.push(n.material);}});tree.userData.fadeMats=fadeMats;tree.userData.fade=1;tree.userData.occluded=false;trees.push(tree);colliders.push({x,z,r:.6*scale});}
 // Quiet path centres and dense edges keep small details legible against broad painted ground.
 for(let i=0;i<410;i++){
  const x=-25+rnd()*45,z=-24+rnd()*49,d=pathDistance(x,z);
  if(gardenClearance(x,z)||Math.hypot(x+10,z+17)<1.8||Math.hypot(x-8,z+10)<2.3||Math.hypot(x+8,z+15)<2||height(x,z)<-2||Math.hypot(x+8,z-9)<3.2||Math.hypot(x-6,z-2.5)<2||Math.hypot(x-8,z+3.35)<4)continue;
  const branch=Math.min(...[[0,5],[5,3],[8,0]].map(([a,b])=>Math.hypot(x-a,z-b)));
  if(d<1.4||branch<2||shortcutDistance(x,z)<1.25)continue;
  const near=d<4.5||branch<4;
  const name=i%11===0?'rock':i%7===0?'hosta':'fern';
  if(!near&&i%3)continue;
  const scatter=place(name,x,z,name==='rock'?.7+rnd()*.7:name==='fern'?.85+rnd()*.8:.7+rnd()*.8,rnd()*6.28);
  if(name==='rock')scatterRocks.push({o:scatter,x,z,r:scatter.scale.x*1.1});
 }
 // Dense, deliberately grouped beds under the roots and around the listening garden.
 for(const [cx,cz] of [[-6,15],[-2,11],[-10,12],[-12,3],[-18,-3],[-14,-9],[-12,-17],[-7,-18],[0,6],[10,-10],[-2,21],[4,19],[-7,20],[2,16]])for(let i=0;i<16;i++){const angle=rnd()*6.28,r=.4+rnd()*2.2,x=cx+Math.cos(angle)*r,z=cz+Math.sin(angle)*r;if(gardenClearance(x,z)||shortcutDistance(x,z)<1.25||pathDistance(x,z)<1.65||Math.hypot(x+8,z-9)<2.7||Math.hypot(x+10,z+17)<1.8||Math.hypot(x-8,z+10)<2.3||Math.hypot(x+8,z+15)<2)continue;place(i%4?'fern':'flower',x,z,.8+rnd()*.8,angle);}
 for(const [x,z] of [[-3,15],[-9,5],[-16,-4],[-12,-15],[8,-11],[-6,13],[2,3],[6,-10]]){const b=place('bird',x,z,.82,0,{dynamic:true});birds.push({o:b,home:new T.Vector3(x,height(x,z),z),phase:rnd()*6.28,flight:0});}
 // Distinct garden backdrop and a tighter fern-framed western passage.
 for(const [cx,cz] of [[-17.8,-.5],[-13.2,-2],[-18,-6],[-14,-8.8],[-15.2,-17.7],[-14.5,-19.4]])for(let i=0;i<9;i++){const a=i*2.4,r=.4+Math.sqrt(i/9)*1.1,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(pathDistance(x,z)<1.25||gardenClearance(x,z))continue;place(i%3?'fern':'flower',x,z,1.1+(i%3)*.18,a);}
 for(const [x,z,s] of [[-15.4,-18.8,1.8],[-13.7,-20,1.4],[-17.2,-17.1,1.2]]){const o=place('rock',x,z,s,.6);scatterRocks.push({o,x,z,r:s*1.1});}
 const backdrop=buildBackdrop(T,scene,{prototypes,art,height});
 // Legacy valley masses were authored inside the new northern channel. Keep
 // this non-collidable scenery wholly behind the physical perimeter ridge.
 backdrop.root.position.z=-16;
 const memoryRock=prototypes.rock.clone(true);memoryRock.position.set(-19,height(-19,-5),-5);memoryRock.scale.set(1.7,1.1,1.7);scene.add(memoryRock);memoryRock.updateMatrixWorld(true);const rockRay=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
 function scatterGround(x,z){let top=null;rockRay.ray.origin.set(x,10,z);for(const r of scatterRocks){if(Math.hypot(x-r.x,z-r.z)>r.r)continue;const hit=rockRay.intersectObject(r.o,true)[0];if(hit)top=top===null?hit.point.y:Math.max(top,hit.point.y);}return top;}
 function rockGround(x,z){if(Math.hypot(x+19,z+5)>1.8)return null;rockRay.ray.origin.set(x,10,z);const hits=rockRay.intersectObject(memoryRock,true);return hits[0]?.point.y??null;}
 const keepsakePoint=new T.Vector3(-19,rockGround(-19,-5),-5);
 // The wind exposes a shorter route back toward the cottage over a low stone shelf.
 // Reuse reviewed rock geometry, and derive foot contact from its actual surface.
 const shelf=new T.Group();for(const [x,z] of [[-8.5,-4.2],[-7,-5],[-5.5,-5.8]]){const o=prototypes.rock.clone(true);o.position.set(x,height(x,z)-.02,z);o.scale.set(1.2,1.1,1.35);o.rotation.y=-.5;shelf.add(o);}scene.add(shelf);shelf.updateMatrixWorld(true);
 function shelfGround(x,z){if(Math.hypot(x+7,z+5)>3.3)return null;rockRay.ray.origin.set(x,10,z);const hits=rockRay.intersectObject(shelf,true);return hits[0]?.point.y??null;}
 const shortcutPoint=new T.Vector3(-7,shelfGround(-7,-5),-5),shortcutFlowers=[];
 for(let i=0;i<14;i++){const u=i/13,x=-10+u*7+(i%2?-.65:.65),z=-9+u*11;const o=place('flower',x,z,.9,Math.sin(i)*2,{dynamic:true});const mats=[];o.traverse(n=>{if(n.isMesh){n.material=n.material.clone();art.style(n);if(n.material.color.r>n.material.color.g){mats.push(n.material);n.material.emissive.setHex(0xe8ad51);}}});shortcutFlowers.push({o,mats,phase:i*.8});}
 let shortcutAwake=0;
 // One selected sanctuary asset, at its authored scale; no duplicate rock arch.
 const sanctuary=new T.Group();sanctuary.name='Far-bank bell sanctuary';scene.add(sanctuary);
 const sanctuaryY=height(8,-11.2),sanctuaryFlowers=[],bloomMaterials=new Map();
 const sanctuaryBell=place('sanctuary-bell',8,-11.3,1,0,{dynamic:true});sanctuary.add(sanctuaryBell);
 for(let i=0;i<52;i++){const a=i*2.39996,r=1.8+Math.sqrt(i/52)*2.2,x=8+Math.cos(a)*r,z=-9.8+Math.sin(a)*r;if(z< -12.5||Math.abs(x-8)<.7&&z> -10)continue;const f=place('flower',x,z,.8+(i%4)*.12,a,{dynamic:true});f.traverse(n=>{if(n.isMesh&&n.material.name==='foliage'){const key=n.material.uuid+':'+(i%3?0:1);if(!bloomMaterials.has(key)){const m=n.material.clone();if(m.color.r>m.color.g*.85||m.color.b>m.color.g*.8){m.color.setHex(i%3?0x86c9d7:0xe4bb82);m.emissive.setHex(0x75d8c0);}bloomMaterials.set(key,m);}n.material=bloomMaterials.get(key);}});sanctuaryFlowers.push(f);}
 const bloomGroup=new T.Group();for(const f of sanctuaryFlowers)bloomGroup.add(f);const blooms=bakeStatic(bloomGroup);scene.add(blooms);
 const pulseGeo=new T.RingGeometry(.96,1,64),pulse=new T.Mesh(pulseGeo,new T.MeshBasicMaterial({color:0xc0ffe0,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));pulse.rotation.x=-Math.PI/2;pulse.position.set(8,sanctuaryY+.09,-9.8);scene.add(pulse);let wakeAge=99,wasComplete=false;
 const life=createWoodlandLife(T,{place,height,shoreClearance});
 const chunkList=[];for(const g of chunks.values()){const baked=bakeStatic(g);scene.add(baked);const center=new T.Box3().setFromObject(baked).getCenter(new T.Vector3());chunkList.push({o:baked,center});}
 let restored=false,bridgeLift=0,cottageOpacity=1,occlusionTimer=0;const cameraRay=new T.Raycaster();
 function ground(x,z){
  const land=terrainGround(x,z),deck=crossing.ground(x,z);
  // Water excludes decorative props before their support queries; a real bridge
  // is the only exception. Every dry terrain triangle retains physical support.
  if(land===null)return deck;
  return Math.max(land,deck??-Infinity,shelfGround(x,z)??-Infinity,rockGround(x,z)??-Infinity,scatterGround(x,z)??-Infinity);
 }
 function blocked(x,z,r){return ridgeBlocked(x,z,r)||colliders.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+r);}
 function update(dt,t,pos,isRestored,gentle,camera,charged=false,complete=false){
  life.update(dt,t,pos,gentle);
  brook.update(t,gentle);
  shortcutAwake=T.MathUtils.damp(shortcutAwake,charged||isRestored?1:0,3,dt);for(const f of shortcutFlowers){f.o.rotation.z=Math.sin(t*3-f.phase)*.16*shortcutAwake*(gentle?.2:1);for(const m of f.mats)m.emissiveIntensity=shortcutAwake*(.55+.3*Math.sin(t*2-f.phase));}
  backdrop.update?.(dt,t,pos);if(isRestored&&!restored){wakeAge=0;pulse.position.set(6,height(6,2.5)+.08,2.5);}if(complete&&!wasComplete){wakeAge=0;pulse.position.set(8,sanctuaryY+.09,-9.8);}wasComplete=complete;if(!isRestored)wakeAge=99;wakeAge+=dt;
  pulse.visible=wakeAge<3.2;pulse.scale.setScalar(1+wakeAge*4);pulse.material.opacity=Math.max(0,.5*(1-wakeAge/3.2));
  for(const m of bloomMaterials.values())m.emissiveIntensity=isRestored?.24:0;
  restored=isRestored;crossing.update(dt,restored);bridgeLift=crossing.lift;
  const view=camera?camera.position.clone().sub(pos).setY(0).normalize():new T.Vector3(.615,0,.788),cdx=cottage.position.x-pos.x,cdz=cottage.position.z-pos.z,front=cdx*view.x+cdz*view.z,side=Math.abs(cdx*view.z-cdz*view.x);cottageOpacity=T.MathUtils.damp(cottageOpacity,front> -1&&front<12&&side<3.4?.025:1,12,dt);for(const m of cottageMats){m.opacity=cottageOpacity;m.depthWrite=cottageOpacity>.98;}
  const rotor=wheel.userData.rotor||wheel.getObjectByName('rotor');if(rotor?.rotation)rotor.rotation.z+=dt*(restored?1.4:.05);
  chimes.rotation.z=gentle?0:Math.sin(t*1.7)*.055;
  // Keep fade materials transparent from their first shader compilation so alpha is honored during transitions.
  // Clear the action window around hands, staff and the nearby interactable, not only the torso centre.
  occlusionTimer-=dt;if(camera&&occlusionTimer<=0){occlusionTimer=.12;for(const tree of trees){tree.userData.occluded=(tree.userData.occludedUntil||0)>t;if(tree.position.distanceTo(pos)>21)continue;for(const [side,h,forward] of [[0,.45,0],[0,1.25,0],[-1.35,1.05,0],[1.35,1.05,0],[0,1.1,1.8]]){const target=new T.Vector3(pos.x+side*.788-forward*.615,pos.y+h,pos.z-side*.615-forward*.788),dir=target.sub(camera.position),dist=dir.length();cameraRay.set(camera.position,dir.normalize());cameraRay.far=dist-.15;if(cameraRay.intersectObject(tree,true).length){tree.userData.occluded=true;tree.userData.occludedUntil=t+.65;break;}}
   // A nearby branch can fill the frame without crossing the hero-centre rays.
   // Fade only actual geometry in the first5.5 metres of the view cone, before they fill the frame.
   if(!tree.userData.occluded){for(const [sx,sy] of [[-.72,.62],[0,.62],[.72,.62],[-.72,0],[0,0],[.72,0],[-.72,-.55],[0,-.55],[.72,-.55]]){cameraRay.setFromCamera(new T.Vector2(sx,sy),camera);cameraRay.far=5.5;if(cameraRay.intersectObject(tree,true).length){tree.userData.occluded=true;tree.userData.occludedUntil=t+.65;break;}}}
  }}
  for(const tree of trees){tree.userData.fade=T.MathUtils.damp(tree.userData.fade,tree.userData.occluded?0:1,18,dt);tree.visible=tree.position.distanceTo(pos)<39&&tree.userData.fade>.012;for(const m of tree.userData.fadeMats){m.opacity=tree.userData.fade;m.depthWrite=m.opacity>=.99;}}

  for(const {o,center} of chunkList)o.visible=Math.hypot(center.x-pos.x,center.z-pos.z)<34;
  for(let i=0;i<birds.length;i++){const b=birds[i],near=b.home.distanceTo(pos)<2.1;b.flight=T.MathUtils.damp(b.flight,near?1:0,near?5:.35,dt);const q=t*2+b.phase;b.o.position.copy(b.home);b.o.position.y+=Math.max(0,Math.sin(q*3))*.11*(1-b.flight)+b.flight*(1.8+Math.sin(t*3)*.2);b.o.position.x+=Math.sin(q)*.22+b.flight*2;b.o.position.z+=b.flight*Math.cos(t+b.phase);b.o.rotation.y=q*.3;for(const name of ['leftWing','rightWing']){const j=b.o.getObjectByName(name);if(j)j.rotation.z=(name==='leftWing'?1:-1)*Math.sin(t*24)*b.flight*.9;}}
  lanterns.forEach((o,i)=>{o.rotation.z=gentle?0:Math.sin(t+i)*(.025+bridgeLift*.04);o.traverse(n=>{if(n.isMesh){for(const m of Array.isArray(n.material)?n.material:[n.material])if(m.emissive&&m.color.g>m.color.r*1.3&&m.color.b>m.color.r*1.2){m.emissive.setHex(0x75dfc2);m.emissiveIntensity=.12+bridgeLift*.65;}}});});
 }
 return {ground,blocked,keepsakePoint,shortcutPoint,update,bridge,wheel,chimes,landmarks:POINTS};
}
