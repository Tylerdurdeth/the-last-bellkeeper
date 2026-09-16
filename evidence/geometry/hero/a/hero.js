export default function(THREE) {
 const root=new THREE.Group(), joints={}; root.userData.joints=joints;
 const mat=(color,name,roughness=.85)=>Object.assign(new THREE.MeshStandardMaterial({color,roughness}),{name});
 const coral=mat(0xd96956,'fabric'), dark=mat(0x593f46,'fabric'), skin=mat(0xc99473,'fabric'), ivory=mat(0xe7ddc2,'fabric'), copper=mat(0xb76f48,'metal',.4), teal=mat(0x62c9bc,'metal'), eye=mat(0x293739,'fabric'), white=mat(0xf4e8cd,'fabric');
 function mesh(parent,geo,material,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 const sphere=(p,m,x,y,z,sx,sy,sz)=>mesh(p,new THREE.SphereGeometry(1,16,12),m,x,y,z,sx,sy,sz);
 const box=(p,m,x,y,z,w,h,d)=>mesh(p,new THREE.BoxGeometry(w,h,d),m,x,y,z);
 function pivot(name,parent,x,y,z){const p=new THREE.Group();p.name=name;p.position.set(x,y,z);parent.add(p);joints[name]=p;return p;}
 const hips=pivot('hips',root,0,.64,0);
 sphere(hips,dark,0,0,0,.17,.12,.105);
 mesh(hips,new THREE.CylinderGeometry(.155,.185,.35,10),coral,0,.16,0,1,1,.63);
 box(hips,dark,0,.05,.004,.335,.045,.225);
 box(hips,copper,0,.05,.126,.055,.052,.016);
 const head=pivot('head',hips,0,.37,0);
 sphere(head,skin,0,.126,0,.157,.178,.135);
 sphere(head,skin,-.158,.11,0,.029,.045,.025);sphere(head,skin,.158,.11,0,.029,.045,.025);
 sphere(head,dark,0,.23,-.023,.164,.10,.14);
 for(let i=0;i<6;i++){const t=i/5;const hair=sphere(head,dark,-.126+t*.25,.265-t*.07,.08,.061,.055,.068);hair.rotation.z=-.45;}
 sphere(head,dark,-.142,.155,-.018,.036,.10,.08);sphere(head,dark,.139,.16,-.03,.033,.085,.08);
 for(const side of [-1,1]){sphere(head,white,side*.061,.137,.123,.039,.022,.012);sphere(head,eye,side*.060,.136,.134,.013,.018,.007);const b=box(head,dark,side*.063,.173,.126,.072,.012,.017);b.rotation.z=side*.12;}
 sphere(head,skin,0,.102,.14,.023,.032,.025);
 const mouth=box(head,dark,0,.062,.127,.046,.006,.009);mouth.rotation.z=.04;
 for(const side of [-1,1]){const collar=box(hips,ivory,side*.065,.316,.073,.126,.115,.055);collar.rotation.z=side*.53;}
 sphere(hips,teal,.067,.23,.111,.028,.034,.014);
 for(const [side,prefix] of [[-1,'left'],[1,'right']]){
  const leg=pivot(prefix+'UpperLeg',hips,side*.096,-.027,0);
  mesh(leg,new THREE.CylinderGeometry(.073,.059,.237,10),dark,0,-.111,0,1,1,.92);
  const lower=pivot(prefix+'LowerLeg',leg,0,-.238,0);
  mesh(lower,new THREE.CylinderGeometry(.06,.044,.23,10),dark,0,-.111,0);
  const foot=pivot(prefix+'Foot',lower,0,-.233,0);
  sphere(foot,dark,0,-.048,.038,.069,.069,.122);
  box(foot,copper,0,-.075,.025,.13,.028,.198);
  const arm=pivot(prefix+'UpperArm',hips,side*.184,.282,0);
  arm.rotation.z=side*.10;
  sphere(arm,coral,0,-.078,0,.068,.104,.068);
  const fore=pivot(prefix+'LowerArm',arm,0,-.174,0);
  mesh(fore,new THREE.CylinderGeometry(.056,.043,.158,10),side<0?teal:coral,0,-.074,0);
  const hand=pivot(prefix+'Hand',fore,0,-.163,0);
  sphere(hand,skin,0,-.029,.008,.047,.057,.03);
  sphere(hand,skin,-side*.04,-.022,.021,.017,.032,.019);
  const coat=pivot(side<0?'coatLeft':'coatRight',hips,side*.088,.01,-.008);
  mesh(coat,new THREE.CylinderGeometry(.09,.126,.26,6,1,false,side<0?Math.PI:0,Math.PI),coral,side*.006,-.12,-.016,1,1,.9).material.side=THREE.DoubleSide;
  const seam=box(coat,copper,side*.052,-.12,.082,.014,.215,.008);seam.rotation.z=side*.16;
 }
 // A practical satchel and back yoke give the reverse silhouette authored detail.
 box(hips,copper,-.18,-.004,-.015,.095,.12,.09);
 box(hips,ivory,0,.29,-.103,.22,.05,.025);
 const strap=box(hips,dark,0,.18,.115,.032,.30,.023);strap.rotation.z=-.39;
 const bounds=new THREE.Box3(),v=new THREE.Vector3();root.updateMatrixWorld(true);root.traverse(n=>{if(n.isMesh){const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)bounds.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));}});
 const center=bounds.getCenter(new THREE.Vector3()), scale=1.35/(bounds.max.y-bounds.min.y);
 root.children.forEach(o=>{o.position.x-=center.x;o.position.y-=bounds.min.y;o.position.z-=center.z;});root.scale.setScalar(scale);
 return root;
}
