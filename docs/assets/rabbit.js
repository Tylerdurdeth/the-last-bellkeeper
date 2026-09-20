// Atlas woodland-r09: a/rabbit. Independent construction candidate.
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

  // A: seated rabbit assembled from ellipsoids; true ear-root and neck pivots.
  const fur=material(0xad6d3e,'fabric'),cream=material(0xe4cda0,'fabric'),pink=material(0xc59179,'fabric'),eye=material(0x201e18),shine=material(0xffefc9);
  egg(fur,[0,.22,-.03],[.15,.21,.16]);egg(cream,[0,.25,.107],[.095,.13,.06]);
  for(const s of [-1,1]){egg(fur,[s*.11,.13,-.045],[.095,.12,.12]);egg(cream,[s*.1,.035,.1],[.057,.035,.092]);egg(fur,[s*.065,.13,.12],[.039,.11,.035]);}
  egg(cream,[0,.16,-.18],[.066,.07,.062]);
  const head=joint('head',[0,.37,.075]);egg(fur,[0,0,0],[.105,.115,.105],head);
  egg(cream,[0,-.045,.08],[.075,.047,.06],head);
  egg(pink,[0,-.023,.13],[.023,.016,.018],head);
  const ears=joint('ears',[0,.075,-.018],head);
  for(const s of [-1,1]){const ear=joint(s<0?'leftEar':'rightEar',[s*.052,0,0],ears);ear.rotation.z=-s*.22;egg(fur,[0,.11,0],[.034,.13,.028],ear);egg(pink,[0,.115,.022],[.020,.099,.008],ear);egg(cream,[s*.073,.025,.068],[.029,.036,.016],head);egg(eye,[s*.077,.027,.079],[.019,.026,.010],head);egg(shine,[s*.077-.004,.036,.088],[.006,.007,.004],head);}
  root.userData.jointNames=['head','ears','leftEar','rightEar'];
  return finish('rabbit',.6);
}
