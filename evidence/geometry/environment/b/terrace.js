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

const deck=new T.Shape();deck.absellipse(0,0,7.35,5.70,0,Math.PI*2,false,0);
const slab=profile(g,deck,.48,ivory,0,.29,0,.035);slab.rotation.x=-Math.PI/2;
const lower=mesh(g,new T.CylinderGeometry(1,1,.16,48),timber,0,.12,0);lower.scale.set(7.18,1,5.52);
// Raised concentric timber inlay and interrupted perimeter handrail.
for(let i=0;i<44;i++){
const a=i/44*Math.PI*2,b=(i+1)/44*Math.PI*2;
rod(g,timber,V(Math.cos(a)*6.95,.553,Math.sin(a)*5.31),V(Math.cos(b)*6.95,.553,Math.sin(b)*5.31),.028);
if(Math.sin(a)>.87)continue;
const x=Math.cos(a)*7.03,z=Math.sin(a)*5.40;
if(i%2===0){rod(g,copper,V(x,.53,z),V(x,1.28,z),.045);ell(g,copper,x,1.28,z,.08,.055,.08);}
rod(g,copper,V(x,1.26,z),V(Math.cos(b)*7.03,1.26,Math.sin(b)*5.40),.041);
rod(g,timber,V(x,.88,z),V(Math.cos(b)*7.03,.88,Math.sin(b)*5.40),.024);
}
// Short front entry boards inset into the ivory, with no rail crossing opening.
for(let i=0;i<5;i++){const s=new T.Shape();s.moveTo(-.9,-.05);s.lineTo(.9,-.05);s.lineTo(.9,.05);s.lineTo(-.9,.05);s.closePath();const p=profile(g,s,.018,timber,0,.56,3.7+i*.32,.01);p.rotation.x=-Math.PI/2;}

// Static-only material merge; transformed generated vertices preserve rail silhouette.
const buckets=new Map();g.updateMatrixWorld(true);g.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(geo);});
g.clear();for(const [material,geometries] of buckets){const geo=new T.BufferGeometry();for(const name of ['position','normal','uv']){const count=geometries.reduce((n,q)=>n+q.attributes[name].array.length,0);const data=new Float32Array(count);let offset=0;for(const q of geometries){data.set(q.attributes[name].array,offset);offset+=q.attributes[name].array.length;}geo.setAttribute(name,new T.BufferAttribute(data,geometries[0].attributes[name].itemSize));}mesh(g,geo,material);}
const box=new T.Box3(),v=new T.Vector3();g.updateMatrixWorld(true);g.traverse(n=>{const p=n.isMesh&&n.geometry.attributes.position;if(p)for(let i=0;i<p.count;i++)box.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));});const c=box.getCenter(new T.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=box.min.y;o.position.z-=c.z;});return g;
}
