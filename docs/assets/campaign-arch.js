export default function(T){
const g=new T.Group();
const mat=(c,n)=>Object.assign(new T.MeshStandardMaterial({color:c,roughness:.85,side:T.DoubleSide}),{name:n});
const ivory=mat('#E7DDC2','plaster'),trim=mat('#B7AB8D','stone'),copper=mat('#B76F48','metal'),dark=mat('#704337','timber');
function mesh(geo,m,x=0,y=0,z=0,p=g){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
function box(m,x,y,z,w,h,d,p=g){return mesh(new T.BoxGeometry(w,h,d),m,x,y,z,p);}
function rod(m,a,b,r=.05){const v=new T.Vector3(...a),d=new T.Vector3(...b).sub(v),o=mesh(new T.CylinderGeometry(r,r,d.length(),8),m);o.position.copy(v).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
// B: continuous horseshoe profile with recessed inner face and crown key.
const sh=new T.Shape();sh.moveTo(-2.05,0);sh.lineTo(-2.05,2.6);sh.absarc(0,2.6,2.05,Math.PI,0,true);sh.lineTo(2.05,0);sh.lineTo(1.57,0);sh.lineTo(1.57,2.6);sh.absarc(0,2.6,1.57,0,Math.PI,false);sh.lineTo(-1.57,0);sh.closePath();
const geo=new T.ExtrudeGeometry(sh,{depth:.55,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:1,steps:1,curveSegments:18});geo.translate(0,0,-.275);mesh(geo,ivory);
for(const s of [-1,1]){box(trim,s*1.81,.16,0,.72,.32,.8);box(trim,s*1.81,2.55,0,.64,.2,.74);}
box(trim,0,4.43,0,.33,.52,.69);
for(const z of [-.315,.315]){const o=mesh(new T.TorusGeometry(1.7,.035,5,28,Math.PI),trim,0,2.6,z);}

g.updateMatrixWorld(true);const b=new T.Box3(),v=new T.Vector3();g.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));}});const c=b.getCenter(new T.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=b.min.y;o.position.z-=c.z;});return g;
}
