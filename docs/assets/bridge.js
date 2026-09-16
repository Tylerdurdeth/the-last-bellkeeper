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


 for(let i=0;i<16;i++){const z=-2.5+i/15*5,y=.25-.16*Math.cos(z/2.5*Math.PI/2);const o=box(i%3?woodLight:wood,Math.sin(i*4)*.04,y,z,2.35,.13,.285);o.rotation.z=Math.sin(i*3)*.025;}
 for(const x of [-1.03,1.03]){curve(wood,[[x,.23,-2.5],[x,.05,0],[x,.23,2.5]],.075,1);for(const z of [-2.5,-.9,.9,2.5]){rod(wood,[x,.12,z],[x,1.25,z],.055,.04);ring(rope,x,1.1,z,.063,.018).rotation.x=Math.PI/2;}curve(rope,[[x,1.18,-2.5],[x,.98,-1.7],[x,1.18,-.9],[x,.96,0],[x,1.18,.9],[x,.98,1.7],[x,1.18,2.5]],.032,1,root,28,5);}

 root.name="bridge candidate a"; root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),center=bounds.getCenter(new T.Vector3());for(const child of root.children){child.position.x-=center.x;child.position.y-=bounds.min.y;child.position.z-=center.z;}root.updateMatrixWorld(true);const size=bounds.getSize(new T.Vector3()),uniform=5/(size.z);for(const child of root.children){child.position.multiplyScalar(uniform);child.scale.multiplyScalar(uniform);}root.updateMatrixWorld(true);return root;
}
