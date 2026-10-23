import {expect,test} from '@playwright/test';
import fs from 'node:fs';
const snapshot=(page:any)=>page.evaluate(()=>(window as any).__drive.snapshot(true));

test('graphics quality persists independently; static shadows cache and near/far trees remain a partition',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:60000});
 await expect(page.locator('#quality')).toHaveValue('standard');
 const first=await snapshot(page);await page.waitForTimeout(1000);expect((await snapshot(page)).stats.graphics.shadowUpdates).toBe(first.stats.graphics.shadowUpdates);
 await page.locator('#resume').click();await page.keyboard.press('Escape');
 const saved=await page.evaluate(()=>localStorage.getItem('island-drive:save:v1'));
 for(const quality of ['low','high','standard','low']){
  await page.locator('#quality').selectOption(quality);await page.waitForTimeout(400);
  const s=await snapshot(page);expect(s.stats.graphics.quality).toBe(quality);
  expect(s.stats.graphics.nearTrees+s.stats.graphics.farTrees).toBe(s.stats.diagnostics.trees);
  expect(s.stats.info.memory.textures).toBeLessThanOrEqual(first.stats.info.memory.textures+2);
 }
 expect(await page.evaluate(()=>localStorage.getItem('island-drive:save:v1'))).toBe(saved);
 await page.reload();await expect(page.locator('#resume')).toBeEnabled({timeout:60000});
 await expect(page.locator('#quality')).toHaveValue('low');expect((await snapshot(page)).paused).toBe(true);expect(errors).toEqual([]);
});

test('LOD stays complete on both route checkpoint transitions; invalid graphics preferences fall back safely',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('island-drive:graphics:v1','{"quality":"untrusted"}'));
 await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:60000});await expect(page.locator('#quality')).toHaveValue('standard');
 const world=JSON.parse(fs.readFileSync('public/data/world.json','utf8'));
 for(const direction of [0,1]){
  const p=world.routes[direction][120],q=world.routes[direction][121];
  await page.locator('#import').setInputFiles({name:'lod-checkpoint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,direction,car:{x:p[0],y:p[1],z:p[2],yaw:Math.atan2(q[0]-p[0],q[2]-p[2]),speed:0,travel:0,collisions:0,reverseHold:0}}))});
  await page.waitForTimeout(600);const s=await snapshot(page);expect(s.stats.graphics.nearTrees+s.stats.graphics.farTrees).toBe(s.stats.diagnostics.trees);expect(s.stats.graphics.nearTrees).toBeGreaterThan(0);
 }
});
