import * as T from 'three';
import {ASSET} from './assetlib.js';
import {createSoundscape} from './audio.js';
import {createMovement} from './movement.js';
import {loadCodeCharacter} from './code-character.js';
import buildApprovedHero from './assets/hero-study-a.js';
import {createAdventureMotion} from './adventure-motion.js';
import {readSave,writeSave,hasLegacySave,clearSave} from './adventure-save.js';
import {createOpening} from './opening.js';
import {createTitleMusic} from './title-music.js';
import {createWind} from './bellhollow/wind.js';
import {createQuest} from './bellhollow/quest.js';
import {MODULES} from './bellhollow/manifest.js';
import {createMap} from './bellhollow/map.js';
import {trunkSolid} from './bellhollow/kit/trunk.js';
import {adaptWorld} from './bellhollow/adapt-world.js';
import buildMara from './assets/bh-mara.js';
import buildPairedBells from './assets/bh-paired-bells.js';
// v2 host: renderer, camera spring arm + framing, HUD, opening, audio, saves. Bellhollow's world,
// wind verbs and progression live in game/bellhollow/*; the look in game/render/look.js.
const params=new URLSearchParams(location.search);
const opening=createOpening(),titleMusic=createTitleMusic();let musicUnlocked=false;
const $=s=>document.querySelector(s),canvas=$('#world');
const mapCanvas=$('#map'),mapCtx=mapCanvas?.getContext('2d');
const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new T.Scene();scene.background=new T.Color('#bfe1ea');scene.fog=new T.FogExp2('#d9dccb',.016);
const camera=new T.PerspectiveCamera(42,1,.1,400);const hemi=new T.HemisphereLight(0xffefcd,0x2c4a45,1.8);scene.add(hemi);
const sun=new T.DirectionalLight(0xffe1ae,2.4);sun.position.set(-9,20,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:.5,far:70});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
const state={started:false,paused:false,t:0,complete:false,action:null,actionTime:0,actionTarget:null,actionCallback:null,muted:localStorage.getItem('bellkeeper-muted')==='1',gentle:localStorage.getItem('bellkeeper-gentle')==='1'};
const DEFAULT_YAW=Math.atan2(.615,.788);let cameraYaw=DEFAULT_YAW,cameraDrag=null;
let hero,movement,animator,world,wind,quest,look=null,staff,staffHand,mara,captionEnd=0,context=null,travel=0,fps=60,start3=[0,0,0];
let saveTimer=0,introTime=0,introActive=false,lastShot=-1,queued=null,uiTimer=0,endingAt=0,liftLead=0;
// Game feel: hit-stop (sim frozen, render continues), camera kick, finale arrival blend; Mara acting.
let villagers=null,map=null,crane=null,pairedBells=null,bellOutT=null,bellRetT=null,recoveredCount=0,introCut=-1,hitStop=0,kick=0,arrival=0,maraAct={lever:0,leverT:-1,gesture:0,wave:0,waveUntil:0};const kickDir=new T.Vector3(),finaleLook=new T.Vector3(),finaleCam=new T.Vector3(),scriptCam=new T.Vector3();
let captionsEnabled=localStorage.getItem('bellkeeper-captions')!=='0';
// Camera spring arm, subject framing and chart tucking state (see frame()).
let armPitch=null,armLength=null,frameDist=0,lastCameraInput=-9,chartTuck=false,chartOverride=false,hudTimer=0,safe=null;const frameOffset=new T.Vector3(),armOrigin=new T.Vector3(),heroBox=new T.Box3(),ndc=new T.Vector3(),tmpA=new T.Vector3(),tmpB=new T.Vector3();
const loadedSave=readSave(),legacy=!loadedSave&&hasLegacySave();
const CARD=7,CARDS=3*CARD,ENGINE=20;// prologue cards, then the 20 s in-engine intro
function save(){if(!state.started||introActive||!quest||quest.finaleActive||!movement)return;const c=movement.checkpoint;writeSave({quest,checkpoint:[c.x,c.y,c.z],map});}
function later(delay,text,duration=5,then){queued={at:state.t+delay,text,duration,then};}
function caption(text,duration=4){$('#caption').textContent=text;$('#caption').style.opacity=captionsEnabled&&text?'1':'0';captionEnd=state.t+Math.max(duration,Math.min(9,text.length/19));}
const soundscape=createSoundscape();soundscape.setMuted(state.muted);titleMusic.setMuted(state.muted);
function titleSoundLabel(){$('#titleSound').setAttribute('aria-pressed',String(musicUnlocked&&!state.muted));$('#titleSound span').textContent=musicUnlocked?(state.muted?'Music off · enable':'Music on · mute'):'Enable title music';}
async function unlockTitleMusic(){if(state.muted||musicUnlocked||state.started&&!introActive)return;try{await titleMusic.start();musicUnlocked=true;titleSoundLabel();}catch{titleSoundLabel();}}
$('#titleSound').onclick=()=>{if(musicUnlocked)state.muted=!state.muted;else state.muted=false;localStorage.setItem('bellkeeper-muted',state.muted?'1':'0');soundscape.setMuted(state.muted);titleMusic.setMuted(state.muted);unlockTitleMusic();titleSoundLabel();updateUI();};
document.addEventListener('pointerdown',e=>{if(!$('#title').hidden&&e.target.closest('button')?.id!=='titleSound')unlockTitleMusic();},{capture:true});
document.addEventListener('keydown',e=>{if(!$('#title').hidden&&['Enter','Space'].includes(e.code))unlockTitleMusic();},{capture:true});
document.addEventListener('visibilitychange',()=>titleMusic.setPaused(document.hidden||state.paused));
$('#sound').after($('#volumeTemplate').content.cloneNode(true));$('#volume').value=localStorage.getItem('bellkeeper-volume')??'65';soundscape.setVolume(Number($('#volume').value)/100);titleMusic.setVolume(Number($('#volume').value)/100);$('#volume').oninput=()=>{soundscape.setVolume(Number($('#volume').value)/100);titleMusic.setVolume(Number($('#volume').value)/100);localStorage.setItem('bellkeeper-volume',$('#volume').value);};
function sound(kind){soundscape.cue(kind);}
const AREA_NAMES={terrace:'THE CANOPY TERRACE',branches:'THE WINDMILL BRANCHES',hollow:'THE HOLLOW'},LOOK_AREAS={terrace:'terrace-dawn',branches:'branches-day',hollow:'hollow'};
function updateUI(){
 document.body.classList.toggle('gentle-opening',state.gentle);
 if(quest){$('#objective').textContent=quest.objective();$('#zoneName').textContent=AREA_NAMES[quest.area(movement.position)]||'BELLHOLLOW';}
 const held=wind?.charge,frags=quest?.telemetry().fragments||0;
 $('#chargeText').textContent=(held?(held.kind==='guardian'?'Guardian’s breath held':'Gust held in the bell'):'Bell empty')+(frags?` · ${frags}/3 fragments`:'');$('#chargeIcon').textContent=held?'✧':'◌';document.body.classList.toggle('wind-held',!!held);
 $('#sound').textContent='Sound: '+(state.muted?'off':'on');$('#motion').textContent='Gentle motion: '+(state.gentle?'on':'off');
 $('#subtitles').textContent='Captions: '+(captionsEnabled?'on':'off');
}
function start(skipIntro=false){if(!movement)return;unlockTitleMusic();opening.begin(skipIntro);if(skipIntro)titleMusic.fadeOut(2);state.started=true;state.paused=false;$('#title').hidden=true;$('#legacyNote').hidden=true;for(const id of ['hud','charge','controls','hint','map','mapToggle'])$('#'+id).hidden=false;introActive=!skipIntro;introTime=0;lastShot=-1;$('#skipIntro').hidden=!introActive;document.body.classList.toggle('cinematic',introActive);caption('',0);soundscape.start().then(()=>sound('start')).catch(()=>{$('#audioUnlock').hidden=false;});if(matchMedia('(any-pointer: coarse)').matches)$('#audioUnlock').hidden=false;updateUI();}
// Skipping and finishing converge here, so both leave exactly the same game state.
function endIntro(){if(!introActive)return;opening.end();titleMusic.fadeOut(2.8);introActive=false;$('#skipIntro').hidden=true;document.body.classList.remove('cinematic');snapCamera();movement?.update(0,{enabled:state.started&&!state.paused});if(!quest.progress.bell)caption('Mara: “Morning round, apprentice. Ring the bell by the path.”',6);save();}
// First safe spot among the candidates, with the world brought to the current state first (so a bridge stage
// that is not built yet counts as missing floor, and a barrier that is up counts as blocking).
function safeSpot(first){world.update(0,state.t,{wind:wind.state(),restored:quest.restoration,gentle:state.gentle,progress:quest.progress});
 for(const c of [first,...quest.safeAnchors()])if(c&&movement.isSafe(c))return Array.isArray(c)?c:[c.x,c.y,c.z];return start3;}
function continueGame(){const d=readSave();if(!d)return;quest.restore(d.quest);try{map?.restore?.(d.map);}catch(e){console.warn(e);}movement.reset(safeSpot(d.checkpoint));animator.reset();start(true);snapCamera();state.complete=quest.progress.complete;caption(quest.progress.complete?'Bellhollow is breathing. Wander as long as you like.':'Bellhollow remembers where you left it.',4);}
function pause(on){if(!state.started)return;state.paused=on;soundscape.setPaused(on);titleMusic.setPaused(on);$('#pausePanel').hidden=!on;$('#resume').textContent='Resume';$('#reset').hidden=false;$('#safeSpot').hidden=false;mapCanvas.hidden=on;$('#mapToggle').hidden=on;if(on){save();mapCanvas.classList.remove('expanded');$('#mapToggle').setAttribute('aria-expanded','false');chartUI();}}
function beginAction(kind,target,callback){state.action=kind;state.actionTime=0;state.actionTarget=(target||movement.position).clone();state.actionCallback=callback;if(kind==='pull')sound('chime');}
function staffTip(){if(!staff?.visible)return movement.position.clone().setY(movement.position.y+1.5);return staff.localToWorld(tmpB.set(0,1.15,0)).clone();}
function action(){if(!state.started||state.paused||state.action||introActive||quest?.finaleActive)return;
 if(!context){caption(quest.hint(),4);return;}
 const c={...context};
 if(!c.anim){quest.interact(c,{position:movement.position,yaw:movement.yaw,staffTip:staffTip()});updateUI();save();return;}
 beginAction(c.anim,c.target,()=>{quest.interact(c,{position:movement.position,yaw:movement.yaw,staffTip:staffTip()});updateUI();save();});}
// Quest events: checkpoints, knock-backs, finale, teleport and completion.
function questEvent(_progress,e={}){
 if(e.knock){movement.knockback(e.knock);sound('knock');if(!state.gentle){hitStop=.11;kick=1;kickDir.set(Math.random()-.5,.6,Math.random()-.5).normalize();}}
 if(e.bells==='out')bellOutT=state.t;if(e.bells==='return'){bellRetT=state.t;bellOutT??=state.t-1.7;}
 if(e.mara==='lever')maraAct.leverT=0;if(e.mara==='gesture')maraAct.gesture=1.6;if(e.mara==='wave')maraAct.waveUntil=state.t+(state.complete||e.complete?9:5);
 if(e.teleport){movement.reset(e.teleport);animator?.reset();snapCamera();if(world.points.terraceView)arrival=2.6;const ms=world.points.terraceView?.maraStand;if(ms&&mara){mara.position.set(ms.x,ms.y,ms.z);}}
 if(e.complete){state.complete=true;endingAt=state.t+7;later(1.6,'',0,()=>sound('chime'));}
 if(e.restored)sound('restore');
 updateUI();if(e.checkpoint||e.restored||e.complete)save();}
$('#storyNext').onclick=()=>{if(introActive&&introTime<CARDS)introTime=Math.min(CARDS,(Math.floor(introTime/CARD)+1)*CARD);};
$('#startb').onclick=()=>{if(loadedSave)clearSave();start();};$('#continueb').onclick=continueGame;$('#skipIntro').onclick=()=>{if(quest?.finaleActive)quest.skipFinale();else endIntro();};$('#action').onclick=action;$('#pause').onclick=()=>pause(true);$('#resume').onclick=()=>pause(false);$('#keepExploring').onclick=()=>$('#ending').hidden=true;
$('#creditsb').onclick=()=>$('#creditsPanel').hidden=false;$('#closeCredits').onclick=()=>$('#creditsPanel').hidden=true;
$('#settingsb').onclick=()=>{$('#pausePanel').hidden=false;$('#resume').textContent='Back';$('#reset').hidden=true;$('#safeSpot').hidden=true;};
$('#resume').onclick=()=>{if(state.started)pause(false);else $('#pausePanel').hidden=true;};
$('#subtitles').onclick=()=>{captionsEnabled=!captionsEnabled;localStorage.setItem('bellkeeper-captions',captionsEnabled?'1':'0');$('#subtitles').textContent='Captions: '+(captionsEnabled?'on':'off');if(!captionsEnabled)$('#caption').style.opacity='0';};
// Movement is also an explicit skip gesture. Preserve that first input instead
// of making impatient players wait through a shot or tap their joystick twice.
$('#stick').addEventListener('pointerdown',()=>{if(introActive)endIntro();},{capture:true});
addEventListener('keydown',e=>{if(introActive&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyA'].includes(e.code))endIntro();},{capture:true});
$('#audioUnlock').onclick=()=>soundscape.resume().then(()=>{$('#audioUnlock').hidden=true;sound('start');}).catch(()=>{});
for(const id of ['controls','world'])$('#'+id).addEventListener('pointerdown',()=>{if(state.started)soundscape.resume().then(()=>$('#audioUnlock').hidden=true).catch(()=>{});},{passive:true});
$('#sound').onclick=()=>{state.muted=!state.muted;soundscape.setMuted(state.muted);titleMusic.setMuted(state.muted);titleSoundLabel();localStorage.setItem('bellkeeper-muted',state.muted?'1':'0');updateUI();};$('#motion').onclick=()=>{state.gentle=!state.gentle;localStorage.setItem('bellkeeper-gentle',state.gentle?'1':'0');updateUI();};
$('#safeSpot').onclick=()=>{if(!state.started)return;const c=movement.checkpoint;movement.reset(safeSpot([c.x,c.y,c.z]));animator.reset();snapCamera();pause(false);caption('A little current carries you back to safe ground.',3);sound('capture');};
$('#reset').onclick=()=>{bellOutT=bellRetT=null;opening.end();titleMusic.fadeOut(1);Object.assign(state,{complete:false,action:null,actionCallback:null});quest.reset();clearSave();queued=null;introActive=false;$('#skipIntro').hidden=true;document.body.classList.remove('cinematic');$('#ending').hidden=true;cameraYaw=DEFAULT_YAW;movement.reset(start3);animator.reset();travel=0;snapCamera();pause(false);updateUI();save();caption('Another morning. The bell is waiting by the path.',4);};
addEventListener('keydown',e=>{if(e.code==='Space'&&state.started&&!introActive){e.preventDefault();if(!e.repeat)action();}if(e.code==='Escape')pause(!state.paused);});// Touch browsers can blur the window during native gestures while still visible.
// Actual backgrounding is handled by visibilitychange on every device.
addEventListener('blur',()=>{if(!matchMedia('(any-pointer: coarse)').matches&&state.started)pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.started)pause(true);});
for(const id of ['world','controls'])$('#'+id).addEventListener('contextmenu',e=>e.preventDefault());
function poseStaff(){
 if(!staffHand)return;
 hero.updateMatrixWorld(true);
 const forward=new T.Vector3(Math.sin(hero.rotation.y),0,Math.cos(hero.rotation.y));
 const progress=state.action?Math.sin(Math.PI*Math.min(1,state.actionTime/.68)):0;
 const aim=forward.multiplyScalar(state.action==='release'?progress*.95:state.action==='capture'?progress*.45:.12).add(new T.Vector3(0,state.action==='release'?1-progress*.5:1,0)).normalize();
 const desired=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),aim);
 const parent=staffHand.getWorldQuaternion(new T.Quaternion());
 staff.quaternion.copy(parent.invert().multiply(desired));
 const grip=new T.Vector3(0,.39,-.012).multiply(staff.scale).applyQuaternion(staff.quaternion);
 staff.position.set(0,-.054,.026).sub(grip);
}
// Mara acts through bh-mara.js hooks: throws the bypass lever, keeps a hand on it, looks at the
// apprentice when near, opens her hands as she gives the staff, waves at the finale and ending.
function actMara(dt,p){const set=mara.userData.setPose,to=mara.userData.headToward;if(!set)return;
 if(maraAct.leverT>=0){maraAct.leverT+=dt;}const lever=maraAct.leverT<0?(quest.progress.bypass?.55:0):maraAct.leverT<1.1?Math.sin(Math.min(1,maraAct.leverT/1.1)*Math.PI/2):.55+.45*Math.max(0,1-(maraAct.leverT-1.1)/.8);
 maraAct.lever+=(lever-maraAct.lever)*(1-Math.exp(-dt*8));maraAct.gesture=Math.max(0,maraAct.gesture-dt);const waving=state.t<maraAct.waveUntil;maraAct.wave+=((waving?1:0)-maraAct.wave)*(1-Math.exp(-dt*4));
 let yaw=0,pitch=0;const d=Math.hypot(p.x-mara.position.x,p.z-mara.position.z);if(d<4.5&&to){const l=mara.worldToLocal(tmpA.set(p.x,p.y+1.5,p.z));const h=to(l);yaw=h.yaw;pitch=h.pitch;}
 maraAct.yaw=T.MathUtils.damp(maraAct.yaw||0,yaw,4,dt);maraAct.pitch=T.MathUtils.damp(maraAct.pitch||0,pitch,4,dt);
 set({yaw:maraAct.yaw,pitch:maraAct.pitch,lever:maraAct.wave>.1?0:maraAct.lever,wave:maraAct.wave,gesture:Math.min(1,maraAct.gesture),lean:.04*Math.sin(state.t*.9),t:state.t});}
function findContext(){const p=movement.position;context=state.action||quest.finaleActive?context:quest.context(p,movement.yaw);
 $('#action').disabled=!context||!!state.action;$('#action').innerHTML=(context?.label||'Look around')+' <span>SPACE</span>';$('#action').dataset.kind=context?.kind||'';}
// Camera-aligned Bellhollow chart: anchors, mills, the Hollow gate and the current objective.
// Illustrated chart (game/bellhollow/map.js): update every HUD tick (fog of war reveals even while tucked), draw when visible.
function drawMap(){
 if(!map)return;
 map.update(.2,{hero:movement.position,heroYaw:movement.yaw,camYaw:cameraYaw,objective:quest.objectiveTarget(),progress:quest.progress,fragments:quest.serialize().fragments});
 if(!mapCtx||mapCanvas.hidden||document.body.classList.contains('chart-tucked')&&!mapCanvas.classList.contains('expanded'))return;
 map.draw();
}
// While the chart would cover the scene's subject it tucks into a corner button; the player can still open it.
function chartUI(){const expanded=mapCanvas.classList.contains('expanded'),b=$('#mapToggle');document.body.classList.toggle('chart-tucked',chartTuck&&!chartOverride&&!expanded);document.body.classList.toggle('chart-shown',chartTuck&&chartOverride);b.textContent=chartTuck&&!expanded?(chartOverride?'Tuck chart':'Show chart'):expanded?'Close chart':'Enlarge chart';b.setAttribute('aria-expanded',String(expanded||chartTuck&&chartOverride));map?.setExpanded?.(mapCanvas.classList.contains('expanded'));}
$('#mapToggle').onclick=()=>{if(chartTuck&&!mapCanvas.classList.contains('expanded'))chartOverride=!chartOverride;else mapCanvas.classList.toggle('expanded');chartUI();drawMap();};
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
// Drag empty scenery to look around; movement remains relative to the camera.
canvas.addEventListener('pointerdown',e=>{if(!state.started||state.paused)return;cameraDrag={id:e.pointerId,x:e.clientX};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(cameraDrag?.id!==e.pointerId)return;cameraYaw-=(e.clientX-cameraDrag.x)*.006;cameraDrag.x=e.clientX;lastCameraInput=performance.now()/1000;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>cameraDrag=null);
addEventListener('keydown',e=>{if(state.started&&!state.paused&&['KeyQ','KeyE'].includes(e.code)){cameraYaw+=(e.code==='KeyQ'?-1:1)*.13;lastCameraInput=performance.now()/1000;e.preventDefault();}});
// Spring arm: keep the fixed elevated view, but first raise then shorten the arm so no terrain,
// ridge or deck lies between the look target and the lens. Height queries only, no raycasts.
// viewGround = the top of anything at (x,z) (camera clearance); floorUnder = the layered floor below y.
function viewGround(x,z){const g=world?.cameraGround?world.cameraGround(x,z):world?.ground(x,z,1e4);return typeof g==='number'&&Number.isFinite(g)?g:-Infinity;}
function floorUnder(x,z,y){const g=world?.ground(x,z,y);return typeof g==='number'&&Number.isFinite(g)?g:-Infinity;}
// Layered worlds (world.layers): a sample is blocked when it sits just above a surface or up to a
// metre below one (inside its slab). Otherwise the single top-most height is used.
// The great trunk (bark shell, Hollow walls and ceiling) is solid for the lens too: world kit's trunkSolid, padded.
const inTrunk=(x,z,h)=>!world?.stub&&[[0,0],[.35,0],[-.35,0],[0,.35],[0,-.35]].some(([a,b])=>trunkSolid(x+a,z+b,h));
function armHit(o,sx,sz,pitch,length){const c=Math.cos(pitch),s=Math.sin(pitch),layered=!!world?.layers;for(let i=1;i<=20;i++){const d=length*i/20;if(d<=1.2)continue;const x=o.x+sx*c*d,z=o.z+sz*c*d,h=o.y+s*d,pad=.35+.03*i;
 if(inTrunk(x,z,h))return d;if(d<=2)continue;
 if(layered){for(const L of world.layers(x,z))if(L.h>h-pad&&L.h<h+1.1)return d;}else if(h<viewGround(x,z)+pad)return d;}return 0;}
function placeCamera(dt,sx,sz,pitch,length){// Test the arm from a point kept above the floor: framing may pan the look target below a descending deck.
 armOrigin.copy(cameraTarget);armOrigin.y=Math.max(armOrigin.y,floorUnder(armOrigin.x,armOrigin.z,armOrigin.y)+.9);let p=pitch,l=length;
 // Raise first (the usual fix); under an overhang, also try lowering the arm beneath it.
 // Blocked: raise the arm a little first, then pull it in (never through walls), then try lower pitches.
 if(armHit(armOrigin,sx,sz,p,l)){let found=false;
  for(let k=1;k<=6&&!found;k++){const q=pitch+k*.05;if(q<=1.05&&!armHit(armOrigin,sx,sz,q,l)){p=q;found=true;}}
  if(!found){const hit=armHit(armOrigin,sx,sz,pitch,l);if(hit&&hit-.7>=3.2&&!armHit(armOrigin,sx,sz,pitch,hit-.7)){l=hit-.7;found=true;}}
  for(let k=1;k<=18&&!found;k++){for(const q of [pitch+(k+6)*.05,pitch-k*.05]){if(q>1.05||q<.1)continue;if(!armHit(armOrigin,sx,sz,q,l)){p=q;found=true;break;}}}
  if(!found){p=Math.min(1.05,pitch+.3);const hit=armHit(armOrigin,sx,sz,p,l);if(hit)l=Math.max(2.2,hit-.8);}}
 armPitch??=p;armLength??=l;armPitch=T.MathUtils.damp(armPitch,p,p>armPitch?12:2.4,dt);armLength=T.MathUtils.damp(armLength,l,l<armLength?12:2,dt);
 const c=Math.cos(armPitch)*armLength;camera.position.set(cameraTarget.x+sx*c,cameraTarget.y+Math.sin(armPitch)*armLength,cameraTarget.z+sz*c);
 let floor=-Infinity;for(const [a,b] of [[0,0],[.6,0],[-.6,0],[0,.6],[0,-.6]])floor=Math.max(floor,floorUnder(camera.position.x+a,camera.position.z+b,camera.position.y));camera.position.y=Math.max(camera.position.y,floor+1.1);
 for(let i=0;i<12&&inTrunk(camera.position.x,camera.position.z,camera.position.y);i++)camera.position.lerp(cameraTarget,.18);}
function screenBox(box){let l=1e9,t=1e9,r=-1e9,b=-1e9;for(let i=0;i<8;i++){ndc.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(camera);if(ndc.z>1)return null;const x=(ndc.x+1)/2*innerWidth,y=(1-ndc.y)/2*innerHeight;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}return {l,t,r,b};}
// Play area left by the HUD: below the objective panel, above caption/buttons, left of an open chart.
function hudSafe(){const s={l:12,t:12,r:innerWidth-12,b:innerHeight-12},top=$('#hud>div')?.getBoundingClientRect();if(top?.height)s.t=Math.max(s.t,top.bottom+10);
 for(const el of document.querySelectorAll('#caption,#charge,#controls button,#stick,#hint')){if(el.hidden||el.id==='caption'&&el.style.opacity==='0'||getComputedStyle(el).visibility==='hidden')continue;const r=el.getBoundingClientRect();if(r.height&&r.top>innerHeight*.45)s.b=Math.min(s.b,r.top-10);}
 if(!document.body.classList.contains('chart-tucked')&&!mapCanvas.hidden&&getComputedStyle(mapCanvas).visibility!=='hidden'){const r=mapCanvas.getBoundingClientRect();if(r.width&&r.left>innerWidth*.5)s.r=Math.min(s.r,r.left-10);}return s;}
function encounterSubject(){return state.started&&!introActive?quest?.subject()||null:null;}
// Keep hero and encounter actor inside the HUD-free area: pan the look target, widen the arm, and
// (not in gentle motion, not right after manual Q/E/drag) turn gently only when they cannot fit.
function frameSubject(subject,pos,dt){
 if(!subject){frameOffset.multiplyScalar(Math.exp(-dt*1.2));frameDist=T.MathUtils.damp(frameDist,0,1.2,dt);return;}
 heroBox.min.set(pos.x-.35,pos.y,pos.z-.35);heroBox.max.set(pos.x+.35,pos.y+1.75,pos.z+.35);const a=screenBox(heroBox),b=screenBox(subject),s=safe||hudSafe();if(!a||!b)return;
 const l=Math.min(a.l,b.l),r=Math.max(a.r,b.r),t=Math.min(a.t,b.t),bottom=Math.max(a.b,b.b),ppm=innerHeight/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*(armLength||11)),k=Math.min(1,dt*2.5),sx=Math.sin(cameraYaw),sz=Math.cos(cameraYaw);
 const ex=(l+r-s.l-s.r)/2/ppm,ey=(t+bottom-s.t-s.b-16)/2/ppm;frameOffset.x+=sz*ex*k;frameOffset.z-=sx*ex*k;frameOffset.y-=ey*k/Math.max(.4,Math.cos(armPitch||.45));frameOffset.y=T.MathUtils.clamp(frameOffset.y,-1.2,1.2);if(frameOffset.length()>4.5)frameOffset.setLength(4.5);
 const wide=(r-l)/(s.r-s.l),fit=Math.max(wide,(bottom-t)/(s.b-s.t-16))/.82;frameDist=T.MathUtils.clamp(frameDist+(fit-1)*(armLength||11)*Math.min(1,dt*1.5),0,9);
 if(!state.gentle&&wide>.9&&frameDist>3&&performance.now()/1000-lastCameraInput>2.5){const c=subject.getCenter(tmpA),want=Math.atan2(pos.x-c.x,pos.z-c.z);cameraYaw+=T.MathUtils.clamp(Math.atan2(Math.sin(want-cameraYaw),Math.cos(want-cameraYaw)),-.35*dt,.35*dt);}
}
function updateChart(pos){
 // The chart stays tucked unless the player opens it; the intro and encounters tuck it again.
 if(!chartTuck){chartTuck=true;chartUI();}if((introActive||encounterSubject()||quest?.finaleActive)&&chartOverride){chartOverride=false;chartUI();}}
// ---- 20 s in-engine intro (after the prologue cards), built from world anchors ----
// dawn terrace -> dull bell -> lanterns sag / pinwheels stop -> the guardian shutters the Hollow -> settle on the hero.
const SHOTS=[{at:0,focus:'start',yaw:.55,pitch:.62,len:22,up:2},{at:5,focus:'morningBell',yaw:.25,pitch:.3,len:7.5,up:1.4,cue:'dull-bell',text:'The morning bell tolls. Half a note, then nothing.'},{at:9,focus:'start',yaw:-.35,pitch:.42,len:13,up:2.5,text:'Along the terrace, the lanterns sag. The pinwheels stop.'},{at:13,focus:'hollowGate',yaw:-.7,pitch:.36,len:15,up:1.5,cue:'hazard',text:'Deep below, something shutters the Hollow.'},{at:18,focus:'hero',yaw:0,pitch:Math.atan(.48),len:10.8,up:1}];
const introEngineTime=()=>introActive&&introTime>=CARDS?introTime-CARDS:null;
function introShot(){const e=introEngineTime();if(e===null)return null;let i=0;while(i<SHOTS.length-1&&e>=SHOTS[i+1].at)i++;return {shot:SHOTS[i],index:i,e};}
function updateIntro(dt){introTime+=dt;opening.update(Math.min(27,introTime*9/CARD));const s=introShot();if(s&&s.index!==lastShot){lastShot=s.index;if(s.shot.cue)sound(s.shot.cue);caption(s.shot.text||'',s.shot.text?4.5:0);}if(introTime>=CARDS+ENGINE)endIntro();}
function introCamera(sh){const tv=world.points.terraceView,P=world.points;if(!tv||!sh||sh.index>=4)return null;const e=sh.e-sh.shot.at,flat=(a,b)=>tmpB.set(b.x-a.x,0,b.z-a.z).normalize();
 if(sh.index===0)return {pos:new T.Vector3().lerpVectors(tv.pos,tv.target,.02*e),look:new T.Vector3(tv.target.x,tv.target.y+e*.1,tv.target.z)};
 if(sh.index===1){const b=P.morningBell,d=flat(tv.target,tv.pos).clone();return {pos:new T.Vector3(b.x+d.x*6.5-d.z*1.5,b.y+3.2,b.z+d.z*6.5+d.x*1.5),look:new T.Vector3(b.x,b.y+2.2,b.z)};}
 if(sh.index===2)return {pos:new T.Vector3().lerpVectors(tv.pos,tv.target,.42+.01*e).add(tmpA.set(0,-1.2,0)),look:new T.Vector3(tv.target.x,tv.target.y+.5,tv.target.z)};
 const g=P.hollowGate,c=P.arena||{x:0,z:0},o=flat(c,g).clone();return {pos:new T.Vector3(g.x+o.x*(12-e*.4)+o.z*3,g.y+5,g.z+o.z*(12-e*.4)-o.x*3),look:new T.Vector3(g.x,g.y+2.2,g.z)};}
function snapCamera(){if(!movement)return;cameraTarget.copy(movement.position).y+=1;armPitch=armLength=null;frameOffset.set(0,0,0);frameDist=0;}
const cameraTarget=new T.Vector3();let last=performance.now(),wasGrounded=true;
function frame(now){requestAnimationFrame(frame);const elapsed=(now-last)/1000;last=now;const dt=Math.max(0,Math.min(.05,elapsed));fps=T.MathUtils.lerp(fps,1/Math.max(.001,elapsed),.03);
 if(!(hero&&movement&&quest)){renderer.render(scene,camera);return;}
 const p=movement.position,cinematic=introActive||quest.finaleActive;
 const simDt=hitStop>0?0:dt;hitStop=Math.max(0,hitStop-dt);
 if(!state.paused&&simDt>0){const dt=simDt;state.t+=dt;
  movement.update(dt,{enabled:state.started&&!cinematic,actionSlow:!!state.action,faceTarget:state.action?state.actionTarget:null});
  if(movement.recovered){recoveredCount++;caption('A little current catches you and carries you back.',3);sound('capture');}
  travel+=movement.speed*dt;hero.position.copy(p);hero.rotation.y=state.started?movement.yaw:.35;
  if(introActive)updateIntro(dt);
  wind.update(dt,state.t,{hero:p,staffTip:quest.staff?staffTip():null,camera,gentle:state.gentle});
  quest.update(dt,state.t,p,{started:state.started&&!introActive,gentle:state.gentle});
  villagers?.update(dt,state.t,{hero:movement.position,restored:quest.restoration,gentle:state.gentle});
  const e=introEngineTime();world.update(dt,state.t,{wind:wind.state(),restored:quest.restoration,intro:introActive?{t:e??-1,phase:e===null?'cards':['dawn','bell','sag','shutter','settle'][introShot().index]}:null,gentle:state.gentle,hero:p,camera,progress:quest.progress,finale:quest.finaleShot});
  saveTimer+=dt;if(saveTimer>12&&state.started&&!introActive){saveTimer=0;save();}
  if(queued&&state.t>=queued.at){const q=queued;queued=null;if(q.text)caption(typeof q.text==='function'?q.text():q.text,q.duration);q.then?.();}
  if(state.action){state.actionTime+=dt;if(state.actionTime>(state.action==='pull'?.38:.2)&&state.actionCallback){const cb=state.actionCallback;state.actionCallback=null;cb();}if(state.actionTime>.68)state.action=null;}
  const nearMara=mara&&Math.hypot(p.x-mara.position.x,p.z-mara.position.z)<4.5;
  animator.update(dt,{time:state.t,action:state.action,actionProgress:state.actionTime/.68,charged:wind.charged,gentle:state.gentle,lookAt:state.action?state.actionTarget:context?.target||(nearMara?tmpB.copy(mara.position).setY(mara.position.y+1.4):null)});staff.visible=quest.staff;poseStaff();
  const src=[...wind.sources.values()].reduce((m,s)=>Math.min(m,Math.hypot(p.x-s.x,p.z-s.z)),30);
  soundscape.update(dt,{position:p,speed:movement.speed,grounded:movement.grounded,charged:wind.charged,restored:(quest.restoration.village||0)>.5,gardenDistance:src,waterDistance:30});
  if(mara)actMara(dt,p);
  if(pairedBells?.userData.phrase){const ph=pairedBells.userData.phrase,a=bellOutT===null?null:ph(state.t-bellOutT,{gentle:state.gentle}),b=bellRetT===null?null:ph(state.t-bellRetT+1.7,{gentle:state.gentle});pairedBells.userData.setSwing?.({out:a?.out??0,ret:b?.ret??0});}
  if(state.started){findContext();if((uiTimer-=dt)<=0){uiTimer=.2;updateUI();drawMap();}for(const foot of animator.footfalls)sound('step');if(wasGrounded&&!movement.grounded&&movement.verticalVelocity>0&&!movement.lifting)sound('jump');if(!wasGrounded&&movement.grounded)sound('land');}wasGrounded=movement.grounded;
  $('#skipIntro').hidden=!(introActive||quest.finaleActive);$('#skipIntro').textContent=quest.finaleActive?'Skip':'Skip · or move to begin';document.body.classList.toggle('cinematic',introActive||quest.finaleActive);
  if(state.complete&&endingAt&&state.t>=endingAt){endingAt=0;$('#ending').hidden=false;{const q=quest.telemetry();$('#endingDetail').textContent=q.keepsake?'The little keeper’s bell rang the whole return phrase. 3/3 fragments.':`${q.fragments}/3 bell fragments found.`;}}
  if(state.t>captionEnd)$('#caption').style.opacity='0';
 }
 // ---- camera ----
 const pos=movement.position,portrait=camera.aspect<.85;let sx=Math.sin(cameraYaw),sz=Math.cos(cameraYaw),pitch=Math.atan(.48),length=portrait?11.5:10.8;
 liftLead=T.MathUtils.damp(liftLead,movement.lifting?1:0,movement.lifting?3:1.5,dt);// rise with the hero and show the ledge above
 frameSubject(encounterSubject(),pos,dt);
 const ahead=.8;let focus=tmpA.set(pos.x-sx*ahead,pos.y+1+liftLead*1.3,pos.z-sz*ahead).add(frameOffset),follow=7;
 pitch-=liftLead*.07;length+=liftLead*2.6+frameDist;
 const shot=introShot();
 if(shot&&!state.gentle){const s=shot.shot,q=s.focus==='hero'?pos:world.points[s.focus]||pos;focus=tmpA.set(q.x,q.y+s.up,q.z);sx=Math.sin(cameraYaw+s.yaw+shot.e*.012);sz=Math.cos(cameraYaw+s.yaw+shot.e*.012);pitch=s.pitch;length=s.len;follow=1.6;}
 else if(introActive){focus=tmpA.set(pos.x,pos.y+1,pos.z);}
 const rise=world.points.finaleRise,ft=quest.finaleTime??-1,ease=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
 if(quest.finaleActive&&!rise){const f=quest.finaleShot,g=world.points.finale||world.points.guardian,e=f*f*(3-2*f);focus=tmpA.set(g.x,g.y+e*14,g.z);pitch=.3+e*.25;length=12+e*16;follow=1.4;}
 cameraTarget.lerp(focus,1-Math.exp(-dt*follow));placeCamera(dt,sx,sz,pitch,length);
 if(quest.finaleActive&&rise&&ft>=1.6){
  // Finale crane: out of the Hollow and up over the waking village, then turn to the far bell.
  // Keys from world anchors: out through the Hollow's open (camera) side, up over the terrace, turn to the far bell.
  if(!crane){const P=world.points,tv=P.terraceView,c=P.arena||{x:0,y:0,z:0},far=P.farBell||rise.lookAt,o=new T.Vector3(Math.sin(DEFAULT_YAW),0,Math.cos(DEFAULT_YAW));// the Hollow opens toward the default camera
   const at=(r,y)=>new T.Vector3(c.x+o.x*r,y,c.z+o.z*r),top=P.hollowGate?.y??4;
   const over=tv?new T.Vector3().copy(tv.pos).addScaledVector(new T.Vector3().subVectors(tv.pos,tv.target).setY(0).normalize(),5).setY(tv.pos.y+12):at(36,top+22);
   crane={pos:new T.CatmullRomCurve3([camera.position.clone(),at(3,pos.y+4),at(9,top+2),at(22,top+5),at(34,top+20),over]),
    looks:[pos.clone().setY(pos.y+1.5),new T.Vector3(c.x,top+2,c.z),tv?new T.Vector3().copy(tv.target):at(0,top),new T.Vector3().copy(far)]};scriptCam.copy(camera.position);}
  const e=ease((ft-1.6)/7.2);crane.pos.getPoint(e,finaleCam);
  const L=crane.looks;if(ft<4.5)tmpB.lerpVectors(L[0],L[1],ease((ft-1.6)/2.9));else if(ft<9)tmpB.lerpVectors(L[1],L[2],ease((ft-4.5)/3.5));else tmpB.lerpVectors(L[2],L[3],ease((ft-9)/2.4));
  const k=1-Math.exp(-dt*(ft<2.2?2:4));scriptCam.lerp(finaleCam,k);camera.position.copy(scriptCam);finaleLook.lerp(tmpB,k);camera.lookAt(finaleLook);
 }else{crane=null;finaleLook.copy(camera.position).lerp(cameraTarget,1);
  const tv=world.points.terraceView;
  if(arrival>0&&tv){// Back on the terrace: ease from the painted terrace view into the normal follow arm.
   arrival=Math.max(0,arrival-dt);const k=ease(1-arrival/2.6);camera.position.lerpVectors(tv.pos,tmpB.copy(camera.position),k);camera.lookAt(tmpA.lerpVectors(tv.target,cameraTarget,k));
  }else camera.lookAt(cameraTarget);}
 // World-anchored intro shots (real world): cut between painted views rather than panning the arm.
 const ic=introActive&&!state.gentle?introCamera(shot):null;
 if(ic){if(introCut!==shot.index){introCut=shot.index;scriptCam.copy(ic.pos);finaleLook.copy(ic.look);}const k=1-Math.exp(-dt*1.2);scriptCam.lerp(ic.pos,k);camera.position.copy(scriptCam);finaleLook.lerp(ic.look,k);camera.lookAt(finaleLook);}
 if(kick>.002){kick*=Math.exp(-dt*9);camera.position.addScaledVector(kickDir,kick*.32*Math.sin(performance.now()/1000*48));}
 sun.position.set(cameraTarget.x-9,cameraTarget.y+20,cameraTarget.z+8);sun.target.position.copy(cameraTarget);camera.updateMatrixWorld(true);
 if(state.started&&(hudTimer-=dt)<=0){hudTimer=.15;safe=hudSafe();updateChart(pos);}
 wind.flush();
 const area=quest.area(pos);
 if(look){try{look.setFocus?.({hero:hero.position,heroObject:hero,extra:mara?[mara.position]:[]});look.update(dt,{area:LOOK_AREAS[area]||'terrace-dawn',restored:quest.restoration.village||0,t:state.t,gentle:state.gentle});look.render();}catch(e){console.warn('look failed; plain renderer from now on',e);look=null;renderer.render(scene,camera);}}else renderer.render(scene,camera);
 window.__READY__=true;
 const qt=quest.telemetry();
 window.__GAME__={pos:[pos.x,pos.z],y:pos.y,fps,speed:movement.speed,mode:movement.mode,grounded:movement.grounded,lifting:movement.lifting,knocked:movement.knocked,score:state.complete?1:0,draws:renderer.info.render.calls,tris:renderer.info.render.triangles,charged:wind.charged,chargeKind:wind.charge?.kind??null,paused:state.paused,started:state.started,introActive,introTime,introPhase:shot?SHOTS[shot.index].focus:null,context:context?.kind||null,contextId:context?.id||null,contextLabel:context?.label||null,objective:quest.objective(),area,quest:qt,wind:wind.telemetry(),restoration:{...quest.restoration},finaleTime:quest.finaleTime,finaleActive:quest.finaleActive,recoveredCount,freed:movement.freed,blocked:!!world.blocked(pos.x,pos.z,.23,pos.y),travel,checkpoint:movement.checkpoint.toArray(),cameraYaw,stubWorld:!!world.stub,look:!!look,version:2};
}
async function loadWorld(){
 if((MODULES.world||params.get('world')==='1')&&!params.has('stub')){try{const m=await import('./bellhollow/world.js');return adaptWorld(await m.buildBellhollow({THREE:T,scene,loadAsset:ASSET}),{THREE:T});}catch(e){console.warn('Bellhollow world failed to build; using the stub world.',e);}}
 return (await import('./bellhollow/stub-world.js')).buildBellhollow({THREE:T,scene});
}
async function loadGuardian(){if(!(MODULES.guardian||params.get('guardian')==='1')||params.get('guardian')==='stub')return undefined;try{return (await import('./bellhollow/guardian.js')).createGuardian;}catch(e){console.warn('guardian.js failed; using the stub encounter.',e);return undefined;}}
async function loadLook(){if(!MODULES.look||params.get('look')==='0')return null;try{const m=await import('./render/look.js');return m.createLook({THREE:T,renderer,scene,camera});}catch(e){console.warn('look.js failed; plain renderer.',e);return null;}}
try{
 if(legacy)$('#legacyNote').hidden=false;
 const loaded=await Promise.all([loadWorld(),loadCodeCharacter(buildApprovedHero),Promise.resolve(buildMara(T)),ASSET('./assets/staff.js'),loadGuardian(),loadLook()]);
 world=loaded[0];const character=loaded[1];mara=loaded[2];staff=loaded[3];const createGuardian=loaded[4];
 hero=character.root;hero.userData.joints=hero.children[0].userData.joints;scene.add(hero);staff.scale.setScalar(.73);staffHand=hero.userData.joints.rightHand;staffHand.add(staff);staff.visible=false;
 const P=world.points;start3=[P.start.x,P.start.y,P.start.z];
 if(P.bellOut&&P.arena&&!world.stub){// Paired bells on the high ring behind the ringing stand, facing the well.
  pairedBells=buildPairedBells(T);const s=P.bellOut,dx=s.x-P.arena.x,dz=s.z-P.arena.z,L=Math.hypot(dx,dz)||1,x=s.x+dx/L*1.3,z=s.z+dz/L*1.3,g=world.ground(x,z,s.y+.5);pairedBells.position.set(x,g??s.y,z);pairedBells.rotation.y=Math.atan2(-dx,-dz);pairedBells.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});scene.add(pairedBells);}
 mara.name='mara';mara.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});mara.position.set(P.mara.x,P.mara.y,P.mara.z);mara.rotation.y=Math.atan2(P.start.x-P.mara.x,P.start.z-P.mara.z);scene.add(mara);
 movement=createMovement(T,{start:start3,sampleGround:(x,z,y)=>world.ground(x,z,y),blocked:(x,z,r,y)=>world.blocked(x,z,r,y),stickElement:$('#stick'),jumpButton:$('#jump'),runButton:$('#run'),walkSpeed:1.65,runSpeed:5.8,acceleration:12,deceleration:16,turnResponse:12,cameraYaw:()=>cameraYaw,maxDrop:14});
 animator=createAdventureMotion(character,movement);hero.position.copy(movement.position);
 wind=createWind({THREE:T,scene,movement,sound,fx:()=>look?.fx?.wind});
 look=loaded[5];
 quest=createQuest({THREE:T,scene,world,wind,movement,caption,sound,onChange:questEvent,...(createGuardian?{createGuardian:o=>createGuardian({...o,look})}:{})});if(look){for(const [o,role,opts] of [[hero,'character'],[mara,'character'],[quest.guardian?.object,'outline',{dynamic:true,occluder:false}],[pairedBells,'outline',{dynamic:true}]])try{if(o)look.applyTo(o,role,opts);}catch(e){console.warn(e);}
  try{look.setAreaParams?.('hollow',{height:new T.Vector4(P.arena.y,P.hollowGate.y,.55,.62)});}catch(e){console.warn(e);}
  // Aim the valley backdrop so the far bell sits where the finale camera turns (sky azimuth: from -z toward +x).
  if(P.farBell)try{look.setBackdrop?.(new URL('./textures/v2/valley.webp',import.meta.url).href,{azimuthDeg:T.MathUtils.radToDeg(Math.atan2(P.farBell.x,-P.farBell.z))});}catch(e){console.warn(e);}}
 snapCamera();
 // Read-only anchors for known-route drivers (plain data; nothing here can change the game).
 const plain=o=>JSON.parse(JSON.stringify(o));window.__BELLHOLLOW__=Object.freeze({points:plain(P),vents:plain(world.vents||[]),wheels:plain(world.wheels||[]),sails:plain(world.sails||[]),stub:!!world.stub});
 // Read-only probe for camera acceptance captures: clearance, head projection, un-cut line-of-sight blockers.
 window.__CAMERA_PROBE__=()=>{const p=movement.position,ray=new T.Raycaster(),blockers=[],vis=o=>{for(let n=o;n;n=n.parent){if(!n.visible||n===hero)return false;}return true;};let floor=-Infinity;for(const [a,b] of [[0,0],[.6,0],[-.6,0],[0,.6],[0,-.6]])floor=Math.max(floor,floorUnder(camera.position.x+a,camera.position.z+b,camera.position.y));
  for(const h of [1.55,1.0]){const target=new T.Vector3(p.x,p.y+h,p.z),dir=target.clone().sub(camera.position),dist=dir.length();ray.set(camera.position,dir.normalize());ray.far=dist-.3;for(const hit of ray.intersectObject(scene,true)){const o=hit.object,m=Array.isArray(o.material)?o.material[0]:o.material;if(!o.isMesh||!vis(o)||m?.transparent&&m.opacity<.5||m?.isMeshBasicMaterial&&!m.depthWrite||m?.isShaderMaterial)continue;blockers.push({name:o.name||o.parent?.name||'mesh',h,at:+hit.distance.toFixed(2),of:+dist.toFixed(2)});}}
  const head=new T.Vector3(p.x,p.y+1.55,p.z).project(camera);heroBox.min.set(p.x-.35,p.y,p.z-.35);heroBox.max.set(p.x+.35,p.y+1.75,p.z+.35);const g=quest.subject();
  return {cam:camera.position.toArray().map(v=>+v.toFixed(2)),clear:floor===-Infinity?99:+(camera.position.y-floor).toFixed(2),pitch:+armPitch.toFixed(3),arm:+armLength.toFixed(2),frameDist:+frameDist.toFixed(2),head:[+((head.x+1)/2*innerWidth).toFixed(1),+((1-head.y)/2*innerHeight).toFixed(1)],headInView:Math.abs(head.x)<.97&&Math.abs(head.y)<.97&&head.z<1,unobstructed:!blockers.length,blockers:blockers.slice(0,4),hero:screenBox(heroBox),guardian:g?screenBox(g):null,subject:g?'guardian':null,chartTucked:document.body.classList.contains('chart-tucked'),safe,insideTrunk:inTrunk(camera.position.x,camera.position.z,camera.position.y)};};
 // Lazy-load the prologue illustrations once the game is ready (not counted against start-up).
 (window.requestIdleCallback||setTimeout)(()=>{for(const n of [1,2,3]){const i=new Image();i.src=new URL(`./textures/v2/card${n}.webp`,import.meta.url).href;}});
 // After ready (never blocking it): villagers, then the chart bake from the live scene.
 const afterReady=import('./bellhollow/villagers.js').then(m=>{villagers=m.createVillagers({THREE:T,scene,world,look});}).catch(e=>console.warn('villagers unavailable',e));
 afterReady.then(()=>requestAnimationFrame(()=>{try{map=createMap({THREE:T,renderer,scene,world,canvas:mapCanvas,look,hide:[hero,mara,staff,pairedBells,quest.guardian?.object,villagers?.root].filter(Boolean)});requestAnimationFrame(()=>{try{map.bake();}catch(e){console.warn('map bake failed',e);}});}catch(e){console.warn('map unavailable',e);map=null;}}));
 $('#startb').disabled=false;$('#startb').textContent=loadedSave?'Start a new adventure':'Start adventure';$('#continueb').hidden=!loadedSave;updateUI();window.__START__=()=>start(true);
}catch(e){console.error(e);$('#error').hidden=false;$('#error').textContent='Bellhollow could not load. '+e.message;}
requestAnimationFrame(frame);
