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
import {createBossAudio} from './boss-music.js';
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
const sun=new T.DirectionalLight(0xffe1ae,2.4);sun.position.set(-9,20,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:.5,far:70});sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;scene.add(sun,sun.target);
const state={started:false,paused:false,t:0,complete:false,action:null,actionTime:0,actionTarget:null,actionCallback:null,muted:localStorage.getItem('bellkeeper-muted')==='1',gentle:localStorage.getItem('bellkeeper-gentle')==='1'};
const DEFAULT_YAW=Math.atan2(.615,.788);let cameraYaw=DEFAULT_YAW,cameraDrag=null;
let hero,movement,animator,world,wind,quest,look=null,staff,staffHand,mara,captionEnd=0,context=null,travel=0,fps=60,start3=[0,0,0];
let saveTimer=0,introTime=0,introActive=false,lastShot=-1,queued=null,uiTimer=0,endingAt=0,liftLead=0;
// Game feel: hit-stop (sim frozen, render continues), camera kick, finale arrival blend; Mara acting.
let stickReleasedAt=-9,beat=null,villagers=null,map=null,crane=null,pairedBells=null,bellOutT=null,bellRetT=null,recoveredCount=0,introCut=-1,hitStop=0,kick=0,arrival=0,maraAct={lever:0,leverT:-1,gesture:0,wave:0,waveUntil:0};const kickDir=new T.Vector3(),finaleLook=new T.Vector3(),finaleCam=new T.Vector3(),scriptCam=new T.Vector3();
let captionsEnabled=localStorage.getItem('bellkeeper-captions')!=='0';
// Camera spring arm, subject framing and chart tucking state (see frame()).
const REVEAL_END=4.6,REVEAL_H=16;let revealWasSet=false,revealLanded=false,revealDone=false;try{revealDone=localStorage.getItem('bellkeeper-guardian-seen')==='1';}catch{}
let fightAimK=0,revealCut=false;const fightAim=new T.Vector3();let galK=0,fightYaw=null,fightSet=0,fightNudge=0,revealT=-1,galYaw=null,galSet=0,galNudge=0,galSgn=1,skipGuardianBox=false,encK=0,viewShift=0,appliedShift=0,armPitch=null,armLength=null,frameDist=0,lastCameraInput=-9,chartTuck=false,chartOverride=false,hudTimer=0,safe=null;const frameOffset=new T.Vector3(),armOrigin=new T.Vector3(),heroBox=new T.Box3(),ndc=new T.Vector3(),tmpA=new T.Vector3(),tmpB=new T.Vector3();
const loadedSave=readSave(),legacy=!loadedSave&&hasLegacySave();
const CARD=7,CARDS=3*CARD,ENGINE=20;// prologue cards, then the 20 s in-engine intro
function save(){if(!state.started||introActive||!quest||quest.finaleActive||!movement)return;const c=movement.checkpoint;writeSave({quest,checkpoint:[c.x,c.y,c.z],map});}
function later(delay,text,duration=5,then){queued={at:state.t+delay,text,duration,then};}
function caption(text,duration=4){$('#caption').textContent=text;$('#caption').style.opacity=captionsEnabled&&text?'1':'0';captionEnd=state.t+Math.max(duration,Math.min(9,text.length/19));}
const soundscape=createSoundscape();soundscape.setMuted(state.muted);titleMusic.setMuted(state.muted);
const bossAudio=createBossAudio(soundscape,{listener:()=>camera});
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
 {const G=quest?.guardian,f=!!(G?.fighting&&quest.progress.hollow&&!quest.progress.guardian),n=G?.lives|0,L=$('#lives');L.hidden=!f;if(f&&L.dataset.n!==String(n)){L.dataset.n=n;L.innerHTML='<i></i>'.repeat(n)+'<i class="off"></i>'.repeat(Math.max(0,3-n));L.setAttribute('aria-label',n+' of 3 lives');}}// guardian fight lives
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
function continueGame(){const d=readSave();if(!d)return;quest.restore(d.quest);try{map?.restore?.(d.map);}catch(e){console.warn(e);}movement.reset(safeSpot(d.checkpoint));animator.reset();start(true);snapCamera();state.complete=quest.progress.complete;if(quest.progress.complete)caption('Bellhollow is breathing. Wander as long as you like.',4);}
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
 try{storyBeats();}catch(err){console.warn(err);}
 if(e.knock){movement.knockback(e.knock);sound('knock');if(!state.gentle){hitStop=.11;kick=1;kickDir.set(Math.random()-.5,.6,Math.random()-.5).normalize();}}
 if(e.sweep){const b=document.body;b.classList.remove('swept');void b.offsetWidth;b.classList.add('swept');setTimeout(()=>b.classList.remove('swept'),1900);caption(e.sweep,5);}// guardian fight: out of lives -> soft fade, restart
 if(e.bells==='out')bellOutT=state.t;if(e.bells==='return'){bellRetT=state.t;bellOutT??=state.t-1.7;}
 if(e.mara==='lever')maraAct.leverT=0;if(e.mara==='gesture'){maraAct.gesture=1.6;handover();}
 if(['sails','pipes','ladders'].includes(e.restored)){const h=world.points[e.restored]?.mill;if(h){const port=camera.aspect<.85,v=V3(h);startBeat(v.clone().setY(v.y-1.5),{dist:port?24:18,up:2.5,dur:3.2,kind:'mill',normal:rotorNormal(v)||new T.Vector3(.615,0,.788),hold:1.8,subject:v.clone().setY(v.y-3)});}}
 if(e.look&&!(beat&&beat.kind==='hint')){const v=new T.Vector3(...e.look);startBeat(v,{dist:9,up:4,dur:2.6,kind:'hint',normal:tmpA.set(movement.position.x-v.x,0,movement.position.z-v.z).clone(),hold:1.8,subject:v});}
 if(e.vista==='mills'){const m=millHubs().filter((v,i)=>i<2);/* the western Sails and Pipes mills are the ones seen from the loft */if(m.length){const c=m.reduce((a,v)=>a.add(v),new T.Vector3()).multiplyScalar(1/m.length),p=movement.position;const from=new T.Vector3(p.x-c.x,0,p.z-c.z).normalize().multiplyScalar(6).add(p).setY(p.y+6);startBeat(c,{from,dur:3.4,kind:'vista'});}}if(e.mara==='wave')maraAct.waveUntil=state.t+(state.complete||e.complete?9:5);
 if(e.teleport){movement.reset(e.teleport);animator?.reset();snapCamera();if(world.points.terraceView)arrival=2.6;const ms=world.points.terraceView?.maraStand;if(ms&&mara){mara.position.set(ms.x,ms.y,ms.z);}}
 if(e.complete){state.complete=true;endingAt=state.t+7;later(1.6,'',0,()=>sound('chime'));}
 if(e.restored)sound('restore');
 updateUI();if(e.checkpoint||e.restored||e.complete)save();}
$('#storyNext').onclick=()=>{if(introActive&&introTime<CARDS)introTime=Math.min(CARDS,(Math.floor(introTime/CARD)+1)*CARD);};
$('#startb').onclick=()=>{if(loadedSave)clearSave();revealDone=false;try{localStorage.removeItem('bellkeeper-guardian-seen');}catch{}start();};$('#continueb').onclick=continueGame;$('#skipIntro').onclick=()=>{if(quest?.finaleActive)quest.skipFinale();else endIntro();};$('#action').onclick=action;$('#pause').onclick=()=>pause(true);$('#resume').onclick=()=>pause(false);$('#keepExploring').onclick=()=>$('#ending').hidden=true;
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
$('#reset').onclick=()=>{revealDone=false;try{localStorage.removeItem('bellkeeper-guardian-seen');}catch{}bellOutT=bellRetT=null;opening.end();titleMusic.fadeOut(1);Object.assign(state,{complete:false,action:null,actionCallback:null});quest.reset();clearSave();queued=null;introActive=false;$('#skipIntro').hidden=true;document.body.classList.remove('cinematic');$('#ending').hidden=true;cameraYaw=DEFAULT_YAW;movement.reset(start3);animator.reset();travel=0;snapCamera();pause(false);updateUI();save();caption('Another morning. The bell is waiting by the path.',4);};
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
// Staff handover: step the hero onto a mark facing Mara, then a brief closer shot of her face.
function handover(){if(!mara)return;const f=new T.Vector3(Math.sin(mara.rotation.y),0,Math.cos(mara.rotation.y)),mark=mara.position.clone().addScaledVector(f,1.45);
 if(movement.isSafe(mark.toArray())){movement.reset(mark.toArray());movement.yaw=Math.atan2(mara.position.x-mark.x,mara.position.z-mark.z);}
 // Frame both of them from the side: the look sits between their chests, the lens a little in front of the pair.
 const mid=mara.position.clone().addScaledVector(f,.72).setY(mara.position.y+1.25),side=new T.Vector3(f.z,0,-f.x);const port=camera.aspect<.85;startBeat(mid,{from:mid.clone().addScaledVector(side,port?1.3:4.2).addScaledVector(f,port?5.6:1.4).setY(mara.position.y+(port?4.4:2.1)),   /* portrait: over the hero's shoulder, both stacked in the narrow frame */dur:2.4,kind:'handover',hold:1.2,subject:mara.position.clone()});}
// Mara acts through bh-mara.js hooks: throws the bypass lever, keeps a hand on it, looks at the
// apprentice when near, opens her hands as she gives the staff, waves at the finale and ending.
function actMara(dt,p){const set=mara.userData.setPose,to=mara.userData.headToward;if(!set)return;
 if(maraAct.leverT>=0){maraAct.leverT+=dt;}const lever=maraAct.leverT<0?(quest.progress.bypass?.55:0):maraAct.leverT<1.1?Math.sin(Math.min(1,maraAct.leverT/1.1)*Math.PI/2):.55+.45*Math.max(0,1-(maraAct.leverT-1.1)/.8);
 maraAct.lever+=(lever-maraAct.lever)*(1-Math.exp(-dt*8));maraAct.gesture=Math.max(0,maraAct.gesture-dt);const waving=state.t<maraAct.waveUntil;maraAct.wave+=((waving?1:0)-maraAct.wave)*(1-Math.exp(-dt*4));
 let yaw=0,pitch=0;const d=Math.hypot(p.x-mara.position.x,p.z-mara.position.z);if(d<4.5&&to){const l=mara.worldToLocal(tmpA.set(p.x,p.y+1.5,p.z));const h=to(l);yaw=h.yaw;pitch=h.pitch;}
 maraAct.yaw=T.MathUtils.damp(maraAct.yaw||0,yaw,4,dt);maraAct.pitch=T.MathUtils.damp(maraAct.pitch||0,pitch,4,dt);
 set({yaw:maraAct.yaw,pitch:maraAct.pitch,lever:maraAct.wave>.1?0:maraAct.lever,wave:maraAct.wave,gesture:Math.min(1,maraAct.gesture),lean:.04*Math.sin(state.t*.9),t:state.t});}
// People and benches are solid: Mara, the villagers (moving a little) and their benches (boxes, cached).
let benchBoxes=null;
function npcBlocked(x,z,r,y){
 if(mara&&Math.abs(y-mara.position.y)<1.2&&Math.hypot(x-mara.position.x,z-mara.position.z)<r+.62)return true;   // the hero stops a step short of her (the high camera still reads both)
 if(villagers){for(const v of villagers.list)if(Math.abs(y-v.y)<1.2&&Math.hypot(x-v.x,z-v.z)<r+.28)return true;
  benchBoxes??=villagers.root.children.filter(o=>o.isMesh&&!villagers.list.some(v=>v.v===o)).map(o=>new T.Box3().setFromObject(o));
  for(const b of benchBoxes)if(y<b.max.y&&y+1.6>b.min.y&&x>b.min.x-r&&x<b.max.x+r&&z>b.min.z-r&&z<b.max.z+r)return true;}
 return false;}
function findContext(){const p=movement.position;context=state.action||quest.finaleActive?context:quest.context(p,movement.yaw);
 $('#action').disabled=!context||!!state.action;$('#action').innerHTML=(context?.label||'Look around')+' <span>SPACE</span>';$('#action').dataset.kind=context?.kind||'';$('#action').dataset.idle=String(!context);}
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
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;if(appliedShift)camera.setViewOffset(innerWidth,innerHeight,0,appliedShift*innerHeight,innerWidth,innerHeight);camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
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
// Tall architecture colliders (houses, stalls, tall walls, gate piers) near the arm: the lens never sits inside
// or behind them. Small or low colliders (barrels, lamps, rails, kerbs, low walls) are ignored: the camera goes over them.
const armCols=[];
function colTop(c){const dy=typeof c.dy==='function'?c.dy():(c.dy||0);return c.type==='seg'?Math.max(c.ya,c.yb)+c.h+dy:c.y1+dy;}
function colBig(c){if(c._big!==undefined)return c._big;let w,d,h;if(c.type==='seg'){w=Math.hypot(c.bx-c.ax,c.bz-c.az);d=2*c.t;h=c.h;}else if(c.type==='circle'){w=d=2*c.r;h=c.y1-c.y0;}else if(c.type==='box'){w=2*c.hw;d=2*c.hd;h=c.y1-c.y0;}else return c._big=false;
 return c._big=h>=1.9&&Math.max(w,d)>=1.4;}
let bigBoxes=null;const armBoxes=[],armRibbons=[],tallCols=[];
// Branch walkways: the bark tube is wider and deeper than the walkable ribbon on top of it (bark never fades).
function ribbonHit(r,x,z,h){if(r.enabled===false||typeof r.enabled==='function'&&!r.enabled())return false;const p=r.pts,hw=r.w/2+.6,dy=typeof r.dy==='function'?r.dy():(r.dy||0);for(let i=1;i<p.length;i++){const ax=p[i-1][0],az=p[i-1][2],dx=p[i][0]-ax,dz=p[i][2]-az,u=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1e-9)));if(Math.hypot(x-ax-u*dx,z-az-u*dz)>hw)continue;const y=p[i-1][1]+(p[i][1]-p[i-1][1])*u+dy;if(y>armLow&&h>y-1.9&&h<y+.4)return true;}return false;}
function gatherArmCols(o,reach){armCols.length=0;armBoxes.length=0;
 // Large-architecture boxes recorded by the world kit (static blocks): walls, houses, gate arches, stalls.
 if(!bigBoxes&&world?.root){bigBoxes=[];for(const g of world.root.children)if(g.userData?.bigBoxes)bigBoxes.push(...g.userData.bigBoxes);}
 {const g=skipGuardianBox?null:encounterSubject();if(g&&!g.isEmpty?.())armBoxes.push([g.min.x+.3,g.min.y,g.min.z+.3,g.max.x-.3,g.max.y+.4,g.max.z-.3]);}   // the guardian's body: the lens goes over or around it, never behind it
// A box the hero stands inside (a mill with its own deck/balcony) says nothing about where the lens may go: skip it.
 for(const b of bigBoxes||[])if(b[4]>armLow&&!(o.x>b[0]-.3&&o.x<b[3]+.3&&o.z>b[2]-.3&&o.z<b[5]+.3&&o.y>b[1]-.3&&o.y<b[4]+.3)&&Math.max(b[0]-o.x,o.x-b[3],0)<reach&&Math.max(b[2]-o.z,o.z-b[5],0)<reach)armBoxes.push(b);
 armRibbons.length=0;for(const r of world?.ground_model?.surfaces||[])if(r.type==='ribbon'&&/branch/.test(r.id||'')&&r.bb&&o.x>r.bb[0]-reach&&o.x<r.bb[1]+reach&&o.z>r.bb[2]-reach&&o.z<r.bb[3]+reach)armRibbons.push(r);
 const cs=world?.ground_model?.colliders;if(!cs)return;tallCols.length=0;for(const c of cs){if(c.type!=='seg'&&c.type!=='circle'&&c.type!=='box')continue;if(c.enabled===false||typeof c.enabled==='function'&&!c.enabled())continue;if(colTop(c)<=armLow)continue;const big=colBig(c);
 const cx=c.type==='seg'?(c.ax+c.bx)/2:c.x,cz=c.type==='seg'?(c.az+c.bz)/2:c.z,cr=c.type==='seg'?Math.hypot(c.bx-c.ax,c.bz-c.az)/2+c.t:c.type==='circle'?c.r:Math.hypot(c.hw,c.hd);if(Math.hypot(cx-o.x,cz-o.z)<reach+cr)if(big)armCols.push(c);else if((c.type==='seg'?c.h:c.y1-c.y0)>=1.8)tallCols.push(c);}}
function colHit(c,x,z,h,pad){const dy=typeof c.dy==='function'?c.dy():(c.dy||0);
 if(c.type==='seg'){const dx=c.bx-c.ax,dz=c.bz-c.az,L2=dx*dx+dz*dz||1e-9,u=Math.max(0,Math.min(1,((x-c.ax)*dx+(z-c.az)*dz)/L2));if(Math.hypot(x-c.ax-u*dx,z-c.az-u*dz)>=pad+c.t)return false;const base=c.ya+(c.yb-c.ya)*u+dy;return h<base+c.h+pad&&h>base-pad;}
 if(c.type==='circle'){if(Math.hypot(x-c.x,z-c.z)>=pad+c.r)return false;return h<c.y1+dy+pad&&h>c.y0+dy-pad;}
 const lx=(x-c.x)*c.cos-(z-c.z)*c.sin,lz=(x-c.x)*c.sin+(z-c.z)*c.cos;if(Math.hypot(Math.max(Math.abs(lx)-c.hw,0),Math.max(Math.abs(lz)-c.hd,0))>=pad)return false;return h<c.y1+dy+pad&&h>c.y0+dy-pad;}
// Anything the lens must not sit in or right behind: trunk, raised slabs, tall architecture, branch walkways.
function solidAt(x,z,h,pad){if(inTrunk(x,z,h))return 'trunk';
 if(world?.layers){for(const L of world.layers(x,z))if(L.h>armLow&&L.h>h-pad&&L.h<h+1.1)return L.id;}else{const g=viewGround(x,z);if(g>armLow&&h<g+pad)return 'ground';}
 for(const k of armCols)if(colHit(k,x,z,h,Math.min(pad,.3)))return k.id||k.type;
 for(const r of armRibbons)if(ribbonHit(r,x,z,h))return r.id;
 const q=Math.min(pad,.3);for(const b of armBoxes)if(x>b[0]-q&&x<b[3]+q&&z>b[2]-q&&z<b[5]+q&&h>b[1]-q&&h<b[4]+q)return 'arch-box';return null;}
function armHit(o,sx,sz,pitch,length){const c=Math.cos(pitch),s=Math.sin(pitch);for(let i=1;i<=20;i++){const d=length*i/20;if(d<=1.2)continue;const x=o.x+sx*c*d,z=o.z+sz*c*d,h=o.y+s*d,pad=.35+.03*i;
 if(d<=2){if(inTrunk(x,z,h)){armHitId='trunk';return d;}continue;}
 // Low things (balustrades, barrels, kerbs: tops under ~1.5 m above the hero's feet) never shorten the arm: the camera goes over them.
 const id=solidAt(x,z,h,pad);if(id){armHitId=id;return d;}
 // Thin tall things (gate piers, posts) may fade between lens and hero, but the lens itself never sits in one.
 if(d>length-1.2)for(const k of tallCols)if(colHit(k,x,z,h,.35)){armHitId=k.id||'post';return d;}}return 0;}
// How much of the view right in front of a lens at yaw `yaw` is filled by large architecture / bark (0..1):
// a 5x3 fan of rays across the frame, each probed out to 4 m.
const fanF=new T.Vector3(),fanR=new T.Vector3(),fanU=new T.Vector3(),fanP=new T.Vector3(),fanD=new T.Vector3();
function closeClutter(yaw,pitch,length){const sx=Math.sin(yaw),sz=Math.cos(yaw),c=Math.cos(pitch);fanP.set(armOrigin.x+sx*c*length,armOrigin.y+Math.sin(pitch)*length,armOrigin.z+sz*c*length);
 fanF.copy(armOrigin).sub(fanP).normalize();fanR.set(-fanF.z,0,fanF.x).normalize();fanU.crossVectors(fanR,fanF);let n=0,hit=0;
 for(const ax of [-.68,-.45,-.22,0,.22,.45,.68])for(const ay of [-.28,0,.28]){fanD.copy(fanF).addScaledVector(fanR,ax).addScaledVector(fanU,ay).normalize();n++;
  for(const d of [.8,1.6,2.4,3.2,4,4.8,5.6,6.4,7.2]){const x=fanP.x+fanD.x*d,z=fanP.z+fanD.z*d,h=fanP.y+fanD.y*d;if(solidAt(x,z,h,.1)||tallCols.some(k=>colHit(k,x,z,h,.1))){hit+=1-d/10;break;}}}
 // The hero hidden behind a tall thin thing (gate pier, post cluster) that fades rather than blocks: also worth a swing.
 let hid=0;const L=fanP.distanceTo(armOrigin);for(let d=.8;d<L-1;d+=.4){const x=fanP.x+fanF.x*d,z=fanP.z+fanF.z*d,h=fanP.y+fanF.y*d;if(tallCols.some(k=>colHit(k,x,z,h,.05))){hid=.35;break;}}
 // Never-fading bark/roots/Hollow walls filling the near view (3 short rays; Hollow fight only, where they crowd the lens).
 if(encK>.5&&barkMeshes?.length){for(const ax of [-.35,0,.35]){fanD.copy(fanF).addScaledVector(fanR,ax).normalize();barkRay.set(fanP,fanD);barkRay.near=.2;barkRay.far=3.2;if(barkRay.intersectObjects(barkMeshes,false).length)hit+=2.5;}}
 // Bark (never fades) between the lens and the hero's head: the strongest reason to swing.
 const ah=armHit(armOrigin,sx,sz,pitch,length);return hit/n+hid+(ah?.1+.35*(1-ah/length):0)+(barkCut(armOrigin,sx,sz,pitch,length)?.4:0);}
// Zelda-style swing: when big architecture or bark crowds the lens, ease the yaw toward open space. Slow, eased, never
// while the player turns the camera (Q/E, drag), holds the touch stick, or during beats/cinematics.
let swingGoal=null,swingCheck=0,wantLength=0;
function openSpaceSwing(dt,nowS,allowed){
 if(!allowed||armPitch==null){swingGoal=null;return;}
 if((swingCheck-=dt)<=0){swingCheck=.35;const len=wantLength||armLength,now=closeClutter(cameraYaw,armPitch,len);   // judged at the arm the camera wants, so a pulled-in arm counts as crowded
  if(now>.15&&swingGoal===null){let best=now,goal=null;for(const d of [.25,-.25,.5,-.5,.8,-.8,1.1,-1.1,1.5,-1.5]){const v=closeClutter(cameraYaw+d,armPitch,len)+Math.abs(d)*.05;if(v<best-.08){best=v;goal=cameraYaw+d;}}swingGoal=goal;}
  else if(now<.05)swingGoal=null;}
 if(swingGoal!==null){const e=Math.atan2(Math.sin(swingGoal-cameraYaw),Math.cos(swingGoal-cameraYaw));if(Math.abs(e)<.02){swingGoal=null;return;}
  // eased: fast in the middle of the turn, gentle at both ends; at most ~0.45 rad/s
  const vmax=(armLength??11)<3.2?1.1:.45;cameraYaw+=Math.sign(e)*Math.min(Math.abs(e),dt*Math.min(vmax,.15+Math.abs(e)*.9*vmax/.45));}}   // pinned against a tower: turn out briskly
let armLow=-Infinity,armHitId=null;
const feel=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(v=>new T.Vector3(...v)),feelRay=new T.Raycaster();
function lensTouches(list){feelRay.near=0;feelRay.far=.7;for(const d of feel){feelRay.set(camera.position,d);if(feelRay.intersectObjects(list,true).some(h=>h.object.isMesh&&h.object.visible&&!h.object.userData.lookHull))return true;}
 // inside a closed mesh the feelers see only back faces: also test the ray back toward the hero's head
 tmpB.set(movement.position.x,movement.position.y+1.5,movement.position.z).sub(camera.position);const L=tmpB.length();feelRay.set(camera.position,tmpB.multiplyScalar(1/L));feelRay.far=Math.max(.1,L-.6);
 return feelRay.intersectObjects(list,true).some(h=>h.object.isMesh&&h.object.visible&&!h.object.userData.lookHull);}
let barkMeshes=null;const barkRay=new T.Raycaster(),barkDir=new T.Vector3(),barkHead=new T.Vector3(),barkCam=new T.Vector3();
function barkCut(o,sx,sz,pitch,length){if(!barkMeshes&&world?.root){barkMeshes=[];world.root.traverse(m=>{const k=m.isMesh&&!Array.isArray(m.material)&&m.material.userData?.bhKey;if((k==='bark'||k==='barkShade')&&!/trunk|hollow|backdrop|far/.test(m.name)||/^bh-(hollow|trunk-galleries)/.test(m.name)&&/^(bark|barkShade|heartwood|heartwoodLight|stoneDeep|pavingDeep|stone|stoneShade|stoneCool|plaster|paving|deck|deckOld|deckDark|timber|timberDark)$/.test(k))barkMeshes.push(m);/* + the Hollow's walls, roots and ring ledges (never fade) */});}
 if(!barkMeshes?.length)return 0;const gObj=encK>.3?quest?.guardian?.object:null;const c=Math.cos(pitch);barkDir.set(sx*c,Math.sin(pitch),sz*c);
 // Aim from the hero's head (what must stay visible) to the lens; return the distance along the arm.
 barkHead.set(o.x,Math.max(o.y,(movement?.position.y??o.y)+1.65),o.z);barkCam.copy(o).addScaledVector(barkDir,length);barkCam.sub(barkHead);const L=barkCam.length();barkCam.multiplyScalar(1/L);
 barkRay.set(barkHead,barkCam);barkRay.near=.8;barkRay.far=L+.3;const h=barkRay.intersectObjects(barkMeshes,false);if(gObj){const g=barkRay.intersectObject(gObj,true).filter(x=>x.object.isMesh&&x.object.visible&&!x.object.userData.lookHull);if(g.length&&(!h.length||g[0].distance<h[0].distance))h.unshift(g[0]);}return h.length?h[0].distance*length/L:0;}   /* the guardian's body counts too: it never hides the hero */
function placeCamera(dt,sx,sz,pitch,length){wantLength=length;// Test the arm from a point kept above the floor: framing may pan the look target below a descending deck.
 armOrigin.copy(cameraTarget);armOrigin.y=Math.max(armOrigin.y,floorUnder(armOrigin.x,armOrigin.z,armOrigin.y)+.9);let p=pitch,l=length;
 armLow=(movement?.position.y??armOrigin.y-1)+1.5;gatherArmCols(armOrigin,length+1);
 // Blocked: rise first (up to ~55° at full length), then pull in a little (>= 6.5 m), then lower angles at full
 // length, then shorten — but keep the arm >= 5.5 m, then >= 4.5 m. Only where truly enclosed (overhangs, alleys) the pitch/length pair with the longest
 // free arm, preferring gentle pitches: never the old 60°/2.5 m straight-down collapse.
 if(galK<.5&&armHit(armOrigin,sx,sz,p,l)){let found=false;const lifting=!!movement?.lifting,MAXP=lifting?.72:.96;   // riding an updraft: never tip toward top-down, pull in instead
  for(let q=pitch+.05;q<=MAXP+1e-6&&!found;q+=.05)if(!armHit(armOrigin,sx,sz,q,l)){p=q;found=true;}
  for(let q=pitch;q<=MAXP+1e-6&&!found;q+=.08){const hit=armHit(armOrigin,sx,sz,q,l);const l2=Math.max(6.5,hit-.6);if(l2<l&&!armHit(armOrigin,sx,sz,q,l2)){p=q;l=l2;found=true;}}
  for(let q=pitch-.05;q>=.2&&!found;q-=.05)if(!armHit(armOrigin,sx,sz,q,l)){p=q;found=true;}
  for(const minL of [5.5,4.5])for(let q=pitch;q<=MAXP+1e-6&&!found;q+=.08){const hit=armHit(armOrigin,sx,sz,q,l);const l2=Math.max(minL,hit-.6);if(l2<l&&!armHit(armOrigin,sx,sz,q,l2)){p=q;l=l2;found=true;}}
  for(const minL of [5.5,4.5])for(let q=pitch-.08;q>=.12&&!found;q-=.08){const hit=armHit(armOrigin,sx,sz,q,l);const l2=Math.max(minL,hit-.6);if(l2<l&&!armHit(armOrigin,sx,sz,q,l2)){p=q;l=l2;found=true;}}
  // Pressed against something tall (a stall, a house corner): climb steeper before giving up length.
  for(const L of [l,7,5.5,4.5])for(let q=MAXP+.04;q<=(lifting?.8:1.12)+1e-6&&!found&&L<=l;q+=.04)if(!armHit(armOrigin,sx,sz,q,L)){p=q;l=L;found=true;}
  if(!found){let best=-1;for(let q=.12;q<=MAXP+1e-6;q+=.08){const hit=armHit(armOrigin,sx,sz,q,l),free=Math.max(2.5,hit-.6)-Math.abs(q-pitch)*1.5;if(free>best){best=free;p=q;l=Math.max(2.5,hit-.6);}}}}
 // Branch bark (never fades, curved tubes the height tests miss): one ray along the chosen arm; rise, else pull in.
 let cut=galK<.5?barkCut(armOrigin,sx,sz,p,l):0;if(cut){for(let q=p+.12;q<=(encK>.5?1.25:1.0)&&cut;q+=.12){if(!armHit(armOrigin,sx,sz,q,l)&&!barkCut(armOrigin,sx,sz,q,l)){p=q;cut=0;}}
  for(let q=p-.12;q>=.3&&cut;q-=.12){if(!armHit(armOrigin,sx,sz,q,l)&&!barkCut(armOrigin,sx,sz,q,l)){p=q;cut=0;}}
  for(const L of [l*.75,l*.55])if(cut&&L>=6){for(const q of [p,pitch]){if(cut&&!armHit(armOrigin,sx,sz,q,L)&&!barkCut(armOrigin,sx,sz,q,L)){p=q;l=L;cut=0;}}}if(cut)l=Math.max(3.5,Math.min(l,cut-.5));}
 // Right beside the guardian (catching its breath) its body would squeeze the arm: then let the lens pass it instead.
 if(!skipGuardianBox&&l<6&&encounterSubject()){skipGuardianBox=true;try{return placeCamera(dt,sx,sz,pitch,length);}finally{skipGuardianBox=false;}}
 armPitch??=p;armLength??=l;armPitch=T.MathUtils.damp(armPitch,p,p>armPitch?12:2.4,dt);armLength=T.MathUtils.damp(armLength,l,l<armLength?12:2,dt);
 const c=Math.cos(armPitch)*armLength;camera.position.set(cameraTarget.x+sx*c,cameraTarget.y+Math.sin(armPitch)*armLength,cameraTarget.z+sz*c);
 let floor=-Infinity;for(const [a,b] of [[0,0],[.6,0],[-.6,0],[0,.6],[0,-.6]])floor=Math.max(floor,floorUnder(camera.position.x+a,camera.position.z+b,camera.position.y));camera.position.y=Math.max(camera.position.y,floor+1.1);
 // In the fight: the lens must not touch the well's walls, roots, posts or the guardian. Six short feeler rays; if one
 // touches, slide the lens in toward the look target (and a little up) until it is clear.
 if(encK>.3&&barkMeshes?.length){const gObj=quest?.guardian?.object,list=gObj?[...barkMeshes,gObj]:barkMeshes;
  for(let i=0;i<8&&lensTouches(list);i++){camera.position.lerp(cameraTarget,.18);camera.position.y+=.15;}}
 // Lens touching the trunk: rise a little first (at most 2 m, so the view never turns straight down), then pull in.
 for(let i=0;i<4&&inTrunk(camera.position.x,camera.position.z,camera.position.y);i++)camera.position.y+=.5;
 for(let i=0;i<10&&inTrunk(camera.position.x,camera.position.z,camera.position.y)&&camera.position.distanceTo(cameraTarget)>3;i++)camera.position.lerp(cameraTarget,.12);}
function screenBox(box){let l=1e9,t=1e9,r=-1e9,b=-1e9;for(let i=0;i<8;i++){ndc.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(camera);if(ndc.z>1)return null;const x=(ndc.x+1)/2*innerWidth,y=(1-ndc.y)/2*innerHeight;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}return {l,t,r,b};}
// Play area left by the HUD: below the objective panel, above caption/buttons, left of an open chart.
function hudSafe(){const s={l:12,t:12,r:innerWidth-12,b:innerHeight-12},top=$('#hud>div')?.getBoundingClientRect();if(top?.height)s.t=Math.max(s.t,top.bottom+10);
 for(const el of document.querySelectorAll('#caption,#charge,#controls button,#stick,#hint')){if(el.hidden||el.id==='caption'&&el.style.opacity==='0'||getComputedStyle(el).visibility==='hidden')continue;const r=el.getBoundingClientRect();if(r.height&&r.top>innerHeight*.45)s.b=Math.min(s.b,r.top-10);}
 if(!document.body.classList.contains('chart-tucked')&&!mapCanvas.hidden&&getComputedStyle(mapCanvas).visibility!=='hidden'){const r=mapCanvas.getBoundingClientRect();if(r.width&&r.left>innerWidth*.5)s.r=Math.min(s.r,r.left-10);}return s;}
// The carved gallery (outer ring walkway, r > ~9 m, above the high ring) is not the fight: no encounter framing there.
// Inside the Hollow (gate, gallery, ramps and stairs, down to the arena floor) but not in the arena fight and not in the
// reveal: the forced open-side camera. The fight = after the reveal (or a saved phase), with the hero on the floor ring.
const inGallery=p=>{if(!p||!(quest?.area?.(p)==='hollow'||(Math.hypot(p.x,p.z)<12.5&&p.y<5.5&&p.y>-16)))return false;   /* by position too: the gate end of the gallery still reads as 'terrace' */
 if(revealT>=0&&revealT<REVEAL_END)return false;
 const R=world?.points?.guardianWell?.rings,G=quest?.guardian,fought=revealDone||(G?.phase|0)>0||!!quest?.progress?.guardian;
 return !(fought&&R&&p.y<R.low.y+2.5&&!quest?.progress?.guardian);};
function encounterSubject(){return state.started&&!introActive&&!inGallery(movement?.position)?quest?.subject()||null:null;}
// Keep hero and encounter actor inside the HUD-free area: pan the look target, widen the arm, and
// (not in gentle motion, not right after manual Q/E/drag) turn gently only when they cannot fit.
function frameSubject(subject,pos,dt){
 if(!subject){frameOffset.multiplyScalar(Math.exp(-dt*1.2));frameDist=T.MathUtils.damp(frameDist,0,1.2,dt);return;}
 heroBox.min.set(pos.x-.35,pos.y,pos.z-.35);heroBox.max.set(pos.x+.35,pos.y+1.75,pos.z+.35);const a=screenBox(heroBox),b=screenBox(subject),s=safe||hudSafe();
 if(!a||!b){frameOffset.multiplyScalar(Math.exp(-dt*4));frameDist=T.MathUtils.damp(frameDist,0,4,dt);return;}   /* guardian behind the lens (or hero lost): fall back to the hero */
 const l=Math.min(a.l,b.l),r=Math.max(a.r,b.r),t=Math.min(a.t,b.t),bottom=Math.max(a.b,b.b),ppm=innerHeight/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*(armLength||11)),k=Math.min(1,dt*2.5),sx=Math.sin(cameraYaw),sz=Math.cos(cameraYaw),port=camera.aspect<.85;
 // Pan toward the pair's centre, but never so far that the hero leaves the play area (hero first, guardian best effort).
 const m=port?28:40,cx=(l+r-s.l-s.r)/2,cy=(t+bottom-s.t-s.b-16)/2,hx=T.MathUtils.clamp(cx,a.r-(s.r-m),Math.max(a.r-(s.r-m),a.l-(s.l+m))),hy=T.MathUtils.clamp(cy,a.b-(s.b-m),Math.max(a.b-(s.b-m),a.t-(s.t+m)));
 const out=a.l<s.l||a.r>s.r||a.t<s.t||a.b>s.b,kk=out?Math.min(1,dt*6):k;   // hero slipping out: correct fast
 const ex=hx/ppm,ey=hy/ppm;frameOffset.x+=sz*ex*kk;frameOffset.z-=sx*ex*kk;frameOffset.y-=ey*kk/Math.max(.4,Math.cos(armPitch||.45));frameOffset.y=T.MathUtils.clamp(frameOffset.y,-1.2,1.2);if(frameOffset.length()>4.5)frameOffset.setLength(4.5);
 const wide=(r-l)/(s.r-s.l),fit=Math.max(wide,(bottom-t)/(s.b-s.t-16))/.82;frameDist=T.MathUtils.clamp(frameDist+(fit-1)*(armLength||11)*Math.min(1,dt*1.5),0,port?5:8);
 // The guardian's body between lens and hero (screen overlap and nearer): turn so the hero stands between lens and guardian.
 const c=subject.getCenter(tmpA),hidden=a.r>b.l&&a.l<b.r&&a.b>b.t&&a.t<b.b&&camera.position.distanceTo(c)<camera.position.distanceTo(pos);
 // Never auto-turn while the touch stick is held (screen-relative steering would swim); ease back in over ~1 s after release.
 const nowS=performance.now()/1000;if(movement?.stickHeld)stickReleasedAt=nowS;const yawK=Math.max(0,Math.min(1,(nowS-stickReleasedAt-1)/1));
 // The well: the lens sits inside it, on the guardian's side of the hero but ~55 deg round the ring, looking out at the hero
 // against the wall with the guardian beside them (never behind the guardian, never out in the trunk wall or under a ledge).
 if(!state.gentle&&yawK>0&&nowS-lastCameraInput>2.5){const inward=Math.atan2(c.x-pos.x,c.z-pos.z),d=a1=>Math.atan2(Math.sin(a1-cameraYaw),Math.cos(a1-cameraYaw));
  const near=Math.hypot(c.x-pos.x,c.z-pos.z)<4.5,off=hidden||near?Math.PI-.5:.95,w1=inward+off,w2=inward-off,want=Math.abs(d(w1))<Math.abs(d(w2))?w1:w2,err=d(want);   /* close to the guardian (catching its breath): swing behind the hero so the body is beyond, not between */
  if(Math.abs(err)>.2||hidden){const rate=(hidden?.8:.5)*dt*yawK*Math.min(1,Math.abs(err)*1.5+.2);cameraYaw+=T.MathUtils.clamp(err,-rate,rate);}}
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
// The mills' hubs (sail centres) from the world's branch anchors.
function millHubs(){const P=world.points;return ['sails','pipes','ladders'].map(k=>P[k]?.mill).filter(Boolean).map(v=>new T.Vector3(v.x,v.y,v.z));}
// Push a scripted lens out of the trunk and above the ground (never inside/under geometry).
function guardLens(v){for(let i=0;i<24&&(inTrunk(v.x,v.z,v.y)||v.y<viewGround(v.x,v.z)+1.4);i++){v.y+=.8;}return v;}
// Start a camera beat framing `look` from `dist` away on the hero's side (or from `from`), `dur` seconds.
// Start a camera beat framing `look` from `dist` away on the hero's side (or from `from`), `dur` seconds.
// Story beats (normal/side given): search a few angles around the preferred view for a clear line to the subject,
// fade small props in front of it (look focus), and hold at least `hold` seconds before any skip.
function beatClear(look,pos){armLow=look.y-2;gatherArmCols(look,look.distanceTo(pos)+2);const d=tmpB.copy(pos).sub(look),L=d.length();d.multiplyScalar(1/L);
 for(let t=1.6;t<L;t+=.5)if(solidAt(look.x+d.x*t,look.z+d.z*t,look.y+d.y*t,.2))return false;return !barkBetween(look,pos);}
function barkBetween(a,b){barkCut(a,0,1,0,0);if(!barkMeshes?.length)return false;tmpA.copy(b).sub(a);const L=tmpA.length();barkRay.set(a,tmpA.multiplyScalar(1/L));barkRay.near=1;barkRay.far=L;return barkRay.intersectObjects(barkMeshes,false).length>0;}
function startBeat(look,{dur=2.6,dist=16,up=5,from=null,kind='',normal=null,hold=.8,subject=null}={}){if(!look||introActive)return;const p=movement.position;
 let pos=from?from.clone():new T.Vector3(p.x-look.x,0,p.z-look.z).normalize().multiplyScalar(dist).add(look).setY(look.y+up);
 if(normal){// face the mechanism (the side of `normal` nearer the hero), then try angles/heights around it
  const n=new T.Vector3(normal.x,0,normal.z).normalize();if(n.dot(tmpA.set(p.x-look.x,0,p.z-look.z))<0)n.negate();const base=Math.atan2(n.x,n.z);let best=null;
  search:for(const da of [0,.3,-.3,.6,-.6,.9,-.9])for(const u of [up,up+2.5,up-1.5]){const c=new T.Vector3(look.x+Math.sin(base+da)*dist,look.y+u,look.z+Math.cos(base+da)*dist);guardLens(c);if(beatClear(look,c)){best=c;break search;}}
  if(best)pos=best;else pos=new T.Vector3(look.x+n.x*dist,look.y+up,look.z+n.z*dist);}
 if(kind==='hint'){// hints: over the hero's shoulder toward the target, so the hero stays in the frame
  const d=tmpA.set(p.x-look.x,0,p.z-look.z);const L=Math.max(.001,d.length());d.multiplyScalar(1/L);pos=new T.Vector3(p.x+d.x*5,p.y+4.2,p.z+d.z*5);}
 guardLens(pos);
 // Never jam a beat into a porch or wall (phone portrait showed this): rise, then pull toward the subject; else skip it.
 const ok=c=>beatClear(look,c)&&!solidAt(c.x,c.z,c.y,.45)&&!tallCols.some(k=>colHit(k,c.x,c.z,c.y,.45))&&(kind==='mill'||kind==='cap'||kind==='bridge'||beatClear(tmpB.set(p.x,p.y+1.4,p.z).clone(),c));
 let good=ok(pos)?pos:null;
 for(const up2 of [2,4,6])if(!good){const c=pos.clone();c.y+=up2;guardLens(c);if(ok(c))good=c;}
 for(const f of [.25,.45])if(!good){const c=pos.clone().lerp(look,f);c.y+=2;guardLens(c);if(ok(c))good=c;}
 // Last resort: high on the hero's side of the subject (both usually visible) before giving the beat up.
 for(const up2 of [5,8])if(!good){const c=new T.Vector3(p.x-look.x,0,p.z-look.z).normalize().multiplyScalar(Math.min(dist,9)).add(look);c.y=Math.max(look.y,p.y)+up2;guardLens(c);if(beatClear(look,c)&&!solidAt(c.x,c.z,c.y,.45))good=c;}
 if(!good)return;pos=good;
 // Never a beat lens right on top of the hero or in bark (the narrow Hollow gallery showed both): skip it instead.
 if(pos.distanceTo(p)<3||inTrunk(pos.x,pos.z,pos.y)||barkBetween(tmpB.set(p.x,p.y+1.4,p.z).clone(),pos))return;
 beat={t:0,dur:state.gentle?dur+.6:dur,pos,look:look.clone(),kind,hold:Math.min(hold,dur-.6),subject:subject?subject.clone():null,from:p.clone()};}
function skipBeat(){if(beat&&beat.t>=beat.hold&&beat.t<beat.dur-.6)beat.t=beat.dur-.6;}
// A held arrow (key repeat) is steering, not a skip: only a fresh press skips, and never before the beat's hold.
addEventListener('keydown',e=>{if(revealT>=1.5&&revealT<3.2&&!e.repeat&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyA'].includes(e.code))revealT=3.2;if(beat&&!e.repeat&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyA'].includes(e.code))skipBeat();},{capture:true});
// Mechanism framing helpers: a windmill's sail disc faces along its rotor's spin axis (local +z).
function rotorNormal(hub){let best=null,bd=4;world.root.traverse(o=>{if(/^bh-rotor/.test(o.name)){const w=o.getWorldPosition(new T.Vector3()),d=w.distanceTo(hub);if(d<bd){bd=d;best=o;}}});return best?best.getWorldDirection(new T.Vector3()):null;}
const V3=v=>v?new T.Vector3(v.x,v.y,v.z):null;
// Story payoffs (progress flips false -> true): frame the mechanism, not the hero.
let lastProgress=null;
function storyBeats(){const P=world.points,pr=quest.progress,was=lastProgress;lastProgress={...pr};if(!was)return;const port=camera.aspect<.85,on=k=>pr[k]&&!was[k];
 if(on('bell')&&P.morningBellObject){const b=V3(P.morningBellObject);startBeat(b,{dist:port?9:7.5,up:1.2,dur:2.8,kind:'bell',normal:tmpA.set(movement.position.x-b.x,0,movement.position.z-b.z).clone(),hold:1.4,subject:b.clone().setY(b.y-1.2)});}
 if(on('sailsBridge')&&P.sails?.bridgeFrom){const a=V3(P.sails.bridgeFrom),c=V3(P.sails.bridgeTo),m=a.clone().add(c).multiplyScalar(.5),d=c.clone().sub(a);startBeat(m,{dist:port?15:12,up:4,dur:3,kind:'bridge',normal:new T.Vector3(-d.z,0,d.x),hold:1.6,subject:m.clone().setY(m.y-.8)});}
 if(on('sailsCap')&&P.sails?.mill){const h=V3(P.sails.mill);startBeat(h,{dist:port?20:15,up:1.5,dur:3,kind:'cap',normal:rotorNormal(h)||new T.Vector3(.615,0,.788),hold:1.6,subject:h.clone().setY(h.y-2)});}
 // The final ring with Mara: bell and Mara together.
 if(on('complete')&&mara&&P.morningBellObject){const b=V3(P.morningBellObject),m=mara.position.clone().setY(mara.position.y+1.3),mid=b.clone().add(m).multiplyScalar(.5);startBeat(mid,{dist:port?10:8,up:1.6,dur:3.4,kind:'bell',normal:tmpA.set(-(movement.position.z-mid.z),0,movement.position.x-mid.x).clone(),hold:1.6,subject:mara.position.clone()});}   // from the side: the hero is not in front of the lens
 if(on('fragSail')&&P.fragment2){const f=V3(P.fragment2);startBeat(f,{dist:9,up:4,dur:2.6,kind:'hint',normal:tmpA.set(movement.position.x-f.x,0,movement.position.z-f.z).clone(),hold:1.8,subject:f});}}
$('#stick').addEventListener('pointerdown',()=>{skipBeat();if(revealT>=1.5&&revealT<3.2)revealT=3.2;},{capture:true});
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
  movement.update(dt,{enabled:state.started&&!cinematic&&!(revealT>=0&&revealT<REVEAL_END),actionSlow:!!state.action,faceTarget:state.action?state.actionTarget:null});
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
  $('#skipIntro').hidden=!(introActive||quest.finaleActive);$('#skipIntro').textContent=quest.finaleActive?'Skip':'Skip · or move to begin';document.body.classList.toggle('cinematic',introActive||quest.finaleActive);document.body.classList.toggle('finale-cine',!!quest.finaleActive);
  if(state.complete&&endingAt&&state.t>=endingAt){endingAt=0;$('#ending').hidden=false;{const q=quest.telemetry();$('#endingDetail').textContent='Mara: “Hear that? The far bell answered. You kept the wind, Bellkeeper.”'+(q.keepsake?' The little keeper’s bell rang the whole return phrase.':q.fragments>0?` ${q.fragments}/3 bell fragments found.`:'');}}
  if(state.t>captionEnd)$('#caption').style.opacity='0';
 }
 // ---- camera ----
 {const nowS=performance.now()/1000;if(movement.stickHeld)stickReleasedAt=nowS;
  openSpaceSwing(dt,nowS,state.started&&!state.paused&&!introActive&&!quest.finaleActive&&!beat&&!(arrival>0)&&!cameraDrag&&!encounterSubject()&&nowS-lastCameraInput>((armLength??11)<4?.8:2.5)&&nowS-stickReleasedAt>1);}   // pinned against a tower: swing sooner
 // ---- Guardian reveal: hidden until the hero first reaches the well floor; then ~4.6 s (skippable after 1.5 s):
 // input frozen, camera low behind the hero, the guardian lowered from high in the trunk, a heavy landing, then the fight.
 {const G=quest.guardian,R=world.points.guardianWell?.rings;
  if(G?.setReveal&&R){const pending=quest.progress.hollow&&!quest.progress.guardian&&!revealDone&&(G.phase|0)===0;
   if(!pending){if(revealT>=0||revealWasSet){G.setReveal({held:false,hidden:false,off:0});revealWasSet=false;}revealT=-1;}
   else if(revealT<0){G.setReveal({held:true,hidden:true,off:REVEAL_H});revealWasSet=true;const p=movement.position;
    if(movement.grounded&&p.y<R.low.y+1.2&&Math.hypot(p.x,p.z)<Math.hypot(R.low.safe.x,R.low.safe.z)+2.5){revealT=0;revealLanded=false;fightYaw=null;revealCut=true;galK=0;armPitch=armLength=null;{const c0=G.object.position;movement.reset([R.low.safe.x,R.low.safe.y,R.low.safe.z]);movement.yaw=Math.atan2(c0.x-R.low.safe.x,c0.z-R.low.safe.z);}   /* always from the clear arena entry, facing the guardian (nothing between lens and guardian) */
     const c=G.object.position;movement.yaw=Math.atan2(c.x-p.x,c.z-p.z);bossAudio.event?.('rage',{d:1.6});}}
   else{revealT+=dt;const t=revealT,e=v=>{v=Math.max(0,Math.min(1,v));return 1-Math.pow(1-v,3);};
    const off=t<.8?REVEAL_H:t<3.2?REVEAL_H*(1-e((t-.8)/2.4)):t<3.7?-.35*Math.sin(Math.PI*(t-3.2)/.5):0;
    if(t>=3.2&&!revealLanded){revealLanded=true;bossAudio.event?.('wall');bossAudio.event?.('phase',{phase:1});sound('knock');kick=1;kickDir.set(0,-1,0);}
    G.setReveal({held:true,hidden:t<.8,off});
    if(t>=REVEAL_END){G.setReveal({held:false,hidden:false,off:0});revealDone=true;revealT=-1;try{localStorage.setItem('bellkeeper-guardian-seen','1');}catch{}}}}}
 const pos=movement.position,portrait=camera.aspect<.85;let sx=Math.sin(cameraYaw),sz=Math.cos(cameraYaw),pitch=Math.atan(.48),length=portrait?11.5:10.8;
 liftLead=T.MathUtils.damp(liftLead,movement.lifting?1:0,movement.lifting?3:1.5,dt);// rise with the hero and show the ledge above
 frameSubject(null,pos,dt);   /* the fight has its own camera below (behind the hero, facing the guardian) */
 const ahead=.8;let focus=tmpA.set(pos.x-sx*ahead,pos.y+1+liftLead*1.3,pos.z-sz*ahead).add(frameOffset),follow=7;
 pitch-=liftLead*.07;length+=liftLead*2.6+frameDist;
 // Hollow gallery (ring walkways round the open well, trunk centred on the origin), outside the fight: keep the lens
 // over the void, looking out at the hero and a little along the walk. A slow eased turn, allowed even while the phone
 // stick is held (it only drifts ~0.6 rad/s, so steering does not swim); paused after manual Q/E or drag.
 // Hollow gallery (outer ring walkway round the open well, trunk centred on the origin), outside the fight: the lens is
 // LOCKED to the open-void side of the hero with a small lead along the walk, at a steady arm. Q/E/drag may nudge it
 // up to ~30 deg; it springs back. Phone and desktop alike, stick held or not.
 {const inG=!introActive&&!quest.finaleActive&&!beat&&inGallery(pos);galK=T.MathUtils.damp(galK,inG?1:0,2.5,dt);
  if(inG&&Math.hypot(pos.x,pos.z)>1.5){const r=Math.hypot(pos.x,pos.z),ix=-pos.x/r,iz=-pos.z/r,tx=-iz,tz=ix,fy=movement.yaw,ft=Math.sin(fy)*tx+Math.cos(fy)*tz;
   if(Math.abs(ft)>.3)galSgn=Math.sign(ft);const want=Math.atan2(ix-galSgn*tx*.12,iz-galSgn*tz*.12);   /* almost straight across the well: no swing when the walk reverses */
   if(galYaw===null){galYaw=want;galSet=want;galNudge=0;}   /* entering: cut straight to the open side, never swing round through the wall */
   const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),nowS=performance.now()/1000;
   galNudge=T.MathUtils.clamp(galNudge+wrap(cameraYaw-galSet),-.52,.52);if(nowS-lastCameraInput>1.2&&!cameraDrag)galNudge*=Math.exp(-dt*1.5);
   galYaw+=T.MathUtils.clamp(wrap(want-galYaw),-1.4*dt,1.4*dt);cameraYaw=galYaw+galNudge;galSet=cameraYaw;sx=Math.sin(cameraYaw);sz=Math.cos(cameraYaw);}
  else galYaw=null;
  if(galK>.01){pitch=T.MathUtils.lerp(pitch,.6,galK);length=T.MathUtils.lerp(length,Math.min(length+1.5,(Math.hypot(pos.x,pos.z)+6.5)/Math.cos(.6)),galK);}}   /* lower down the well is narrow: never reach across it into the far wall */   /* a slightly wider, higher view for the whole descent */
 // Guardian fight: close behind the hero on the line from the guardian through the hero (a little to one side), low,
 // always looking toward the guardian so the hero is in the foreground and the boss towers over him. The yaw only
 // tracks the hero round the well (smooth, no swings to other sides); walls are handled by the arm and the feelers.
 // The reveal uses the same rig, lower and closer, looking up at the guardian coming down.
 const fightG=encounterSubject();encK=T.MathUtils.damp(encK,fightG?1:0,1.5,dt);
 if(fightG&&!introActive&&!quest.finaleActive){const gc=fightG.getCenter(tmpB).clone(),dx=pos.x-gc.x,dz=pos.z-gc.z,rr=Math.hypot(dx,dz)||1,
   rv=revealT>=0&&revealT<REVEAL_END,want=Math.atan2(dx,dz)+(portrait?(rv?.14:.1):(rv?.35:.28)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),nowS=performance.now()/1000;
  if(fightYaw===null)fightYaw=revealCut?want:cameraYaw;if(revealCut){revealCut=false;cameraTarget.set(pos.x,pos.y+1.4,pos.z);}   /* the reveal starts on a clean cut, not a swing through the wall */fightNudge=T.MathUtils.clamp(fightNudge+wrap(cameraYaw-fightSet),-.45,.45);if(nowS-lastCameraInput>1.2&&!cameraDrag)fightNudge*=Math.exp(-dt*1.2);
  const yr=rv?Math.min(2.4,.6+revealT*1.6):1.6;fightYaw+=T.MathUtils.clamp(wrap(want-fightYaw),-yr*dt,yr*dt);   /* the reveal swings round from the open-side view, eased in */cameraYaw=fightYaw+fightNudge;fightSet=cameraYaw;sx=Math.sin(cameraYaw);sz=Math.cos(cameraYaw);
  // look from the hero's head a third of the way toward the guardian's heart (up at it on the floor, down from the perch)
  // the arm orbits the hero's head; the lens then turns toward the guardian's heart (fightAim) without losing the hero
  const fk=encK,heart=gc.clone().setY(rv?(world.points.guardianWell.rings.low.y+3.8):fightG.min.y+(fightG.max.y-fightG.min.y)*.55);   /* reveal: aim where it will land, not at the lifted body */focus=tmpA.lerpVectors(tmpA.set(pos.x-sx*ahead,pos.y+1+liftLead*1.3,pos.z-sz*ahead),new T.Vector3(pos.x,pos.y+1.4+liftLead*1.3,pos.z),fk);
  const close=T.MathUtils.clamp(5.5-rr,0,3.5),camD=rr+(rv?(portrait?5:4.2):6.5)+close*.8;heart.y=Math.min(heart.y,pos.y+1.5+Math.tan(.42)*camD);fightAim.copy(heart);   /* never look up past ~24 deg: no sky, no view up the skirt */fightAimK=fk*(rv?.36:.3*(1-close/5));
  pitch=T.MathUtils.lerp(pitch,rv?.12:(portrait?.36:.3)+liftLead*.1+close*.07,fk);length=T.MathUtils.lerp(length,rv?(portrait?5:4.2):(portrait?6.2:6.5)+liftLead*2+close*.8,fk);   /* right under the guardian: pull back and up a little so the hero stays in frame */skipGuardianBox=true;}
 else{fightYaw=null;fightNudge=0;skipGuardianBox=false;fightAimK=0;}
 const shot=introShot();
 if(shot&&!state.gentle){const s=shot.shot,q=s.focus==='hero'?pos:world.points[s.focus]||pos;focus=tmpA.set(q.x,q.y+s.up,q.z);sx=Math.sin(cameraYaw+s.yaw+shot.e*.012);sz=Math.cos(cameraYaw+s.yaw+shot.e*.012);pitch=s.pitch;length=s.len;follow=1.6;}
 else if(introActive){focus=tmpA.set(pos.x,pos.y+1,pos.z);}
 const rise=world.points.finaleRise,ft=quest.finaleTime??-1,ease=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
 // Finale A (0-2.3 s, the resonance): low and looking up the well as the wind gathers; then cut outside at the flood.
 if(quest.finaleActive&&rise&&ft<2.3){const f=ease(ft/2.3);focus=tmpA.set(pos.x,pos.y+1.4+f*3,pos.z);pitch=.36-f*.26;length=(portrait?10.5:9);follow=2.2;}
 if(quest.finaleActive&&!rise){const f=quest.finaleShot,g=world.points.finale||world.points.guardian,e=f*f*(3-2*f);focus=tmpA.set(g.x,g.y+e*14,g.z);pitch=.3+e*.25;length=12+e*16;follow=1.4;}
 cameraTarget.lerp(focus,1-Math.exp(-dt*follow));placeCamera(dt,sx,sz,pitch,length);
 if(armLength&&armLength<length*.6){frameOffset.multiplyScalar(Math.exp(-dt*3));frameDist=T.MathUtils.damp(frameDist,0,3,dt);}   /* pulled in hard: stop panning away from the hero */
 if(quest.finaleActive&&rise&&ft>=2.3){
  // Finale, shot B/C (after a cut): outside the trunk on the Hollow's open side, rising over the waking village
  // toward the mills, then turning to the far bell. Every frame is guarded against the trunk and the ground.
  // Swing round the south (terrace) side so no look ever crosses the trunk: Ladders mill + village, then the
  // western mills over the terrace, then the far bell from the south-west (its sight line clears the trunk).
  if(!crane){const P=world.points,far=P.farBell||rise.lookAt,top=P.hollowGate?.y??4,az=(a,r,y)=>new T.Vector3(Math.sin(a*Math.PI/180)*r,y,Math.cos(a*Math.PI/180)*r);
   const hub=k=>P[k]?.mill?new T.Vector3(P[k].mill.x,P[k].mill.y,P[k].mill.z):null,west=[hub('sails'),hub('pipes')].filter(Boolean);
   crane={pos:new T.CatmullRomCurve3([az(40,32,top+12),az(0,38,top+16),az(-60,50,top+18),az(-135,50,top+16)]),   // gentle pitch: the far bell is framed across the valley, never a top-down void
    looks:[hub('ladders')||az(28,20,top+10),(west.length?west.reduce((a,v)=>a.add(v),new T.Vector3()).multiplyScalar(1/west.length):az(-100,38,top+8)).add(new T.Vector3(0,9,0)),new T.Vector3().copy(far)]};
   scriptCam.copy(crane.pos.getPoint(0));finaleLook.copy(crane.looks[0]);}
  const e=ease((ft-2.3)/9.7);crane.pos.getPoint(e,finaleCam);guardLens(finaleCam);
  const L=crane.looks;if(ft<6.5)tmpB.copy(L[0]);else if(ft<8.3)tmpB.lerpVectors(L[0],L[1],ease((ft-6.5)/1.8));else tmpB.lerpVectors(L[1],L[2],ease((ft-8.3)/1.4));   // on the far bell before it answers (9.4 s)
  const k=1-Math.exp(-dt*3);scriptCam.lerp(finaleCam,k);camera.position.copy(scriptCam);finaleLook.lerp(tmpB,k);camera.lookAt(finaleLook);
 }else{crane=null;finaleLook.copy(camera.position).lerp(cameraTarget,1);
  const tv=world.points.terraceView;
  if(arrival>0&&tv){// Back on the terrace: ease from the painted terrace view into the normal follow arm.
   arrival=Math.max(0,arrival-dt);const k=ease(1-arrival/2.6);camera.position.lerpVectors(tv.pos,tmpB.copy(camera.position),k);camera.lookAt(tmpA.lerpVectors(tv.target,cameraTarget,k));
  }else camera.lookAt(fightAimK>.01?tmpB.copy(cameraTarget).lerp(fightAim,fightAimK):cameraTarget);}
 // Portrait phones: the stick and action button cover the lower screen, so shift the frame to put the hero higher.
 {const want=camera.aspect<.85&&state.started&&!introActive&&!quest.finaleActive&&!beat?.14:0;viewShift=T.MathUtils.damp(viewShift,want,3,dt);
  if(Math.abs(viewShift-appliedShift)>.002||(!viewShift&&appliedShift)){appliedShift=viewShift<.003?0:viewShift;if(appliedShift)camera.setViewOffset(innerWidth,innerHeight,0,appliedShift*innerHeight,innerWidth,innerHeight);else camera.clearViewOffset();}}
 // Short camera beats (mill payoffs, loft vista, Mara's handover): ease out of the arm, hold, ease back. Any input skips.
 if(beat&&!introActive&&!quest.finaleActive){beat.t+=dt;if(beat.from&&beat.kind!=='mill'&&beat.from.distanceTo(movement.position)>1.2)beat.t=Math.max(beat.t,beat.dur-.6);/* the hero walked off: hand the camera back */const inT=state.gentle?.9:.6,e=ease(Math.min(beat.t/inT,(beat.dur-beat.t)/inT,1));
  if(beat.t>=beat.dur)beat=null;else{tmpB.copy(camera.position);camera.position.lerpVectors(tmpB,beat.pos,e);camera.lookAt(tmpA.lerpVectors(cameraTarget,beat.look,e));}}
 // World-anchored intro shots (real world): cut between painted views rather than panning the arm.
 const ic=introActive&&!state.gentle?introCamera(shot):null;
 if(ic){if(introCut!==shot.index){introCut=shot.index;scriptCam.copy(ic.pos);finaleLook.copy(ic.look);}const k=1-Math.exp(-dt*1.2);scriptCam.lerp(ic.pos,k);camera.position.copy(scriptCam);finaleLook.lerp(ic.look,k);camera.lookAt(finaleLook);}
 if(kick>.002){kick*=Math.exp(-dt*9);camera.position.addScaledVector(kickDir,kick*.32*Math.sin(performance.now()/1000*48));}
 sun.position.set(cameraTarget.x-9,cameraTarget.y+20,cameraTarget.z+8);sun.target.position.copy(cameraTarget);camera.updateMatrixWorld(true);
 if(state.started&&(hudTimer-=dt)<=0){hudTimer=.15;safe=hudSafe();updateChart(pos);const hy=tmpA.set(pos.x,pos.y+1.2,pos.z).project(camera).y;document.body.classList.toggle('caption-high',hy<-.3);}
 wind.flush();
 const area=quest.area(pos);
 if(look){try{look.setFocus?.({hero:hero.position,heroObject:hero,extra:[...(beat?.subject?[beat.subject]:[]),...(mara?[mara.position]:[])]});look.update(dt,{area:LOOK_AREAS[area]||'terrace-dawn',restored:quest.restoration.village||0,t:state.t,gentle:state.gentle});look.render();}catch(e){console.warn('look failed; plain renderer from now on',e);look=null;renderer.render(scene,camera);}}else renderer.render(scene,camera);
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
 movement=createMovement(T,{start:start3,sampleGround:(x,z,y)=>world.ground(x,z,y),blocked:(x,z,r,y)=>world.blocked(x,z,r,y)||npcBlocked(x,z,r,y),stickElement:$('#stick'),jumpButton:$('#jump'),runButton:$('#run'),walkSpeed:1.65,runSpeed:5.8,acceleration:12,deceleration:16,turnResponse:12,cameraYaw:()=>cameraYaw,maxDrop:14});
 animator=createAdventureMotion(character,movement);hero.position.copy(movement.position);
 wind=createWind({THREE:T,scene,movement,sound,fx:()=>look?.fx?.wind});
 look=loaded[5];
 quest=createQuest({THREE:T,scene,world,wind,movement,caption,sound,onChange:questEvent,...(createGuardian?{createGuardian:o=>createGuardian({...o,look,audio:bossAudio})}:{})});if(look){for(const [o,role,opts] of [[hero,'character'],[mara,'character'],[quest.guardian?.object,'outline',{dynamic:true,occluder:false}],[pairedBells,'outline',{dynamic:true}]])try{if(o)look.applyTo(o,role,opts);}catch(e){console.warn(e);}
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
  return {cam:camera.position.toArray().map(v=>+v.toFixed(2)),clear:floor===-Infinity?99:+(camera.position.y-floor).toFixed(2),pitch:+armPitch.toFixed(3),arm:+armLength.toFixed(2),frameDist:+frameDist.toFixed(2),head:[+((head.x+1)/2*innerWidth).toFixed(1),+((1-head.y)/2*innerHeight).toFixed(1)],headInView:Math.abs(head.x)<.97&&Math.abs(head.y)<.97&&head.z<1,unobstructed:!blockers.length,blockers:blockers.slice(0,4),hero:screenBox(heroBox),guardian:g?screenBox(g):null,subject:g?'guardian':null,chartTucked:document.body.classList.contains('chart-tucked'),safe,insideTrunk:inTrunk(camera.position.x,camera.position.z,camera.position.y),insideSolid:(()=>{const v=camera.position;for(const c of world.ground_model?.colliders||[])if((c.enabled===undefined||c.enabled===true||typeof c.enabled==='function'&&c.enabled())&&['seg','circle','box'].includes(c.type)&&colHit(c,v.x,v.z,v.y,.1))return c.id||c.type;return inTrunk(v.x,v.z,v.y)?'trunk':false;})(),seen:window.__LOOK__?.focusProbe?.()||null,clutter:+closeClutter(cameraYaw,armPitch,armLength).toFixed(2),swing:swingGoal,yaw:+cameraYaw.toFixed(2),bigBoxes:bigBoxes?.length??0,hitBy:(armHitId=null,armHit(armOrigin,Math.sin(cameraYaw),Math.cos(cameraYaw),Math.atan(.48),10.8)&&armHitId)};};
 // Lazy-load the prologue illustrations once the game is ready (not counted against start-up).
 (window.requestIdleCallback||setTimeout)(()=>{for(const n of [1,2,3]){const i=new Image();i.src=new URL(`./textures/v2/card${n}.webp`,import.meta.url).href;}});
 // After ready (never blocking it): villagers, then the chart bake from the live scene.
 const afterReady=(world.stub?Promise.resolve(null):import('./bellhollow/villagers.js')).then(m=>{if(m)villagers=m.createVillagers({THREE:T,scene,world,look});}).catch(e=>console.warn('villagers unavailable',e));
 afterReady.then(()=>requestAnimationFrame(()=>{try{map=createMap({THREE:T,renderer,scene,world,canvas:mapCanvas,look,hide:[hero,mara,staff,pairedBells,quest.guardian?.object,villagers?.root].filter(Boolean)});requestAnimationFrame(()=>{try{map.bake();}catch(e){console.warn('map bake failed',e);}});}catch(e){console.warn('map unavailable',e);map=null;}}));
 $('#startb').disabled=false;$('#startb').textContent=loadedSave?'Start a new adventure':'Start adventure';$('#continueb').hidden=!loadedSave;updateUI();window.__START__=()=>start(true);
}catch(e){console.error(e);$('#error').hidden=false;$('#error').textContent='Bellhollow could not load. '+e.message;}
requestAnimationFrame(frame);
