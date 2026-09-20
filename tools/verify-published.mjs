// Compare public changed runtime resources to their exact committed bytes.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
const [base,commit,out]=process.argv.slice(2);
if(!base||!commit||!out)throw Error('Usage: node tools/verify-published.mjs <base-url> <commit> <result.json>');
const paths=execFileSync('git',['diff-tree','--no-commit-id','--name-only','-r',commit,'--','docs'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
if(!paths.length)throw Error('No runtime changes in selected commit');
const digest=b=>createHash('sha256').update(b).digest('hex'),results=[];
for(let n=0;n<paths.length;n+=6)await Promise.all(paths.slice(n,n+6).map(async path=>{
 const expected=execFileSync('git',['show',commit+':'+path],{maxBuffer:20000000});
 const url=new URL(path.slice(5),base);url.searchParams.set('verify',commit);
 const response=await fetch(url);const actual=Buffer.from(await response.arrayBuffer());
 results.push({path,status:response.status,bytes:actual.length,expected:digest(expected),actual:digest(actual),pass:response.ok&&digest(expected)===digest(actual)});
}));
const report={commit,base,checkedAt:new Date().toISOString(),pass:results.every(r=>r.pass),resources:results.sort((a,b)=>a.path.localeCompare(b.path))};
await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2));
console.log(JSON.stringify({pass:report.pass,commit,resources:results.length,failures:results.filter(r=>!r.pass)},null,2));
if(!report.pass)process.exitCode=1;
