import * as T from 'three';
import {ASSET,bakeStatic} from './assetlib.js';

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
    ASSET('./assets/windworks.js'),ASSET('./assets/sanctuary-bell.js'),
    ASSET('./assets/campaign-arch.js'),ASSET('./assets/campaign-lift.js'),
    ASSET('./assets/rock.js'),ASSET('./assets/fern.js'),ASSET('./assets/bramble.js'),ASSET('./assets/campaign-heartwood.js'),ASSET('./assets/seed-bells.js',{height:.4}),
    ASSET('./assets/campaign-platform.js'),ASSET('./assets/campaign-terrace.js'),ASSET('./assets/campaign-vane.js',{keepHierarchy:true}),ASSET('./assets/campaign-vane.js',{keepHierarchy:true})]);
  function prop(o,key,dx,dz,scale=1){o.name='campaign-'+key;o.scale.setScalar(scale);o.position.copy(points[key]).add(new T.Vector3(dx,0,dz));art?.style?.(o);root.add(o);return o;}
  ['bridgeWheel','inspection','returnWheel'].forEach((key,i)=>{const o=prop([wheelA,wheelB,wheelC][i],key,-.8,-.65,.65);const rotor=o.getObjectByName('seedWheelRotor');if(rotor){const local=new T.Group();for(const child of rotor.children)local.add(child.clone());rotor.clear();rotor.add(bakeStatic(local));rotors.push(rotor);}});
  prop(source,'source',-.7,.8,.5);
  // Keep the loader's explicit height; place() otherwise applies native scales.
  secretBell.position.set(4.7,ground(4.7,-41),-41);secretBell.name='campaign-secret-bell';root.add(secretBell);
  // Reuse the accepted bell, larger than the sanctuary bell, without a new asset.
  prop(bell,'finalBell',0,-.5,1.15);
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
  for(let i=0;i<3;i++){const b=brambleProto.clone(true);b.scale.set(.62,.32,.48);b.position.set(1.6+i*.8,chamberY+.03,-57.5);roots.add(b);}
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
  for(let i=0;i<=8;i++){const a=Math.PI+i*Math.PI/8;trunks.push([8+15.8*Math.cos(a),-59+15.8*Math.sin(a),2.7]);}
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
  for(const s of supports)if(s!==windBridge){const z=(s.z1+s.z2)/2;crag((s.x1+s.x2)/2,Math.min(s.y1,s.y2)-10,z,(s.x2-s.x1)*.63,9.7,Math.abs(s.z2-s.z1)*.8);}
  for(let i=0;i<24;i++){const a=i*Math.PI/12,x=8+10.2*Math.cos(a),z=-59+10.2*Math.sin(a);if(z>-50)continue;const f=fernProto.clone(true);f.position.set(x,chamberY,z);f.scale.setScalar((.65+(i%3)*.1)/fernProto.userData.nativeSize.y);dressing.add(f);}
  // Reviewed masonry bodies sit entirely under the exact collision wedges.
  for(const s of supports)if(s!==windBridge){const p=platformProto.clone(true);p.scale.set((s.x2-s.x1)/4,.72,Math.abs(s.z2-s.z1)/4);p.position.set((s.x1+s.x2)/2,Math.min(s.y1,s.y2)-.84,(s.z1+s.z2)/2);dressing.add(p);}
  const terrace=terraceProto.clone(true);terrace.scale.set(5.43,1.15,5.43);terrace.position.set(8,chamberY-1.32,-59);dressing.add(terrace);
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
  function update(dt,t,pos,progress={}){
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
  floorPaint.onBeforeCompile=(shader,renderer)=>{priorFloor.call(floorPaint,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('mix(vec3(1.),.42+1.6*bkStone,.85)','mix(vec3(1.),.42+1.6*bkStone,.2125)');};
  floorPaint.customProgramCacheKey=()=>floorKey+':campaign-matte-floor-quarter-texture';
  const moving=new Set([windBridge.mesh,shutter,roots,vaneA,vaneB,...[wheelA,wheelB,wheelC]]);
  const blocks=[new T.Group(),new T.Group(),new T.Group()];
  for(const child of [...root.children]){
    if(moving.has(child)||indicators.some(({m})=>child.material===m))continue;
    if(child===dressing){for(const o of [...dressing.children])blocks[o.position.z>-33?0:o.position.z>-49?1:2].add(o);root.remove(dressing);}
    else {child.updateMatrixWorld(true);const center=new T.Box3().setFromObject(child).getCenter(new T.Vector3());blocks[center.z>-33?0:center.z>-49?1:2].add(child);}
  }
  for(const block of blocks){block.updateMatrixWorld(true);const baked=bakeStatic(block);root.add(baked);}
  windBridge.mesh.remove(bridgeKit);bridgeKit.updateMatrixWorld(true);windBridge.mesh.add(bakeStatic(bridgeKit));
  update(0,0,null,{});root.updateMatrixWorld(true);
  return {ground,blocked,update,points,root,owns:campaignContains};
}
