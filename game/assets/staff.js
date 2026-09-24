export default function (T) {
  const g=new T.Group();
  const mat=(c,n='plaster',r=.9)=>{const m=new T.MeshStandardMaterial({color:c,roughness:r});m.name=n;return m;};
  const ivory=mat(0xE7DDC2), light=mat(0xFFF0C9), copper=mat(0xB76F48,'metal',.62), copperDark=mat(0x704337,'metal'), wood=mat(0x977557,'timber'), bark=mat(0x704F40,'timber'), leaf=mat(0x3F7860,'foliage'), leafLight=mat(0x90AE68,'foliage'), deep=mat(0x183E3D,'foliage'), teal=mat(0x62C9BC,'plaster');
  function mesh(parent,geo,material,x=0,y=0,z=0){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function ell(parent,m,x,y,z,a,b,c){const o=mesh(parent,new T.SphereGeometry(1,12,8),m,x,y,z);o.scale.set(a,b,c);return o;}
  function cyl(parent,m,x,y,z,rt,rb,h,n=12){return mesh(parent,new T.CylinderGeometry(rt,rb,h,n),m,x,y,z);}
  function beam(parent,m,a,b,r){const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);const mid=va.clone().add(vb).multiplyScalar(.5);const o=cyl(parent,m,mid.x,mid.y,mid.z,r*.85,r,d.length(),8);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
  function ring(parent,m,x,y,z,r,t,axis='z'){const o=mesh(parent,new T.TorusGeometry(r,t,6,24),m,x,y,z);if(axis==='y')o.rotation.x=Math.PI/2;return o;}
  beam(g,wood,[0,.025,0],[0,1.12,0],.020);
  for(let i=0;i<3;i++)cyl(g,copper,0,.35+i*.03,0,.026,.026,.016,10);
  ring(g,copper,0,1.165,0,.095,.015);
  // Hollow bell is a lathed shell with a visible interior and clapper.
  const pts=[];for(let i=0;i<=8;i++){const t=i/8;pts.push(new T.Vector2(.033+.063*t*t,.99-.15*t));}
  const bellmat=copper.clone();bellmat.side=T.DoubleSide;
  mesh(g,new T.LatheGeometry(pts,16),bellmat,0,0,.025);
  ring(g,copperDark,0,.84,.025,.097,.009,'y');ell(g,copperDark,0,.841,.025,.018,.025,.018);
  ell(g,copper,0,1.02,.025,.028,.020,.028);
  // R-hero staff: twisted grain, a leather grip wrap, and small chimes hanging by the bell.
  const helix=(ph,m,r0)=>{const pts=[];for(let i=0;i<=40;i++){const t=i/40,y=.44+t*.66,a=ph+t*Math.PI*7;pts.push(new T.Vector3(Math.cos(a)*.019,y,Math.sin(a)*.019));}mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(pts),36,r0,4,false),m);};
  helix(0,bark,.0065);helix(Math.PI,bark,.005);
  const wrap=mat(0x6E5140,'fabric');for(let i=0;i<6;i++)ring(g,wrap,0,.3+i*.022,0,.023,.006,'y');
  for(const [x,z,l] of [[.06,.02,.07],[-.055,.03,.055],[.01,-.05,.062]]){cyl(g,copper,x,1.075-l/2-.02,z,.005,.005,l,8);beam(g,copperDark,[x,1.075,z],[x*.4,1.12,z*.4],.0015);}
  g.userData.gripY=.39;

  g.updateMatrixWorld(true);const box=new T.Box3(),v=new T.Vector3();g.traverse(n=>{if(n.isMesh){const a=n.geometry.attributes.position;for(let i=0;i<a.count;i++)box.expandByPoint(v.fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld));}});const c=box.getCenter(new T.Vector3());for(const n of g.children){n.position.x-=c.x;n.position.y-=box.min.y;n.position.z-=c.z;}return g;
}
