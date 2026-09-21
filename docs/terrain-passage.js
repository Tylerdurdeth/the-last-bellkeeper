// Clip the existing authored woodland mesh at the new rootway cut. Interpolate
// every attribute so paint, bank distance and normals survive the seam.
export function carvePassage(T,root){
 root.traverse(mesh=>{if(!mesh.isMesh)return;
  const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),attrs=g.attributes,keys=Object.keys(attrs),p=attrs.position;
  const output=Object.fromEntries(keys.map(k=>[k,[]]));
  function clip(poly,axis,value,greater){const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.position[axis]-value)*(greater?1:-1),db=(b.position[axis]-value)*(greater?1:-1),ina=da>=-1e-8,inb=db>=-1e-8;if(ina)result.push(a);if(ina!==inb){const t=da/(da-db),v={};for(const k of keys)v[k]=a[k].map((n,j)=>n+(b[k][j]-n)*t);result.push(v);}}return result;}
  const regions=[[[0,1,false]],[[0,15,true]],[[0,1,true],[0,15,false],[2,-14,true]]];
  for(let i=0;i<p.count;i+=3){const tri=[0,1,2].map(j=>Object.fromEntries(keys.map(k=>[k,Array.from({length:attrs[k].itemSize},(_,n)=>attrs[k].array[(i+j)*attrs[k].itemSize+n])])));
   for(const region of regions){let poly=tri;for(const args of region)poly=clip(poly,...args);for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]])for(const k of keys)output[k].push(...v[k]);}
  }
  const next=new T.BufferGeometry();for(const k of keys)next.setAttribute(k,new T.BufferAttribute(new attrs[k].array.constructor(output[k]),attrs[k].itemSize,attrs[k].normalized));next.computeBoundingBox();next.computeBoundingSphere();mesh.geometry=next;g.dispose();
 });
}
export const passageDressing=(x,z,r=0)=>z<-14+r&&x>1-r&&x<15+r;
