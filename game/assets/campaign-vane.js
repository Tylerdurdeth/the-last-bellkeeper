export default function(T){
const g=new T.Group();
const mat=(c,n)=>Object.assign(new T.MeshStandardMaterial({color:c,roughness:.85,side:T.DoubleSide}),{name:n});
const ivory=mat('#E7DDC2','plaster'),trim=mat('#B7AB8D','stone'),copper=mat('#B76F48','metal'),dark=mat('#704337','timber');
function mesh(geo,m,x=0,y=0,z=0,p=g){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
function box(m,x,y,z,w,h,d,p=g){return mesh(new T.BoxGeometry(w,h,d),m,x,y,z,p);}
function rod(m,a,b,r=.05){const v=new T.Vector3(...a),d=new T.Vector3(...b).sub(v),o=mesh(new T.CylinderGeometry(r,r,d.length(),8),m);o.position.copy(v).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
// B: silhouetted copper arrow profile with feather cutouts and spear finial.
mesh(new T.CylinderGeometry(.42,.6,.2,12),trim,0,.1,0);mesh(new T.CylinderGeometry(.21,.36,.3,12),copper,0,.35,0);rod(copper,[0,.3,0],[0,2.5,0],.045);
const rotor=new T.Group();rotor.name='vaneRotor';rotor.position.y=1.72;g.add(rotor);
const sh=new T.Shape();[[-1.1,-.23],[-.83,-.06],[.65,-.06],[.55,-.22],[1.14,0],[.55,.22],[.65,.06],[-.83,.06],[-1.1,.23],[-.97,0]].forEach(([x,y],i)=>i?sh.lineTo(x,y):sh.moveTo(x,y));sh.closePath();const geo=new T.ExtrudeGeometry(sh,{depth:.07,bevelEnabled:false,steps:1});geo.translate(0,0,-.035);mesh(geo,copper,0,0,0,rotor);
for(let i=0;i<3;i++){const o=box(copper,-.8+i*.16,0,0,.035,.42,.07,rotor);o.rotation.z=-.55;}
const spear=new T.Shape();spear.moveTo(-.12,0);spear.lineTo(0,.55);spear.lineTo(.12,0);spear.lineTo(0,.12);spear.closePath();const sg=new T.ExtrudeGeometry(spear,{depth:.065,bevelEnabled:false});sg.translate(0,0,-.0325);mesh(sg,copper,0,2.25,0);
for(const y of [.56,1.05,2.08]){const o=mesh(new T.TorusGeometry(.09,.022,5,12),copper,0,y,0);o.rotation.x=Math.PI/2;}

g.updateMatrixWorld(true);const b=new T.Box3(),v=new T.Vector3();g.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));}});const c=b.getCenter(new T.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=b.min.y;o.position.z-=c.z;});return g;
}
