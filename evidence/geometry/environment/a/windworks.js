export default function(T){
const g=new T.Group();
const mat=(c,n,r=.85)=>Object.assign(new T.MeshStandardMaterial({color:c,roughness:r}),{name:n});
const ivory=mat(0xe7ddc2,'plaster'),copper=mat(0xb76f48,'metal',.4),dark=mat(0x704337,'metal'),wood=mat(0x977557,'timber'),leaf=mat(0x3f7860,'foliage'),light=mat(0x90ae68,'foliage'),glow=mat(0x62c9bc,'plaster');
function add(geo,m,x,y,z,rx=0,ry=0,rz=0,parent=g){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
const cyl=(r1,r2,h,m,x,y,z)=>add(new T.CylinderGeometry(r1,r2,h,16),m,x,y,z);
const ball=(m,x,y,z,sx,sy,sz)=>{const o=add(new T.SphereGeometry(1,12,8),m,x,y,z);o.scale.set(sx,sy,sz);return o;};
const box=(w,h,d,m,x,y,z)=>add(new T.BoxGeometry(w,h,d),m,x,y,z);
function beam(a,b,r,m){const p=new T.Vector3(...a),q=new T.Vector3(...b),d=q.clone().sub(p);const o=add(new T.CylinderGeometry(r*.65,r,d.length(),9),m,...p.clone().add(q).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
for(const x of [-1.4,0,1.4]){cyl(.55,.68,2.7+(x===0?1:0),ivory,x,1.35+(x===0?.5:0),0);add(new T.ConeGeometry(.8,1,6),copper,x,3.2+(x===0?1:0),0);for(let j=0;j<5;j++){const t=j/5*Math.PI*2;box(.1,1.2,.1,dark,x+Math.sin(t)*.56,1.65,Math.cos(t)*.56);}}box(3.8,.3,1.4,wood,0,.4,0);
const b=new T.Box3(),v=new T.Vector3();g.updateMatrixWorld(true);g.traverse(n=>{if(n.isMesh){const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));}});const c=b.getCenter(new T.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=b.min.y;o.position.z-=c.z;});return g;}
