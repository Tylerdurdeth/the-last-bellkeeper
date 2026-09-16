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

// Mechanism is an interpretation: the reference does not reveal its bearings.
for(let side=-1;side<=1;side+=2){const s=new T.Shape();s.moveTo(-.22,0);s.lineTo(.22,0);s.lineTo(.12,.15);s.lineTo(.075,1.20);s.quadraticCurveTo(0,1.34,-.075,1.20);s.lineTo(-.12,.15);s.closePath();profile(g,s,.23,ivory,side*.53,.03,-.22,.03);ell(g,copper,side*.53,1.20,-.22,.095,.095,.16);}
rod(g,copper,V(-.53,1.20,-.22),V(.53,1.20,-.22),.055);rod(g,copper,V(0,1.20,-.22),V(0,1.20,.08),.055);
const rotor=new T.Group();rotor.name='seedWheelRotor';rotor.position.set(0,1.20,.08);g.add(rotor);g.userData.rotor=rotor;
ring(rotor,copper,.84,.06);ring(rotor,darkCopper,.72,.024);ell(rotor,copper,0,0,0,.14,.14,.12);ell(rotor,teal,0,0,.11,.075,.075,.035);
for(let i=0;i<8;i++){const a=i*Math.PI/4;const paddle=new T.Shape();paddle.moveTo(-.035,.12);paddle.quadraticCurveTo(-.21,.4,-.14,.68);paddle.quadraticCurveTo(.01,.80,.14,.68);paddle.quadraticCurveTo(.11,.39,.035,.12);paddle.closePath();const p=profile(rotor,paddle,.07,ivory,0,0,0,.018);p.rotation.z=a;rod(rotor,copper,V(Math.sin(a)*.12,Math.cos(a)*.12,-.065),V(Math.sin(a)*.79,Math.cos(a)*.79,-.065),.024);}

const box=new T.Box3(),v=new T.Vector3();g.updateMatrixWorld(true);g.traverse(n=>{const p=n.isMesh&&n.geometry.attributes.position;if(p)for(let i=0;i<p.count;i++)box.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));});const c=box.getCenter(new T.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=box.min.y;o.position.z-=c.z;});return g;
}
