export default function(T){

 const root=new T.Group();
 const mat=(color,name='timber',roughness=.9)=>{const m=new T.MeshStandardMaterial({color,roughness,side:T.DoubleSide});m.name=name;return m;};
 const wood=mat(0x715140),woodLight=mat(0x9B7657),bark=mat(0x5A5040),ivory=mat(0xE7DDC2,'plaster'),stone=mat(0x929884,'stone'),copper=mat(0xB76F48,'metal',.55),patina=mat(0x629082,'metal',.7),dark=mat(0x253C38,'timber'),leaf=mat(0x4e785e,'foliage'),leafLight=mat(0x72946b,'foliage'),leafDark=mat(0x3f6a57,'foliage'),coral=mat(0xD96956,'foliage'),teal=mat(0x62C9BC,'foliage'),rope=mat(0xB49E77,'fabric');
 const mesh=(geo,m,x=0,y=0,z=0,parent=root)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 const box=(m,x,y,z,w,h,d,parent=root)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,parent);
 const ell=(m,x,y,z,a,b,c,parent=root)=>{const o=mesh(new T.SphereGeometry(1,8,6),m,x,y,z,parent);o.scale.set(a,b,c);return o;};
 const rod=(m,a,b,r1,r2=r1,parent=root,n=8)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);const o=mesh(new T.CylinderGeometry(r2,r1,d.length(),n),m,0,0,0,parent);o.position.copy(va.add(vb).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;};
 const curve=(m,points,r=.08,taper=.7,parent=root,segments=16,sides=7)=>{const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const g=new T.TubeGeometry(path,segments,r,sides,false),a=g.attributes.position,v=new T.Vector3();for(let i=0;i<=segments;i++){const center=path.getPointAt(i/segments);const scale=1-(1-taper)*i/segments;for(let j=0;j<=sides;j++){const k=i*(sides+1)+j;v.fromBufferAttribute(a,k).sub(center).multiplyScalar(scale).add(center);a.setXYZ(k,v.x,v.y,v.z);}}g.computeVertexNormals();const first=points[0],last=points[points.length-1];ell(m,...first,r,r*.6,r,parent);ell(m,...last,r*taper,r*taper*.6,r*taper,parent);return mesh(g,m,0,0,0,parent);};
 const shape=(m,points,depth,x=0,y=0,z=0,parent=root,bevel=.02)=>{const s=new T.Shape();points.forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));s.closePath();return mesh(new T.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,steps:1}),m,x,y,z,parent);};
 const blade=(m,length=.3,width=.10,parent=root)=>{const s=new T.Shape();s.moveTo(0,0);s.bezierCurveTo(width*.5,length*.02,width*.9,length*.18,width*.71,length*.40);s.bezierCurveTo(width*1.06,length*.48,width*.86,length*.80,width*.38,length*.82);s.quadraticCurveTo(0,length*1.13,-width*.30,length*.87);s.bezierCurveTo(-width*.72,length*.98,-width,length*.67,-width*.76,length*.50);s.bezierCurveTo(-width*1.04,length*.26,-width*.53,length*.04,0,0);const g=new T.ShapeGeometry(s,4);const a=g.attributes.position;for(let i=0;i<a.count;i++){const y=a.getY(i),x=a.getX(i);a.setZ(i,Math.sin(y/length*Math.PI)*width*.28-(x/width)**2*width*.08);}g.computeVertexNormals();return mesh(g,m,0,0,0,parent);};
 const ring=(m,x,y,z,r,t=.03,parent=root)=>mesh(new T.TorusGeometry(r,t,5,16),m,x,y,z,parent);
 const pot=(x,y,z,size=.3,m=copper)=>{const pts=[[.48,0],[.65,.15],[.70,.6],[.46,.85],[.45,1]].map(([r,h])=>new T.Vector2(r*size,h*size));const o=mesh(new T.LatheGeometry(pts,10),m,x,y,z);ring(m,x,y+size,z,size*.45,.025).rotation.x=Math.PI/2;return o;};
 const leafSpray=(x,y,z,angle,count=9,size=.8,parent=root)=>{const g=new T.Group();g.position.set(x,y,z);g.rotation.y=angle;parent.add(g);for(let i=0;i<count;i++){const a=i*2.39996;const r=Math.sqrt(i/count)*size*.74;const l=blade(i%7===0?leafLight:i%3===1?leafDark:leaf,size*(.88+(i%3)*.12),size*.56,g);l.position.set(Math.cos(a)*r,Math.sin(a*1.7)*size*.10,Math.sin(a)*r);l.rotation.set(-1.40+Math.sin(a)*.18,Math.cos(a*1.3)*.12,a);}return g;};


 // Broad swept trunk with two strong elbows and long sheltering lateral limbs.
 // One closed continuous trunk surface, with six unequal basal buttresses.
 const trunkPath=new T.CatmullRomCurve3([[-.8,0,0],[-.8,.9,0],[-.6,3,.15],[.25,5.5,0],[1,8,-.3],[.65,11,-.5],[1.4,13,-.6]].map(p=>new T.Vector3(...p)));
 const levels=[0,.035,.10,.22,.40,.65,.95,1.30,1.75,2.2,2.7];for(let y=3.2;y<13;y+=.4)levels.push(y);levels.push(13);
 const sides=48,positions=[],uvs=[],indices=[];
 for(let i=0;i<levels.length;i++){
  const y=levels[i];let lo=0,hi=1;for(let k=0;k<24;k++){const mid=(lo+hi)/2;if(trunkPath.getPoint(mid).y<y)lo=mid;else hi=mid;}const center=trunkPath.getPoint((lo+hi)/2);
  const shaft=1.07*(1-.90*y/13);const flare=Math.pow(Math.max(0,1-y/2.25),2.5);
  for(let j=0;j<=sides;j++){
   const angle=j/sides*Math.PI*2;let lobes=0;
   for(let k=0;k<6;k++){const axis=k*Math.PI/3+.11*Math.sin(k*2.3),alignment=Math.max(0,Math.cos(angle-axis));lobes+=Math.pow(alignment,24)*(2.55+.36*Math.sin(k*1.9));}
   const radius=shaft+flare*lobes;
   positions.push(center.x+Math.cos(angle)*radius,y,center.z+Math.sin(angle)*radius*(1-.18*flare));
   // Tube-compatible UV: first coordinate follows growth, second wraps circumference.
   uvs.push(y/13,j/sides);
   if(i<levels.length-1&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
 }
 const bottom=positions.length/3;positions.push(-.8,0,0);uvs.push(0,.5);const top=positions.length/3;positions.push(1.4,13,-.6);uvs.push(1,.5);
 for(let j=0;j<sides;j++){indices.push(bottom,j,j+1);const a=(levels.length-1)*(sides+1)+j;indices.push(top,a+1,a);}
 const trunkGeometry=new T.BufferGeometry();trunkGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));trunkGeometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));trunkGeometry.setIndex(indices);trunkGeometry.computeVertexNormals();
 // Average duplicated seam normals so the continuous wrap has no lighting seam.
 const normals=trunkGeometry.attributes.normal;for(let i=0;i<levels.length;i++){const a=i*(sides+1),b=a+sides,n=new T.Vector3().fromBufferAttribute(normals,a).add(new T.Vector3().fromBufferAttribute(normals,b)).normalize();normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);}mesh(trunkGeometry,bark);

 curve(wood,[[-.5,3.2,0],[-1.7,5,0],[-3.5,6,-.4],[-5.5,6.3,-1]],.57,.10,root,19);
 curve(bark,[[.3,6,-.3],[2.1,7.2,.4],[3.3,9,1.3],[5,9.4,1.7]],.46,.08,root,19);

 const clusters=[[-5.2,6.8,-.9],[-3.5,7.4,-.4],[-2,8.4,.5],[4.7,9.8,1.6],[3,10.5,1],[.7,12.2,-.5],[1.6,13.1,-.6],[-1.4,10.5,-1.5]];
 clusters.forEach(([x,y,z],i)=>{curve(bark,[[i<3?-1:.8,i<3?5.4:9,-.3],[x*.7,y-.5,z*.7],[x,y,z]],.22,.1,root,10);for(let k=0;k<7;k++){const a=k*2.399;leafSpray(x+Math.cos(a)*1.10,y+Math.sin(a*1.6)*.27,z+Math.sin(a)*.92,a,8,.97);}});
 for(let i=0;i<8;i++)leafSpray(-.8+Math.sin(i)*.7,.3+Math.cos(i)*.2,Math.cos(i)*.9,i,6,.35);

 root.name="tree unified buttress candidate"; root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),center=bounds.getCenter(new T.Vector3());for(const child of root.children){child.position.x-=center.x;child.position.y-=bounds.min.y;child.position.z-=center.z;}root.updateMatrixWorld(true);const size=bounds.getSize(new T.Vector3()),uniform=14/(size.y);for(const child of root.children){child.position.multiplyScalar(uniform);child.scale.multiplyScalar(uniform);}root.updateMatrixWorld(true);return root;
}