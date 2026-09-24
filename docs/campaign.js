// Campaign owns progression and wind effects, never locomotion, character meshes,
// saves, or the village ending. Main opens this chapter at the far bell by setting
// progress.entered=true, and handles checkpoint/home events via onChange ONLY.
export function createCampaign({THREE:T,scene,points,caption=()=>{},sound=()=>{},onChange=()=>{}}){
 const steps=['entered','bridge','service','inspection','returnCleared','returnAligned','outwardAligned','restored'];
 const progress=Object.fromEntries([...steps,'secret'].map(k=>[k,false]));
 const required=['entry','source','bridgeWheel','service','chamberEntry','inspection','returnWheel','returnVane','outwardVane','guardian','finalBell','homeLift'];
 for(const k of required)if(!points[k]||!['x','y','z'].every(a=>Number.isFinite(points[k][a])))throw new TypeError(`Campaign needs a world-space Vector3: points.${k}`);
 const p=Object.fromEntries(required.map(k=>[k,points[k].clone()]));
 if(points.secret)p.secret=points.secret.clone();
 const range=1.8, cycle=13;
 let position=null,active=false,chargeOrigin=null,announcement='',lastTime=null;
 const encounters={service:{clock:0,cycle:-1,phase:'telegraph',warned:false},guardian:{clock:0,cycle:-1,phase:'telegraph',warned:false}};
 const near=(a,b,r=range)=>a&&Math.hypot(a.x-b.x,a.z-b.z)<=r&&Math.abs(a.y-b.y)<=2;
 // A prompt answers wherever the hero touches what is drawn, not one exact spot:
 // the floor ring (range) plus [dx,dz,r] circles over each offset prop, matching
 // campaign-world placement (wheels -.8/-.65, pipe -.7/.8, vanes 0/-.95, bell 0/-.5).
 const catches=new Set(['source','chamberSource','serviceGust','guardianGust']),reach={service:2.1};
 const wheel=[[-1.45,-.65,.95],[-.8,-.65,.95],[-.15,-.65,.95]],footprint={bridgeWheel:wheel,inspection:wheel,returnWheel:wheel,source:[[-.7,.8,1.3]],returnVane:[[0,-.95,1.4]],outwardVane:[[0,-.95,1.4]],finalBell:[[0,-.5,2.1]]};
 const inside=(a,c)=>near(a,c.target,reach[c.id])||(footprint[c.id]||[]).some(([dx,dz,r])=>near(a,{x:p[c.id].x+dx,y:p[c.id].y,z:p[c.id].z+dz},r));
 const running=s=>s?.started===true&&!s.paused&&!s.complete;
 const emit=(text,cue='chime')=>{caption(text,5);sound(cue);};
 function changed(event={}){onChange({...progress},event);}
 function restart(){for(const e of Object.values(encounters))Object.assign(e,{clock:0,cycle:-1,phase:'telegraph',warned:false});announcement='';lastTime=null;}
 function phase(e){const f=e.clock%cycle;return f<3?'telegraph':f<4?'vent':f<12?'recovery':'rest';}
 function endpoint(id){
  if(id==='service')return p.service.clone().lerp(p.bridgeWheel,.3);
  // Each unsolved breath repeats safely; solving return switches the next
  // complete warning/vent/catch cycle to the opposite side of the platform.
  const side=progress.returnAligned?'outwardVane':'returnVane';
  return p.guardian.clone().lerp(p[side],.8);
 }
 function encounterInfo(id){const e=encounters[id];return {phase:phase(e),clock:e.clock,lane:id==='service'?'approach':progress.returnAligned?'outward':'return',stage:id==='guardian'?(progress.outwardAligned?2:progress.returnAligned?1:0):Number(progress.service),target:endpoint(id)};}
 function available(charged){
  if(!progress.entered)return [];
  const list=[],add=(id,label,target=p[id])=>list.push({kind:'campaign',id,label,target});
  if(!charged){add('source','Catch the rootway current');if(progress.service)add('chamberSource','Catch the inspection current',p.chamberEntry);}
  if(!progress.bridge)add('bridgeWheel',charged?'Give wind to the service bridge':'Listen to the bridge wheel');
  if(progress.bridge&&!progress.service){
   if(!charged&&phase(encounters.service)==='recovery')add('serviceGust','Catch the vented gust',endpoint('service'));
   add('service',charged?'Give wind to the exposed rotor':'Watch the marked vent lane');
  }
  if(progress.service&&!progress.inspection)add('inspection',charged?'Power the inspection shutter':'Read the inspection wheel');
  if(progress.inspection&&!progress.returnCleared)add('returnWheel',charged?'Clear the return roots':'Inspect the blocked return');
  if(progress.returnCleared&&!progress.outwardAligned){
   if(!charged&&phase(encounters.guardian)==='recovery')add('guardianGust',progress.returnAligned?'Catch the outward breath · 2/2':'Catch the return breath · 1/2',endpoint('guardian'));
   if(!progress.returnAligned)add('returnVane',charged?'Give the first breath to the return vane':'Watch the return lane · 1/2');
   else add('outwardVane',charged?'Give the second breath to the outward vane':'Watch the outward lane · 2/2');
   add('guardian','Watch the guardian’s marked lane');
  }
  if(progress.outwardAligned&&!progress.restored)add('finalBell','Ring the balanced bell');
  if(progress.restored)add('homeLift','Take the keeper’s lift home');
  if(p.secret&&!progress.secret&&progress.bridge)add('secret','Listen to the old bell fragment');
  return list;
 }
 function context(pos,charged){
  position=pos?.clone()||null;
  // Catch targets keep priority over nearby inspection prompts; otherwise nearest.
  const d=c=>Math.hypot(position.x-c.target.x,position.z-c.target.z);
  return available(charged).filter(c=>inside(position,c)).sort((a,b)=>catches.has(b.id)-catches.has(a.id)||d(a)-d(b))[0]||null;
 }
 function interact(ctx,state){
  if(!running(state)||!position||ctx?.kind!=='campaign')return;
  const current=available(state.charged).find(c=>c.id===ctx.id&&inside(position,c));
  if(!current)return;
  const id=current.id;
  if(['source','chamberSource','serviceGust','guardianGust'].includes(id)){
   if(state.charged)return;
   state.charged=true;chargeOrigin=id;
   emit(id==='serviceGust'?'The rotor is exposed. Give its own breath back while it rests.':id==='guardianGust'?(progress.returnAligned?'Second breath caught. Carry it to the outward vane; the return stays open.':'First breath caught. Carry it to the return vane and give the wind a way home.'):'The current gathers in your bell. It will stay with you, even if you stumble.','capture');
   return changed();
  }
  if(id==='homeLift')return changed({home:true});
  if(id==='secret'){progress.secret=true;emit('An old echo: “Leave a way for it to come home.”');return changed();}
  if(id==='guardian'){emit('The guardian is protecting the tree. Follow the widening ribbon, step beside it, then catch the spent gust.');return;}
  if(id==='finalBell'){
   progress.restored=true;emit('Out through the village. Back to the forest. The guardian breathes easily; the keeper’s lift is open.','restore');
   return changed({checkpoint:p.homeLift.clone()});
  }
  if(!state.charged){emit(id==='service'?'A line marks the vent. Stand beside it; catch the gust at its end when the rotor rests.':id==='returnVane'||id==='outwardVane'?`Breath ${progress.returnAligned?'2/2: the outward':'1/2: the return'} lane. Step beside its warning ribbon, then catch the guardian’s spent gust.`:'Catch a current first. The rootway pipe never runs dry; the chamber inlet also answers once the landing is safe.');return;}
  if(id==='service'&&(phase(encounters.service)!=='recovery'||chargeOrigin!=='serviceGust')){
   // A previously held source charge is useful, not a trap: the service rotor
   // accepts it as a harmless primer, freeing the bell for the taught catch.
   if(chargeOrigin!=='serviceGust'){state.charged=false;chargeOrigin=null;emit('The rotor takes a little wind, then vents it back. Step beside the line and catch its returning breath.','release');return changed();}
   emit('The rotor is closed during the vent. Your wind is safe; wait for its long recovery.');return;
  }
  if((id==='returnVane'||id==='outwardVane')&&chargeOrigin!=='guardianGust'){
   state.charged=false;chargeOrigin=null;emit('The vane releases this borrowed breath safely. Catch the guardian’s spent gust to match its rhythm.','release');return changed();
  }
  const key={bridgeWheel:'bridge',service:'service',inspection:'inspection',returnWheel:'returnCleared',returnVane:'returnAligned',outwardVane:'outwardAligned'}[id];
  if(!key)return;
  state.charged=false;chargeOrigin=null;progress[key]=true;
  if(key==='returnAligned'){Object.assign(encounters.guardian,{clock:0,cycle:-1,phase:'telegraph',warned:false});announcement='';}
  const lines={bridge:'The service bridge turns and locks. Follow the copper channel below the village.',service:'The little tender settles. It was trying to clear its own pressure. The inspection inlet is free.',inspection:'“What the village borrows, the forest receives.” Roots choke the return; the guardian shut the outward valve to protect the tree.',returnCleared:'The roots are clear. Breath 1/2: watch the guardian’s return lane, catch its spent gust, and power the return vane.',returnAligned:'One breath restored. The return stays open. Breath 2/2: move to the opposite, outward lane and catch the guardian’s next gust.',outwardAligned:'Both breaths restored. The guardian slows. Ring the central bell to complete its breath.'};
  emit(lines[key],'restore');
  return changed({checkpoint:p[key==='bridge'?'entry':key==='service'?'chamberEntry':key==='outwardAligned'?'finalBell':'chamberEntry'].clone()});
 }
 // Six inexpensive ribbon meshes, no replacement creature/environment models. The two
 // encounter lanes each carry one child vent plume (drawn only inside the lane footprint).
 const fx=new T.Group();fx.name='campaign-wind-effects';scene.add(fx);
 // Painted lane shader: uMode 0 telegraph band (saturated coral, chevrons scrolling toward
 // the vent end, a filling timing sweep and cream edges), 1 vent, 2 recovery catch glow,
 // 3 vent plume streaks, 4 calm flowing current. Visual only; footprint comes from strip().
 function fxMaterial(color,opacity=.75){const m=new T.MeshBasicMaterial({color,side:T.DoubleSide,transparent:true,opacity,depthWrite:false});const u=m.userData.u={uTime:{value:0},uMode:{value:4},uFill:{value:0}};
  m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,u);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vBkLane;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBkLane=uv;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vBkLane;uniform float uTime,uMode,uFill;').replace('#include <color_fragment>',`#include <color_fragment>
    float bkA=vBkLane.x,bkX=abs(vBkLane.y-.5)*2.;
    if(uMode<.5){float chev=step(.5,fract(bkA*9.-bkX*.9-uTime*1.8));float sweep=1.-step(uFill,bkA);
     diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.62,chev*(1.-sweep)*.55)+vec3(.06,.0,0.)*sweep;
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.93,.74),smoothstep(.80,.92,bkX));diffuseColor.a=mix(.95,.99,sweep);}
    else if(uMode<1.5){float st=step(.45,fract(bkA*6.-bkX*.9-uTime*7.));diffuseColor.rgb*=.8+.35*st;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.93,.74),smoothstep(.80,.92,bkX));diffuseColor.a=.96;}
    else if(uMode<2.5){diffuseColor.rgb+=vec3(.25,.35,.3)*smoothstep(.55,1.,bkA)*(.6+.4*sin(uTime*6.));diffuseColor.a*=mix(.35,1.,bkA);}
    else if(uMode<3.5){float st=smoothstep(.2,.8,fract(bkA*5.-uTime*9.+vBkLane.y*.5));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.95,.82),.3*st*vBkLane.y);diffuseColor.a*=(.82+.18*st)*smoothstep(0.,.1,bkA)*(1.-smoothstep(.88,1.,bkA));}
    else{float st=.5+.5*sin((bkA*14.-uTime*3.)*3.14159);diffuseColor.rgb*=.85+.3*st;diffuseColor.a*=(.55+.45*st)*(1.-.6*bkX);}`);};
  m.customProgramCacheKey=()=>'bk-fx-lane-v1';return m;}
 function strips(n){const g=new T.BufferGeometry(),a=new Float32Array(n*24*6),uv=new Float32Array(n*24*4),idx=[];for(let k=0;k<n;k++)for(let i=0;i<24;i++){uv.set([i/23,0,i/23,1],(k*24+i)*4);if(i<23){const q=(k*24+i)*2;idx.push(q,q+1,q+2,q+1,q+3,q+2);}}g.setAttribute('position',new T.BufferAttribute(a,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(idx);return g;}
 function ribbon(name,color){const mesh=new T.Mesh(strips(1),fxMaterial(color));mesh.name=name;mesh.frustumCulled=false;mesh.visible=false;fx.add(mesh);return mesh;}
 const ribbons={service:ribbon('service-lane',0xa3261a),guardian:ribbon('guardian-lane',0xa3261a),source:ribbon('rootway-current',0x8be5d0),chamber:ribbon('inspection-current',0x8be5d0),return:ribbon('return-flow',0x8be5d0),outward:ribbon('outward-flow',0xffe6ad)};
 const plumes={};for(const id of ['service','guardian']){const m=new T.Mesh(strips(3),fxMaterial(0xff7a3d,.95));m.name=id+'-vent-plume';m.frustumCulled=false;m.visible=false;m.material.userData.u.uMode.value=3;ribbons[id].add(m);plumes[id]=m;}
 // Piecewise-linear taper matches the actual 24-section mesh, including ends.
 function laneWidth(f,width){const sample=f*23,i=Math.min(22,Math.floor(sample)),u=sample-i;const taper=n=>.35+.65*Math.sin(n/23*Math.PI);return width*(taper(i)*(1-u)+taper(i+1)*u);}
 function strip(mesh,a,b,width,time,wave=false){const attr=mesh.geometry.attributes.position,dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;for(let i=0;i<24;i++){const f=i/23,x=a.x+dx*f,y=a.y+(b.y-a.y)*f+.12+(wave?.15*Math.sin(f*9-time*2):0),z=a.z+dz*f;const w=laneWidth(f,width);attr.setXYZ(i*2,x-dz/len*w,y,z+dx/len*w);attr.setXYZ(i*2+1,x+dz/len*w,y,z-dx/len*w);}attr.needsUpdate=true;}
 // Three spiralling blades form one thick rolling vent. Every vertex stays within the
 // lane's own half-width, so the drawn gust never reaches past the buffet footprint.
 function plume(mesh,a,b,height,grow,time,gentle){const attr=mesh.geometry.attributes.position,dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,sx=-dz/len,sz=dx/len,spin=gentle?4:13;
  for(let k=0;k<3;k++)for(let i=0;i<24;i++){const f=i/23*grow,x=a.x+dx*f,z=a.z+dz*f,y=a.y+(b.y-a.y)*f+height*(1-.72*f),r=laneWidth(f,.65)*.92,th=f*7-time*spin+k*2.094,c=Math.cos(th),s=Math.sin(th);
   const o=(k*24+i)*2;attr.setXYZ(o,x+sx*c*r,y+s*r*.8,z+sz*c*r);attr.setXYZ(o+1,x+sx*c*r*.12,y+s*r*.1,z+sz*c*r*.12);}attr.needsUpdate=true;}
 function draw(time,state){
  fx.visible=progress.entered;for(const m of Object.values(ribbons))m.visible=false;
  for(const m of Object.values(ribbons))m.material.userData.u.uTime.value=state.gentle?time*.35:time;
  if(!progress.entered)return;
  for(const id of ['service','guardian']){
   const enabled=id==='service'?progress.bridge&&!progress.service:progress.returnCleared&&!progress.outwardAligned;
   const e=encounters[id],m=ribbons[id],ph=phase(e),c=e.clock%cycle,u=m.material.userData.u;m.visible=enabled&&ph!=='rest';
   const end=endpoint(id);m.material.color.setHex(ph==='recovery'?0x8be5d0:ph==='vent'?0xd8502a:0xa3261a);
   u.uMode.value=ph==='telegraph'?0:ph==='vent'?1:2;u.uFill.value=ph==='telegraph'?c/3:1;
   // Telegraph and active lane use the SAME footprint; recovery contracts to
   // the catch endpoint rather than suggesting the entire lane is catchable.
   strip(m,ph==='recovery'?end.clone().lerp(p[id],.12):p[id],end,ph==='telegraph'?.2+.45*c/3:.65,time,ph==='recovery'&&!state.gentle);
   // Vent plume: snaps to full length in .12 s, rolls for the vent, then thins out
   // over the first .6 s of recovery (the same window the lane contracts to its end).
   const pl=plumes[id],vt=c-3;pl.visible=m.visible&&vt>=0&&vt<1.6;
   if(pl.visible){pl.material.userData.u.uTime.value=state.gentle?time*.35:time;pl.material.opacity=.92*(vt<1?1:1-(vt-1)/.6);plume(pl,p[id],end,id==='guardian'?1.35:.55,Math.min(1,vt/.12),time,state.gentle);}
  }
  for(const [id,key,enabled] of [['source','source',!state.charged],['chamber','chamberEntry',progress.service&&!state.charged]]){const m=ribbons[id];m.visible=enabled;const a=p[key],b=a.clone();b.y+=.9;b.x+=.3;strip(m,a,b,.16,time,!state.gentle);}
  for(const [id,key,enabled] of [['return','returnVane',progress.returnAligned],['outward','outwardVane',progress.outwardAligned]]){const m=ribbons[id];m.visible=enabled;strip(m,id==='return'?p.guardian:p[key],id==='return'?p[key]:p.guardian,progress.restored?.26:.16,time,!state.gentle);}
 }
 function update(dt,t,pos,state){
  position=pos?.clone()||null;active=running(state);
  if(!active)return; // Pause freezes clocks AND geometry, including reduced motion.
  if(lastTime!==null&&t<lastTime)restart();lastTime=t;
  if(progress.entered){
   for(const id of ['service','guardian']){
    const enabled=id==='service'?progress.bridge&&!progress.service:progress.returnCleared&&!progress.outwardAligned;
    if(!enabled||!near(position,p[id],10))continue;
    const e=encounters[id];e.clock+=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
    const ph=phase(e),n=Math.floor(e.clock/cycle),token=`${id}:${n}:${ph}`;
    if(n!==e.cycle){e.cycle=n;e.warned=false;}
    if(ph!==e.phase||announcement===''){
     e.phase=ph;if(announcement!==token&&ph==='telegraph'){announcement=token;emit(id==='service'?'The tender draws breath. A widening line shows where it will vent. Step beside it.':`The guardian draws breath toward the ${encounterInfo(id).lane} lane. Step beside the ribbon.`,'chime');}
     if(ph==='recovery'){announcement=token;emit('The gust has softened. Catch it at the glowing end of the ribbon.','capture');}
    }
    if(ph==='vent'&&!e.warned&&position){
     const a=p[id],b=endpoint(id),dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz;
     const f=((position.x-a.x)*dx+(position.z-a.z)*dz)/(len||1);
     const q=a.clone().lerp(b,f);
     // Player-centre contact only: no radius inflation or invisible end caps.
     if(len>0&&f>=0&&f<=1&&near(position,q,laneWidth(f,.65))){
      e.warned=true;caption('A soft buffeting gust. Step sideways; your held wind is safe.',3);sound('land');
      // Main owns the safe physical hop. Mark contact before notifying it so a
      // stationary player cannot receive another impulse during this vent.
      const distance=Math.sqrt(len)||1;
      changed({buffet:{x:dx/distance*3,z:dz/distance*3}});
     }
    }
   }
  }
  draw(Number.isFinite(t)?t:0,state);
 }
 function objective(){return !progress.entered?'Answer the far bell':!progress.bridge?'Catch the rootway current; turn the service bridge':!progress.service?'Step beside the vent; catch its gust and settle the tender':!progress.inspection?'Catch the chamber current; power the inspection shutter':!progress.returnCleared?'Give wind to the clearing wheel on the return channel':!progress.returnAligned?'Breath 1/2: catch the guardian’s return gust; power the return vane':!progress.outwardAligned?'Breath 2/2: catch the opposite-lane gust; power the outward vane':!progress.restored?'Ring the central bell: let both channels breathe':'Take the keeper’s lift home; return to Mara';}
 function serialize(){return {version:1,progress:{...progress},chargeOrigin};}
 function restore(data){
  const saved=data?.version===1&&data.progress&&typeof data.progress==='object'?data.progress:{};
  let valid=true;for(const k of steps){valid=valid&&saved[k]===true;progress[k]=valid;}progress.secret=progress.bridge&&saved.secret===true;
  chargeOrigin=['source','chamberSource','serviceGust','guardianGust'].includes(data?.chargeOrigin)?data.chargeOrigin:null;
  position=null;active=false;restart();for(const m of Object.values(ribbons))m.visible=false;for(const m of Object.values(plumes))m.visible=false;fx.visible=progress.entered;
  return changed();
 }
 function reset(){restore(null);}
 function telemetry(){return {progress:{...progress},objective:objective(),active,chargeOrigin,service:encounterInfo('service'),guardian:encounterInfo('guardian'),effects:fx.children.length};}
 return {progress,context,interact,update,objective,serialize,restore,reset,telemetry};
}
