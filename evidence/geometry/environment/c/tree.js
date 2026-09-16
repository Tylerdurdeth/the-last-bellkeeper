export default function (T) {
  const g=new T.Group();
  const mat=(c,n='plaster',r=.9)=>{const m=new T.MeshStandardMaterial({color:c,roughness:r});m.name=n;return m;};
  const ivory=mat(0xE7DDC2), light=mat(0xFFF0C9), copper=mat(0xB76F48,'metal',.62), copperDark=mat(0x704337,'metal'), wood=mat(0x977557,'timber'), bark=mat(0x704F40,'timber'), leaf=mat(0x3F7860,'foliage'), leafLight=mat(0x90AE68,'foliage'), deep=mat(0x183E3D,'foliage'), teal=mat(0x62C9BC,'plaster');
  function mesh(parent,geo,material,x=0,y=0,z=0){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function ell(parent,m,x,y,z,a,b,c){const o=mesh(parent,new T.SphereGeometry(1,12,8),m,x,y,z);o.scale.set(a,b,c);return o;}
  function cyl(parent,m,x,y,z,rt,rb,h,n=12){return mesh(parent,new T.CylinderGeometry(rt,rb,h,n),m,x,y,z);}
  function beam(parent,m,a,b,r){const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);const mid=va.clone().add(vb).multiplyScalar(.5);const o=cyl(parent,m,mid.x,mid.y,mid.z,r*.85,r,d.length(),8);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
  function ring(parent,m,x,y,z,r,t,axis='z'){const o=mesh(parent,new T.TorusGeometry(r,t,6,24),m,x,y,z);if(axis==='y')o.rotation.x=Math.PI/2;return o;}
  // Sculpted living tree: broad roots, curved segmented trunk and intentional canopy tiers.
  ell(g,bark,0,1.7,0,.72,1.7,.62);ell(g,wood,-.28,3.2,-.04,.49,1.55,.43);
  beam(g,bark,[0,1.8,0],[-.50,4.8,.10],.42);
  for(let i=0;i<7;i++){const t=i*Math.PI*2/7;const x=Math.cos(t),z=Math.sin(t);beam(g,bark,[x*.2,.7,z*.2],[x*1.75,.11,z*1.48],.19);ell(g,bark,x*1.40,.12,z*1.2,.55,.13,.37);}
  for(let i=0;i<8;i++){const a=i*2.399;const x=Math.cos(a)*(1.7+(i%2)*.5),z=Math.sin(a)*1.65,y=4.2+(i%3)*.56;beam(g,bark,[-.3,2.8+i*.16,0],[x,y,z],.16);ell(g,i%3?leaf:deep,x,y+.3,z,1.26,.69,1.03);ell(g,leafLight,x-.14,y+.64,z-.08,.81,.35,.73);}
  ell(g,leaf,-.25,6.0,0,1.47,.70,1.35);ell(g,leafLight,-.5,6.43,-.1,.98,.36,.9);
  for(let i=0;i<4;i++)ell(g,deep,-.59,1.2+i*.59,.24,.13,.28,.07);

  g.updateMatrixWorld(true);const box=new T.Box3(),v=new T.Vector3();g.traverse(n=>{if(n.isMesh){const a=n.geometry.attributes.position;for(let i=0;i<a.count;i++)box.expandByPoint(v.fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld));}});const c=box.getCenter(new T.Vector3());for(const n of g.children){n.position.x-=c.x;n.position.y-=box.min.y;n.position.z-=c.z;}return g;
}
