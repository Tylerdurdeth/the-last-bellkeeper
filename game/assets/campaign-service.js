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

 root.name='campaign-service';
 const torso=group('torso',0,.43,0),head=group('head',0,.37,0,torso),bellows=group('bellows',0,-.07,0,torso),rotor=group('rotor',0,.09,.29,torso);
 ell(ivory,0,.15,0,.30,.34,.26,torso);ell(ivory,0,.03,0,.30,.19,.265,head);
 ring(edge,0,-.025,0,.275,.025,head).rotation.x=Math.PI/2;
 eye(head,0,-.03,.26,.076);
 for(const s of [-1,1])curve(copper,[[s*.07,.205,-.03],[s*.11,.165,.125],[s*.14,.065,.23],[s*.15,-.01,.23]],.009,head);
 for(let i=0;i<4;i++)ring(copper,0,-i*.045,0,.21-i*.009,.026,bellows).rotation.x=Math.PI/2;
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3+.5,leg=group(['leftLeg','rightLeg','rearLeg'][i],Math.cos(a)*.21,.30,Math.sin(a)*.19);const x=Math.cos(a),z=Math.sin(a);rod(copper,[0,0,0],[x*.12,-.12,z*.12],.035,leg);ell(edge,x*.12,-.12,z*.12,.046,.046,.046,leg);ell(copper,x*.15,-.21,z*.15,.07,.12,.065,leg);ell(copper,x*.17,-.285,z*.17,.10,.025,.09,leg);}
 for(const s of [-1,1]){const arm=group(s<0?'leftArm':'rightArm',s*.27,.19,0,torso);curve(copper,[[0,0,0],[s*.07,-.1,.04],[s*.12,-.15,.18]],.022,arm);for(const j of [-1,1])rod(copper,[s*.12,-.15,.18],[s*.14+j*.03,-.09,.23],.012,arm);}
 wheel(rotor,.10);for(let i=0;i<3;i++)ring(copper,0,.05+i*.1,-.245,.075,.014,torso);

 // Rigid siblings are batched locally, not across the named moving pivots.
 const parents=[];root.traverse(o=>{if(o.isGroup)parents.push(o);});
 for(const parent of parents){const buckets=new Map();for(const o of parent.children){if(!o.isMesh)continue;if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(o);}
  for(const [m,nodes] of buckets){if(nodes.length<2)continue;const arrays={position:[],normal:[],uv:[]};for(const o of nodes){o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);for(const k of Object.keys(arrays)){const a=g.getAttribute(k);for(const n of a.array)arrays[k].push(n);}g.dispose();}
   const g=new T.BufferGeometry();for(const [k,a] of Object.entries(arrays))g.setAttribute(k,new T.Float32BufferAttribute(a,k==='uv'?2:3));const o=new T.Mesh(g,m);o.castShadow=o.receiveShadow=true;parent.add(o);for(const n of nodes){parent.remove(n);n.geometry.dispose();}
  }
 }
 root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root,true),c=box.getCenter(new T.Vector3()),scale=1.1/(box.max.y-box.min.y);
 rig.position.set(-c.x*scale,-box.min.y*scale,-c.z*scale);rig.scale.setScalar(scale);
 root.userData.animation={front:'+Z',axes:{head:'y',leftArm:'z',rightArm:'z',rotor:'z',bellows:'scale.y'},rigidBatched:true};
 root.updateMatrixWorld(true);return root;
}
