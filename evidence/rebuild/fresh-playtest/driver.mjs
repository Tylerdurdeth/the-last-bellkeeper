import puppeteer from '/Users/seb/Documents/Codex/the-last-bellkeeper/node_modules/puppeteer/lib/puppeteer/puppeteer.js';
import readline from 'node:readline';
const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage(); await page.setViewport({width:1280,height:720});await page.goto('http://127.0.0.1:4173/the-last-bellkeeper/');
let start=Date.now();
for await (const line of readline.createInterface({input:process.stdin})) {try {const c=JSON.parse(line);if(c.start){await page.getByRole?.('button');await page.waitForFunction(()=>document.querySelector('#startb')&&!document.querySelector('#startb').disabled);await page.click('#startb');start=Date.now();}if(c.keys){for(const k of c.keys)await page.keyboard.down(k);await new Promise(r=>setTimeout(r,c.ms||100));for(const k of c.keys)await page.keyboard.up(k);}if(c.shot)await page.screenshot({path:`/Users/seb/Documents/ChatGPT/Project BellKeeper/evidence/rebuild/fresh-playtest/${c.shot}.png`});console.log(JSON.stringify({elapsed:Math.round((Date.now()-start)/1000),text:await page.evaluate(()=>document.body.innerText)}));}catch(e){console.log(String(e));}}
await browser.close();
