export default function(THREE) {
 const root=new THREE.Group(), joints={};root.userData.joints=joints;root.userData.keepHierarchy=true;
 const mat=(c,n='fabric',r=.86)=>Object.assign(new THREE.MeshStandardMaterial({color:c,roughness:r}),{name:n});
 const skin=mat(0xd7a27f), coral=mat(0xc95845), lining=mat(0x81393d), cream=mat(0xebe0c5), teal=mat(0x244f52), hair=mat(0x402b3f), hairLight=mat(0x5a3b50), leather=mat(0x625249), eye=mat(0x253333), white=mat(0xf6ecdb), copper=mat(0xb88754,'metal',.45), gem=mat(0x4ea99f,'metal',.3);
 const mesh=(p,g,m,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=o.receiveShadow=true;p.add(o);return o;};
 const ell=(p,m,x,y,z,a,b,c)=>mesh(p,new THREE.SphereGeometry(1,16,12),m,x,y,z,a,b,c);
 const box=(p,m,x,y,z,a,b,c)=>mesh(p,new THREE.BoxGeometry(a,b,c),m,x,y,z);
 const taper=(p,m,x,y,z,rt,rb,h,depth=1,n=10)=>mesh(p,new THREE.CylinderGeometry(rt,rb,h,n),m,x,y,z,1,1,depth);
 const pivot=(n,p,x,y,z)=>{const o=new THREE.Group();o.name=n;o.position.set(x,y,z);p.add(o);joints[n]=o;return o;};
 const profile=(p,m,points,x,y,z,depth=.04)=>{const s=new THREE.Shape();points.forEach(([a,b],i)=>i?s.lineTo(a,b):s.moveTo(a,b));s.closePath();return mesh(p,new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.008,bevelThickness:.007}),m,x,y,z-depth/2);};
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
 // One continuous cheek/jaw surface, with a narrowed chin rather than stacked globes.
 const faceGeo=new THREE.SphereGeometry(1,32,24),fp=faceGeo.attributes.position;
 for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i),z=fp.getZ(i);const jaw=y<-.15?1-.22*Math.min(1,(-y-.15)/.85):1;fp.setXYZ(i,x*jaw,y,z+(z>0&&y<-.15?.06*(1+y):0));}faceGeo.computeVertexNormals();
 mesh(head,faceGeo,skin,0,.140,0,.109,.146,.097);
 ell(head,hair,0,.236,-.021,.115,.080,.098);
 // Swept comma locks: curved closed profiles have a light-facing ridge.
 for(let i=0;i<5;i++){
  const x=-.086+i*.037;
  const lock=new THREE.Shape();lock.moveTo(0,-.025);lock.bezierCurveTo(-.034,.028,-.021,.088,.019,.082);lock.bezierCurveTo(.070,.055,.097,.067,.109,.097);lock.bezierCurveTo(.132,.019,.063,.019,.029,-.031);lock.quadraticCurveTo(.020,-.058,0,-.025);mesh(head,new THREE.ExtrudeGeometry(lock,{depth:.050,bevelEnabled:true,bevelThickness:.012,bevelSize:.006,bevelSegments:4,curveSegments:8}),i%2?hair:hairLight,x,.226-i*.006,.033-i*.020);
 }
 // Rounded temple and nape volumes connect the swept crown to the skull.
 ell(head,hair,0,.180,-.044,.111,.118,.069);

 // Human face: shaped almond whites, upper eyelids and angled brows, asymmetric smile.
 for(const side of [-1,1]){
  ell(head,skin,side*.109,.125,-.001,.021,.031,.018);
  const almond=new THREE.Shape();almond.moveTo(-.030,0);almond.quadraticCurveTo(0,.022,.030,.002);almond.quadraticCurveTo(.006,-.014,-.030,0);const ew=mesh(head,new THREE.ShapeGeometry(almond,10),white,side*.043,.146,.094);ew.rotation.y=side*.26;
  ell(head,teal,side*.042,.149,.098,.0085,.008,.0015);
  ell(head,eye,side*.041,.149,.100,.004,.006,.001);
  ell(head,white,side*.038,.152,.101,.0023,.0023,.0007);
  stroke(head,skin,[[side*.043-.028,.147,.096],[side*.043-.005,.160,.098],[side*.043+.027,.149,.096]],.0045);
  stroke(head,hair,[[side*.043-.030,.147,.094],[side*.043-.005,.158,.096],[side*.043+.030,.149,.094]],.0027);
  stroke(head,hair,[[side*.043-.034,.175-side*.005,.080],[side*.043-.010,.181,.088],[side*.043+.030,.172+side*.004,.084]],.006);
 }
 profile(head,skin,[[-.012,.011],[.002,.044],[.017,.002],[.006,-.007],[-.011,-.003]],0,.104,.093,.019);
 stroke(head,lining,[[-.031,.083,.093],[-.008,.077,.106],[.018,.081,.103],[.030,.088,.093]],.004);
 stroke(head,cream,[[-.015,.083,.102],[.003,.082,.104],[.018,.086,.099]],.0018);

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
 // A closed shoulder drape: shared curved surface from neckline over both
 // shoulders to its diagonal hem; inner shell gives the cloth a real edge.
 const segments=64,rings=12,verts=[],indices=[];
 function drape(u,a,inside=false){
  const sn=Math.sin(a),cs=Math.cos(a),ease=Math.sin(u*Math.PI/2);
  const rx=.069+.155*ease+.025*ease**4,rz=.061+.076*ease;
  const low=-.060-.097*Math.max(0,-sn)*(.65+.35*Math.max(0,cs))-.040*Math.max(0,-cs);
  const fold=(Math.sin(a*5+.6)*.005+Math.sin(a*9)*.002)*Math.sin(u*Math.PI);
  const y=.055+(low-.055)*u*u+.042*Math.sin(u*Math.PI)+fold;
  const radialFold=.008*Math.sin(u*11+a*2)*Math.sin(u*Math.PI)*Math.max(0,cs);
  return [sn*(rx+radialFold-(inside?.006:0)),y-(inside?.006:0),cs*(rz+radialFold-(inside?.006:0))];
 }
 for(let shell=0;shell<2;shell++)for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++)verts.push(...drape(j/rings,i/segments*Math.PI*2,!!shell));
 const layer=(rings+1)*(segments+1);
 for(let shell=0;shell<2;shell++)for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=shell*layer+j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;if(!shell)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);}
 for(const row of [0,rings])for(let i=0;i<segments;i++){const a=row*(segments+1)+i,b=a+1;indices.push(a,b,a+layer,b,b+layer,a+layer);}
 const clothGeo=new THREE.BufferGeometry();clothGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));clothGeo.setIndex(indices);clothGeo.computeVertexNormals();mesh(cape,clothGeo,cream);
 const hem=[];for(let i=0;i<=64;i++)hem.push(drape(1,i/64*Math.PI*2));mesh(cape,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hem.map(v=>new THREE.Vector3(...v))),64,.0038,5,false),cream);
 // Raised fold ridges converge at the copper fastening, not arbitrary plates.
 stroke(cape,cream,[[-.185,-.066,.070],[-.121,-.021,.117],[-.045,.006,.125],[.067,.010,.104]],.0045);
 stroke(cape,cream,[[-.165,-.094,.083],[-.108,-.061,.131],[-.026,-.037,.143],[.077,-.011,.112]],.0038);
 ell(cape,copper,.080,-.013,.119,.024,.030,.009);ell(cape,gem,.080,-.011,.129,.015,.023,.007);
 const strap=box(hips,leather,-.025,.166,.107,.024,.353,.016);strap.rotation.z=-.43;
 ell(hips,leather,-.163,-.022,-.008,.080,.095,.055);
 profile(hips,leather,[[-.071,.034],[.066,.034],[.061,-.013],[0,-.038],[-.063,-.017]],-.16,0,.042,.018);
 box(hips,copper,-.162,-.009,.060,.022,.025,.009);
 for(let i=0;i<3;i++)ell(hips,copper,.052,.102+i*.059,.106,.009,.009,.005);

 // Separate chest articulation gives purposeful upper-body effort without tilting planted legs.
 const upperChildren=hips.children.filter(o=>['head','cape','leftUpperArm','rightUpperArm'].includes(o.name)||(o.isMesh&&o.position.y>=.075));
 const chest=pivot('chest',hips,0,.065,0);
 root.updateMatrixWorld(true);for(const child of upperChildren)chest.attach(child);
 // Retain selected-A rig origin and scale exactly; polish must not move grips or joints.
 root.children.forEach(c=>{c.position.y-=.03;c.position.z-=.013706070616841315;});root.scale.setScalar(1.0844553078580534);
 joints.rightHand.userData.grip={position:[0,-.054,.026],rotation:[0,0,0]};root.userData.grip=joints.rightHand;
 root.userData.anatomy={height:1.60,upperLeg:.34,lowerLeg:.34,upperArm:.215,lowerArm:.19};
 return root;
}
