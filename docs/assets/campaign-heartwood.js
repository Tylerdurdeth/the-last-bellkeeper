export default function(T){
const g=new T.Group();
const mat=(c,n)=>Object.assign(new T.MeshStandardMaterial({color:c,roughness:.85,side:T.DoubleSide}),{name:n});
const ivory=mat('#E7DDC2','plaster'),trim=mat('#B7AB8D','stone'),copper=mat('#B76F48','metal'),dark=mat('#704337','timber');
function mesh(geo,m,x=0,y=0,z=0,p=g){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
function box(m,x,y,z,w,h,d,p=g){return mesh(new T.BoxGeometry(w,h,d),m,x,y,z,p);}
function rod(m,a,b,r=.05){const v=new T.Vector3(...a),d=new T.Vector3(...b).sub(v),o=mesh(new T.CylinderGeometry(r,r,d.length(),8),m);o.position.copy(v).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
// B: ring-lofted buttress with flared roots, leaning crown, continuous bark flutes.
const bark=mat('#315a5b','timber'),rib=mat('#416765','timber');const p=[],idx=[],rings=18,sides=20;
for(let j=0;j<=rings;j++){const t=j/rings,y=t*8,cx=.55*Math.sin(t*3.1),cz=.22*Math.sin(t*5);for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2,r=(.72+1.35*Math.exp(-t*6))*(1+.14*Math.cos(a*7+t*2)+.045*Math.sin(t*14+a));p.push(cx+Math.cos(a)*r,y,cz+Math.sin(a)*r*.68);}}
for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const k=j*(sides+1)+i;idx.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));const uv=[];for(let j=0;j<=rings;j++)for(let i=0;i<=sides;i++)uv.push(i/sides,j/rings);geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();mesh(geo,bark);
for(let i=0;i<6;i++){const a=i*Math.PI/3,pts=[];for(let j=0;j<7;j++){const t=j/6,r=.76+1.36*Math.exp(-t*6);pts.push(new T.Vector3(.55*Math.sin(t*3.1)+Math.cos(a+t*.12)*r,t*7.95,.22*Math.sin(t*5)+Math.sin(a+t*.12)*r*.68));}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),16,.035,4,false),rib);}
mesh(new T.SphereGeometry(.73,10,6),bark,.02,7.95,-.2).scale.set(1,.16,.68);

g.updateMatrixWorld(true);const b=new T.Box3(),v=new T.Vector3();g.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));}});const c=b.getCenter(new T.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=b.min.y;o.position.z-=c.z;});return g;
}
