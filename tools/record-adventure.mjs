import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const out='evidence/adventure/release';await fs.mkdir(out,{recursive:true});
const browser=await puppeteer.launch({headless:true});
try{const page=await browser.newPage();await page.setViewport({width:1100,height:760});await page.goto('http://127.0.0.1:4173/the-last-bellkeeper/');await page.waitForFunction(()=>window.__READY__,{timeout:60000});
await page.evaluate(()=>{window.recordChunks=[];window.recorder=new MediaRecorder(document.querySelector('#world').captureStream(30),{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:2200000});recorder.ondataavailable=e=>recordChunks.push(e.data);recorder.start();});
const wait=ms=>new Promise(r=>setTimeout(r,ms));await page.click('#startb');await wait(21000);await page.click('#skipIntro');await page.keyboard.down('ArrowUp');await wait(1000);await page.keyboard.down('ShiftLeft');await wait(700);await page.keyboard.press('KeyA');await wait(1100);await page.keyboard.up('ArrowUp');await page.keyboard.up('ShiftLeft');await wait(700);await page.keyboard.press('KeyQ');await wait(1000);
const bytes=await page.evaluate(()=>new Promise(resolve=>{recorder.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(recordChunks,{type:'video/webm'}).arrayBuffer())));recorder.stop();}));await fs.writeFile(out+'/opening-and-jump.webm',Buffer.from(bytes));console.log('Actual normal-speed canvas capture: intro, guardian closure, movement/run/jump. Silent canvas-only capture; no UI or audio-quality claim.');
}finally{await browser.close();}
