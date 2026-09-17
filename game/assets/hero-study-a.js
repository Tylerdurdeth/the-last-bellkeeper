export default function(THREE) {
 const root=new THREE.Group(), joints={};root.userData.joints=joints;root.userData.keepHierarchy=true;
 const mat=(c,n='fabric',r=.86)=>Object.assign(new THREE.MeshStandardMaterial({color:c,roughness:r}),{name:n});
 const skin=mat(0xd7a27f), coral=mat(0xc95845), lining=mat(0x81393d), cream=mat(0xebe0c5), teal=mat(0x244f52), hair=mat(0x543321), hairLight=mat(0x72472f), leather=mat(0x625249), eye=mat(0x253333), white=mat(0xf6ecdb), copper=mat(0xb88754,'metal',.45), gem=mat(0x4ea99f,'metal',.3);
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
 taper(hips,skin,0,.391,-.003,.045,.068,.070,.80,10);
 taper(hips,leather,0,.039,0,.119,.119,.034,.70);box(hips,copper,.016,.040,.089,.036,.035,.011);
 const head=pivot('head',hips,0,.394,0);
 // Continuous face with a cheek/jaw profile; all contours are authored functions.
 const faceProfile=[[.012,.012,.030],[.032,.033,.055],[.067,.069,.077],[.112,.098,.089],[.16,.108,.093],[.207,.110,.094],[.251,.095,.084],[.285,.060,.058],[.300,0,0]];
 function radius(y,k){for(let i=1;i<faceProfile.length;i++)if(y<=faceProfile[i][0]){const a=faceProfile[i-1],b=faceProfile[i],prev=faceProfile[Math.max(0,i-2)],next=faceProfile[Math.min(faceProfile.length-1,i+1)],h=b[0]-a[0],u=THREE.MathUtils.clamp((y-a[0])/h,0,1),m0=(b[k]-prev[k])/(b[0]-prev[0]),m1=(next[k]-a[k])/(next[0]-a[0]);return Math.max(0,(2*u*u*u-3*u*u+1)*a[k]+(u*u*u-2*u*u+u)*h*m0+(-2*u*u*u+3*u*u)*b[k]+(u*u*u-u*u)*h*m1);}return 0;}
 const features=(x,y)=>.012*Math.exp(-((x/.014)**2)-(((y-.143)/.028)**2))+.009*Math.exp(-((x/.018)**2)-(((y-.124)/.017)**2))-.004*Math.exp(-(((Math.abs(x)-.044)/.028)**2)-(((y-.173)/.019)**2))+.003*Math.exp(-(((Math.abs(x)-.065)/.029)**2)-(((y-.133)/.028)**2));
 const surface=(x,y)=>radius(y,2)*Math.pow(Math.max(.001,1-(x/Math.max(.001,radius(y,1)))**2),.43)+features(x,y);
 const faceGeo=new THREE.SphereGeometry(1,96,80),fp=faceGeo.attributes.position;
 for(let i=0;i<fp.count;i++){const ny=fp.getY(i),y=.156+ny*.144,s=Math.sqrt(Math.max(.000001,1-ny*ny)),x=fp.getX(i)/s*radius(y,1),front=fp.getZ(i)>0;fp.setXYZ(i,x,y,front?surface(x,y):fp.getZ(i)/s*radius(y,2));}faceGeo.computeVertexNormals();const colors=[];for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i),z=fp.getZ(i),warm=Math.exp(-(((Math.abs(x)-.060)/.033)**2)-(((y-.137)/.025)**2))*(z>0?1:0),shadow=.10*Math.exp(-((x/.017)**2)-(((y-.114)/.008)**2))*(z>0?1:0);colors.push(1-shadow,.99-.07*warm-shadow,.98-.08*warm-shadow);}faceGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const faceMaterial=skin.clone();faceMaterial.vertexColors=true;faceMaterial.name='faceSkin';const face=mesh(head,faceGeo,faceMaterial);face.receiveShadow=false;
 for(const side of [-1,1]){
  const ear=ell(head,skin,side*.109,.151,-.004,.017,.029,.012);ear.rotation.z=-side*.22;
  ell(head,mat(0xb97558),side*.112,.150,.006,.008,.017,.003);
  const ex=side*.044,ey=.172,eyeGroup=new THREE.Group();head.add(eyeGroup);
  const almond=new THREE.Shape();almond.moveTo(-.028,-.001);almond.bezierCurveTo(-.018,.017,.013,.019,.028,.003);almond.bezierCurveTo(.014,-.012,-.015,-.014,-.028,-.001);
  const g=new THREE.ShapeGeometry(almond,24),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=ex+side*p.getX(i),y=ey+p.getY(i);p.setXYZ(i,x,y,surface(x,y)+.0012);}g.computeVertexNormals();const eyeWhite=white.clone();eyeWhite.side=THREE.DoubleSide;mesh(eyeGroup,g,eyeWhite);
  ell(eyeGroup,mat(0x459b8c),ex-side*.001,ey+.002,surface(ex,ey)+.003,.013,.014,.0018);
  ell(eyeGroup,eye,ex-side*.001,ey+.002,surface(ex,ey)+.005,.005,.008,.001);
  ell(eyeGroup,white,ex-.004,ey+.008,surface(ex,ey)+.006,.0026,.0026,.0008);
  const lid=[];for(let i=0;i<=16;i++){const t=i/16,x=ex+side*(-.028+t*.056),y=ey+Math.sin(t*Math.PI)*.016-.001+t*.004;lid.push([x,y,surface(x,y)+.002]);}stroke(eyeGroup,mat(0x603e32),lid,.0017);
  const browShape=new THREE.Shape();browShape.moveTo(-.026,0);browShape.quadraticCurveTo(-.006,.008,.027,.003);browShape.quadraticCurveTo(.018,.014,-.013,.013);browShape.quadraticCurveTo(-.021,.011,-.026,0);
  const bg=new THREE.ShapeGeometry(browShape,16),bp=bg.attributes.position;for(let i=0;i<bp.count;i++){const x=ex+side*bp.getX(i),y=.200+bp.getY(i);bp.setXYZ(i,x,y,surface(x,y)+.0015);}bg.computeVertexNormals();const bm=hair.clone();bm.side=THREE.DoubleSide;mesh(head,bg,bm);
  eyeGroup.position.y=ey;for(const part of eyeGroup.children)part.position.y-=ey;(root.userData.eyeGroups??=[]).push(eyeGroup);
 }
 // Restrained lip planes and a slight asymmetric expression, not an outlined grin.
 const seam=x=>.087+.0025*(x/.025)**2+.001*x/.025;
 const mouth=[];for(let i=0;i<=24;i++){const x=-.025+i*.05/24,y=seam(x);mouth.push([x,y,surface(x,y)+.0012]);}stroke(head,mat(0x925b49),mouth,.0008);
 function lipPlane(upper){const g=new THREE.PlaneGeometry(.05,1,32,4),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),u=p.getY(i)+.5,w=Math.pow(Math.max(0,1-(x/.025)**2),.8),height=upper?.0035:.0045,y=seam(x)+(upper?1:-1)*height*w*u;const bulge=.0015*Math.sin(u*Math.PI)*w;p.setXYZ(i,x,y,surface(x,y)+.0007+bulge);}g.computeVertexNormals();mesh(head,g,mat(upper?0xc28b70:0xdba786));}lipPlane(true);lipPlane(false);

 // Hair volume is one cap; individual locks are tapered sweeps, not cones.
 const cap=new THREE.SphereGeometry(1,32,18,0,Math.PI*2,0,Math.PI*.63);const hp=cap.attributes.position;
 for(let j=0;j<=18;j++)for(let i=0;i<=32;i++){const phi=i/32*Math.PI*2,theta=j/18*Math.PI*(.68-.27*Math.max(0,Math.sin(phi)));hp.setXYZ(j*33+i,-Math.cos(phi)*Math.sin(theta)*.121,.172+Math.cos(theta)*.145,Math.sin(phi)*Math.sin(theta)*.107-.012);}cap.computeVertexNormals();mesh(head,cap,hair);
 function lock(points,width,depth,color){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const g=new THREE.TubeGeometry(curve,16,1,8,false),p=g.attributes.position;for(let j=0;j<=16;j++){const u=j/16,c=curve.getPointAt(u),w=Math.pow(Math.sin(Math.PI*(.12+.88*u)),.8);for(let k=0;k<=8;k++){const i=j*9+k;const v=new THREE.Vector3().fromBufferAttribute(p,i).sub(c);p.setXYZ(i,c.x+v.x*width*w,c.y+v.y*width*w,c.z+v.z*depth*w);}}g.computeVertexNormals();mesh(head,g,color);}
 lock([[.052,.282,.051],[.013,.278,.089],[-.031,.237,.099],[-.027,.188,.099]],.031,.013,hairLight);
 lock([[.081,.281,.021],[.045,.281,.075],[.010,.254,.105],[.023,.216,.104]],.026,.014,hair);
 lock([[.011,.288,.043],[-.050,.283,.055],[-.086,.237,.063],[-.107,.181,.059]],.032,.014,hair);
 lock([[.088,.259,.028],[.101,.223,.039],[.101,.171,.049],[.084,.137,.043]],.023,.012,hairLight);
 lock([[-.077,.262,.019],[-.108,.215,.006],[-.109,.160,.014],[-.117,.137,.005]],.023,.012,hair);
 lock([[.083,.269,-.040],[.118,.227,-.050],[.116,.182,-.053],[.127,.165,-.053]],.022,.012,hair);
 root.userData.faceStudy=true;

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
  taper(fore,skin,0,-.083,0,.047,.035,.168,.9,10);taper(fore,cream,0,-.170,0,.043,.042,.050,.95,10);
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
 const cape=pivot('cape',hips,0,.325,-.007);cape.scale.set(.89,.80,.94);
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

 lathe(hips,copper,[[.019,0],[.017,.007],[.011,.027],[0,.034]],.028,.185,.132);stroke(hips,leather,[[.028,.225,.131],[.028,.245,.126]],.0025);
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
