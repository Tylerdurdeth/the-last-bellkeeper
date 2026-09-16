export default function (T) {
  const g=new T.Group();
  const mat=(c,n='plaster',r=.9)=>{const m=new T.MeshStandardMaterial({color:c,roughness:r});m.name=n;return m;};
  const ivory=mat(0xE7DDC2), light=mat(0xFFF0C9), copper=mat(0xB76F48,'metal',.62), copperDark=mat(0x704337,'metal'), wood=mat(0x977557,'timber'), bark=mat(0x704F40,'timber'), leaf=mat(0x3F7860,'foliage'), leafLight=mat(0x90AE68,'foliage'), deep=mat(0x183E3D,'foliage'), teal=mat(0x62C9BC,'plaster');
  function mesh(parent,geo,material,x=0,y=0,z=0){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function ell(parent,m,x,y,z,a,b,c){const o=mesh(parent,new T.SphereGeometry(1,12,8),m,x,y,z);o.scale.set(a,b,c);return o;}
  function cyl(parent,m,x,y,z,rt,rb,h,n=12){return mesh(parent,new T.CylinderGeometry(rt,rb,h,n),m,x,y,z);}
  function beam(parent,m,a,b,r){const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);const mid=va.clone().add(vb).multiplyScalar(.5);const o=cyl(parent,m,mid.x,mid.y,mid.z,r*.85,r,d.length(),8);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
  function ring(parent,m,x,y,z,r,t,axis='z'){const o=mesh(parent,new T.TorusGeometry(r,t,6,24),m,x,y,z);if(axis==='y')o.rotation.x=Math.PI/2;return o;}
  ell(g,copperDark,0,.085,0,.15,.085,.15);ell(g,teal,0,.29,0,.12,.19,.12);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,x=Math.cos(a),z=Math.sin(a);beam(g,copper,[x*.08,.10,z*.08],[x*.155,.30,z*.155],.015);beam(g,copper,[x*.155,.30,z*.155],[x*.06,.48,z*.06],.015);}
  ell(g,ivory,0,.485,0,.10,.035,.10);ring(g,copper,0,.55,0,.037,.012);

  g.updateMatrixWorld(true);const box=new T.Box3(),v=new T.Vector3();g.traverse(n=>{if(n.isMesh){const a=n.geometry.attributes.position;for(let i=0;i<a.count;i++)box.expandByPoint(v.fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld));}});const c=box.getCenter(new T.Vector3());for(const n of g.children){n.position.x-=c.x;n.position.y-=box.min.y;n.position.z-=c.z;}return g;
}
