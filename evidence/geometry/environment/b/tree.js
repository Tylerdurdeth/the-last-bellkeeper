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

// Thick curved living trunk: sweep profile along a bent path.
const section=new T.Shape();section.absellipse(0,0,.58,.47,0,Math.PI*2,false,0);
mesh(g,new T.ExtrudeGeometry(section,{steps:16,bevelEnabled:false,extrudePath:new T.CatmullRomCurve3([V(0,.16,0),V(-.25,1.9,0),V(.08,3.5,.13),V(-.32,5.1,.12)])}),timber);
for(let i=0;i<7;i++){const a=i*Math.PI*2/7;tube(g,timber,[V(Math.cos(a)*2,.12,Math.sin(a)*1.5),V(Math.cos(a)*.85,.24,Math.sin(a)*.65),V(0,1.05,0)],.17,10);}
for(let i=0;i<8;i++){const a=i*Math.PI*2/8+.2;const x=Math.cos(a)*2.1,z=Math.sin(a)*1.65,y=3.7+(i%3)*.43;tube(g,timber,[V(-.08,2.75,0),V(x*.55,y-.55,z*.55),V(x,y+.8,z)],.18,12);ell(g,i%3===0?lightLeaf:leaf,x,y+1.1,z,1.40,.88,1.12);ell(g,deep,x*.78,y+.8,z*.75,1.1,.60,.91);}
ell(g,leaf,-.2,6,0,1.75,1,1.6);ell(g,lightLeaf,-.45,6.45,-.1,1.25,.6,1.1);
// Broad copper-coloured bark ribbons make the rear trunk modelled too.
for(let i=0;i<5;i++){const a=i*1.256;tube(g,darkCopper,[V(Math.cos(a)*.5,.3,Math.sin(a)*.42),V(-.25+Math.cos(a)*.58,1.9,Math.sin(a)*.47),V(.08+Math.cos(a)*.5,3.2,.13+Math.sin(a)*.43)],.045,10);}

const box=new T.Box3(),v=new T.Vector3();g.updateMatrixWorld(true);g.traverse(n=>{const p=n.isMesh&&n.geometry.attributes.position;if(p)for(let i=0;i<p.count;i++)box.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));});const c=box.getCenter(new T.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=box.min.y;o.position.z-=c.z;});return g;
}
