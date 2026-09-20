// Import-free recipe asset. Rendering, navigation and the field chart share these triangles.
export const PATH=[[-1,18],[-5,13],[-4,8],[-10,5],[-15,0],[-16,-7],[-10,-10],[-10,-17]];
export const TERRAIN={extent:36,ridge:28,offset:8,waterY:-.6,bedY:-4,
  west:-4,east:23,north:-21,south:.65,
  island:{west:4,east:15,north:-13,south:-7.35},
  bridge:{x:8,z:-3.35,length:9,width:2.35},clearChannel:8};
const center=[8,-10.2],TAU=Math.PI*2;
// An asymmetric headland with nibbled shoulders and a quiet, flat bridge landing.
const islandOutline=[[6.4,-7.35],[9.7,-7.35],[10.7,-7.7],[11.6,-8.05],
  [12.1,-8.55],[13.25,-8.65],[14.1,-9.25],[14.55,-10.15],
  [14.0,-11.1],[13.35,-11.55],[12.7,-12.35],[11.3,-12.7],
  [10.15,-13.6],[8.75,-13.75],[7.5,-13.1],[6.3,-12.9],
  [5.35,-12],[4.6,-10.9],[4.3,-9.7],[4.8,-8.65],[5.7,-8.25]];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function distance2(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],u=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return (x-a[0]-u*dx)**2+(z-a[1]-u*dz)**2;}
function edgeDistance(x,z,polygon){let d=Infinity;for(let i=0;i<polygon.length;i++)d=Math.min(d,distance2(x,z,polygon[i],polygon[(i+1)%polygon.length]));return Math.sqrt(d);}
function contains(x,z,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function angle(x,z){return (Math.atan2(x-center[0],z-center[1])+TAU)%TAU;}
const angles=[...Array.from({length:144},(_,i)=>i*TAU/144),
  ...islandOutline.map(([x,z])=>angle(x,z)),
  ...[[6.4,.65],[9.7,.65],[-36,-36],[-36,36],[36,-36],[36,36]].map(([x,z])=>angle(x,z))]
  .sort((a,b)=>a-b).filter((a,i,all)=>!i||a-all[i-1]>1e-8);
function along(a,r){return [center[0]+Math.sin(a)*r,center[1]+Math.cos(a)*r];}
function rayPolygon(a,polygon){const dx=Math.sin(a),dz=Math.cos(a);let best=Infinity;
  for(let i=0;i<polygon.length;i++){const p=polygon[i],q=polygon[(i+1)%polygon.length],ex=q[0]-p[0],ez=q[1]-p[1],det=dx*ez-dz*ex;if(Math.abs(det)<1e-10)continue;
    const px=p[0]-center[0],pz=p[1]-center[1],r=(px*ez-pz*ex)/det,u=(px*dz-pz*dx)/det;if(r>0&&u>=-1e-8&&u<=1+1e-8)best=Math.min(best,r);
  }return best;
}
function squareRadius(a,extent){const dx=Math.sin(a),dz=Math.cos(a);return Math.min(Math.abs(dx)<1e-9?Infinity:((dx>0?extent:-extent)-center[0])/dx,Math.abs(dz)<1e-9?Infinity:((dz>0?extent:-extent)-center[1])/dz);}
const islandR=angles.map(a=>rayPolygon(a,islandOutline));
const basinR=angles.map((a,i)=>{
  function radius(distance){let lo=islandR[i],hi=lo+15;for(let k=0;k<40;k++){const r=(lo+hi)/2,p=along(a,r);if(edgeDistance(...p,islandOutline)<distance)lo=r;else hi=r;}return hi;}
  const base=radius(8),p=along(a,base);
  // Exact flat shelves span the complete bridge width, with .425m spare each side.
  if(p[0]>=6.4-1e-8&&p[0]<=9.7+1e-8&&Math.abs(p[1]-.65)<1e-6)return base;
  const endDistance=Math.min(Math.hypot(p[0]-6.4,p[1]-.65),Math.hypot(p[0]-9.7,p[1]-.65));
  const fade=clamp(endDistance/2,0,1);
  return radius(8+.075+fade*(.25+.75*Math.sin(a*2.3+.8)**2));
});
// Chords between sampled curved-offset points must also clear the entire island.
// Move only offending basin vertices outward; the exact flat bridge shelves stay pinned.
for(let pass=0;pass<12;pass++){
  let changed=false;
  for(let i=0;i<angles.length;i++){const j=(i+1)%angles.length,a=along(angles[i],basinR[i]),b=along(angles[j],basinR[j]);let d=Infinity;
    for(let k=0;k<islandOutline.length;k++){const p=islandOutline[k],q=islandOutline[(k+1)%islandOutline.length];d=Math.min(d,distance2(...p,a,b),distance2(...q,a,b),distance2(...a,p,q),distance2(...b,p,q));}
    if(d<64-1e-7){for(const n of [i,j]){const p=along(angles[n],basinR[n]);if(!(p[0]>=6.4-1e-6&&p[0]<=9.7+1e-6&&Math.abs(p[1]-.65)<1e-6))basinR[n]+=.025;}changed=true;}
  }if(!changed)break;
}
// Rounded, irregular enclosing escarpment; the outer asset footprint stays centred.
const ridgeR=angles.map((a,i)=>{let lo=basinR[i],hi=squareRadius(a,31);
  for(let k=0;k<35;k++){const r=(lo+hi)/2,[x,z]=along(a,r);const value=(Math.abs(x)/28)**8+(Math.abs(z)/28)**8;const target=1+.13*Math.sin(a*5+.4)+.065*Math.sin(a*9);if(value<target)lo=r;else hi=r;}return (lo+hi)/2;});
export const SHORELINES={island:angles.map((a,i)=>along(a,islandR[i])),basin:angles.map((a,i)=>along(a,basinR[i])),ridge:angles.map((a,i)=>along(a,ridgeR[i]))};
function elevation(x,z){let h=.18*Math.sin(x*.29)*Math.cos(z*.24)+.12*Math.sin(z*.40);h+=2.5*Math.exp(-((x+12)**2+(z+12)**2)/130);const b=clamp((x-1)/4,0,1);return h*(1-b)+(1.2+Math.max(0,x-15)*.07)*b;}
const surfaces=[],walls=[],buckets=new Map(),bucketSize=2;
const key=(x,z)=>Math.floor(x/bucketSize)+':'+Math.floor(z/bucketSize);
function addTriangle(a,b,c,region){
  const area=(b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]);if(Math.abs(area)<1e-10)return;
  const tri={p:[a,b,c],land:region!=='water',ridge:region==='ridge',island:region==='island',area};const index=surfaces.length;surfaces.push(tri);
  for(let x=Math.floor(Math.min(a[0],b[0],c[0])/bucketSize);x<=Math.floor(Math.max(a[0],b[0],c[0])/bucketSize);x++)for(let z=Math.floor(Math.min(a[2],b[2],c[2])/bucketSize);z<=Math.floor(Math.max(a[2],b[2],c[2])/bucketSize);z++){const k=x+':'+z;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(index);}
}
function point(a,r,region){const [x,z]=along(a,r);return [x,region==='water'?-4:region==='island'?1.2:elevation(x,z)+(region==='ridge'?5.5+.35*Math.sin(x*.6)*Math.cos(z*.55):0),z];}
function ring(inner,outer,steps,region){
  for(let n=0;n<steps;n++)for(let i=0;i<angles.length;i++){const j=(i+1)%angles.length;
    const radius=(k,t)=>inner[k]+(outer[k]-inner[k])*t;
    const a=point(angles[i],radius(i,n/steps),region),b=point(angles[j],radius(j,n/steps),region),c=point(angles[i],radius(i,(n+1)/steps),region),d=point(angles[j],radius(j,(n+1)/steps),region);
    addTriangle(a,c,b,region);addTriangle(b,c,d,region);
  }
}
function cliff(radii,innerRegion,outerRegion){
  for(let i=0;i<angles.length;i++){const j=(i+1)%angles.length,a=point(angles[i],radii[i],innerRegion),b=point(angles[j],radii[j],innerRegion),c=point(angles[i],radii[i],outerRegion),d=point(angles[j],radii[j],outerRegion);walls.push([a,c,b],[b,c,d]);}
}
ring(angles.map(()=>0),islandR,4,'island');
ring(islandR,basinR,6,'water');
ring(basinR,ridgeR,22,'mainland');
const extentR=angles.map(a=>squareRadius(a,36));ring(ridgeR,extentR,6,'ridge');
cliff(islandR,'island','water');cliff(basinR,'water','mainland');cliff(ridgeR,'mainland','ridge');
for(let i=0;i<angles.length;i++){const j=(i+1)%angles.length,a=point(angles[i],extentR[i],'ridge'),b=point(angles[j],extentR[j],'ridge'),c=[a[0],-8,a[2]],d=[b[0],-8,b[2]];walls.push([a,c,b],[b,c,d]);}
function sample(x,z){
  let result=null;
  for(const index of buckets.get(key(x,z))||[]){const tri=surfaces[index],[a,b,c]=tri.p;
    const u=((x-a[0])*(c[2]-a[2])-(c[0]-a[0])*(z-a[2]))/tri.area;
    const v=((b[0]-a[0])*(z-a[2])-(x-a[0])*(b[2]-a[2]))/tri.area;
    if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8){const y=a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]);if(!result||y>result.y)result={...tri,y};}
  }return result;
}
export function isIsland(x,z){return sample(x,z)?.island??false;}
export function isLand(x,z){return sample(x,z)?.land??false;}
export function height(x,z){return sample(x,z)?.y??TERRAIN.bedY;}
export function terrainGround(x,z){const p=sample(x,z);return p?.land?p.y:null;}
export function terrainSamples(){return surfaces;}
export function shoreDistance(x,z){return Math.min(edgeDistance(x,z,SHORELINES.island),edgeDistance(x,z,SHORELINES.basin));}
export function ridgeBlocked(x,z,r=0){if(Math.max(Math.abs(x),Math.abs(z))+r<25)return false;return !contains(x,z,SHORELINES.ridge)||edgeDistance(x,z,SHORELINES.ridge)<=r;}
export function shoreClearance(x,z,r=0){return isLand(x,z)&&[[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,r],[r,-r],[-r,-r]].every(([a,b])=>isLand(x+a,z+b));}
export default function(T){
  const root=new T.Group();root.name='Organic island woodland terrain';root.userData.keepHierarchy=true;
  const material=(color,name)=>Object.assign(new T.MeshStandardMaterial({color,roughness:.95,side:T.DoubleSide}),{name});
  const ground=material(0xffffff,'ground');ground.vertexColors=true;
  const positions=[],colors=[],waterPositions=[],waterUV=[],waterBank=[];
  const branch=[[-4,8],[0,5],[5,3],[8,1.4],[8,-11]];
  function color(x,z,ridge,wall=false){
    const col=new T.Color(ridge||wall?0x777d69:0x618051);
    if(!ridge&&!wall){let distance=99;for(const route of [PATH,branch])for(let k=1;k<route.length;k++){const [a,b]=route[k-1],[c,d]=route[k],dx=c-a,dz=d-b,t=clamp(((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz),0,1);distance=Math.min(distance,Math.hypot(x-a-t*dx,z-b-t*dz));}col.lerp(new T.Color(0xd4c393),1-T.MathUtils.smoothstep(distance,.8,2));if(shoreDistance(x,z)<.8)col.lerp(new T.Color(0x8b8062),.65);}
    return col.multiplyScalar(.96+Math.sin(x*.72)*Math.cos(z*.51)*.07);
  }
  function triangle(points,ridge=false,wall=false){for(const p of points){positions.push(p[0],p[1]+8,p[2]);const col=color(p[0],p[2],ridge,wall);colors.push(col.r,col.g,col.b);}}
  for(const tri of surfaces){triangle(tri.p,tri.ridge,!tri.land);if(!tri.land)for(const p of tri.p){waterPositions.push(p[0],7.4,p[2]);waterUV.push(p[0],p[2]);waterBank.push(shoreDistance(p[0],p[2]));}}
  for(const points of walls)triangle(points,false,true);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,ground);mesh.name='land-and-cliff';mesh.receiveShadow=true;root.add(mesh);
  const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(waterPositions,3));wg.setAttribute('uv',new T.Float32BufferAttribute(waterUV,2));wg.setAttribute('bankDistance',new T.Float32BufferAttribute(waterBank,1));wg.computeVertexNormals();
  const water=new T.Mesh(wg,material(0x285c62,'water'));water.name='water';water.userData.worldUV=true;root.add(water);root.userData.water=water;
  return root;
}
