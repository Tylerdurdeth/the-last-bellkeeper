import * as T from 'three';
import {ASSET} from './assetlib.js';
import {height,POINTS,bypassLine} from './world-layout.js';
// Painted floor ring under Mara's bypass outlet: the catch zone is exactly this ring plus the
// hero's radius, so standing on it always offers the catch. (GARDEN_* kept as aliases.)
export const GUST_RING=1.5,GUST_CATCH=1.9,GARDEN_RING=GUST_RING,GARDEN_CATCH=GUST_CATCH;
// Two jobs, both procedural and cheap (two point fields, one ring):
// 1. Mara's bypass: once open, motes run along the copper channel and a repeatable gust waits
//    under the outlet. The ring only shows while the gust can actually be caught.
// 2. The optional listening garden: when its rising song is played, the bed wakes for good and
//    a stream of motes keeps flowing from the root chime into it (a lasting, visible reward).
export async function createGarden(scene,art){
 const flower=await ASSET('./assets/flower.js');art.style(flower);
 const active=[],quiet=[],line=bypassLine(),source=new T.Vector3(POINTS.outlet[0],height(...POINTS.outlet),POINTS.outlet[1]),gardenPoint=new T.Vector3(POINTS.garden[0],height(...POINTS.garden),POINTS.garden[1]);
 for(const [center,list] of [[POINTS.garden,active],[POINTS.quietGarden,quiet]]){
  for(let i=0;i<9;i++){
   const a=-.35+i*.45,r=.80+(i%3)*.15,x=center[0]+Math.cos(a)*r,z=center[1]+Math.sin(a)*r;
   const o=flower.clone(true);o.position.set(x,height(x,z),z);o.rotation.y=a*.7;o.scale.setScalar(.76+(i%3)*.1);scene.add(o);list.push(o);
  }
 }
 // The song bed gets its own copies of the flower materials (no extra draws) so it can glow once woken.
 const glowMats=new Map();for(const o of active)o.traverse(n=>{if(!n.isMesh||!n.material?.emissive)return;if(!glowMats.has(n.material))glowMats.set(n.material,Object.assign(n.material.clone(),{emissive:new T.Color(0x7fe6c8),emissiveIntensity:0}));n.material=glowMats.get(n.material);});
 const v=(x,y,z)=>new T.Vector3(x,y,z);
 const route=new T.CatmullRomCurve3([v(POINTS.chime[0],height(...POINTS.chime)+.6,POINTS.chime[1]),v(-10.8,height(-10.8,-15.1)+.35,-15.1),v(-11.9,height(-11.9,-16.2)+.45,-16.2),gardenPoint.clone().add(v(0,.55,0))]);
 const top=line.top+.02,channel=new T.CurvePath();
 for(const [a,b] of [[[line.valve[0],line.valve[1]+.6,line.valve[2]],[line.valve[0],top,line.valve[2]]],[[line.valve[0],top,line.valve[2]],[line.bend[0],top,line.bend[2]]],[[line.bend[0],top,line.bend[2]],[line.post[0],top,line.post[2]]],[[line.post[0],top,line.post[2]],[line.mouth[0],top,line.mouth[2]]],[[line.mouth[0],top,line.mouth[2]],[line.mouth[0],source.y+.9,line.mouth[2]]]])channel.add(new T.LineCurve3(v(...a),v(...b)));
 const points=(n,color,size)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3));const o=new T.Points(g,new T.PointsMaterial({color,size,transparent:true,opacity:.7,depthWrite:false}));o.frustumCulled=false;o.visible=false;scene.add(o);return o;};
 const trail=points(24,0xe7edbe,.065),flow=points(40,0xfff1bf,.08);
 const ringGeometry=new T.BufferGeometry(),ringPositions=[],ringIndex=[];
 for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;for(const r of [GUST_RING-.15,GUST_RING+.15]){const x=source.x+Math.cos(a)*r,z=source.z+Math.sin(a)*r;ringPositions.push(x,height(x,z)+.09,z);}if(i<48)ringIndex.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);}
 ringGeometry.setAttribute('position',new T.Float32BufferAttribute(ringPositions,3));ringGeometry.setIndex(ringIndex);
 const ring=new T.Mesh(ringGeometry,new T.MeshBasicMaterial({color:0xb8f3da,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));ring.name='bypass-catch-ring';ring.renderOrder=1;ring.visible=false;scene.add(ring);
 let response=0,bloom=0;
 function update(dt,time,player,{open=false,catchable=false,solved=false,gentle=false}={}){
  const near=1-T.MathUtils.smoothstep(player.distanceTo(gardenPoint),1.3,5);
  response=T.MathUtils.damp(response,catchable?1:0,8,dt);bloom=T.MathUtils.damp(bloom,solved?1:0,2,dt);
  for(let i=0;i<active.length;i++){
   const o=active[i],flutter=gentle?.025:Math.sin(time*3-i*.6)*.055;
   o.rotation.x=bloom*(.08+near*.1+flutter);o.rotation.z=bloom*(-.06-near*.05+flutter*.6);
  }
  // Sheltered bed has no added response; shared ambient foliage motion remains.
  ring.visible=response>.02;ring.material.opacity=response*(gentle?.7:.62+.13*Math.sin(time*2.4));
  for(const m of glowMats.values())m.emissiveIntensity=bloom*(.55+.15*Math.sin(time*1.8));
  trail.visible=bloom>.02;trail.material.opacity=bloom*.63;
  if(trail.visible){const positions=trail.geometry.attributes.position;for(let i=0;i<24;i++){const f=(i/24+time*.12)%1,p=route.getPoint(f),s=Math.sin(f*Math.PI);p.x+=Math.sin(time*2+i*2.4)*.12*s;p.y+=Math.cos(time*2.3+i)*.075;positions.setXYZ(i,p.x,p.y,p.z);}positions.needsUpdate=true;}
  flow.visible=open;
  if(open){const positions=flow.geometry.attributes.position;for(let i=0;i<28;i++){const f=(i/28+time*.09)%1,p=channel.getPointAt(f);p.x+=Math.sin(time*3+i*1.7)*.06;p.y+=.1+Math.cos(time*2.6+i)*.05;p.z+=Math.cos(time*3.1+i*2.1)*.06;positions.setXYZ(i,p.x,p.y,p.z);}
   // A small current curls around Mara's valve itself, so her station visibly breathes.
   for(let i=0;i<12;i++){const a=time*2.2+i*.52,r=.32+.08*Math.sin(time*3+i),y=line.valve[1]+.25+((time*.5+i/12)%1)*1.1;positions.setXYZ(28+i,line.valve[0]+Math.cos(a)*r,y,line.valve[2]+Math.sin(a)*r);}positions.needsUpdate=true;}
 }
 return {update,source,gardenPoint,ring,activeBed:active,quietBed:quiet};
}
