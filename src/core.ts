export type Point=[number,number,number];
export interface Feature{id:string;type:string;kind:string;tags:Record<string,string>;points:Point[]}
export interface World{routes:Point[][];features:Feature[];terrain:{x:number;z:number;step:number;nx:number;nz:number;heights:number[]};metadata:Record<string,unknown>}
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function nearest(points:Point[],x:number,z:number){let best={distance:Infinity,index:0,t:0,x:0,y:0,z:0,heading:0,progress:0};let progress=0;for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);const t=clamp(((x-a[0])*dx+(z-a[2])*dz)/(length*length||1),0,1);const px=a[0]+dx*t,pz=a[2]+dz*t,d=Math.hypot(x-px,z-pz);if(d<best.distance)best={distance:d,index:i,t,x:px,y:a[1]+(b[1]-a[1])*t,z:pz,heading:Math.atan2(dx,dz),progress:progress+length*t};progress+=length;}return {...best,total:progress};}
export function inside(x:number,z:number,poly:Point[]){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[2]>z)!==(b[2]>z)&&x<(b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0])c=!c;}return c;}
export function treeAllowed(x:number,z:number,features:Feature[],roads:Point[][]){return features.some(f=>f.kind==='wood'&&inside(x,z,f.points)&&nearest(f.points,x,z).distance>5)&&!features.some(f=>['building','parking','beach'].includes(f.kind)&&(inside(x,z,f.points)||nearest(f.points,x,z).distance<6)||['path','stream','access'].includes(f.kind)&&nearest(f.points,x,z).distance<8||f.kind==='road'&&nearest(f.points,x,z).distance<12||f.kind==='bus'&&Math.hypot(x-f.points[0][0],z-f.points[0][2])<10)&&!roads.some(r=>nearest(r,x,z).distance<12);}
export interface Controls{throttle:boolean;brake:boolean;left:boolean;right:boolean;steer:number;turnRate:number;returnRate:number}
export const controls=():Controls=>({throttle:false,brake:false,left:false,right:false,steer:0,turnRate:1.4,returnRate:1.8});
export function clear(c:Controls){c.throttle=c.brake=c.left=c.right=false;c.steer=0;}
export function steering(c:Controls,dt:number){const target=Number(c.left)-Number(c.right);const step=(target?c.turnRate:c.returnRate)*dt;c.steer+=clamp(target-c.steer,-step,step);return c.steer;}
export interface Car{x:number;y:number;z:number;yaw:number;speed:number;travel:number;collisions:number;reverseHold:number}
export function spawn(route:Point[]):Car{const a=route[0],b=route[1];return{x:a[0],y:a[1],z:a[2],yaw:Math.atan2(b[0]-a[0],b[2]-a[2]),speed:0,travel:0,collisions:0,reverseHold:0};}
export function step(car:Car,c:Controls,route:Point[],dt:number){const near=nearest(route,car.x,car.z),a=route[near.index],b=route[near.index+1];let force=0;
 if(c.throttle&&c.brake){force=-Math.sign(car.speed)*9;car.reverseHold=0;}
 else if(c.brake){if(car.speed>0.08){force=-9;car.reverseHold=0;}else {car.reverseHold+=dt;force=car.reverseHold>0.45?-2.8:-Math.sign(car.speed)*9;}}
 else if(c.throttle){force=car.speed< -0.08?8:3.4;car.reverseHold=0;}else car.reverseHold=0;
 const grade=(b[1]-a[1])/Math.max(1,Math.hypot(b[0]-a[0],b[2]-a[2]));force-=Math.sign(car.speed)*(0.14+0.004*car.speed*car.speed)+9.81*grade*Math.cos(car.yaw-near.heading);
 const prev=car.speed;car.speed=clamp(car.speed+force*dt,-6,24);if((!c.throttle&&!c.brake||c.throttle&&c.brake)&&prev*car.speed<0)car.speed=0;if(c.brake&&prev>0&&car.speed<0){car.speed=0;}
 if(c.throttle&&c.brake&&Math.abs(car.speed)<.2)car.speed=0;if(c.brake&&!c.throttle&&car.reverseHold<=.45&&Math.abs(car.speed)<.2)car.speed=0;
 const angle=steering(c,dt)*0.5/(1+Math.abs(car.speed)/10),yawRate=clamp(car.speed/2.6*Math.tan(angle),-5/Math.max(1,Math.abs(car.speed)),5/Math.max(1,Math.abs(car.speed)));car.yaw+=yawRate*dt;car.x+=Math.sin(car.yaw)*car.speed*dt;car.z+=Math.cos(car.yaw)*car.speed*dt;car.travel+=Math.abs(car.speed)*dt;
 const after=nearest(route,car.x,car.z);
 // Soft verge contact: exponentially timed, capped normal displacement. No centreline steering.
 // Resistance ramps continuously from zero instead of toggling at a hard boundary.
 const penetration=Math.max(0,after.distance-3.7);
 if(penetration>0){const push=Math.min(penetration*(1-Math.exp(-8*dt)),2*dt),ratio=push/after.distance;
  car.x+=(after.x-car.x)*ratio;car.z+=(after.z-car.z)*ratio;
  if(Math.abs(car.speed)>2&&near.distance<=3.7)car.collisions++;
  car.speed*=Math.exp(-1.8*Math.min(1,(Math.max(0,near.distance-3.7)+penetration)/1.2)*dt);
 }
 car.y=penetration>0?nearest(route,car.x,car.z).y:after.y;
}
export function finish(car:Car,route:Point[]){const p=route.at(-1)!;return Math.hypot(car.x-p[0],car.z-p[2])<35&&Math.abs(car.speed)<0.4;}
export const SAVE_KEY='island-drive:save:v1';
export interface Save{version:1;direction:0|1;car:Car}
export function validate(value:unknown,world:World):Save{if(!value||typeof value!=='object')throw Error('存檔格式錯誤');const v=value as Save;if(v.version!==1||![0,1].includes(v.direction)||!v.car||typeof v.car!=='object')throw Error('存檔版本錯誤');if(Object.keys(v).sort().join(',')!=='car,direction,version')throw Error('存檔包含未知欄位');const c=v.car;if(Object.keys(c).sort().join(',')!=='collisions,reverseHold,speed,travel,x,y,yaw,z')throw Error('車輛欄位錯誤');for(const k of ['x','y','z','yaw','speed','travel','collisions','reverseHold'] as const)if(typeof c[k]!=='number'||!Number.isFinite(c[k]))throw Error('存檔數值錯誤');if(Math.abs(c.speed)>25||c.travel<0||c.travel>1e7||!Number.isInteger(c.collisions)||c.collisions<0||c.reverseHold<0||c.reverseHold>1e6||Math.abs(c.yaw)>1e7||nearest(world.routes[v.direction],c.x,c.z).distance>20||Math.abs(c.y-nearest(world.routes[v.direction],c.x,c.z).y)>10)throw Error('存檔超出範圍');return {version:1,direction:v.direction,car:{...c}};}
