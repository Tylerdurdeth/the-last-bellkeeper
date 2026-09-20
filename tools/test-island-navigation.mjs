import assert from 'node:assert/strict';
import * as T from 'three';
import {buildWorld} from '../game/world.js';
import {createMovement} from '../game/movement.js';
import {isIsland,isLand,PATH,POINTS,height,TERRAIN,SHORELINES} from '../game/world-layout.js';

// Load the same recipes, loader, dressing and ground callbacks as the game.
globalThis.location={href:new URL('../game/index.html',import.meta.url).href};
const scene=new T.Scene(),world=await buildWorld(scene,{style(){}});
scene.updateMatrixWorld(true);
const pos=new T.Vector3(-1,height(-1,18),18);
const update=(dt,restored)=>world.update(dt,0,pos,restored,true,null);
const deck=world.bridge.getObjectByName('bridge-deck');
// Measure the closest pair of complete polygon edges, not only matching radial
// samples: a diagonal chord must never quietly narrow the channel below 8m.
function edgeDistance(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],u=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-u*dx,p[1]-a[1]-u*dz);}
let minimumChannel=Infinity;
for(let i=0;i<SHORELINES.island.length;i++)for(let j=0;j<SHORELINES.basin.length;j++){
 const a=SHORELINES.island[i],b=SHORELINES.island[(i+1)%SHORELINES.island.length],c=SHORELINES.basin[j],d=SHORELINES.basin[(j+1)%SHORELINES.basin.length];
 minimumChannel=Math.min(minimumChannel,edgeDistance(a,c,d),edgeDistance(b,c,d),edgeDistance(c,a,b),edgeDistance(d,a,b));
}
assert(minimumChannel>=8-1e-6,`actual polygon clearance ${minimumChannel}`);
for(const polygon of [SHORELINES.island,SHORELINES.basin]){
 let twiceArea=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];twiceArea+=a[0]*b[1]-b[0]*a[1];}
 const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]);const boxArea=(Math.max(...xs)-Math.min(...xs))*(Math.max(...zs)-Math.min(...zs));
 assert(Math.abs(twiceArea)/2/boxArea<.85,'shore silhouette must not revert to a rectangle');
}
const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
function renderedDeck(x,z){ray.ray.origin.set(x,30,z);return ray.intersectObject(deck,true)[0]?.point.y??null;}
function fixture(x,z,dx,dz,hz){
 const target=new EventTarget();
 // ArrowUp at this camera angle points along the requested world direction.
 const yaw=Math.atan2(-dx,-dz);
 const m=createMovement(T,{inputTarget:target,start:[x,world.ground(x,z),z],sampleGround:world.ground,blocked:world.blocked,runSpeed:5.8,walkSpeed:1.65,acceleration:12,deceleration:16,cameraYaw:()=>yaw});
 const key=code=>{const e=new Event('keydown',{cancelable:true});Object.defineProperty(e,'code',{value:code});target.dispatchEvent(e);};
 key('ArrowUp');key('ShiftLeft');
 return {m,tick:()=>m.update(1/hz)};
}

// Flood fill actual support (including rock tops), with eight neighbours.
// A step/jump-sized height allowance intentionally overestimates walking access.
function reachable(){
 const step=.5,min=-27.5,n=111,ground=new Float64Array(n*n),blocked=new Uint8Array(n*n);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=min+i*step,z=min+j*step,k=j*n+i;ground[k]=world.ground(x,z)??NaN;blocked[k]=world.blocked(x,z,.23)?1:0;}
 const start=Math.round((18-min)/step)*n+Math.round((-1-min)/step),seen=new Set([start]),queue=[start];let island=false;
 for(let q=0;q<queue.length;q++){const k=queue[q],i=k%n,j=Math.floor(k/n);if(isIsland(min+i*step,min+j*step))island=true;
  for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const a=i+di,b=j+dj,l=b*n+a;if(a<0||a>=n||b<0||b>=n||seen.has(l)||blocked[l]||!Number.isFinite(ground[l])||Math.abs(ground[l]-ground[k])>1)continue;seen.add(l);queue.push(l);}
 }
 return {island,count:seen.size};
}
assert(!reachable().island,'island must be disconnected before restoration');
assert.equal(world.ground(0,-8),null,'western bypass is water');
assert.equal(world.ground(19,-9),null,'eastern bypass is water');
assert.equal(world.ground(8,-17),null,'northern bypass is water');
assert.equal(world.ground(8,-3.35),null,'hidden bridge cannot support feet');
for(const [x,z] of [...PATH,...Object.values(POINTS),[-7,-5],[11,-11]])assert.notEqual(world.ground(x,z),null,`landmark support ${x},${z}`);

// Conservative ballistic envelope: include every accessible mainland support
// near the island, even rock launch positions, plus the full coyote distance.
let maxLaunch=-Infinity;
for(let x=-7;x<=26;x+=.25)for(let z=-24;z<=4;z+=.25){if(isIsland(x,z)||world.blocked(x,z,.23))continue;const y=world.ground(x,z);if(y!==null)maxLaunch=Math.max(maxLaunch,y);}
const maxRange=5.8*(.11+(6.1+Math.sqrt(6.1**2+2*19*Math.max(0,maxLaunch-1.2)))/19);
assert(maxRange<8,`worst elevated/coyote jump ${maxRange} must remain shorter than clear channel`);

// Real movement from all four shores, including oblique corner approaches.
const launches=[];
for(const x of [4,5.5,8,11,14.8]){launches.push([x,3.65,0,-1,.65]);launches.push([x,-24,0,1,-21]);}
for(const z of [-12.8,-11,-9,-7.5]){launches.push([-7,z,1,0,-4]);launches.push([26,z,-1,0,23]);}
for(const [x,z,dx,dz] of [[1,3.65,1,-1],[18,3.65,-1,-1],[-7,-16,1,1],[26,-16,-1,1]])launches.push([x,z,dx/Math.SQRT2,dz/Math.SQRT2,null]);
let attempts=0;
for(const hz of [30,60,120])for(const [x,z,dx,dz,edge] of launches)for(const delay of [-.08,0,.05,.10]){
 const {m,tick}=fixture(x,z,dx,dz,hz);let jumped=false,air=0,moved=false;
 // Derive the actual irregular bank from support instead of the old rectangle.
 let shore=0;while(shore<10&&isLand(x+dx*shore,z+dz*shore))shore+=.02;
 for(let i=0;i<hz*2;i++){
  const remaining=shore-((m.position.x-x)*dx+(m.position.z-z)*dz);
  if(!m.grounded)air+=1/hz;
  if(!jumped&&(delay<0?remaining<5.8*-delay:air>=delay&&(!m.grounded||remaining<=.04))){m.jump();jumped=true;}
  tick();if(m.position.distanceTo(new T.Vector3(x,world.ground(x,z),z))>.3)moved=true;
  assert(!(m.grounded&&isIsland(m.position.x,m.position.z)),`bypass at ${hz}Hz from ${x},${z}, delay ${delay}`);
 }
 assert(moved,'test must drive the character');m.dispose();attempts++;
}

// The first restoration frame must not conjure a floor at its final height.
update(1/120,true);assert.equal(world.ground(8,-3.35),null);
let risingSamples=0;
for(let i=0;i<120;i++){update(1/120,true);const visible=renderedDeck(8,-3.35),support=world.ground(8,-3.35);if(visible>TERRAIN.waterY){assert(Math.abs(support-visible)<1e-8);risingSamples++;}else assert.equal(support,null);}
assert(risingSamples>0);
for(let i=0;i<120;i++)update(1/60,true);
assert(reachable().island,'restored deck must connect mainland and sanctuary');
for(const x of [6.84,7.5,8,8.5,9.16])for(let z=-7.3;z<.6;z+=.11)assert(Math.abs(world.ground(x,z)-renderedDeck(x,z))<1e-8,'support must match actual planks');
assert.equal(world.ground(6.7,-3.35),null,'no floor beyond deck width');
assert.equal(world.ground(9.3,-3.35),null,'no floor beyond deck width');
for(const hz of [30,60,120])for(const [z,dz,goal] of [[2,-1,-9],[-9,1,2]]){
 const {m,tick}=fixture(8,z,0,dz,hz);let reached=false;
 for(let i=0;i<hz*3;i++){tick();assert(!m.recovered,'bridge crossing must not recover');assert(m.grounded,'continuous bridge contact');if(dz<0?m.position.z<goal:m.position.z>goal){reached=true;break;}}
 assert(reached,`bridge traversal ${hz}Hz ${dz}`);m.dispose();
}
update(0,false);assert.equal(world.ground(8,-3.35),null,'reset removes support immediately');assert(!reachable().island);
console.log(`PASS organic polygon gap ${minimumChannel.toFixed(3)}m, island isolation, ${attempts} real-input jump attempts, elevated jump bound ${maxRange.toFixed(2)}m, ${risingSamples} rise contacts, both bridge directions at 30/60/120Hz and reset`);
