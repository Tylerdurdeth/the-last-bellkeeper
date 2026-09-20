import * as T from 'three';import terrain,{terrainGround,isLand,terrainSamples,SHORELINES,ridgeBlocked} from '../game/assets/terrain.js';import {height,PATH,POINTS} from '../game/world-layout.js';import assert from 'node:assert/strict';
const t=terrain(T);const bounds=new T.Box3().setFromObject(t);assert(Math.abs(bounds.min.y)<.001,'asset normalization must not shift the ground');t.position.y=-8;t.updateMatrixWorld(true);const ray=new T.Raycaster(undefined,new T.Vector3(0,-1,0));
for(const [x,z]of [[-1,18],[-5,13],[-4,8],[-15,0],[-16,-7],[-10,-17],[6,2.5],[8,-10]]){ray.ray.origin.set(x,20,z);const hit=ray.intersectObject(t,true)[0];assert(hit,`missing ground ${x},${z}`);assert(Math.abs(hit.point.y-height(x,z))<.08,`rendered/physics mismatch at ${x},${z}: ${hit.point.y} vs ${height(x,z)}`);}
const land=t.getObjectByName('land-and-cliff'),water=t.getObjectByName('water');
function hit(object,x,z){ray.ray.origin.set(x,30,z);return ray.intersectObject(object,true)[0]?.point.y??null;}
let contacts=0,wet=0;
// Sample every authored triangle, including both sides of each irregular shore.
for(const tri of terrainSamples()){
 const [a,b,c]=tri.p,x=a[0]*.2+b[0]*.35+c[0]*.45,z=a[2]*.2+b[2]*.35+c[2]*.45,y=hit(land,x,z);
  if(isLand(x,z)){assert.notEqual(y,null);assert(Math.abs(y-terrainGround(x,z))<.00002,`mesh contact ${x},${z}`);contacts++;}
  else {assert.equal(terrainGround(x,z),null);assert.equal(y,-4);assert(Math.abs(hit(water,x,z)+.6)<.00001);wet++;}
}
for(const [x,z] of [...PATH,...Object.values(POINTS),[-7,-5],[11,-11]])assert.notEqual(terrainGround(x,z),null,`preserved landmark ${x},${z}`);
for(let i=0;i<SHORELINES.ridge.length;i+=11){
 const a=SHORELINES.ridge[i],b=SHORELINES.ridge[(i+1)%SHORELINES.ridge.length],mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
 const len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=-(b[1]-a[1])/len,dz=(b[0]-a[0])/len,x=mx-dx*.5,z=mz-dz*.5;
 const horizontal=new T.Raycaster(new T.Vector3(x,height(x,z)+1,z),new T.Vector3(dx,0,dz));
 assert(Math.abs(horizontal.intersectObject(land,true)[0].distance-.5)<.00003,'visible vertical ridge face');
 assert(!ridgeBlocked(x,z,.23));assert(ridgeBlocked(x+dx*.28,z+dz*.28,.23),'body touches the same ridge');
}
console.log(`PASS ${contacts} dry mesh contacts, ${wet} wet cells, visible ridge collision, landmarks and baseline`);
