import {test,expect} from '@playwright/test';

const siteURL=process.env.DRIVE_BASE_URL??'http://127.0.0.1:5174/taiwan-drive/';

for(const failure of ['constructor','resume'] as const){
 test(`production can start and drive when audio ${failure} fails`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(mode=>{
   if(mode==='constructor')Object.defineProperty(window,'AudioContext',{value:undefined});
   else AudioContext.prototype.resume=()=>Promise.reject(new Error('Audio device unavailable'));
  },failure);
  await page.goto(siteURL);
  await expect(page.locator('#resume')).toBeEnabled({timeout:60000});
  await page.locator('#resume').click();
  await expect(page.locator('#menu')).not.toBeVisible();
  await expect(page.locator('#hint')).toContainText('音效無法啟用');
  await page.keyboard.down('KeyW');
  await expect.poll(async()=>Number(await page.locator('#speed').textContent()),{timeout:10000}).toBeGreaterThan(4);
  await page.keyboard.up('KeyW');await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeVisible();expect(errors).toEqual([]);
 });
}

test('map failure offers a working reload and preserves the saved raw value',async({page})=>{
 let fail=true;
 await page.route('**/data/world.json',async route=>{if(fail)await route.fulfill({status:503,body:'Unavailable'});else await route.continue();});
 await page.addInitScript(()=>localStorage.setItem('island-drive:save:v1','keep-original-raw'));
 await page.goto(siteURL);
 await expect(page.locator('#status')).toContainText('HTTP 503');
 await expect(page.locator('#nav')).toHaveText('載入未完成');
 await expect(page.locator('#resume')).toBeDisabled();
 expect(await page.evaluate(()=>localStorage.getItem('island-drive:save:v1'))).toBe('keep-original-raw');
 fail=false;await page.locator('#retry').click();
 await expect(page.locator('#resume')).toBeEnabled({timeout:60000});
 await expect(page.locator('#status')).toContainText('原始內容已保留');
 expect(await page.evaluate(()=>localStorage.getItem('island-drive:save:v1'))).toBe('keep-original-raw');
});

test('unavailable WebGL displays an actionable message instead of an endless loading screen',async({page})=>{
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,kind:string,...args:unknown[]){
   if(kind==='webgl2'||kind==='webgl'||kind==='experimental-webgl')return null;
   return original.apply(this,[kind,...args] as Parameters<typeof original>);
  } as typeof original;
 });
 await page.goto(siteURL);
 await expect(page.locator('#status')).toContainText('無法啟用 WebGL 2',{timeout:60000});
 await expect(page.locator('#nav')).toHaveText('載入未完成');
 await expect(page.locator('#retry')).toBeVisible();await expect(page.locator('#resume')).toBeDisabled();
});
