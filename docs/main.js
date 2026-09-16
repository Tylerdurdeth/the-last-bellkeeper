import * as T from 'three';
import {ASSET,bakeStatic} from './assetlib.js';
const $=s=>document.querySelector(s), canvas=$('#world');
const scene=new T.Scene();scene.background=new T.Color('#b7d7cf');scene.fog=new T.FogExp2('#b7d7cf',.035);
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
const camera=new T.PerspectiveCamera(36,1,.1,150);
scene.add(new T.HemisphereLight(0xfff0c9,0x245958,1.4));
const sun=new T.DirectionalLight(0xffe6af,2.7);sun.position.set(-8,15,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:.5,far:40});sun.shadow.bias=-.00025;sun.shadow.normalBias=.02;scene.add(sun);
const state={started:false,paused:false,charged:false,restored:false,t:0,phase:0,speed:0,action:0,actionKind:'',muted:localStorage.getItem('bellkeeper-muted')==='1',gentle:localStorage.getItem('bellkeeper-gentle')==='1'};
const pos=new T.Vector3(0,.55,3.2),vel=new T.Vector2(),keys=new Set(),stick=new T.Vector2();let hero,joints,wheel,gate,staff,hipBase,rootScale=1,captionUntil=0,footPhase=0,audio;
let rotor,door,lanterns=[],foliage=[],originalMaterials=new Map();
const source=new T.Vector3(-3,.58,1.4),target=new T.Vector3(3,.58,-1.2);
const objects=[];
function style(root,character=false){root.traverse(n=>{if(!n.isMesh)return;n.castShadow=n.receiveShadow=true;const mats=Array.isArray(n.material)?n.material:[n.material];const mapped=mats.map(m=>{const key=m.uuid+'-'+character;if(originalMaterials.has(key))return originalMaterials.get(key);let mat;
 if(character && m.name!=='metal'){const gradient=new T.DataTexture(new Uint8Array([92,180,255]),3,1,T.RedFormat);gradient.needsUpdate=true;gradient.minFilter=gradient.magFilter=T.NearestFilter;mat=new T.MeshToonMaterial({color:m.color,gradientMap:gradient,side:m.side});}
 else {mat=m.clone();mat.roughness=m.name==='metal'?.43:.92;mat.metalness=m.name==='metal'?.35:0;}
 originalMaterials.set(key,mat);return mat;});n.material=Array.isArray(n.material)?mapped:mapped[0];});}
async function asset(name,opts={}){const o=await ASSET('./assets/'+name+'.js',opts);style(o,name==='hero');return o;}
function caption(text,seconds=4){$('#caption').textContent=text;$('#caption').style.opacity='1';captionUntil=state.t+seconds;}
function sound(kind){if(state.muted)return;try{audio??=new AudioContext();audio.resume();const now=audio.currentTime;const freqs=kind==='capture'?[440,660,880]:kind==='restore'?[330,440,554,660]:kind==='hazard'?[130,110]:kind==='step'?[95]:[523,784];freqs.forEach((f,i)=>{const osc=audio.createOscillator(),gain=audio.createGain();osc.type=kind==='step'?'triangle':'sine';osc.frequency.setValueAtTime(f,now+i*.07);gain.gain.setValueAtTime(.0001,now+i*.07);gain.gain.exponentialRampToValueAtTime(kind==='step'?.016:.09,now+i*.07+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+i*.07+(kind==='step'?.08:.8));osc.connect(gain);gain.connect(audio.destination);osc.start(now+i*.07);osc.stop(now+i*.07+1);});}catch(e){console.warn('Audio unavailable',e.message);}}
function updateUI(){ $('#chargeText').textContent=state.charged?'Wind in the bell':'Bell empty';$('#chargeIcon').textContent=state.charged?'✧':'◌';$('#action').innerHTML=(state.charged?'Release wind':'Catch wind')+' <span>SPACE</span>';$('#objective').textContent=state.restored?'The terrace is breathing again':state.charged?'Carry the gust to the seed wheel':'Find the wandering gust';$('#sound').textContent='Sound: '+(state.muted?'off':'on');$('#motion').textContent='Gentle motion: '+(state.gentle?'on':'off');}
function start(){if(!hero)return;state.started=true;state.paused=false;$('#title').hidden=true;$('#hud').hidden=$('#controls').hidden=$('#charge').hidden=$('#hint').hidden=false;caption('A wandering gust is circling the left lantern. Bring it to the copper wheel.',6);sound('release');updateUI();}
function pause(v){if(!state.started)return;state.paused=v;$('#pausePanel').hidden=!v;keys.clear();stick.set(0,0);$('#knob').style.transform='';}
function action(){if(!state.started||state.paused||state.action>0)return;
 if(!state.charged){if(pos.distanceTo(source)<1.65){state.charged=true;state.action=.75;state.actionKind='capture';sound('capture');caption('Hold that little current. The seed wheel is across the terrace.');}else caption('Move close to the drifting leaves beside the left lantern.',3);}
 else {state.action=.85;state.actionKind='release';if(pos.distanceTo(target)<2.4){state.restored=true;state.charged=false;sound('restore');caption('There. The return channel is open — the morning can move again.',6);}else{caption('Too far from the wheel. Your bell keeps the gust.',3);sound('release');}}
 updateUI();}
$('#startb').onclick=start;window.__START__=start;$('#action').onclick=action;$('#pause').onclick=()=>pause(true);$('#resume').onclick=()=>pause(false);$('#sound').onclick=()=>{state.muted=!state.muted;localStorage.setItem('bellkeeper-muted',state.muted?'1':'0');updateUI();};$('#motion').onclick=()=>{state.gentle=!state.gentle;localStorage.setItem('bellkeeper-gentle',state.gentle?'1':'0');updateUI();};$('#reset').onclick=()=>{state.charged=state.restored=false;state.action=0;pos.set(0,.55,3.2);vel.set(0,0);pause(false);caption('Another quiet morning. Find the wandering gust.');updateUI();};
window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'){pause(!state.paused);return;}if(e.code==='Space'&&!e.repeat)action();keys.add(e.code);});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();stick.set(0,0);if(state.started)pause(true);});
let stickId=null;function stickMove(e){const r=$('#stick').getBoundingClientRect();stick.set((e.clientX-r.left-r.width/2)/40,(e.clientY-r.top-r.height/2)/40);if(stick.length()>1)stick.normalize();$('#knob').style.transform=`translate(${stick.x*34}px,${stick.y*34}px)`;}
$('#stick').addEventListener('pointerdown',e=>{e.preventDefault();stickId=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);stickMove(e);});$('#stick').addEventListener('pointermove',e=>{if(e.pointerId===stickId)stickMove(e);});function releaseStick(){stickId=null;stick.set(0,0);$('#knob').style.transform='';}$('#stick').addEventListener('pointerup',releaseStick);$('#stick').addEventListener('pointercancel',releaseStick);
// Light ribbons are procedural effects, not imported object geometry.
function ribbon(color,width=1){const points=Array.from({length:48},()=>new T.Vector3());const geo=new T.BufferGeometry().setFromPoints(points);const mat=new T.LineBasicMaterial({color,transparent:true,opacity:.8});const line=new T.Line(geo,mat);scene.add(line);return line;}
const gusts=[ribbon(0xfff0c9),ribbon(0x62c9bc),ribbon(0x90ae68)],chargeRibbon=ribbon(0x62c9bc),releaseRibbon=ribbon(0xfff0c9);chargeRibbon.visible=false;releaseRibbon.visible=false;
function circleLine(line,center,r,t,vertical=.25){const p=line.geometry.attributes.position;for(let i=0;i<p.count;i++){const a=i/(p.count-1)*Math.PI*1.7+t;p.setXYZ(i,center.x+Math.cos(a)*r,center.y+.7+Math.sin(a*1.8+t)*vertical,center.z+Math.sin(a)*r);}p.needsUpdate=true;line.geometry.computeBoundingSphere();}
let hazard=0,prevHazard=0,restoration=0,lastStep=-1;
function animateHero(dt){const j=joints;const moving=state.speed>.03;const blend=Math.min(1,state.speed/1.7);footPhase+=state.speed*dt/.7;const cycle=footPhase%1;
 const stride=.19,scale=rootScale;
 for(const [side,offset] of [['left',0],['right',.5]]){const p=(cycle+offset)%1;let z,lift;if(p<.60){z=stride*(1-2*p/.6);lift=0;}else{const s=(p-.6)/.4;z=stride*(-1+2*s);lift=Math.sin(s*Math.PI)*.105;}
 z*=blend;lift*=blend;const L1=.23,L2=.205;const y=-.426+lift;const d=Math.min(L1+L2-.001,Math.hypot(y,z));const beta=Math.acos(T.MathUtils.clamp((L1*L1+d*d-L2*L2)/(2*L1*d),-1,1));const knee=Math.PI-Math.acos(T.MathUtils.clamp((L1*L1+L2*L2-d*d)/(2*L1*L2),-1,1));const upper=-Math.atan2(z,-y)-beta;
 j[side+'UpperLeg'].rotation.x=upper;j[side+'LowerLeg'].rotation.x=knee;j[side+'Foot'].rotation.x=-upper-knee;
 j[side+'UpperArm'].rotation.x=Math.sin(cycle*Math.PI*2+(side==='left'?Math.PI:0))*.35*blend;
 j[side+'LowerArm'].rotation.x=-.18-Math.max(0,Math.sin(cycle*Math.PI*2))*.12*blend;
 }
 j.hips.position.y=hipBase+(state.gentle?0:Math.sin(cycle*Math.PI*4)*.008*blend);j.head.rotation.y=Math.sin(state.t*.55)*.045*(1-blend);j.head.rotation.x=-.035;
 j.coatLeft.rotation.x=-.07+Math.sin(cycle*Math.PI*2)*.10*blend;j.coatRight.rotation.x=-.07-Math.sin(cycle*Math.PI*2)*.10*blend;
 j.rightUpperArm.rotation.x=-.20+Math.sin(cycle*Math.PI*2)*.09*blend;j.rightLowerArm.rotation.x=-.24;
 if(state.action>0){const a=Math.sin((1-state.action/(state.actionKind==='capture'?.75:.85))*Math.PI);j.rightUpperArm.rotation.x-=a*.65;j.leftUpperArm.rotation.x=-a*.8;j.leftLowerArm.rotation.x=-a*.5;j.head.rotation.x=-a*.1;}
 if(moving){const step=Math.floor(footPhase*2);if(step!==lastStep){sound('step');lastStep=step;}}
}
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();
const forward=new T.Vector2(-.615,-.788),right=new T.Vector2(.788,-.615);
let last=performance.now(),fps=60;function frame(now){requestAnimationFrame(frame);const elapsed=(now-last)/1000;last=now;fps=T.MathUtils.lerp(fps,1/Math.max(.001,elapsed),.04);const dt=Math.min(elapsed,.04);
 if(!state.paused){state.t+=dt;if(state.action>0)state.action=Math.max(0,state.action-dt);
 if(hero&&state.started){let x=stick.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);let y=-stick.y+(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);const mag=Math.min(1,Math.hypot(x,y));const desired=right.clone().multiplyScalar(x).addScaledVector(forward,y);if(desired.length())desired.normalize().multiplyScalar(mag*(state.action>0?.4:2.15));vel.lerp(desired,1-Math.exp(-dt*14));const old=pos.clone();pos.x+=vel.x*dt;pos.z+=vel.y*dt;
 const edge=Math.sqrt((pos.x/6.4)**2+(pos.z/4.65)**2);if(edge>1){pos.x/=edge;pos.z/=edge;}
 for(const ob of [{x:-3.5,z:-2.9,r:1.13},{x:3,z:-1.2,r:.85}]){const dx=pos.x-ob.x,dz=pos.z-ob.z,d=Math.hypot(dx,dz);if(d<ob.r){pos.x=ob.x+dx/Math.max(.001,d)*ob.r;pos.z=ob.z+dz/Math.max(.001,d)*ob.r;}}
 state.speed=old.distanceTo(pos)/dt;if(state.speed>.06){const angle=Math.atan2(vel.x,vel.y);hero.rotation.y+=T.MathUtils.euclideanModulo(angle-hero.rotation.y+Math.PI,Math.PI*2)-Math.PI;}
 hero.position.copy(pos);animateHero(dt);
 // A pressure puff is telegraphed at the un-restored wheel; safe shove, no damage/reset.
 const cycle=state.t%7;hazard=!state.restored&&cycle>4?cycle<5.5?1:2:0;if(hazard===1&&prevHazard!==1&&pos.distanceTo(target)<3.2)caption('The wheel is coughing. Give the pale ring a little room.',2);if(hazard===2&&prevHazard!==2&&pos.distanceTo(target)<2.05){const away=pos.clone().sub(target).normalize();pos.addScaledVector(away,.45);sound('hazard');caption('Just a pressure puff. Keep your footing — your gust is safe.',3);}prevHazard=hazard;
 }else if(hero){hero.rotation.y=.3;animateHero(dt);}
 restoration=T.MathUtils.damp(restoration,state.restored?1:0,2,dt);if(rotor)rotor.rotation.z+=dt*(.04+restoration*1.3);if(door)door.rotation.y=-restoration*1.65;
 lanterns.forEach((o,i)=>{o.scale.setScalar(.75+restoration*.12);o.rotation.z=state.gentle?0:Math.sin(state.t*.9+i*.2)*.035;});foliage.forEach((o,i)=>{o.rotation.z=state.gentle?0:Math.sin(state.t*.9+i*.3)*.025;});
 gusts.forEach((line,i)=>{circleLine(line,source,.62+i*.08,state.t*(.7+i*.06)+i*2,.18);line.material.opacity=state.charged?.15:.7;});chargeRibbon.visible=state.charged;if(hero)circleLine(chargeRibbon,pos,.45,state.t*2,.21);
 releaseRibbon.visible=hazard>0||state.actionKind==='release'&&state.action>0;if(releaseRibbon.visible){circleLine(releaseRibbon,target,hazard===1?1.6:2,state.t*2,.03);releaseRibbon.material.color.setHex(hazard===2?0xfff0c9:0x62c9bc);}
 if(state.t>captionUntil)$('#caption').style.opacity='0';
 }
 const portrait=camera.aspect<.85;const look=new T.Vector3((state.started?pos.x*.30:0),.9,(state.started?pos.z*.23:0));const distance=portrait?23:18.8;const offset=new T.Vector3(.615,.95,.788).normalize().multiplyScalar(distance);camera.position.copy(look).add(offset);camera.lookAt(look);
 renderer.render(scene,camera);window.__GAME__={pos:[pos.x,pos.z],fps,speed:state.speed,score:state.restored?1:0,over:false,draws:renderer.info.render.calls,tris:renderer.info.render.triangles,charged:state.charged,restored:state.restored,paused:state.paused,started:state.started};}
requestAnimationFrame(frame);
try {
 const terrace=await asset('terrace');scene.add(terrace);objects.push(terrace);
 const tree=await asset('tree');tree.position.set(-3.5,.55,-2.9);tree.scale.setScalar(1.0);scene.add(tree);
 hero=await asset('hero',{keepHierarchy:true});joints=hero.userData.joints;hipBase=joints.hips.position.y;rootScale=hero.children[0].scale.x;hero.position.copy(pos);scene.add(hero);
 staff=await asset('staff');const grip=hero.userData.grip||joints.rightHand;staff.position.set(0,-.365,.0);grip.add(staff);
 wheel=await asset('wheel',{keepHierarchy:true});wheel.position.copy(target);scene.add(wheel);rotor=wheel.userData.rotor;
 gate=await asset('gate',{keepHierarchy:true});gate.position.set(4.9,.55,-2.4);gate.rotation.y=-.45;scene.add(gate);door=gate.userData.door;
 for(const [x,z] of [[-3,1.4],[-5,-.8],[-.6,-3.8],[2.1,-3.6],[4,1],[1.4,4]]){const l=await asset('lantern');l.position.set(x,.60,z);scene.add(l);lanterns.push(l);}
 for(let i=0;i<15;i++){const t=i/15*Math.PI*2;const o=await asset('foliage');o.position.set(Math.cos(t)*6.45,.53,Math.sin(t)*4.9);o.scale.setScalar(.60+(i%3)*.12);o.rotation.y=t;scene.add(o);foliage.push(o);}
 for(const [x,z,s] of [[-11,-13,1.2],[5,-18,1.3],[13,-15,.9]]){const w=await asset('windworks');w.position.set(x,-.8,z);w.scale.setScalar(s);scene.add(w);}
 // Distant reused tree silhouettes anchor depth without new mesh sources.
 for(const [x,z,s] of [[-14,-15,3.8],[0,-26,4.1],[17,-20,4.4],[-18,0,3.7]]){const t=await asset('tree');t.position.set(x,-23,z);t.scale.setScalar(s);scene.add(t);}
 // Grouped planting around the tree and outer bank creates deliberate density, leaving the action route open.
 for(let i=0;i<19;i++){const angle=i*2.3999;const radius=.7+(i%4)*.6;const o=await asset('foliage');o.position.set(-3.6+Math.cos(angle)*radius,.55,-2.9+Math.sin(angle)*radius*.65);o.scale.setScalar(.7+(i%3)*.2);o.rotation.y=angle;scene.add(o);foliage.push(o);}
 // A smaller reused terrace holds distant windworks, so its architecture is visibly supported.
 for(const [x,z,s] of [[-11,-13,.40],[5,-18,.43],[13,-15,.32]]){const bank=await asset('terrace');bank.position.set(x,-1.05,z);bank.scale.setScalar(s);scene.add(bank);}
 window.__READY__=true;$('#startb').disabled=false;$('#startb').textContent='Enter the terrace';updateUI();
}catch(e){console.error(e);$('#error').hidden=false;$('#error').textContent='The terrace could not load. '+e.message;$('#startb').textContent='Loading failed';}
