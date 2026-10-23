import {test,expect} from '@playwright/test';
const snapshot=(page:any)=>page.evaluate(()=>(window as any).__drive.snapshot(true));

test('real imported wheels and steering marker follow keyboard input; model switching preserves the car and save',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:90000});
 expect((await snapshot(page)).stats.vehicle).toMatchObject({loaded:true,active:true});
 await page.locator('#resume').click();await page.keyboard.press('Escape');const saved=await page.evaluate(()=>localStorage.getItem('island-drive:save:v1')),car=(await snapshot(page)).car;
 await page.locator('#vehicle').selectOption('original');expect((await snapshot(page)).stats.vehicle.active).toBe(false);expect((await snapshot(page)).car).toEqual(car);expect(await page.evaluate(()=>localStorage.getItem('island-drive:save:v1'))).toBe(saved);
 await page.locator('#vehicle').selectOption('concept');await page.locator('#view').click();await page.locator('#resume').click();
 for(const [key,sign]of [['KeyA',1],['KeyD',-1]] as const){
  await page.keyboard.down(key);await expect.poll(async()=>((await snapshot(page)).stats.vehicle.steeringMarker[0]-(await snapshot(page)).stats.vehicle.steeringCenter[0])*sign,{timeout:10000}).toBeLessThan(-.03);
  expect((await snapshot(page)).stats.vehicle.frontWheels.every((w:{angle:number})=>w.angle*sign>.02)).toBe(true);
  await page.keyboard.up(key);await expect.poll(async()=>Math.abs((await snapshot(page)).controls.steer),{timeout:10000}).toBeLessThan(.01);
 }
 await page.keyboard.down('KeyW');await expect.poll(async()=>(await snapshot(page)).car.speed,{timeout:10000}).toBeGreaterThan(3);await page.keyboard.up('KeyW');
 const s=await snapshot(page);expect(s.stats.vehicle.wheelSpin.every((v:number)=>v>.5)).toBe(true);expect(s.stats.vehicle.dashboard.speed).toBeGreaterThan(5);expect(s.stats.vehicle.cockpitCameraError).toBeLessThan(.000001);
 await page.keyboard.press('Escape');const pausedSpin=(await snapshot(page)).stats.vehicle.wheelSpin;await page.waitForTimeout(800);expect((await snapshot(page)).stats.vehicle.wheelSpin).toEqual(pausedSpin);expect(errors).toEqual([]);
});

test('an unavailable model falls back to the original car and leaves keyboard driving usable',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/models/carconcept.glb*',r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:60000});await expect(page.locator('#vehicle')).toHaveValue('original');expect((await snapshot(page)).stats.vehicle.loaded).toBe(false);
 await expect(page.locator('#hint')).toContainText('已使用原創轎車');await page.locator('#resume').click();await page.keyboard.down('KeyW');await expect.poll(async()=>(await snapshot(page)).car.speed,{timeout:15000}).toBeGreaterThan(2);await page.keyboard.up('KeyW');await page.keyboard.press('Escape');const pausedSpin=(await snapshot(page)).stats.vehicle.wheelSpin;await page.waitForTimeout(800);expect((await snapshot(page)).stats.vehicle.wheelSpin).toEqual(pausedSpin);expect(errors).toEqual([]);
});
