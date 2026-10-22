import {test,expect} from '@playwright/test';
test('invalid stored raw survives refresh, autosave intervals and pause until explicit restart',async({page})=>{
 const raw='{"version":1,"car":"broken original"}';
 await page.addInitScript(value=>{if(!sessionStorage.getItem('seeded-raw')){localStorage.setItem('island-drive:save:v1',value);sessionStorage.setItem('seeded-raw','1');}},raw);
 const stored=()=>page.evaluate(()=>localStorage.getItem('island-drive:save:v1'));
 await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:60000});await expect(page.locator('#status')).toContainText('自動儲存暫停');await page.waitForTimeout(5200);expect(await stored()).toBe(raw);
 await page.locator('#resume').click();await page.keyboard.press('Escape');expect(await stored()).toBe(raw);
 await page.reload();await expect(page.locator('#resume')).toBeEnabled({timeout:60000});await page.waitForTimeout(5200);expect(await stored()).toBe(raw);
 const backup=page.waitForEvent('download');await page.locator('#backup-raw').click();expect((await backup).suggestedFilename()).toBe('island-drive-original-save.txt');expect(await stored()).toBe(raw);
 await page.locator('#restart').click();expect(await stored()).not.toBe(raw);expect(await page.evaluate(()=>(window as any).__drive.snapshot().storageBlocked)).toBe(false);
 await page.locator('#resume').click();await page.keyboard.down('KeyW');await expect.poll(async()=>JSON.parse((await stored())!).car.travel,{timeout:15000}).toBeGreaterThan(2);await page.keyboard.up('KeyW');await page.keyboard.press('Escape');
});
