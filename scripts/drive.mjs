// Test-side pursuit uses real keyboard input and a read-only snapshot; never ships in the game.
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
const direction=process.argv.includes('--return')?1:0;
const limit=Number(process.argv.find(a=>a.startsWith('--seconds='))?.split('=')[1]||1200);
const label=process.argv.find(a=>a.startsWith('--label='))?.split('=')[1]||`keyboard-${direction?'return':'outbound'}`;
if(!Number.isFinite(limit)||limit<=0||!/^[a-z0-9-]+$/.test(label))throw Error('Invalid test arguments');
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${p}/${e.name}`):[`${p}/${e.name}`]);
const tracked=[...walk('src'),...walk('public'),...walk('dist'),'package-lock.json','index.html','vite.config.ts','scripts/drive.mjs','scripts/drive-return.mjs','scripts/drive-outbound-final.mjs'].sort();
const hashes=()=>Object.fromEntries(tracked.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const before=hashes();
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:960,height:600}});
const initial_context_storage=await context.storageState();const page=await context.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const world=JSON.parse(fs.readFileSync('public/data/world.json'));const route=world.routes[direction];const lens=[0];
for(let i=1;i<route.length;i++)lens.push(lens.at(-1)+Math.hypot(route[i][0]-route[i-1][0],route[i][2]-route[i-1][2]));
const snapshot=(detailed=false)=>page.evaluate(d=>window.__drive.snapshot(d),detailed);
const held=new Set();
async function key(code,on){if(on&&!held.has(code)){await page.keyboard.down(code);held.add(code);}if(!on&&held.has(code)){await page.keyboard.up(code);held.delete(code);}}
async function release(){for(const code of [...held])await key(code,false);}
await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__drive&&!document.querySelector('#resume').disabled,{timeout:90000});
const loaded=await snapshot();if(loaded.car.travel!==0||loaded.direction!==0||!loaded.paused)throw Error('Fresh spawn not confirmed');
if(direction)await page.locator('#return').click();
// Ordinary settings UI: a slower keyboard ramp gives this software-rendered test controller finer pulses.
for(const id of ['turn','center']){await page.locator('#'+id).focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');}
const configured=await snapshot();if(configured.controls.turnRate!==.4||configured.controls.returnRate!==.4)throw Error('Settings UI failed');
await page.locator('#resume').click();const t0=performance.now();const log=[],captures=[],captureTimings=[];let nextLog=0,shot500=false,shot900=false,completed=false,end;
// Do not suspend keyboard feedback while a software-rendered screenshot is captured.
function capture(mark,progress){const started=performance.now();const row={mark,progress_m:progress,started_elapsed_s:(started-t0)/1000};captureTimings.push(row);captures.push(page.screenshot({path:`reports/${label}-${mark}.png`}).then(()=>{row.duration_ms=performance.now()-started;}).catch(e=>errors.push(`Screenshot ${mark}: ${e}`)));}
try{
 while(performance.now()-t0<limit*1000){
  const s=await snapshot();if(s.paused)throw Error('Unexpected safety pause');
  const p=s.nearest.progress,remaining=s.nearest.total-p,car=s.car,lookahead=18+Math.abs(car.speed)*.8;
  let i=lens.findIndex(d=>d>=p+lookahead);if(i<0)i=route.length-1;const target=route[i];
  let alpha=Math.atan2(target[0]-car.x,target[2]-car.z)-car.yaw;alpha=Math.atan2(Math.sin(alpha),Math.cos(alpha));
  const L=Math.max(5,Math.hypot(target[0]-car.x,target[2]-car.z));
  const desired=Math.max(-1,Math.min(1,Math.atan(2*2.6*Math.sin(alpha)/L)/(.5/(1+Math.abs(car.speed)/10))));
  const error=desired-s.controls.steer;
  await key('KeyA',error>.025);await key('KeyD',error<-.025);
  const desiredSpeed=remaining<95?Math.max(0,(remaining-20)*.20):12;
  await key('KeyS',car.speed>desiredSpeed+.6);await key('KeyW',car.speed<desiredSpeed-.4);
  const elapsed=(performance.now()-t0)/1000;
  if(elapsed>=nextLog){const row={real_elapsed_s:elapsed,progress_m:p,travel_m:car.travel,speed_mps:car.speed,collisions:car.collisions,lateral_m:s.nearest.distance,steer:s.controls.steer,desired_steer:desired};log.push(row);console.log(JSON.stringify(row));nextLog=elapsed+15;fs.writeFileSync(`reports/${label}-progress.json`,JSON.stringify({before,log},null,2));}
  if(!shot500&&p>=500){shot500=true;capture('500m',p);}
  if(!shot900&&p>=900){shot900=true;capture('900m',p);}
  if(remaining<34&&Math.abs(car.speed)<.35){
   await release();await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#menu').open);
   await page.locator('#finish').click();await page.waitForFunction(()=>window.__drive.snapshot().completed&&document.querySelector('#status').textContent.includes('旅程完成'));
   completed=true;break;
  }
  await page.waitForTimeout(80);
 }
 if(!completed)errors.push('Real elapsed-time budget exhausted before completion');
}catch(e){errors.push(String(e));}
end=await snapshot(true);const realElapsed=(performance.now()-t0)/1000;
await release();if(!end.paused)await page.keyboard.press('Escape');await Promise.all(captures);await page.screenshot({path:`reports/${label}-end.png`});
const after=hashes();const report={method:'Fresh browser context; real page.keyboard W/S/A/D and Esc; normal mouse menu clicks only. Readonly snapshot feedback, no imports, teleports, Game writes or production autopilot. Test-side route tracking is not human handling assessment. Mid-route screenshots are asynchronous so the controller keeps updating keyboard input. Chromium154/SwiftShader headless.',direction,settings:{turnRate:.4,returnRate:.4,cruise_target_mps:12},initial_context_storage,initial_snapshot:loaded,renderer_at_end:end.stats,completed,real_elapsed_s:realElapsed,progress_m:end.nearest.progress,route_length_m:end.nearest.total,travel_m:end.car.travel,collisions:end.car.collisions,final_speed_mps:end.car.speed,simulation_elapsed_s:end.simulationElapsed,game_active_wall_clock_s:end.elapsed,dropped_simulation_time_s:end.droppedSimulationTime,errors,before,after,hashes_unchanged:JSON.stringify(before)===JSON.stringify(after),log,captureTimings,all_frame_times_ms:end.frameTimes};
fs.writeFileSync(`reports/driving-${label}.json`,JSON.stringify(report,null,2));console.log('FINAL',JSON.stringify({...report,before:'see report',after:'see report',initial_snapshot:'see report',renderer_at_end:'see report',all_frame_times_ms:'see report',log:'see report'}));
await browser.close();if(!completed||errors.length||!report.hashes_unchanged)process.exitCode=1;
