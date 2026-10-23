// Test-only real-keyboard rolling probe. Never writes Game state or imports a save.
import {chromium} from '@playwright/test';import fs from 'node:fs';import crypto from 'node:crypto';import {performance} from 'node:perf_hooks';
const label=process.argv[2]??'before',seconds=Number(process.argv[3]??90),url=process.argv[4]??'http://localhost:5173';
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${p}/${e.name}`):[`${p}/${e.name}`]);
const hashes=()=>Object.fromEntries([...walk('src'),...walk('public'),...walk('dist'),'scripts/rolling-diagnostics.mjs'].sort().map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));const before=hashes();
const world=JSON.parse(fs.readFileSync('public/data/world.json')),route=world.routes[0],lens=[0];for(let i=1;i<route.length;i++)lens.push(lens.at(-1)+Math.hypot(route[i][0]-route[i-1][0],route[i][2]-route[i-1][2]));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1}),errors=[],log=[],held=new Set();
await page.addInitScript(()=>{
 const frames=[];let calls=0,triangles=0;const proto=WebGL2RenderingContext.prototype;
 for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){const original=proto[name];proto[name]=function(...args){calls++;if(args[0]===4)triangles+=(name.includes('Arrays')?args[2]:args[1])/3*(name.includes('Instanced')?args.at(-1):1);return original.apply(this,args);};}
 const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>raf(now=>{const c=calls,t=triangles,start=performance.now();callback(now);if(calls>c)frames.push({now,duration_ms:performance.now()-start,draw_calls:calls-c,triangles:triangles-t});});
 Object.defineProperty(window,'__glProbe',{value:Object.freeze({snapshot:()=>frames.slice()})});
});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
async function key(k,on){if(on&&!held.has(k)){await page.keyboard.down(k);held.add(k);}else if(!on&&held.has(k)){await page.keyboard.up(k);held.delete(k);}}
const snap=(full=false)=>page.evaluate(f=>window.__drive.snapshot(f),full);
await page.goto(url);await page.waitForFunction(()=>window.__drive&&!document.querySelector('#resume').disabled,undefined,{timeout:120000});
for(const id of ['turn','center']){await page.locator('#'+id).focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');}
const initial=await snap(true);if(initial.car.travel!==0||!initial.paused)throw Error('Not a fresh spawn');await page.locator('#resume').click();const start=performance.now();let next=0;
while(performance.now()-start<seconds*1000){const s=await snap(),c=s.car;if(s.paused)throw Error('Unexpected pause');let i=lens.findIndex(d=>d>=s.nearest.progress+18+Math.abs(c.speed)*.8);if(i<0)i=route.length-1;const target=route[i];let a=Math.atan2(target[0]-c.x,target[2]-c.z)-c.yaw;a=Math.atan2(Math.sin(a),Math.cos(a));const length=Math.max(5,Math.hypot(target[0]-c.x,target[2]-c.z)),desired=Math.max(-1,Math.min(1,Math.atan(5.2*Math.sin(a)/length)/(.5/(1+Math.abs(c.speed)/10)))),error=desired-s.controls.steer;
 await key('KeyA',error>.025);await key('KeyD',error<-.025);await key('KeyS',c.speed>12.6);await key('KeyW',c.speed<11.6);const elapsed=(performance.now()-start)/1000;
 if(elapsed>=next){log.push({elapsed,car:c,progress:s.nearest.progress,lateral:s.nearest.distance});next=elapsed+5;}await page.waitForTimeout(80);
}
for(const k of [...held])await key(k,false);await page.keyboard.press('Escape');const end=await snap(true),elapsed=(performance.now()-start)/1000,gl_probe=await page.evaluate(()=>window.__glProbe.snapshot());await browser.close();const after=hashes();
const report={method:'Fresh context, real W/S/A/D/Esc plus UI settings, readonly snapshot pursuit, no Game writes/imports. 1280x800 DPR1 standard, Chromium154 SwiftShader. Test-harness WebGL draw/rAF interception counts all passes, including cached-shadow refreshes; renderer.info alone excludes shadow passes. Fixed real elapsed budget; different progress is reported, not hidden. Instrumented JS wall time is not GPU timing or player FPS. All frames retained.',label,requested_seconds:seconds,elapsed,initial,end,gl_probe,log,errors,before,after,unchanged:JSON.stringify(before)===JSON.stringify(after)};
fs.writeFileSync(`reports/rolling-${label}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({label,elapsed,travel:end.car.travel,collisions:end.car.collisions,errors,unchanged:report.unchanged,frames:end.frameTimes.length}));if(errors.length||!report.unchanged)process.exitCode=1;
