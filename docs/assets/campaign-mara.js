export default function(T){
 const g=new T.Group();g.userData.keepHierarchy=true;
 const mat=(c,n='fabric',r=.85)=>Object.assign(new T.MeshStandardMaterial({color:c,roughness:r}),{name:n});
 const teal=mat('#284f50'),seam=mat('#40676a'),apron=mat('#ad915b'),skin=mat('#cfa27f'),hair=mat('#c1c6bf'),hairShade=mat('#85968f'),boot=mat('#554940'),copper=mat('#b76f48','metal',.42),eye=mat('#293c38'),lip=mat('#9d6d58');
 const mesh=(parent,geo,m,x=0,y=0,z=0)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 const ell=(p,m,x,y,z,a,b,c)=>{const o=mesh(p,new T.SphereGeometry(1,20,14),m,x,y,z);o.scale.set(a,b,c);return o;};
 function lathe(parent,m,profile,x=0,z=0,depth=1){const o=mesh(parent,new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),24),m,x,0,z);o.scale.z=depth;return o;}
 function tube(parent,m,points,r){return mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),12,r,8,false),m);}
 for(const s of [-1,1]){ell(g,boot,s*.115,.085,.055,.095,.085,.16);lathe(g,boot,[[.066,.09],[.071,.20],[.064,.29],[.071,.32]],s*.115,0,.9);}
 lathe(g,teal,[[.27,.27],[.29,.35],[.25,.66],[.21,.87],[.23,1.04],[.19,1.16],[.083,1.23]],0,0,.66);
 // Broad curved apron is its own cloth profile rather than a flat label.
 const ag=new T.CylinderGeometry(1,1,1,16,8,true,-.78,1.56),ap=ag.attributes.position;
 for(let i=0;i<ap.count;i++){const t=ap.getY(i)+.5,a=Math.atan2(ap.getX(i),ap.getZ(i)),r=.24-.055*t;ap.setXYZ(i,Math.sin(a)*r,.33+t*.73,Math.cos(a)*r*.68+.04);}
 ag.computeVertexNormals();mesh(g,ag,apron);
 lathe(g,boot,[[.219,.85],[.218,.90]],0,0,.73);mesh(g,new T.TorusGeometry(.035,.008,6,16),copper,0,.875,.17);
 for(const s of [-1,1]){tube(g,seam,[[s*.19,1.13,.08],[s*.18,1.05,.145],[s*.15,.97,.16]],.012);mesh(g,new T.SphereGeometry(.012,8,6),copper,s*.18,1.055,.153);}
 const head=new T.Group();head.name='head';head.position.set(0,1.205,0);g.add(head);
 lathe(head,skin,[[.037,0],[.045,.075],[.058,.12]],0,0,.8);
 const fg=new T.SphereGeometry(1,32,24),fp=fg.attributes.position;for(let i=0;i<fp.count;i++){const y=fp.getY(i),low=Math.max(0,-y),x=fp.getX(i)*(.125-.025*low),z=fp.getZ(i)*.104;fp.setXYZ(i,x,.18+y*.166,z+(fp.getZ(i)>0?.012*low:0));}fg.computeVertexNormals();mesh(head,fg,skin);
 ell(head,skin,0,.161,.105,.024,.036,.03);for(const s of [-1,1]){ell(head,skin,s*.123,.173,-.005,.02,.034,.018);ell(head,eye,s*.051,.209,.093,.012,.011,.007);tube(head,hairShade,[[s*.028,.238,.096],[s*.053,.247,.097],[s*.084,.235,.082]],.009);tube(head,lip,[[s*.019,.098,.091],[s*.043,.108,.09]],.003);}
 tube(head,lip,[[-.035,.124,.1],[0,.118,.109],[.033,.126,.099]],.0035);
 const cap=mesh(head,new T.SphereGeometry(1,24,16,0,Math.PI*2,0,1.9),hairShade,0,.225,-.018);cap.scale.set(.136,.138,.115);
 for(let i=0;i<5;i++){const a=i*.22;const lock=ell(head,hair,-.06+i*.035,.29-a*.08,.044,.076,.04,.083);lock.rotation.z=.25+i*.12;}
 ell(head,hair,-.035,.282,-.119,.084,.076,.07);tube(head,hairShade,[[-.10,.29,-.13],[-.04,.33,-.18],[.04,.29,-.14]],.01);
 for(const s of [-1,1]){
  const arm=new T.Group();arm.name=s<0?'leftArm':'rightArm';arm.position.set(s*.205,1.105,0);g.add(arm);
  tube(arm,teal,[[0,0,0],[s*.08,-.16,.015],[s*.13,-.21,.10]],.067);lathe(arm,seam,[[.069,-.27],[.071,-.21]],s*.13,.1,.8);ell(arm,skin,s*.13,-.28,.12,.05,.066,.044);
 }
 // A grounded bypass crank keeps Mara occupied, not a floating idle NPC.
 const crank=new T.Group();crank.name='crank';crank.position.set(-.42,.75,.17);g.add(crank);
 lathe(g,copper,[[.13,0],[.12,.045],[.047,.09],[.034,.69]],-.42,.17);
 mesh(crank,new T.TorusGeometry(.12,.018,8,24),copper);
 tube(crank,copper,[[0,-.12,0],[0,.12,0],[-.10,.13,.04]],.02);ell(crank,boot,-.10,.13,.065,.027,.03,.07);
 g.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(g),center=bounds.getCenter(new T.Vector3());for(const child of g.children){child.position.x-=center.x;child.position.y-=bounds.min.y;child.position.z-=center.z;}return g;
}
