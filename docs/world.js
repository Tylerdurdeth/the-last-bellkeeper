import * as T from 'three';
import {createBrook} from './brook.js';
import {buildBackdrop} from './backdrop.js';
import {ASSET,bakeStatic} from './assetlib.js';
import {height,pathDistance,POINTS} from './world-layout.js';
// Authored landmarks, then deterministic natural scatter. Geometry comes from reviewed recipe assets.
export async function buildWorld(scene,art){
 const scatterRocks=[],colliders=[],chunks=new Map(),animated=[],birds=[],lanterns=[],trees=[];let seed=419;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const shortcutLine=[[-10,-9],[-3,2]];
 const shortcutDistance=(x,z)=>{const a=shortcutLine[0],b=shortcutLine[1],dx=b[0]-a[0],dz=b[1]-a[1],u=T.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-u*dx,z-a[1]-u*dz);};
 const gardenClearance=(x,z)=>[POINTS.garden,POINTS.quietGarden].some(([gx,gz])=>Math.hypot(x-gx,z-gz)<1.6);
 const prototypes={};
 for(const name of ['terrain','cottage','tree','fern','rock','bridge','chimes','bird','flower','wheel','lantern']){
  prototypes[name]=await ASSET('./assets/'+name+'.js',{keepHierarchy:['terrain','bird','wheel','chimes'].includes(name)});
  art.style(prototypes[name],{terrain:name==='terrain',wood:name==='tree'});
 }
 function place(name,x,z,scale=1,rotation=0,{dynamic=false,y=height(x,z)}={}){
  const o=prototypes[name].clone(true);for(const [key,val] of Object.entries(prototypes[name].userData)){if(val?.isObject3D)o.userData[key]=o.getObjectByName(val.name);}
  o.position.set(x,y,z);o.scale.multiplyScalar(scale);o.rotation.y=rotation;
  if(dynamic){scene.add(o);animated.push(o);}else{const key=Math.floor(x/10)+':'+Math.floor(z/10);if(!chunks.has(key))chunks.set(key,new T.Group());chunks.get(key).add(o);}return o;
 }
 const terrain=prototypes.terrain;terrain.position.y=-8;terrain.traverse(n=>{if(n.isMesh&&n.material.name==='ground'&&!n.geometry.attributes.color)n.visible=false;});scene.add(terrain);const brook=createBrook(T,terrain.getObjectByName('water'));
 const cottage=place('cottage',-8,9,1,.7,{dynamic:true});colliders.push({x:-8,z:9,r:2.25});const cottageMats=[];cottage.traverse(o=>{if(o.isMesh){o.material=o.material.clone();art.style(o);o.material.transparent=true;cottageMats.push(o.material);}});
 const wheel=place('wheel',6,2.5,1.2,-.45,{dynamic:true});colliders.push({x:6,z:2.5,r:.62});
 const bridge=place('bridge',8,-3.35,1,0,{dynamic:true,y:.9});bridge.visible=false;
 const chimes=place('chimes',-9.5,-14.5,1.05,0,{dynamic:true});
 for(const [x,z] of [[-5,14],[-10,3],[-16,-6],[-10,-17],[5,0],[8,-9]])lanterns.push(place('lantern',x,z,.7,rnd()*6.28,{dynamic:true}));
 // Trunks frame bends, roofs and clearings; never place a trunk on the walking route.
 const trunks=[[-7,17],[3,15],[-13,12],[-1,10],[-13,5],[-20,2],[-8,-2],[-20,-8],[-13,-13],[-5,-12],[-16,-20],[-5,-21],[1,-20],[16,-19],[20,-8],[16,4],[12,12],[-24,-14],[-24,12],[2,23]];
 // Soil/moss banks bind exposed roots to terrain rather than placing them on an unbroken carpet.
 terrain.traverse(n=>{const geo=n.geometry,c=geo?.attributes.color,p=geo?.attributes.position;if(!c||!p)return;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);let edge=99;for(const [tx,tz] of trunks)edge=Math.min(edge,Math.hypot(x-tx,z-tz));const w=(1-T.MathUtils.smoothstep(edge,1.1,3.4))*.48;const col=new T.Color().fromBufferAttribute(c,i);col.lerp(new T.Color(0x495e3b),w);c.setXYZ(i,col.r,col.g,col.b);}c.needsUpdate=true;});
 for(const [x,z] of trunks){const scale=.72+rnd()*.34;const tree=place('tree',x,z,scale,rnd()*6.28,{dynamic:true});const fadeMats=[];tree.traverse(n=>{if(n.isMesh){n.material=n.material.clone();art.style(n,{wood:true});n.material.forceSinglePass=true;n.material.transparent=true;fadeMats.push(n.material);}});tree.userData.fadeMats=fadeMats;tree.userData.fade=1;tree.userData.occluded=false;trees.push(tree);colliders.push({x,z,r:.6*scale});}
 // Quiet path centres and dense edges keep small details legible against broad painted ground.
 for(let i=0;i<410;i++){
  const x=-25+rnd()*45,z=-24+rnd()*49,d=pathDistance(x,z);
  if(gardenClearance(x,z)||Math.hypot(x+10,z+17)<1.8||Math.hypot(x-8,z+10)<2.3||Math.hypot(x+8,z+15)<2||height(x,z)<-2||Math.hypot(x+8,z-9)<3.2||Math.hypot(x-6,z-2.5)<2||Math.hypot(x-8,z+3.35)<4)continue;
  const branch=Math.min(...[[0,5],[5,3],[8,0]].map(([a,b])=>Math.hypot(x-a,z-b)));
  if(d<1.4||branch<2||shortcutDistance(x,z)<1.25)continue;
  const near=d<4.5||branch<4;
  const name=i%7===0?'rock':'fern';
  if(!near&&i%3)continue;
  const scatter=place(name,x,z,name==='rock'?.7+rnd()*.7:name==='fern'?.85+rnd()*.8:.7+rnd()*.8,rnd()*6.28);
  if(name==='rock')scatterRocks.push({o:scatter,x,z,r:scatter.scale.x*1.1});
 }
 // Dense, deliberately grouped beds under the roots and around the listening garden.
 for(const [cx,cz] of [[-6,15],[-2,11],[-10,12],[-12,3],[-18,-3],[-14,-9],[-12,-17],[-7,-18],[0,6],[10,-10],[-2,21],[4,19],[-7,20],[2,16]])for(let i=0;i<16;i++){const angle=rnd()*6.28,r=.4+rnd()*2.2,x=cx+Math.cos(angle)*r,z=cz+Math.sin(angle)*r;if(gardenClearance(x,z)||shortcutDistance(x,z)<1.25||pathDistance(x,z)<1.65||Math.hypot(x+8,z-9)<2.7||Math.hypot(x+10,z+17)<1.8||Math.hypot(x-8,z+10)<2.3||Math.hypot(x+8,z+15)<2)continue;place(i%4?'fern':'flower',x,z,.8+rnd()*.8,angle);}
 for(const [x,z] of [[-3,15],[-9,5],[-16,-4],[-12,-15],[8,-11]]){const b=place('bird',x,z,1,0,{dynamic:true});birds.push({o:b,home:new T.Vector3(x,height(x,z),z),phase:rnd()*6.28,flight:0});}
 const backdrop=buildBackdrop(T,scene,{prototypes,art,height});
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
 const chunkList=[];for(const g of chunks.values()){const baked=bakeStatic(g);scene.add(baked);const center=new T.Box3().setFromObject(baked).getCenter(new T.Vector3());chunkList.push({o:baked,center});}
 let restored=false,bridgeLift=0,cottageOpacity=1,occlusionTimer=0;const cameraRay=new T.Raycaster();
 function ground(x,z){if(x>2&&z< -13&&height(x,z)<.95)return null;const shelfY=shelfGround(x,z);if(shelfY!==null)return Math.max(height(x,z),shelfY);const rockY=rockGround(x,z);if(rockY!==null)return Math.max(height(x,z),rockY);const scatterY=scatterGround(x,z);if(scatterY!==null)return Math.max(height(x,z),scatterY);if(Math.abs(x)>35||Math.abs(z)>35)return null;if(restored&&Math.abs(x-8)<1.1&&z> -6.2&&z<.2)return 1.2-.15*Math.cos(Math.min(1,Math.abs(z+3.35)/2.5)*Math.PI/2);const h=height(x,z);if(x>2&&x<31&&z> -5.5&&z< -1.2&&h<-.35)return null;return h< -2?null:h;}
 function blocked(x,z,r){return colliders.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+r);}
 function update(dt,t,pos,isRestored,gentle,camera,charged=false){
  brook.update(t,gentle);
  shortcutAwake=T.MathUtils.damp(shortcutAwake,charged||isRestored?1:0,3,dt);for(const f of shortcutFlowers){f.o.rotation.z=Math.sin(t*3-f.phase)*.16*shortcutAwake*(gentle?.2:1);for(const m of f.mats)m.emissiveIntensity=shortcutAwake*(.55+.3*Math.sin(t*2-f.phase));}
  backdrop.update?.(dt,t,pos);restored=isRestored;bridgeLift=T.MathUtils.damp(bridgeLift,restored?1:0,7,dt);bridge.visible=restored;bridge.position.y=.9-(1-bridgeLift)*3.6;
  const cdx=cottage.position.x-pos.x,cdz=cottage.position.z-pos.z,front=cdx*.615+cdz*.788,side=Math.abs(cdx*.788-cdz*.615);cottageOpacity=T.MathUtils.damp(cottageOpacity,front> -1&&front<12&&side<3.4?.16:1,12,dt);for(const m of cottageMats){m.opacity=cottageOpacity;m.depthWrite=cottageOpacity>.98;}
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
