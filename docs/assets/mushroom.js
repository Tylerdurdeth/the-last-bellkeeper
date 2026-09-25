export default function(T){
 const root=new T.Group();const stem=new T.MeshStandardMaterial({color:0xe7ddc2,roughness:.95});stem.name='plaster';const capA=new T.MeshStandardMaterial({color:0xd96956,roughness:.85});capA.name='foliage';const capB=new T.MeshStandardMaterial({color:0x77a878,roughness:.9});capB.name='foliage';
 const stemMesh=new T.Mesh(new T.CylinderGeometry(.055,.09,.28,7),stem);stemMesh.position.y=.14;root.add(stemMesh);const cap=new T.Mesh(new T.SphereGeometry(.18,10,6,0,Math.PI*2,0,Math.PI*.52),capA);cap.scale.set(1,.75,1);cap.position.y=.34;root.add(cap);
 for(let i=0;i<3;i++){const s=new T.Mesh(new T.SphereGeometry(.022,6,4),i===1?capB:stem);const a=i*2.1;s.position.set(Math.cos(a)*.12,.39,Math.sin(a)*.12);root.add(s);}
 root.name='mushroom cluster';root.updateMatrixWorld(true);const b=new T.Box3().setFromObject(root),c=b.getCenter(new T.Vector3());root.position.sub(c);root.position.y-=b.min.y;return root;
}
