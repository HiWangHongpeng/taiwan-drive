import {clamp,type Car} from './core';
/** Interpolate completed physics states, with one fixed-step presentation latency. */
export function interpolateCar(previous:Car,current:Car,alpha:number):Car{
 const t=clamp(alpha,0,1),mix=(a:number,b:number)=>a+(b-a)*t;
 return{...current,x:mix(previous.x,current.x),y:mix(previous.y,current.y),z:mix(previous.z,current.z),speed:mix(previous.speed,current.speed),yaw:previous.yaw+Math.atan2(Math.sin(current.yaw-previous.yaw),Math.cos(current.yaw-previous.yaw))*t};
}
