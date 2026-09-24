import * as T from 'three';
import {ASSET} from './assetlib.js';
import {height,POINTS} from './world-layout.js';
import {GARDEN_CATCH} from './garden.js';

// Story prompts answer wherever the hero touches what is drawn, from any side:
// [x,z,r] horizontal circles = visible footprint + hero radius + a small margin.
// Porch covers the door AND the pinned note left of Mara; wheel covers its long
// rotor; garden matches the painted catch ring; far bell covers the whole bell.
const STORY_ZONES={porch:[[...POINTS.porch,1.55],[-8,11.9,1.2]],chime:[[...POINTS.chime,2.1]],garden:[[...POINTS.garden,GARDEN_CATCH]],wheel:[[...POINTS.wheel,2.3],[4.9,2.15,1.3],[6.95,3.15,1.3]],finish:[[...POINTS.overlook,2.1]]};
export function storyZone(id,p){return STORY_ZONES[id].some(([x,z,r])=>Math.hypot(p.x-x,p.z-z)<r&&Math.abs(p.y-height(x,z))<2);}

// Optional woodland play. Every solid shape is a clone of a reviewed recipe
// asset; the only new geometry is a small non-colliding pollen particle field.
// Time is accumulated from dt so pausing and reset cannot leave queued effects.
export async function createWoodlandDiscoveries(scene,art,{caption=()=>{},sound}={}){
 const root=new T.Group();root.name='Woodland discoveries';scene.add(root);
 const prototypes={};
 await Promise.all(['flower','rock','lantern','bird','gong','seed-bells','wind-harp'].map(async name=>{
  prototypes[name]=await ASSET('./assets/'+name+'.js',{keepHierarchy:name==='bird'});
  art.style(prototypes[name]);
 }));
 const emit=kind=>{if(typeof sound==='function')sound(kind);else sound?.cue?.(kind);};
 function place(name,x,z,scale=1,y=height(x,z)){
  const o=prototypes[name].clone(true);o.position.set(x,y,z);o.scale.setScalar(scale);root.add(o);return o;
 }
 function glow(o,color){
  const list=[];o.traverse(n=>{if(!n.isMesh)return;n.material=(Array.isArray(n.material)?n.material:[n.material]).map(m=>{const copy=m.clone();if(copy.emissive){copy.emissive.setHex(color);copy.emissiveIntensity=0;list.push(copy);}return copy;});if(n.material.length===1)n.material=n.material[0];});return list;
 }
 const flowers=[];
 for(let i=0;i<11;i++){
  const a=i/10*Math.PI*1.65,x=-3+Math.cos(a)*(.65+i*.04),z=12+Math.sin(a)*.85;
  const o=place('flower',x,z,1.15+(i%3)*.13);o.rotation.y=i*1.7;
  flowers.push({o,glow:glow(o,0x57baa0)});
 }
 const flowerLantern=place('lantern',-2.2,12,.34);const flowerGlow=glow(flowerLantern,0x81f5ce);
 const birds=[];
 for(let i=0;i<5;i++){
  const x=-16+(i%3-1)*.48,z=-4+Math.floor(i/3)*.55;
  const o=place('bird',x,z,1.35);birds.push({o,home:o.position.clone(),left:o.getObjectByName('leftWing'),right:o.getObjectByName('rightWing')});
 }
 // Distinct instruments carry the rising melody: low gong, seed bells, wind harp.
 // Ground marks give the order without making three copies of one object.
 const stones=[];
 for(let i=0;i<3;i++){
  const x=-8.8+i*.83,z=-11.5-i*.23,o=place(['gong','seed-bells','wind-harp'][i],x,z,[.48,.43,.52][i]);
  o.rotation.y=.55;
  const box=new T.Box3().setFromObject(o),lantern=place('lantern',x,z,.24,box.max.y+.05);
  const marks=[];for(let k=0;k<=i;k++)marks.push(place('flower',x+(k-i*.5)*.22,z+.42,.57));
  stones.push({o,lantern,home:o.position.clone(),top:lantern.position.y,glow:glow(lantern,0x8befce),marks});
 }
 const pollenGeometry=new T.BufferGeometry();pollenGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(32*3),3));
 const pollen=new T.Points(pollenGeometry,new T.PointsMaterial({color:0xc9f6ae,size:.065,transparent:true,opacity:.7,depthWrite:false}));pollen.frustumCulled=false;root.add(pollen);
 let elapsed=0,flowerTime=-100,flowerFound=false,birdTime=-100,birdMode='rest',birdStartles=0,birdCalls=0,birdNear=false,stoneStep=0,stoneSolved=false,stoneFlash=-100,wrongFlash=-100,stoneClue=false;
 let playerPosition=new T.Vector3(999,0,999);
 const distance=(p,x,z)=>Math.hypot(p.x-x,p.z-z);
 function nearPoint(p,x,y,z,r){return distance(p,x,z)<r&&Math.abs((p.y??height(x,z))-y)<2.5;}
 function context(player=playerPosition){
  const candidates=[];
  if(nearPoint(player,-3,height(-3,12),12,2.2)&&elapsed-flowerTime>1.9)candidates.push({id:'flowers',label:flowerFound?'Stir the bellflowers':'Brush the bellflowers',d:distance(player,-3,12)});
  if(nearPoint(player,-16,height(-16,-4),-4,3.3)&&elapsed-birdTime>2.7)candidates.push({id:'birds',label:'Whistle to the birds',d:distance(player,-16,-4)});
  for(let i=0;i<3;i++){const s=stones[i];if(nearPoint(player,s.home.x,s.home.y,s.home.z,1.2)&&elapsed-stoneFlash>.48&&elapsed-wrongFlash>.65)candidates.push({id:'stone-'+i,label:['Strike the low gong','Ring the seed bells','Play the high harp'][i],d:distance(player,s.home.x,s.home.z)});}
  candidates.sort((a,b)=>a.d-b.d);const c=candidates[0];return c?{kind:'discovery',id:c.id,label:c.label}:null;
 }
 function interact(id,state={}){
  // Reject stale prompts after the player moves, plus repeated presses in a beat.
  if(context(playerPosition)?.id!==id)return false;
  if(id==='flowers'){
   flowerTime=elapsed;emit('release');
   caption(flowerFound?'The bellflowers pass your touch from stem to stem.':'A ripple through the bellflowers wakes a forgotten lantern.',4);flowerFound=true;
  }else if(id==='birds'){
   birdTime=elapsed;birdMode='called';birdCalls++;emit('bird');caption('Your whistle brings an answering circle of wings.',3);
  }else if(id.startsWith('stone-')){
   const i=Number(id.slice(6));stoneFlash=elapsed;
   if(stoneSolved){emit('chime');return true;}
   if(i===stoneStep){stoneStep++;emit('stone-'+i);if(stoneStep===3){stoneSolved=true;emit('restore');caption(state.awakened?'Gong, seed bells, harp. Their rising song frees the current in the garden.':'The instruments remember the song. Wake the root chime to release its wind.',4);}else caption(stoneStep===1?'The low gong holds its note. The seed bells answer next.':'The seed bells join it. Let the high harp finish the song.',3);}
   else {wrongFlash=elapsed;stoneStep=0;emit('hazard');caption('The melody breaks. Begin with the low bronze gong.',3);}
  }else return false;
  return true;
 }
 function applyVisuals(gentle=false){
  const ft=elapsed-flowerTime;
  flowers.forEach((f,i)=>{const age=ft-i*.10,wave=age>0&&age<1.4?Math.sin(age/1.4*Math.PI):0;f.o.rotation.x=-wave*(gentle?.08:.40);f.o.rotation.z=wave*.12;for(const m of f.glow)m.emissiveIntensity=wave*.55;});
  for(const m of flowerGlow)m.emissiveIntensity=flowerFound?.55+.07*Math.sin(elapsed*2):0;
  flowerLantern.position.y=height(-2.2,12)+(flowerFound?Math.min(1,Math.max(0,ft))*.24:0);
  const bt=elapsed-birdTime;
  birds.forEach((b,i)=>{
   b.o.position.copy(b.home);b.o.rotation.set(0,i*.7,0);let flying=false;
   if(birdMode!=='rest'){
    const duration=birdMode==='called'?7:5,u=T.MathUtils.clamp(bt/duration,0,1),envelope=Math.sin(u*Math.PI),a=bt*1.3+i*Math.PI*.4;
    const r=birdMode==='called'?1.5:2.8;
    b.o.position.x+=Math.cos(a)*r*envelope;b.o.position.z+=Math.sin(a)*r*envelope;b.o.position.y+=(1.5+i*.12)*Math.pow(envelope,.6);b.o.rotation.y=-a;flying=envelope>.02;
   }
   if(b.left)b.left.rotation.z=flying?Math.sin(elapsed*28+i)*.8:0;
   if(b.right)b.right.rotation.z=flying?-Math.sin(elapsed*28+i)*.8:0;
  });
  stones.forEach((s,i)=>{
   const lit=stoneSolved||i<stoneStep,celebrate=stoneSolved?Math.max(0,1-(elapsed-stoneFlash)/2.4):0;
   s.o.position.copy(s.home);s.o.rotation.z=elapsed-wrongFlash<.4?Math.sin((elapsed-wrongFlash)*40)*.035:0;
   s.lantern.position.y=s.top+celebrate*Math.sin(Math.PI*Math.min(1,(elapsed-stoneFlash)/2.4))*.38;
   for(const m of s.glow)m.emissiveIntensity=lit?.7+.08*Math.sin(elapsed*2+i):0;
   for(const f of s.marks)f.rotation.x=lit?Math.sin(elapsed*2+i)*.10:0;
  });
  const flowerParticles=ft>=0&&ft<3.4,stoneParticles=stoneSolved&&elapsed-stoneFlash<3;
  pollen.visible=flowerParticles||stoneParticles;
  if(pollen.visible){const age=flowerParticles?ft:elapsed-stoneFlash,cx=flowerParticles?-3:-8,cz=flowerParticles?12:-11.7,y=height(cx,cz),positions=pollenGeometry.attributes.position;for(let i=0;i<32;i++){const a=i*2.399+age*.6,r=.25+(i%7)*.12+age*.18;positions.setXYZ(i,cx+Math.cos(a)*r,y+.25+(age*.6+i*.071)%2,cz+Math.sin(a)*r);}positions.needsUpdate=true;pollen.material.opacity=Math.max(0,1-age/3.4)*.72;}
 }
 function update(dt,time,player,state={}){
  elapsed+=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));playerPosition.copy(player);
  const near=nearPoint(player,-16,height(-16,-4),-4,1.75);
  if(near&&!birdNear&&birdMode==='rest'){birdTime=elapsed;birdMode='startled';birdStartles++;emit('bird');}
  birdNear=near;
  if(birdMode!=='rest'&&elapsed-birdTime>(birdMode==='called'?7:5))birdMode='rest';
  if(!stoneClue&&nearPoint(player,-8,height(-8,-11.7),-11.7,3.1)){stoneClue=true;caption('A gong, seed bells and a harp. Follow the one, two, three flower marks to free their rising song.',5);}
  applyVisuals(state.gentle);
 }
 function reset(){
  elapsed=0;flowerTime=birdTime=stoneFlash=wrongFlash=-100;flowerFound=stoneSolved=stoneClue=birdNear=false;birdMode='rest';birdStartles=birdCalls=stoneStep=0;playerPosition.set(999,0,999);applyVisuals();
 }
 function telemetry(){return {flowersAwake:flowerFound,birdMode,birdStartles,birdCalls,stoneStep,stoneSolved,echoSolved:stoneSolved,locations:{flowers:[-3,12],birds:[-16,-4],stones:stones.map(s=>[s.home.x,s.home.z])},particleCount:32};}
 function restore(data={}){reset();stoneSolved=!!data.echoSolved;stoneStep=stoneSolved?3:Math.max(0,Math.min(2,Number(data.stoneStep)||0));flowerFound=!!data.flowersAwake;applyVisuals();}
 reset();return {update,context,interact,reset,telemetry,restore};
}
