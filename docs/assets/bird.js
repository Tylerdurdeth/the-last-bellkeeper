export default function(T){

 const root=new T.Group();
 const mat=(color,name='timber',roughness=.9)=>{const m=new T.MeshStandardMaterial({color,roughness,side:T.DoubleSide});m.name=name;return m;};
 const wood=mat(0x715140),woodLight=mat(0x9B7657),bark=mat(0x5A5040),ivory=mat(0xE7DDC2,'plaster'),stone=mat(0x929884,'stone'),copper=mat(0xB76F48,'metal',.55),patina=mat(0x629082,'metal',.7),dark=mat(0x253C38,'timber'),leaf=mat(0x3F7860,'foliage'),leafLight=mat(0x90AE68,'foliage'),leafDark=mat(0x285849,'foliage'),coral=mat(0xD96956,'foliage'),teal=mat(0x62C9BC,'foliage'),rope=mat(0xB49E77,'fabric');
 const mesh=(geo,m,x=0,y=0,z=0,parent=root)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 const box=(m,x,y,z,w,h,d,parent=root)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,parent);
 const ell=(m,x,y,z,a,b,c,parent=root)=>{const o=mesh(new T.SphereGeometry(1,8,6),m,x,y,z,parent);o.scale.set(a,b,c);return o;};
 const rod=(m,a,b,r1,r2=r1,parent=root,n=8)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);const o=mesh(new T.CylinderGeometry(r2,r1,d.length(),n),m,0,0,0,parent);o.position.copy(va.add(vb).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;};
 const curve=(m,points,r=.08,taper=.7,parent=root,segments=16,sides=7)=>{const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const g=new T.TubeGeometry(path,segments,r,sides,false),a=g.attributes.position,v=new T.Vector3();for(let i=0;i<=segments;i++){const center=path.getPointAt(i/segments);const scale=1-(1-taper)*i/segments;for(let j=0;j<=sides;j++){const k=i*(sides+1)+j;v.fromBufferAttribute(a,k).sub(center).multiplyScalar(scale).add(center);a.setXYZ(k,v.x,v.y,v.z);}}g.computeVertexNormals();return mesh(g,m,0,0,0,parent);};
 const shape=(m,points,depth,x=0,y=0,z=0,parent=root,bevel=.02)=>{const s=new T.Shape();points.forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));s.closePath();return mesh(new T.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,steps:1}),m,x,y,z,parent);};
 const blade=(m,length=.3,width=.10,parent=root)=>{const s=new T.Shape();s.moveTo(0,0);s.quadraticCurveTo(width,.3*length,0,length);s.quadraticCurveTo(-width,.3*length,0,0);const g=new T.ShapeGeometry(s,3);const a=g.attributes.position;for(let i=0;i<a.count;i++){const y=a.getY(i);a.setZ(i,Math.sin(y/length*Math.PI)*width*.5);}g.computeVertexNormals();return mesh(g,m,0,0,0,parent);};
 const ring=(m,x,y,z,r,t=.03,parent=root)=>mesh(new T.TorusGeometry(r,t,5,16),m,x,y,z,parent);
 const pot=(x,y,z,size=.3,m=copper)=>{const pts=[[.48,0],[.65,.15],[.70,.6],[.46,.85],[.45,1]].map(([r,h])=>new T.Vector2(r*size,h*size));const o=mesh(new T.LatheGeometry(pts,10),m,x,y,z);ring(m,x,y+size,z,size*.45,.025).rotation.x=Math.PI/2;return o;};
 const leafSpray=(x,y,z,angle,count=11,size=.4,parent=root)=>{const g=new T.Group();g.position.set(x,y,z);g.rotation.set(.25,angle,-.2);parent.add(g);for(let i=0;i<count;i++){const a=i*2.39996;const r=Math.sqrt(i/count)*size;const l=blade(i%3===0?leafLight:i%3===1?leaf:leafDark,size*(.65+(i%4)*.12),size*.22,g);l.position.set(Math.cos(a)*r,Math.sin(a)*r*.55,Math.sin(a*1.3)*r);l.rotation.set(-.6+(i%3)*.35,a,Math.sin(a)*.6);}return g;};


 const body=new T.Group();body.name='body';root.add(body);const torso=mesh(new T.IcosahedronGeometry(.075,1),woodLight,0,.1,0,body);torso.scale.set(.7,.85,1.2);ell(ivory,0,.09,.054,.04,.04,.043,body);const h=mesh(new T.IcosahedronGeometry(.043,1),wood,0,.154,.061,body);
 for(const s of [-1,1]){const g=new T.Group();g.name=s<0?'leftWing':'rightWing';g.position.set(s*.045,.11,0);body.add(g);for(let k=0;k<3;k++){const f=blade(k%2?wood:dark,.11-k*.012,.024,g);f.position.z=-k*.018;f.rotation.set(-1.5,0,s*(.2+k*.13));}}
 for(const s of [-1,1]){const t=blade(dark,.11,.025,body);t.position.set(s*.013,.085,-.05);t.rotation.set(-2,0,s*.12);}

 root.userData.leftWing=root.getObjectByName('leftWing');root.userData.rightWing=root.getObjectByName('rightWing');root.userData.body=body;root.userData.animationNotes='Body tilt around local X; opposite wing Z rotations; root hop translation.';
 for(const s of [-1,1]){rod(copper,[s*.025,.045,.025],[s*.025,0,.045],.006);rod(copper,[s*.025,.005,.045],[s*.025,.003,.08],.005);ell(dark,s*.036,.163,.086,.006,.006,.006,body);}
 const beak=mesh(new T.ConeGeometry(.015,.05,5),copper,0,.15,.117,body);beak.rotation.x=Math.PI/2;

 root.name="bird candidate b"; root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),center=bounds.getCenter(new T.Vector3());for(const child of root.children){child.position.x-=center.x;child.position.y-=bounds.min.y;child.position.z-=center.z;}root.updateMatrixWorld(true);const size=bounds.getSize(new T.Vector3()),uniform=0.25/(size.z);for(const child of root.children){child.position.multiplyScalar(uniform);child.scale.multiplyScalar(uniform);}root.updateMatrixWorld(true);
 // Batch only rigid siblings. Body and wing groups retain their authored pivots,
 // so the flock's tilt, hop and opposite wing rotations remain independent.
 for(const parent of [root,body,root.userData.leftWing,root.userData.rightWing]){
  const buckets=new Map();for(const o of parent.children){if(!o.isMesh)continue;if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(o);}
  for(const [material,nodes] of buckets){if(nodes.length<2)continue;const data={position:[],normal:[],uv:[]};
   for(const o of nodes){o.updateMatrix();const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrix);for(const name of Object.keys(data))for(const value of geo.attributes[name].array)data[name].push(value);geo.dispose();}
   const geo=new T.BufferGeometry();for(const [name,values] of Object.entries(data))geo.setAttribute(name,new T.Float32BufferAttribute(values,name==='uv'?2:3));
   const merged=new T.Mesh(geo,material);merged.castShadow=nodes.some(o=>o.castShadow);merged.receiveShadow=nodes.some(o=>o.receiveShadow);parent.add(merged);
   for(const o of nodes){parent.remove(o);o.geometry.dispose();}
  }
 }
 root.updateMatrixWorld(true);return root;
}
