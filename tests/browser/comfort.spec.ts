import {test,expect} from '@playwright/test';import fs from 'node:fs';
const snapshot=(page:any)=>page.evaluate(()=>(window as any).__drive.snapshot(true));
test('moving tyres stay on rendered asphalt; interpolation, both directions and reset remain safe',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:90000});const world=JSON.parse(fs.readFileSync('public/data/world.json','utf8'));
 for(const direction of [0,1]){const p=world.routes[direction][100],q=world.routes[direction][101];await page.locator('#import').setInputFiles({name:'contact-checkpoint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,direction,car:{x:p[0],y:p[1],z:p[2],yaw:Math.atan2(q[0]-p[0],q[2]-p[2]),speed:0,travel:0,collisions:0,reverseHold:0}}))});
  for(const mode of ['original','concept']){await page.locator('#vehicle').selectOption(mode);await page.locator('#resume').click();await page.keyboard.down('KeyW');await expect.poll(async()=>(await snapshot(page)).car.speed,{timeout:30000}).toBeGreaterThan(3);await page.keyboard.up('KeyW');const s=await snapshot(page);expect(s.presentationAlpha).toBeGreaterThanOrEqual(0);expect(s.presentationAlpha).toBeLessThanOrEqual(1.000001);expect(s.stats.vehicle.contacts).toHaveLength(4);for(const c of s.stats.vehicle.contacts)expect(Math.abs(c.gap_m)).toBeLessThan(.02);expect(s.stats.graphics.treeRepresentation).toBe('stable-instanced-cluster-cards');await page.keyboard.press('Escape');}
 }
 await page.locator('#restart').click();await expect.poll(async()=>Math.abs((await snapshot(page)).car.travel)).toBe(0);expect((await snapshot(page)).paused).toBe(true);expect(errors).toEqual([]);
});
