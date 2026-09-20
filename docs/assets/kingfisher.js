// Atlas woodland-r09: a/kingfisher. Independent construction candidate.
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

  // A: compact ellipsoid bird with layered wing feathers and a long tapered bill.
  const blue=material(0x277e85,'fabric'),light=material(0x65aba4,'fabric'),orange=material(0xbd703e,'fabric'),cream=material(0xe2cd9f,'fabric'),dark=material(0x34352f),eye=material(0x121c1d);
  egg(blue,[0,.16,-.015],[.085,.11,.075]);egg(orange,[0,.155,.037],[.073,.09,.051]);const head=joint('head',[0,.27,.012]);egg(blue,[0,0,0],[.08,.065,.071],head);
  rod([0,-.006,.047],[0,-.014,.178],.023,dark,head,0);rod([0,-.014,.049],[0,-.017,.17],.008,cream,head,0);
  for(const s of [-1,1]){egg(orange,[s*.060,-.018,.032],[.018,.015,.037],head);egg(cream,[s*.06,-.038,.015],[.027,.013,.036],head);egg(eye,[s*.065,.002,.055],[.013,.014,.01],head);egg(cream,[s*.07,.006,.06],[.004,.004,.004],head);const w=egg(blue,[s*.069,.169,-.022],[.025,.072,.055]);w.rotation.x=-.35;for(let j=0;j<5;j++){const f=egg(j%2?light:blue,[s*(.089-j*.001),.205-j*.02,-.011-j*.007],[.007,.018,.020]);f.rotation.x=-.35;}rod([s*.031,.075,0],[s*.031,.014,.03],.006,orange);for(let j=-1;j<=1;j++)rod([s*.031,.014,.03],[s*.031+j*.011,.006,.058],.004,dark);}
  for(let j=-1;j<=1;j++){const t=egg(blue,[j*.015,.088,-.098],[.013,.015,.064]);t.rotation.x=-.4;}
  egg(cream,[0,.227,.067],[.034,.02,.016]);
  for(let j=0;j<12;j++){const a=j*2.399,r=.02+.028*(j%3)/3;low(light,[Math.cos(a)*r,.322-(r*.2),.012+Math.sin(a)*r],[.008,.003,.01]);}
  return finish('kingfisher',.35);
}
