import * as T from 'three';
import {loadBellkeeperCharacter} from './bellkeeper-character.js';
import {loadAuthoredMotion} from './authored-motion.js';
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
let character=null;try{character=await loadBellkeeperCharacter();scene.add(character.root);character.root.visible=false;}catch(e){console.error('Character load',e);}
let authored=null;try{authored=await loadAuthoredMotion();scene.add(authored.root);hero.visible=false;}catch(e){$('source').value='baseline';$('sourceNote').textContent='Motion rig could not load: '+e.message;}
const mannequin=authored;if(!character)$('source').value=mannequin?'authored':'baseline';
let usingAuthored=!!authored,wasGrounded=true,landUntil=0;
const makeMotor=()=>createMovement(T,{sampleGround:()=>0,stickElement:$('stick'),jumpButton:$('jump'),runButton:$('run'),...(usingAuthored?{walkSpeed:authored.nominal.Walk_Loop,runSpeed:authored.nominal.Sprint_Loop}:{})});
let movement=makeMotor();
const preview={speed:0,yaw:0,grounded:true,verticalVelocity:0};let animator=createAnimator(T,hero,preview);
const camera=new T.PerspectiveCamera(35,1,.05,100);let time=0,frozen=false,clip='idle';
function reset(){authored?.reset();wasGrounded=true;landUntil=0;time=0;movement.reset();Object.assign(preview,{speed:0,yaw:0,grounded:true,verticalVelocity:0});hero.position.set(0,0,0);hero.rotation.y=0;animator.reset();animator=createAnimator(T,hero,clip==='free'?movement:preview);}
$('source').onchange=()=>{if(authored)authored.root.visible=false;authored=$('source').value==='character'?character:mannequin;usingAuthored=$('source').value!=='baseline'&&!!authored;movement.dispose();movement=makeMotor();hero.visible=!usingAuthored;if(authored)authored.root.visible=usingAuthored;$('sourceNote').textContent=$('source').value==='character'?'Bellkeeper character candidate on the authored motion rig.':usingAuthored?'Quaternius mannequin: motion reference, not final character design.':'Original procedural Bellkeeper baseline.';for(const o of $('clip').options)o.disabled=usingAuthored&&['capture','release'].includes(o.value);if(usingAuthored&&['capture','release'].includes(clip)){clip='idle';$('clip').value=clip;}reset();};$('source').onchange();
$('clip').onchange=()=>{clip=$('clip').value;$('play').hidden=clip!=='free';reset();};
$('view').onchange=()=>{$('orbit').value={three:25,front:0,side:90,back:180,face:0}[$('view').value];};
$('freeze').onclick=()=>{frozen=!frozen;$('freeze').textContent=frozen?'Play':'Freeze';$('freeze').setAttribute('aria-pressed',String(frozen));};
$('step').onclick=()=>{frozen=true;$('freeze').textContent='Play';$('freeze').setAttribute('aria-pressed','true');advance(1/60);};
$('reset').onclick=reset;
for(const id of ['stage','play'])$(id).addEventListener('contextmenu',e=>e.preventDefault());
function advance(dt){
 time+=dt;let action=null,progress=0;
 if(clip==='free'){movement.update(dt);hero.position.copy(movement.position);hero.rotation.y=movement.yaw;}
 else{
  preview.speed=clip==='walk'?2.2:clip==='jog'?3:clip==='run'||clip==='turn'?4.5:0;
  preview.yaw=clip==='turn'?Math.sin(time*1.8)*1.1:0;preview.grounded=true;preview.verticalVelocity=0;hero.position.set(0,0,0);hero.rotation.y=preview.yaw;
  if(clip==='jump'){const t=time%2.2,flight=2*6.1/19;if(t<flight){preview.grounded=false;preview.verticalVelocity=6.1-19*t;hero.position.y=6.1*t-.5*19*t*t;}}
  if(clip==='capture'||clip==='release'){const t=time%2.4;if(t<1.2){action=clip;progress=t/1.2;}}
 }
 animator.update(dt,{time,action,actionProgress:progress});
 if(usingAuthored){
  const m=clip==='free'?movement:preview;
  if(m.grounded&&!wasGrounded)landUntil=time+.22;
  let name=!m.grounded?(m.verticalVelocity>1?'Jump_Start':'Jump_Loop'):time<landUntil?'Jump_Land':(clip==='free'?m.speed>authored.nominal.Jog_Fwd_Loop*1.15:m.speed>3.5)?'Sprint_Loop':(clip==='free'?m.speed>authored.nominal.Walk_Loop*1.3:m.speed>2.3)?'Jog_Fwd_Loop':m.speed>.1?'Walk_Loop':'Idle_Loop';
  authored.play(name,{once:name==='Jump_Start'||name==='Jump_Land'});authored.update(dt,clip==='free'?m.speed:undefined);authored.root.position.copy(hero.position);authored.root.rotation.y=hero.rotation.y;wasGrounded=m.grounded;
 }
}
let renderWidth=0,renderHeight=0;
function render(){
 const mobile=innerWidth<=700,face=$('view').value==='face',angle=Number($('orbit').value)*Math.PI/180;
 const base=clip==='free'?movement.position:new T.Vector3();const target=base.clone().add(new T.Vector3(0,face?1.36:.83,0));
 const d=(face?1.15:3.9)*Number($('zoom').value);
 if(mobile){const bottom=$('settings').offsetHeight+16;$('stick').style.bottom=bottom+'px';for(const id of ['jump','run'])$(id).style.bottom=(bottom+20)+'px';}
 const width=innerWidth,height=mobile?Math.max(220,innerHeight-$('settings').offsetHeight-85):innerHeight;
 if(renderWidth!==width||renderHeight!==height){renderer.setSize(width,height,false);renderWidth=width;renderHeight=height;}$('stage').style.height=height+'px';$('stage').style.position='absolute';$('stage').style.top=mobile?'85px':'0';
 camera.aspect=width/height;camera.clearViewOffset();camera.updateProjectionMatrix();
 // Reserve screen space for controls without shrinking the character to game scale.
 if(!mobile)camera.setViewOffset(width,height,130,0,width,height);
 camera.position.copy(target).add(new T.Vector3(Math.sin(angle)*d,face?.03:.28,Math.cos(angle)*d));camera.lookAt(target);
 light.position.copy(base).add(new T.Vector3(-3,7,5));light.target.position.copy(base);
 renderer.render(scene,camera);$('status').textContent=`${clip==='free'?movement.mode:clip} · ${frozen?'frozen':$('rate').value+'×'} · ${time.toFixed(2)}s`;
 window.__LAB__={source:usingAuthored?$('source').value:'baseline',authoredClip:authored?.clip,clip,time,frozen,grounded:clip==='free'?movement.grounded:preview.grounded,position:hero.position.toArray(),draws:renderer.info.render.calls};
}

let last=performance.now();function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(!frozen&&!document.hidden)advance(dt*Number($('rate').value));render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
