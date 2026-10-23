import{test,expect}from'@playwright/test';
test('desktop cockpit HUD is clear; 320px keyboard menu controls and help remain readable',async({page})=>{
 await page.goto('http://localhost:5173');await expect(page.locator('#resume')).toBeEnabled({timeout:60000});await page.locator('#view').click();
 for(const [width,height]of[[1440,900],[960,600]]){
  await page.setViewportSize({width,height});await page.locator('#resume').click();await page.waitForTimeout(1000);
  const dash=await page.locator('#cockpit').boundingBox(),hud=await page.locator('footer').boundingBox(),map=await page.locator('#map').boundingBox();expect(hud!.y+hud!.height).toBeLessThan(dash!.y);expect(map!.y+map!.height).toBeLessThan(dash!.y);
  await page.screenshot({path:`reports/keyboard-cockpit-${width}.png`});await page.locator('#pause').click();
 }
 await page.setViewportSize({width:320,height:568});await expect(page.locator('#mode')).toHaveCount(0);
 expect(await page.locator('#menu').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 for(const id of ['view','turn','center','volume','export','finish']){await page.locator('#'+id).scrollIntoViewIfNeeded();await expect(page.locator('#'+id)).toBeVisible();}
 await page.locator('summary').click();await expect(page.locator('details')).toContainText('駕駛使用鍵盤');await expect(page.locator('details')).not.toContainText('中鍵');
 await page.locator('#menu').evaluate(e=>e.scrollTop=0);await page.screenshot({path:'reports/keyboard-narrow.png'});
});
