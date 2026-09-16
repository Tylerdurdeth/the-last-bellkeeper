export default function (THREE) {
  const g = new THREE.Group();
  const joints = {};
  const mat = (color, name, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness });
    m.name = name;
    return m;
  };
  const coral = mat('#D96956', 'fabric');
  const coralShade = mat('#AD4F49', 'fabric');
  const ivory = mat('#E7DDC2', 'fabric');
  const dark = mat('#593F46', 'fabric');
  const hair = mat('#392B35', 'fabric');
  const skin = mat('#C99676', 'plaster');
  const skinShade = mat('#A9735C', 'plaster');
  const teal = mat('#62C9BC', 'fabric');
  const copper = mat('#B76F48', 'metal', 0.25);
  const eye = mat('#242C32', 'plaster');
  const light = mat('#FFF0C9', 'plaster');
  function pivot(parent, name, x, y, z) {
    const p = new THREE.Group(); p.name = name; p.position.set(x, y, z);
    parent.add(p); joints[name] = p; return p;
  }
  function mesh(parent, geo, material, x=0, y=0, z=0) {
    const m = new THREE.Mesh(geo, material); m.position.set(x,y,z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function ell(parent, material, x,y,z, sx,sy,sz) {
    const m=mesh(parent,new THREE.SphereGeometry(1,12,8),material,x,y,z);
    m.scale.set(sx,sy,sz); return m;
  }
  // Authored curved profiles form the primary masses and overlapping cloth.
  function profile(parent, shape, depth, material, x=0,y=0,z=0, bevel=.009) {
    const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1,curveSegments:5});
    geo.translate(0,0,-depth/2);
    return mesh(parent,geo,material,x,y,z);
  }
  function tapered(wTop,wBottom,length) {
    const s=new THREE.Shape();
    s.moveTo(-wTop/2,0); s.quadraticCurveTo(-wTop*.61,-length*.35,-wBottom/2,-length);
    s.quadraticCurveTo(0,-length-.009,wBottom/2,-length);
    s.quadraticCurveTo(wTop*.61,-length*.35,wTop/2,0); s.closePath(); return s;
  }
  const hips=pivot(g,'hips',0,.61,0);
  ell(hips,dark,0,0,0,.135,.115,.095);
  const torso=new THREE.Shape();
  torso.moveTo(-.11,.01); torso.lineTo(-.16,.28); torso.quadraticCurveTo(0,.34,.16,.28);
  torso.lineTo(.105,.01); torso.quadraticCurveTo(0,-.03,-.11,.01); torso.closePath();
  profile(hips,torso,.17,coral,0,0,0,.012);
  profile(hips,tapered(.22,.24,.055),.182,dark,0,.04,0,.003);
  // Lapels, asymmetric fastening and back yoke, no lettering.
  const lapel=new THREE.Shape(); lapel.moveTo(-.13,.285);lapel.lineTo(-.025,.20);lapel.lineTo(.018,.095);lapel.lineTo(.105,.292);lapel.quadraticCurveTo(0,.34,-.13,.285);lapel.closePath();
  profile(hips,lapel,.013,ivory,0,0,.1,.003);
  const trim=new THREE.Shape();trim.moveTo(.105,.275);trim.lineTo(.06,.01);trim.lineTo(.081,.012);trim.lineTo(.126,.278);trim.closePath();
  profile(hips,trim,.009,coralShade,0,0,.103,.002);
  ell(hips,teal,.08,.15,.12,.025,.025,.012);
  ell(hips,copper,.085,.068,.118,.016,.016,.012);
  const yoke=new THREE.Shape();yoke.moveTo(-.143,.26);yoke.quadraticCurveTo(0,.20,.143,.26);yoke.lineTo(.15,.285);yoke.quadraticCurveTo(0,.32,-.15,.285);yoke.closePath();
  profile(hips,yoke,.013,coralShade,0,0,-.103,.002);
  for(let side=-1;side<=1;side+=2) {
    const label=side<0?'left':'right';
    const thigh=pivot(hips,label+'UpperLeg',side*.087,-.055,0);
    profile(thigh,tapered(.108,.088,.225),.10,dark,0,0,0,.012);
    const shin=pivot(thigh,label+'LowerLeg',0,-.225,0);
    profile(shin,tapered(.087,.063,.22),.077,dark,0,0,0,.012);
    const foot=pivot(shin,label+'Foot',0,-.22,.01);
    const boot=new THREE.Shape();boot.moveTo(-.042,.072);boot.lineTo(-.05,.008);boot.quadraticCurveTo(0,-.004,.053,.008);boot.lineTo(.047,.07);boot.closePath();
    profile(foot,boot,.10,dark,0,0,.012,.012);
    ell(foot,dark,0,.026,.071,.058,.039,.075);
    ell(foot,copper,0,.062,.09,.035,.015,.015);
    const tail=pivot(hips,side<0?'coatLeft':'coatRight',side*.072,.015,-.024);
    const flap=new THREE.Shape();flap.moveTo(-.069,0);flap.lineTo(.07,0);flap.lineTo(.102,-.27-(side<0?.025:0));flap.quadraticCurveTo(0,-.32,-.1,-.24);flap.closePath();
    profile(tail,flap,.145,coral,0,0,.008,.012);
    tail.rotation.z=side*.09;
    const arm=pivot(hips,label+'UpperArm',side*.155,.263,0);
    arm.rotation.z=side*.14;
    profile(arm,tapered(.115,.085,.17),.10,coral,0,-.018,0,.012);
    const forearm=pivot(arm,label+'LowerArm',0,-.185,0);
    forearm.rotation.x=-.16;
    profile(forearm,tapered(.084,.068,.16),.081,side<0?coral:coralShade,0,0,0,.009);
    profile(forearm,tapered(.08,.08,.043),.085,teal,0,-.13,0,.004);
    const hand=pivot(forearm,label+'Hand',0,-.184,.005);
    ell(hand,skin,0,-.033,.008,.038,.052,.033);
    ell(hand,skinShade,-side*.031,-.024,.027,.017,.028,.018);
    // A named grip socket remains at the palm; runtime attaches separate staff here.
    const grip=new THREE.Group();grip.name=label+'Grip';grip.position.set(0,-.035,.038);hand.add(grip);
    hand.userData.grip=grip;
  }
  ell(hips,skin,0,.343,0,.049,.07,.049);
  const head=pivot(hips,'head',0,.43,0);
  const face=new THREE.Shape();face.moveTo(-.137,.067);face.quadraticCurveTo(-.153,-.035,-.10,-.102);face.quadraticCurveTo(0,-.17,.10,-.102);face.quadraticCurveTo(.153,-.035,.137,.067);face.quadraticCurveTo(0,.143,-.137,.067);face.closePath();
  profile(head,face,.13,skin,0,0,.012,.044);
  ell(head,skin,-.158,-.02,.01,.026,.044,.024);
  ell(head,skin,.158,-.02,.01,.026,.044,.024);
  // Back crown is a deep continuous profile, with three swept locks in front.
  const crown=new THREE.Shape();crown.moveTo(-.16,-.025);crown.lineTo(-.163,.066);crown.quadraticCurveTo(-.145,.17,-.035,.176);crown.quadraticCurveTo(.10,.185,.167,.085);crown.lineTo(.145,-.014);crown.quadraticCurveTo(.06,.05,-.025,.09);crown.quadraticCurveTo(-.11,.03,-.16,-.025);crown.closePath();
  profile(head,crown,.17,hair,0,.023,-.026,.038);
  for(let i=0;i<3;i++) {
    const lock=new THREE.Shape();lock.moveTo(-.115+i*.048,.115);lock.quadraticCurveTo(.025+i*.04,.146,.153+i*.003,.007+i*.025);lock.quadraticCurveTo(.045+i*.018,.023+i*.019,-.115+i*.048,.115);lock.closePath();
    profile(head,lock,.027,i===1?dark:hair,0,.013,.114+i*.007,.005);
  }
  for(let side=-1;side<=1;side+=2) {
    ell(head,light,side*.06,-.018,.133,.038,.022,.012);
    ell(head,eye,side*.06,-.02,.145,.015,.019,.008);
    ell(head,light,side*.06-.004,-.013,.151,.004,.006,.003);
    const brow=new THREE.Shape();brow.moveTo(-.034,-.006);brow.quadraticCurveTo(0,.006,.034,0);brow.lineTo(.029,.009);brow.quadraticCurveTo(0,.019,-.032,.004);brow.closePath();
    profile(head,brow,.01,hair,side*.061,.013,.139,.001);
  }
  ell(head,skin,0,-.05,.141,.018,.022,.022);
  const smile=new THREE.Shape();smile.moveTo(-.025,.004);smile.quadraticCurveTo(0,-.009,.027,.005);smile.quadraticCurveTo(0,-.001,-.025,.009);smile.closePath();
  profile(head,smile,.007,skinShade,0,-.087,.136,.001);
  g.userData.joints=joints;
  // Compute actual vertices so bevels are included in the 1.35m contract.
  const box=new THREE.Box3(),v=new THREE.Vector3();g.updateMatrixWorld(true);
  g.traverse(n=>{const p=n.isMesh&&n.geometry.attributes.position;if(p)for(let i=0;i<p.count;i++)box.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));});
  const c=box.getCenter(new THREE.Vector3());
  const factor=1.35/(box.max.y-box.min.y);
  for(const child of g.children){child.position.x-=c.x;child.position.y-=box.min.y;child.position.z-=c.z;child.position.multiplyScalar(factor);child.scale.multiplyScalar(factor);child.scale.x*=.9;child.position.x*=.9;}
  return g;
}
