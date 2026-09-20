// Isolated terrain/world browser smoke test. Serves game/ directly; never builds docs/.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const out=path.resolve(process.argv[2]||path.join(root,'evidence/rebuild/island-terrain/runtime'));
await mkdir(out,{recursive:true});
const html=`<!doctype html><style>body{margin:0}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/vendor/three.module.js","three/addons/utils/BufferGeometryUtils.js":"/vendor/BufferGeometryUtils.js"}}</script><script type="module">
import * as T from 'three';import {buildWorld} from './world.js';import {createArtDirection} from './art-direction.js';
import {drawWoodlandMap} from './woodland-map.js';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#94b4ae');scene.fog=new T.FogExp2('#94b4ae',.015);scene.add(new T.HemisphereLight(0xffefcd,0x274d54,1.8));const sun=new T.DirectionalLight(0xffe1ae,2.4);sun.position.set(-9,20,8);scene.add(sun);
const art=createArtDirection(T,renderer);await art.ready;const world=await buildWorld(scene,art);const camera=new T.PerspectiveCamera(48,1200/900,.1,180);
window.frame=(eye,target,restored)=>{camera.position.set(...eye);camera.lookAt(...target);const pos=new T.Vector3(...target);for(let i=0;i<150;i++)world.update(1/60,i/60,pos,restored,true,camera);scene.updateMatrixWorld(true);renderer.render(scene,camera);return {deck:world.ground(8,-3.35),island:world.ground(8,-10),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
window.audit=()=>{const result={};camera.position.set(27,26,20);camera.lookAt(6,0,-6);for(const [name,objects] of [['terrain',[scene.getObjectByName('land-and-cliff'),scene.getObjectByName('water')]],['bridge',[world.bridge]]]){const only=new T.Scene();for(const object of objects){const copy=object.clone(true);copy.matrix.copy(object.matrixWorld);copy.matrixAutoUpdate=false;copy.visible=true;copy.traverse(n=>{n.frustumCulled=false;});only.add(copy);}renderer.render(only,camera);result[name]={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}return result;};
window.chart=()=>{const c=document.createElement('canvas');c.dataset.chart='true';c.width=600;c.height=708;c.style.cssText='position:absolute;left:0;top:0';document.body.append(c);drawWoodlandMap(c.getContext('2d'),c,{started:true,restored:true},{position:new T.Vector3(8,1.2,-9),yaw:0},Math.atan2(.615,.788));};window.ready=true;
</script>`;
const server=createServer(async(req,res)=>{
 try{const url=new URL(req.url,'http://local');if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}if(url.pathname==='/game/island-review.html'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  const vendor={'/vendor/three.module.js':'node_modules/three/build/three.module.js','/vendor/three.core.js':'node_modules/three/build/three.core.js','/vendor/BufferGeometryUtils.js':'node_modules/three/examples/jsm/utils/BufferGeometryUtils.js'};
  const file=path.resolve(root,vendor[url.pathname]||'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep))throw Error('outside root');
  const data=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 browser=await puppeteer.launch({headless:true});const page=await browser.newPage();await page.setViewport({width:1200,height:900});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.goto('http://127.0.0.1:'+server.address().port+'/game/island-review.html');await page.waitForFunction(()=>window.ready,{timeout:45000});
 const results=[];for(const [name,eye,target,restored] of [
  ['island-before',[27,26,20],[6,0,-6],false],['island-after',[27,26,20],[6,0,-6],true],
  ['bridge',[15,10,6],[8,1,-3.35],true],['sanctuary',[14,7,-4],[8,2,-11],true],
  ['ridge',[-17,9,17],[-27,2,7],false]]){
  const result=await page.evaluate((eye,target,restored)=>window.frame(eye,target,restored),eye,target,restored);
  if(name==='island-before')assert.equal(result.deck,null);if(name==='island-after')assert(result.deck>1);
  assert.equal(result.island,1.2);await page.screenshot({path:path.join(out,name+'.png')});results.push({name,...result});
 }
 const isolated=await page.evaluate(()=>window.audit());assert.equal(isolated.terrain.calls,2,'terrain must remain two calls');assert.equal(isolated.bridge.calls,4,'bridge must remain four calls');
 await page.evaluate(()=>window.chart());await (await page.$('canvas[data-chart]')).screenshot({path:path.join(out,'map.png')});
 assert.deepEqual(errors,[]);
 await writeFile(path.join(out,'result.json'),JSON.stringify({pass:true,results,isolated,errors},null,2));console.log('PASS browser terrain, bridge, sanctuary and ridge renders; '+JSON.stringify(isolated)+'; '+out);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
