export default function(T){
 const g=new T.Group();
 const mat=(c,n,r=.85)=>Object.assign(new T.MeshStandardMaterial({color:c,roughness:r,side:T.DoubleSide}),{name:n});
 const wood=mat(0x594333,'timber'),ivory=mat(0xe6d9b7,'plaster'),bronze=mat(0xb08049,'metal',.52),patina=mat(0x498f82,'metal',.63),stone=mat(0x89917d,'stone'),dark=mat(0x293f3c,'timber'),rope=mat(0xae9367,'fabric'),leaf=mat(0x53785b,'foliage');
 function mesh(geo,m,x=0,y=0,z=0,parent=g){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 function ell(m,x,y,z,a,b,c,parent=g){const o=mesh(new T.SphereGeometry(1,12,8),m,x,y,z,parent);o.scale.set(a,b,c);return o;}
 function rod(m,a,b,r=.04,r2=r,parent=g){const v=new T.Vector3(...a),w=new T.Vector3(...b),d=w.clone().sub(v);const o=mesh(new T.CylinderGeometry(r2,r,d.length(),8),m,0,0,0,parent);o.position.copy(v.add(w).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
 function curve(m,points,r=.04,parent=g){const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(new T.TubeGeometry(path,18,r,6,false),m,0,0,0,parent);}
 function ring(m,x,y,z,r,t=.025,parent=g){return mesh(new T.TorusGeometry(r,t,6,24),m,x,y,z,parent);}
 function profile(m,points,x,y,z,parent=g){return mesh(new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),24),m,x,y,z,parent);}
 function block(m,x,y,z,a,b,c,angle=0,parent=g){const o=mesh(new T.BoxGeometry(a,b,c),m,x,y,z,parent);o.rotation.z=angle;return o;}

for(const s of [-1,1]){curve(wood,[[s*.49,0,0],[s*.46,.55,-.02],[s*.56,.96,0],[s*.5,1.44,0]],.048);curve(wood,[[s*.48,.68,0],[s*.74,.91,.02],[s*.8,1.18,0]],.028);ell(stone,s*.46,.055,0,.22,.065,.17);}curve(rope,[[-.55,1.15,0],[0,1.03,0],[.55,1.15,0]],.022);const d=profile(bronze,[[0,.085],[.1,.08],[.24,.018],[.35,0],[.38,.02],[.38,-.035],[.3,-.055],[0,-.015]],0,.57,0);d.rotation.x=Math.PI/2;ring(patina,0,.57,.015,.345,.025);ell(patina,0,.57,.11,.087,.087,.035);for(const s of [-1,1])rod(rope,[s*.29,1.07,0],[s*.24,.85,.02],.012);
 g.name='gong candidate b';
 g.updateMatrixWorld(true);const b=new T.Box3(),v=new T.Vector3();g.traverse(n=>{if(n.isMesh){const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));}});const c=b.getCenter(new T.Vector3());for(const o of g.children){o.position.x-=c.x;o.position.z-=c.z;o.position.y-=b.min.y;}g.updateMatrixWorld(true);return g;
}
