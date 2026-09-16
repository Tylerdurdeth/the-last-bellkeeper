export default function (T) {
  const g=new T.Group();
  const mat=(c,n='plaster',r=.9)=>{const m=new T.MeshStandardMaterial({color:c,roughness:r});m.name=n;return m;};
  const ivory=mat(0xE7DDC2), light=mat(0xFFF0C9), copper=mat(0xB76F48,'metal',.62), copperDark=mat(0x704337,'metal'), wood=mat(0x977557,'timber'), bark=mat(0x704F40,'timber'), leaf=mat(0x3F7860,'foliage'), leafLight=mat(0x90AE68,'foliage'), deep=mat(0x183E3D,'foliage'), teal=mat(0x62C9BC,'plaster');
  function mesh(parent,geo,material,x=0,y=0,z=0){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function ell(parent,m,x,y,z,a,b,c){const o=mesh(parent,new T.SphereGeometry(1,12,8),m,x,y,z);o.scale.set(a,b,c);return o;}
  function cyl(parent,m,x,y,z,rt,rb,h,n=12){return mesh(parent,new T.CylinderGeometry(rt,rb,h,n),m,x,y,z);}
  function beam(parent,m,a,b,r){const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);const mid=va.clone().add(vb).multiplyScalar(.5);const o=cyl(parent,m,mid.x,mid.y,mid.z,r*.85,r,d.length(),8);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
  function ring(parent,m,x,y,z,r,t,axis='z'){const o=mesh(parent,new T.TorusGeometry(r,t,6,24),m,x,y,z);if(axis==='y')o.rotation.x=Math.PI/2;return o;}
  // Seedwheel is interpreted: the reference mechanism is obscured.
  for(const s of [-1,1]){ell(g,ivory,s*.78,.12,0,.24,.12,.34);beam(g,ivory,[s*.78,.20,0],[s*.70,1.15,0],.115);ell(g,copperDark,s*.70,1.13,0,.15,.15,.15);}
  beam(g,copperDark,[-.83,1.13,0],[.83,1.13,0],.065);
  const rotor=new T.Group();rotor.position.set(0,1.13,.13);g.add(rotor);g.userData.rotor=rotor;
  ring(rotor,copper,0,0,0,.835,.06);ring(rotor,copperDark,0,0,-.05,.715,.022);
  ell(rotor,ivory,0,0,0,.18,.18,.12);ell(rotor,teal,0,0,.115,.085,.085,.025);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const x=Math.cos(a),y=Math.sin(a);beam(rotor,wood,[x*.14,y*.14,0],[x*.78,y*.78,0],.034);const seed=ell(rotor,ivory,x*.57,y*.57,.015,.105,.23,.066);seed.rotation.z=a-Math.PI/2+.40;}
  g.userData.interpretation='Original functional seedwheel inferred from partially obscured reference; not an exact reconstruction.';

  g.updateMatrixWorld(true);const box=new T.Box3(),v=new T.Vector3();g.traverse(n=>{if(n.isMesh){const a=n.geometry.attributes.position;for(let i=0;i<a.count;i++)box.expandByPoint(v.fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld));}});const c=box.getCenter(new T.Vector3());for(const n of g.children){n.position.x-=c.x;n.position.y-=box.min.y;n.position.z-=c.z;}return g;
}
