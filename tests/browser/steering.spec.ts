import {test,expect} from '@playwright/test';import fs from 'node:fs';
test('keyboard A/D match screen heading and wheel spokes; release progressively centers',async({page})=>{
 await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:60000});await page.locator('#view').click();
 const snap=()=>page.evaluate(()=>(window as any).__drive.snapshot());const evidence:any[]=[];
 for(const [key,sign,label] of [['KeyA',1,'left'],['KeyD',-1,'right']] as const){
  await page.locator('#restart').click();await page.locator('#resume').click();await page.waitForTimeout(800);const a=await snap();
  await page.keyboard.down('KeyW');await page.keyboard.down(key);await page.waitForTimeout(900);const b=await snap();
  expect((b.car.yaw-a.car.yaw)*sign).toBeGreaterThan(0);expect((b.screenRoadAhead[0]-a.screenRoadAhead[0])*sign).toBeGreaterThan(0);expect(b.controls.steer*sign).toBeGreaterThan(.1);
  const wheel=await page.locator('#wheel').evaluate(e=>{const m=new DOMMatrix(getComputedStyle(e).transform);return Math.atan2(m.b,m.a);});expect(wheel*sign).toBeLessThan(0);
  await page.screenshot({path:`reports/keyboard-steering-${label}.png`});await page.keyboard.up(key);await page.keyboard.up('KeyW');
  await expect.poll(async()=>Math.abs((await snap()).controls.steer),{timeout:10000}).toBeLessThan(.01);evidence.push({turn:label,before:a,held:b,afterRelease:await snap()});await page.keyboard.press('Escape');
 }
 fs.writeFileSync('reports/keyboard-steering-screen.json',JSON.stringify(evidence,null,2));
});
