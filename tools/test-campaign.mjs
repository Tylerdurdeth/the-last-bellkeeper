import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCampaign} from '../game/campaign.js';

const coordinates={entry:[8,-17],source:[5,-22],bridgeWheel:[5,-28],service:[8,-37],chamberEntry:[8,-45],inspection:[4,-50],returnWheel:[0,-56],returnVane:[5,-59],outwardVane:[11,-59],guardian:[8,-63],finalBell:[8,-67],homeLift:[15,-50]};
// Deliberately sloped, nonzero elevations: controller must not assume a floor.
const points=Object.fromEntries(Object.entries(coordinates).map(([k,[x,z]])=>[k,new THREE.Vector3(x,2+z*.01,z)]));
function fixture(){const scene=new THREE.Scene(),events=[],captions=[],state={started:true,paused:false,complete:false,charged:false};const campaign=createCampaign({THREE,scene,points,caption:t=>captions.push(t),onChange:(p,e)=>events.push({p,e})});return {campaign,state,scene,events,captions};}
let assertions=0;
function check(condition,message){assert.ok(condition,message);assertions++;}
function at(f,id,position=points[id]){const c=f.campaign.context(position,f.state.charged);check(c?.id===id,`Expected ${id}, got ${c?.id}`);const count=f.events.length,result=f.campaign.interact(c,f.state);check(result===undefined,'Events are callback-only');return f.events.length>count?f.events.at(-1).e:undefined;}
function advance(f,seconds,position,hz=60){for(let i=0;i<Math.ceil(seconds*hz);i++)f.campaign.update(1/hz,i/hz+100,position,f.state);}
function waitRecovery(f,id,hz=60){let t=0;while(f.campaign.telemetry()[id].phase!=='recovery'&&t<15){f.campaign.update(1/hz,1000+t,points[id],f.state);t+=1/hz;}check(f.campaign.telemetry()[id].phase==='recovery',`${id} exposes a catch window`);}

for(const hz of [30,60,120]){
 const f=fixture(),c=f.campaign,s=f.state;
 check(c.context(points.source,false)===null,'Inactive until far bell');
 c.progress.entered=true;
 const forged={kind:'campaign',id:'finalBell',target:points.finalBell};c.context(points.finalBell,true);c.interact(forged,s);check(!c.progress.restored,'Out-of-order bell rejected');
 at(f,'source');check(s.charged,'Repeatable source catches');
 const bridgeContext=c.context(points.bridgeWheel,true);c.update(0,1,points.source,s);c.interact(bridgeContext,s);check(!c.progress.bridge&&s.charged,'Moved-away stale target rejected');
 const event=at(f,'bridgeWheel');check(c.progress.bridge&&!s.charged&&event.checkpoint.equals(points.entry),'Bridge consumes charge, emits real checkpoint');
 at(f,'source');at(f,'service');check(!c.progress.service&&!s.charged,'Unmatched charge primes but cannot skip tender catch');
 waitRecovery(f,'service',hz);at(f,'serviceGust',c.telemetry().service.target);check(s.charged,'Recovery gust caught');
 // Fall/recovery and waiting never drain a captured charge.
 advance(f,1,new THREE.Vector3(0,-30,0),hz);check(s.charged,'Falling preserves held wind');
 const saved=c.serialize(),reloaded=fixture();reloaded.state.charged=s.charged;reloaded.campaign.restore(JSON.parse(JSON.stringify(saved)));
 check(reloaded.campaign.telemetry().service.phase==='telegraph','Reload restarts safe telegraph');
 at(reloaded,'service');check(!reloaded.campaign.progress.service&&reloaded.state.charged,'Closed rotor preserves charge after reload');
 waitRecovery(reloaded,'service',hz);at(reloaded,'service');check(reloaded.campaign.progress.service,'One captured cycle settles tender after reload');
 const g=reloaded,d=g.campaign;
 at(g,'chamberSource',points.chamberEntry);at(g,'inspection');check(d.progress.inspection,'Inspection powers before revelation');
 check(g.captions.some(t=>t.includes('Roots choke the return')),'Blocked return is disclosed');
 at(g,'chamberSource',points.chamberEntry);at(g,'returnWheel');
 at(g,'chamberSource',points.chamberEntry);at(g,'returnVane');
 check(d.progress.returnCleared&&!d.progress.returnAligned&&!g.state.charged,'Ordinary source primes return but cannot solve breath one');
 check(d.objective().includes('1/2'),'Objective identifies first guardian breath');
 const before=d.telemetry().guardian.clock;g.state.paused=true;advance(g,2,points.guardian,hz);check(d.telemetry().guardian.clock===before,'Pause freezes encounter');
 g.state.paused=false;waitRecovery(g,'guardian',hz);
 const lane=d.telemetry().guardian.lane,firstTarget=d.telemetry().guardian.target;
 check(lane==='return','First guardian breath marks return lane before return alignment');
 at(g,'guardianGust',firstTarget);d.restore(JSON.parse(JSON.stringify(d.serialize())));
 check(g.state.charged&&d.telemetry().chargeOrigin==='guardianGust','Held first guardian gust survives reload');
 at(g,'returnVane');check(d.progress.returnAligned&&!g.state.charged,'First captured guardian gust opens return');
 check(d.telemetry().guardian.phase==='telegraph'&&d.telemetry().guardian.lane==='outward','Second breath starts fresh warning in opposite lane');
 check(d.context(d.telemetry().guardian.target,false)?.id!=='guardianGust','Cannot recatch the first recovery to skip second cycle');
 check(d.telemetry().guardian.target.distanceTo(firstTarget)>4,'Opposite lane requires repositioning');
 check(d.objective().includes('2/2'),'Objective identifies second breath');
 d.restore(JSON.parse(JSON.stringify(d.serialize())));check(d.progress.returnAligned&&d.telemetry().guardian.lane==='outward','Reload preserves first breath and safe second-lane restart');
 at(g,'chamberSource',points.chamberEntry);at(g,'outwardVane');check(!d.progress.outwardAligned&&!g.state.charged&&d.progress.returnAligned,'Ordinary source primes outward without erasing first breath');
 waitRecovery(g,'guardian',hz);
 at(g,'guardianGust',d.telemetry().guardian.target);
 // Large t jump is not an encounter skip: only bounded dt advances the clock.
 d.update(.01,999999,points.guardian,g.state);check(d.telemetry().guardian.phase==='recovery','Wall clock cannot skip telegraph');
 at(g,'outwardVane');check(d.progress.outwardAligned,'Guardian gust aligns outward vane');
 const endingEvent=at(g,'finalBell');check(d.progress.restored&&!g.state.complete&&!endingEvent.complete,'Restoration is not village completion');
 const home=at(g,'homeLift');check(home.home===true&&!g.state.complete,'Explicit lift requests home, never ending');
 const finalSave=d.serialize(),restored=fixture();restored.campaign.restore(finalSave);check(restored.campaign.progress.restored,'Full solved route survives reload');
 d.reset();check(Object.values(d.progress).every(v=>v===false),'Reset clears all progress');
 check(d.context(points.source,false)===null,'Reset disables chapter');
 check(g.scene.children.length===1&&g.scene.children[0].children.length===6,'Reset does not leak effect meshes');
 // Stand in either lane: no HP, involuntary teleport or charge loss.
 const retry=fixture();retry.campaign.restore({version:1,progress:{entered:true,bridge:true,service:true,inspection:true,returnCleared:true,returnAligned:true}});retry.state.charged=true;
 advance(retry,14,points.guardian,hz);check(retry.state.charged,'Buffeting never destroys held wind');check(retry.campaign.telemetry().guardian.lane!==lane,'Solved first breath changes the marked lane, including after retry/reload');
}
{
 const f=fixture();f.campaign.restore({version:1,progress:{entered:true,bridge:false,service:true,restored:true},chargeOrigin:'forged'});
 check(f.campaign.progress.entered&&!f.campaign.progress.service&&!f.campaign.progress.restored,'Malformed save cannot bypass prerequisites');
 check(f.campaign.telemetry().chargeOrigin===null,'Unknown charge provenance rejected');
 f.campaign.restore({version:999,progress:{entered:true}});check(!f.campaign.progress.entered,'Unknown save version safely resets');
 f.campaign.progress.entered=true;
 for(let i=0;i<10;i++){at(f,'source');f.state.charged=false;}check(!f.campaign.progress.bridge,'Source remains repeatable without granting progress');
 const ctx=f.campaign.context(points.source,false);f.state.paused=true;f.campaign.interact(ctx,f.state);check(!f.state.charged,'Paused interaction rejected');
 f.state.paused=false;f.state.complete=true;f.campaign.interact(ctx,f.state);check(!f.state.charged,'Completed game rejects campaign actions');
}
for(const hz of [30,60,120])for(const gentle of [false,true])for(const id of ['service','guardian']){
 const setup=()=>{const f=fixture();f.campaign.restore({version:1,progress:id==='service'?{entered:true,bridge:true}:{entered:true,bridge:true,service:true,inspection:true,returnCleared:true}});f.state.charged=true;f.state.gentle=gentle;f.state.checkpoint=[1,2,3];return f;};
 const f=setup(),a=points[id],b=f.campaign.telemetry()[id].target,hit=a.clone().lerp(b,.5),dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),prior=JSON.stringify(f.campaign.progress);
 let frame=0;const runUntil=seconds=>{while(frame/hz<seconds){frame++;f.campaign.update(1/hz,frame/hz,hit,f.state);}};
 const buffets=()=>f.events.filter(v=>v.e.buffet).map(v=>v.e.buffet);
 runUntil(2.8);check(buffets().length===0,'Warning does not buffet');
 runUntil(4.5);check(buffets().length===1,`${id} contact emits exactly once per vent at ${hz}Hz, gentle=${gentle}`);
 const impulse=buffets()[0];check(Math.abs(Math.hypot(impulse.x,impulse.z)-3)<1e-9,'Buffet magnitude is 3 in both motion modes');
 check(Math.abs(impulse.x-3*dx/length)<1e-9&&Math.abs(impulse.z-3*dz/length)<1e-9,'Impulse follows the vent away from actor');
 check(f.state.charged&&JSON.stringify(f.state.checkpoint)==='[1,2,3]'&&JSON.stringify(f.campaign.progress)===prior,'Buffet preserves charge, checkpoint and progression');
 runUntil(17.5);check(buffets().length===2,'A later vent can produce exactly one new buffet');
 const outside=setup(),safe=hit.clone().add(new THREE.Vector3(-dz/length*.9,0,dx/length*.9));
 for(let i=1;i<=5*hz;i++)outside.campaign.update(1/hz,i/hz,safe,outside.state);
 check(outside.events.every(v=>!v.e.buffet),'Outside the vent lane never emits buffet');
 for(const [label,along,side,expected] of [['endpoint sideline',1,.6,0],['endpoint centre',1,.1,1],['midpoint centre',.5,.1,1],['beyond end',1+.1/length,0,0],['before start',-.1/length,0,0]]){
  const probe=setup(),pos=a.clone().lerp(b,along).add(new THREE.Vector3(-dz/length*side,0,dx/length*side));
  for(let i=1;i<=5*hz;i++)probe.campaign.update(1/hz,i/hz,pos,probe.state);
  check(probe.events.filter(v=>v.e.buffet).length===expected,`${id} ${label} at ${hz}Hz gentle=${gentle}: tapered footprint without caps`);
 }
}
console.log(`PASS campaign: ${assertions} assertions; complete route at 30/60/120Hz; reload/reset, phase safety, repeatable sources, out-of-order and stale contexts, charge preservation, explicit home lift, once-per-vent buffet and safe sidelines.`);
