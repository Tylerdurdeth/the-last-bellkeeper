// Two-joint deformation for the existing boot meshes: sole follows foot, shaft follows shin.
export function createBootFlex(T, joints) {
  const rigs=[];
  for(const side of ['left','right']) {
    const foot=joints[side+'Foot'],shin=joints[side+'LowerLeg'];
    shin.updateWorldMatrix(true,true);
    const restMap=shin.matrixWorld.clone().invert().multiply(foot.matrixWorld),meshes=[];
    foot.traverse(mesh=>{if(!mesh.isMesh)return;
      const geometry=mesh.geometry,positions=geometry.attributes.position.array.slice(),normals=geometry.attributes.normal.array.slice();
      const toFoot=foot.matrixWorld.clone().invert().multiply(mesh.matrixWorld),fromFoot=toFoot.clone().invert();
      const weights=new Float32Array(positions.length/3),point=new T.Vector3();
      for(let i=0;i<weights.length;i++){point.fromArray(positions,i*3).applyMatrix4(toFoot);weights[i]=T.MathUtils.smoothstep(point.y,-.012,.09);}
      if(!weights.some(w=>w>0))return;
      geometry.computeBoundingSphere();geometry.boundingSphere.radius+=.16;
      meshes.push({geometry,positions,normals,toFoot,fromFoot,weights});
    });
    rigs.push({foot,shin,restMap,meshes});
  }
  const point=new T.Vector3(),bent=new T.Vector3(),normal=new T.Vector3(),bentNormal=new T.Vector3();
  return function updateBoots(){
    for(const {foot,shin,restMap,meshes} of rigs){
      const delta=foot.matrixWorld.clone().invert().multiply(shin.matrixWorld).multiply(restMap);
      for(const {geometry,positions,normals,toFoot,fromFoot,weights} of meshes){
        const transform=fromFoot.clone().multiply(delta).multiply(toFoot),normalMatrix=new T.Matrix3().getNormalMatrix(transform);
        const p=geometry.attributes.position,n=geometry.attributes.normal;
        for(let i=0;i<weights.length;i++){if(!weights[i])continue;
          point.fromArray(positions,i*3);bent.copy(point).applyMatrix4(transform);point.lerp(bent,weights[i]);p.setXYZ(i,point.x,point.y,point.z);
          normal.fromArray(normals,i*3);bentNormal.copy(normal).applyMatrix3(normalMatrix).normalize();normal.lerp(bentNormal,weights[i]).normalize();n.setXYZ(i,normal.x,normal.y,normal.z);
        }p.needsUpdate=true;n.needsUpdate=true;
      }
    }
  };
}
