export default function(THREE) {
 const root=new THREE.Group(), joints={};root.userData.joints=joints;root.userData.keepHierarchy=true;root.userData.anatomicalHands=true;
 const mat=(c,n='fabric',r=.86)=>Object.assign(new THREE.MeshStandardMaterial({color:c,roughness:r}),{name:n});
 const skin=mat(0xd7a27f), coral=mat(0xc95845), lining=mat(0xa04c47), cream=mat(0xebe0c5), teal=mat(0x244f52), hair=mat(0x543321), hairLight=mat(0x72472f), leather=mat(0x625249), eye=mat(0x253333), white=mat(0xf6ecdb), copper=mat(0xb88754,'metal',.45), gem=mat(0x4ea99f,'metal',.3);
 const mesh=(p,g,m,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=o.receiveShadow=true;p.add(o);return o;};
 const ell=(p,m,x,y,z,a,b,c)=>mesh(p,new THREE.SphereGeometry(1,16,12),m,x,y,z,a,b,c);
 const box=(p,m,x,y,z,a,b,c)=>mesh(p,new THREE.BoxGeometry(a,b,c),m,x,y,z);
 const taper=(p,m,x,y,z,rt,rb,h,depth=1,n=10)=>mesh(p,new THREE.CylinderGeometry(rt,rb,h,n),m,x,y,z,1,1,depth);
 const pivot=(n,p,x,y,z)=>{const o=new THREE.Group();o.name=n;o.position.set(x,y,z);p.add(o);joints[n]=o;return o;};
 const profile=(p,m,points,x,y,z,depth=.04)=>{const s=new THREE.Shape();points.forEach(([a,b],i)=>i?s.lineTo(a,b):s.moveTo(a,b));s.closePath();return mesh(p,new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.008,bevelThickness:.007}),m,x,y,z-depth/2);};
 const stroke=(p,m,points,r=.006)=>mesh(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),10,r,5,false),m);
 const lathe=(p,m,points,x,y,z,sx=1,sz=1)=>mesh(p,new THREE.LatheGeometry(points.map(v=>new THREE.Vector2(...v)),12),m,x,y,z,sx,1,sz);
 // Outfit details (R-hero pass): many small parts baked into ONE vertex-coloured mesh per pivot, so trims,
 // buttons, tails, patches and wraps cost one draw each pivot. put(geo,hex,x,y,z,rx,ry,rz,sx,sy,sz); rope(points,r0,hex,r1).
 const detailMat=Object.assign(new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.82,side:THREE.DoubleSide}),{name:'fabric'});
 function details(parent,build){
  const parts=[],E=new THREE.Euler(),Q=new THREE.Quaternion();
  const put=(geo,hex,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>parts.push([geo,hex,new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),Q.clone().setFromEuler(E.set(rx,ry,rz)),new THREE.Vector3(sx,sy,sz))]);
  const rope=(pts,r0,hex,r1=r0,radial=5)=>{const c=new THREE.CatmullRomCurve3(pts.map(v=>new THREE.Vector3(...v))),n=Math.max(4,pts.length*2),g=new THREE.TubeGeometry(c,n,1,radial,false),a=g.attributes.position,v=new THREE.Vector3(),q=new THREE.Vector3();
   for(let i=0;i<=n;i++){c.getPointAt(i/n,q);const r=r0+(r1-r0)*i/n;for(let j=0;j<=radial;j++){const k=i*(radial+1)+j;v.fromBufferAttribute(a,k).sub(q).normalize().multiplyScalar(r).add(q);a.setXYZ(k,v.x,v.y,v.z);}}g.computeVertexNormals();put(g,hex);};
  build(put,rope);
  const pos=[],nor=[],col=[],c=new THREE.Color();
  for(const [geo,hex,m] of parts){const g=geo.index?geo.toNonIndexed():geo.clone();g.applyMatrix4(m);if(!g.attributes.normal)g.computeVertexNormals();pos.push(...g.attributes.position.array);nor.push(...g.attributes.normal.array);c.set(hex);for(let i=0;i<g.attributes.position.count;i++)col.push(c.r,c.g,c.b);g.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  return mesh(parent,g,detailMat);
 }
 const TRIM=0x2f6f6a,BRASS=0xd9a441,CORALC=0xc95845,CREAMC=0xebe0c5,LEATHER_L=0x8f6d4f,LEATHER_D=0x4f3d34,PATCH=0x1f4749,STITCH=0x5f8a82;

 // Curved cloth sections retain a soft silhouette and a few broad folds under cel light.
 function garment(parent,material,sections,fold=.003,open=false){const g=new THREE.CylinderGeometry(1,1,1,20,sections.length>3?9:4,open),p=g.attributes.position,low=sections[0][0],high=sections.at(-1)[0];for(let i=0;i<p.count;i++){const t=p.getY(i)+.5,y=low+(high-low)*t,x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x),r=Math.hypot(x,z);let rx=sections[0][1],rz=sections[0][2];for(let j=1;j<sections.length;j++)if(y>=sections[j-1][0]&&y<=sections[j][0]){const A=sections[j-1],B=sections[j],u=(y-A[0])/(B[0]-A[0]);rx=THREE.MathUtils.lerp(A[1],B[1],u);rz=THREE.MathUtils.lerp(A[2],B[2],u);}const f=fold*.35*Math.sin(t*Math.PI)*Math.sin(a*6+.3);p.setXYZ(i,Math.cos(a)*(rx+f)*r,y,Math.sin(a)*(rz+f)*r);}g.computeVertexNormals();const result=mesh(parent,g,material);result.receiveShadow=false;return result;}
 // Fitted tunic, with waist gathers and a softer shoulder line.
 const hips=pivot('hips',root,0,.78,0);
 ell(hips,teal,0,0,-.005,.126,.105,.076);
 garment(hips,coral,[[.022,.111,.072],[.075,.122,.078],[.16,.137,.088],[.25,.153,.092],[.30,.164,.085],[.365,.098,.060]],.004).userData.chestPiece=true;

 garment(hips,leather,[[.024,.122,.085],[.057,.122,.085]],0);
 // Framed buckle shows the belt through its centre.
 for(const side of [-1,1])box(hips,copper,.009+side*.024,.041,.091,.006,.035,.009);
 for(const y of [.026,.056])box(hips,copper,.009,y,.091,.050,.006,.009);
 box(hips,copper,.009,.041,.096,.030,.004,.006);
 const head=pivot('head',hips,0,.371,0);head.scale.setScalar(.80);

 // Continuous face with a cheek/jaw profile; all contours are authored functions.
 const faceProfile=[[.012,0,0],[.027,.017,.044],[.038,.033,.065],[.069,.073,.083],[.100,.089,.086],[.139,.107,.092],[.170,.102,.093],[.207,.099,.094],[.251,.094,.084],[.285,.060,.058],[.300,0,0]];
 function radius(y,k){for(let i=1;i<faceProfile.length;i++)if(y<=faceProfile[i][0]){const a=faceProfile[i-1],b=faceProfile[i],prev=faceProfile[Math.max(0,i-2)],next=faceProfile[Math.min(faceProfile.length-1,i+1)],h=b[0]-a[0],u=THREE.MathUtils.clamp((y-a[0])/h,0,1),m0=(b[k]-prev[k])/(b[0]-prev[0]),m1=(next[k]-a[k])/(next[0]-a[0]);return Math.max(0,(2*u*u*u-3*u*u+1)*a[k]+(u*u*u-2*u*u+u)*h*m0+(-2*u*u*u+3*u*u)*b[k]+(u*u*u-u*u)*h*m1);}return 0;}
 function noseForm(x,y){const knots=[[.110,0,.018],[.120,.023,.017],[.128,.026,.013],[.148,.015,.010],[.174,.003,.010],[.191,0,.012]];for(let i=1;i<knots.length;i++)if(y>=knots[i-1][0]&&y<=knots[i][0]){const a=knots[i-1],b=knots[i],u=(y-a[0])/(b[0]-a[0]),h=THREE.MathUtils.lerp(a[1],b[1],u),w=THREE.MathUtils.lerp(a[2],b[2],u);return h*Math.pow(Math.max(0,1-(x/w)**2),1.7);}return 0;}
 const features=(x,y)=>noseForm(x,y)-.005*Math.exp(-(((Math.abs(x)-.055)/.030)**2)-(((y-.173)/.024)**2))+.004*Math.exp(-(((Math.abs(x)-.070)/.025)**2)-(((y-.137)/.024)**2))+.002*Math.exp(-(((Math.abs(x)-.055)/.030)**2)-(((y-.20)/.010)**2));
 const surface=(x,y)=>radius(y,2)*Math.pow(Math.max(.001,1-(x/Math.max(.001,radius(y,1)))**2),.30)+features(x,y);
 const faceGeo=new THREE.SphereGeometry(1,96,80),fp=faceGeo.attributes.position;
 for(let i=0;i<fp.count;i++){const ny=fp.getY(i),y=.156+ny*.144,s=Math.sqrt(Math.max(.000001,1-ny*ny)),x=fp.getX(i)/s*radius(y,1),front=fp.getZ(i)>0;const z=front?surface(x,y):fp.getZ(i)/s*radius(y,2),rearLift=front?0:.060*(1-THREE.MathUtils.smoothstep(y,.012,.150))*THREE.MathUtils.smoothstep(-z,0,.04);fp.setXYZ(i,x,y+rearLift,z);}faceGeo.computeVertexNormals();const colors=[];for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i),z=fp.getZ(i),warm=Math.exp(-(((Math.abs(x)-.060)/.033)**2)-(((y-.137)/.025)**2))*(z>0?1:0),shadow=.10*Math.exp(-((x/.017)**2)-(((y-.114)/.008)**2))*(z>0?1:0);colors.push(1-shadow,.99-.07*warm-shadow,.98-.08*warm-shadow);}faceGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const faceMaterial=skin.clone();faceMaterial.vertexColors=true;faceMaterial.name='faceSkin';const face=mesh(head,faceGeo,faceMaterial);face.receiveShadow=false;
 // One narrow neck follows the jaw into the skull; no overlapping rear ellipsoid.
 const neckGeo=new THREE.CylinderGeometry(1,1,1,32,12),np=neckGeo.attributes.position;
 for(let i=0;i<np.count;i++){const t=np.getY(i)+.5,y=-.060+t*.155,x=np.getX(i),z=np.getZ(i),rx=.034+.014*(1-t)**3+.010*t**4,rz=.027+.008*(1-t)**3+.007*t**4;np.setXYZ(i,x*rx,y,z*rz-.025);}
 neckGeo.computeVertexNormals();mesh(head,neckGeo,skin).receiveShadow=false;
 for(const side of [-1,1]){
  const ear=ell(head,skin,side*.109,.151,-.004,.017,.029,.012);ear.rotation.z=-side*.22;
  ell(head,mat(0xb97558),side*.112,.150,.006,.008,.017,.003);
  const ex=side*.055,ey=.174,eyeGroup=new THREE.Group();head.add(eyeGroup);
  const g=new THREE.PlaneGeometry(1,1,32,16),p=g.attributes.position;
  for(let row=0;row<=16;row++)for(let col=0;col<=32;col++){const u=col/32,t=row/16,lx=-.029+u*.058,arch=Math.pow(Math.sin(u*Math.PI),.8),top=.017*arch-.001+u*.004,bottom=-.013*arch-.001+u*.004,x=ex+side*lx,y=ey+THREE.MathUtils.lerp(top,bottom,t);p.setXYZ(row*33+col,x,y,surface(x,y)+.0015);}g.computeVertexNormals();const eyeWhite=white.clone();eyeWhite.side=THREE.DoubleSide;eyeWhite.name='irisSurface';mesh(eyeGroup,g,eyeWhite).userData.eyeSide=side;
  const lid=[];for(let i=0;i<=16;i++){const t=i/16,x=ex+side*(-.029+t*.058),y=ey+Math.sin(t*Math.PI)*.017-.001+t*.004;lid.push([x,y,surface(x,y)+.002]);}stroke(eyeGroup,mat(0x603e32),lid,.0017);
  const bg=new THREE.PlaneGeometry(1,1,28,4),bp=bg.attributes.position;for(let row=0;row<=4;row++)for(let col=0;col<=28;col++){const u=col/28,x=ex+side*(-.027+u*.058),center=.203+.006*Math.sin(Math.PI*u)-.003*u,width=.007*Math.pow(1-u,.45)*(.7+.3*Math.sin(Math.PI*u)),y=center+(row/4-.5)*width;bp.setXYZ(row*29+col,x,y,surface(x,y)+.0015);}bg.computeVertexNormals();const bm=hair.clone();bm.side=THREE.DoubleSide;mesh(head,bg,bm).userData.faceDetail=true;
  const lower=[];for(let i=0;i<=16;i++){const u=i/16,x=ex+side*(-.029+u*.058),y=ey-.013*Math.pow(Math.sin(u*Math.PI),.8)-.001+u*.004;lower.push([x,y,surface(x,y)+.0018]);}stroke(eyeGroup,mat(0xb98568),lower,.0007);
  eyeGroup.position.y=ey;for(const part of eyeGroup.children)part.position.y-=ey;(root.userData.eyeGroups??=[]).push(eyeGroup);
 }
 // Restrained lip planes and a slight asymmetric expression, not an outlined grin.
 const seam=x=>.091+.0015*(x/.025)**2+.0008*x/.025;
 const mouth=[];for(let i=0;i<=24;i++){const x=-.025+i*.05/24,y=seam(x);mouth.push([x,y,surface(x,y)+.0012]);}stroke(head,mat(0x925b49),mouth,.0008).userData.faceDetail=true;
 function lipPlane(upper){const g=new THREE.PlaneGeometry(.05,1,32,4),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),u=p.getY(i)+.5,w=Math.pow(Math.max(0,1-(x/.025)**2),.8),height=upper?.0035:.0045,y=seam(x)+(upper?1:-1)*height*w*u;const bulge=.0015*Math.sin(u*Math.PI)*w;p.setXYZ(i,x,y,surface(x,y)+.0007+bulge);}g.computeVertexNormals();mesh(head,g,mat(upper?0xc28b70:0xdba786)).userData.faceDetail=true;}lipPlane(true);lipPlane(false);

 // Short boyish cut from R-hero: a close sculpted cap above the ears, chunky pointed clumps swept back on top, a side-swept fringe clear of the eyes.
 const hairShadow=mat(0x241a24),hairMid=mat(0x352733),hairSun=mat(0x4b3747);
 const scalp=new THREE.SphereGeometry(1,48,28,0,Math.PI*2,0,Math.PI*.76),sp=scalp.attributes.position;
 // Coverage by direction: down to the nape at the back (slightly ragged), above the ears at the sides, a clean hairline over the brow at the front.
 for(let j=0;j<=28;j++)for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,f=Math.max(0,Math.sin(a)),b=Math.max(0,-Math.sin(a)),tooth=1-Math.abs((i+1)%6-3)/3,cover=Math.PI*(.40*f+.50*(1-f)+b**.75*(.19+.06*tooth+.012*Math.sin(a*5+1))),t=j/28*cover,sn=Math.sin(t);sp.setXYZ(j*49+i,-Math.cos(a)*sn*.124,.185+Math.cos(t)*.160*(1+.10*Math.max(0,Math.cos(t))*(1-f*Math.sin(t))),Math.sin(a)*sn*.119-.022);}
 // Shrink-wrap the lower back and behind-ear coverage onto the skull, so the nape hair hugs the head instead of flaring into a cap rim.
 const skullPts=[];for(let i=0;i<fp.count;i++)if(fp.getZ(i)<.03)skullPts.push(new THREE.Vector3(fp.getX(i),fp.getY(i),fp.getZ(i)));
 // Back-of-head surface point (skull, or neck below it), pushed out by `off`: nape locks are laid on the real form.
 const neckZ=y=>{const t=THREE.MathUtils.clamp((y+.06)/.155,0,1);return -.025-(.027+.008*(1-t)**3+.007*t**4);};
 const onBack=(x,y,off)=>{let best=1,z=0;for(const p of skullPts){if(p.z>-.01)continue;const e=(p.x-x)**2+(p.y-y)**2;if(e<best){best=e;z=p.z;}}const nz=Math.abs(x)<.03?neckZ(y):0;return [x,y,(best<.00015?Math.min(z,nz):nz)-off];};
 {const v=new THREE.Vector3();for(let i=0;i<sp.count;i++){v.fromBufferAttribute(sp,i);const w=(1-THREE.MathUtils.smoothstep(v.y,.150,.230))*THREE.MathUtils.smoothstep(-v.z,.02,.06);if(w<=0)continue;const z=onBack(v.x,v.y,.006)[2];sp.setZ(i,THREE.MathUtils.lerp(v.z,Math.min(z,v.z+.004),w));}}
 scalp.computeVertexNormals();mesh(head,scalp,hairMid).receiveShadow=false;
 // Point on the (wrapped) hair shell nearest (x,y) on the back half, pushed out by `off`: behind-ear locks sit on it, not inside the head.
 const onScalp=(x,y,off)=>{let best=1,z=0;for(let i=0;i<sp.count;i++){const pz=sp.getZ(i);if(pz>-.01)continue;const e=(sp.getX(i)-x)**2+(sp.getY(i)-y)**2;if(e<best){best=e;z=pz;}}return [x,y,z-off];};
 // One clump: a rounded-base, pointed, flattened lathe laid along base→tip, flat face turned away from the skull, tip curling back toward it.
 function clump(base,tip,width,thick,curl,material){
  const B=new THREE.Vector3(...base),T=new THREE.Vector3(...tip),dir=T.clone().sub(B),len=dir.length();dir.normalize();
  const g=new THREE.LatheGeometry([[0,0],[.60,.05],[.95,.18],[1,.32],[.80,.55],[.45,.78],[.15,.93],[0,1]].map(([r,y])=>new THREE.Vector2(r,y*len)),14),q=g.attributes.position;
  for(let i=0;i<q.count;i++){const v=q.getY(i)/len;q.setXYZ(i,q.getX(i)*width,q.getY(i),q.getZ(i)*thick-curl*v*v);}
  const out=B.clone().add(T).multiplyScalar(.5).sub(new THREE.Vector3(0,.19,-.02));out.addScaledVector(dir,-out.dot(dir)).normalize();
  g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(dir,out).normalize(),dir,out));g.translate(B.x,B.y,B.z);g.computeVertexNormals();
  mesh(head,g,material).receiveShadow=false;}
 // Crown volume sweeping back low and wide, so the silhouette stays rounded rather than spiky.
 clump([-.040,.315,.040],[-.050,.350,-.090],.060,.022,.018,hairMid);
 clump([.030,.315,.030],[.045,.350,-.100],.058,.022,.018,hairSun);
 clump([.000,.280,-.070],[.000,.290,-.170],.056,.020,.012,hairMid);
 // Heavier side-swept fringe, tips resting above the brow line.
 clump([-.070,.300,.070],[.020,.245,.125],.042,.022,.010,hairSun);
 clump([-.020,.310,.060],[.070,.240,.118],.040,.022,.010,hairMid);
 clump([.040,.300,.050],[.110,.235,.085],.032,.020,.010,hairMid);
 // Short sides hugging the head above the ears, blending behind the ears down into the nape.
 for(const side of [-1,1]){clump([side*.098,.270,.020],[side*.118,.210,-.020],.028,.010,.006,hairMid);clump([side*.085,.230,-.070],[side*.095,.150,-.100],.028,.010,.006,hairMid);
  clump(onScalp(side*.090,.180,.004),onScalp(side*.082,.105,.010),.026,.009,.006,hairShadow);clump(onScalp(side*.068,.150,.004),onBack(side*.062,.072,.010),.024,.009,.006,side<0?hairMid:hairShadow);}
 // Back of the head, the view the game camera sees most: layered locks falling from the crown to the nape so it reads as hair, not a cap.
 for(let i=0;i<5;i++){const u=(i-2)/2,x=u*.085;clump([x*.5,.310,-.086],[x*1.10,.150+Math.abs(u)*.024,-.170+Math.abs(u)*.022],.054,.020,.020,i===2?hairMid:i%2?hairShadow:hairMid);}
 for(let i=0;i<4;i++){const u=(i-1.5)/1.5,x=u*.070,drop=[.004,-.012,.008,-.006][i];clump(onBack(x*.6,.225,.002),onBack(x*1.1,.100+drop,.014),.042,.014,.012,hairShadow);}
 // Soft, slightly ragged nape: short tapered locks lying on the skull, tips just over the top of the neck.
 for(let i=0;i<7;i++){const u=(i-3)/3,x=u*.058,tipY=.054+Math.abs(u)*.018+[.006,-.006,.008,-.004,.010,-.008,.004][i];clump(onBack(x,.140,.000),onBack(x*1.08+(i%2?.004:-.004),tipY,.004),.030-Math.abs(u)*.005,.009,.011,i%2?hairMid:hairShadow);}
 // Tufts that break the cap's rim: sideburns in front of the ears and short flicks behind them.
 for(const side of [-1,1]){clump([side*.108,.215,.030],[side*.118,.168,.042],.020,.009,.004,hairMid);clump([side*.110,.225,-.040],[side*.126,.170,-.062],.024,.010,.006,hairMid);clump([side*.096,.205,-.090],[side*.108,.150,-.112],.024,.010,.006,hairShadow);}
 root.userData.faceStudy=true;


 for(const side of [-1,1]){
  const pre=side<0?'left':'right';const leg=pivot(pre+'UpperLeg',hips,side*.075,-.025,0);
  garment(leg,teal,[[-.33,.054,.049],[-.27,.062,.052],[-.15,.077,.061],[-.04,.078,.061],[.005,.070,.058]],.0025);
  const knee=pivot(pre+'LowerLeg',leg,0,-.335,0);ell(knee,teal,0,0,.007,.055,.052,.05);
  details(knee,(put,rope)=>{
   { // subtle irregular patch shaped to the knee: a jittered, slightly darker teal pad with dashed stitches
    const g=new THREE.SphereGeometry(1,10,6),q=g.attributes.position;for(let i=0;i<q.count;i++){const x=q.getX(i),y=q.getY(i),z=q.getZ(i),a=Math.atan2(y,x),k=1+.16*Math.sin(a*3+side)+.08*Math.sin(a*5);q.setXYZ(i,x*k,y*k,z);}g.computeVertexNormals();
    put(g,PATCH,side*.006,-.024,.049,-.2,0,side*.3,.027,.031,.006);
    for(let i=0;i<9;i++){const a=i/9*Math.PI*2,k=1+.16*Math.sin(a*3+side)+.08*Math.sin(a*5),x=side*.006+Math.cos(a+side*.3)*.025*k,y=-.024+Math.sin(a+side*.3)*.029*k;
     rope([[x,y,.056],[x+Math.cos(a+1.6)*.004,y+Math.sin(a+1.6)*.004,.056]],.0011,STITCH);}
   }
   put(new THREE.LatheGeometry([[.05,-.258],[.056,-.215],[.059,-.17],[.058,-.13],[.061,-.115]].map(v=>new THREE.Vector2(...v)),14),LEATHER_L,0,0,.002,0,0,0,1,1,.86);   // boot shaft
   put(new THREE.TorusGeometry(.06,.008,6,16),LEATHER_D,0,-.117,.002,Math.PI/2,0,0,1,.86,1);                                // folded boot top
   for(let k=0;k<4;k++){const pts=[];for(let i=0;i<=8;i++){const a=i/8*Math.PI*2+k*.9,y=-.245+k*.032+i/8*.028;pts.push([Math.sin(a)*.061,y,Math.cos(a)*.061*.86+.002]);}rope(pts,.0045,LEATHER_D);}   // leather bindings
  });
  garment(knee,teal,[[-.215,.033,.031],[-.19,.043,.038],[-.12,.057,.047],[-.035,.056,.050],[.015,.053,.048]],.003);
  // Inner boot tongue bridges ankle flexion without exposing a gap under the trousers.
  taper(knee,leather,0,-.240,0,.029,.027,.14,.9,12);
  const foot=pivot(pre+'Foot',knee,0,-.300,.012);
  garment(foot,leather,[[-.045,.046,.043],[.015,.044,.042],[.09,.055,.045],[.12,.056,.046]],.0018).position.z=-.010;
  ell(foot,leather,0,-.040,.032,.051,.044,.098);
  const sole=ell(foot,mat(0x342d29),0,-.073,.032,.052,.014,.099);
  garment(foot,mat(0x88705a),[[.084,.057,.048],[.118,.059,.050]],.001).position.z=-.010;
  for(const x of [-.022,.022])stroke(foot,mat(0xa48b68),[[x,-.045,.110],[x,-.025,.091],[x,.008,.047],[x,.060,.034]],.0014);
  const buckle=box(foot,copper,side*.053,.085,.008,.006,.018,.019);
  for(let j=0;j<3;j++)stroke(foot,mat(0xb39b79),[[-.019,-.019+j*.018,.075-j*.015],[.019,-.012+j*.018,.075-j*.015]],.0018);
  const arm=pivot(pre+'UpperArm',hips,side*.155,.286,0);arm.rotation.z=side*.20;
  garment(arm,coral,[[-.196,.049,.046],[-.14,.061,.052],[-.07,.069,.058],[.025,.060,.051]],.0035);
  garment(arm,cream,[[-.208,.052,.049],[-.19,.057,.051],[-.171,.054,.049]],.0015);
  const fore=pivot(pre+'LowerArm',arm,0,-.217,0);fore.rotation.x=-.13;
  ell(fore,skin,0,-.012,0,.044,.036,.042);
  garment(fore,skin,[[-.183,.031,.030],[-.12,.037,.034],[-.055,.045,.039],[.004,.044,.040]],0);
  garment(fore,leather,[[-.187,.035,.033],[-.138,.040,.037]],0);
  stroke(fore,mat(0xa48b68),[[side*.035,-.178,.012],[side*.039,-.148,.014]],.0015);
  const hand=pivot(pre+'Hand',fore,0,-.196,.005);
  // User-approved Option D is the authored hand orientation.
  // Keep the animation joint unchanged so the correction persists through every clip.
  const handSide=side,handShape=new THREE.Group();handShape.name=pre+'HandShape';
  hand.add(handShape);
  ell(handShape,skin,0,.004,0,.021,.024,.018).receiveShadow=false;
  // Human relaxed hands: continuous palm, four graduated fingers and an opposed thumb.
  const palmGeo=new THREE.SphereGeometry(1,14,10),palmPos=palmGeo.attributes.position;
  for(let i=0;i<palmPos.count;i++){const x=palmPos.getX(i),y=palmPos.getY(i),z=palmPos.getZ(i),width=.029*(.88+.12*(1-y));palmPos.setXYZ(i,x*width,-.026+y*.031,z*.015);}
  palmGeo.computeVertexNormals();mesh(handShape,palmGeo,skin).receiveShadow=false;
  details(handShape,(put,rope)=>{ // fingerless glove: back plate, knuckle band, wrist cuff
   put(new THREE.SphereGeometry(1,12,8),LEATHER_D,0,-.02,-.011,0,0,0,.03,.03,.008);
   rope([[-.03,-.043,-.006],[0,-.047,-.012],[.03,-.043,-.006]],.0055,LEATHER_D);
   put(new THREE.TorusGeometry(.025,.0065,6,14),LEATHER_L,0,.004,0,Math.PI/2,0,0,1,.8,1);
  }).receiveShadow=false;
  function digit(points,radius){const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),g=new THREE.TubeGeometry(curve,8,1,6,false),p=g.attributes.position;
   for(let row=0;row<=8;row++){const t=row/8,c=curve.getPoint(t),r=radius*(1-.30*t);for(let col=0;col<=6;col++){const i=row*7+col;p.setXYZ(i,c.x+(p.getX(i)-c.x)*r,c.y+(p.getY(i)-c.y)*r,c.z+(p.getZ(i)-c.z)*r);}}
   g.computeVertexNormals();mesh(handShape,g,skin).receiveShadow=false;const tip=points.at(-1);ell(handShape,skin,...tip,radius*.70,radius*.70,radius*.70).receiveShadow=false;
  }
  const lengths=[.042,.048,.045,.035];
  for(let i=0;i<4;i++){const x=-handSide*(-.0225+i*.015),length=lengths[i],base=-.046+(i===3?.004:0);digit([[x,base,0],[x,base-length*.45,.003],[x,base-length*.76,.016],[x+handSide*.002,base-length*.90,.028]],.0082-(i===3?.001:0));}
  digit([[handSide*.025,-.015,.001],[handSide*.040,-.028,.009],[handSide*.040,-.045,.018],[handSide*.034,-.052,.024]],.010);
  const coat=pivot(side<0?'coatLeft':'coatRight',hips,side*.064,.050,-.041);
  profile(coat,coral,[[-.075,0],[.059,.015],[.095,-.075],[.090,-.173],[-.071,-.157]],0,0,0,.014).rotation.y=side*.21;
  stroke(coat,lining,[[-.063,-.150,.015],[.030,-.159,.015],[.084,-.164,.015]],.002);
 }

 // A continuous rear tunic panel covers the seat and joins the shorter side tails.
 const rearCloth=new THREE.PlaneGeometry(1,1,32,6),rp=rearCloth.attributes.position;
 for(let row=0;row<=6;row++)for(let col=0;col<=32;col++){const t=col/32,u=row/6,a=Math.PI*.5+t*Math.PI,r=THREE.MathUtils.lerp(.122,.146,u),bottom=-.115-.025*Math.sin(t*Math.PI);rp.setXYZ(row*33+col,Math.sin(a)*r,THREE.MathUtils.lerp(.033,bottom,u),Math.cos(a)*r*.67-.004);}
 rearCloth.computeVertexNormals();const rearMaterial=coral.clone();rearMaterial.side=THREE.DoubleSide;mesh(hips,rearCloth,rearMaterial).receiveShadow=false;
 const rearHem=[];for(let i=0;i<=32;i++){const t=i/32,a=Math.PI*.5+t*Math.PI;rearHem.push([Math.sin(a)*.146,-.115-.025*Math.sin(t*Math.PI),Math.cos(a)*.146*.67-.004]);}stroke(hips,lining,rearHem,.0018);

 // Diagonal cape is an articulated shoulder garment, not a rigid neck ring.
 const cape=pivot('cape',hips,0,.325,-.007);cape.scale.set(.89,.64,.94);
 // A closed shoulder drape: shared curved surface from neckline over both
 // shoulders to its diagonal hem; inner shell gives the cloth a real edge.
 const segments=44,rings=10,verts=[],indices=[];
 function drape(u,a,inside=false){
  const sn=Math.sin(a),cs=Math.cos(a),ease=Math.sin(u*Math.PI/2);
  const rx=.069+.155*ease+.025*ease**4,rz=.061+.076*ease;
  const low=-.045-.085*Math.max(0,-sn)*(.65+.35*Math.max(0,cs))-.040*Math.max(0,-cs);
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
 const hem=[];for(let i=0;i<=44;i++)hem.push(drape(1,i/44*Math.PI*2));mesh(cape,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hem.map(v=>new THREE.Vector3(...v))),44,.0038,4,false),cream);
 // Raised fold ridges converge at the copper fastening, not arbitrary plates.
 stroke(cape,cream,[[-.185,-.066,.070],[-.121,-.021,.117],[-.045,.006,.125],[.067,.010,.104]],.0045);
 stroke(cape,cream,[[-.165,-.094,.083],[-.108,-.061,.131],[-.026,-.037,.143],[.077,-.011,.112]],.0038);
 ell(cape,copper,.080,-.013,.119,.024,.030,.009);ell(cape,gem,.080,-.011,.129,.015,.023,.007);
 const strap=box(hips,leather,-.025,.192,.109,.022,.285,.012);strap.rotation.z=-.43;
 ell(hips,leather,-.143,-.014,-.008,.057,.071,.047);
 profile(hips,leather,[[-.052,.028],[.050,.028],[.045,-.011],[0,-.030],[-.049,-.013]],-.143,0,.033,.012);
 box(hips,copper,-.143,-.009,.049,.017,.021,.007);
 for(let i=0;i<3;i++)ell(hips,copper,.052,.102+i*.059,.106,.009,.009,.005);

 lathe(hips,copper,[[.019,0],[.017,.007],[.011,.027],[0,.034]],.028,.185,.132);stroke(hips,leather,[[.028,.225,.131],[.028,.245,.126]],.0025);
 // ---- R-hero outfit details ----
 details(hips,(put,rope)=>{ // upper coat: standing collar with teal edge, cream undershirt, placket trim, brass buttons
  put(new THREE.TorusGeometry(.066,.017,8,24),CORALC,0,.338,-.004,Math.PI/2-.12,0,0,1,.86,1);
  put(new THREE.TorusGeometry(.068,.006,6,24),TRIM,0,.353,-.002,Math.PI/2-.12,0,0,1,.86,1);
  put(new THREE.SphereGeometry(1,12,8),CREAMC,0,.318,.068,.3,0,0,.03,.03,.01);
  rope([[.026,.33,.074],[.042,.27,.093],[.049,.18,.097],[.05,.085,.092]],.0058,TRIM);
  for(let i=0;i<4;i++)put(new THREE.SphereGeometry(1,10,8),BRASS,.07,.1+i*.058,.101,0,0,0,.011,.011,.0065);
 }).userData.chestPiece=true;
 details(hips,(put,rope)=>{ // lower coat: long split tails at the back, teal-trimmed hems, a small tool on the belt
  for(const s of [-1,1]){
   const cols=12,rows=9,v=[],idx=[],edge=[],inner=[];
   for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const u=i/cols,t=j/rows,a=Math.PI+s*(.11+u*1.13),r=.146+.05*t+.006*Math.sin(u*9)*t,y=.052-.37*t+.03*t*Math.sin(u*Math.PI);v.push(Math.sin(a)*r,y,Math.cos(a)*r*.74-.004);}
   for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;idx.push(a,c,b,b,c,d);}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();put(g,CORALC);
   const at=(u,t)=>{const a=Math.PI+s*(.11+u*1.13),r=.146+.05*t+.006*Math.sin(u*9)*t,y=.052-.37*t+.03*t*Math.sin(u*Math.PI);return [Math.sin(a)*r,y,Math.cos(a)*r*.74-.004];};
   for(let i=0;i<=12;i++)edge.push(at(i/12,1));for(let j=0;j<=9;j++)inner.push(at(0,j/9));
   rope(edge,.0055,TRIM);rope(inner,.0055,TRIM);
  }
  const hem=[];for(let i=0;i<=14;i++){const a=-1.15+i/14*2.3;hem.push([Math.sin(a)*.114,.024,Math.cos(a)*.075]);}rope(hem,.0055,TRIM);
  rope([[-.075,.025,.086],[-.08,-.03,.088]],.0045,0xb88754);put(new THREE.TorusGeometry(.011,.0038,6,12,Math.PI*1.5),0xb88754,-.08,-.04,.089,0,0,Math.PI*.75);   // wrench on the belt
 });
 // Separate chest articulation gives purposeful upper-body effort without tilting planted legs.
 const upperChildren=hips.children.filter(o=>['head','cape','leftUpperArm','rightUpperArm'].includes(o.name)||(o.isMesh&&(o.position.y>=.075||o.userData.chestPiece)));
 const chest=pivot('chest',hips,0,.065,0);
 root.updateMatrixWorld(true);for(const child of upperChildren)chest.attach(child);
 // Retain selected-A rig origin and scale exactly; polish must not move grips or joints.
 root.children.forEach(c=>{c.position.y-=.03;c.position.z-=.013706070616841315;});root.scale.setScalar(1.0844553078580534);
 joints.rightHand.userData.grip={position:[0,-.054,.026],rotation:[0,0,0]};root.userData.grip=joints.rightHand;
 root.userData.anatomy={height:1.60,upperLeg:.34,lowerLeg:.34,upperArm:.215,lowerArm:.19};
 return root;
}
