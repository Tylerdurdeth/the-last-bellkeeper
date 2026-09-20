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

curve(wood,[[-.65,0,0],[-.59,.75,-.08],[-.55,1.4,0],[-.3,1.66,0],[.04,1.51,0],[.46,1.65,0],[.65,1.46,0]],.044);for(let i=0;i<3;i++){const x=-.25+i*.31,y=.68+(i%2?.0:.2);rod(rope,[x,1.56,0],[x,y+.3,0],.01);profile(ivory,[[.17,0],[.15,.07],[.14,.14],[.11,.25],[.055,.3],[.04,.33],[.027,.33],[.033,.29],[.08,.22],[.12,.07],[.14,0]],x,y,0);rod(bronze,[x,y+.22,0],[x,y-.07,0],.012);ell(bronze,x,y-.045,0,.04,.05,.035);ring(patina,x,y+.28,0,.048,.009).rotation.x=Math.PI/2;}for(let i=0;i<6;i++){const x=-.6+i*.23;rod(wood,[x,1.55,0],[x+.05,1.8,.05],.012,.006);ell(leaf,x+.07,1.77,.05,.06,.11,.025);}ell(stone,-.65,.045,0,.22,.06,.16);
 g.name='seed-bells candidate b';
 g.updateMatrixWorld(true);const b=new T.Box3(),v=new T.Vector3();g.traverse(n=>{if(n.isMesh){const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));}});const c=b.getCenter(new T.Vector3());for(const o of g.children){o.position.x-=c.x;o.position.z-=c.z;o.position.y-=b.min.y;}g.updateMatrixWorld(true);return g;
}
