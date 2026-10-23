import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const snap=(page:any)=>page.evaluate(()=> (window as any).__drive.snapshot());
test('keyboard W/S brakes, reverses and brakes with W+S; views and return remain clickable',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:60000});
 await page.screenshot({path:'reports/keyboard-menu.png'});await page.locator('#resume').click();
 const start=await snap(page);await page.keyboard.down('KeyW');
 await expect.poll(async()=>(await snap(page)).car.speed,{timeout:15000}).toBeGreaterThan(4);
 await page.keyboard.up('KeyW');await page.keyboard.down('KeyS');
 await expect.poll(async()=>(await snap(page)).car.speed,{timeout:15000}).toBeLessThan(-1);
 await page.keyboard.down('KeyW');await expect.poll(async()=>Math.abs((await snap(page)).car.speed),{timeout:10000}).toBeLessThan(.2);
 await page.waitForTimeout(800);expect(Math.abs((await snap(page)).car.speed)).toBeLessThan(.2);
 await page.keyboard.press('Escape');expect((await snap(page)).controls).toMatchObject({throttle:false,brake:false,left:false,right:false,steer:0});
 await page.keyboard.up('KeyW');await page.keyboard.up('KeyS');expect((await snap(page)).car.travel).toBeGreaterThan(start.car.travel+2);
 await page.locator('#view').click();await page.locator('#resume').click();await page.waitForTimeout(800);await page.screenshot({path:'reports/keyboard-cockpit.png'});
 await page.keyboard.press('Escape');await page.locator('#return').click();expect((await snap(page)).direction).toBe(1);
 await page.locator('#resume').click();await page.keyboard.down('KeyW');await expect.poll(async()=>(await snap(page)).car.speed).toBeGreaterThan(1);await page.keyboard.up('KeyW');await page.keyboard.press('Escape');
 expect(errors).toEqual([]);
});
test('invalid import preserves good save; export and reload use unchanged v1 schema',async({page})=>{
 await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:60000});await page.locator('#resume').click();await page.keyboard.press('Escape');
 const saved=await page.evaluate(()=>localStorage.getItem('island-drive:save:v1'));
 await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"car":{}}')});await expect(page.locator('#hint')).toContainText('存檔無效');expect(await page.evaluate(()=>localStorage.getItem('island-drive:save:v1'))).toBe(saved);
 const download=page.waitForEvent('download');await page.locator('#export').click();const file=await download;expect(file.suggestedFilename()).toBe('island-drive-save.json');
 const exported=JSON.parse(fs.readFileSync((await file.path())!,'utf8'));expect(Object.keys(exported).sort()).toEqual(['car','direction','version']);expect(exported).toEqual(JSON.parse(saved!));
 await page.reload();await expect(page.locator('#resume')).toBeEnabled({timeout:60000});expect((await snap(page)).paused).toBe(true);
});
test('endpoint uses Esc pause and clickable completion after a labeled save checkpoint',async({page})=>{
 const w=JSON.parse(fs.readFileSync('public/data/world.json','utf8'));const p=w.routes[0].at(-1);
 await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:60000});
 await page.locator('#import').setInputFiles({name:'endpoint-checkpoint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,direction:0,car:{x:p[0],y:p[1],z:p[2],yaw:0,speed:0,travel:0,collisions:0,reverseHold:0}}))});
 await page.locator('#resume').click();await page.keyboard.press('Escape');await expect(page.locator('#finish')).toBeEnabled();await page.locator('#finish').click();await expect(page.locator('#status')).toContainText('旅程完成');expect((await snap(page)).completed).toBe(true);
});
