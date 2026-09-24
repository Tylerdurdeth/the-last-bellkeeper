import * as T from 'three';
import {ASSET,bakeStatic} from './assetlib.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function campaignContains(x,z) {
  return (z<=-12.8&&z>-14&&x>=6.6&&x<=9.4)
    || (z<=-14&&z>=-48.5&&x>=1&&x<=15)
    || Math.hypot(x-8,z+59)<=11.8
    || (x>=11&&x<=17&&z<=-47&&z>=-53);
}

// Authored greybox: coordinates are world metres. Never falls back to old terrain
// inside the footprint, including empty space. Integration must use this same
// footprint to cut old terrain/scatter; OR-ing old collision resurrects its ridge.
export async function buildCampaignWorld(scene, art) {
  const root=new T.Group();root.name='campaign-world';scene.add(root);
  const supports=[],walls=[],indicators=[],rotors=[],solidProps=[];
  const material=(color,name)=>Object.assign(new T.MeshStandardMaterial({color,roughness:.87}),{name});
  const stone=material('#E7DDC2','stone'),edge=material('#704337','timber'),ivory=material('#E7DDC2','plaster'),copper=material('#B76F48','metal'),teal=material('#62C9BC','metal');
  let floorPaint=stone;
  const domain=campaignContains;
  root.userData.contains=domain;
  root.userData.integration={terrainCutout:'contains(x,z), south of z=-14 only; retain island overlap',collision:'campaign.ground !== undefined selects campaign ground AND blocked; null is void',islandSeam:[8,1.2,-12.8]};
  function mesh(geometry,mat,parent=root){const m=new T.Mesh(geometry,mat);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  function box(x,y,z,w,h,d,mat=stone,parent=root){const m=mesh(new T.BoxGeometry(w,h,d),mat,parent);m.position.set(x,y,z);return m;}
  // Tapered bark root on a CatmullRom spine (visual only: never a support or collider).
  function rootGeometry(pts,r0,r1,seg=20,radial=7){const curve=new T.CatmullRomCurve3(pts.map(q=>new T.Vector3(...q))),fr=curve.computeFrenetFrames(seg,false),len=curve.getLength(),pos=[],uv=[],idx=[],n=new T.Vector3();
    for(let i=0;i<=seg;i++){const t=i/seg,c=curve.getPointAt(t),r=T.MathUtils.lerp(r0,r1,t**.8)*(1+.1*Math.sin(t*19+r0*7));for(let k=0;k<=radial;k++){const a=k/radial*Math.PI*2;n.copy(fr.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(fr.binormals[i],Math.sin(a));pos.push(c.x+n.x*r,c.y+n.y*r,c.z+n.z*r);uv.push(k/radial*Math.max(1,r0*6),t*len/1.2);}}
    for(let i=0;i<seg;i++)for(let k=0;k<radial;k++){const a=i*(radial+1)+k,b=a+radial+1;idx.push(a,b,a+1,a+1,b,b+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
  function merged(geos,mat,parent=root){const m=mesh(mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g)),mat,parent);return m;}
  // Scrolling-current decal shader for the channel flows (uv.x metres along, uv.y across).
  function flowMaterial(color,opacity){const m=new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:T.DoubleSide});const u=m.userData.u={uTime:{value:0}};
    m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,u);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vBkFlow;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBkFlow=uv;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vBkFlow;uniform float uTime;').replace('#include <color_fragment>',`#include <color_fragment>
      float d=fract(vBkFlow.x*.9-uTime*.55),x=abs(vBkFlow.y-.5)*2.;diffuseColor.rgb*=.8+.45*smoothstep(.6,1.,d);diffuseColor.a*=(.25+.75*smoothstep(.3,1.,d))*(1.-x*x);`);};
    m.customProgramCacheKey=()=>'bk-campaign-flow-v1';return m;}
  // Every drawn rail is a wall collider; `when` limits it to a deck that exists.
  function rail(a,b,parent=root,when){const d=new T.Vector3(...b).sub(new T.Vector3(...a));const m=mesh(new T.BoxGeometry(.12,.14,d.length()),copper,parent);m.position.fromArray(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),d.normalize());walls.push({a,b,when});for(const p of [a,b])box(p[0],p[1]-.38,p[2],.16,.9,.16,edge,parent);}
  // Closed wedge, flat underside, top exactly the linear height used by ground.
  function deck(name,x1,x2,z1,z2,y1,y2,rails=true,parent=root){
    const bottom=Math.min(y1,y2)-1.2;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([x1,y1,z1,x2,y1,z1,x1,y2,z2,x2,y2,z2,x1,bottom,z1,x2,bottom,z1,x1,bottom,z2,x2,bottom,z2],3));
    g.setIndex([0,1,2,1,3,2,4,6,5,5,6,7,0,4,1,1,4,5,2,3,6,3,7,6,0,2,4,2,6,4,1,5,3,3,5,7]);g.computeVertexNormals();
    const m=mesh(g,stone,parent);m.name=name;
    supports.push({name,x1,x2,z1,z2,y1,y2,mesh:m,enabled:true});
    if(rails)for(const x of [x1,x2])rail([x,y1+.78,z1],[x,y2+.78,z2]);
    return supports.at(-1);
  }
  deck('island-root-ramp',6.6,9.4,-12.8,-19,1.2,.4);
  deck('source-landing',3.4,10,-19,-25,.4,.4);
  deck('wheel-landing',3.4,10,-25,-29,.4,-.2);
  // 5m locked span exceeds a 6.1/19 jump's 3.72m ideal running range.
  const windBridge=deck('wind-bridge',6.4,9.6,-29,-34,-.2,-.2,false);windBridge.enabled=false;
  deck('service-landing',3.8,11,-34,-39,-.2,-.8);
  // Optional 1.6m straight jump; an unbroken 2.6m-wide west ramp bypasses it.
  deck('jump-takeoff',6.6,10,-39,-40,-.8,-.8,false);
  deck('jump-landing',6.6,10,-41.6,-43.2,-1.2,-1.2,false);
  const stepPath=deck('accessible-step-path',3.8,6.4,-38.5,-43.2,-.74,-1.2);
  deck('step-path-join',3.8,11,-43.2,-45.5,-1.2,-1.65,false);
  deck('chamber-neck',6.2,9.8,-45.5,-50,-1.65,-2.4,false);
  for(const x of [6.2,9.8])rail([x,-1.65+.78,-45.5],[x,-1.65-.75*2.5/4.5+.78,-48]);
  // Low rails close every Rootway edge that is not a taught drop. The locked
  // bridge gap and the optional hop's two lips stay open, exactly as before.
  const deckY=(s,z)=>s.y1+(s.y2-s.y1)*(z-s.z1)/(s.z2-s.z1),named=n=>supports.find(s=>s.name===n);
  const edgeRail=(n,x1,z1,x2,z2,parent,when)=>rail([x1,deckY(named(n),z1)+.78,z1],[x2,deckY(named(n),z2)+.78,z2],parent,when);
  for(const [n,x1,z1,x2,z2] of [['source-landing',3.4,-19,6.6,-19],['source-landing',9.4,-19,10,-19],['wheel-landing',3.4,-29,6.4,-29],['wheel-landing',9.6,-29,10,-29],['service-landing',3.8,-34,6.4,-34],['service-landing',9.6,-34,11,-34],['service-landing',10,-39,11,-39],['jump-takeoff',10,-39,10,-40],['jump-landing',10,-41.6,10,-43.2],['step-path-join',10,-43.2,11,-43.2],['step-path-join',3.8,-43.2,3.8,-45.5],['step-path-join',11,-43.2,11,-45.5],['step-path-join',3.8,-45.5,6.2,-45.5],['step-path-join',9.8,-45.5,11,-45.5]])edgeRail(n,x1,z1,x2,z2);
  // The turned service bridge carries its own rails and guide; they rise with it
  // and only collide once its deck is real.
  const bridgeKit=new T.Group();windBridge.mesh.add(bridgeKit);
  for(const x of [6.4,9.6])edgeRail('wind-bridge',x,-29,x,-34,bridgeKit,()=>windBridge.enabled);
  const floor=mesh(new T.CylinderGeometry(11,10.2,1.4,64),stone);floor.position.set(8,-3.1,-59);floor.name='windworks-floor';
  const chamberY=-2.4;
  deck('home-lift-balcony',11,17,-48.5,-53,chamberY,chamberY,false);
  for(let i=0;i<32;i++){
    const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
    // North-facing opening (toward +z) and eastern balcony are real openings.
    if((i>=6&&i<=9)||(i>=2&&i<=4))continue;
    rail([8+10.8*Math.cos(a),chamberY+.78,-59+10.8*Math.sin(a)],[8+10.8*Math.cos(b),chamberY+.78,-59+10.8*Math.sin(b)]);
  }
  const ground=(x,z)=>{
    if(!domain(x,z))return undefined;
    let y=null;
    // Match the actual 64-gon top, not its circumscribed circle.
    const dx=x-8,dz=z+59,theta=Math.atan2(dz,dx),local=((theta%(Math.PI/32))+Math.PI/32)%(Math.PI/32);
    const radial=11*Math.cos(Math.PI/64)/Math.cos(local-Math.PI/64);
    if(Math.hypot(dx,dz)<=radial)y=chamberY;
    for(const s of supports)if(s.enabled&&x>=s.x1&&x<=s.x2&&z<=s.z1&&z>=s.z2){const h=s.y1+(s.y2-s.y1)*(z-s.z1)/(s.z2-s.z1)+s.mesh.position.y;y=y===null?h:Math.max(y,h);}
    return y;
  };
  const blocked=(x,z,r=.23)=>{
    if(!domain(x,z))return false;
    return solidProps.some(p=>p.rx?Math.hypot((x-p.x)/(p.rx+r),(z-p.z)/(p.rz+r))<1:Math.hypot(x-p.x,z-p.z)<r+p.r)||walls.some(({a,b,when})=>{if(when&&!when())return false;const dx=b[0]-a[0],dz=b[2]-a[2],u=T.MathUtils.clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-u*dx,z-a[2]-u*dz)<r+.08;});
  };
  const xz={entry:[8,-17],source:[5,-22],bridgeWheel:[5,-28],service:[8,-37],chamberEntry:[8,-45],inspection:[4,-50],returnWheel:[0,-56],returnVane:[5,-59],outwardVane:[11,-59],guardian:[8,-63],finalBell:[8,-67],homeLift:[15,-50],secret:[5,-41]};
  const points=Object.fromEntries(Object.entries(xz).map(([k,[x,z]])=>[k,new T.Vector3(x,ground(x,z),z)]));
  const [wheelA,wheelB,wheelC,source,bell,archProto,liftProp,rockProto,fernProto,brambleProto,heartwoodProto,secretBell,platformProto,terraceProto,vaneA,vaneB]=await Promise.all([
    ...Array.from({length:3},()=>ASSET('./assets/wheel.js',{keepHierarchy:true})),
    ASSET('./assets/windworks.js'),ASSET('./assets/heart-bells.js',{keepHierarchy:true}),
    ASSET('./assets/campaign-arch.js'),ASSET('./assets/campaign-lift.js'),
    ASSET('./assets/rock.js'),ASSET('./assets/fern.js'),ASSET('./assets/bramble.js'),ASSET('./assets/campaign-heartwood.js'),ASSET('./assets/seed-bells.js',{height:.4}),
    ASSET('./assets/campaign-platform.js'),ASSET('./assets/campaign-terrace.js'),ASSET('./assets/campaign-vane.js',{keepHierarchy:true}),ASSET('./assets/campaign-vane.js',{keepHierarchy:true})]);
  function prop(o,key,dx,dz,scale=1){o.name='campaign-'+key;o.scale.setScalar(scale);o.position.copy(points[key]).add(new T.Vector3(dx,0,dz));art?.style?.(o);root.add(o);return o;}
  ['bridgeWheel','inspection','returnWheel'].forEach((key,i)=>{const o=prop([wheelA,wheelB,wheelC][i],key,-.8,-.65,.65);const rotor=o.getObjectByName('seedWheelRotor');if(rotor){const local=new T.Group();for(const child of rotor.children)local.add(child.clone());rotor.clear();rotor.add(bakeStatic(local));rotors.push(rotor);}});
  // The Rootway current rises from a root-wrapped copper intake at the rail (visual only,
  // outside the rail line). The toy-scale village is no longer on the walkway: the same
  // windworks cluster stands at landmark scale (~9 m, >5x hero) on a fogged eastern crag.
  const intake=new T.Group();intake.name='campaign-source-intake';root.add(intake);
  {const sp=points.source,y=sp.y;mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(2.4,y-1.6,-20.4),new T.Vector3(3.05,y+.35,-20.9),new T.Vector3(3.3,y+1.05,-21.1),new T.Vector3(3.62,y+1.15,-21.2)]),16,.15,8,false),copper,intake);
   const mouth=mesh(new T.LatheGeometry([[.13,0],[.17,.1],[.3,.26],[.34,.3]].map(([a,b])=>new T.Vector2(a,b)),16),Object.assign(copper.clone(),{side:T.DoubleSide}),intake);mouth.position.set(3.6,y+1.15,-21.2);mouth.rotation.z=-Math.PI/2;
   const ring=mesh(new T.TorusGeometry(.3,.035,6,20),edge,intake);ring.position.set(3.72,y+1.15,-21.2);ring.rotation.y=Math.PI/2;}
  source.scale.setScalar(2.4);source.position.set(19.5,-1.3,-40);source.rotation.y=-.9;source.name='campaign-far-windworks';art?.style?.(source);root.add(source);
  // Keep the loader's explicit height; place() otherwise applies native scales.
  secretBell.position.set(4.7,ground(4.7,-41),-41);secretBell.name='campaign-secret-bell';root.add(secretBell);
  // The heart bell is its own voice: two counter-hung copper bells on one living balance
  // arm (not the woodland far bell). Both bells swing on their own pivots when it is rung.
  prop(bell,'finalBell',0,-.5,1);bell.updateMatrixWorld(true);
  const bellPivots=['bellLarge','bellSmall'].map(n=>{const p=bell.getObjectByName(n);root.attach(p);const parts=new T.Group();parts.add(...p.children.map(c=>c.clone(true)));p.clear();p.add(bakeStatic(parts));return p;});
  for(const [key,flag] of [['bridgeWheel','bridge'],['service','service'],['inspection','inspection'],['returnWheel','returnCleared'],['returnVane','returnAligned'],['outwardVane','outwardAligned'],['finalBell','restored']]){
    const p=points[key],m=teal.clone();const ring=mesh(new T.TorusGeometry(.68,.065,6,24),m);ring.rotation.x=Math.PI/2;ring.position.set(p.x,p.y+.075,p.z);indicators.push({m,flag,mesh:ring});
  }
  const vanes=[];['returnVane','outwardVane'].forEach((key,i)=>{const o=prop([vaneA,vaneB][i],key,0,-.95,.8);vanes.push(o.getObjectByName('vaneRotor'));});
  // Visible wind channels and a modest construct silhouette; encounter owns hazards.
  for(const x of [2,14])for(let z=-54;z>=-64;z-=2)box(x,chamberY+.025,z,.24,.04,1.6,copper);
  // Selected B recipes: pale moulded arches and circular copper-crowned lift.
  const architectural=[];
  for(const [x,z,s] of [[8,-24,.82],[8,-51.8,1.1],[2.2,-59,.9],[13.8,-62,.9]]){
    const a=archProto.clone(true);a.position.set(x,ground(x,z),z);a.scale.set(s,z===-51.8?.72:s,s);root.add(a);architectural.push(a);
    for(const sign of [-1,1])solidProps.push({x:x+sign*1.81*s,z,r:.34*s});
  }
  const lift=prop(liftProp,'homeLift',0,0,.9);lift.position.y-=.315;
  // Authored lift floor is flush with the balcony; transport remains campaign state.
  // Inspection opens a real side aperture; it does not secretly gate the walkway.
  const shutter=box(2.2,chamberY+1.3,-59,2.65,2.5,.16,edge);shutter.name='campaign-inspection-shutter';
  const roots=new T.Group();roots.name='campaign-return-roots';root.add(roots);
  // Choking roots: tapered bark coils arch out of the rim and knot over the return channel.
  const bark=material('#5c4a36','timber'),barkDark=material('#3f3a2c','timber');
  {const y=chamberY,g=[];for(const [x0,z0,x1,z1,h,r] of [[1.0,-55.9,3.1,-57.6,.62,.2],[1.3,-58.9,2.9,-56.3,.5,.17],[.9,-57.4,3.3,-58.8,.44,.15],[1.5,-60.1,2.7,-57.9,.38,.13],[3.2,-55.6,1.2,-57.1,.34,.12],[1.1,-58.2,3.0,-59.9,.3,.11]]){const mx=(x0+x1)/2,mz=(z0+z1)/2;g.push(rootGeometry([[x0-.2,y-.7,z0],[x0,y+.05,z0],[mx,y+h,mz],[x1,y+.05,z1],[x1+.2,y-.7,z1]],r,r*.45,22,6));}
   roots.add(merged(g,bark,roots));roots.userData.baseScale=1;}
  // Twin copper conduits curve through the chamber, with a dark recessed bed.
  for(const x of [5,11])for(const offset of [-.18,.18]){
    const path=new T.CatmullRomCurve3([new T.Vector3(x,chamberY+.035,-51.5),new T.Vector3(x-.6,chamberY+.035,-55),new T.Vector3(x,chamberY+.035,-59),new T.Vector3(8+(x-8)*.5,chamberY+.035,-64.8)]);
    mesh(new T.TubeGeometry(path,30,.045,5,false),copper);
  }
  // Inlaid radial joints and concentric pale stone borders articulate the terrace.
  for(const radius of [3.1,7.6,10.35]){const ring=mesh(new T.TorusGeometry(radius,.045,4,64),copper);ring.rotation.x=Math.PI/2;ring.position.set(8,chamberY+.015,-59);}
  for(let i=0;i<20;i++){const a=i*Math.PI/10;const joint=box(8+9*Math.cos(a),chamberY+.009,-59+9*Math.sin(a),2.4,.016,.025,edge);joint.rotation.y=-a;}
  // Accepted mossy rock asset forms descending foundations and the cut-edge walls.
  // Keep all upper masses beyond walkable rail edges; no invisible wall colliders.
  const dressing=new T.Group();dressing.name='campaign-heartwood-foundations';root.add(dressing);
  const trunks=[[ -.4,-19,1.2],[-.4,-25,1.5],[-.4,-31,1.2],[-.4,-37,1.4],[16,-21,1],[16,-29,1.15],[16,-37,1]];
  for(let i=0;i<=8;i++){if(i===4)continue;const a=Math.PI+i*Math.PI/8;trunks.push([8+15.8*Math.cos(a),-59+15.8*Math.sin(a),2.7]);}
  // A living heartroot rises through the terrace behind/left of the guardian,
  // not across the x=8 bell approach or either vent lane. Reuse reviewed B asset.
  trunks.push([4.8,-64.3,.85,chamberY,.85]);
  solidProps.push({x:4.8,z:-64.3,rx:1.75,rz:1.12});
  root.userData.heartroot={x:4.8,z:-64.3,baseY:chamberY};
  const paintedBark=new Set();
  for(const [x,z,s,y=-5,sy=1.35+s*.3] of trunks){
    const o=heartwoodProto.clone(true);o.position.set(x,y,z);o.scale.set(s,sy,s);o.rotation.y=y===chamberY?0:Math.sin(z)*.3;art?.style?.(o,{wood:true});o.traverse(n=>{if(n.isMesh){const m=n.material;m.color.set('#315a5b');if(!paintedBark.has(m)){paintedBark.add(m);const prior=m.onBeforeCompile,key=m.customProgramCacheKey();m.onBeforeCompile=(shader,renderer)=>{prior.call(m,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat campaignBarkLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,campaignBarkLuma*vec3(.54,1.12,1.16),.85);');};m.customProgramCacheKey=()=>key+':campaign-bluegreen-bark';}}});dressing.add(o);
  }
  // Do not stretch the moss blades into spikes along with the stone.
  rockProto.traverse(n=>{if(n.isMesh&&n.material.name==='foliage')n.visible=false;});
  const rockHeight=rockProto.userData.nativeSize.y;
  function crag(x,y,z,sx,h,sz){const o=rockProto.clone(true);o.position.set(x,y,z);o.scale.set(sx,h/rockHeight,sz);const remove=[];o.traverse(n=>{if(n.isMesh){if(n.material.name==='foliage')remove.push(n);else{n.material=n.material.clone();n.material.color.set('#315a5b');}}});remove.forEach(n=>n.removeFromParent());dressing.add(o);return o;}
  for(let i=0;i<9;i++){const z=-17-i*2.65;for(const x of [.3,15.7])crag(x,-7,z,2.1,(x<1?10:7)+(i%3)*.35,3.3);}
  // Chamber rear buttresses frame the bell; the near side stays open to the camera.
  for(let i=0;i<11;i++){const a=Math.PI+i*Math.PI/10;crag(8+14.5*Math.cos(a),-11,-59+14.5*Math.sin(a),3,8.2,4);}
  for(let i=0;i<18;i++){const a=i*Math.PI/9;crag(8+8.3*Math.cos(a),-13,-59+8.3*Math.sin(a),4.2,10.3,4.2);}
  crag(19.5,-12,-40,4.4,10.8,3.4);
  for(const s of supports)if(s!==windBridge){const z=(s.z1+s.z2)/2;crag((s.x1+s.x2)/2,Math.min(s.y1,s.y2)-10,z,(s.x2-s.x1)*.63,9.7,Math.abs(s.z2-s.z1)*.8);}
  for(let i=0;i<24;i++){const a=i*Math.PI/12,x=8+10.2*Math.cos(a),z=-59+10.2*Math.sin(a);if(z>-50)continue;const f=fernProto.clone(true);f.position.set(x,chamberY,z);f.scale.setScalar((.65+(i%3)*.1)/fernProto.userData.nativeSize.y);dressing.add(f);}
  // Reviewed masonry bodies sit entirely under the exact collision wedges.
  for(const s of supports)if(s!==windBridge){const p=platformProto.clone(true);p.scale.set((s.x2-s.x1)/4,.72,Math.abs(s.z2-s.z1)/4);p.position.set((s.x1+s.x2)/2,Math.min(s.y1,s.y2)-.84,(s.z1+s.z2)/2);dressing.add(p);}
  const terrace=terraceProto.clone(true);terrace.scale.set(5.43,1.15,5.43);terrace.position.set(8,chamberY-1.32,-59);dressing.add(terrace);
  // ---- Shape language: roots and the living heart trunk (visual only, all outside the
  // walkable decks/floor except the choking return roots above, which clear away).
  const rootGeos=[],heartGeos=[],veinGeos=[],trimGeos=[];
  // Rootway: roots climb out of the void, curl over each outer deck lip under the rail and
  // dive back beneath the walkway; more hang from both lips of the locked bridge gap.
  for(const [n,o,z0,r] of [['source-landing',-1,-20.4,.3],['source-landing',-1,-23.6,.24],['wheel-landing',-1,-27,.28],['service-landing',-1,-35.3,.3],['accessible-step-path',-1,-40.6,.22],['step-path-join',-1,-44.4,.26],['source-landing',1,-21.6,.26],['wheel-landing',1,-26.2,.3],['service-landing',1,-36.4,.27],['jump-landing',1,-42.4,.22],['step-path-join',1,-44.8,.24],['chamber-neck',-1,-47.6,.3],['chamber-neck',1,-48.4,.28]]){
    const d=named(n),xe=o<0?d.x1:d.x2,yt=deckY(d,z0);
    rootGeos.push(rootGeometry([[xe+o*4.2,yt-3.6,z0+1.4],[xe+o*1.8,yt-.35,z0+.6],[xe+o*.3,yt+.03,z0-.15],[xe+o*.22,yt-.85,z0-1.05],[xe+o*.7,yt-2.3,z0-1.6],[xe-o*.9,yt-3.6,z0-2.5]],r,.06,26,7));
    rootGeos.push(rootGeometry([[xe+o*3.2,yt-4.4,z0-.8],[xe+o*1.1,yt-1.3,z0-.3],[xe+o*.3,yt-.4,z0+.35],[xe+o*.45,yt-1.9,z0+1.1]],r*.55,.04,16,6));
  }
  for(const [x,z,dz] of [[6.9,-29.05,-1],[7.8,-29.05,-1],[8.9,-29.05,-1],[7.2,-33.95,1],[8.5,-33.95,1],[9.2,-33.95,1]])rootGeos.push(rootGeometry([[x-.2,-.45,z-dz*.5],[x,-.55,z+dz*.12],[x+.25,-1.6,z+dz*.35],[x-.1,-3.2,z+dz*.6]],.13,.02,14,6));
  // Heartwood: one living trunk rises behind the bell; its buttresses become two great
  // roots that wrap the chamber rim on both sides (outside the rail, r>11).
  const heart={x:8,z:-75.6},trunkR=t=>2.55*(1+1.5*Math.exp(-t*9));
  {const rings=26,sides=22,y0=-13,H=40,pos=[],uv=[],idx=[];
    for(let j=0;j<=rings;j++){const t=j/rings,y=y0+t*H,cx=.9*Math.sin(t*2.3),cz=-.5*Math.sin(t*3.1);for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2,r=trunkR(t)*(1+.13*Math.cos(a*7+t*4)+.05*Math.sin(t*23+a*3));pos.push(heart.x+cx+Math.cos(a)*r,y,heart.z+cz+Math.sin(a)*r*.86);uv.push(y/2.2,i/sides*9);}}
    for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const k=j*(sides+1)+i;idx.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();heartGeos.push(g);
    for(let k=0;k<6;k++){const a0=k*1.05+.3,pts=[];for(let j=0;j<=12;j++){const t=.2+j/12*.42,y=y0+t*H,a=a0+t*1.3,r=trunkR(t)+.04;pts.push([heart.x+.9*Math.sin(t*2.3)+Math.cos(a)*r,y,heart.z-.5*Math.sin(t*3.1)+Math.sin(a)*r*.86]);}veinGeos.push(rootGeometry(pts,.075,.05,40,5));}}
  const rim=(a,dr=0,dy=0)=>[8+(11.55+dr+.12*Math.sin(3*a))*Math.cos(a),chamberY-.12+dy+.22*Math.sin(5*a),-59+(11.55+dr+.12*Math.sin(3*a))*Math.sin(a)];
  for(const [from,to,r] of [[-1.72,-4.2,.5],[-1.42,.12,.48]]){const pts=[[heart.x+(from<-1.57?-1.6:1.6),-3.6,heart.z+1.9]];for(let k=0;k<=14;k++)pts.push(rim(from+(to-from)*k/14));const end=rim(to,.4,-2.6);pts.push(end);
    heartGeos.push(rootGeometry(pts,r,.12,90,9));const v=pts.slice(1,-1).map(([x,y,z])=>{const a=Math.atan2(z+59,x-8);return [x-Math.cos(a)*.05,y+r*.78,z-Math.sin(a)*.05];});veinGeos.push(rootGeometry(v,.06,.03,70,5));}
  for(const a of [-1.95,-1.2,-2.4,-.85])heartGeos.push(rootGeometry([[heart.x+Math.cos(a+3.14)*.2+Math.cos(a)*2.4,-4,heart.z-Math.sin(a)*1.9],rim(a,.9,-1.2),rim(a,.5,-4.5)],.42,.1,18,7));
  // Crisp trim so the ivory masses read: a projecting lip under every outer deck edge and a
  // rounded cornice ring below the chamber floor edge (both below the walking surface).
  for(const d of supports)if(d!==windBridge)for(const x of [d.x1,d.x2]){const a=d.y1,b=d.y2,len=Math.abs(d.z2-d.z1),c=new T.BoxGeometry(.16,.16,len);c.rotateX(-Math.atan2(a-b,len));c.translate(x+(x===d.x1?-.05:.05),(a+b)/2-.13,(d.z1+d.z2)/2);trimGeos.push(c);}
  {const c=new T.TorusGeometry(11,.15,6,96);c.rotateX(Math.PI/2);c.translate(8,chamberY-.17,-59);trimGeos.push(c);}
  const heartBark=material('#57583f','timber'),trim=material('#A89A7A','stone'),veinMat=Object.assign(new T.MeshStandardMaterial({color:'#2f8f82',emissive:'#3fe0c4',emissiveIntensity:.8,roughness:.6}),{name:'sap'});
  const rootMesh=merged(rootGeos,bark),heartMesh=merged(heartGeos,heartBark);merged(trimGeos,trim);
  // Wood styling applies the shared bark sampler; re-tint afterwards (it resets timber paint).
  for(const [m,c] of [[rootMesh,'#5e4a37'],[heartMesh,'#39402a'],[roots.children[0],'#5e4a37']]){m.receiveShadow=true;art?.style?.(m,{wood:true});m.material.color.set(c);}
  heartMesh.castShadow=false;rootMesh.castShadow=false;
  const veins=merged(veinGeos,veinMat);veins.name='campaign-heart-veins';veins.castShadow=false;
  // Seed pods ride the rim roots; restoration swaps closed husks for open glowing pods.
  const podAngles=[-2.05,-2.55,-3.05,2.75,2.35,-1.05,-.6,-.15],podGeo=new T.SphereGeometry(.13,10,8).scale(1,1.5,1).translate(0,.12,0),openGeo=mergeGeometries([0,1,2,3].map(k=>new T.SphereGeometry(.2,8,6).scale(.55,1.2,.18).translate(0,.2,.1).rotateX(.75).rotateY(k*Math.PI/2)).concat([new T.SphereGeometry(.09,8,6).translate(0,.14,0)]));
  const pods=[new T.InstancedMesh(podGeo,material('#6f7a3c','foliage'),podAngles.length),new T.InstancedMesh(openGeo,Object.assign(material('#f2d88f','plaster'),{emissive:new T.Color('#ffb85c'),emissiveIntensity:.5}),podAngles.length)];
  pods.forEach(m=>{m.name='campaign-seed-pods';m.castShadow=false;root.add(m);});
  const podMatrix=(i,s)=>{const [x,y,z]=rim(podAngles[i],.05,.4);return new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(0,podAngles[i],.12*Math.sin(i*3))),new T.Vector3(s,s,s));};
  // Channel flows: return (west conduit + side channel) and outward (east), drawn as calm
  // scrolling currents once each vane opens; restoration widens and brightens them.
  function flowGeo(lines,width){return mergeGeometries(lines.map(line=>{const curve=new T.CatmullRomCurve3(line.map(q=>new T.Vector3(...q))),n=48,len=curve.getLength(),pos=[],uv=[],idx=[];for(let i=0;i<=n;i++){const t=i/n,c=curve.getPointAt(t),d=curve.getTangentAt(t),sx=-d.z,sz=d.x,l=Math.hypot(sx,sz)||1;for(const e of [-1,1]){pos.push(c.x+sx/l*width*e,c.y,c.z+sz/l*width*e);uv.push(t*len,e<0?0:1);}if(i<n){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);return g.toNonIndexed();}));}
  const conduit=(x,dir)=>{const q=[[x,chamberY+.09,-51.5],[x-.6,chamberY+.09,-55],[x,chamberY+.09,-59],[8+(x-8)*.5,chamberY+.09,-64.8]];return dir<0?q.reverse():q;};
  const flows=[['return',[conduit(5,-1),[[2,chamberY+.08,-64.5],[2,chamberY+.08,-53.5]]],'#6fe0cb'],['outward',[conduit(11,1),[[14,chamberY+.08,-53.5],[14,chamberY+.08,-64.5]]],'#ffb347']].map(([key,lines,color])=>{const m=new T.Mesh(flowGeo(lines,.13),flowMaterial(color,.85));m.name='campaign-'+key+'-channel-flow';m.visible=false;m.frustumCulled=false;root.add(m);return m;});
  // Copper floor guidance crosses the OPEN centre of the shifted source arch, the
  // turned bridge, passes the tender and takes the west step path (never the hop).
  function guide(line,parent=root,level){for(let i=1;i<line.length;i++){const [ax,az]=line[i-1],[bx,bz]=line[i],len=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.round(len/.55));for(let j=0;j<n;j++){const f=(j+.5)/n,x=ax+(bx-ax)*f,z=az+(bz-az)*f,y=q=>level??ground(x+(bx-ax)/len*q,z+(bz-az)/len*q),d=box(x,y(0)+.022,z,.1,.025,.38,copper,parent);d.rotation.set(-Math.atan2(y(.19)-y(-.19),.38),Math.atan2(bx-ax,bz-az),0,'YXZ');}}}
  guide([[8,-21],[8,-29]]);guide([[8,-29],[8,-34]],bridgeKit,-.2);
  guide([[8,-34],[8,-35.4],[5.4,-37.8],[5.4,-43.3],[8,-44.7],[8,-48.2]]);
  // The accessible path reads as a stepped ramp: warm paving, timber nosings and
  // edge curbs tucked under its rails (visual only; the rails are the colliders).
  const pathStone=material('#D5BD8F','stone'),mark=Object.assign(material('#E2A447','plaster'),{side:T.DoubleSide});stepPath.mesh.material=pathStone;
  for(let z=-39.1;z>=-43;z-=.55){const y=deckY(stepPath,z),nose=box(5.1,y+.012,z,2.3,.026,.09,edge);nose.rotation.x=-Math.atan2(stepPath.y1-stepPath.y2,stepPath.z1-stepPath.z2);}
  for(const x of [3.93,6.27]){const a=deckY(stepPath,-38.5),b=deckY(stepPath,-43.2),curb=box(x,(a+b)/2+.04,-40.85,.14,.08,4.72,edge);curb.rotation.x=-Math.atan2(a-b,4.7);}
  // Optional hop: ochre lips on takeoff and landing, pennants on rail posts.
  for(const [z,y] of [[-39.93,-.8],[-41.67,-1.2]])box(8.3,y+.014,z,3.4,.03,.14,mark);
  for(const x of [6.4,10]){box(x,-.8+.35,-40,.07,2.3,.07,edge);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,0,-.34,0,(x<8?.52:-.52),-.17,0],3));g.computeVertexNormals();const flag=mesh(g,mark);flag.position.set(x,-.8+1.45,-40);}
  let inspectionAmount=0,clearAmount=0;
  let bridgeAmount=0;
  let restoreAmount=0,wasRestored=null,shotTime=-1;const vTeal=new T.Color('#3fe0c4'),vGold=new T.Color('#ffc05a'),bkRestore={value:0};
  function update(dt,t,pos,progress={},state={}){
    const step=Math.min(Math.max(dt,0)||0,.1),gentle=!!state.gentle;
    // Restored span rises from below; no invisible support ahead of its mesh.
    const target=progress.bridge?1:0;bridgeAmount=T.MathUtils.damp(bridgeAmount,target,5,Math.min(Math.max(dt,0),.1));if(Math.abs(bridgeAmount-target)<.002)bridgeAmount=target;
    windBridge.mesh.position.y=-4*(1-bridgeAmount);windBridge.enabled=bridgeAmount>0;
    windBridge.mesh.visible=bridgeAmount>0;
    for(const {m,flag} of indicators){m.color.set(progress[flag]?'#62C9BC':'#704337');m.emissive.set(progress[flag]?'#194f49':'#000000');}
    rotors.forEach((r,i)=>{if(progress.bridge)r.rotation.z=t*(.2+i*.06);});
    vanes[0].rotation.y=progress.returnAligned?Math.PI/2:0;vanes[1].rotation.y=progress.outwardAligned?-Math.PI/2:0;
    inspectionAmount=T.MathUtils.damp(inspectionAmount,progress.inspection?1:0,4,Math.min(dt,.1));shutter.position.y=chamberY+1.3+inspectionAmount*3;
    clearAmount=T.MathUtils.damp(clearAmount,progress.returnCleared?1:0,4,Math.min(dt,.1));roots.position.y=-clearAmount*1.2;roots.visible=clearAmount<.995;
    floorPaint.color.set(progress.restored?'#E8DEC5':'#DED3B8');
    // Restoration: a ~3 s crossfade (floor warmth, light shaft, veins, flows, pods). The
    // camera widening envelope starts only when the bell is rung in place, never on load.
    if(wasRestored===false&&progress.restored&&pos&&Math.hypot(pos.x-points.finalBell.x,pos.z-points.finalBell.z)<4)shotTime=0;
    wasRestored=!!progress.restored;if(shotTime>=0)shotTime+=step;
    restoreAmount=T.MathUtils.damp(restoreAmount,progress.restored?1:0,1.1,step);bkRestore.value=restoreAmount;
    const breath=Math.max(0,Math.sin(t*2.6))**3+.6*Math.max(0,Math.sin(t*2.6-1.9))**3,pulse=progress.returnCleared?.25:breath;
    const vm=veins.material;vm.emissive.copy(vTeal).lerp(vGold,restoreAmount);vm.color.set(restoreAmount>.5?'#8a6a2f':'#2f8f82');vm.emissiveIntensity=(.45+.9*pulse)*(1-restoreAmount)+restoreAmount*(1.5+.25*Math.sin(t*1.3));
    if(!progress.returnCleared)roots.scale.set(1,1+(gentle?.015:.06)*breath,1);
    flows.forEach((m,i)=>{const on=i?progress.outwardAligned:progress.returnAligned;m.visible=!!on;m.material.userData.u.uTime.value=gentle?t*.35:t;m.material.opacity=.55+.4*restoreAmount;m.scale.y=1;});
    for(let i=0;i<podAngles.length;i++){const k=T.MathUtils.clamp(restoreAmount*1.6-i*.08,0,1);pods[0].setMatrixAt(i,podMatrix(i,1-k*.999));pods[1].setMatrixAt(i,podMatrix(i,.001+k*1.1));}
    pods[0].instanceMatrix.needsUpdate=pods[1].instanceMatrix.needsUpdate=true;
    // Rung: the large bell answers first, the small one a beat later (two-part phrase).
    bellPivots.forEach((b,i)=>{const u=shotTime-i*.45,k=gentle?.35:1;b.rotation.z=u>0?k*(i?-.3:.22)*Math.exp(-u*.8)*Math.sin(u*(i?6.2:4.6)):0;});
    root.visible=!pos||Math.hypot(pos.x-8,pos.z+42)<80;
  }
  root.userData.supports=supports;root.userData.floor=floor;root.userData.gaps=[{name:'wind-bridge',z:[-29,-34],width:5,requires:'bridge'},{name:'optional-root-hop',z:[-40,-41.6],width:1.6,bypassX:5.1}];
  // Batch static dressing in three spatial blocks, preserving collision meshes and
  // all named moving parts. Detached source meshes remain the ground-test oracle.
  art?.style?.(root);floorPaint=floor.material;for(const item of indicators)item.m=item.mesh.material;
  // Keep the shared painted stone sampler, but at one quarter of its normal
  // contrast. Applies only to walking surfaces, not arch trim or cliff stone.
  const priorFloor=floorPaint.onBeforeCompile,floorKey=floorPaint.customProgramCacheKey();
  floorPaint.roughness=1;floorPaint.metalness=0;
  // Value structure on all campaign paving: vertical faces cooler/darker, deeper faces darker
  // still; in the Heartwood a warm pool under the upper light with a cooler, darker rim and a
  // worn band at the edge. Restoration warms and lifts it. (vBkWorld comes from art-direction.)
  floorPaint.onBeforeCompile=(shader,renderer)=>{priorFloor.call(floorPaint,shader,renderer);shader.uniforms.bkRestore=bkRestore;shader.fragmentShader=shader.fragmentShader.replace('mix(vec3(1.),.42+1.6*bkStone,.85)','mix(vec3(1.),.42+1.6*bkStone,.2125)')
    .replace('#include <common>','#include <common>\nuniform float bkRestore;').replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    {vec3 fn=normalize(cross(dFdx(vBkWorld),dFdy(vBkWorld)));float side=1.-smoothstep(.45,.85,abs(fn.y));
     diffuseColor.rgb*=mix(vec3(1.),vec3(.66,.74,.80),side*.85);
     float heart=smoothstep(-44.,-48.,vBkWorld.z),r=length(vBkWorld.xz-vec2(8.,-59.));
     diffuseColor.rgb*=mix(vec3(1.),vec3(.70,.78,.84),side*smoothstep(-2.6,-4.6,vBkWorld.y)*.8);
     vec3 pool=mix(vec3(1.04,1.,.90),vec3(.80,.86,.92),smoothstep(3.5,10.4,r));pool*=1.-.14*smoothstep(10.1,10.9,r);
     pool=mix(pool,mix(vec3(1.07,1.02,.88),vec3(.95,.93,.86),smoothstep(5.,11.,r)),bkRestore);
     diffuseColor.rgb*=mix(vec3(1.),pool,heart*(1.-side));}`);};
  floorPaint.customProgramCacheKey=()=>floorKey+':campaign-matte-floor-quarter-texture:value-v1';
  const moving=new Set([windBridge.mesh,shutter,roots,vaneA,vaneB,...[wheelA,wheelB,wheelC],veins,...flows,...pods,...bellPivots]);
  const blocks=[new T.Group(),new T.Group(),new T.Group()];
  for(const child of [...root.children]){
    if(moving.has(child)||indicators.some(({m})=>child.material===m))continue;
    if(child===dressing){for(const o of [...dressing.children])blocks[o.position.z>-33?0:o.position.z>-49?1:2].add(o);root.remove(dressing);}
    else {child.updateMatrixWorld(true);const center=new T.Box3().setFromObject(child).getCenter(new T.Vector3());blocks[center.z>-33?0:center.z>-49?1:2].add(child);}
  }
  for(const block of blocks){block.updateMatrixWorld(true);const baked=bakeStatic(block);root.add(baked);}
  windBridge.mesh.remove(bridgeKit);bridgeKit.updateMatrixWorld(true);windBridge.mesh.add(bakeStatic(bridgeKit));
  update(0,0,null,{});root.updateMatrixWorld(true);
  // Per-zone light rig for main.js to apply (main owns the hemisphere/sun lights and fog).
  // Rootway: cooler, darker; Heartwood: warm key from above over a cool low fill and less
  // milky haze; restored Heartwood: warmer, brighter key and lifted, warmer fog. Outside the
  // campaign footprint every value eases back to the woodland rig captured on first call.
  const rig={root:{sky:'#cfe0da',ground:'#1a3036',hemi:1.35,sun:'#ffd7a0',sunI:2.35,fog:'#7a9c99',density:.027},heart:{sky:'#ffe2bd',ground:'#16283a',hemi:1.05,sun:'#ffcc85',sunI:2.45,fog:'#688b8f',density:.021},restored:{sky:'#ffeccb',ground:'#4f4c38',hemi:1.6,sun:'#ffcf82',sunI:3.05,fog:'#b9b08a',density:.012}};
  let base=null;const tmp=new T.Color(),tmp2=new T.Color(),mixC=(a,b,k)=>tmp2.set(a).lerp(tmp.set(b),k).clone();
  function atmosphere({scene:sc,hemi,sun,renderer}={},dt=0,pos,progress={}){
    if(!sc?.fog||!hemi||!sun||!pos)return;
    base??={sky:'#'+hemi.color.getHexString(),ground:'#'+hemi.groundColor.getHexString(),hemi:hemi.intensity,sun:'#'+sun.color.getHexString(),sunI:sun.intensity,fog:'#'+sc.fog.color.getHexString(),density:sc.fog.density};
    const inside=pos.x>-4&&pos.x<22,wr=inside?T.MathUtils.smoothstep(-pos.z,13,17):0,wh=inside?T.MathUtils.smoothstep(-pos.z,43,48):0,heart={};
    for(const k of Object.keys(base)){const a=rig.heart[k],b=rig.restored[k],c=restoreAmount;heart[k]=typeof a==='number'?a+(b-a)*c:mixC(a,b,c);}
    const want={};for(const k of Object.keys(base)){const a=base[k],b=rig.root[k],c=heart[k];want[k]=typeof a==='number'?(a+(b-a)*wr)*(1-wh)+c*wh:mixC(mixC(a,b,wr),c,wh);}
    const e=1-Math.exp(-Math.min(dt,.1)*2.2);
    hemi.color.lerp(want.sky,e);hemi.groundColor.lerp(want.ground,e);hemi.intensity+=(want.hemi-hemi.intensity)*e;
    sun.color.lerp(want.sun,e);sun.intensity+=(want.sunI-sun.intensity)*e;
    sc.fog.color.lerp(want.fog,e);sc.fog.density+=(want.density-sc.fog.density)*e;if(sc.background?.isColor)sc.background.copy(sc.fog.color);
  }
  // Restoration camera widening envelope (0..1, ~4.6 s, none in gentle motion).
  function restorationShot(gentle){if(gentle||shotTime<0)return 0;return T.MathUtils.smoothstep(shotTime,0,1.4)*(1-T.MathUtils.smoothstep(shotTime,3.4,4.8));}
  root.userData.restoration=()=>({amount:restoreAmount,shot:restorationShot(false)});
  return {ground,blocked,update,points,root,owns:campaignContains,atmosphere,restorationShot};
}
