import{test,expect}from'@playwright/test';import fs from 'node:fs';
const snap=(page:any)=>page.evaluate(()=>(window as any).__drive.snapshot());
test('moving mouse and all canvas buttons cannot supply driving inputs or capture pointer',async({page})=>{
 await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:60000});await page.locator('#resume').click();
 await page.mouse.move(500,300);await page.mouse.move(700,350,{steps:5});
 for(const button of ['left','right','middle'] as const){await page.mouse.down({button});await page.waitForTimeout(300);const s=await snap(page);expect(s.controls).toMatchObject({throttle:false,brake:false,left:false,right:false,steer:0});await page.mouse.up({button});}
 expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();expect((await snap(page)).paused).toBe(false);
 await page.locator('#pause').click();await expect(page.locator('#menu')).toBeVisible();await page.locator('#view').click();await page.locator('#resume').click();await expect(page.locator('#cockpit')).toBeVisible();
});
test('keyboard blur/hidden safety clears held keys and requires explicit resume',async({page,context})=>{
 await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:60000});await page.locator('#resume').click();
 await page.keyboard.down('KeyW');await page.keyboard.down('KeyA');await expect.poll(async()=>(await snap(page)).controls.throttle).toBe(true);
 // Native tab activation is attempted; the explicit event also isolates the blur handler in headless Chromium.
 const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();await page.waitForTimeout(300);
 const nativeTabPaused=(await snap(page)).paused;
 if(!nativeTabPaused)await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 expect((await snap(page)).controls).toMatchObject({throttle:false,brake:false,left:false,right:false,steer:0});expect((await snap(page)).paused).toBe(true);
 await page.keyboard.up('KeyW');await page.keyboard.up('KeyA');await other.close();await page.bringToFront();expect((await snap(page)).paused).toBe(true);
 await page.locator('#resume').click();await page.keyboard.down('KeyS');await page.keyboard.down('KeyD');
 // document.hidden is browser-owned; CDP lifecycle freezes the page instead of mutating game state.
 const cdp=await context.newCDPSession(page);await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await cdp.send('Page.setWebLifecycleState',{state:'active'});
 const lifecyclePaused=(await snap(page)).paused;
 if(!lifecyclePaused){await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete (document as any).hidden;});}
 expect((await snap(page)).paused).toBe(true);expect((await snap(page)).controls).toMatchObject({throttle:false,brake:false,left:false,right:false,steer:0});await page.keyboard.up('KeyS');await page.keyboard.up('KeyD');
 fs.writeFileSync('reports/keyboard-focus.json',JSON.stringify({nativeTabPaused,lifecyclePaused,handlerFallbackUsed:!nativeTabPaused||!lifecyclePaused,scope:'Headless tab/lifecycle attempt plus isolated DOM-event handler regression where needed; no claim of all OS native focus coverage.'},null,2));
});
test('existing v1 save loads unchanged and paused, then keyboard driving and autosave continue',async({page})=>{
 const w=JSON.parse(fs.readFileSync('public/data/world.json','utf8'));const a=w.routes[1][0],b=w.routes[1][1];const old={version:1,direction:1,car:{x:a[0],y:a[1],z:a[2],yaw:Math.atan2(b[0]-a[0],b[2]-a[2]),speed:0,travel:123,collisions:2,reverseHold:0}};
 await page.addInitScript(s=>{if(!sessionStorage.getItem('seed-old')){localStorage.setItem('island-drive:save:v1',JSON.stringify(s));sessionStorage.setItem('seed-old','1');}},old);
 await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:60000});expect(await snap(page)).toMatchObject({direction:1,paused:true,storageBlocked:false,car:old.car});
 await page.reload();await expect(page.locator('#resume')).toBeEnabled({timeout:60000});expect((await snap(page)).car).toEqual(old.car);
 await page.locator('#resume').click();await page.keyboard.down('KeyW');await expect.poll(async()=>JSON.parse((await page.evaluate(()=>localStorage.getItem('island-drive:save:v1')))! ).car.travel,{timeout:15000}).toBeGreaterThan(125);
 await page.keyboard.up('KeyW');await page.keyboard.press('Escape');expect((await snap(page)).direction).toBe(1);
});
