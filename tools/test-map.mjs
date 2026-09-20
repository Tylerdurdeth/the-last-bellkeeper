import assert from 'node:assert/strict';
import {projectMap,drawWoodlandMap} from '../game/woodland-map.js';
// Every camera-relative cardinal direction, including non-default camera orbits.
for(let i=0;i<720;i++){
 const yaw=i*Math.PI/360,c=Math.cos(yaw),s=Math.sin(yaw);
 for(const [x,z,u,v] of [[-s,-c,0,-1],[c,-s,1,0],[s,c,0,1],[-c,s,-1,0]]){
  const out=projectMap(x,z,yaw);assert(Math.abs(out[0]-u)<1e-10);assert(Math.abs(out[1]-v)<1e-10);
 }
}
let labels=[],calls=0;
const context=new Proxy({fillText:s=>labels.push(s)},{get:(target,key)=>target[key]??((...args)=>{calls++;for(const a of args)if(typeof a==='number')assert(Number.isFinite(a));}),set:(target,key,value)=>(target[key]=value,true)});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
const attrs={};const canvas={width:600,height:708,getAttribute:k=>attrs[k],setAttribute:(k,v)=>attrs[k]=v};
for(const restored of [false,true])for(const yaw of [0,.6627,Math.PI/2,Math.PI,-Math.PI/2]){
 labels=[];drawWoodlandMap(context,canvas,{started:true,restored},{position:{x:8,z:-10},yaw:.4},yaw);
 assert(labels.includes(restored?'CROSSING RESTORED · OPEN':'CROSSING LOCKED · FIND WIND'));
 assert(labels.includes('Far bell'));assert(attrs['aria-label'].includes(restored?'restored and open':'locked'));
}
assert(calls>100);console.log('PASS map: 720 camera angles × four directions; finite drawing and restored/locked labels');
