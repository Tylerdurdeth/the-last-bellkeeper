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

for(const x of [-.27,.27])block(wood,x,.06,0,.18,.12,.34,0);const sh=new T.Shape();sh.moveTo(-.4,0);sh.lineTo(.4,0);sh.lineTo(.32,.13);sh.lineTo(-.32,.13);sh.closePath();mesh(new T.ExtrudeGeometry(sh,{depth:.22,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:1,steps:1}),wood,0,.1,-.11);rod(ivory,[-.29,.25,0],[-.36,1.58,0],.046);curve(bronze,[[-.36,1.58,0],[-.16,1.55,0],[.13,1.34,0],[.36,1.21,0],[.48,1.32,0]],.065);curve(wood,[[.15,.21,0],[.31,.57,0],[.48,1.32,0]],.083);for(let i=0;i<7;i++){const t=i/6;rod(bronze,[-.22+t*.43,.27,0],[-.25+t*.67,1.52-t*.24,0],.006);}for(const y of [.32,1.39])profile(bronze,[[.07,0],[.07,.05],[.058,.07],[.058,.18],[.07,.2]],-.3-(y-.32)*.05,y,0);const flag=new T.Shape();flag.moveTo(0,0);flag.quadraticCurveTo(.24,.12,.45,.02);flag.lineTo(.55,.12);flag.quadraticCurveTo(.28,.3,0,.12);mesh(new T.ShapeGeometry(flag,8),patina,-.35,1.65,0);
 rod(bronze,[-.36,1.55,0],[-.35,1.84,0],.017);
 g.name='wind-harp candidate b';
 g.updateMatrixWorld(true);const b=new T.Box3(),v=new T.Vector3();g.traverse(n=>{if(n.isMesh){const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));}});const c=b.getCenter(new T.Vector3());for(const o of g.children){o.position.x-=c.x;o.position.z-=c.z;o.position.y-=b.min.y;}g.updateMatrixWorld(true);return g;
}
