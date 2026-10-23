import {expect,test} from '@playwright/test';
import fs from 'node:fs';
const snapshot=(page:any)=>page.evaluate(()=>(window as any).__drive.snapshot(true));
const graphicsURL=process.env.DRIVE_GRAPHICS_URL??'http://localhost:5173';

test('graphics quality persists independently; static shadows cache and stable tree instances remain complete',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(graphicsURL);await expect(page.locator('#resume')).toBeEnabled({timeout:60000});
 await expect(page.locator('#quality')).toHaveValue('standard');
 const first=await snapshot(page);await page.waitForTimeout(1000);expect((await snapshot(page)).stats.graphics.shadowUpdates).toBe(first.stats.graphics.shadowUpdates);
 await page.locator('#resume').click();await page.keyboard.press('Escape');
 const saved=await page.evaluate(()=>localStorage.getItem('island-drive:save:v1'));
 for(const quality of ['low','high','standard','low']){
  await page.locator('#quality').selectOption(quality);await page.waitForTimeout(400);
  const s=await snapshot(page);expect(s.stats.graphics.quality).toBe(quality);
  expect(s.stats.graphics.canopyInstances).toBe(s.stats.diagnostics.trees);
  expect(s.stats.info.memory.textures).toBeLessThanOrEqual(first.stats.info.memory.textures+2);
 }
 expect(await page.evaluate(()=>localStorage.getItem('island-drive:save:v1'))).toBe(saved);
 await page.reload();await expect(page.locator('#resume')).toBeEnabled({timeout:60000});
 await expect(page.locator('#quality')).toHaveValue('low');expect((await snapshot(page)).paused).toBe(true);expect(errors).toEqual([]);
});

test('stable canopy geometry stays complete on both route checkpoint transitions; invalid graphics preferences fall back safely',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('island-drive:graphics:v1','{"quality":"untrusted"}'));
 await page.goto(graphicsURL);await expect(page.locator('#resume')).toBeEnabled({timeout:60000});await expect(page.locator('#quality')).toHaveValue('standard');
 const world=JSON.parse(fs.readFileSync('public/data/world.json','utf8'));
 for(const direction of [0,1]){
  const p=world.routes[direction][120],q=world.routes[direction][121];
  await page.locator('#import').setInputFiles({name:'lod-checkpoint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,direction,car:{x:p[0],y:p[1],z:p[2],yaw:Math.atan2(q[0]-p[0],q[2]-p[2]),speed:0,travel:0,collisions:0,reverseHold:0}}))});
  await page.waitForTimeout(600);const s=await snapshot(page);expect(s.stats.graphics.canopyInstances).toBe(s.stats.diagnostics.trees);expect(s.stats.graphics.treeRepresentation).toBe('stable-instanced-cluster-cards');
 }
});

test('switching shadow algorithms recompiles every receiving material',async({page})=>{
 // Observe WebGL calls in the test harness, without reading or changing Game state.
 await page.addInitScript(()=>{
  const modes=new WeakMap<WebGLProgram,string>();
  const sources=new WeakMap<WebGLShader,string>();
  const shaderSource=WebGL2RenderingContext.prototype.shaderSource;
  WebGL2RenderingContext.prototype.shaderSource=function(shader,source){sources.set(shader,source);shaderSource.call(this,shader,source);};
  const linkProgram=WebGL2RenderingContext.prototype.linkProgram;
  WebGL2RenderingContext.prototype.linkProgram=function(program){
   const fragment=(this.getAttachedShaders(program)??[]).map(shader=>sources.get(shader)??'').find(source=>source.includes('gl_FragColor'))??'';
   // Depth/blur passes can carry the same prefix but never sample a directional shadow map.
   if(/^#define USE_SHADOWMAP\s*$/m.test(fragment)&&fragment.includes('uniform sampler2D directionalShadowMap'))modes.set(program,/^#define SHADOWMAP_TYPE_VSM\s*$/m.test(fragment)?'vsm':/^#define SHADOWMAP_TYPE_PCF\s*$/m.test(fragment)?'pcf':/^#define SHADOWMAP_TYPE_PCF_SOFT\s*$/m.test(fragment)?'pcf-soft':'other');
   linkProgram.call(this,program);
  };
  const useProgram=WebGL2RenderingContext.prototype.useProgram;
  (window as any).__observedShadowModes=[];
  WebGL2RenderingContext.prototype.useProgram=function(program){useProgram.call(this,program);if(program&&modes.has(program))(window as any).__observedShadowModes.push(modes.get(program));};
 });
 await page.goto(graphicsURL);await expect(page.locator('#resume')).toBeEnabled({timeout:60000});
 for(const [quality,expected] of [['high','pcf-soft'],['standard','pcf'],['high','pcf-soft'],['standard','pcf']]){
  await page.locator('#quality').selectOption(quality);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await page.evaluate(()=>(window as any).__observedShadowModes=[]);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const modes=await page.evaluate(()=>[...new Set((window as any).__observedShadowModes)]);
  expect(modes,quality).toEqual([expected]);
 }
});


test('standard moving shadows refresh within the first 16 metres and freeze on pause',async({page})=>{
 await page.goto(graphicsURL);await expect(page.locator('#resume')).toBeEnabled({timeout:90000});const first=await snapshot(page);
 await page.locator('#resume').click();await page.keyboard.down('KeyW');
 await expect.poll(async()=>(await snapshot(page)).stats.graphics.shadowUpdates,{timeout:30000}).toBeGreaterThan(first.stats.graphics.shadowUpdates+2);
 await page.keyboard.up('KeyW');await page.keyboard.press('Escape');const end=await snapshot(page);expect(end.car.travel).toBeGreaterThan(.12);expect(end.car.travel).toBeLessThan(16);
 await page.waitForTimeout(1200);expect((await snapshot(page)).stats.graphics.shadowUpdates).toBe(end.stats.graphics.shadowUpdates);
});
