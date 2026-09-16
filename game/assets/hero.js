export default function(THREE) {
 const root=new THREE.Group(), joints={};root.userData.joints=joints;root.userData.keepHierarchy=true;
 const mat=(c,n='fabric',r=.86)=>Object.assign(new THREE.MeshStandardMaterial({color:c,roughness:r}),{name:n});
 const skin=mat(0xd7a27f), coral=mat(0xc95845), lining=mat(0x81393d), cream=mat(0xebe0c5), teal=mat(0x244f52), hair=mat(0x402b3f), hairLight=mat(0x5a3b50), leather=mat(0x625249), eye=mat(0x253333), white=mat(0xf6ecdb), copper=mat(0xb88754,'metal',.45), gem=mat(0x4ea99f,'metal',.3);
 const mesh=(p,g,m,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=o.receiveShadow=true;p.add(o);return o;};
 const ell=(p,m,x,y,z,a,b,c)=>mesh(p,new THREE.SphereGeometry(1,12,8),m,x,y,z,a,b,c);
 const box=(p,m,x,y,z,a,b,c)=>mesh(p,new THREE.BoxGeometry(a,b,c),m,x,y,z);
 const taper=(p,m,x,y,z,rt,rb,h,depth=1,n=10)=>mesh(p,new THREE.CylinderGeometry(rt,rb,h,n),m,x,y,z,1,1,depth);
 const pivot=(n,p,x,y,z)=>{const o=new THREE.Group();o.name=n;o.position.set(x,y,z);p.add(o);joints[n]=o;return o;};
 const profile=(p,m,points,x,y,z,depth=.04)=>{const s=new THREE.Shape();points.forEach(([a,b],i)=>i?s.lineTo(a,b):s.moveTo(a,b));s.closePath();return mesh(p,new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.008,bevelThickness:.007}),m,x,y,z-depth/2);};
 const stroke=(p,m,points,r=.006)=>mesh(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),10,r,5,false),m);
 const lathe=(p,m,points,x,y,z,sx=1,sz=1)=>mesh(p,new THREE.LatheGeometry(points.map(v=>new THREE.Vector2(...v)),12),m,x,y,z,sx,1,sz);

 // A: carved tapered solids; shoulder chest and waist are independently shaped masses.
 const hips=pivot('hips',root,0,.78,0);
 ell(hips,teal,0,0,-.005,.126,.105,.076);
 taper(hips,coral,0,.180,0,.169,.105,.330,.60,10);
 ell(hips,coral,0,.296,.005,.168,.086,.086);
 taper(hips,lining,0,.391,-.003,.065,.068,.070,.80,10);
 taper(hips,leather,0,.039,0,.119,.119,.034,.70);box(hips,copper,.016,.040,.089,.036,.035,.011);
 const head=pivot('head',hips,0,.394,0);
 mesh(head,new THREE.SphereGeometry(1,10,8),skin,0,.140,0,.109,.146,.097);
 ell(head,skin,0,.078,.030,.076,.064,.074);
 ell(head,hair,0,.236,-.021,.115,.080,.098);
 // Swept comma locks: curved closed profiles have a light-facing ridge.
 for(let i=0;i<5;i++){
  const x=-.086+i*.037;
  const lock=new THREE.Shape();lock.moveTo(0,-.025);lock.bezierCurveTo(-.034,.028,-.021,.088,.019,.082);lock.bezierCurveTo(.070,.055,.097,.067,.109,.097);lock.bezierCurveTo(.132,.019,.063,.019,.029,-.031);lock.quadraticCurveTo(.020,-.058,0,-.025);mesh(head,new THREE.ExtrudeGeometry(lock,{depth:.035,bevelEnabled:true,bevelThickness:.006,bevelSize:.006,bevelSegments:2,curveSegments:8}),i%2?hair:hairLight,x,.226-i*.006,.033-i*.020);
 }
 profile(head,hair,[[-.032,.113],[.004,.143],[.035,.083],[.049,-.044],[.014,-.064],[-.016,-.028]],-.094,.117,-.032,.075);
 profile(head,hair,[[-.015,.097],[.02,.14],[.048,.079],[.082,.031],[.057,-.053],[.010,-.066]],.055,.130,-.050,.074);

 // Human face: shaped almond whites, upper eyelids and angled brows, asymmetric smile.
 for(const side of [-1,1]){
  ell(head,skin,side*.109,.125,-.001,.021,.031,.018);
  const almond=new THREE.Shape();almond.moveTo(-.030,0);almond.quadraticCurveTo(0,.022,.030,.002);almond.quadraticCurveTo(.006,-.014,-.030,0);const ew=mesh(head,new THREE.ShapeGeometry(almond,10),white,side*.043,.146,.091);ew.rotation.y=side*.26;
  ell(head,eye,side*.042,.147,.094,.008,.009,.002);
  stroke(head,hair,[[side*.043-.030,.147,.094],[side*.043-.005,.158,.096],[side*.043+.030,.149,.094]],.004);
  stroke(head,hair,[[side*.043-.034,.175-side*.005,.080],[side*.043-.010,.181,.088],[side*.043+.030,.172+side*.004,.084]],.006);
 }
 profile(head,skin,[[-.012,.011],[.002,.044],[.017,.002],[.006,-.007],[-.011,-.003]],0,.104,.093,.019);
 stroke(head,lining,[[-.031,.083,.093],[-.008,.077,.106],[.018,.081,.103],[.030,.088,.093]],.004);
 stroke(head,cream,[[-.022,.083,.105],[.003,.082,.109],[.024,.087,.102]],.0028);

 for(const side of [-1,1]){
  const pre=side<0?'left':'right';const leg=pivot(pre+'UpperLeg',hips,side*.075,-.025,0);
  taper(leg,teal,0,-.155,0,.077,.056,.31,.90,10);
  const knee=pivot(pre+'LowerLeg',leg,0,-.335,0);ell(knee,teal,0,0,.007,.055,.052,.05);
  taper(knee,teal,0,-.130,0,.054,.038,.26,.88,9);
  const foot=pivot(pre+'Foot',knee,0,-.300,.012);
  taper(foot,leather,0,.028,-.013,.049,.047,.16,.9,10);
  ell(foot,leather,0,-.040,.027,.053,.050,.104);ell(foot,copper,0,-.041,.094,.048,.031,.044);
  for(let j=0;j<2;j++){const wrap=taper(foot,cream,0,.007+j*.05,-.012,.051,.051,.022,.95,10);wrap.rotation.z=side*(j?.14:-.18);}
  const arm=pivot(pre+'UpperArm',hips,side*.155,.286,0);arm.rotation.z=side*.20;
  taper(arm,coral,0,-.098,0,.065,.047,.210,.90,10);
  const fore=pivot(pre+'LowerArm',arm,0,-.217,0);fore.rotation.x=-.13;
  taper(fore,coral,0,-.083,0,.047,.035,.168,.9,10);taper(fore,lining,0,-.170,0,.043,.042,.050,.95,10);
  const hand=pivot(pre+'Hand',fore,0,-.196,.005);
  ell(hand,leather,0,-.026,0,.037,.044,.025);
  if(side>0){
   // Knuckles curl around the shaft centre rather than pointing past it.
   for(let j=0;j<3;j++){
    const y=-.042-j*.014;
    stroke(hand,skin,[[-.022,y,.010],[-.018,y,.039],[.001,y-.003,.049],[.016,y-.003,.036]],.0075);
   }
   stroke(hand,skin,[[.025,-.029,.014],[.029,-.043,.029],[.013,-.047,.046]],.009);
  }else{
   ell(hand,skin,-side*.028,-.030,.017,.013,.026,.015);
   for(let j=0;j<3;j++)ell(hand,skin,(j-1)*.018,-.065,.004,.009,.021,.014);
  }
  const coat=pivot(side<0?'coatLeft':'coatRight',hips,side*.064,.050,-.041);
  profile(coat,coral,[[-.06,0],[.05,.015],[.098,-.164],[.086,-.363],[-.059,-.242]],0,0,0,.03).rotation.y=side*.21;
  stroke(coat,lining,[[.077,-.339,.020],[.081,-.17,.025],[.031,-.011,.025]],.004);
 }

 // Diagonal cape is an articulated shoulder garment, not a rigid neck ring.
 const cape=pivot('cape',hips,0,.325,-.007);
 profile(cape,cream,[[-.213,-.025],[-.176,.043],[-.075,.061],[.096,.029],[.212,-.088],[.155,-.109],[.079,-.055],[-.069,-.126],[-.222,-.082]],0,0,.083,.024);
 profile(cape,cream,[[-.196,.022],[-.105,.065],[.111,.026],[.207,-.062],[.075,-.183],[-.140,-.127],[-.22,-.049]],0,0,-.071,.025);
 stroke(cape,leather,[[-.207,-.079,.106],[-.069,-.122,.110],[.079,-.052,.112],[.158,-.105,.108]],.0035);
 ell(cape,copper,.087,-.029,.112,.027,.036,.01);ell(cape,gem,.087,-.027,.123,.017,.026,.009);
 for(const panel of cape.children.filter(o=>o.isMesh&&o.geometry.type==='ExtrudeGeometry')){const pos=panel.geometry.attributes.position;for(let k=0;k<pos.count;k++){const x=pos.getX(k),y=pos.getY(k);pos.setZ(k,pos.getZ(k)+(.024*Math.sin((x+.10)*13)+.014*Math.cos(y*22)));}panel.geometry.computeVertexNormals();}
 stroke(cape,cream,[[-.182,-.01,.10],[-.094,-.04,.13],[.074,-.026,.123]],.010);
 const strap=box(hips,leather,-.025,.166,.107,.024,.353,.016);strap.rotation.z=-.43;
 ell(hips,leather,-.163,-.022,-.008,.080,.095,.055);
 profile(hips,leather,[[-.071,.034],[.066,.034],[.061,-.013],[0,-.038],[-.063,-.017]],-.16,0,.042,.018);
 box(hips,copper,-.162,-.009,.060,.022,.025,.009);
 for(let i=0;i<3;i++)ell(hips,copper,.052,.102+i*.059,.106,.009,.009,.005);

 // Separate chest articulation gives purposeful upper-body effort without tilting planted legs.
 const upperChildren=hips.children.filter(o=>['head','cape','leftUpperArm','rightUpperArm'].includes(o.name)||(o.isMesh&&o.position.y>=.075));
 const chest=pivot('chest',hips,0,.065,0);
 root.updateMatrixWorld(true);for(const child of upperChildren)chest.attach(child);
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3());
 const scale=1.60/(bounds.max.y-bounds.min.y);root.children.forEach(c=>{c.position.x-=center.x;c.position.y-=bounds.min.y;c.position.z-=center.z;});root.scale.setScalar(scale);
 joints.rightHand.userData.grip={position:[0,-.054,.026],rotation:[0,0,0]};root.userData.grip=joints.rightHand;
 root.userData.anatomy={height:1.60,upperLeg:.34,lowerLeg:.34,upperArm:.215,lowerArm:.19};
 return root;
}
