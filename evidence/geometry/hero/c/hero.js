export default function (THREE) {
  const root = new THREE.Group();
  root.name = 'Bellkeeper sculpted apprentice';
  const joints = {}; root.userData.joints = joints;
  const mat = (color, name='fabric', roughness=.9) => { const m=new THREE.MeshStandardMaterial({color,roughness}); m.name=name; return m; };
  const coral=mat(0xD96956), shade=mat(0xB74F44), cream=mat(0xE7DDC2), dark=mat(0x593F46), hair=mat(0x392F3B), skin=mat(0xBD8A6C,'plaster'), nose=mat(0xCA9675,'plaster'), teal=mat(0x62C9BC), copper=mat(0xB76F48,'metal',.6), sole=mat(0x3B3037), eyes=mat(0x201F2A,'plaster'), white=mat(0xFFF0C9,'plaster');
  function pivot(name,parent,x,y,z) {const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);joints[name]=g;return g;}
  function ell(parent,material,x,y,z,sx,sy,sz,rz=0) {const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.z=rz;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function panel(parent,material,points,depth,x,y,z,rot=0) {
    const s=new THREE.Shape();points.forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1]));s.closePath();
    const geo=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,steps:1,curveSegments:4});
    const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.rotation.z=rot;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const hips=pivot('hips',root,0,.67,0);
  ell(hips,dark,0,0,0,.155,.10,.106);
  ell(hips,coral,0,.145,0,.18,.225,.116,-.035);
  // Two sculpted skirts overlap the torso but pivot independently at the belt.
  const cl=pivot('coatLeft',hips,-.085,-.015,0), cr=pivot('coatRight',hips,.085,-.015,0);
  panel(cl,coral,[[-.062,.07],[.065,.045],[.052,-.21],[-.10,-.30],[-.13,-.20]],.055,0,0,.045,-.07);
  panel(cr,shade,[[-.065,.045],[.063,.06],[.115,-.25],[.035,-.31],[-.049,-.22]],.055,0,0,.045,.07);
  // Rear split coat tails give a complete silhouette without a solid skirt.
  panel(cl,shade,[[-.065,.04],[.06,.03],[.052,-.265],[-.083,-.24]],.04,0,0,-.117);
  panel(cr,coral,[[-.06,.03],[.065,.04],[.083,-.24],[-.052,-.265]],.04,0,0,-.117);
  // Rounded side gores join front and rear panels; no floating coat plates in profile.
  ell(cl,coral,-.075,-.11,-.005,.040,.15,.096,-.14);
  ell(cr,shade,.075,-.11,-.005,.040,.15,.096,.14);
  ell(hips,dark,0,.015,.008,.169,.025,.121);
  ell(hips,copper,.06,.019,.123,.022,.023,.010);
  // Broad asymmetric ivory collar is readable above the coral chest.
  panel(hips,cream,[[-.155,.31],[-.06,.32],[.035,.245],[-.032,.13]],.025,0,0,.097);
  panel(hips,cream,[[.06,.32],[.155,.295],[.065,.185],[-.01,.225]],.025,0,0,.097);
  ell(hips,teal,.041,.154,.132,.022,.025,.013);
  ell(hips,teal,.041,.095,.129,.014,.014,.011);
  // Small rear yoke and copper loop give the back an authored construction.
  panel(hips,cream,[[-.12,.30],[.12,.30],[.10,.245],[-.10,.245]],.015,0,0,-.122);
  ell(hips,copper,0,.18,-.12,.018,.022,.010);
  const head=pivot('head',hips,0,.335,0);
  ell(head,skin,0,.005,0,.055,.07,.057);
  ell(head,skin,0,.155,.012,.142,.162,.118);
  ell(head,skin,-.143,.15,.012,.025,.044,.035);
  ell(head,skin,.143,.15,.012,.025,.044,.035);
  ell(head,nose,0,.132,.125,.023,.032,.026);
  for (const side of [-1,1]) {
    ell(head,white,side*.058,.174,.114,.035,.021,.010,-side*.09);
    ell(head,eyes,side*.054,.174,.124,.014,.017,.006);
    ell(head,hair,side*.060,.211,.112,.044,.012,.012,-side*.12);
  }
  ell(head,dark,.005,.077,.117,.031,.007,.006,-.06);
  // Hair uses few swept sculptural locks, avoiding a helmet or spiky crown.
  ell(head,hair,0,.224,-.022,.151,.115,.126);
  ell(head,hair,-.083,.267,.058,.097,.054,.080,-.48);
  ell(head,hair,.051,.275,.052,.117,.049,.084,-.30);
  ell(head,hair,.120,.23,.056,.047,.087,.055,.45);
  ell(head,hair,-.134,.15,-.025,.033,.086,.073,-.17);
  for (const side of [-1,1]) {
    const prefix=side<0?'left':'right';
    const thigh=pivot(prefix+'UpperLeg',hips,side*.085,-.055,0);
    ell(thigh,dark,0,-.105,0,.069,.14,.070);
    const shin=pivot(prefix+'LowerLeg',thigh,0,-.23,0);
    ell(shin,dark,0,-.095,-.002,.052,.116,.055);
    ell(shin,teal,0,-.15,.009,.049,.046,.054);
    const foot=pivot(prefix+'Foot',shin,0,-.205,.005);
    ell(foot,sole,0,-.036,.04,.065,.027,.103);
    ell(foot,dark,0,-.012,.038,.064,.049,.098);
    ell(foot,copper,0,.02,.090,.028,.029,.015);
    const arm=pivot(prefix+'UpperArm',hips,side*.166,.252,0);
    arm.rotation.z=side*.13;
    ell(arm,coral,side*.025,-.086,0,.069,.125,.068,-side*.08);
    const fore=pivot(prefix+'LowerArm',arm,side*.035,-.181,.008);
    fore.rotation.x=-.16;
    ell(fore,coral,0,-.061,0,.053,.087,.054);
    ell(fore,teal,0,-.121,0,.053,.031,.054);
    const hand=pivot(prefix+'Hand',fore,0,-.159,.004);
    ell(hand,skin,0,-.028,.009,.039,.047,.028);
    ell(hand,skin,-side*.034,-.01,.021,.018,.027,.021,-side*.4);
  }
  const grip=new THREE.Group();grip.name='staffGrip';grip.position.set(0,-.027,.04);joints.rightHand.add(grip);root.userData.grip=grip;
  // Measure transformed vertices; keep every articulation pivot intact.
  root.updateMatrixWorld(true);let box=new THREE.Box3();const v=new THREE.Vector3();
  root.traverse(n=>{if(n.isMesh){const a=n.geometry.attributes.position;for(let i=0;i<a.count;i++)box.expandByPoint(v.fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld));}});
  const scale=1.35/(box.max.y-box.min.y);root.scale.setScalar(scale);
  const center=box.getCenter(new THREE.Vector3());hips.position.x-=center.x;hips.position.y-=box.min.y;hips.position.z-=center.z;
  root.userData.animationNotes='Load keepHierarchy; staff attaches to rightHand staffGrip. Cloth pivots at belt. Bind pose only; motion requires review.';
  return root;
}
