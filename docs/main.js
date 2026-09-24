import * as T from 'three';
import {ASSET} from './assetlib.js';
import {createWaterfall} from './waterfall.js';
import {createSoundscape} from './audio.js';
import {createMovement} from './movement.js';
import {loadCodeCharacter} from './code-character.js';
import buildApprovedHero from './assets/hero-study-a.js';
import {createAdventureMotion} from './adventure-motion.js';
import {createWoodlandDiscoveries,storyZone} from './woodland-discoveries.js';
import {createArtDirection} from './art-direction.js';
import {buildWorld} from './world.js';
import {createGarden} from './garden.js';
import {START,height,POINTS,PATH,isLand,shoreDistance} from './world-layout.js';
import {drawWoodlandMap} from './woodland-map.js';
import {buildCampaignWorld} from './campaign-world.js';
import {createCampaign} from './campaign.js';
import {createCampaignActors} from './campaign-actors.js';
import {readSave,writeSave,SAVE_KEY} from './adventure-save.js';
import {drawCampaignMap} from './campaign-map.js';
import {createOpening} from './opening.js';
import {createTitleMusic} from './title-music.js';
const opening=createOpening(),titleMusic=createTitleMusic();let musicUnlocked=false;
const $=s=>document.querySelector(s),canvas=$('#world');
const mapCanvas=$('#map'),mapCtx=mapCanvas?.getContext('2d');
const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new T.Scene();scene.background=new T.Color('#94b4ae');scene.fog=new T.FogExp2('#94b4ae',.030);
const camera=new T.PerspectiveCamera(42,1,.1,100);const hemi=new T.HemisphereLight(0xffefcd,0x274d54,1.8);scene.add(hemi);
const sun=new T.DirectionalLight(0xffe1ae,2.4);sun.position.set(-9,20,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:.5,far:65});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
// Woodland flags keep their version-1 save names: awakened = morning bell rung and Mara's bypass
// open; porchRead = bell staff taken at the porch; charged/restored as before.
const state={started:false,paused:false,t:0,charged:false,awakened:false,restored:false,complete:false,porchRead:false,recoveryUntil:0,keepsakes:new Set(),action:null,actionTime:0,muted:localStorage.getItem('bellkeeper-muted')==='1',gentle:localStorage.getItem('bellkeeper-gentle')==='1'};
let cameraYaw=Math.atan2(.615,.788),cameraDrag=null;
let hero,movement,animator,world,garden,discoveries,staff,staffHand,captionEnd=0,context=null,travel=0,visited=new Set(),fps=60,audio;
let campaignWorld,campaign,campaignActors,mara,checkpoint=[...START],saveTimer=0,introTime=0,introActive=false,lastIntroBeat=-1,restoring=false,bypassAt=0,queued=null;
let captionsEnabled=localStorage.getItem('bellkeeper-captions')!=='0';
// Camera spring arm, subject framing and chart tucking state (see frame()).
let armPitch=null,armLength=null,frameDist=0,lastCameraInput=-9,chartTuck=false,chartOverride=false,tuckUntil=0,hudTimer=0,safe=null;const subjects={},frameOffset=new T.Vector3(),armOrigin=new T.Vector3(),heroBox=new T.Box3(),ndc=new T.Vector3(),tmpA=new T.Vector3(),tmpB=new T.Vector3();
const loadedSave=readSave();
function save(){if(!state.started||introActive||restoring)return;writeSave(state,campaign,discoveries,checkpoint);}
function setCheckpoint(p){if(p?.isVector3)checkpoint=p.toArray();else if(Array.isArray(p))checkpoint=[...p];save();}
function campaignEvent(event={}){if(event.buffet)movement?.impulse(event.buffet.x,event.buffet.z);if(event.checkpoint)setCheckpoint(event.checkpoint);if(event.home){movement.reset([POINTS.porch[0],height(...POINTS.porch),POINTS.porch[1]]);setCheckpoint(movement.position);caption('The return lift carries you to the bough. Mara is still holding the bypass. Let her hear the answer.',7);}updateUI();save();}
const art=createArtDirection(T,renderer);const waterfall=createWaterfall(T,scene);
const point=([x,z],offset=0)=>new T.Vector3(x,height(x,z)+offset,z);
const valvePoint=point(POINTS.bypass,-.1),source=point(POINTS.outlet,.55),gardenPoint=point(POINTS.garden),bellPoint=point(POINTS.morningBell),wheelPoint=point(POINTS.wheel),chimePoint=point(POINTS.chime),finish=point(POINTS.overlook),porchPoint=point(POINTS.porch),quietPoint=point(POINTS.quietGarden);
const memories=[{p:point([-19,-5]),text:'Mara’s copper feather. She whistled to the birds before every lesson.'},{p:point([-4,-20]),text:'Mara scratched this bell: “You’ll answer the far bank without me one day.”'},{p:point([11,-11]),text:'Mara’s knot, tied toward home. I still turn mine the wrong way.'},{p:point([-12.6,-17.9]),text:'Mara’s old tuning fork, wrapped in seed-bell ribbon: “Listen first. Then call.”'}];
// The bypass opens a beat after the bell; saves and Continue open it at once. Later captions queue behind the current one.
const bypassOpen=()=>state.awakened&&state.t>=bypassAt,gardenSolved=()=>!!discoveries?.telemetry().echoSolved;
function later(delay,text,duration=5,then){queued={at:state.t+delay,text,duration,then};}
function caption(text,duration=4){$('#caption').textContent=text;$('#caption').style.opacity=captionsEnabled?'1':'0';captionEnd=state.t+Math.max(duration,Math.min(9,text.length/19));}
const waterDistance=p=>isLand(p.x,p.z)?shoreDistance(p.x,p.z):0;
const soundscape=createSoundscape();soundscape.setMuted(state.muted);titleMusic.setMuted(state.muted);
function titleSoundLabel(){$('#titleSound').setAttribute('aria-pressed',String(musicUnlocked&&!state.muted));$('#titleSound span').textContent=musicUnlocked?(state.muted?'Music off · enable':'Music on · mute'):'Enable title music';}
async function unlockTitleMusic(){if(state.muted||musicUnlocked||state.started&&!introActive)return;try{await titleMusic.start();musicUnlocked=true;titleSoundLabel();}catch{titleSoundLabel();}}
$('#titleSound').onclick=()=>{if(musicUnlocked)state.muted=!state.muted;else state.muted=false;localStorage.setItem('bellkeeper-muted',state.muted?'1':'0');soundscape.setMuted(state.muted);titleMusic.setMuted(state.muted);unlockTitleMusic();titleSoundLabel();updateUI();};
document.addEventListener('pointerdown',e=>{if(!$('#title').hidden&&e.target.closest('button')?.id!=='titleSound')unlockTitleMusic();},{capture:true});
document.addEventListener('keydown',e=>{if(!$('#title').hidden&&['Enter','Space'].includes(e.code))unlockTitleMusic();},{capture:true});
document.addEventListener('visibilitychange',()=>titleMusic.setPaused(document.hidden||state.paused));
$('#sound').after($('#volumeTemplate').content.cloneNode(true));$('#volume').value=localStorage.getItem('bellkeeper-volume')??'65';soundscape.setVolume(Number($('#volume').value)/100);titleMusic.setVolume(Number($('#volume').value)/100);$('#volume').oninput=()=>{soundscape.setVolume(Number($('#volume').value)/100);titleMusic.setVolume(Number($('#volume').value)/100);localStorage.setItem('bellkeeper-volume',$('#volume').value);};
function sound(kind){soundscape.cue(kind);}
function updateUI(){
 document.body.classList.toggle('gentle-opening',state.gentle);
 $('#objective').textContent=state.complete?'The morning has a voice again':state.restored?'Cross the new bridge to the far bell':state.charged?'Give the gust to the seed wheel':!state.awakened?'Pull the morning bell rope':!state.porchRead?'Take the bell staff from Mara’s porch':'Catch the gust under Mara’s copper outlet';
 if(campaign?.progress.entered&&!state.complete)$('#objective').textContent=campaign.progress.restored?'Return to Mara at the cottage':campaign.objective();
 $('#zoneName').textContent=campaign?.progress.entered&&movement?.position.z<-44?'THE HEARTWOOD WINDWORKS':campaign?.progress.entered&&movement?.position.z<-16?'THE ROOTWAY':'THE WAKING BOUGH';
 $('#chargeText').textContent=(state.charged?'Wind held in the bell':'Bell empty')+(state.keepsakes.size?' · '+state.keepsakes.size+'/'+memories.length+' keepsakes':'');$('#chargeIcon').textContent=state.charged?'✧':'◌';
 $('#sound').textContent='Sound: '+(state.muted?'off':'on');$('#motion').textContent='Gentle motion: '+(state.gentle?'on':'off');
 $('#subtitles').textContent='Captions: '+(captionsEnabled?'on':'off');
}
function start(skipIntro=false){if(!movement)return;unlockTitleMusic();opening.begin(skipIntro);if(skipIntro)titleMusic.fadeOut(2);state.started=true;state.paused=false;$('#title').hidden=true;for(const id of ['hud','charge','controls','hint','map','mapToggle'])$('#'+id).hidden=false;introActive=!skipIntro;introTime=0;lastIntroBeat=-1;$('#skipIntro').hidden=!introActive;document.body.classList.toggle('cinematic',introActive);caption('',0);soundscape.start().then(()=>sound('start')).catch(()=>{$('#audioUnlock').hidden=false;});if(matchMedia('(any-pointer: coarse)').matches)$('#audioUnlock').hidden=false;updateUI();}
function endIntro(){opening.end();titleMusic.fadeOut(2.8);introActive=false;$('#skipIntro').hidden=true;document.body.classList.remove('cinematic');movement?.update(0,{enabled:state.started&&!state.paused});caption('Mara: “Morning round, apprentice. Pull the bell rope by the path.”',6);save();}
function continueGame(){const d=readSave();if(!d)return;restoring=true;Object.assign(state,d.state);state.keepsakes=new Set(d.keepsakes?.filter(i=>Number.isInteger(i)&&i>=0&&i<memories.length));
 // Older saves (note/chime/garden route) carry the same flag names: anyone already holding or past the
 // first gust has rung the bell and holds the staff. The bypass is open at once on Continue.
 if(state.charged||state.restored||state.complete||d.campaign?.progress?.entered)state.awakened=state.porchRead=true;bypassAt=0;queued=null;discoveries.restore(d.discoveries);campaign.restore(d.campaign);checkpoint=d.checkpoint;movement.reset(checkpoint);animator.reset();restoring=false;start(true);caption('The woods remember where you left them.',4);}
function pause(on){if(!state.started)return;state.paused=on;soundscape.setPaused(on);titleMusic.setPaused(on);$('#pausePanel').hidden=!on;$('#resume').textContent='Resume';$('#reset').hidden=false;mapCanvas.hidden=on;$('#mapToggle').hidden=on;if(on){save();mapCanvas.classList.remove('expanded');$('#mapToggle').setAttribute('aria-expanded','false');chartUI();}}
function beginAction(kind,callback){state.action=kind;state.actionTime=0;state.actionTarget=(context?.target|| (context?.kind==='wheel'?wheelPoint:context?.kind==='capture'?source:chimePoint)).clone();state.actionCallback=callback;sound(kind);}
function action(){if(!state.started||state.paused||state.action||introActive)return;if(!context){caption('Listen. Watch the leaves. There is still a little wind here.',3);return;}
 if(context.kind==='campaign'){const selected={...context};beginAction(/source|Source|Gust/.test(context.id)?'capture':'release',()=>{campaign.interact(selected,state);updateUI();save();});return;}
 if(context.kind==='bell'){const first=!state.awakened;beginAction('pull',()=>{world.ringMorningBell();sound('dull-bell');if(!first){caption('Still only half a note.',3);return;}state.awakened=true;bypassAt=state.t+2.2;caption('A dull, broken note. Mara: “That bell below us hasn’t rung in years.”',5);
  const hadStaff=state.porchRead;later(2.3,()=>hadStaff?'Mara throws her bypass lever. “Catch the gust in the bell. Give it to the wheel.”':state.porchRead?'Mara throws her bypass lever. A gust stirs at the copper outlet.':'Mara throws her bypass lever. A gust stirs at the copper outlet. “Take my staff from the porch.”',6,()=>sound('bypass'));});return;}
 if(context.kind==='mara-end'){state.complete=true;caption('Mara: “I taught you how to call it. I forgot to teach you how to listen.”',9);sound('restore');$('#ending').hidden=false;$('#endingDetail').textContent=`The village borrows. The forest receives. You restored both voices. ${state.keepsakes.size}/${memories.length} memories found${campaign.progress.secret?' · The old listening rite remembered.':'.'}`;setCheckpoint(porchPoint);updateUI();return;}
 if(context.kind==='discovery'){discoveries.interact(context.id,state);updateUI();save();return;}
 if(context.kind==='nostaff'){caption('The gust slips through your fingers. Mara’s bell staff hangs on the porch peg.',4);return;}
 if(context.kind==='porch'){state.porchRead=true;setCheckpoint(porchPoint);caption(state.awakened?'Mara hands you the bell staff. “Catch the gust in the bell. Give it to the wheel.”':'Mara hands you the bell staff. “First, the morning bell by the path.”',6);sound('chime');}
 if(context.kind==='chime'){beginAction('pull',()=>{sound('chime');caption(gardenSolved()?'The root chime hums with the listening garden.':'The root chime hums. Beside it, a gong, seed bells and a harp wait for a rising song.',5);});return;}
 if(context.kind==='capture')beginAction('capture',()=>{state.charged=true;caption('The gust curls into your bell. Give it to the seed wheel.',4);});
 if(context.kind==='wheel'){if(state.charged)beginAction('release',()=>{state.charged=false;state.restored=true;sound('restore');caption('The seed wheel spins. Lanterns wake and the bridge swings out to the far bell.',5);later(5.2,'Mara: “I’ll keep this passage open.”',4);});else caption(state.awakened?'The seed wheel is still. Catch Mara’s gust under the copper outlet.':'The seed wheel is still. Pull the morning bell rope first.',4);}
 if(context.kind==='memory'){state.keepsakes.add(context.index);caption(memories[context.index].text,5);sound('chime');}
 if(context.kind==='finish'){campaign.progress.entered=true;setCheckpoint(finish);caption('Only half a note. Below the bough, the return channel has gone quiet. Follow the roots into the windworks.',7);sound('chime');}
 updateUI();save();}
$('#storyNext').onclick=()=>{if(introActive)introTime=Math.min(27,(Math.floor(introTime/9)+1)*9);};
$('#startb').onclick=()=>start();$('#continueb').onclick=continueGame;$('#skipIntro').onclick=endIntro;$('#action').onclick=action;$('#pause').onclick=()=>pause(true);$('#resume').onclick=()=>pause(false);$('#keepExploring').onclick=()=>$('#ending').hidden=true;
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
$('#reset').onclick=()=>{opening.end();titleMusic.fadeOut(1);Object.assign(state,{charged:false,awakened:false,restored:false,complete:false,porchRead:false,recoveryUntil:0,action:null,actionCallback:null});state.keepsakes.clear();visited.clear();discoveries?.reset();campaign?.reset();checkpoint=[...START];bypassAt=0;queued=null;introActive=false;$('#skipIntro').hidden=true;document.body.classList.remove('cinematic');$('#ending').hidden=true;cameraYaw=Math.atan2(.615,.788);movement.reset(START);animator.reset();travel=0;pause(false);updateUI();save();caption('Another morning. The woods are listening.',4);};
addEventListener('keydown',e=>{if(e.code==='Space'&&state.started&&!introActive){e.preventDefault();if(!e.repeat)action();}if(e.code==='Escape')pause(!state.paused);});// Touch browsers can blur the window during native gestures while still visible.
// Actual backgrounding is handled by visibilitychange on every device.
addEventListener('blur',()=>{if(!matchMedia('(any-pointer: coarse)').matches&&state.started)pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.started)pause(true);});
for(const id of ['world','controls'])$('#'+id).addEventListener('contextmenu',e=>e.preventDefault());
// Wind ribbons and motes are original procedural effects rather than substitute scenery.
function ribbon(color){const g=new T.BufferGeometry(),p=new Float32Array(48*6),idx=[];for(let i=0;i<47;i++){const n=i*2;idx.push(n,n+1,n+2,n+1,n+3,n+2);}g.setAttribute('position',new T.BufferAttribute(p,3));g.setIndex(idx);const o=new T.Mesh(g,new T.MeshBasicMaterial({color,transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false}));o.frustumCulled=false;scene.add(o);return o;}
const winds=[ribbon(0xffedb0),ribbon(0x84ebcf),ribbon(0xdae4a6)],held=ribbon(0x92e4cd),transfer=ribbon(0xffefb5),gardenWind=ribbon(0xbff5dc),valveWind=ribbon(0xfff0c2);
function swirl(o,c,r,t){const p=o.geometry.attributes.position;for(let i=0;i<48;i++){const a=i/47*5+t,w=.035*Math.sin(i/47*Math.PI),x=c.x+Math.cos(a)*r,y=c.y+.6+Math.sin(a*1.5+t)*.2,z=c.z+Math.sin(a)*r;p.setXYZ(i*2,x,y-w,z);p.setXYZ(i*2+1,x,y+w,z);}p.needsUpdate=true;}
const particleGeo=new T.BufferGeometry(),particles=new Float32Array(170*3);for(let i=0;i<170;i++){particles[i*3]=Math.sin(i*98.7)*25;particles[i*3+1]=1+(i%17)*.27;particles[i*3+2]=Math.cos(i*52.4)*25;}particleGeo.setAttribute('position',new T.BufferAttribute(particles,3));const motes=new T.Points(particleGeo,new T.PointsMaterial({color:0xffe5a7,size:.055,transparent:true,opacity:.65,depthWrite:false}));scene.add(motes);
const insectGeo=new T.BufferGeometry(),insectPositions=new Float32Array(54*3),insectHomes=[[-3,12,1.1],[-11,-14.5,.8],[8,-9,.9]];for(let i=0;i<54;i++){const h=insectHomes[i%insectHomes.length],a=i*2.39996,r=.35+(i%9)*.08;insectPositions[i*3]=h[0]+Math.cos(a)*r;insectPositions[i*3+1]=height(h[0],h[1])+.5+(i%6)*.11;insectPositions[i*3+2]=h[1]+Math.sin(a)*r;}insectGeo.setAttribute('position',new T.BufferAttribute(insectPositions,3));const insects=new T.Points(insectGeo,new T.PointsMaterial({color:0xffd98a,size:.075,transparent:true,opacity:.78,blending:T.AdditiveBlending,depthWrite:false}));scene.add(insects);
const memoryGlows=memories.map(m=>{const o=new T.Mesh(new T.OctahedronGeometry(.10),new T.MeshBasicMaterial({color:0xffd78d}));o.position.copy(m.p).y+=.35;scene.add(o);return o;});
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
function findContext(){const p=movement.position;context=discoveries?.context(p,state)||null;
 if(storyZone('bell',p))context={kind:'bell',label:state.awakened?'Pull the bell rope again':'Pull the morning bell rope',target:bellPoint};
 if(!state.porchRead&&storyZone('porch',p))context={kind:'porch',label:'Take the bell staff',target:porchPoint};
 for(let i=0;i<memories.length;i++)if(!state.keepsakes.has(i)&&(i!==3||gardenSolved())&&p.distanceTo(memories[i].p)<(i===0?.72:1.4)&&Math.abs(p.y-memories[i].p.y)<(i<2?.25:2))context={kind:'memory',index:i,label:'Keep the memory'};
 if(storyZone('chime',p))context={kind:'chime',label:'Ring the root chime',target:chimePoint};
 if(bypassOpen()&&!state.charged&&!state.restored&&storyZone('bypass',p))context=state.porchRead?{kind:'capture',label:'Catch the gust',target:source}:{kind:'nostaff',label:'Reach for Mara’s gust',target:source};
 if(!state.restored&&storyZone('wheel',p))context={kind:'wheel',label:state.charged?'Give the gust to the wheel':'Listen to the seed wheel',target:wheelPoint};
 if(state.restored&&!campaign?.progress.entered&&storyZone('finish',p))context={kind:'finish',label:'Listen beyond the bough'};
 if(campaign?.progress.entered){const next=campaign.context(p,state.charged);if(next)context=next;}
 if(campaign?.progress.restored&&!state.complete&&p.distanceTo(porchPoint)<2)context={kind:'mara-end',label:'Let Mara hear the answer',target:porchPoint};
 $('#action').disabled=!context||!!state.action;$('#action').innerHTML=(context?.label||'Listen & explore')+' <span>SPACE</span>';
 if(!gardenSolved()&&p.distanceTo(quietPoint)<1.7&&!visited.has('quiet-pocket')){visited.add('quiet-pocket');caption('The roots shelter this pocket. The song lives in the bed beside it.',3);}
 const areas=[['cottage',point(POINTS.cottage),5,'Mara’s cottage. She left fresh ribbons by our tool pegs.'],['crossing',wheelPoint,4,state.restored?'The crossing sings again.':state.charged?'The wheel answers the current in your bell.':'The far bank is out of reach. A path curls back into the roots.'],['garden',gardenPoint,6,'You hear a faint chime beneath the leaves.'],['fork',point([-10,5]),3.2,'The root path winds down to the listening garden. The seed wheel waits the other way.']];for(const [id,pnt,d,text] of areas)if(!visited.has(id)&&p.distanceTo(pnt)<d){visited.add(id);caption(text,4);}
}
function drawMap(){
 document.body.classList.toggle('deep-chart',!!campaign?.progress.entered&&movement.position.z<-16);
 if(campaign?.progress.entered&&movement.position.z<-16){drawCampaignMap(mapCtx,mapCanvas,movement.position,cameraYaw,campaignWorld.points,campaign.progress,movement.yaw);return;}
 drawWoodlandMap(mapCtx,mapCanvas,{...state,gardenSolved:gardenSolved()},movement,cameraYaw);
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
function viewGround(x,z,solids=true){const g=campaignWorld?.ground(x,z);if(g!==undefined)return g===null?-Infinity:g;let y=Math.max(height(x,z),-.6);if(solids)for(const c of world?.cameraSolids||[])if(Math.hypot(x-c.x,z-c.z)<c.r)y=Math.max(y,c.top);return y;}
function armHit(o,sx,sz,pitch,length){const c=Math.cos(pitch),s=Math.sin(pitch);for(let i=1;i<=10;i++){const d=length*i/10;if(o.y+s*d<viewGround(o.x+sx*c*d,o.z+sz*c*d,d>2)+.35+.055*i)return d;}return 0;}
function placeCamera(dt,sx,sz,pitch,length){// Test the arm from a point kept above the floor: framing may pan the look target below a descending deck.
 armOrigin.copy(cameraTarget);armOrigin.y=Math.max(armOrigin.y,viewGround(armOrigin.x,armOrigin.z,false)+.9);let p=pitch,l=length;while(p<1.05&&armHit(armOrigin,sx,sz,p,l))p+=.05;if(p>=1.05){p=1.05;const hit=armHit(armOrigin,sx,sz,p,l);if(hit)l=Math.max(5,hit-.8);}
 armPitch??=p;armLength??=l;armPitch=T.MathUtils.damp(armPitch,p,p>armPitch?12:2.4,dt);armLength=T.MathUtils.damp(armLength,l,l<armLength?12:2,dt);
 const c=Math.cos(armPitch)*armLength;camera.position.set(cameraTarget.x+sx*c,cameraTarget.y+Math.sin(armPitch)*armLength,cameraTarget.z+sz*c);
 let floor=-Infinity;for(const [a,b] of [[0,0],[.6,0],[-.6,0],[0,.6],[0,-.6]])floor=Math.max(floor,viewGround(camera.position.x+a,camera.position.z+b));camera.position.y=Math.max(camera.position.y,floor+1.1);}
function screenBox(box){let l=1e9,t=1e9,r=-1e9,b=-1e9;for(let i=0;i<8;i++){ndc.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(camera);if(ndc.z>1)return null;const x=(ndc.x+1)/2*innerWidth,y=(1-ndc.y)/2*innerHeight;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}return {l,t,r,b};}
// Play area left by the HUD: below the objective panel, above caption/buttons, left of an open chart.
function hudSafe(){const s={l:12,t:12,r:innerWidth-12,b:innerHeight-12},top=$('#hud>div')?.getBoundingClientRect();if(top?.height)s.t=Math.max(s.t,top.bottom+10);
 for(const el of document.querySelectorAll('#caption,#charge,#controls button,#stick,#hint')){if(el.hidden||el.id==='caption'&&el.style.opacity==='0'||getComputedStyle(el).visibility==='hidden')continue;const r=el.getBoundingClientRect();if(r.height&&r.top>innerHeight*.45)s.b=Math.min(s.b,r.top-10);}
 if(!document.body.classList.contains('chart-tucked')&&!mapCanvas.hidden&&getComputedStyle(mapCanvas).visibility!=='hidden'){const r=mapCanvas.getBoundingClientRect();if(r.width&&r.left>innerWidth*.5)s.r=Math.min(s.r,r.left-10);}return s;}
function encounterSubject(p){const pr=campaign?.progress,pts=campaignWorld?.points;if(!pr?.entered||!pts||introActive)return null;const near=q=>Math.hypot(p.x-q.x,p.z-q.z)<13;
 return pr.returnCleared&&!pr.outwardAligned&&near(pts.guardian)?subjects.guardian:pr.bridge&&!pr.service&&near(pts.service)?subjects.service:null;}
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
function objectiveTargets(){const pr=campaign?.progress,pts=campaignWorld?.points;if(pr?.entered&&pts){if(pr.restored)return [porchPoint];return [pts[!pr.bridge?(state.charged?'bridgeWheel':'source'):!pr.service?'service':!pr.inspection?(state.charged?'inspection':'chamberEntry'):!pr.returnCleared?'returnWheel':!pr.returnAligned?'returnVane':!pr.outwardAligned?'outwardVane':'finalBell']];}
 return [state.restored?finish:state.charged?wheelPoint:!state.awakened?bellPoint:!state.porchRead?porchPoint:source];}
function updateChart(pos){const now=performance.now()/1000;let hit=introActive||!!encounterSubject(pos);
 if(!hit&&!mapCanvas.hidden){const m=mapCanvas.getBoundingClientRect();for(const p of [...objectiveTargets(),context?.target]){if(!p||p.distanceTo(pos)>28)continue;const r=screenBox(new T.Box3(tmpA.set(p.x-.6,p.y,p.z-.6),tmpB.set(p.x+.6,p.y+1.9,p.z+.6)));if(r&&r.r>m.left-16&&r.l<m.right+16&&r.b>m.top-16&&r.t<m.bottom+16){hit=true;break;}}}
 // The chart stays tucked unless the player opens it; the intro and encounters tuck it again.
 if(!chartTuck){chartTuck=true;chartUI();}if((introActive||encounterSubject(pos))&&chartOverride){chartOverride=false;chartUI();}}
const cameraTarget=new T.Vector3(...START);let vista=0,last=performance.now(),wasGrounded=true,lastMode='idle';
function frame(now){requestAnimationFrame(frame);const elapsed=(now-last)/1000;last=now;const dt=Math.max(0,Math.min(.05,elapsed));fps=T.MathUtils.lerp(fps,1/Math.max(.001,elapsed),.03);
 if(hero&&movement){if(!state.paused){state.t+=dt;waterfall.update(state.t);art.update?.(state.t,state.gentle,movement.position);movement.update(dt,{enabled:state.started&&!introActive,actionSlow:!!state.action,faceTarget:state.action?state.actionTarget:null});if(movement.recovered){state.recoveryUntil=state.t+.9;caption('A little current catches you and carries you back.',3);sound('capture');}const p=movement.position;travel+=movement.speed*dt;hero.position.copy(p);hero.rotation.y=state.started?movement.yaw:.35;
 if(introActive){introTime+=dt;opening.update(introTime);const beat=introTime<27?Math.floor(introTime/9):3+Math.floor((introTime-27)/7);if(beat!==lastIntroBeat){lastIntroBeat=beat;if(!state.gentle&&beat>=3)cameraTarget.copy(beat===3?campaignWorld.points.guardian:porchPoint).y+=1;if(beat<3)caption('',0);else caption(beat===3?'The guardian has sealed the windworks. Across the village, the wind falls still.':'Mara: “Morning round, apprentice. Pull the bell rope by the path.”',7);}if(introTime>=41)endIntro();}
 campaign?.update(dt,state.t,p,state);campaignWorld?.update(dt,state.t,p,campaign.progress,state);campaignWorld?.atmosphere?.({scene,hemi,sun,renderer},dt,p,campaign.progress);campaignActors?.update(dt,state.t,p,{...state,introTime:introActive?Math.min(27.99,Math.max(0,introTime-13)):null},campaign.telemetry());saveTimer+=dt;if(saveTimer>12&&state.started&&!introActive){saveTimer=0;save();}if(state.started)updateUI();
 if(queued&&state.t>=queued.at){const q=queued;queued=null;caption(typeof q.text==='function'?q.text():q.text,q.duration);q.then?.();}
 if(state.action){state.actionTime+=dt;if(state.actionTime>.38&&state.actionCallback){state.actionCallback();state.actionCallback=null;updateUI();save();}if(state.actionTime>.68)state.action=null;}
 animator.update(dt,{time:state.t,action:state.action,actionProgress:state.actionTime/.68,charged:state.charged});staff.visible=state.porchRead;poseStaff();discoveries?.update(dt,state.t,p,state);garden.update(dt,state.t,p,{open:bypassOpen(),catchable:bypassOpen()&&state.porchRead&&!state.charged&&!state.restored,solved:gardenSolved(),gentle:state.gentle});soundscape.update(dt,{position:p,speed:movement.speed,grounded:movement.grounded,charged:state.charged,restored:state.restored,gardenDistance:p.distanceTo(source),waterDistance:waterDistance(p)});
 if(mara){const head=mara.getObjectByName('head'),arm=mara.getObjectByName('leftArm'),crank=mara.getObjectByName('crank');if(head)head.rotation.y=T.MathUtils.damp(head.rotation.y,p.distanceTo(porchPoint)<4?Math.atan2(p.x-mara.position.x,p.z-mara.position.z)-mara.rotation.y:0,3,dt);if(arm)arm.rotation.x=Math.sin(state.t*.8)*.06;if(crank)crank.rotation.z=Math.sin(state.t*.8)*.08;}
 if(state.started){findContext();drawMap();for(const foot of animator.footfalls)sound('step');if(wasGrounded&&!movement.grounded&&movement.verticalVelocity>0)sound('jump');if(!wasGrounded&&movement.grounded)sound('land');}wasGrounded=movement.grounded;lastMode=movement.mode;
 winds.forEach((o,i)=>{o.visible=bypassOpen()&&!state.charged||state.restored;swirl(o,state.restored?finish:source,(state.restored?1.1:.5)+i*.12,state.t*(.8+i*.12)+i*2);});valveWind.visible=bypassOpen();if(valveWind.visible)swirl(valveWind,valvePoint,.42,state.t*1.6);gardenWind.visible=gardenSolved();if(gardenWind.visible)swirl(gardenWind,gardenPoint,.75,state.t*.6);held.visible=state.charged||state.t<state.recoveryUntil;swirl(held,p,.45,state.t*2);
 transfer.visible=state.action==='release';if(transfer.visible){const from=staff.localToWorld(new T.Vector3(0,1.15,0)),to=state.actionTarget.clone().add(new T.Vector3(0,.85,0)),a=transfer.geometry.attributes.position;for(let i=0;i<48;i++){const f=T.MathUtils.clamp(state.actionTime/.68*1.6-i/47*.45,0,1),v=from.clone().lerp(to,f);v.y+=Math.sin(f*Math.PI)*.7;const width=.065*Math.sin(i/47*Math.PI);a.setXYZ(i*2,v.x,v.y-width,v.z);a.setXYZ(i*2+1,v.x,v.y+width,v.z);}a.needsUpdate=true;}

 for(let i=0;i<memoryGlows.length;i++){memoryGlows[i].visible=!state.keepsakes.has(i)&&(i!==1||state.charged||state.restored)&&(i!==3||gardenSolved());memoryGlows[i].rotation.y+=dt;memoryGlows[i].position.y=memories[i].p.y+.4+Math.sin(state.t*2+i)*.08;}
 motes.rotation.y=state.gentle?0:Math.sin(state.t*.025)*.08;if(state.t>captionEnd)$('#caption').style.opacity='0';
 for(let i=0;i<54;i++){const h=insectHomes[i%insectHomes.length],a=i*2.39996+state.t*(.7+(i%3)*.12),r=.35+(i%9)*.08+Math.sin(state.t*1.7+i)*.06;insectPositions[i*3]=h[0]+Math.cos(a)*r;insectPositions[i*3+1]=height(h[0],h[1])+.52+(i%6)*.11+Math.sin(state.t*2.1+i)*.12;insectPositions[i*3+2]=h[1]+Math.sin(a)*r;}insectGeo.attributes.position.needsUpdate=true;
 }
 const pos=movement.position;vista=T.MathUtils.damp(vista,state.restored?1-T.MathUtils.smoothstep(pos.distanceTo(finish),2,7):0,3,dt);const ahead=.8+vista*1.5,sx=Math.sin(cameraYaw),sz=Math.cos(cameraYaw);frameSubject(state.started?encounterSubject(pos):null,pos,dt);let focus=new T.Vector3(pos.x-sx*ahead,pos.y+1+vista*.6,pos.z-sz*ahead).add(frameOffset);
 if(introActive&&!state.gentle){focus=(introTime>=34?porchPoint:introTime>=27?campaignWorld.points.guardian:new T.Vector3(...START)).clone().add(new T.Vector3(0,1,0));}
 cameraTarget.lerp(focus,1-Math.exp(-dt*(introActive?1.8:7)));const portrait=camera.aspect<.85,shot=campaignWorld?.restorationShot?.(state.gentle)||0;placeCamera(dt,sx,sz,Math.atan(.48-vista*.13)+shot*.12,(portrait?11.5:10.8)+vista*2.5+frameDist+shot*5);camera.lookAt(cameraTarget);sun.position.set(cameraTarget.x-9,cameraTarget.y+20,cameraTarget.z+8);sun.target.position.copy(cameraTarget);camera.updateMatrixWorld(true);if(!state.paused)world.update(dt,state.t,pos,state.restored,state.gentle,camera,state.charged,state.complete,state.started&&!introActive,bypassOpen());if(state.started&&(hudTimer-=dt)<=0){hudTimer=.15;safe=hudSafe();updateChart(pos);}
 renderer.render(scene,camera);window.__READY__=true;window.__GAME__={pos:[pos.x,pos.z],y:pos.y,fps,speed:movement.speed,mode:movement.mode,grounded:movement.grounded,score:state.complete?1:0,draws:renderer.info.render.calls,tris:renderer.info.render.triangles,charged:state.charged,awakened:state.awakened,restored:state.restored,paused:state.paused,started:state.started,porchRead:state.porchRead,bypassOpen:bypassOpen(),quietObserved:visited.has('quiet-pocket'),keepsakes:state.keepsakes.size,travel,context:context?.kind||null,discoveryId:context?.id||null,discoveries:discoveries?.telemetry(),campaign:campaign?.telemetry(),introActive,introTime,checkpoint:[...checkpoint],heroVersion:'approved-D',cameraYaw};
 }else renderer.render(scene,camera);
}
try{
 const geography=buildCampaignWorld(scene,art);
 const loaded=await Promise.all([buildWorld(scene,art),createGarden(scene,art),createWoodlandDiscoveries(scene,art,{caption,sound}),geography,geography.then(w=>createCampaignActors(scene,art,w.points)),loadCodeCharacter(buildApprovedHero),ASSET('./assets/campaign-mara.js',{keepHierarchy:true}),ASSET('./assets/staff.js'),art.ready]);
 [world,garden,discoveries,campaignWorld,campaignActors]=loaded;const character=loaded[5];mara=loaded[6];staff=loaded[7];
 memories[0].p.copy(world.keepsakePoint);if(world.shortcutPoint)memories[1].p.copy(world.shortcutPoint);hero=character.root;hero.userData.joints=hero.children[0].userData.joints;scene.add(hero);art.style(staff);staff.scale.setScalar(.73);staffHand=hero.userData.joints.rightHand;staffHand.add(staff);
 campaign=createCampaign({THREE:T,scene,points:campaignWorld.points,caption,sound,onChange:(_progress,event)=>campaignEvent(event)});
 art.style(mara);mara.position.set(-7.2,height(-7.2,11.3),11.3);mara.rotation.y=.55;scene.add(mara);
 movement=createMovement(T,{start:START,sampleGround:(x,z)=>{const g=campaignWorld.ground(x,z);return g===undefined?world.ground(x,z):g;},blocked:(x,z,r)=>campaignWorld.ground(x,z)===undefined?world.blocked(x,z,r):campaignWorld.blocked(x,z,r),stickElement:$('#stick'),jumpButton:$('#jump'),runButton:$('#run'),walkSpeed:1.65,runSpeed:5.8,acceleration:12,deceleration:16,turnResponse:12,cameraYaw:()=>cameraYaw});animator=createAdventureMotion(character,movement);hero.position.copy(movement.position);world.seeThrough(scene,o=>{for(let n=o;n;n=n.parent)if(n===hero)return true;return false;});for(const id of ['guardian','service']){const a=scene.getObjectByName(`campaign-${id}-actor`);if(a)subjects[id]=new T.Box3().setFromObject(a).expandByScalar(.15);}
 // Read-only probe for camera acceptance captures: clearance, head projection, un-cut line-of-sight blockers.
 window.__CAMERA_PROBE__=()=>{const p=movement.position,ray=new T.Raycaster(),blockers=[],vis=o=>{for(let n=o;n;n=n.parent){if(!n.visible||n===hero)return false;}return true;};let floor=-Infinity;for(const [a,b] of [[0,0],[.6,0],[-.6,0],[0,.6],[0,-.6]])floor=Math.max(floor,viewGround(camera.position.x+a,camera.position.z+b));
  for(const h of [1.55,1.0]){const target=new T.Vector3(p.x,p.y+h,p.z),dir=target.clone().sub(camera.position),dist=dir.length();ray.set(camera.position,dir.normalize());ray.far=dist-.3;for(const hit of ray.intersectObject(scene,true)){const o=hit.object,m=Array.isArray(o.material)?o.material[0]:o.material;if(!o.isMesh||!vis(o)||m?.transparent&&m.opacity<.5||m?.isMeshBasicMaterial&&!m.depthWrite||world.seeCuts(hit.point))continue;blockers.push({name:o.name||o.parent?.name||'mesh',h,at:+hit.distance.toFixed(2),of:+dist.toFixed(2)});}}
  const head=new T.Vector3(p.x,p.y+1.55,p.z).project(camera);heroBox.min.set(p.x-.35,p.y,p.z-.35);heroBox.max.set(p.x+.35,p.y+1.75,p.z+.35);
  return {cam:camera.position.toArray().map(v=>+v.toFixed(2)),clear:floor===-Infinity?99:+(camera.position.y-floor).toFixed(2),pitch:+armPitch.toFixed(3),arm:+armLength.toFixed(2),frameDist:+frameDist.toFixed(2),head:[+((head.x+1)/2*innerWidth).toFixed(1),+((1-head.y)/2*innerHeight).toFixed(1)],headInView:Math.abs(head.x)<.97&&Math.abs(head.y)<.97&&head.z<1,unobstructed:!blockers.length,blockers:blockers.slice(0,4),hero:screenBox(heroBox),guardian:subjects.guardian?screenBox(subjects.guardian):null,service:subjects.service?screenBox(subjects.service):null,subject:encounterSubject(p)===subjects.guardian?'guardian':encounterSubject(p)?'service':null,chartTucked:document.body.classList.contains('chart-tucked'),safe};};
 $('#startb').disabled=false;$('#startb').textContent=loadedSave?'Start a new adventure':'Start adventure';$('#continueb').hidden=!loadedSave;updateUI();window.__START__=()=>start(true);
}catch(e){console.error(e);$('#error').hidden=false;$('#error').textContent='The woodland could not load. '+e.message;}
requestAnimationFrame(frame);
