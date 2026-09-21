import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';
const root=path.resolve(new URL('..',import.meta.url).pathname),out=path.join(root,'evidence/adventure/campaign-greybox');
await mkdir(out,{recursive:true});
const html=`<!doctype html><style>body{margin:0}</style><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/utils/BufferGeometryUtils.js":"/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js"}}</script><script type="module">
import * as T from 'three';import {buildCampaignWorld} from './campaign-world.js';import {createArtDirection} from './art-direction.js';
const r=new T.WebGLRenderer({antialias:true});r.setSize(1200,900);r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;document.body.append(r.domElement);
const s=new T.Scene();s.background=new T.Color('#94b4ae');s.add(new T.HemisphereLight(0xffefcd,0x274d54,2));const sun=new T.DirectionalLight(0xffe1ae,2.4);sun.position.set(-9,20,8);s.add(sun);
const art=createArtDirection(T,r);await art.ready;const w=await buildCampaignWorld(s,art);const c=new T.PerspectiveCamera(42,4/3,.1,180);
window.frame=(eye,target,bridge)=>{for(let i=0;i<180;i++)w.update(1/60,i/60,new T.Vector3(...target),{bridge,restored:bridge,inspection:bridge,returnCleared:bridge,returnAligned:bridge,outwardAligned:bridge});c.position.set(...eye);c.lookAt(...target);s.updateMatrixWorld(true);r.render(s,c);return {triangles:r.info.render.triangles,calls:r.info.render.calls,bridgeGround:w.ground(8,-31),shutterY:s.getObjectByName('campaign-inspection-shutter').position.y,rootsVisible:s.getObjectByName('campaign-return-roots').visible};};window.ready=true;
</script>`;
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local');if(u.pathname==='/game/campaign-review.html'){res.setHeader('Content-Type','text/html');res.end(html);return;}if(u.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'application/octet-stream');res.end(await readFile(f));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{browser=await puppeteer.launch({headless:true});const page=await browser.newPage();await page.setViewport({width:1200,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/game/campaign-review.html');await page.waitForFunction(()=>window.ready);const results=[];
for(const [name,eye,target,bridge] of [['rootway-locked',[25,23,-8],[7,-.4,-28],false],['rootway-powered',[25,23,-8],[7,-.4,-28],true],['jump-bypass',[17,12,-29],[7,-1,-41],true],['windworks-before',[27,24,-36],[8,-2.4,-59],false],['windworks',[27,24,-36],[8,-2.4,-59],true]]){results.push({name,...await page.evaluate((e,t,b)=>window.frame(e,t,b),eye,target,bridge)});await page.screenshot({path:path.join(out,name+'.png')});}
await writeFile(path.join(out,'render-results.json'),JSON.stringify({timestamp:new Date().toISOString(),errors,results},null,2));if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({out,results}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
