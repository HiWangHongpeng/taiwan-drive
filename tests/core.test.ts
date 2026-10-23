import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {controls,spawn,step,clear,steering,finish,validate,treeAllowed,nearest,type World,type Point} from '../src/core';
const w=JSON.parse(fs.readFileSync('public/data/world.json','utf8')) as World;
const straight:Point[]=[[0,0,0],[0,0,1000]];
describe('driving and input',()=>{
 it('integrates a ground vehicle independently of route playback',()=>{const car=spawn(straight),c=controls();c.throttle=true;c.left=true;for(let i=0;i<100;i++)step(car,c,straight,1/60);expect(car.travel).toBeGreaterThan(3);expect(car.yaw).not.toBe(0);expect(car.x).not.toBe(0);});
 it('progressive keyboard steering, opposing keys, adjustable return and pause clear',()=>{
  const c=controls();c.left=true;expect(steering(c,.1)).toBeCloseTo(.14);
  c.right=true;expect(steering(c,.1)).toBe(0);
  c.left=false;expect(steering(c,.1)).toBeCloseTo(-.14);
  c.right=false;c.returnRate=.5;expect(steering(c,.1)).toBeCloseTo(-.09);
  c.throttle=c.brake=c.left=c.right=true;clear(c);
  expect(c).toMatchObject({throttle:false,brake:false,left:false,right:false,steer:0});
 });
 it('brakes then reverses; W/S together only brake',()=>{const car=spawn(straight),c=controls();car.speed=8;c.brake=true;for(let i=0;i<50;i++)step(car,c,straight,1/60);expect(car.speed).toBeGreaterThanOrEqual(0);for(let i=0;i<150;i++)step(car,c,straight,1/60);expect(car.speed).toBeLessThan(-1);c.throttle=true;for(let i=0;i<180;i++)step(car,c,straight,1/60);expect(car.speed).toBeCloseTo(0);});
 it('finishes only near endpoint while stopped in either direction',()=>{for(const route of w.routes){const car=spawn(route);expect(finish(car,route)).toBe(false);const end=route.at(-1)!;Object.assign(car,{x:end[0],y:end[1],z:end[2]});expect(finish(car,route)).toBe(true);car.speed=1;expect(finish(car,route)).toBe(false);}});
});
describe('source geography and storage',()=>{
 it('has connected opposing real routes with consistent elevations',()=>{expect(w.routes).toHaveLength(2);for(const r of w.routes){expect(nearest(r,...[r[0][0],r[0][2]] as [number,number]).total).toBeGreaterThan(5300);for(let i=1;i<r.length;i++){expect(Math.hypot(r[i][0]-r[i-1][0],r[i][2]-r[i-1][2])).toBeLessThan(5.01);expect(Math.abs(r[i][1]-r[i-1][1])).toBeLessThan(2);}}expect(w.routes[0][0][0]).toBeLessThan(w.routes[0].at(-1)![0]);expect(w.routes[1][0][0]).toBeGreaterThan(w.routes[1].at(-1)![0]);});
 it('excludes vegetation from buildings, parking, paths, stops and roads',()=>{const square:Point[]=[[-30,0,-30],[30,0,-30],[30,0,30],[-30,0,30],[-30,0,-30]];const wood={id:'1',type:'way',kind:'wood',tags:{},points:square};expect(treeAllowed(0,0,[wood],[])).toBe(true);for(const kind of ['building','parking','beach','path','bus'])expect(treeAllowed(0,0,[wood,{...wood,kind,points:kind==='path'?[[-10,0,0],[10,0,0]]:kind==='bus'?[[0,0,0]]:square}],[])).toBe(false);expect(treeAllowed(0,0,[wood],[straight])).toBe(false);expect(treeAllowed(50,0,[wood],[])).toBe(false);});
 it('strictly validates JSON import without mutating good saves',()=>{const good={version:1,direction:0,car:spawn(w.routes[0])};expect(validate(JSON.parse(JSON.stringify(good)),w)).toEqual(good);const before=JSON.stringify(good);for(const bad of [null,{}, {...good,extra:true}, {...good,version:2},{...good,direction:2},{...good,car:{...good.car,x:NaN}},{...good,car:{...good.car,x:1e9}},{...good,car:{...good.car,speed:999}}])expect(()=>validate(bad,w)).toThrow();expect(JSON.stringify(good)).toBe(before);});
});
