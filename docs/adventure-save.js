// Versioned, bounded data only. Never restore transient actions or falling positions.
export const SAVE_KEY='bellkeeper-adventure-v1';
export function readSave(storage=localStorage){
 try{const d=JSON.parse(storage.getItem(SAVE_KEY));if(d?.version!==1||!d.state||!Array.isArray(d.checkpoint)||d.checkpoint.length!==3||!d.checkpoint.every(Number.isFinite))return null;
 if(d.checkpoint.some(v=>Math.abs(v)>200))return null;return d;}catch{return null;}
}
export function writeSave(state,campaign,discoveries,checkpoint,storage=localStorage){
 const flags={};for(const k of ['charged','awakened','restored','complete','porchRead'])flags[k]=!!state[k];
 const data={version:1,state:flags,campaign:campaign?.serialize()??{},discoveries:discoveries?.telemetry()??{},keepsakes:[...state.keepsakes],checkpoint:[...checkpoint],savedAt:Date.now()};
 try{storage.setItem(SAVE_KEY,JSON.stringify(data));return true;}catch{return false;}
}
