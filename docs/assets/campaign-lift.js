export default function(T){
const g=new T.Group();
const mat=(c,n)=>Object.assign(new T.MeshStandardMaterial({color:c,roughness:.85,side:T.DoubleSide}),{name:n});
const ivory=mat('#E7DDC2','plaster'),trim=mat('#B7AB8D','stone'),copper=mat('#B76F48','metal'),dark=mat('#704337','timber');
function mesh(geo,m,x=0,y=0,z=0,p=g){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
function box(m,x,y,z,w,h,d,p=g){return mesh(new T.BoxGeometry(w,h,d),m,x,y,z,p);}
function rod(m,a,b,r=.05){const v=new T.Vector3(...a),d=new T.Vector3(...b).sub(v),o=mesh(new T.CylinderGeometry(r,r,d.length(),8),m);o.position.copy(v).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
// B: circular limestone lift with a swept copper crown and open boarding side.
mesh(new T.CylinderGeometry(1.4,1.48,.28,32),trim,0,.14,0);mesh(new T.CylinderGeometry(1.3,1.3,.07,32),ivory,0,.315,0);
for(const s of [-1,1]){rod(copper,[s*1.15,.35,0],[s*1.15,2.45,0],.075);box(trim,s*1.15,.48,0,.32,.25,.37);}
mesh(new T.TorusGeometry(1.15,.08,6,24,Math.PI),copper,0,2.45,0);
for(let i=0;i<17;i++){const a=Math.PI+i*Math.PI/16;rod(copper,[1.3*Math.cos(a),.35,1.3*Math.sin(a)],[1.3*Math.cos(a),1.1,1.3*Math.sin(a)],.027);}
const rail=mesh(new T.TorusGeometry(1.3,.045,5,24,Math.PI),copper,0,1.1,0);rail.rotation.x=Math.PI/2;
mesh(new T.TorusGeometry(.23,.055,6,16),dark,0,3.26,0);rod(dark,[0,3.45,-.07],[0,.4,-.07],.025);

g.updateMatrixWorld(true);const b=new T.Box3(),v=new T.Vector3();g.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));}});const c=b.getCenter(new T.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=b.min.y;o.position.z-=c.z;});return g;
}
