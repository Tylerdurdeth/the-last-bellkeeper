import * as T from 'three';
import {ASSET} from './assetlib.js';
import {createWaterfall} from './waterfall.js';
import {createSoundscape} from './audio.js';
import {createMovement} from './movement.js';
import {loadCodeCharacter} from './code-character.js';
import buildApprovedHero from './assets/hero-study-a.js';
import {createAdventureMotion} from './adventure-motion.js';
import {createWoodlandDiscoveries} from './woodland-discoveries.js';
import {createArtDirection} from './art-direction.js';
import {buildWorld} from './world.js';
import {createGarden} from './garden.js';
import {START,height,POINTS,PATH} from './world-layout.js';
const $=s=>document.querySelector(s),canvas=$('#world');
const mapCanvas=$('#map'),mapCtx=mapCanvas?.getContext('2d');
const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new T.Scene();scene.background=new T.Color('#94b4ae');scene.fog=new T.FogExp2('#94b4ae',.030);
const camera=new T.PerspectiveCamera(42,1,.1,100);scene.add(new T.HemisphereLight(0xffefcd,0x274d54,1.8));
const sun=new T.DirectionalLight(0xffe1ae,2.4);sun.position.set(-9,20,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:.5,far:65});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
const state={started:false,paused:false,t:0,charged:false,awakened:false,restored:false,complete:false,porchRead:false,recoveryUntil:0,keepsakes:new Set(),action:null,actionTime:0,muted:localStorage.getItem('bellkeeper-muted')==='1',gentle:localStorage.getItem('bellkeeper-gentle')==='1'};
let cameraYaw=Math.atan2(.615,.788),cameraDrag=null;
let hero,movement,animator,world,garden,discoveries,staff,staffHand,captionEnd=0,context=null,travel=0,visited=new Set(),fps=60,audio;
const art=createArtDirection(T,renderer);const waterfall=createWaterfall(T,scene);
const point=([x,z],offset=0)=>new T.Vector3(x,height(x,z)+offset,z);
const source=point(POINTS.garden,.55),wheelPoint=point(POINTS.wheel),chimePoint=point(POINTS.chime),finish=point(POINTS.overlook),porchPoint=point(POINTS.porch),quietPoint=point(POINTS.quietGarden);
const memories=[{p:point([-19,-5]),text:'Mara’s copper feather. She whistled to the birds before every lesson.'},{p:point([-4,-20]),text:'Mara scratched this bell: “You’ll answer the far bank without me one day.”'},{p:point([11,-11]),text:'Mara’s knot, tied toward home. I still turn mine the wrong way.'}];
function caption(text,duration=4){$('#caption').textContent=text;$('#caption').style.opacity='1';captionEnd=state.t+duration;}
const waterDistance=p=>Math.min(Math.hypot(Math.max(2-p.x,0,p.x-31),p.z+3.35),Math.hypot(p.x-3,p.z+21));
const soundscape=createSoundscape();soundscape.setMuted(state.muted);
function sound(kind){soundscape.cue(kind);}
function updateUI(){
 const echoSolved=discoveries?.telemetry().echoSolved;
 $('#objective').textContent=state.complete?'The morning has a voice again':state.restored?'Cross the new bridge to the far bell':state.charged?'Carry the wind to the wheel':state.awakened&&echoSolved?'Catch the freed wind in the garden':state.awakened?'Ring the three listening bells':state.porchRead?'Follow the chime beneath the roots':'Read Mara’s note at the cottage';
 $('#chargeText').textContent=(state.charged?'Wind held in the bell':'Bell empty')+(state.keepsakes.size?' · '+state.keepsakes.size+'/3 keepsakes':'');$('#chargeIcon').textContent=state.charged?'✧':'◌';
 $('#sound').textContent='Sound: '+(state.muted?'off':'on');$('#motion').textContent='Gentle motion: '+(state.gentle?'on':'off');
}
function start(){if(!movement)return;state.started=true;state.paused=false;$('#title').hidden=true;for(const id of ['hud','charge','controls','hint','map'])$('#'+id).hidden=false;caption('Mara’s note is at the cottage. Read it to learn why the crossing fell silent.',6);soundscape.start().then(()=>sound('start')).catch(()=>{$('#audioUnlock').hidden=false;});if(matchMedia('(any-pointer: coarse)').matches)$('#audioUnlock').hidden=false;updateUI();}
function pause(on){if(!state.started)return;state.paused=on;soundscape.setPaused(on);$('#pausePanel').hidden=!on;}
function beginAction(kind,callback){state.action=kind;state.actionTime=0;state.actionTarget=(context?.kind==='wheel'?wheelPoint:context?.kind==='capture'?source:chimePoint).clone();state.actionCallback=callback;sound(kind);}
function action(){if(!state.started||state.paused||state.action)return;if(!context){caption('Listen. Watch the leaves. There is still a little wind here.',3);return;}
 if(context.kind==='discovery'){discoveries.interact(context.id,state);updateUI();return;}
 if(context.kind==='bound'){caption('The current is trapped in the listening bells. Ring the low, middle, then high bell to free it.',5);sound('chime');return;}
 if(context.kind==='porch'){state.porchRead=true;caption('Mara’s note: “The far bell cannot answer while the crossing is down. Wake the root chime, then follow its rising song.”',7);sound('chime');}
 if(context.kind==='chime'){beginAction('release',()=>{state.awakened=true;caption(discoveries.telemetry().echoSolved?'The bells answer the root chime. A current slips free into the garden.':'The root chime wakes three listening bells beneath the roots. Follow their rising notes.',4);});}
 if(context.kind==='capture')beginAction('capture',()=>{state.charged=true;caption('The freed wind gathers in your bell. Carry it back to the wheel and the crossing will open.',4);});
 if(context.kind==='wheel'){if(state.charged)beginAction('release',()=>{state.charged=false;state.restored=true;sound('restore');caption('The wheel has opened the crossing. The bridge reaches a new bank and the far bell.',5);});else caption('The wheel is empty. Wake the root chime, ring the three bells, then carry their wind here.',4);}
 if(context.kind==='memory'){state.keepsakes.add(context.index);caption(memories[context.index].text,5);sound('chime');}
 if(context.kind==='finish'){state.complete=true;caption(state.keepsakes.size?'The far bell answers. I know that note, Mara. I can take the morning watch.':state.porchRead?'The far bell answers. Your apprentice made it, Mara.':'A bell answers from the far bank. Someone once listened for this morning.',7);sound('restore');}
 updateUI();}
$('#startb').onclick=start;$('#action').onclick=action;$('#pause').onclick=()=>pause(true);$('#resume').onclick=()=>pause(false);
$('#audioUnlock').onclick=()=>soundscape.resume().then(()=>{$('#audioUnlock').hidden=true;sound('start');}).catch(()=>{});
for(const id of ['controls','world'])$('#'+id).addEventListener('pointerdown',()=>{if(state.started)soundscape.resume().then(()=>$('#audioUnlock').hidden=true).catch(()=>{});},{passive:true});
$('#sound').onclick=()=>{state.muted=!state.muted;soundscape.setMuted(state.muted);localStorage.setItem('bellkeeper-muted',state.muted?'1':'0');updateUI();};$('#motion').onclick=()=>{state.gentle=!state.gentle;localStorage.setItem('bellkeeper-gentle',state.gentle?'1':'0');updateUI();};
$('#reset').onclick=()=>{Object.assign(state,{charged:false,awakened:false,restored:false,complete:false,porchRead:false,recoveryUntil:0,action:null,actionCallback:null});state.keepsakes.clear();visited.clear();discoveries?.reset();cameraYaw=Math.atan2(.615,.788);movement.reset(START);animator.reset();travel=0;pause(false);updateUI();caption('Another morning. The woods are listening.',4);};
addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();if(!e.repeat)action();}if(e.code==='Escape')pause(!state.paused);});// Touch browsers can blur the window during native gestures while still visible.
// Actual backgrounding is handled by visibilitychange on every device.
addEventListener('blur',()=>{if(!matchMedia('(any-pointer: coarse)').matches&&state.started)pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.started)pause(true);});
for(const id of ['world','controls'])$('#'+id).addEventListener('contextmenu',e=>e.preventDefault());
// Wind ribbons and motes are original procedural effects rather than substitute scenery.
function ribbon(color){const g=new T.BufferGeometry(),p=new Float32Array(48*6),idx=[];for(let i=0;i<47;i++){const n=i*2;idx.push(n,n+1,n+2,n+1,n+3,n+2);}g.setAttribute('position',new T.BufferAttribute(p,3));g.setIndex(idx);const o=new T.Mesh(g,new T.MeshBasicMaterial({color,transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false}));o.frustumCulled=false;scene.add(o);return o;}
const winds=[ribbon(0xffedb0),ribbon(0x84ebcf),ribbon(0xdae4a6)],held=ribbon(0x92e4cd),transfer=ribbon(0xffefb5);
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
 if(!state.porchRead&&p.distanceTo(porchPoint)<1.55)context={kind:'porch',label:'Read the keeper’s note'};
 for(let i=0;i<memories.length;i++)if(!state.keepsakes.has(i)&&p.distanceTo(memories[i].p)<(i===0?.72:1.4)&&Math.abs(p.y-memories[i].p.y)<(i<2?.25:2))context={kind:'memory',index:i,label:'Keep the memory'};
 if(!state.awakened&&p.distanceTo(chimePoint)<2.1)context={kind:'chime',label:'Ring the chimes'};
 if(state.awakened&&!state.charged&&!state.restored&&p.distanceTo(source)<1.8)context=discoveries.telemetry().echoSolved?{kind:'capture',label:'Catch the current'}:{kind:'bound',label:'Listen to the tangled current'};
 if(!state.restored&&p.distanceTo(wheelPoint)<2.2)context={kind:'wheel',label:state.charged?'Give the wind':'Listen to the wheel'};
 if(state.restored&&!state.complete&&p.distanceTo(finish)<2.2)context={kind:'finish',label:'Answer the morning'};
 $('#action').disabled=!context||!!state.action;$('#action').innerHTML=(context?.label||'Listen & explore')+' <span>SPACE</span>';
 if(state.awakened&&!state.charged&&!state.restored&&p.distanceTo(quietPoint)<1.7&&!visited.has('quiet-pocket')){visited.add('quiet-pocket');caption('The roots shelter this pocket. The current doesn’t linger.',3);}
 const areas=[['cottage',point(POINTS.cottage),5,'Mara’s cottage. She left fresh ribbons by our tool pegs.'],['crossing',wheelPoint,4,state.restored?'The crossing sings again.':state.charged?'The wheel answers the current in your bell.':'The far bank is out of reach. A path curls back into the roots.'],['garden',source,6,'You hear a faint chime beneath the leaves.']];for(const [id,pnt,d,text] of areas)if(!visited.has(id)&&p.distanceTo(pnt)<d){visited.add(id);caption(text,4);}
}
function drawMap(){if(!mapCtx||!state.started)return;const w=mapCanvas.width,h=mapCanvas.height;mapCtx.clearRect(0,0,w,h);mapCtx.fillStyle='#193f3bd9';mapCtx.fillRect(0,0,w,h);const mx=x=>12+(x+22)/38*(w-24),my=z=>8+(20-z)/42*(h-16);
 mapCtx.fillStyle='#6d9f83';mapCtx.globalAlpha=.42;mapCtx.beginPath();mapCtx.roundRect(mx(-20),my(17),mx(4)-mx(-20),my(-2)-my(17),8);mapCtx.fill();mapCtx.globalAlpha=1;
 mapCtx.strokeStyle='#68c8b5';mapCtx.lineWidth=5;mapCtx.beginPath();mapCtx.moveTo(mx(2),my(-1.2));mapCtx.lineTo(mx(16),my(-4.5));mapCtx.stroke();
 mapCtx.strokeStyle=state.restored?'#f4e0a0':'#8cae9d';mapCtx.lineWidth=2;mapCtx.setLineDash(state.restored?[]:[4,3]);mapCtx.beginPath();PATH.forEach(([x,z],i)=>i?mapCtx.lineTo(mx(x),my(z)):mapCtx.moveTo(mx(x),my(z)));mapCtx.stroke();mapCtx.setLineDash([]);
 if(!state.restored){mapCtx.fillStyle='#e8c77a';mapCtx.font='9px system-ui';mapCtx.fillText('LOCKED',mx(8)-18,my(-9));}
 const poi=[['C',POINTS.cottage,'#f5d99a'],['W',POINTS.wheel,'#f5d99a'],['B',POINTS.chime,'#8ce1c8'],['G',POINTS.garden,'#d5ec9b'],['F',POINTS.overlook,state.restored?'#f5d99a':'#71877e']];for(const [label,[x,z],color] of poi){mapCtx.fillStyle=color;mapCtx.beginPath();mapCtx.arc(mx(x),my(z),3.5,0,Math.PI*2);mapCtx.fill();mapCtx.fillStyle='#fff0c9';mapCtx.font='9px system-ui';mapCtx.fillText(label,mx(x)+5,my(z)+3);}
 mapCtx.fillStyle='#fff0c9';mapCtx.beginPath();mapCtx.arc(mx(movement.position.x),my(movement.position.z),3,0,Math.PI*2);mapCtx.fill();mapCtx.font='8px system-ui';mapCtx.fillText('YOU',mx(movement.position.x)+5,my(movement.position.z)+3);
 mapCtx.font='8px system-ui';mapCtx.fillStyle='#fff0c9';mapCtx.fillText('C cottage · W wheel · B bells · F far bell',8,h-5);
}
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
// Drag empty scenery to look around; movement remains relative to the camera.
canvas.addEventListener('pointerdown',e=>{if(!state.started||state.paused)return;cameraDrag={id:e.pointerId,x:e.clientX};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(cameraDrag?.id!==e.pointerId)return;cameraYaw-=(e.clientX-cameraDrag.x)*.006;cameraDrag.x=e.clientX;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>cameraDrag=null);
addEventListener('keydown',e=>{if(state.started&&!state.paused&&['KeyQ','KeyE'].includes(e.code)){cameraYaw+=(e.code==='KeyQ'?-1:1)*.13;e.preventDefault();}});
const cameraTarget=new T.Vector3(...START);let vista=0,last=performance.now(),wasGrounded=true,lastMode='idle';
function frame(now){requestAnimationFrame(frame);const elapsed=(now-last)/1000;last=now;const dt=Math.max(0,Math.min(.05,elapsed));fps=T.MathUtils.lerp(fps,1/Math.max(.001,elapsed),.03);
 if(hero&&movement){if(!state.paused){state.t+=dt;waterfall.update(state.t);art.update?.(state.t,state.gentle,movement.position);movement.update(dt,{enabled:state.started,actionSlow:!!state.action,faceTarget:state.action?state.actionTarget:null});if(movement.recovered){state.recoveryUntil=state.t+.9;caption('A little current catches you and carries you back.',3);sound('capture');}const p=movement.position;travel+=movement.speed*dt;hero.position.copy(p);hero.rotation.y=state.started?movement.yaw:.35;
 if(state.action){state.actionTime+=dt;if(state.actionTime>.38&&state.actionCallback){state.actionCallback();state.actionCallback=null;updateUI();}if(state.actionTime>.68)state.action=null;}
 animator.update(dt,{time:state.t,action:state.action,actionProgress:state.actionTime/.68,charged:state.charged});poseStaff();discoveries?.update(dt,state.t,p,state);garden.update(dt,state.t,p,{...state,awakened:state.awakened&&discoveries.telemetry().echoSolved});soundscape.update(dt,{position:p,speed:movement.speed,grounded:movement.grounded,charged:state.charged,restored:state.restored,gardenDistance:p.distanceTo(source),waterDistance:waterDistance(p)});
 if(state.started){findContext();drawMap();for(const foot of animator.footfalls)sound('step');if(wasGrounded&&!movement.grounded&&movement.verticalVelocity>0)sound('jump');if(!wasGrounded&&movement.grounded)sound('land');}wasGrounded=movement.grounded;lastMode=movement.mode;
 winds.forEach((o,i)=>{o.visible=state.awakened&&!state.charged&&(discoveries.telemetry().echoSolved||state.restored);swirl(o,state.restored?finish:source,(state.restored?1.1:.5)+i*.12,state.t*(.8+i*.12)+i*2);});held.visible=state.charged||state.t<state.recoveryUntil;swirl(held,p,.45,state.t*2);
 transfer.visible=state.action==='release';if(transfer.visible){const from=staff.localToWorld(new T.Vector3(0,1.15,0)),to=state.actionTarget.clone().add(new T.Vector3(0,.85,0)),a=transfer.geometry.attributes.position;for(let i=0;i<48;i++){const f=T.MathUtils.clamp(state.actionTime/.68*1.6-i/47*.45,0,1),v=from.clone().lerp(to,f);v.y+=Math.sin(f*Math.PI)*.7;const width=.065*Math.sin(i/47*Math.PI);a.setXYZ(i*2,v.x,v.y-width,v.z);a.setXYZ(i*2+1,v.x,v.y+width,v.z);}a.needsUpdate=true;}

 for(let i=0;i<memoryGlows.length;i++){memoryGlows[i].visible=!state.keepsakes.has(i)&&(i!==1||state.charged||state.restored);memoryGlows[i].rotation.y+=dt;memoryGlows[i].position.y=memories[i].p.y+.4+Math.sin(state.t*2+i)*.08;}
 motes.rotation.y=state.gentle?0:Math.sin(state.t*.025)*.08;if(state.t>captionEnd)$('#caption').style.opacity='0';
 for(let i=0;i<54;i++){const h=insectHomes[i%insectHomes.length],a=i*2.39996+state.t*(.7+(i%3)*.12),r=.35+(i%9)*.08+Math.sin(state.t*1.7+i)*.06;insectPositions[i*3]=h[0]+Math.cos(a)*r;insectPositions[i*3+1]=height(h[0],h[1])+.52+(i%6)*.11+Math.sin(state.t*2.1+i)*.12;insectPositions[i*3+2]=h[1]+Math.sin(a)*r;}insectGeo.attributes.position.needsUpdate=true;
 }
 const pos=movement.position;vista=T.MathUtils.damp(vista,state.restored?1-T.MathUtils.smoothstep(pos.distanceTo(finish),2,7):0,3,dt);const ahead=.8+vista*1.5,sx=Math.sin(cameraYaw),sz=Math.cos(cameraYaw);cameraTarget.lerp(new T.Vector3(pos.x-sx*ahead,pos.y+1+vista*.6,pos.z-sz*ahead),1-Math.exp(-dt*7));const portrait=camera.aspect<.85;const distance=(portrait?11.5:10.8)+vista*2.5;camera.position.copy(cameraTarget).add(new T.Vector3(sx,.48-vista*.13,sz).normalize().multiplyScalar(distance));camera.lookAt(cameraTarget);sun.position.set(pos.x-9,pos.y+20,pos.z+8);sun.target.position.copy(pos);camera.updateMatrixWorld(true);if(!state.paused)world.update(dt,state.t,pos,state.restored,state.gentle,camera,state.charged,state.complete);
 renderer.render(scene,camera);window.__READY__=true;window.__GAME__={pos:[pos.x,pos.z],y:pos.y,fps,speed:movement.speed,mode:movement.mode,grounded:movement.grounded,score:state.complete?1:0,draws:renderer.info.render.calls,tris:renderer.info.render.triangles,charged:state.charged,awakened:state.awakened,restored:state.restored,paused:state.paused,started:state.started,porchRead:state.porchRead,quietObserved:visited.has('quiet-pocket'),keepsakes:state.keepsakes.size,travel,context:context?.kind||null,discoveryId:context?.id||null,discoveries:discoveries?.telemetry(),heroVersion:'approved-D',cameraYaw};
 }else renderer.render(scene,camera);
}
try{await art.ready;world=await buildWorld(scene,art);garden=await createGarden(scene,art);memories[0].p.copy(world.keepsakePoint);if(world.shortcutPoint)memories[1].p.copy(world.shortcutPoint);const character=await loadCodeCharacter(buildApprovedHero);hero=character.root;hero.userData.joints=hero.children[0].userData.joints;scene.add(hero);staff=await ASSET('./assets/staff.js');art.style(staff);staff.scale.setScalar(.73);staffHand=hero.userData.joints.rightHand;staffHand.add(staff);
 discoveries=await createWoodlandDiscoveries(scene,art,{caption,sound});
 movement=createMovement(T,{start:START,sampleGround:world.ground,blocked:world.blocked,stickElement:$('#stick'),jumpButton:$('#jump'),runButton:$('#run'),walkSpeed:1.65,runSpeed:5.8,acceleration:12,deceleration:16,turnResponse:12,cameraYaw:()=>cameraYaw});animator=createAdventureMotion(character,movement);hero.position.copy(movement.position);$('#startb').disabled=false;$('#startb').textContent='Step into the woods';updateUI();window.__START__=start;
}catch(e){console.error(e);$('#error').hidden=false;$('#error').textContent='The woodland could not load. '+e.message;}
requestAnimationFrame(frame);
