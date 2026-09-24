// Mara's manual bypass, built in world coordinates from a line spec (see bypassLine() in
// world-layout.js): a copper valve drum beside her with a hand lever, a riser, an overhead
// channel strapped to the great tree, and a flared outlet over the catch ring by the seed wheel.
// Named direct child 'bypass-lever' pivots about its local z to open.
// With no spec it builds a short preview line for asset review.
export default function(T,spec){
 spec??={valve:[0,0,0],bend:[2,0,0],post:[4,0,0],mouth:[4.8,0,0],top:2.35,tree:[2,0,.6],ground:[0,0,0]};
 const g=new T.Group();g.name='mara bypass';
 const mat=(c,n,r=.85)=>Object.assign(new T.MeshStandardMaterial({color:c,roughness:r,side:T.DoubleSide}),{name:n});
 const wood=mat(0x5f4432,'timber'),dark=mat(0x2c3a36,'timber'),copper=mat(0xbf7446,'metal',.5),patina=mat(0x5fa592,'metal',.62),stone=mat(0x8a8f7c,'stone'),ivory=mat(0xe8dcc0,'plaster'),red=mat(0xc9503d,'fabric');
 const mesh=(geo,m,x=0,y=0,z=0,parent=g)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 const ell=(m,x,y,z,a,b,c,parent=g)=>{const o=mesh(new T.SphereGeometry(1,10,7),m,x,y,z,parent);o.scale.set(a,b,c);return o;};
 const rod=(m,a,b,r=.04,r2=r,parent=g,n=8)=>{const v=new T.Vector3(...a),w=new T.Vector3(...b),d=w.clone().sub(v);const o=mesh(new T.CylinderGeometry(r2,r,d.length(),n),m,0,0,0,parent);o.position.copy(v.add(w).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;};
 const flange=(p,dir)=>{const o=mesh(new T.TorusGeometry(.085,.022,5,14),patina,...p);o.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...dir).normalize());};
 const [vx,vy,vz]=spec.valve,top=spec.top,[bx,,bz]=spec.bend,[px,py,pz]=spec.post,[mx,,mz]=spec.mouth;
 // Valve drum, gauge and lever.
 ell(stone,vx,vy+.06,vz,.34,.1,.3);mesh(new T.CylinderGeometry(.2,.23,.52,12),copper,vx,vy+.36,vz);
 for(const y of [.18,.55])mesh(new T.TorusGeometry(.215,.022,5,16),patina,vx,vy+y,vz).rotation.x=Math.PI/2;
 const gauge=mesh(new T.CylinderGeometry(.075,.075,.03,12),ivory,vx+.14,vy+.52,vz+.13);gauge.rotation.set(Math.PI/2,0,.6);
 const lever=new T.Group();lever.name='bypass-lever';lever.position.set(vx,vy+.5,vz+.2);g.add(lever);
 rod(dark,[0,0,0],[0,.46,0],.024,.02,lever);ell(red,0,.5,0,.05,.06,.05,lever);
 // Riser, overhead channel, tree strap and outlet post.
 rod(copper,[vx,vy+.6,vz],[vx,top,vz],.07);ell(copper,vx,top,vz,.1,.1,.1);
 rod(copper,[vx,top,vz],[bx,top,bz],.07,.07,g,10);ell(copper,bx,top,bz,.1,.1,.1);rod(copper,[bx,top,bz],[px,top,pz],.07,.07,g,10);ell(copper,px,top,pz,.1,.1,.1);rod(copper,[px,top,pz],[mx,top,mz],.07,.07,g,10);
 for(const [a,b] of [[[vx,vz],[bx,bz]],[[bx,bz],[px,pz]]])for(let f=.25;f<1;f+=.25){const x=a[0]+(b[0]-a[0])*f,z=a[1]+(b[1]-a[1])*f;flange([x,top,z],[b[0]-a[0],0,b[1]-a[1]]);}
 const [tx,,tz]=spec.tree;rod(dark,[tx,top-.02,tz],[bx,top-.02,bz],.03);mesh(new T.TorusGeometry(.12,.025,5,14),dark,bx,top,bz).rotation.x=Math.PI/2;
 rod(wood,[px,py,pz],[px,top+.12,pz],.075,.062);ell(stone,px,py+.04,pz,.2,.07,.18);rod(wood,[px,top-.45,pz],[(px+mx)/2,top-.02,(pz+mz)/2],.03);
 // Flared mouth points down at the ring; its patina lip is the catch cue.
 rod(copper,[mx,top,mz],[mx,top-.28,mz],.07);ell(copper,mx,top,mz,.1,.1,.1);
 mesh(new T.LatheGeometry([[.07,0],[.09,-.08],[.15,-.18],[.25,-.26],[.27,-.28]].map(p=>new T.Vector2(...p)),16),copper,mx,top-.28,mz);
 mesh(new T.TorusGeometry(.265,.028,6,20),patina,mx,top-.56,mz).rotation.x=Math.PI/2;
 return g;
}
