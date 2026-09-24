import * as T from 'three';
import {ASSET} from './assetlib.js';
import {createSoundscape} from './audio.js';
import {createMovement} from './movement.js';
import {loadCodeCharacter} from './code-character.js';
import buildApprovedHero from './assets/hero-study-a.js';
import {createAdventureMotion} from './adventure-motion.js';
import {createArtDirection} from './art-direction.js';
import {readSave,writeSave,hasLegacySave,clearSave} from './adventure-save.js';
import {createOpening} from './opening.js';
import {createTitleMusic} from './title-music.js';
import {createWind} from './bellhollow/wind.js';
import {createQuest} from './bellhollow/quest.js';
import {buildBellhollow as buildStubWorld} from './bellhollow/stub-world.js';
import {MODULES} from './bellhollow/manifest.js';
// v2 host: renderer, camera spring arm + framing, HUD, opening, audio, saves. Bellhollow's world,
// wind verbs and progression live in game/bellhollow/*; the look in game/render/look.js.
const params=new URLSearchParams(location.search);
const opening=createOpening(),titleMusic=createTitleMusic();let musicUnlocked=false;
const $=s=>document.querySelector(s),canvas=$('#world');
const mapCanvas=$('#map'),mapCtx=mapCanvas?.getContext('2d');
const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new T.Scene();scene.background=new T.Color('#bfe1ea');scene.fog=new T.FogExp2('#d9dccb',.016);
const camera=new T.PerspectiveCamera(42,1,.1,160);const hemi=new T.HemisphereLight(0xffefcd,0x2c4a45,1.8);scene.add(hemi);
const sun=new T.DirectionalLight(0xffe1ae,2.4);sun.position.set(-9,20,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:.5,far:70});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
const state={started:false,paused:false,t:0,complete:false,action:null,actionTime:0,actionTarget:null,actionCallback:null,muted:localStorage.getItem('bellkeeper-muted')==='1',gentle:localStorage.getItem('bellkeeper-gentle')==='1'};
const DEFAULT_YAW=Math.atan2(.615,.788);let cameraYaw=DEFAULT_YAW,cameraDrag=null;
let hero,movement,animator,world,wind,quest,look=null,staff,staffHand,mara,captionEnd=0,context=null,travel=0,fps=60,start3=[0,0,0];
let saveTimer=0,introTime=0,introActive=false,lastShot=-1,queued=null,uiTimer=0,endingAt=0,liftLead=0;
let captionsEnabled=localStorage.getItem('bellkeeper-captions')!=='0';
// Camera spring arm, subject framing and chart tucking state (see frame()).
let armPitch=null,armLength=null,frameDist=0,lastCameraInput=-9,chartTuck=false,chartOverride=false,hudTimer=0,safe=null;const frameOffset=new T.Vector3(),armOrigin=new T.Vector3(),heroBox=new T.Box3(),ndc=new T.Vector3(),tmpA=new T.Vector3(),tmpB=new T.Vector3();
const loadedSave=readSave(),legacy=!loadedSave&&hasLegacySave();
const CARD=7,CARDS=3*CARD,ENGINE=20;// prologue cards, then the 20 s in-engine intro
function save(){if(!state.started||introActive||!quest||quest.finaleActive||!movement)return;const c=movement.checkpoint;writeSave({quest,checkpoint:[c.x,c.y,c.z]});}
const art=createArtDirection(T,renderer);
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
function continueGame(){const d=readSave();if(!d)return;quest.restore(d.quest);movement.reset(d.checkpoint);animator.reset();start(true);snapCamera();state.complete=quest.progress.complete;caption(quest.progress.complete?'Bellhollow is breathing. Wander as long as you like.':'Bellhollow remembers where you left it.',4);}
function pause(on){if(!state.started)return;state.paused=on;soundscape.setPaused(on);titleMusic.setPaused(on);$('#pausePanel').hidden=!on;$('#resume').textContent='Resume';$('#reset').hidden=false;mapCanvas.hidden=on;$('#mapToggle').hidden=on;if(on){save();mapCanvas.classList.remove('expanded');$('#mapToggle').setAttribute('aria-expanded','false');chartUI();}}
function beginAction(kind,target,callback){state.action=kind;state.actionTime=0;state.actionTarget=(target||movement.position).clone();state.actionCallback=callback;if(kind==='pull')sound('chime');}
function staffTip(){if(!staff?.visible)return movement.position.clone().setY(movement.position.y+1.5);return staff.localToWorld(tmpB.set(0,1.15,0)).clone();}
function action(){if(!state.started||state.paused||state.action||introActive||quest?.finaleActive)return;
 if(!context){caption(quest.hint(),4);return;}
 const c={...context};
 if(!c.anim){quest.interact(c,{position:movement.position,yaw:movement.yaw,staffTip:staffTip()});updateUI();save();return;}
 beginAction(c.anim,c.target,()=>{quest.interact(c,{position:movement.position,yaw:movement.yaw,staffTip:staffTip()});updateUI();save();});}
// Quest events: checkpoints, knock-backs, finale, teleport and completion.
function questEvent(_progress,e={}){
 if(e.knock)movement.knockback(e.knock);
 if(e.teleport){movement.reset(e.teleport);animator?.reset();snapCamera();}
 if(e.complete){state.complete=true;endingAt=state.t+7;later(1.6,'',0,()=>sound('chime'));}
 if(e.restored)sound('restore');
 updateUI();if(e.checkpoint||e.restored||e.complete)save();}
$('#storyNext').onclick=()=>{if(introActive&&introTime<CARDS)introTime=Math.min(CARDS,(Math.floor(introTime/CARD)+1)*CARD);};
$('#startb').onclick=()=>{if(loadedSave)clearSave();start();};$('#continueb').onclick=continueGame;$('#skipIntro').onclick=endIntro;$('#action').onclick=action;$('#pause').onclick=()=>pause(true);$('#resume').onclick=()=>pause(false);$('#keepExploring').onclick=()=>$('#ending').hidden=true;
$('#creditsb').onclick=()=>$('#creditsPanel').hidden=false;$('#closeCredits').onclick=()=>$('#creditsPanel').hidden=true;
$('#settingsb').onclick=()=>{$('#pausePanel').hidden=false;$('#resume').textContent='Back';$('#reset').hidden=true;};
$('#resume').onclick=()=>{if(state.started)pause(false);else $('#pausePanel').hidden=true;};
$('#subtitles').onclick=()=>{captionsEnabled=!captionsEnabled;localStorage.setItem('bellkeeper-captions',captionsEnabled?'1':'0');$('#subtitles').textContent='Captions: '+(captionsEnabled?'on':'off');if(!captionsEnabled)$('#caption').style.opacity='0';};
// Movement is also an explicit skip gesture. Preserve that first input instead
// of making impatient players wait through a shot or tap their joystick twice.
$('#stick').addEventListener('pointerdown',()=>{if(introActive)endIntro();},{capture:true});
addEventListener('keydown',e=>{if(introActive&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyA'].includes(e.code))endIntro();},{capture:true});
$('#audioUnlock').onclick=()=>soundscape.resume().then(()=>{$('#audioUnlock').hidden=true;sound('start');}).catch(()=>{});
for(const id of ['controls','world'])$('#'+id).addEventListener('pointerdown',()=>{if(state.started)soundscape.resume().then(()=>$('#audioUnlock').hidden=true).catch(()=>{});},{passive:true});
$('#sound').onclick=()=>{state.muted=!state.muted;soundscape.setMuted(state.muted);titleMusic.setMuted(state.muted);titleSoundLabel();localStorage.setItem('bellkeeper-muted',state.muted?'1':'0');updateUI();};$('#motion').onclick=()=>{state.gentle=!state.gentle;localStorage.setItem('bellkeeper-gentle',state.gentle?'1':'0');updateUI();};
$('#reset').onclick=()=>{opening.end();titleMusic.fadeOut(1);Object.assign(state,{complete:false,action:null,actionCallback:null});quest.reset();clearSave();queued=null;introActive=false;$('#skipIntro').hidden=true;document.body.classList.remove('cinematic');$('#ending').hidden=true;cameraYaw=DEFAULT_YAW;movement.reset(start3);animator.reset();travel=0;snapCamera();pause(false);updateUI();save();caption('Another morning. The bell is waiting by the path.',4);};
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
function findContext(){const p=movement.position;context=state.action||quest.finaleActive?context:quest.context(p,movement.yaw);
 $('#action').disabled=!context||!!state.action;$('#action').innerHTML=(context?.label||'Look around')+' <span>SPACE</span>';$('#action').dataset.kind=context?.kind||'';}
// Camera-aligned Bellhollow chart: anchors, mills, the Hollow gate and the current objective.
function drawMap(){
 if(!mapCtx||mapCanvas.hidden||document.body.classList.contains('chart-tucked')&&!mapCanvas.classList.contains('expanded'))return;
 const c=mapCtx,W=mapCanvas.width,H=mapCanvas.height,p=movement.position,pts=world.points,s=W/(mapCanvas.classList.contains('expanded')?70:52);
 const rx=Math.cos(cameraYaw),rz=-Math.sin(cameraYaw),fx=-Math.sin(cameraYaw),fz=-Math.cos(cameraYaw);
 const at=q=>{const dx=q.x-p.x,dz=q.z-p.z;return [W/2+(dx*rx+dz*rz)*s,H*.56-(dx*fx+dz*fz)*s];};
 c.setTransform(1,0,0,1,0,0);c.fillStyle='#eee0bb';c.fillRect(0,0,W,H);c.lineWidth=3;
 const dot=(q,r,fill,stroke='#243e37')=>{const [x,y]=at(q);c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.stroke();return [x,y];};
 const label=(q,text,dy=-22)=>{const [x,y]=at(q);c.font='600 20px system-ui';c.textAlign='center';c.fillStyle='#243e37';c.fillText(text,x,y+dy);};
 for(const v of world.vents||[]){const [x,y]=at(v);c.beginPath();c.arc(x,y,(v.radius||1)*s,0,Math.PI*2);c.strokeStyle='#3e9c8c';c.lineWidth=4;c.stroke();}
 const pr=quest.progress;
 for(const [k,name] of [['millSails','Sails'],['millPipes','Pipes'],['millLadders','Ladders']]){const done=pr[{millSails:'sails',millPipes:'pipes',millLadders:'ladders'}[k]];dot(pts[k],13,done?'#e9b949':'#cdbb95');label(pts[k],name);}
 dot(pts.mara,11,'#d96956');label(pts.mara,'Mara');dot(pts.morningBell,10,'#b8733f');dot(pts.hollowGate,13,'#2c4a45');label(pts.hollowGate,'Hollow');
 const goal=quest.objectiveTarget();if(goal){const [x,y]=at(goal),k=.5+.5*Math.sin(state.t*4);c.beginPath();c.arc(Math.max(16,Math.min(W-16,x)),Math.max(16,Math.min(H-16,y)),16+k*6,0,Math.PI*2);c.strokeStyle='#d96956';c.lineWidth=5;c.stroke();}
 const [hx,hy]=[W/2,H*.56],a=Math.atan2(Math.sin(movement.yaw)*rx+Math.cos(movement.yaw)*rz,Math.sin(movement.yaw)*fx+Math.cos(movement.yaw)*fz);
 c.save();c.translate(hx,hy);c.rotate(a);c.beginPath();c.moveTo(0,-18);c.lineTo(12,14);c.lineTo(0,7);c.lineTo(-12,14);c.closePath();c.fillStyle='#d96956';c.fill();c.strokeStyle='#243e37';c.lineWidth=3;c.stroke();c.restore();
}
// While the chart would cover the scene's subject it tucks into a corner button; the player can still open it.
function chartUI(){const expanded=mapCanvas.classList.contains('expanded'),b=$('#mapToggle');document.body.classList.toggle('chart-tucked',chartTuck&&!chartOverride&&!expanded);document.body.classList.toggle('chart-shown',chartTuck&&chartOverride);b.textContent=chartTuck&&!expanded?(chartOverride?'Tuck chart':'Show chart'):expanded?'Close chart':'Enlarge chart';b.setAttribute('aria-expanded',String(expanded||chartTuck&&chartOverride));}
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
function armHit(o,sx,sz,pitch,length){const c=Math.cos(pitch),s=Math.sin(pitch);for(let i=1;i<=10;i++){const d=length*i/10;if(d>2&&o.y+s*d<viewGround(o.x+sx*c*d,o.z+sz*c*d)+.35+.055*i)return d;}return 0;}
function placeCamera(dt,sx,sz,pitch,length){// Test the arm from a point kept above the floor: framing may pan the look target below a descending deck.
 armOrigin.copy(cameraTarget);armOrigin.y=Math.max(armOrigin.y,floorUnder(armOrigin.x,armOrigin.z,armOrigin.y)+.9);let p=pitch,l=length;while(p<1.05&&armHit(armOrigin,sx,sz,p,l))p+=.05;if(p>=1.05){p=1.05;const hit=armHit(armOrigin,sx,sz,p,l);if(hit)l=Math.max(5,hit-.8);}
 armPitch??=p;armLength??=l;armPitch=T.MathUtils.damp(armPitch,p,p>armPitch?12:2.4,dt);armLength=T.MathUtils.damp(armLength,l,l<armLength?12:2,dt);
 const c=Math.cos(armPitch)*armLength;camera.position.set(cameraTarget.x+sx*c,cameraTarget.y+Math.sin(armPitch)*armLength,cameraTarget.z+sz*c);
 let floor=-Infinity;for(const [a,b] of [[0,0],[.6,0],[-.6,0],[0,.6],[0,-.6]])floor=Math.max(floor,floorUnder(camera.position.x+a,camera.position.z+b,camera.position.y));camera.position.y=Math.max(camera.position.y,floor+1.1);}
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
function snapCamera(){if(!movement)return;cameraTarget.copy(movement.position).y+=1;armPitch=armLength=null;frameOffset.set(0,0,0);frameDist=0;}
const cameraTarget=new T.Vector3();let last=performance.now(),wasGrounded=true;
function frame(now){requestAnimationFrame(frame);const elapsed=(now-last)/1000;last=now;const dt=Math.max(0,Math.min(.05,elapsed));fps=T.MathUtils.lerp(fps,1/Math.max(.001,elapsed),.03);
 if(!(hero&&movement&&quest)){renderer.render(scene,camera);return;}
 const p=movement.position,cinematic=introActive||quest.finaleActive;
 if(!state.paused){state.t+=dt;art.update?.(state.t,state.gentle,p);
  movement.update(dt,{enabled:state.started&&!cinematic,actionSlow:!!state.action,faceTarget:state.action?state.actionTarget:null});
  if(movement.recovered){caption('A little current catches you and carries you back.',3);sound('capture');}
  travel+=movement.speed*dt;hero.position.copy(p);hero.rotation.y=state.started?movement.yaw:.35;
  if(introActive)updateIntro(dt);
  wind.update(dt,state.t,{hero:p,staffTip:quest.staff?staffTip():null,camera,gentle:state.gentle});
  quest.update(dt,state.t,p,{started:state.started&&!introActive,gentle:state.gentle});
  const e=introEngineTime();world.update(dt,state.t,{wind:wind.state(),restored:quest.restoration,intro:introActive?{t:e??-1,phase:e===null?'cards':['dawn','bell','sag','shutter','settle'][introShot().index]}:null,gentle:state.gentle,hero:p,camera,progress:quest.progress,finale:quest.finaleShot});
  saveTimer+=dt;if(saveTimer>12&&state.started&&!introActive){saveTimer=0;save();}
  if(queued&&state.t>=queued.at){const q=queued;queued=null;if(q.text)caption(typeof q.text==='function'?q.text():q.text,q.duration);q.then?.();}
  if(state.action){state.actionTime+=dt;if(state.actionTime>(state.action==='pull'?.38:.2)&&state.actionCallback){const cb=state.actionCallback;state.actionCallback=null;cb();}if(state.actionTime>.68)state.action=null;}
  animator.update(dt,{time:state.t,action:state.action,actionProgress:state.actionTime/.68,charged:wind.charged});staff.visible=quest.staff;poseStaff();
  const src=[...wind.sources.values()].reduce((m,s)=>Math.min(m,Math.hypot(p.x-s.x,p.z-s.z)),30);
  soundscape.update(dt,{position:p,speed:movement.speed,grounded:movement.grounded,charged:wind.charged,restored:(quest.restoration.village||0)>.5,gardenDistance:src,waterDistance:30});
  if(mara){const mp=world.points.mara,head=mara.getObjectByName('head'),arm=mara.getObjectByName('leftArm'),crank=mara.getObjectByName('crank');if(head)head.rotation.y=T.MathUtils.damp(head.rotation.y,Math.hypot(p.x-mp.x,p.z-mp.z)<4?Math.atan2(p.x-mara.position.x,p.z-mara.position.z)-mara.rotation.y:0,3,dt);if(arm)arm.rotation.x=Math.sin(state.t*.8)*.06;if(crank)crank.rotation.z=quest.progress.bypass?Math.sin(state.t*.8)*.08:0;}
  if(state.started){findContext();if((uiTimer-=dt)<=0){uiTimer=.2;updateUI();drawMap();}for(const foot of animator.footfalls)sound('step');if(wasGrounded&&!movement.grounded&&movement.verticalVelocity>0&&!movement.lifting)sound('jump');if(!wasGrounded&&movement.grounded)sound('land');}wasGrounded=movement.grounded;
  if(state.complete&&endingAt&&state.t>=endingAt){endingAt=0;$('#ending').hidden=false;$('#endingDetail').textContent=`${quest.telemetry().fragments}/3 bell fragments found.`;}
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
 if(quest.finaleActive){const f=quest.finaleShot,g=world.points.finale||world.points.guardian,e=f*f*(3-2*f);focus=tmpA.set(g.x,g.y+e*14,g.z);pitch=.3+e*.25;length=12+e*16;follow=1.4;}
 cameraTarget.lerp(focus,1-Math.exp(-dt*follow));placeCamera(dt,sx,sz,pitch,length);camera.lookAt(cameraTarget);
 sun.position.set(cameraTarget.x-9,cameraTarget.y+20,cameraTarget.z+8);sun.target.position.copy(cameraTarget);camera.updateMatrixWorld(true);
 if(state.started&&(hudTimer-=dt)<=0){hudTimer=.15;safe=hudSafe();updateChart(pos);}
 wind.flush();
 const area=quest.area(pos);
 if(look){try{look.update(dt,{area:LOOK_AREAS[area]||'terrace-dawn',restored:quest.restoration.village||0,t:state.t});look.render();}catch(e){console.warn('look failed; plain renderer from now on',e);look=null;renderer.render(scene,camera);}}else renderer.render(scene,camera);
 window.__READY__=true;
 const qt=quest.telemetry();
 window.__GAME__={pos:[pos.x,pos.z],y:pos.y,fps,speed:movement.speed,mode:movement.mode,grounded:movement.grounded,lifting:movement.lifting,knocked:movement.knocked,score:state.complete?1:0,draws:renderer.info.render.calls,tris:renderer.info.render.triangles,charged:wind.charged,chargeKind:wind.charge?.kind??null,paused:state.paused,started:state.started,introActive,introTime,introPhase:shot?SHOTS[shot.index].focus:null,context:context?.kind||null,contextId:context?.id||null,contextLabel:context?.label||null,objective:quest.objective(),area,quest:qt,wind:wind.telemetry(),travel,checkpoint:movement.checkpoint.toArray(),cameraYaw,stubWorld:!!world.stub,look:!!look,version:2};
}
async function loadWorld(){
 if(MODULES.world&&!params.has('stub')){try{const m=await import('./bellhollow/world.js');return await m.buildBellhollow({THREE:T,scene,loadAsset:ASSET,art});}catch(e){console.warn('Bellhollow world failed to build; using the stub world.',e);}}
 return buildStubWorld({THREE:T,scene});
}
async function loadGuardian(){if(!MODULES.guardian||params.get('guardian')==='stub')return undefined;try{return (await import('./bellhollow/guardian.js')).createGuardian;}catch(e){console.warn('guardian.js failed; using the stub encounter.',e);return undefined;}}
async function loadLook(){if(!MODULES.look||params.get('look')==='0')return null;try{const m=await import('./render/look.js');return m.createLook({THREE:T,renderer,scene,camera});}catch(e){console.warn('look.js failed; plain renderer.',e);return null;}}
try{
 if(legacy)$('#legacyNote').hidden=false;
 const loaded=await Promise.all([loadWorld(),loadCodeCharacter(buildApprovedHero),ASSET('./assets/campaign-mara.js',{keepHierarchy:true}),ASSET('./assets/staff.js'),loadGuardian(),art.ready.catch(()=>{})]);
 world=loaded[0];const character=loaded[1];mara=loaded[2];staff=loaded[3];const createGuardian=loaded[4];
 hero=character.root;hero.userData.joints=hero.children[0].userData.joints;scene.add(hero);art.style(staff);staff.scale.setScalar(.73);staffHand=hero.userData.joints.rightHand;staffHand.add(staff);staff.visible=false;
 const P=world.points;start3=[P.start.x,P.start.y,P.start.z];
 art.style(mara);mara.position.set(P.mara.x,P.mara.y,P.mara.z);mara.rotation.y=Math.atan2(P.start.x-P.mara.x,P.start.z-P.mara.z);scene.add(mara);
 movement=createMovement(T,{start:start3,sampleGround:(x,z,y)=>world.ground(x,z,y),blocked:(x,z,r,y)=>world.blocked(x,z,r,y),stickElement:$('#stick'),jumpButton:$('#jump'),runButton:$('#run'),walkSpeed:1.65,runSpeed:5.8,acceleration:12,deceleration:16,turnResponse:12,cameraYaw:()=>cameraYaw,maxDrop:14});
 animator=createAdventureMotion(character,movement);hero.position.copy(movement.position);
 wind=createWind({THREE:T,scene,movement,sound});
 quest=createQuest({THREE:T,scene,world,wind,movement,caption,sound,onChange:questEvent,...(createGuardian?{createGuardian}:{})});
 look=await loadLook();if(look){for(const [o,role,opts] of [[hero,'character'],[mara,'character'],[quest.guardian?.object,'outline',{dynamic:true}]])try{if(o)look.applyTo(o,role,opts);}catch(e){console.warn(e);}
  try{look.setAreaParams?.('hollow',{height:new T.Vector4(P.arena.y,P.hollowGate.y,.55,.62)});}catch(e){console.warn(e);}}
 snapCamera();
 // Read-only anchors for known-route drivers (plain data; nothing here can change the game).
 const plain=o=>JSON.parse(JSON.stringify(o));window.__BELLHOLLOW__=Object.freeze({points:plain(P),vents:plain(world.vents||[]),wheels:plain(world.wheels||[]),sails:plain(world.sails||[]),stub:!!world.stub});
 // Read-only probe for camera acceptance captures: clearance, head projection, un-cut line-of-sight blockers.
 window.__CAMERA_PROBE__=()=>{const p=movement.position,ray=new T.Raycaster(),blockers=[],vis=o=>{for(let n=o;n;n=n.parent){if(!n.visible||n===hero)return false;}return true;};let floor=-Infinity;for(const [a,b] of [[0,0],[.6,0],[-.6,0],[0,.6],[0,-.6]])floor=Math.max(floor,floorUnder(camera.position.x+a,camera.position.z+b,camera.position.y));
  for(const h of [1.55,1.0]){const target=new T.Vector3(p.x,p.y+h,p.z),dir=target.clone().sub(camera.position),dist=dir.length();ray.set(camera.position,dir.normalize());ray.far=dist-.3;for(const hit of ray.intersectObject(scene,true)){const o=hit.object,m=Array.isArray(o.material)?o.material[0]:o.material;if(!o.isMesh||!vis(o)||m?.transparent&&m.opacity<.5||m?.isMeshBasicMaterial&&!m.depthWrite||m?.isShaderMaterial)continue;blockers.push({name:o.name||o.parent?.name||'mesh',h,at:+hit.distance.toFixed(2),of:+dist.toFixed(2)});}}
  const head=new T.Vector3(p.x,p.y+1.55,p.z).project(camera);heroBox.min.set(p.x-.35,p.y,p.z-.35);heroBox.max.set(p.x+.35,p.y+1.75,p.z+.35);const g=quest.subject();
  return {cam:camera.position.toArray().map(v=>+v.toFixed(2)),clear:floor===-Infinity?99:+(camera.position.y-floor).toFixed(2),pitch:+armPitch.toFixed(3),arm:+armLength.toFixed(2),frameDist:+frameDist.toFixed(2),head:[+((head.x+1)/2*innerWidth).toFixed(1),+((1-head.y)/2*innerHeight).toFixed(1)],headInView:Math.abs(head.x)<.97&&Math.abs(head.y)<.97&&head.z<1,unobstructed:!blockers.length,blockers:blockers.slice(0,4),hero:screenBox(heroBox),guardian:g?screenBox(g):null,subject:g?'guardian':null,chartTucked:document.body.classList.contains('chart-tucked'),safe};};
 $('#startb').disabled=false;$('#startb').textContent=loadedSave?'Start a new adventure':'Start adventure';$('#continueb').hidden=!loadedSave;updateUI();window.__START__=()=>start(true);
}catch(e){console.error(e);$('#error').hidden=false;$('#error').textContent='Bellhollow could not load. '+e.message;}
requestAnimationFrame(frame);
