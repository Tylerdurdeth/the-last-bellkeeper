// Heartwood heart bell, original code geometry: two copper bells of different voice counter-
// hung from one living balance arm (the paired channels and two-part phrase). Chosen from three
// recipe candidates (evidence/round-2/visual/heart-bell). Named pivots: bellLarge, bellSmall.
export default function(T){
 const g=new T.Group();
 const mat=(c,n,r=.8,m=0)=>Object.assign(new T.MeshStandardMaterial({color:c,roughness:r,metalness:m,side:T.DoubleSide}),{name:n});
 const copper=mat(0xb8743f,"metal",.5,.45),patina=mat(0x4f9a8a,"metal",.6,.3),dark=mat(0x2c3a36,"timber"),bark=mat(0x5e4a37,"timber"),ivory=mat(0xe7ddc2,"plaster"),stone=mat(0xa89a7a,"stone"),leaf=mat(0x53785b,"foliage"),glow=Object.assign(mat(0x9ff0dc,"metal",.4,.1),{emissive:new T.Color(0x3fe0c4),emissiveIntensity:.6});
 function mesh(geo,m,x=0,y=0,z=0,p=g){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
 function tube(m,pts,r0,r1=r0,p=g,seg=24){const c=new T.CatmullRomCurve3(pts.map(q=>new T.Vector3(...q))),geo=new T.TubeGeometry(c,seg,1,8,false),a=geo.attributes.position,fr=c.computeFrenetFrames(seg,false);for(let i=0;i<=seg;i++){const pt=c.getPointAt(i/seg),r=r0+(r1-r0)*i/seg;for(let k=0;k<=8;k++){const j=i*9+k,v=new T.Vector3().fromBufferAttribute(a,j).sub(pt).multiplyScalar(r).add(pt);a.setXYZ(j,v.x,v.y,v.z);}}geo.computeVertexNormals();return mesh(geo,m,0,0,0,p);}
 function ring(m,r,t,x,y,z,p=g,rx=Math.PI/2){const o=mesh(new T.TorusGeometry(r,t,6,28),m,x,y,z,p);o.rotation.x=rx;return o;}
 function rod(m,a,b,r=.05,p=g){const v=new T.Vector3(...a),w=new T.Vector3(...b),d=w.clone().sub(v);const o=mesh(new T.CylinderGeometry(r,r,d.length(),10),m,0,0,0,p);o.position.copy(v.add(w).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
 // Bell hung from a pivot group at its crown: lathe body, patina bands, lip, clapper.
 function bell(name,x,y,z,h,flare=1){const piv=new T.Group();piv.name=name;piv.position.set(x,y,z);g.add(piv);const w=h*.52*flare;
  mesh(new T.LatheGeometry([[0,0],[w*.34,-.02*h],[w*.46,-.12*h],[w*.52,-.42*h],[w*.62,-.72*h],[w*.86,-.9*h],[w,-.98*h],[w*.97,-1*h],[w*.84,-.95*h],[w*.56,-.78*h],[w*.46,-.45*h],[w*.38,-.14*h],[0,-.1*h]].map(([a,b])=>new T.Vector2(a,b)),28),copper,0,0,0,piv);
  ring(patina,w*.5,.022*h,0,-.36*h,0,piv);ring(patina,w*.9,.03*h,0,-.9*h,0,piv);ring(copper,w*.16,.035*h,0,.05*h,0,piv,0);
  rod(dark,[0,-.1*h,0],[0,-.82*h,0],.018*h,piv);mesh(new T.SphereGeometry(.07*h,10,8),glow,0,-.86*h,0,piv);return piv;}

 g.name="heart-bells (selected candidate B): balance arm";
 mesh(new T.CylinderGeometry(.75,.95,.2,24),stone,0,.1,0);
 tube(bark,[[0,.15,0],[.06,1.2,0],[-.04,2.3,0],[0,3.05,0]],.26,.14);
 for(let k=0;k<5;k++){const a=k*1.26;tube(bark,[[Math.cos(a)*.2,.8,Math.sin(a)*.2],[Math.cos(a)*.55,.25,Math.sin(a)*.55],[Math.cos(a)*.85,.05,Math.sin(a)*.85]],.1,.03,g,10);}
 tube(copper,[[-1.7,2.72,0],[-.9,2.98,0],[0,3.05,0],[.9,2.98,0],[1.7,2.72,0]],.075,.075);
 for(const s of [-1,1]){rod(copper,[s*1.7,2.72,0],[s*1.7,2.5,0],.03);tube(patina,[[s*.2,3.0,0],[s*.9,3.28,0],[s*1.45,3.0,0]],.03,.02,g,12);}
 mesh(new T.SphereGeometry(.16,12,10),glow,0,3.12,0);ring(copper,.28,.04,0,3.05,0,g,0);
 for(let i=0;i<4;i++)mesh(new T.SphereGeometry(.14,8,6),leaf,Math.sin(i*2)*.3,.9+i*.45,.2).scale.set(1.2,.5,.4);
 bell("bellLarge",-1.7,2.5,0,1.08);bell("bellSmall",1.7,2.5,0,.76,.95);
 g.userData.joints={bellLarge:g.getObjectByName("bellLarge"),bellSmall:g.getObjectByName("bellSmall")};
 g.updateMatrixWorld(true);const b=new T.Box3(),v=new T.Vector3();g.traverse(n=>{if(n.isMesh){const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));}});const c=b.getCenter(new T.Vector3());g.children.forEach(o=>{o.position.x-=c.x;o.position.y-=b.min.y;o.position.z-=c.z;});g.updateMatrixWorld(true);return g;
}
