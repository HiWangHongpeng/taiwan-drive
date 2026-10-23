import {afterEach,expect,test,vi} from 'vitest';
import {loadWorld} from '../src/startup';

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});

test('a missing map reports its HTTP status instead of attempting scene creation',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('Unavailable',{status:503})));
 await expect(loadWorld('/data/world.json')).rejects.toThrow('HTTP 503');
});

test('the download deadline also cancels a stalled response body',async()=>{
 vi.useFakeTimers();
 let aborted=false;
 vi.stubGlobal('fetch',vi.fn((_url,{signal}:{signal:AbortSignal})=>Promise.resolve({ok:true,json:()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Aborted','AbortError'));}))})));
 const pending=expect(loadWorld('/data/world.json',100)).rejects.toThrow('地圖下載逾時');
 await vi.advanceTimersByTimeAsync(100);await pending;expect(aborted).toBe(true);
});

test('an HTML error page or incomplete map is explained before rendering',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(new Response('<html>error</html>')).mockResolvedValueOnce(new Response('{}'));
 vi.stubGlobal('fetch',fetch);
 await expect(loadWorld('/data/world.json')).rejects.toThrow('地圖檔案格式錯誤');
 await expect(loadWorld('/data/world.json')).rejects.toThrow('地圖資料不完整');
});
