export default function (T) {
  const g=new T.Group();
  const mat=(c,n='plaster',r=.9)=>{const m=new T.MeshStandardMaterial({color:c,roughness:r});m.name=n;return m;};
  const ivory=mat(0xE7DDC2), light=mat(0xFFF0C9), copper=mat(0xB76F48,'metal',.62), copperDark=mat(0x704337,'metal'), wood=mat(0x977557,'timber'), bark=mat(0x704F40,'timber'), leaf=mat(0x3F7860,'foliage'), leafLight=mat(0x90AE68,'foliage'), deep=mat(0x183E3D,'foliage'), teal=mat(0x62C9BC,'plaster');
  function mesh(parent,geo,material,x=0,y=0,z=0){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function ell(parent,m,x,y,z,a,b,c){const o=mesh(parent,new T.SphereGeometry(1,12,8),m,x,y,z);o.scale.set(a,b,c);return o;}
  function cyl(parent,m,x,y,z,rt,rb,h,n=12){return mesh(parent,new T.CylinderGeometry(rt,rb,h,n),m,x,y,z);}
  function beam(parent,m,a,b,r){const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);const mid=va.clone().add(vb).multiplyScalar(.5);const o=cyl(parent,m,mid.x,mid.y,mid.z,r*.85,r,d.length(),8);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
  function ring(parent,m,x,y,z,r,t,axis='z'){const o=mesh(parent,new T.TorusGeometry(r,t,6,24),m,x,y,z);if(axis==='y')o.rotation.x=Math.PI/2;return o;}
  // Three carved distant towers with swept copper roofs, visible on every side.
  for(let i=0;i<3;i++){const x=(i-1)*1.12,h=i===1?3.08:2.23;
    cyl(g,ivory,x,h/2,0,.37,.47,h,12);ell(g,wood,x,.14,0,.56,.14,.51);
    cyl(g,copperDark,x,h*.69,0,.395,.395,.075,12);cyl(g,light,x,h-.03,0,.47,.40,.13,12);
    const roof=mesh(g,new T.ConeGeometry(.61,.70,12),copper,x,h+.35,0);roof.scale.z=.9;
    ell(g,copperDark,x,h+.73,0,.075,.11,.075);
    for(let j=0;j<4;j++){const a=j*Math.PI/2;const win=ell(g,deep,x+Math.cos(a)*.378,h*.65,Math.sin(a)*.378,.075,.21,.035);win.rotation.y=Math.PI/2-a;}
  }
  for(const s of [-1,1]){beam(g,copper,[-1.1,1.18,s*.23],[1.1,1.18,s*.23],.055);beam(g,ivory,[-1.1,1.01,s*.23],[1.1,1.01,s*.23],.09);}

  g.updateMatrixWorld(true);const box=new T.Box3(),v=new T.Vector3();g.traverse(n=>{if(n.isMesh){const a=n.geometry.attributes.position;for(let i=0;i<a.count;i++)box.expandByPoint(v.fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld));}});const c=box.getCenter(new T.Vector3());for(const n of g.children){n.position.x-=c.x;n.position.y-=box.min.y;n.position.z-=c.z;}return g;
}
