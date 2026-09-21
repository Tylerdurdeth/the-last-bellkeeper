import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await fs.readFile('game/title-music.js','utf8');
const browser=await puppeteer.launch({headless:true});
try{
 const page=await browser.newPage();await page.setContent('<button id="start">Listen</button>');
 const audio=await page.evaluate(async source=>{
  const originalAC=window.AudioContext,originalInterval=window.setInterval,originalClear=window.clearInterval,originalDisconnect=AudioNode.prototype.disconnect;
  // Advancing the scheduler precedes offline rendering; retain past connections
  // until their already-scheduled envelopes have actually been rendered.
  AudioNode.prototype.disconnect=function(){};
  const offline=new OfflineAudioContext(2,22050*50,22050);let now=0,tick;
  const proxy=new Proxy(offline,{get(target,key){if(key==='currentTime')return now;if(key==='resume'||key==='suspend'||key==='close')return async()=>{};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
  window.AudioContext=function(){return proxy;};window.setInterval=fn=>(tick=fn,1);window.clearInterval=()=>{};
  const {createTitleMusic}=await import(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));
  const player=createTitleMusic();player.setVolume(1);await player.start();
  for(now=.1;now<49;now+=.1)tick();const telemetry=player.telemetry();
  const rendered=await offline.startRendering();let peak=0,energy=0,count=0;const windows=[];
  for(let sec=0;sec<48;sec+=6){let sum=0,n=0;for(let c=0;c<2;c++){const a=rendered.getChannelData(c);for(let i=sec*22050;i<(sec+6)*22050;i++){peak=Math.max(peak,Math.abs(a[i]));sum+=a[i]*a[i];n++;}}windows.push(Math.sqrt(sum/n));energy+=sum;count+=n;}
  player.dispose();AudioNode.prototype.disconnect=originalDisconnect;window.AudioContext=originalAC;window.setInterval=originalInterval;window.clearInterval=originalClear;
  return {peak,rms:Math.sqrt(energy/count),barRms:windows,telemetry};
 },source);
 assert(audio.peak>.01&&audio.peak<.98,`Nonzero unclipped audio: ${audio.peak}`);assert(audio.barRms.every(v=>v>.001));assert(audio.telemetry.peakVoices<=64);assert(audio.telemetry.totalNotes>150);
 await page.evaluate(async source=>{const m=await import(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));window.player=m.createTitleMusic();window.pauseTitles=m.setPaused;document.querySelector('#start').onclick=()=>{window.started=player.start();};},source);
 assert.equal(await page.evaluate(()=>player.telemetry().contextState),'uninitialized');
 await page.click('#start');await page.evaluate(()=>window.started);
 const first=await page.evaluate(async()=>{const before=player.telemetry();await Promise.all([player.start(),player.start()]);return {before,after:player.telemetry(),frozen:Object.isFrozen(player.telemetry())};});
 assert(first.after.running);assert.equal(first.before.totalNotes,first.after.totalNotes);assert(first.frozen);
 await page.evaluate(async()=>{player.setVolume(2);player.setMuted(true);await pauseTitles(true);});
 const paused=await page.evaluate(()=>player.telemetry());assert(paused.paused&&paused.muted);assert.equal(paused.volume,1);assert.equal(paused.contextState,'suspended');
 await page.evaluate(async()=>{await player.setPaused(false);player.setMuted(false);player.fadeOut(.05);});await new Promise(r=>setTimeout(r,160));
 const stopped=await page.evaluate(()=>player.telemetry());assert(!stopped.running);assert.equal(stopped.voices,0);assert.equal(stopped.contextState,'suspended');
 await page.click('#start');await page.evaluate(()=>window.started);assert((await page.evaluate(()=>player.telemetry())).running);
 const final=await page.evaluate(async()=>{player.dispose();player.dispose();let rejected=false;try{await player.start();}catch{rejected=true;}return {...player.telemetry(),restartRejected:rejected};});assert(final.disposed&&final.restartRejected);assert.equal(final.voices,0);
 const report={pass:true,audio,lifecycle:{first,paused,stopped,final}};
 await fs.mkdir('evidence/adventure/title-music',{recursive:true});await fs.writeFile('evidence/adventure/title-music/test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
