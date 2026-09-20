// Nine metre crossing: continuous plank support, narrow timber frame, sagging ropes.
export default function(T){
  const root=new T.Group();root.name='Nine metre woodland bridge';root.userData.keepHierarchy=true;
  const mat=(color,name)=>Object.assign(new T.MeshStandardMaterial({color,roughness:.9,side:T.DoubleSide}),{name});
  const timber=mat(0x715140,'timber'),light=mat(0x9b7657,'timber'),rope=mat(0xb49e77,'fabric');
  const deck=new T.Group();deck.name='bridge-deck';root.add(deck);
  function box(parent,m,x,y,z,w,h,d){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
  function rod(a,b,r,m){const va=new T.Vector3(...a),vb=new T.Vector3(...b),dir=vb.clone().sub(va),o=new T.Mesh(new T.CylinderGeometry(r,r,dir.length(),7),m);o.position.copy(va).add(vb).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());o.castShadow=o.receiveShadow=true;root.add(o);}
  const top=z=>.30-.14*Math.cos(z/4.5*Math.PI/2);
  const count=36,step=9/count;
  for(let i=0;i<count;i++){const z=-4.5+(i+.5)*step;box(deck,i%3?light:timber,0,top(z)-.06,z,2.35,.12,step);}
  for(const x of [-1.04,1.04]){
    for(let i=0;i<18;i++){const a=-4.4+i*8.8/18,b=-4.4+(i+1)*8.8/18;rod([x,top(a)-.16,a],[x,top(b)-.16,b],.055,timber);}
    for(const z of [-4.35,-2.2,0,2.2,4.35])rod([x,top(z)-.08,z],[x,top(z)+1.05,z],.05,timber);
    const points=[];for(let i=0;i<=64;i++){const z=-4.35+i*8.7/64;points.push(new T.Vector3(x,top(z)+.94+.11*Math.cos(z/2.175*Math.PI*2),z));}
    const o=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),64,.032,5,false),rope);o.castShadow=true;root.add(o);
  }
  // Measure transformed vertices, not rotated bounding boxes, before base normalisation.
  root.updateMatrixWorld(true);const bounds=new T.Box3(),v=new T.Vector3();
  root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)bounds.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));});
  const c=bounds.getCenter(new T.Vector3());for(const child of root.children)child.position.sub(new T.Vector3(c.x,bounds.min.y,c.z));
  root.updateMatrixWorld(true);
  // Batch rigid parts by material while retaining the independently raycast deck.
  function batch(parent){
    const inverse=parent.matrixWorld.clone().invert(),buckets=new Map();
    for(const o of [...parent.children]){if(!o.isMesh)continue;
      const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
      if(!buckets.has(o.material))buckets.set(o.material,{position:[],normal:[],uv:[]});const bucket=buckets.get(o.material);
      for(const name of ['position','normal','uv'])for(const value of geo.attributes[name].array)bucket[name].push(value);
      parent.remove(o);geo.dispose();o.geometry.dispose();
    }
    for(const [material,data] of buckets){const geo=new T.BufferGeometry();for(const name of ['position','normal','uv'])geo.setAttribute(name,new T.Float32BufferAttribute(data[name],name==='uv'?2:3));const o=new T.Mesh(geo,material);o.castShadow=o.receiveShadow=true;parent.add(o);}
  }
  batch(deck);batch(root);root.updateMatrixWorld(true);return root;
}
