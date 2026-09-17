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
 const faceProfile=[[.012,0,0],[.027,.017,.044],[.038,.033,.065],[.069,.073,.083],[.100,.089,.086],[.139,.107,.092],[.170,.102,.093],[.207,.099,.094],[.251,.094,.084],[.285,.060,.058],[.300,0,0]];
 function radius(y,k){for(let i=1;i<faceProfile.length;i++)if(y<=faceProfile[i][0]){const a=faceProfile[i-1],b=faceProfile[i],prev=faceProfile[Math.max(0,i-2)],next=faceProfile[Math.min(faceProfile.length-1,i+1)],h=b[0]-a[0],u=THREE.MathUtils.clamp((y-a[0])/h,0,1),m0=(b[k]-prev[k])/(b[0]-prev[0]),m1=(next[k]-a[k])/(next[0]-a[0]);return Math.max(0,(2*u*u*u-3*u*u+1)*a[k]+(u*u*u-2*u*u+u)*h*m0+(-2*u*u*u+3*u*u)*b[k]+(u*u*u-u*u)*h*m1);}return 0;}
 function noseForm(x,y){const knots=[[.110,0,.018],[.120,.023,.017],[.128,.026,.013],[.148,.015,.010],[.174,.003,.010],[.191,0,.012]];for(let i=1;i<knots.length;i++)if(y>=knots[i-1][0]&&y<=knots[i][0]){const a=knots[i-1],b=knots[i],u=(y-a[0])/(b[0]-a[0]),h=THREE.MathUtils.lerp(a[1],b[1],u),w=THREE.MathUtils.lerp(a[2],b[2],u);return h*Math.pow(Math.max(0,1-(x/w)**2),1.7);}return 0;}
 const features=(x,y)=>noseForm(x,y)-.005*Math.exp(-(((Math.abs(x)-.055)/.026)**2)-(((y-.173)/.019)**2))+.004*Math.exp(-(((Math.abs(x)-.070)/.025)**2)-(((y-.137)/.024)**2))+.002*Math.exp(-(((Math.abs(x)-.055)/.030)**2)-(((y-.20)/.010)**2));
 const surface=(x,y)=>radius(y,2)*Math.pow(Math.max(.001,1-(x/Math.max(.001,radius(y,1)))**2),.30)+features(x,y);
 const faceGeo=new THREE.SphereGeometry(1,96,80),fp=faceGeo.attributes.position;
 for(let i=0;i<fp.count;i++){const ny=fp.getY(i),y=.156+ny*.144,s=Math.sqrt(Math.max(.000001,1-ny*ny)),x=fp.getX(i)/s*radius(y,1),front=fp.getZ(i)>0;const z=front?surface(x,y):fp.getZ(i)/s*radius(y,2),rearLift=front?0:.060*(1-THREE.MathUtils.smoothstep(y,.012,.150))*THREE.MathUtils.smoothstep(-z,0,.04);fp.setXYZ(i,x,y+rearLift,z);}faceGeo.computeVertexNormals();const colors=[];for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i),z=fp.getZ(i),warm=Math.exp(-(((Math.abs(x)-.060)/.033)**2)-(((y-.137)/.025)**2))*(z>0?1:0),shadow=.10*Math.exp(-((x/.017)**2)-(((y-.114)/.008)**2))*(z>0?1:0);colors.push(1-shadow,.99-.07*warm-shadow,.98-.08*warm-shadow);}faceGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const faceMaterial=skin.clone();faceMaterial.vertexColors=true;faceMaterial.name='faceSkin';const face=mesh(head,faceGeo,faceMaterial);face.receiveShadow=false;
 ell(head,skin,0,.035,-.020,.045,.067,.045);
 for(const side of [-1,1]){
  const ear=ell(head,skin,side*.109,.151,-.004,.017,.029,.012);ear.rotation.z=-side*.22;
  ell(head,mat(0xb97558),side*.112,.150,.006,.008,.017,.003);
  const ex=side*.055,ey=.174,eyeGroup=new THREE.Group();head.add(eyeGroup);
  const g=new THREE.PlaneGeometry(1,1,32,16),p=g.attributes.position;
  for(let row=0;row<=16;row++)for(let col=0;col<=32;col++){const u=col/32,t=row/16,lx=-.025+u*.050,arch=Math.pow(Math.sin(u*Math.PI),.8),top=.012*arch-.001+u*.004,bottom=-.009*arch-.001+u*.004,x=ex+side*lx,y=ey+THREE.MathUtils.lerp(top,bottom,t);p.setXYZ(row*33+col,x,y,surface(x,y)+.0015);}g.computeVertexNormals();const eyeWhite=white.clone();eyeWhite.side=THREE.DoubleSide;eyeWhite.name='irisSurface';mesh(eyeGroup,g,eyeWhite).userData.eyeSide=side;
  const lid=[];for(let i=0;i<=16;i++){const t=i/16,x=ex+side*(-.025+t*.050),y=ey+Math.sin(t*Math.PI)*.012-.001+t*.004;lid.push([x,y,surface(x,y)+.002]);}stroke(eyeGroup,mat(0x603e32),lid,.0017);
  const bg=new THREE.PlaneGeometry(1,1,28,4),bp=bg.attributes.position;for(let row=0;row<=4;row++)for(let col=0;col<=28;col++){const u=col/28,x=ex+side*(-.027+u*.058),center=.203+.006*Math.sin(Math.PI*u)-.003*u,width=.007*Math.pow(1-u,.45)*(.7+.3*Math.sin(Math.PI*u)),y=center+(row/4-.5)*width;bp.setXYZ(row*29+col,x,y,surface(x,y)+.0015);}bg.computeVertexNormals();const bm=hair.clone();bm.side=THREE.DoubleSide;mesh(head,bg,bm).userData.faceDetail=true;
  const lower=[];for(let i=0;i<=16;i++){const u=i/16,x=ex+side*(-.025+u*.050),y=ey-.009*Math.pow(Math.sin(u*Math.PI),.8)-.001+u*.004;lower.push([x,y,surface(x,y)+.0018]);}stroke(eyeGroup,mat(0xb98568),lower,.0007);
  eyeGroup.position.y=ey;for(const part of eyeGroup.children)part.position.y-=ey;(root.userData.eyeGroups??=[]).push(eyeGroup);
 }
 // Restrained lip planes and a slight asymmetric expression, not an outlined grin.
 const seam=x=>.091+.0015*(x/.025)**2+.0008*x/.025;
 const mouth=[];for(let i=0;i<=24;i++){const x=-.025+i*.05/24,y=seam(x);mouth.push([x,y,surface(x,y)+.0012]);}stroke(head,mat(0x925b49),mouth,.0008).userData.faceDetail=true;
 function lipPlane(upper){const g=new THREE.PlaneGeometry(.05,1,32,4),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),u=p.getY(i)+.5,w=Math.pow(Math.max(0,1-(x/.025)**2),.8),height=upper?.0035:.0045,y=seam(x)+(upper?1:-1)*height*w*u;const bulge=.0015*Math.sin(u*Math.PI)*w;p.setXYZ(i,x,y,surface(x,y)+.0007+bulge);}g.computeVertexNormals();mesh(head,g,mat(upper?0xc28b70:0xdba786)).userData.faceDetail=true;}lipPlane(true);lipPlane(false);

 // Each lock has its own swept ridge, tapered tip and silhouette. Close cropped underlayer bridges the partings.
 const hairShadow=mat(0x492c20),hairMid=mat(0x5d3826),hairSun=mat(0x744c30);
 // Subtle crown lift and side fullness, fading out before the fringe tips and nape.
 function hairVolume(g){const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),w=THREE.MathUtils.smoothstep(y,.17,.29)*(1-THREE.MathUtils.smoothstep(z,.025,.075));p.setXYZ(i,x*(1+.07*w),y+.012*w,(z+.014)*(1+.05*w)-.014);}}
 function strand(control,width,thickness,material){
  const path=new THREE.CatmullRomCurve3(control.map(p=>new THREE.Vector3(...p))),g=new THREE.PlaneGeometry(1,1,8,20),p=g.attributes.position;let previousAcross=null;
  for(let row=0;row<=20;row++){const t=row/20,c=path.getPoint(t),tangent=path.getTangent(t).normalize(),normal=new THREE.Vector3(c.x*.8,(c.y-.18)*.65,c.z+.015).normalize(),across=new THREE.Vector3().crossVectors(tangent,normal).normalize();if(previousAcross){if(across.dot(previousAcross)<0)across.negate();across.lerp(previousAcross,.35).normalize();}previousAcross=across.clone();
   const taper=Math.pow(Math.max(0,1-t),.65)*(1+.12*Math.sin(t*Math.PI))*THREE.MathUtils.smoothstep(t,0,.09);
   for(let col=0;col<=8;col++){const v=col/4-1,ridge=Math.pow(Math.max(0,1-v*v),.75)*thickness*.25*taper;const pos=c.clone().addScaledVector(across,v*width*taper).addScaledVector(normal,ridge);p.setXYZ(row*9+col,pos.x,pos.y,pos.z);}
  }hairVolume(g);g.computeVertexNormals();const c=[];for(let row=0;row<=20;row++)for(let col=0;col<=8;col++){const t=row/20,v=col/4-1,streak=.018*Math.sin(v*17+t*3),tone=.94+.06*(1-v*v)+streak;c.push(tone,tone*.985,tone*.95);}g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));const m=material.clone();m.side=THREE.DoubleSide;m.vertexColors=true;mesh(head,g,m).receiveShadow=false;
 }
 // Occipital layers overlap toward a broken nape, never ending in a straight rim.
 for(let i=0;i<11;i++){const a=-Math.PI*.82+i/10*Math.PI*1.64,s=Math.sin(a),c=-Math.cos(a);strand([[s*.026,.285,c*.025-.018],[s*.083,.264,c*.081-.015],[s*.111,.204,c*.095-.012],[s*(.113+(i%3)*.005),.080+.055*s*s+(c>0?.020:0)+(i%3)*.005,c*.077-.017]],.034,.009,i%3===0?hairMid:hairShadow);}
 // Crown locks follow the skull's dome from a shared off-centre part.
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2,sn=Math.sin(a),cs=Math.cos(a),height=.311+(i%3)*.002;strand([[-.018,.306,-.016],[sn*.059-.01,height,cs*.045-.014],[sn*.103,.263,cs*.082-.012],[sn*.116,.200+(cs>0?.040:0),cs*.096-.012]],.033,.012,i%4===1?hairSun:hairMid);}
 // A close cropped underlayer is occluded by the longer locks except at their partings.
 const under=new THREE.SphereGeometry(1,40,24,0,Math.PI*2,0,Math.PI*.72),up=under.attributes.position;
 for(let j=0;j<=24;j++)for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,t=j/24*Math.PI*(.72-.31*Math.max(0,Math.sin(a))+.018*Math.sin(a*7)),sn=Math.sin(t);up.setXYZ(j*41+i,-Math.cos(a)*sn*.110,.181+Math.cos(t)*.127,Math.sin(a)*sn*.096-.014);}under.computeVertexNormals();mesh(head,under,hairMid).receiveShadow=false;
 for(let i=0;i<9;i++){const a=-Math.PI*.65+i/8*Math.PI*1.30,sn=Math.sin(a),cs=-Math.cos(a);strand([[sn*.080,.220,cs*.085-.014],[sn*.107,.198,cs*.101-.013],[sn*.114,.156,cs*.096-.015],[Math.sin(a+.12)*.113,.061+.055*sn*sn+(cs>0?.024:0)+(i%3)*.010,-Math.cos(a+.12)*.071-.020]],.029+(i%2)*.004,.009,i%3?hairMid:hairShadow);}
 // Fine diagonal locks bridge the broad rear masses, following the crown's sweep.
 for(let i=0;i<7;i++){const x=-.077+i*.024,z=-Math.sqrt(Math.max(.1,1-(x/.12)**2))*.106;strand([[x-.016,.254,z+.015],[x-.009,.223,z-.015],[x+.005,.186,z-.018],[x+.022,.126+(i%3)*.011,z+.005]],.012+(i%2)*.002,.004,i%3===0?hairSun:hairMid);}
 // Unequal fringe lengths expose the brows and split naturally across the forehead.
 strand([[.035,.294,.015],[.005,.300,.062],[-.035,.259,.102],[-.030,.202,.107]],.026,.010,hairMid);
 strand([[.019,.295,.025],[-.016,.286,.082],[-.064,.237,.105],[-.078,.178,.091]],.024,.009,hairMid);
 strand([[-.022,.288,.025],[-.061,.273,.067],[-.093,.221,.078],[-.113,.158,.065]],.025,.009,hairShadow);
 strand([[.051,.291,.015],[.052,.271,.074],[.059,.240,.108],[.039,.202,.108]],.024,.009,hairSun);
 strand([[.074,.280,-.008],[.099,.251,.037],[.111,.206,.055],[.095,.153,.063]],.024,.008,hairMid);
 strand([[-.063,.278,-.019],[-.102,.241,.010],[-.117,.188,.027],[-.121,.144,.017]],.022,.008,hairMid);
 strand([[.008,.292,.029],[-.018,.279,.087],[-.040,.246,.113],[-.047,.213,.110]],.012,.005,hairSun);
 strand([[-.046,.276,.028],[-.080,.247,.071],[-.099,.215,.084],[-.118,.186,.078]],.014,.006,hairMid);
 strand([[.072,.274,.003],[.094,.246,.050],[.115,.215,.064],[.123,.183,.058]],.013,.006,hairSun);
 // Small flyaways change the outer contour without becoming a spiky helmet.
 strand([[-.015,.293,-.010],[-.034,.310,.004],[-.054,.318,.011],[-.071,.313,.008]],.016,.006,hairMid);
 strand([[.038,.287,-.041],[.065,.302,-.044],[.084,.298,-.057],[.096,.288,-.069]],.017,.006,hairShadow);
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
