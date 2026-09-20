// Atlas woodland-r09: b/luna-moth. Independent construction candidate.
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

  // B: scalloped wing silhouettes extruded to thin membranes with elongated tails.
  const wing=material(0xccd492),edge=material(0x96734e),body=material(0xb49762,'fabric'),spot=material(0x846447),cream=material(0xefe2b2);
  egg(body,[0,.014,0],[.008,.013,.048]);egg(cream,[0,.016,.039],[.012,.014,.013]);
  const fore=[[0,.025],[.032,.064],[.115,.091],[.16,.087],[.157,.05],[.136,.012],[.10,-.008],[.07,-.014],[.043,-.009],[.014,-.023],[0,0]];
  const hind=[[0,0],[.035,-.012],[.10,-.02],[.102,-.052],[.082,-.061],[.07,-.075],[.065,-.106],[.08,-.149],[.073,-.154],[.049,-.12],[.045,-.084],[.025,-.075],[.015,-.06],[0,-.052]];
  function membrane(points,s,g){const shape=new T.Shape(),n=points.length;const first=points[0],last=points[n-1];shape.moveTo(s*(first[0]+last[0])/2,(first[1]+last[1])/2);for(let i=0;i<n;i++){const p=points[i],q=points[(i+1)%n];shape.quadraticCurveTo(s*p[0],p[1],s*(p[0]+q[0])/2,(p[1]+q[1])/2);}shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.0025,bevelEnabled:false,curveSegments:3});const o=mesh(geo,wing,[0,.002,0],[1,1,1],g);o.rotation.x=Math.PI/2;const edgePoints=shape.getPoints(3).map(p=>[p.x,.003,p.y]);sweep(edgePoints,.0015,edge,g);}
  for(const s of [-1,1]){const g=joint(s<0?'leftWing':'rightWing',[s*.006,.013,0]);g.rotation.z=s*.27;for(const points of [fore,hind]){membrane(points,s,g);}
    for(const [x,z] of [[.073,.037],[.053,-.043]]){egg(spot,[s*x,.006,z],[.009,.0015,.011],g);egg(cream,[s*x,.008,z],[.005,.001,.007],g);}
    for(const [x,z] of [[.14,.077],[.14,.032],[.09,-.05],[.067,-.095]])rod([0,.004,0],[s*x,.004,z],.0009,edge,g);
    rod([s*.006,.02,.045],[s*.023,.025,.068],.002,body);for(let j=0;j<4;j++)rod([s*(.01+j*.003),.021+j*.001,.05+j*.004],[s*(.019+j*.003),.021+j*.001,.049+j*.004],.0008,body);
  }
  root.userData.jointNames=['leftWing','rightWing'];
  return finish('luna-moth',.35,'width');
}
