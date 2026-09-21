// Original code geometry from atlas-r10-caretakers.png; warm ivory seed shells,
// copper breathing mechanisms and curved tending arms. Front is +Z.
export default function(T){
 const root=new T.Group(),rig=new T.Group();root.add(rig);
 const joints={};root.userData.joints=joints;
 const mat=(color,name,metalness=0)=>Object.assign(new T.MeshStandardMaterial({color,roughness:metalness?.48:.78,metalness,side:T.DoubleSide}),{name});
 const ivory=mat(0xe9dfc0,'ivory-shell'),copper=mat(0xb67648,'copper',.48),edge=mat(0x765037,'aged-copper',.32),dark=mat(0x293e3b,'recess'),glow=mat(0x75dcca,'wind-glass'),wood=mat(0x665b40,'rootwood');
 glow.emissive.setHex(0x258775);glow.emissiveIntensity=.35;
 function group(name,x=0,y=0,z=0,parent=rig){const g=new T.Group();g.name=name;g.position.set(x,y,z);parent.add(g);joints[name]=g;return g;}
 function mesh(g,m,x=0,y=0,z=0,parent=rig){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 function ell(m,x,y,z,a,b,c,parent=rig){const o=mesh(new T.SphereGeometry(1,16,10),m,x,y,z,parent);o.scale.set(a,b,c);return o;}
 function ring(m,x,y,z,r,t=.035,parent=rig){return mesh(new T.TorusGeometry(r,t,6,24),m,x,y,z,parent);}
 function rod(m,a,b,r=.035,parent=rig){const v=new T.Vector3(...a),w=new T.Vector3(...b),d=w.clone().sub(v);const o=mesh(new T.CylinderGeometry(r,r*.94,d.length(),8),m,0,0,0,parent);o.position.copy(v.add(w).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
 function curve(m,pts,r=.04,parent=rig){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),16,r,7,false),m,0,0,0,parent);}
 function lathe(m,pts,x=0,y=0,z=0,parent=rig,start=0,length=Math.PI*2){return mesh(new T.LatheGeometry(pts.map(p=>new T.Vector2(...p)),24,start,length),m,x,y,z,parent);}
 function plate(m,w,h,d,x,y,z,parent=rig){const s=new T.Shape();s.moveTo(0,0);s.bezierCurveTo(-w*.8,h*.18,-w*.55,h*.72,0,h);s.bezierCurveTo(w*.6,h*.7,w*.75,h*.2,0,0);return mesh(new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:2,curveSegments:10,steps:1}),m,x,y,z,parent);}
 function leaf(m,w,h,bend,x,y,z,parent=rig){const geo=new T.SphereGeometry(1,12,12),a=geo.attributes.position;for(let i=0;i<a.count;i++){const u=(a.getY(i)+1)/2;const xx=a.getX(i),zz=a.getZ(i);a.setXYZ(i,xx*w*(.6+.4*u),u*h,zz*.055+bend*Math.sin(u*Math.PI*.8));}geo.computeVertexNormals();return mesh(geo,m,x,y,z,parent);}
 function eye(parent,x,y,z,r=.06){ell(edge,x,y,z,r*1.42,r*1.2,r*.65,parent);ell(dark,x,y,z+r*.38,r*1.08,r*.84,r*.5,parent);ell(glow,x,y,z+r*.64,r*.72,r*.55,r*.35,parent);}
 function wheel(parent,r=.25){ring(edge,0,0,0,r,.04,parent);ring(copper,0,0,.025,r*.82,.025,parent);ell(copper,0,0,.045,r*.22,r*.22,.065,parent);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rod(copper,[0,0,.025],[Math.cos(a)*r*.81,Math.sin(a)*r*.81,.025],.024,parent);}}

 root.name='campaign-guardian';
 const torso=group('torso',0,1.03,0),bellows=group('bellows',0,.06,0,torso),head=group('head',0,1.16,.12,torso),rotor=group('rotor',0,.35,.47,torso);
 lathe(copper,[[.26,0],[.38,.07],[.40,.48],[.33,.61],[.29,.6],[.34,.45],[.32,.08],[.26,0]],0,.04,0,torso);
 for(let i=0;i<7;i++)lathe(i%2?edge:copper,[[.25,i*.058],[.33,i*.058+.022],[.25,i*.058+.05]],0,-.14,0,bellows);
 // Deep open seed hood: rear shell surrounds but never buries the face.
 lathe(ivory,[[.34,.43],[.48,.66],[.55,1.02],[.47,1.48],[.24,1.85],[.035,2],[.07,1.89],[.25,1.77],[.40,1.44],[.48,1.01],[.41,.68],[.3,.48]],0,0,-.05,torso,.78,Math.PI*2-1.56);
 for(const s of [-1,1]){
  const petal=group(s<0?'leftPetal':'rightPetal',s*.08,.51,.30,torso);
  const blade=leaf(ivory,.37,1.39,.19,s*.15,0,0,petal);blade.rotation.z=-s*.16;blade.rotation.y=s*.24;
  curve(copper,[[s*.06,.02,.01],[s*.3,.15,.06],[s*.42,.42,.04]],.03,petal);
  for(let i=0;i<3;i++){const o=plate(ivory,.23,.79,.075,s*.37,.58+i*.28,-.32,torso);o.rotation.z=-s*(.85+i*.3);o.rotation.y=s*.45;}
  const leg=group(s<0?'leftLeg':'rightLeg',s*.29,.67,0);
  plate(ivory,.2,.39,.12,-.01,0,-.07,leg);curve(wood,[[0,.04,0],[s*.015,-.29,.015],[s*.055,-.57,.055]],.095,leg);
  for(const j of [-1,0,1])curve(wood,[[0,-.27,0],[s*.04+j*.08,-.48,.04],[s*.08+j*.12,-.66,.15]],.048,leg);
  const arm=group(s<0?'leftArm':'rightArm',s*.54,.92,-.04,torso);
  ring(copper,0,0,0,.15,.055,arm).rotation.y=Math.PI/2;
  curve(copper,[[s*.015,-.02,0],[s*.25,-.31,.06],[s*.24,-.64,.18],[s*.02,-.84,.32]],.068,arm);
  ell(edge,s*.26,-.42,.105,.09,.09,.085,arm);
  for(const j of [-1,1])curve(copper,[[s*.02,-.84,.32],[-s*.13,-.90,.32+j*.075],[-s*.26,-.84,.38+j*.055]],.033,arm);
 }
 lathe(ivory,[[.02,-.14],[.16,-.08],[.24,.13],[.23,.29],[.13,.4],[0,.43]],0,0,0,head);
 for(const s of [-1,1]){eye(head,s*.10,.12,.215,.044);const brow=plate(edge,.045,.22,.025,s*.20,.19,.22,head);brow.rotation.z=s*1.19;}
 plate(ivory,.11,.23,.075,0,-.12,.20,head);wheel(rotor,.235);
 eye(torso,-.13,.65,.375,.065);
 curve(copper,[[0,.48,-.37],[.22,.75,-.48],[.2,1.1,-.49],[0,1.22,-.44]],.046,torso);
 for(const s of [-1,1])curve(wood,[[s*.48,1.02,-.1],[s*.57,1.26,-.06],[s*.60,1.42,-.12]],.035,torso);

 // Rigid siblings are batched locally, not across the named moving pivots.
 const parents=[];root.traverse(o=>{if(o.isGroup)parents.push(o);});
 for(const parent of parents){const buckets=new Map();for(const o of parent.children){if(!o.isMesh)continue;if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(o);}
  for(const [m,nodes] of buckets){if(nodes.length<2)continue;const arrays={position:[],normal:[],uv:[]};for(const o of nodes){o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);for(const k of Object.keys(arrays)){const a=g.getAttribute(k);for(const n of a.array)arrays[k].push(n);}g.dispose();}
   const g=new T.BufferGeometry();for(const [k,a] of Object.entries(arrays))g.setAttribute(k,new T.Float32BufferAttribute(a,k==='uv'?2:3));const o=new T.Mesh(g,m);o.castShadow=o.receiveShadow=true;parent.add(o);for(const n of nodes){parent.remove(n);n.geometry.dispose();}
  }
 }
 root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root,true),c=box.getCenter(new T.Vector3()),scale=3/(box.max.y-box.min.y);
 rig.position.set(-c.x*scale,-box.min.y*scale,-c.z*scale);rig.scale.setScalar(scale);
 root.userData.animation={front:'+Z',axes:{head:'y',leftArm:'z',rightArm:'z',rotor:'z',bellows:'scale.y'},rigidBatched:true};
 root.updateMatrixWorld(true);return root;
}
