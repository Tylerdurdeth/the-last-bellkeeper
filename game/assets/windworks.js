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

for(let i=0;i<3;i++){const x=(i-1)*1.23,h=i===1?3.55:2.8,z=i===1?-.3:0;
const s=new T.Shape();s.moveTo(-.39,0);s.lineTo(.39,0);s.lineTo(.32,h-.6);s.quadraticCurveTo(0,h-.34,-.32,h-.6);s.closePath();profile(g,s,.64,ivory,x,.04,z,.045);
const roof=new T.Shape();roof.moveTo(-.53,0);roof.quadraticCurveTo(-.23,.17,0,.56);roof.quadraticCurveTo(.23,.17,.53,0);roof.lineTo(.43,-.08);roof.quadraticCurveTo(0,.32,-.43,-.08);roof.closePath();profile(g,roof,.79,copper,x,h-.36,z,.03);
for(let side=-1;side<=1;side+=2){const win=new T.Shape();win.moveTo(-.105,0);win.lineTo(.105,0);win.lineTo(.105,.32);win.quadraticCurveTo(0,.5,-.105,.32);win.closePath();profile(g,win,.018,dark,x,h-1.15,z+side*.374,.01);rod(g,copper,V(x,h-1.15,z+side*.395),V(x,h-.78,z+side*.395),.019);}
ring(g,copper,.29,.04,x,h-.04,z+.46);for(let j=0;j<6;j++){const a=j*Math.PI/3;rod(g,ivory,V(x,h-.04,z+.46),V(x+Math.cos(a)*.27,h-.04+Math.sin(a)*.27,z+.46),.025);}
}
for(let side=-1;side<=1;side+=2){tube(g,ivory,[V(side*1.15,1.25,0),V(side*.60,1.62,0),V(0,1.78,-.3)],.16,12);tube(g,copper,[V(side*1.15,1.52,0),V(side*.60,1.89,0),V(0,2.05,-.3)],.035,12);}

const box=new T.Box3(),v=new T.Vector3();g.updateMatrixWorld(true);g.traverse(n=>{const p=n.isMesh&&n.geometry.attributes.position;if(p)for(let i=0;i<p.count;i++)box.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));});const c=box.getCenter(new T.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=box.min.y;o.position.z-=c.z;});return g;
}
