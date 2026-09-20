// Run: node <this-file> /absolute/path/to/the-last-bellkeeper
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const repo=resolve(process.argv[2]||process.cwd());
const load=p=>import(pathToFileURL(resolve(repo,p)));
const T=await load('node_modules/three/build/three.module.js');
const {createWoodlandLife}=await load('game/woodland-life.js');
const layout=await load('game/world-layout.js');
const prototypes={};
for(const name of ['bramble','hosta','shelf-stump','rabbit','kingfisher','luna-moth'])prototypes[name]=(await load(`game/assets/${name}.js`)).default(T);
function setup(overrides={}) {
  const scene=new T.Scene(),rows=[];
  function place(name,x,z,s,yaw,options) {
    const o=prototypes[name].clone(true);o.position.set(x,options.y,z);o.scale.multiplyScalar(s);o.rotation.y=yaw;scene.add(o);
    rows.push({name,o,x,z,s,yaw,options,home:o.position.clone()});return o;
  }
  const life=createWoodlandLife(T,{place,height:layout.height,shoreClearance:layout.shoreClearance,...overrides});
  return {life,rows};
}
const {life,rows}=setup(), counts={};let total=0;
for(const row of rows) {
  counts[row.name]=(counts[row.name]||0)+1;
  row.o.traverse(o=>{if(o.isMesh)total+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
  assert(layout.shoreClearance(row.x,row.z,.2),row.name+' dry');
  assert(layout.pathDistance(row.x,row.z)>1.65,row.name+' PATH clearance');
  for(const [name,[x,z]] of Object.entries(layout.POINTS))assert(Math.hypot(row.x-x,row.z-z)>2,row.name+' landmark '+name);
  assert.equal(row.options.dynamic,['rabbit','kingfisher','luna-moth'].includes(row.name));
}
assert(total<100000,`triangle ceiling: ${total}`);
assert.equal(counts.rabbit,3);assert.equal(counts.kingfisher,2);assert.equal(counts['luna-moth'],4);
assert(counts.bramble<=4&&counts.hosta<=8&&counts['shelf-stump']<=3);
assert.deepEqual(rows.map(r=>[r.name,r.x,r.z,r.yaw]),setup().rows.map(r=>[r.name,r.x,r.z,r.yaw]),'deterministic placement');
const rabbits=rows.filter(r=>r.name==='rabbit'),birds=rows.filter(r=>r.name==='kingfisher');
let time=0;
const tick=(pos,n=1,gentle=false)=>{for(let i=0;i<n;i++){time+=1/60;life.update(1/60,time,pos,gentle);for(const r of rows){assert(r.o.position.toArray().every(Number.isFinite),'finite animation');assert(layout.shoreClearance(r.o.position.x,r.o.position.z,.15),'dry animation');}}};
for(const r of rabbits) {
  let apex=0,travel=0;
  for(let i=0;i<180;i++){tick(r.home);apex=Math.max(apex,r.o.position.y-layout.height(r.o.position.x,r.o.position.z));travel=Math.max(travel,Math.hypot(r.o.position.x-r.x,r.o.position.z-r.z));}
  assert(apex>.09&&apex<.15,'short hop apex');assert(travel>.5&&travel<.7,'bounded hop');assert(r.o.position.distanceTo(r.home)<1e-8,'rabbit returns');
  tick(r.home,720);assert(r.o.position.distanceTo(r.home)<1e-8,'no repeated startle while player lingers');
}
for(const b of birds) {
  let rise=0;for(let i=0;i<90;i++){tick(b.home);rise=Math.max(rise,b.o.position.y-b.home.y);assert.equal(b.o.position.x,b.home.x);assert.equal(b.o.position.z,b.home.z);}
  assert(rise>.03&&rise<.06,'restrained in-place perch hop');assert(b.o.position.distanceTo(b.home)<1e-8,'bird returns to actual perch');
}
// Reset during a hop must restore the exact home immediately.
tick(new T.Vector3(50,0,50),960);tick(rabbits[0].home,15);
life.update(1/60,-1,new T.Vector3(50,0,50),false);
assert(rabbits[0].o.position.distanceTo(rabbits[0].home)<1e-8,'time reset restores animal');
const moth=rows.find(r=>r.name==='luna-moth'),wing=moth.o.getObjectByName('rightWing'),rest=.27;
tick(new T.Vector3(50,0,50),360,true);let maxGentle=0;
for(let i=0;i<240;i++){tick(new T.Vector3(50,0,50),1,true);maxGentle=Math.max(maxGentle,Math.abs(wing.rotation.z-rest));}
assert(maxGentle>.04&&maxGentle<.09,'gentle wing amplitude');
const before=rows.map(r=>r.o.position.toArray());life.update(0,time,rabbits[0].home,false);assert.deepEqual(rows.map(r=>r.o.position.toArray()),before,'zero dt freezes');
for(const overrides of [{shoreClearance:()=>false},{height:()=>NaN},{place:()=>new T.Group()}]) {
  const empty=setup(overrides);assert.equal(empty.rows.length,0,'invalid placements omitted');empty.life.update(.016,1,new T.Vector3(),true);
}
console.log(JSON.stringify({ok:true,counts,triangles:total,checks:['dry edges','landmark/path clearance','deterministic placement','hop and return','perch-only hop and return','no repeated startles','gentle motion','time reset','empty terrain/place rejection']},null,2));
