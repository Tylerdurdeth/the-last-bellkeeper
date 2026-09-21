// Original 48-second synthesized score; no recordings or external assets.
// Call start() directly from a user gesture. setPaused() is also on each instance.
const players=new Set();
export function setPaused(paused){return Promise.all([...players].map(p=>p.setPaused(Boolean(paused))));}
export function createTitleMusic(){
 let ctx,bus,level,fade,verb,wet,compressor,timer,stopTimer,running=false,paused=false,disposed=false,starting=null;
 let volume=.65,muted=false,nextBar=0,origin=0,generation=0,peakVoices=0,totalNotes=0;
 const voices=new Set(),barSeconds=6,loopSeconds=48;
 const chords=[[45,52,57,60],[41,48,53,57],[48,55,60,64],[43,50,55,59],[45,52,57,60],[41,48,53,57],[38,45,50,53],[40,47,56,59]];
 const melodies=[[69,72,76,74],[72,69,65,67],[67,72,76,79],[74,71,67,69],[76,74,72,69],[72,77,76,72],[69,65,62,64],[68,71,76,68]];
 const hz=n=>440*2**((n-69)/12);
 function smooth(param,value,seconds=.08){param.cancelScheduledValues(ctx.currentTime);param.setTargetAtTime(value,ctx.currentTime,seconds);}
 function init(){
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)throw new Error('Web Audio is unavailable');ctx=new AC();
  bus=ctx.createGain();level=ctx.createGain();fade=ctx.createGain();compressor=ctx.createDynamicsCompressor();
  compressor.threshold.value=-12;compressor.knee.value=14;compressor.ratio.value=4;compressor.attack.value=.008;compressor.release.value=.3;
  level.gain.value=muted?0:volume;fade.gain.value=0;
  bus.connect(compressor);compressor.connect(level);level.connect(fade);fade.connect(ctx.destination);
  verb=ctx.createConvolver();wet=ctx.createGain();wet.gain.value=.2;
  const impulse=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*2.4),ctx.sampleRate);let seed=92371;
  for(let c=0;c<2;c++){const data=impulse.getChannelData(c);for(let i=0;i<data.length;i++){seed=(1664525*seed+1013904223)>>>0;data[i]=(seed/2147483648-1)*Math.exp(-i/ctx.sampleRate*3.3)*.22;}}
  verb.buffer=impulse;bus.connect(verb);verb.connect(wet);wet.connect(compressor);
 }
 function clearVoices(){for(const v of voices){try{v.osc.stop();}catch{}v.osc.disconnect();v.env.disconnect();v.filter?.disconnect();}voices.clear();}
 function tone(note,time,duration,amplitude,type='triangle',detune=0,cutoff=1100,attack=.3){
  // Absolute bound includes voices already scheduled in the look-ahead window.
  if(voices.size>=64)return;
  const osc=ctx.createOscillator(),env=ctx.createGain(),filter=ctx.createBiquadFilter();
  osc.type=type;osc.frequency.setValueAtTime(hz(note),time);osc.detune.value=detune;filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.45;
  env.gain.setValueAtTime(0,time);env.gain.linearRampToValueAtTime(amplitude,time+Math.min(attack,duration*.3));env.gain.setValueAtTime(amplitude*.78,time+duration*.6);env.gain.linearRampToValueAtTime(0,time+duration);
  osc.connect(filter);filter.connect(env);env.connect(bus);
  const record={osc,env,filter,end:time+duration};voices.add(record);peakVoices=Math.max(peakVoices,voices.size);totalNotes++;
  osc.onended=()=>{voices.delete(record);osc.disconnect();env.disconnect();filter.disconnect();};osc.start(time);osc.stop(time+duration+.02);
 }
 function drum(time,strength){
  if(voices.size>=64)return;
  const osc=ctx.createOscillator(),env=ctx.createGain();osc.frequency.setValueAtTime(88,time);osc.frequency.exponentialRampToValueAtTime(34,time+.7);
  env.gain.setValueAtTime(0,time);env.gain.linearRampToValueAtTime(strength,time+.025);env.gain.exponentialRampToValueAtTime(.0001,time+1.3);
  osc.connect(env);env.connect(bus);const record={osc,env,end:time+1.4};voices.add(record);peakVoices=Math.max(peakVoices,voices.size);totalNotes++;
  osc.onended=()=>{voices.delete(record);osc.disconnect();env.disconnect();};osc.start(time);osc.stop(time+1.4);
 }
 function score(bar,time){
  const i=bar%8,dynamic=[.62,.7,.82,.76,.92,1,.86,.66][i];
  // Slow bowed-like envelopes and gentle beating, not a sampled orchestra.
  for(const note of chords[i])for(const cents of [-7,7])tone(note,time,6.5,.016*dynamic,'sawtooth',cents,850+dynamic*650,.8);
  tone(chords[i][0]-12,time,5.9,.048*dynamic,'sine',0,350,.35);
  melodies[i].forEach((note,j)=>{const at=time+j*1.5;tone(note,at,1.7,.037*dynamic,'triangle',-3,1700,.15);tone(note-12,at,1.65,.012*dynamic,'sawtooth',3,750,.18);});
  drum(time,.12*dynamic);drum(time+3,.065*dynamic);
  if(i%2===0){tone(melodies[i][0]+12,time+.04,3.8,.024,'sine',0,6000,.008);tone(melodies[i][0]+31,time+.04,2.5,.006,'sine',0,9000,.005);}
 }
 function tick(){if(!running||paused||!ctx)return;for(const v of [...voices])if(v.end+.05<ctx.currentTime){voices.delete(v);v.osc.disconnect();v.env.disconnect();v.filter?.disconnect();}while(origin+nextBar*barSeconds<ctx.currentTime+.25){score(nextBar,Math.max(ctx.currentTime+.01,origin+nextBar*barSeconds));nextBar++;}}
 function schedule(){clearInterval(timer);tick();timer=setInterval(tick,100);}
 async function start(){
  if(disposed)throw new Error('Title music is disposed');if(starting)return starting;if(running)return;
  if(!ctx)init();const token=++generation;clearTimeout(stopTimer);clearVoices();
  starting=(async()=>{await ctx.resume();if(disposed||token!==generation)return;running=true;paused=false;origin=ctx.currentTime+.05;nextBar=0;fade.gain.cancelScheduledValues(ctx.currentTime);fade.gain.setValueAtTime(0,ctx.currentTime);fade.gain.linearRampToValueAtTime(1,ctx.currentTime+1.2);schedule();})().finally(()=>{starting=null;});return starting;
 }
 function setVolume(value){if(Number.isFinite(value))volume=Math.max(0,Math.min(1,value));if(ctx&&!disposed)smooth(level.gain,muted?0:volume);}
 function setMuted(value){muted=Boolean(value);if(ctx&&!disposed)smooth(level.gain,muted?0:volume);}
 async function pause(value){paused=Boolean(value);if(!ctx||disposed)return;if(paused){clearInterval(timer);await ctx.suspend();}else if(running){await ctx.resume();schedule();}}
 function fadeOut(seconds=2){
  if(!ctx||disposed)return;generation++;running=false;clearInterval(timer);clearTimeout(stopTimer);
  const duration=Number.isFinite(seconds)?Math.max(0,Math.min(30,seconds)):2;
  fade.gain.cancelScheduledValues(ctx.currentTime);fade.gain.setValueAtTime(fade.gain.value,ctx.currentTime);fade.gain.linearRampToValueAtTime(0,ctx.currentTime+duration);
  stopTimer=setTimeout(()=>{clearVoices();ctx.suspend().catch(()=>{});},duration*1000+40);
 }
 function dispose(){if(disposed)return;disposed=true;generation++;running=false;clearInterval(timer);clearTimeout(stopTimer);clearVoices();document.removeEventListener('visibilitychange',visibility);players.delete(api);if(ctx)ctx.close().catch(()=>{});}
 const visibility=()=>{pause(document.hidden).catch(()=>{});};
 const api={start,setVolume,setMuted,setPaused:pause,fadeOut,dispose,telemetry:()=>Object.freeze({running,paused,muted,volume,disposed,contextState:ctx?.state||'uninitialized',voices:voices.size,peakVoices,totalNotes,loopSeconds,bar:nextBar?((nextBar-1)%8):0,synthesized:true})};
 document.addEventListener('visibilitychange',visibility);players.add(api);return api;
}
