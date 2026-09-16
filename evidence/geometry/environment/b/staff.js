export default function(T){
const g=new T.Group();
function mat(c,n='plaster',metalness=0){const m=new T.MeshStandardMaterial({color:c,roughness:.88,metalness});m.name=n;return m;}
const ivory=mat('#E7DDC2'),copper=mat('#B76F48','metal',.25),darkCopper=mat('#704337','metal'),timber=mat('#977557','timber'),leaf=mat('#3F7860','foliage'),lightLeaf=mat('#90AE68','foliage'),deep=mat('#183E3D','foliage'),teal=mat('#62C9BC','metal'),dark=mat('#593F46','stone');
function mesh(p,geo,m,x=0,y=0,z=0){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
function ell(p,m,x,y,z,a,b,c){const o=mesh(p,new T.SphereGeometry(1,10,7),m,x,y,z);o.scale.set(a,b,c);return o;}
function tube(p,m,points,r,segments=12){return mesh(p,new T.TubeGeometry(new T.CatmullRomCurve3(points),segments,r,6,false),m);}
function rod(p,m,a,b,r){const v=b.clone().sub(a);const o=mesh(p,new T.CylinderGeometry(r,r,v.length(),8),m);o.position.copy(a).addScaledVector(v,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
function profile(p,s,d,m,x=0,y=0,z=0,bev=.025){const geo=new T.ExtrudeGeometry(s,{depth:d,steps:1,curveSegments:8,bevelEnabled:bev>0,bevelSize:bev,bevelThickness:bev,bevelSegments:2});geo.translate(0,0,-d/2);return mesh(p,geo,m,x,y,z);}
function ring(p,m,r,t,x=0,y=0,z=0){return mesh(p,new T.TorusGeometry(r,t,6,24),m,x,y,z);}
const V=(x,y,z)=>new T.Vector3(x,y,z);

const path=[V(0,.025,0),V(-.013,.46,0),V(.015,.94,0)];tube(g,timber,path,.022,14);
rod(g,copper,V(0,.02,0),V(0,.16,0),.028);rod(g,copper,V(.008,.72,0),V(.014,.88,0),.028);
const hook=new T.Shape();hook.moveTo(-.03,.88);hook.bezierCurveTo(-.18,1.08,-.13,1.24,.015,1.23);hook.bezierCurveTo(.15,1.22,.15,1.08,.057,1.04);hook.lineTo(.052,1.09);hook.bezierCurveTo(.09,1.14,.075,1.185,.015,1.187);hook.bezierCurveTo(-.082,1.192,-.08,1.075,.013,.94);hook.closePath();profile(g,hook,.028,copper,0,0,0,.008);
const points=[];for(let i=0;i<7;i++){const t=i/6;points.push(new T.Vector2(.037+.053*t*t,1.055-.135*t));}const bell=mesh(g,new T.LatheGeometry(points,16),copper,.057,0,0);bell.material=bell.material.clone();bell.material.side=T.DoubleSide;
ell(g,darkCopper,.057,.934,0,.017,.027,.017);const rim=ring(g,copper,.09,.008,.057,.92,0);rim.rotation.x=Math.PI/2;

const box=new T.Box3(),v=new T.Vector3();g.updateMatrixWorld(true);g.traverse(n=>{const p=n.isMesh&&n.geometry.attributes.position;if(p)for(let i=0;i<p.count;i++)box.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));});const c=box.getCenter(new T.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=box.min.y;o.position.z-=c.z;});const scale=1.25/(box.max.y-box.min.y);g.children.forEach(o=>{o.position.multiplyScalar(scale);o.scale.multiplyScalar(scale);});return g;
}
