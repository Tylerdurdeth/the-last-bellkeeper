export default function(T){
const g=new T.Group();
const mat=(c,n)=>Object.assign(new T.MeshStandardMaterial({color:c,roughness:.85,side:T.DoubleSide}),{name:n});
const ivory=mat('#E7DDC2','plaster'),trim=mat('#B7AB8D','stone'),copper=mat('#B76F48','metal'),dark=mat('#704337','timber');
function mesh(geo,m,x=0,y=0,z=0,p=g){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
function box(m,x,y,z,w,h,d,p=g){return mesh(new T.BoxGeometry(w,h,d),m,x,y,z,p);}
function rod(m,a,b,r=.05){const v=new T.Vector3(...a),d=new T.Vector3(...b).sub(v),o=mesh(new T.CylinderGeometry(r,r,d.length(),8),m);o.position.copy(v).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
// B: chamfered stone profiles swept through depth; undercut fascia.
for(const [y,w,d,h] of [[0,3.5,3.5,.36],[.36,3.8,3.8,.3],[.66,4,4,.48]]){const s=new T.Shape(),q=.18;s.moveTo(-w/2+q,-d/2);s.lineTo(w/2-q,-d/2);s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+q);s.lineTo(w/2,d/2-q);s.quadraticCurveTo(w/2,d/2,w/2-q,d/2);s.lineTo(-w/2+q,d/2);s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-q);s.lineTo(-w/2,-d/2+q);s.quadraticCurveTo(-w/2,-d/2,-w/2+q,-d/2);const geo=new T.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,steps:1,curveSegments:5});geo.rotateX(-Math.PI/2);mesh(geo,y===0?trim:ivory,0,y,0);}
for(const z of [-1.985,1.985])for(const x of [-1,0,1])box(trim,x,.94,z,.025,.37,.025);

g.updateMatrixWorld(true);const b=new T.Box3(),v=new T.Vector3();g.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));}});const c=b.getCenter(new T.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=b.min.y;o.position.z-=c.z;});return g;
}
