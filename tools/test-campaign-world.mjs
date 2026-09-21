import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCampaignWorld} from '../game/campaign-world.js';
import {createMovement} from '../game/movement.js';
import {writeFile} from 'node:fs/promises';
globalThis.location={href:new URL('../game/index.html',import.meta.url).href};
const scene=new T.Scene(),w=await buildCampaignWorld(scene);
assert.equal(w.ground(8,-12),undefined);assert(Math.abs(w.ground(8,-13)-1.1741935483870967)<1e-12);
assert.equal(w.ground(8,-31),null);assert.equal(w.ground(2,-31),null);
assert.equal(w.ground(40,-59),undefined);
for(const x of [1.01,2.5,12,14.99])for(const z of [-14.01,-18,-25,-28.99])assert.equal(w.ground(x,z),null,'clipped strip must not fall back');
assert.equal(w.ground(-13,-18),undefined,'old garden preserved');
const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
function compare(){scene.updateMatrixWorld(true);const meshes=w.root.userData.supports.filter(s=>s.enabled).map(s=>s.mesh).concat(w.root.userData.floor);let tested=0;
for(let x=1.11;x<19;x+=.37)for(let z=-13.01;z>-70;z-=.39){const h=w.ground(x,z);if(h===undefined)continue;ray.set(new T.Vector3(x,20,z),down);const hits=ray.intersectObjects(meshes,false);if(h===null)assert.equal(hits.length,0,`unexpected mesh ${x},${z}`);else{assert(hits.length,`missing mesh ${x},${z}`);assert(Math.abs(h-hits[0].point.y)<2e-6,`support mismatch ${x},${z}: ${h}/${hits[0]?.point.y}`);}tested++;}return tested;}
const lockedSamples=compare();
w.update(.1,.1,new T.Vector3(8,0,-32),{bridge:true});const movingSamples=compare();assert(w.ground(8,-31)<-.2&&w.ground(8,-31)>-4.2);
for(let i=0;i<180;i++)w.update(1/60,i/60,new T.Vector3(8,0,-32),{bridge:true});
assert.equal(w.ground(8,-31),-.2);const openSamples=compare();
for(const [key,p] of Object.entries(w.points)){assert.equal(p.y,w.ground(p.x,p.z),key);assert(!w.blocked(p.x,p.z,.23),key+' blocked');}
// Continuous route around the optional jump, including all landing transitions.
const route=[[8,-13],[8,-20],[5,-22],[5,-27.5],[8,-28],[8,-35],[8,-37],[5.1,-38],[5.1,-43.5],[8,-44],[8,-51],[4,-50],[0,-56],[5,-59],[11,-59],[8,-63],[8,-67]];
let routeSamples=0;
for(let i=1;i<route.length;i++){const [ax,az]=route[i-1],[bx,bz]=route[i],n=Math.ceil(Math.hypot(bx-ax,bz-az)/.045);let previous=w.ground(ax,az);for(let j=1;j<=n;j++){const x=T.MathUtils.lerp(ax,bx,j/n),z=T.MathUtils.lerp(az,bz,j/n),h=w.ground(x,z);assert.equal(typeof h,'number',`route void ${x},${z}`);assert(!w.blocked(x,z,.23),`route rail ${x},${z}`);assert(Math.abs(h-previous)<.28,`step ${x},${z}`);previous=h;routeSamples++;}}
assert.equal(w.ground(8,-40.8),null);assert.equal(typeof w.ground(5.1,-40.8),'number');
for(const destZ of [-49,-51])for(let i=0;i<=100;i++)assert(!w.blocked(4+4*i/100,-50+(destZ+50)*i/100,.23),'inspection return rail');
for(let i=0;i<=150;i++)assert(!w.blocked(5,-22-6*i/150,.23),'source-to-wheel line');
assert(w.blocked(4.8,-64.3,.23),'heartroot physical base');
for(let i=0;i<=150;i++)assert(!w.blocked(8,-59-8*i/150,.23),'guardian-to-bell approach');
for(let i=0;i<=150;i++)assert(!w.blocked(11-3*i/150,-59-8*i/150,.23),'outward-vane-to-bell approach');
const maxJump=2*6.1/19*5.8;assert(maxJump<5);assert(maxJump>1.6);
const jumps=[];
for(const run of [true])for(const direction of [-1,1]){
 const target=new EventTarget();const startZ=direction===-1?-39.25:-42.35;
 const m=createMovement(T,{start:[8,w.ground(8,startZ),startZ],sampleGround:w.ground,blocked:w.blocked,inputTarget:target,cameraYaw:()=>direction===-1?0:Math.PI,walkSpeed:1.65,runSpeed:5.8,acceleration:12,deceleration:16});
 const key=code=>{const e=new Event('keydown');Object.defineProperty(e,'code',{value:code});target.dispatchEvent(e);};key('ArrowUp');if(run)key('ShiftLeft');let jumped=false,landed=false;
 for(let i=0;i<240;i++){if(!jumped&&(direction===-1?m.position.z<=-39.9:m.position.z>=-41.7)){m.jump();jumped=true;}m.update(1/120);assert(!m.recovered,'jump recovery');if(jumped&&m.grounded&&(direction===-1?m.position.z<-41.6:m.position.z>-40)){landed=true;break;}}
 assert(landed,`jump failed run=${run} direction=${direction}`);jumps.push({run,direction,landed});m.dispose();
}
let triangles=0;w.root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
const result={timestamp:new Date().toISOString(),pass:true,lockedSamples,movingSamples,openSamples,routeSamples,jumps,triangles,maxLevelJump:maxJump,points:Object.fromEntries(Object.entries(w.points).map(([k,v])=>[k,v.toArray()])),gaps:w.root.userData.gaps};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
