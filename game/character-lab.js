import * as T from 'three';
import {loadCodeCharacter} from './code-character.js';
import studyA from './assets/hero-study-a.js?v=hand-approved-d';
import studyB from './assets/hero-study-b.js';
import studyC from './assets/hero-study-c.js';
import buildHero from './assets/hero.js';
import {createAnimator} from './animation.js';
import {createMovement} from './movement.js';
const $=id=>document.getElementById(id),renderer=new T.WebGLRenderer({canvas:$('stage'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;
const scene=new T.Scene();scene.background=new T.Color('#d9dfdf');scene.fog=new T.Fog('#d9dfdf',16,35);
scene.add(new T.HemisphereLight(0xffffff,0x737f87,2));
const light=new T.DirectionalLight(0xfff3df,3);light.position.set(-3,7,5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-5,right:5,top:5,bottom:-5});light.shadow.normalBias=.015;scene.add(light,light.target);
const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0xc4cecd,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new T.GridHelper(200,200,0x8c9f9f,0xb1bfbf);grid.position.y=.002;scene.add(grid);
const hero=buildHero(T);scene.add(hero);
const candidates={};for(const [key,build]of Object.entries({character:studyA,profile:studyB,sculpt:studyC})){candidates[key]=await loadCodeCharacter(build);scene.add(candidates[key].root);candidates[key].root.visible=false;}
let authored=candidates.character;
// Keep original geometry references: switching options must never accumulate transforms.
const handRoot=candidates.character.root;
const handShapes=['left','right'].map(side=>handRoot.getObjectByName(side+'HandShape'));
const handParents=handShapes.map(shape=>shape.parent);
function chooseHands(){
 const option=$('handOption').value,swap=option==='A'||option==='B',turn=option==='A'||option==='C';
 handShapes.forEach((shape,i)=>{handParents[swap?1-i:i].add(shape);shape.rotation.set(0,turn?Math.PI:0,0);});
 $('handNote').textContent='Hand comparison · Option '+option+(option==='D'?' · Approved':'');
 const url=new URL(location.href);url.searchParams.set('hand',option);history.replaceState(null,'',url);
 reset();
}

let usingAuthored=!!authored,wasGrounded=true,landUntil=0,airTime=0;
const makeMotor=()=>createMovement(T,{sampleGround:()=>0,stickElement:$('stick'),jumpButton:$('jump'),runButton:$('run'),...(usingAuthored?{walkSpeed:authored.nominal.Walk_Loop,runSpeed:authored.nominal.Sprint_Loop,acceleration:12,deceleration:16,turnResponse:12}:{})});
let movement=makeMotor();
const preview={speed:0,yaw:0,grounded:true,verticalVelocity:0};let animator=createAnimator(T,hero,preview);
const camera=new T.PerspectiveCamera(35,1,.05,100);let time=0,frozen=false,clip='idle';
function reset(){authored?.reset();wasGrounded=true;landUntil=0;airTime=0;time=0;movement.reset();Object.assign(preview,{speed:0,yaw:0,grounded:true,verticalVelocity:0});hero.position.set(0,0,0);hero.rotation.y=0;animator.reset();animator=createAnimator(T,hero,clip==='free'?movement:preview);}
$('source').onchange=()=>{if(authored)authored.root.visible=false;authored=candidates[$('source').value]||null;usingAuthored=$('source').value!=='baseline'&&!!authored;movement.dispose();movement=makeMotor();hero.visible=!usingAuthored;if(authored)authored.root.visible=usingAuthored;$('handOption').disabled=$('source').value!=='character';$('handNote').hidden=$('source').value!=='character';$('sourceNote').textContent=usingAuthored?'Code-built geometry · CC0 animation tracks.':'Original procedural Bellkeeper baseline.';for(const o of $('clip').options)o.disabled=usingAuthored&&['capture','release'].includes(o.value);if(usingAuthored&&['capture','release'].includes(clip)){clip='idle';$('clip').value=clip;}reset();};$('source').onchange();
$('handOption').onchange=chooseHands;
const requestedHand=new URLSearchParams(location.search).get('hand');if(['A','B','C','D'].includes(requestedHand))$('handOption').value=requestedHand;chooseHands();
$('clip').onchange=()=>{clip=$('clip').value;$('play').hidden=clip!=='free';reset();};
const requestedClip=new URLSearchParams(location.search).get('clip');if(['transitions','jump','turn','free'].includes(requestedClip)){$('clip').value=requestedClip;$('clip').onchange();}
$('view').onchange=()=>{$('orbit').value={three:25,front:0,side:90,back:180,face:0,profileFace:90,hands:0}[$('view').value];};
const requestedView=new URLSearchParams(location.search).get('view');if(['face','profileFace','hands'].includes(requestedView)){$('view').value=requestedView;$('view').onchange();}
$('freeze').onclick=()=>{frozen=!frozen;$('freeze').textContent=frozen?'Play':'Freeze';$('freeze').setAttribute('aria-pressed',String(frozen));};
$('step').onclick=()=>{frozen=true;$('freeze').textContent='Play';$('freeze').setAttribute('aria-pressed','true');advance(1/60);};
$('reset').onclick=reset;
for(const id of ['stage','play'])$(id).addEventListener('contextmenu',e=>e.preventDefault());
function advance(dt){
 time+=dt;let action=null,progress=0;
 if(clip==='free'){movement.update(dt);hero.position.copy(movement.position);hero.rotation.y=movement.yaw;}
 else{
  preview.speed=clip==='walk'?(usingAuthored?.83:2.2):clip==='jog'?(usingAuthored?4.55:3):clip==='run'||clip==='turn'?(usingAuthored?7:4.5):0;
  if(clip==='transitions'){const t=time%4;preview.speed=t<.5?0:t<1.2?7*T.MathUtils.smoothstep(t,.5,1.2):t<2.4?7:t<3?7*(1-T.MathUtils.smoothstep(t,2.4,3)):0;}
  preview.yaw=clip==='turn'?Math.sin(time*1.8)*1.1:0;preview.grounded=true;preview.verticalVelocity=0;hero.position.set(0,0,0);hero.rotation.y=preview.yaw;
  if(clip==='jump'){const t=time%2.2-.12,flight=2*6.1/19;if(t>=0&&t<flight){preview.grounded=false;preview.verticalVelocity=6.1-19*t;hero.position.y=6.1*t-.5*19*t*t;}}
  if(clip==='capture'||clip==='release'){const t=time%2.4;if(t<1.2){action=clip;progress=t/1.2;}}
 }
 animator.update(dt,{time,action,actionProgress:progress});
 if(usingAuthored){
  const m=clip==='free'?movement:preview;
  if(m.grounded&&!wasGrounded)landUntil=time+(m.speed>.5?.30:.46);
  airTime=m.grounded?0:airTime+dt;
  const previous=authored.clip;
  const gait=m.speed>(previous==='Sprint_Loop'?5.2:5.6)?'Sprint_Loop':m.speed>(previous==='Jog_Fwd_Loop'?1.8:2.2)?'Jog_Fwd_Loop':m.speed>(previous==='Idle_Loop'?.10:.06)?'Walk_Loop':'Idle_Loop';
  const anticipation=clip==='jump'&&time%2.2<.12;
  const name=anticipation?'Jump_Start':!m.grounded?(airTime<.14?'Jump_Start':'Jump_Loop'):time<landUntil?'Jump_Land':gait;
  authored.play(name,{once:name==='Jump_Start'||name==='Jump_Land',rate:name==='Jump_Land'?(m.speed>.5?3:2.2):name==='Jump_Start'?(anticipation?1:2.5):1});
  // World placement precedes pose/sole correction, including on moving jump frames.
  authored.root.position.copy(hero.position);authored.root.rotation.y=hero.rotation.y;
  authored.update(dt,m.speed,{grounded:m.grounded,yaw:m.yaw});wasGrounded=m.grounded;
 }
}
let renderWidth=0,renderHeight=0;
function render(){
 const mobile=innerWidth<=700,face=['face','profileFace'].includes($('view').value),hands=$('view').value==='hands',angle=Number($('orbit').value)*Math.PI/180;
 const base=clip==='free'?movement.position:new T.Vector3();const target=face&&usingAuthored?authored.root.getObjectByName('head').localToWorld(new T.Vector3(0,.155,0)):base.clone().add(new T.Vector3(0,face?1.36:hands?.72:.83,0));
 const d=(face?1.0:hands?1.65:3.9)*Number($('zoom').value);
 if(mobile){const bottom=$('settings').offsetHeight+16;$('stick').style.bottom=bottom+'px';for(const id of ['jump','run'])$(id).style.bottom=(bottom+20)+'px';}
 const width=innerWidth,height=mobile?Math.max(220,innerHeight-$('settings').offsetHeight-85):innerHeight;
 if(renderWidth!==width||renderHeight!==height){renderer.setSize(width,height,false);renderWidth=width;renderHeight=height;}$('stage').style.height=height+'px';$('stage').style.position='absolute';$('stage').style.top=mobile?'85px':'0';
 camera.aspect=width/height;camera.clearViewOffset();camera.updateProjectionMatrix();
 // Reserve screen space for controls without shrinking the character to game scale.
 if(!mobile)camera.setViewOffset(width,height,130,0,width,height);
 camera.position.copy(target).add(new T.Vector3(Math.sin(angle)*d,face?.03:.28,Math.cos(angle)*d));camera.lookAt(target);
 light.position.copy(base).add(new T.Vector3(-3,7,5));light.target.position.copy(base);
 renderer.render(scene,camera);$('status').textContent=`${clip==='free'?(usingAuthored&&authored.clip==='Jump_Land'?'landing':movement.mode):clip} · ${frozen?'frozen':$('rate').value+'×'} · ${time.toFixed(2)}s`;
 window.__LAB__={handOption:$('handOption').value,source:usingAuthored?$('source').value:'baseline',authoredClip:authored?.clip,clip,time,frozen,grounded:clip==='free'?movement.grounded:preview.grounded,position:hero.position.toArray(),speed:clip==='free'?movement.speed:preview.speed,yaw:hero.rotation.y,motion:usingAuthored?authored.motionState:null,draws:renderer.info.render.calls};
}

let last=performance.now();function frame(now){const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;if(!frozen&&!document.hidden)advance(dt*Number($('rate').value));render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
