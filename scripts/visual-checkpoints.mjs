import {chromium} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
const label=process.argv[2]??'after',url=process.argv[3]??'http://localhost:5173';
if(!['before','after'].includes(label))throw Error('label must be before or after');
const root=label==='before'?'work/visual-upgrade/baseline':'.';
const manifest=()=>{const result={};for(const folder of ['src','public'])for(const entry of fs.readdirSync(`${root}/${folder}`,{recursive:true,withFileTypes:true})){if(entry.isFile()){const path=`${entry.parentPath}/${entry.name}`;result[path.replace(`${root}/`,'')]=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');}}return result;};
const inspectionOnly=process.argv.includes('--inspection-only');
const before=manifest();fs.mkdirSync('reports/visual',{recursive:true});fs.mkdirSync('work/visual-upgrade/inspection',{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(url);await page.waitForFunction(()=>window.__drive&&document.querySelector('#resume')&&!document.querySelector('#resume').disabled,undefined,{timeout:90000});
const world=JSON.parse(fs.readFileSync(`${root}/public/data/world.json`)),notes=[];
for(const [name,direction,metres,cockpit,yawOffset]of [['start',0,0,false,0],['500m',0,500,false,0],['cockpit',0,500,true,0],['coast',0,2400,false,-1],['shelter',0,330,false,-1],['parking',1,5350,false,1]]){
 if(inspectionOnly&&['start','500m','cockpit'].includes(name))continue;
 const route=world.routes[direction];let i=0,distance=0;
 while(i<route.length-2&&distance<metres){distance+=Math.hypot(route[i+1][0]-route[i][0],route[i+1][2]-route[i][2]);i++;}
 let target;
 if(inspectionOnly){
  if(name==='shelter')target=world.features.find(f=>f.id==='3437585111').points[0];
  if(name==='parking'){const ps=world.features.find(f=>f.id==='239900728').points;target=[ps.reduce((n,p)=>n+p[0],0)/ps.length,0,ps.reduce((n,p)=>n+p[2],0)/ps.length];}
  if(name==='coast'){const p=route[i];target=world.features.filter(f=>f.kind==='coast').flatMap(f=>f.points).sort((a,b)=>Math.hypot(a[0]-p[0],a[2]-p[2])-Math.hypot(b[0]-p[0],b[2]-p[2]))[0];}
  if(name!=='coast'){i=route.reduce((best,p,index)=>Math.hypot(p[0]-target[0],p[2]-target[2])<Math.hypot(route[best][0]-target[0],route[best][2]-target[2])?Math.min(index,route.length-2):best,0);distance=route.slice(1,i+1).reduce((sum,p,index)=>sum+Math.hypot(p[0]-route[index][0],p[2]-route[index][2]),0);}
 }
 const p=route[i],next=route[i+1];const car={x:p[0],y:p[1],z:p[2],yaw:target?Math.atan2(target[0]-p[0],target[2]-p[2]):Math.atan2(next[0]-p[0],next[2]-p[2])+yawOffset,speed:0,travel:0,collisions:0,reverseHold:0};
 await page.locator('#import').setInputFiles({name:'visual-checkpoint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,direction,car}))});
 if(await page.locator('#cockpit').evaluate(e=>e.classList.contains('visible'))!==cockpit)await page.locator('#view').click();
 const initialFrame=await page.evaluate(()=>window.__drive.snapshot(true).stats.info.render.frame);await page.locator('#resume').click();await page.keyboard.down('KeyW');await page.keyboard.down('KeyS');await page.waitForTimeout(3000);await page.waitForFunction(frame=>window.__drive.snapshot(true).stats.info.render.frame>=frame+18,initialFrame,{timeout:90000});
 const published=['start','500m','cockpit'].includes(name),path=published?`reports/visual/${label}-${name}.jpg`:`work/visual-upgrade/inspection/${label}-${name}.png`;
 await page.screenshot(published?{path,type:'jpeg',quality:78}:{path});
 const snapshot=await page.evaluate(()=>window.__drive.snapshot(true));
 notes.push({name,path,direction,distance,car:snapshot.car,graphics:snapshot.stats.graphics,info:snapshot.stats.info});
 await page.keyboard.press('Escape');await page.keyboard.up('KeyW');await page.keyboard.up('KeyS');
}
if(label==='after'){await page.setViewportSize({width:320,height:568});await page.locator('#quality').scrollIntoViewIfNeeded();await page.screenshot({path:'work/visual-upgrade/inspection/after-narrow.png'});}
await browser.close();const after=manifest();const unchanged=JSON.stringify(before)===JSON.stringify(after);
fs.writeFileSync(`work/visual-upgrade/checkpoints-${label}${inspectionOnly?'-inspection':''}.json`,JSON.stringify({label,url,method:'validated save checkpoints and real UI; not continuous driving; same 1440x900 DPR1 camera; standard quality after',errors,notes,before,after,unchanged},null,2));
console.log(JSON.stringify({label,errors,unchanged,images:notes.map(n=>n.path)}));if(errors.length||!unchanged)process.exitCode=1;
