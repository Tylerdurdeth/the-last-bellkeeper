// Atlas woodland-r09: b/bramble. Independent construction candidate.
export default function generate(T) {
  const root=new T.Group();
  const material=(color,name='foliage')=>{const m=new T.MeshStandardMaterial({color,roughness:.9,side:T.DoubleSide});m.name=name;return m;};
  const mesh=(geo,mat,pos=[0,0,0],scale=[1,1,1],parent=root)=>{const o=new T.Mesh(geo,mat);o.position.set(...pos);o.scale.set(...scale);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
  const egg=(mat,pos,scale,parent=root)=>mesh(new T.SphereGeometry(1,10,7),mat,pos,scale,parent);
  const low=(mat,pos,scale,parent=root)=>mesh(new T.IcosahedronGeometry(1,0),mat,pos,scale,parent);
  const rod=(a,b,r,mat,parent=root,r2=r)=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const o=mesh(new T.CylinderGeometry(r2,r,d.length(),5),mat,av.add(bv).multiplyScalar(.5).toArray(),[1,1,1],parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;};
  const sweep=(points,r,mat,parent=root)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),12,r,5,false),mat,[0,0,0],[1,1,1],parent);
  const profile=(points,depth,mat,pos=[0,0,0],parent=root)=>{const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return mesh(new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1}),mat,pos,[1,1,1],parent);};
  const lathe=(points,mat,pos,scale=[1,1,1],parent=root)=>mesh(new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),12),mat,pos,scale,parent);
  // Curved, creased leaf: five transverse sections, a raised central rib.
  const leaf=(length,width,curl,mat,parent=root)=>{const p=[],idx=[];for(let i=0;i<=6;i++){const t=i/6,w=Math.pow(Math.sin(Math.PI*t),.75)*width;for(let j=-1;j<=1;j++)p.push(j*w,curl*Math.sin(t*Math.PI*.85)+Math.abs(j)*(-.12*width)*Math.sin(Math.PI*t),t*length);}for(let i=0;i<6;i++)for(let j=0;j<2;j++){const a=i*3+j;idx.push(a,a+3,a+1,a+1,a+3,a+4);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return mesh(g,mat,[0,0,0],[1,1,1],parent);};
  const joint=(name,pos,parent=root)=>{const g=new T.Group();g.name=name;g.position.set(...pos);parent.add(g);return g;};
  // Merge only rigid siblings. Named pivot groups survive intact.
  function compact(parent){for(const child of [...parent.children])if(child.isGroup)compact(child);const buckets=new Map();for(const o of parent.children)if(o.isMesh){const key=o.material; if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);}for(const [mat,list] of buckets){if(list.length<2)continue;const p=[],n=[];for(const o of list){o.updateMatrix();const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrix);p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);parent.remove(o);g.dispose();}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));mesh(g,mat,[0,0,0],[1,1,1],parent);}}
  function finish(name,size,axis='height',maxWidth=Infinity){root.name=name;root.updateMatrixWorld(true);const box=new T.Box3(),v=new T.Vector3();root.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)box.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));}});const dims=box.getSize(new T.Vector3()),s=size/(axis==='width'?dims.x:dims.y),xz=Math.min(s,maxWidth/dims.x);const center=box.getCenter(new T.Vector3());const wrapper=new T.Group();for(const o of [...root.children])wrapper.add(o);wrapper.position.set(-center.x*xz,-box.min.y*s,-center.z*xz);wrapper.scale.set(xz,s,xz);root.add(wrapper);compact(wrapper);root.userData.reference='woodland-r09.png';root.updateMatrixWorld(true);return root;}

  // B: swept thorn canes over a closed lobed core, with folded leaf clusters.
  const bark=material(0x46342f,'timber'),spine=material(0xd6c79b,'timber'),plum=material(0x69495d),green=material(0x626847),berry=material(0x99484e);
  egg(plum,[0,.39,0],[.70,.37,.61]);
  for(let i=0;i<6;i++){const a=i*Math.PI/6,points=[];for(let j=0;j<=6;j++){const t=j*Math.PI/6,r=.86*Math.cos(t);points.push([Math.cos(a)*r,.1+Math.sin(t)*(1.12+(i%2)*.14),Math.sin(a)*r+Math.sin(t)*Math.sin(i*2)*.18]);}sweep(points,.038,bark);for(let j=1;j<6;j++){const p=points[j];rod(p,[p[0]+.12*Math.cos(a+j),p[1]+.13,p[2]+.12*Math.sin(a+j)],.035,spine,root,0);}}
  for(let i=0;i<90;i++){const a=i*2.399,t=(i+.5)/90,y=.1+.78*t,r=.78*Math.sqrt(1-t*t);const l=leaf(.30,.12,.09,i%5?plum:green);l.position.set(Math.cos(a)*r,y,Math.sin(a)*r);l.rotation.set(-.15+.5*t,Math.PI/2-a,.35*Math.sin(i));if(i%9===0)low(berry,[Math.cos(a)*(r+.03),y+.055,Math.sin(a)*(r+.03)],[.047,.047,.047]);}
  return finish('bramble',1.6,'height',2);
}
