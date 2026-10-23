import type {World} from './core';

/** Bound both the response and its body; a stalled map must not leave a dead menu. */
export async function loadWorld(url:string,timeoutMs=20000):Promise<World>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetch(url,{signal:controller.signal});
  if(!response.ok)throw Error(`地圖下載失敗（HTTP ${response.status}）`);
  const world=await response.json() as World;
  if(!Array.isArray(world.routes)||world.routes.length!==2||world.routes.some(r=>!Array.isArray(r)||r.length<2)||!Array.isArray(world.features)||!world.terrain)throw Error('地圖資料不完整');
  return world;
 }catch(error){
  if(controller.signal.aborted)throw Error('地圖下載逾時，請檢查網路後重試');
  if(error instanceof SyntaxError)throw Error('地圖檔案格式錯誤，請重新載入');
  throw error;
 }finally{clearTimeout(timer);}
}
