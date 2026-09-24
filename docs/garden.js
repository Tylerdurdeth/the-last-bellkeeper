import * as T from 'three';
import {ASSET} from './assetlib.js';
import {height,POINTS} from './world-layout.js';
// Painted floor ring under the floating swirl: the catch zone is exactly this
// ring plus the hero's radius, so standing on it always offers the catch.
export const GARDEN_RING=1.5,GARDEN_CATCH=1.9;
// Two composed beds reuse the reviewed flower asset. Only the current-bearing
// bed responds to the chime; capture availability never depends on this motion.
export async function createGarden(scene,art){
 const flower=await ASSET('./assets/flower.js');art.style(flower);
 const active=[],quiet=[],source=new T.Vector3(POINTS.garden[0],height(...POINTS.garden),POINTS.garden[1]);
 for(const [center,list] of [[POINTS.garden,active],[POINTS.quietGarden,quiet]]){
  for(let i=0;i<9;i++){
   const a=-.35+i*.45,r=.80+(i%3)*.15,x=center[0]+Math.cos(a)*r,z=center[1]+Math.sin(a)*r;
   const o=flower.clone(true);o.position.set(x,height(x,z),z);o.rotation.y=a*.7;o.scale.setScalar(.76+(i%3)*.1);scene.add(o);list.push(o);
  }
 }
 const route=new T.CatmullRomCurve3([
  new T.Vector3(POINTS.chime[0],height(...POINTS.chime)+.6,POINTS.chime[1]),
  new T.Vector3(-10.8,height(-10.8,-15.1)+.35,-15.1),
  new T.Vector3(-11.9,height(-11.9,-16.2)+.45,-16.2),
  source.clone().add(new T.Vector3(0,.55,0)),
 ]);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(24*3),3));
 const trail=new T.Points(geometry,new T.PointsMaterial({color:0xe7edbe,size:.065,transparent:true,opacity:.63,depthWrite:false}));trail.frustumCulled=false;scene.add(trail);
 const ringGeometry=new T.BufferGeometry(),ringPositions=[],ringIndex=[];
 for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;for(const r of [GARDEN_RING-.15,GARDEN_RING+.15]){const x=source.x+Math.cos(a)*r,z=source.z+Math.sin(a)*r;ringPositions.push(x,height(x,z)+.09,z);}if(i<48)ringIndex.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);}
 ringGeometry.setAttribute('position',new T.Float32BufferAttribute(ringPositions,3));ringGeometry.setIndex(ringIndex);
 const ring=new T.Mesh(ringGeometry,new T.MeshBasicMaterial({color:0xb8f3da,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));ring.name='garden-catch-ring';ring.renderOrder=1;ring.visible=false;scene.add(ring);
 let response=0;
 function update(dt,time,player,{awakened=false,charged=false,restored=false,gentle=false}={}){
  const available=awakened&&!charged&&!restored,near=1-T.MathUtils.smoothstep(player.distanceTo(source),1.3,5);
  response=T.MathUtils.damp(response,available?1:0,8,dt);
  for(let i=0;i<active.length;i++){
   const o=active[i],flutter=gentle?.025:Math.sin(time*5-i*.6)*.055;
   o.rotation.x=response*(.11+near*.15+flutter);o.rotation.z=response*(-.08-near*.06+flutter*.6);
  }
  // Sheltered bed has no added current response; shared ambient foliage motion remains.
  trail.visible=available;ring.visible=response>.02;ring.material.opacity=response*(gentle?.7:.62+.13*Math.sin(time*2.4));
  if(available){const positions=geometry.attributes.position;for(let i=0;i<24;i++){
   const f=(i/24+time*.15)%1,p=route.getPoint(f),s=Math.sin(f*Math.PI);
   p.x+=Math.sin(time*2+i*2.4)*.12*s;p.y+=Math.cos(time*2.3+i)*.075;
   positions.setXYZ(i,p.x,p.y,p.z);
  }positions.needsUpdate=true;}
 }
 return {update,source,ring,activeBed:active,quietBed:quiet};
}
