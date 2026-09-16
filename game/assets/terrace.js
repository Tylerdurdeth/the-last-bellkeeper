export default function (T) {
  const g=new T.Group();
  const mat=(c,n='plaster',r=.9)=>{const m=new T.MeshStandardMaterial({color:c,roughness:r});m.name=n;return m;};
  const ivory=mat(0xE7DDC2), light=mat(0xFFF0C9), copper=mat(0xB76F48,'metal',.62), copperDark=mat(0x704337,'metal'), wood=mat(0x977557,'timber'), bark=mat(0x704F40,'timber'), leaf=mat(0x3F7860,'foliage'), leafLight=mat(0x90AE68,'foliage'), deep=mat(0x183E3D,'foliage'), teal=mat(0x62C9BC,'plaster');
  function mesh(parent,geo,material,x=0,y=0,z=0){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function ell(parent,m,x,y,z,a,b,c){const o=mesh(parent,new T.SphereGeometry(1,12,8),m,x,y,z);o.scale.set(a,b,c);return o;}
  function cyl(parent,m,x,y,z,rt,rb,h,n=12){return mesh(parent,new T.CylinderGeometry(rt,rb,h,n),m,x,y,z);}
  function beam(parent,m,a,b,r){const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);const mid=va.clone().add(vb).multiplyScalar(.5);const o=cyl(parent,m,mid.x,mid.y,mid.z,r*.85,r,d.length(),8);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
  function ring(parent,m,x,y,z,r,t,axis='z'){const o=mesh(parent,new T.TorusGeometry(r,t,6,24),m,x,y,z);if(axis==='y')o.rotation.x=Math.PI/2;return o;}
  // Rounded carved platform with a front arrival gap and continuous safe rail elsewhere.
  const base=cyl(g,ivory,0,.275,0,1,1,.55,48);base.scale.set(7.4,1,5.75);
  const rim=cyl(g,copperDark,0,.50,0,1,1,.05,48);rim.scale.set(7.36,1,5.71);
  const deck=cyl(g,light,0,.535,0,1,1,.03,48);deck.scale.set(7.27,1,5.62);
  const n=36;for(let i=0;i<n;i++){const t=2*Math.PI*i/n,u=2*Math.PI*(i+1)/n;if(Math.sin(t)>.85||Math.sin(u)>.85)continue;
    const x=Math.cos(t)*7.08,z=Math.sin(t)*5.40,xx=Math.cos(u)*7.08,zz=Math.sin(u)*5.40;
    ell(g,ivory,x,.91,z,.085,.375,.085);beam(g,copper,[x,1.29,z],[xx,1.29,zz],.065);beam(g,ivory,[x,.87,z],[xx,.87,zz],.07);
  }
  // Repair: a curving paired-channel promenade replaces long parallel floor stripes.
  function channel(points,material,r){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(g,new T.TubeGeometry(curve,48,r,6,false),material);}
  for(const offset of [-.10,.10])channel([[-3.4,.58,1.3+offset],[-2.4,.58,2.0+offset],[-.7,.58,1.4+offset],[.7,.58,.4+offset],[2,.58,-.4+offset],[3.2,.58,-1.2+offset]],copper,.032);
  // Layered oval garden bank gives the living tree an architectural base.
  const garden=cyl(g,ivory,-3.35,.76,-2.45,1,1,.42,40);garden.scale.set(2.45,1,1.9);
  const soil=cyl(g,bark,-3.35,.977,-2.45,1,1,.02,40);soil.scale.set(2.30,1,1.75);
  const edging=ring(g,copper,-3.35,.985,-2.45,1,.025,'y');edging.scale.set(2.4,1.84,1);
  // Short radial timber seams and brackets echo the copper architecture without striping the walk route.
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2;beam(g,wood,[Math.cos(a)*6.7,.559,Math.sin(a)*5.1],[Math.cos(a)*7.1,.559,Math.sin(a)*5.4],.019);}
  // A carved paired arch sits behind the garden, visible through the foliage.
  for(const x of [-4.3,-2.4]){cyl(g,ivory,x,1.42,-3.8,.18,.24,1.75,12);ring(g,copper,x,2.26,-3.8,.20,.033,'y');}
  const arch=new T.CatmullRomCurve3([new T.Vector3(-4.3,2.2,-3.8),new T.Vector3(-3.35,2.85,-3.8),new T.Vector3(-2.4,2.2,-3.8)]);mesh(g,new T.TubeGeometry(arch,24,.14,8,false),ivory);

  g.userData.walkSurface=.55;g.userData.frontOpening='+Z';

  g.updateMatrixWorld(true);const box=new T.Box3(),v=new T.Vector3();g.traverse(n=>{if(n.isMesh){const a=n.geometry.attributes.position;for(let i=0;i<a.count;i++)box.expandByPoint(v.fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld));}});const c=box.getCenter(new T.Vector3());for(const n of g.children){n.position.x-=c.x;n.position.y-=box.min.y;n.position.z-=c.z;}return g;
}
