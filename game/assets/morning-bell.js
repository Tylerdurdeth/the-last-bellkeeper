// Village morning bell: a small roofed timber gallows with a cracked bronze bell and a
// pull rope. Deliberately modest beside the far-bank sanctuary bell. Origin = ground centre,
// beam along x, rope on the +z (front) side. Named direct children move: 'morning-bell'
// swings about x on its beam; 'morning-rope' hangs from the yoke arm tip.
export default function(T){
 const g=new T.Group();g.name='morning bell';
 const mat=(c,n,r=.85)=>Object.assign(new T.MeshStandardMaterial({color:c,roughness:r,side:T.DoubleSide}),{name:n});
 const wood=mat(0x6d4c37,'timber'),dark=mat(0x3b2f27,'timber'),roof=mat(0xb35a40,'timber'),bronze=mat(0xa9773f,'metal',.5),patina=mat(0x5b9b89,'metal',.65),stone=mat(0x8d927f,'stone'),rope=mat(0xc4a979,'fabric'),crack=mat(0x241d1a,'metal',.95),ribbon=mat(0x62c9bc,'fabric');
 const mesh=(geo,m,x=0,y=0,z=0,parent=g)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 const box=(m,x,y,z,w,h,d,parent=g)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,parent);
 const ell=(m,x,y,z,a,b,c,parent=g)=>{const o=mesh(new T.SphereGeometry(1,10,7),m,x,y,z,parent);o.scale.set(a,b,c);return o;};
 const rod=(m,a,b,r=.04,r2=r,parent=g)=>{const v=new T.Vector3(...a),w=new T.Vector3(...b),d=w.clone().sub(v);const o=mesh(new T.CylinderGeometry(r2,r,d.length(),8),m,0,0,0,parent);o.position.copy(v.add(w).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;};
 for(const s of [-1,1]){ell(stone,s*.6,.05,0,.2,.08,.18);rod(wood,[s*.6,0,0],[s*.56,2.18,0],.075,.058);rod(wood,[s*.59,1.5,0],[s*.28,2.05,0],.032);}
 box(wood,0,2.13,0,1.52,.12,.15);
 for(const s of [-1,1]){const r=box(roof,0,2.37,s*.17,1.74,.05,.46);r.rotation.x=s*.62;}box(dark,0,2.52,0,1.8,.06,.07);
 // Cracked bell: the dark seam and dull patina say why its note stops short.
 const bell=new T.Group();bell.name='morning-bell';bell.position.set(0,2.03,0);g.add(bell);
 box(dark,0,0,0,.46,.1,.13,bell);rod(dark,[0,0,0],[0,.02,.36],.026,.02,bell);
 mesh(new T.LatheGeometry([[0,-.04],[.1,-.05],[.16,-.13],[.18,-.28],[.24,-.42],[.29,-.5],[.3,-.53],[.27,-.54]].map(p=>new T.Vector2(...p)),18),bronze,0,0,0,bell);
 mesh(new T.TorusGeometry(.283,.022,6,20),patina,0,-.49,0,bell).rotation.x=Math.PI/2;
 const seam=box(crack,.07,-.33,.2,.018,.24,.012,bell);seam.rotation.z=.35;seam.rotation.y=-.3;
 ell(dark,0,-.47,0,.06,.06,.06,bell);rod(dark,[0,-.06,0],[0,-.44,0],.012,.012,bell);
 const rp=new T.Group();rp.name='morning-rope';rp.position.set(0,2.05,.36);g.add(rp);
 rod(rope,[0,0,0],[0,-1.18,0],.019,.019,rp);ell(rope,0,-1.24,0,.05,.08,.05,rp);ell(ribbon,0,-.9,0,.03,.05,.03,rp);
 for(const y of [-.35,-.7])mesh(new T.TorusGeometry(.03,.01,5,10),rope,0,y,0,rp).rotation.x=Math.PI/2;
 return g;
}
