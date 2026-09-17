// Original procedural sound design, pending reviewed recorded/Atlas audio.
// No context or audible source is created until start() is called from a gesture.
export function createSoundscape({context: suppliedContext, random = Math.random} = {}) {
  let context=null, master, ambience, wet, wind, brook, breeze, started=false, muted=false, paused=false, disposed=false;
  let birdClock=7, charged=false, restored=false, location={x:0,z:0}, lastStep=-1;
  const continuous=[], voices=new Set(), buffers=new Map();
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function gain(value){const g=context.createGain();g.gain.value=value;return g;}
  function noise(seconds=3, color='pink', stereo=false){
    const key=`${seconds}/${color}/${stereo}`;if(buffers.has(key))return buffers.get(key);
    const b=context.createBuffer(stereo?2:1,Math.ceil(context.sampleRate*seconds),context.sampleRate);
    for(let c=0;c<b.numberOfChannels;c++){const a=b.getChannelData(c);let low=0,mid=0;for(let i=0;i<a.length;i++){const white=random()*2-1;low=.985*low+.015*white;mid=.75*mid+.25*white;a[i]=color==='brown'?low*3.5:color==='pink'?(low*2+mid*.55+white*.06):white;}}
    buffers.set(key,b);return b;
  }
  function voicePan(pan=0, level=1, reverb=.12){
    const p=context.createStereoPanner(),g=gain(level),send=gain(reverb);p.pan.value=clamp(pan,-1,1);p.connect(g);g.connect(master);g.connect(send);send.connect(wet);
    return {input:p,cleanup(){p.disconnect();g.disconnect();send.disconnect();}};
  }
  function track(source,nodes,route){voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();nodes.forEach(n=>n.disconnect());route.cleanup();};}
  function hiss(at,duration,level,center,pan=0,type='bandpass',rise=.018){
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),envelope=gain(0),route=voicePan(pan,1,.15);
    source.buffer=noise(2,'white');source.playbackRate.value=.86+random()*.23;filter.type=type;filter.frequency.value=center;filter.Q.value=.7;
    envelope.gain.setValueAtTime(.00001,at);envelope.gain.exponentialRampToValueAtTime(Math.max(.00002,level),at+Math.min(rise,duration*.65));envelope.gain.exponentialRampToValueAtTime(.00001,at+duration);
    source.connect(filter);filter.connect(envelope);envelope.connect(route.input);track(source,[filter,envelope],route);source.start(at,random()*.6);source.stop(at+duration+.02);
  }
  function modal(at,base,level=.08,decay=1.4,pan=0){
    // Inharmonic decaying modes plus mallet contact: a struck object, not a UI scale.
    const ratios=[1,2.706,5.18,8.31,11.15];
    ratios.forEach((ratio,i)=>{const o=context.createOscillator(),g=gain(0),route=voicePan(pan,1,.21);
      o.type='sine';o.frequency.value=base*ratio*(1+(random()-.5)*.006);g.gain.setValueAtTime(.00001,at);g.gain.exponentialRampToValueAtTime(level/[1,3.2,6,12,20][i],at+.004);g.gain.exponentialRampToValueAtTime(.00001,at+decay/(1+i*.56));o.connect(g);g.connect(route.input);track(o,[g],route);o.start(at);o.stop(at+decay+.03);
    });hiss(at,.045,level*.35,2300,pan);
  }
  function bird(at){
    const pan=(random()-.5)*1.65,count=random()<.5?2:3;
    for(let i=0;i<count;i++){const start=at+i*(.115+random()*.045),length=.06+random()*.065;
      const o=context.createOscillator(),g=gain(0),route=voicePan(pan,.20,.35);o.type='sine';const base=2700+random()*900;
      o.frequency.setValueAtTime(base,start);o.frequency.exponentialRampToValueAtTime(base*(1.18+random()*.3),start+length*.40);o.frequency.exponentialRampToValueAtTime(base*.82,start+length);
      g.gain.setValueAtTime(.00001,start);g.gain.exponentialRampToValueAtTime(.035,start+.011);g.gain.exponentialRampToValueAtTime(.00001,start+length);o.connect(g);g.connect(route.input);track(o,[g],route);o.start(start);o.stop(start+length+.02);
    }
  }
  function loopNoise(color,filterType,frequency,level,pan){
    const s=context.createBufferSource(),f=context.createBiquadFilter(),g=gain(level),p=context.createStereoPanner();s.buffer=noise(4.7,color,true);s.loop=true;f.type=filterType;f.frequency.value=frequency;f.Q.value=.6;p.pan.value=pan;s.connect(f);f.connect(g);g.connect(p);p.connect(ambience);s.start();continuous.push(s,f,g,p);return g;
  }
  async function start(){
    if(disposed)return;if(started){if(context.state==='suspended'&&!('startRendering'in context))await context.resume();return;}
    const Constructor=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!suppliedContext&&!Constructor)return;
    context=suppliedContext||new Constructor();master=gain(muted||paused?0:.65);ambience=gain(1);ambience.connect(master);
    const highpass=context.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=65;
    const compressor=context.createDynamicsCompressor();compressor.threshold.value=-12;compressor.knee.value=15;compressor.ratio.value=3;compressor.attack.value=.006;compressor.release.value=.18;
    master.connect(highpass);highpass.connect(compressor);compressor.connect(context.destination);continuous.push(master,ambience,highpass,compressor);
    wet=context.createConvolver();const ir=context.createBuffer(2,Math.floor(context.sampleRate*.72),context.sampleRate);
    for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<d.length;i++){const t=i/context.sampleRate;d[i]=(random()*2-1)*Math.exp(-t*8)*(t<.025?0:1)*.13;}}wet.buffer=ir;wet.connect(master);continuous.push(wet);
    wind=loopNoise('brown','lowpass',1300,.055,-.3);breeze=loopNoise('pink','bandpass',2100,.014,.55);brook=loopNoise('pink','bandpass',1450,.008,.35);
    const lfo=context.createOscillator(),lfoGain=gain(.014);lfo.frequency.value=.085;lfoGain.connect(wind.gain);lfo.connect(lfoGain);lfo.start();continuous.push(lfo,lfoGain);
    started=true;if(context.state==='suspended'&&!('startRendering'in context))await context.resume();
  }
  async function resume(){
    if(!context){await start();return;}
    if(context.state==='suspended'&&context.resume)await context.resume();
    volume();
  }
  function volume(){if(master)master.gain.setTargetAtTime(muted||paused?0:.65,context.currentTime,.04);}
  function setMuted(v){muted=!!v;volume();}
  function setPaused(v){paused=!!v;volume();}
  function update(dt,{position,speed=0,grounded=true,charged:hasWind=false,restored:isRestored=false,gardenDistance=30,waterDistance=30}={}){
    if(position)location={x:position.x??position[0]??0,z:position.z??position[position.length===3?2:1]??0};charged=hasWind;restored=isRestored;
    if(!started||paused||disposed)return;const t=context.currentTime;
    const garden=1-clamp(gardenDistance/18,0,1),water=1-clamp(waterDistance/16,0,1);
    wind.gain.setTargetAtTime(.032+garden*.016+(restored?.010:0),t,.9);breeze.gain.setTargetAtTime(.009+garden*.013+(charged?.006:0),t,.7);brook.gain.setTargetAtTime(.004+water*.06,t,.8);
    // Footfalls are explicitly cued by the distance-based animation/controller;
    // update does not also schedule them, preventing doubled footsteps.
    birdClock-=clamp(dt,0,.1);if(birdClock<=0){if(!muted)bird(t+.08);birdClock=7+random()*9;}
  }
  function cue(kind,{at}={}){
    if(!started||muted||paused||disposed)return;const t=Math.max(context.currentTime,at??context.currentTime);
    if(kind==='step'||kind==='land'||kind==='jump'){
      if(kind==='step'&&t-lastStep<.11)return;if(kind==='step')lastStep=t;
      const timber=Math.abs(location.x-8)<1.4&&location.z> -6.3&&location.z<.4;
      const strength=kind==='land'?1.8:kind==='jump'?.7:1;
      hiss(t,kind==='land'?.15:.095,.11*strength,timber?1700:820,(random()-.5)*.22,'lowpass');
      if(timber)modal(t,145+random()*35,.018*strength,.13,(random()-.5)*.15);
      else hiss(t+.015,.055,.025*strength,3300,0,'highpass');
      return;
    }
    if(kind==='capture'){hiss(t,.42,.11,1250,-.25,'bandpass',.30);hiss(t+.14,.3,.065,2800,.25,'bandpass',.18);modal(t+.32,395,.067,1.55,.05);}
    else if(kind==='release'){hiss(t,.36,.09,1700,.15,'bandpass',.09);modal(t+.12,330,.075,1.7,-.08);}
    else if(kind==='restore'){modal(t,220,.085,2.3,-.28);modal(t+.31,587,.035,2.7,.4);hiss(t+.10,1.1,.055,1800,.2,'bandpass',.3);bird(t+1.2);}
    else if(kind==='chime'||kind==='start')modal(t,kind==='start'?465:523,.045,1.9,(random()-.5)*.7);
    else if(/^stone-[012]$/.test(kind))modal(t,[262,330,392][Number(kind.slice(-1))],.065,2.2,0);
    else if(kind==='bird')bird(t);
    else if(kind==='hazard')hiss(t,.5,.13,600,-.1,'bandpass',.09);
  }
  function dispose(){if(disposed)return;disposed=true;for(const source of voices){try{source.stop();}catch{}}voices.clear();for(const node of continuous){try{node.stop?.();}catch{}node.disconnect();}continuous.length=0;buffers.clear();if(context&&!suppliedContext)context.close().catch(()=>{});}
  return {start,resume,setMuted,setPaused,update,cue,dispose};
}
