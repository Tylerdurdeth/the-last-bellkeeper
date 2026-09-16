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

for(let side=-1;side<=1;side+=2){const s=new T.Shape();s.moveTo(-.15,0);s.lineTo(.15,0);s.lineTo(.12,1.49);s.quadraticCurveTo(0,1.78,-.12,1.49);s.closePath();profile(g,s,.3,ivory,side*.94,.03,0,.03);ell(g,copper,side*.94,1.63,0,.18,.075,.18);ell(g,teal,side*.94,1.74,0,.068,.06,.068);}
const door=new T.Group();door.name='windGateDoor';door.position.set(-.77,.18,0);g.add(door);g.userData.door=door;
const sweep=new T.Shape();sweep.moveTo(0,.04);sweep.quadraticCurveTo(.77,.25,1.54,.04);sweep.lineTo(1.54,.12);sweep.quadraticCurveTo(.77,.36,0,.12);sweep.closePath();profile(door,sweep,.07,copper,0,.48,0,.018);profile(door,sweep,.06,timber,0,.05,0,.014);
for(let i=0;i<7;i++){const x=.08+i*.23;rod(door,copper,V(x,.16,0),V(x,.75,0),.018);}
ring(door,copper,.11,.018,.77,.78,0);ell(door,teal,.77,.78,0,.045,.065,.034);

const box=new T.Box3(),v=new T.Vector3();g.updateMatrixWorld(true);g.traverse(n=>{const p=n.isMesh&&n.geometry.attributes.position;if(p)for(let i=0;i<p.count;i++)box.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));});const c=box.getCenter(new T.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=box.min.y;o.position.z-=c.z;});return g;
}
