import {test,expect} from 'vitest';
import fs from 'node:fs';
import {nearest,spawn,controls,step,type Point,type World} from '../src/core';
import {roundedRoad} from '../src/road-surface';

test('visual road rounding preserves endpoints and stays within 20 cm of every source route',()=>{
 const world=JSON.parse(fs.readFileSync('public/data/world.json','utf8'))as World,before=JSON.stringify(world.routes);
 for(const route of [...world.routes,[[0,0,0],[0,1,5],[5,2,5]]as Point[]]){const smooth=roundedRoad(route);expect(smooth[0]).toEqual(route[0]);expect(smooth.at(-1)).toEqual(route.at(-1));for(const p of smooth)expect(nearest(route,p[0],p[2]).distance).toBeLessThanOrEqual(.200001);}
 expect(JSON.stringify(world.routes)).toBe(before);
});
test('soft verge contact has bounded displacement, converges with timestep and never steers along the road',()=>{
 const route:Point[]=[[0,0,0],[0,0,2000]],run=(dt:number)=>{const car={...spawn(route),x:3.69,speed:10,yaw:.08},input=controls();let maxJump=0;for(let i=0;i<6/dt;i++){const old=car.x;step(car,input,route,dt);maxJump=Math.max(maxJump,Math.abs(car.x-old));}return{car,maxJump};},a=run(1/60),b=run(1/120);
 expect(a.maxJump).toBeLessThan(.03);expect(Math.abs(a.car.x-b.car.x)).toBeLessThan(.025);expect(Math.abs(a.car.speed-b.car.speed)).toBeLessThan(.05);expect(a.car.yaw).toBe(.08);expect(a.car.collisions).toBe(1);
 const car={...spawn(route),x:8,speed:0};step(car,controls(),route,1/60);expect(8-car.x).toBeLessThanOrEqual(2/60+1e-9);expect(car.yaw).toBe(0);
});

test('road-band terrain refinement clears both asphalt routes and stitches to coarse terrain',async()=>{
 const {Ground,CORRIDOR,DETAIL,contains}=await import('../src/geography'),{RoadSurface,ribbonGeometry}=await import('../src/road-surface'),world=JSON.parse(fs.readFileSync('public/data/world.json','utf8'))as World,g=new Ground(world),surface=new RoadSurface();
 for(const r of world.routes){const m=ribbonGeometry(roundedRoad(r),3.8,.055);surface.add(m.positions,m.indices);}
 for(const r of world.routes)for(let i=0;i<r.length;i+=5){const p=r[i];expect(g.renderedHeight(p[0],p[2])).toBeLessThan(surface.height(p[0],p[2])!);}
 let checked=0;for(let x=CORRIDOR.minX;x<CORRIDOR.maxX;x+=20)for(let z=CORRIDOR.minZ;z<CORRIDOR.maxZ;z+=20){if(!g.roadCellRefined(x,z)||g.roadCellRefined(x+20,z)||contains(DETAIL,x+30,z+10))continue;for(const n of [3,7,13,17]){expect(Math.abs(g.renderedHeight(x+20-1e-6,z+n)-g.renderedHeight(x+20+1e-6,z+n))).toBeLessThan(.001);checked++;}}
 expect(checked).toBeGreaterThan(20);
});

test('actual rendered shoulders remove abrupt body-height and roll changes when crossing the asphalt edge',async()=>{
 const T=await import('three'),{Ground}=await import('../src/geography'),{RoadSurface,ribbonGeometry,vergeGeometry}=await import('../src/road-surface'),{groundVehicle}=await import('../src/vehicle-grounding'),w=JSON.parse(fs.readFileSync('public/data/world.json','utf8'))as World,meta=JSON.parse(fs.readFileSync('source-data/carconcept.json','utf8')).meta,g=new Ground(w),old=new RoadSurface(),current=new RoadSurface();
 for(const r of w.routes){const ps=roundedRoad(r),m=ribbonGeometry(ps,3.8,.055);old.add(m.positions,m.indices);current.add(m.positions,m.indices);for(const sign of [-1,1]){const shoulder=vergeGeometry(ps,(x,z)=>g.renderedHeight(x,z),sign);current.add(shoulder.positions,shoulder.indices);}}
 const scan=(surface:InstanceType<typeof RoadSurface>)=>{let maxY=0,maxRotation=0,samples=0;for(const index of [0,50,100,180,700])for(const sign of [-1,1]){const p=w.routes[0][index],q=w.routes[0][index+1],yaw=Math.atan2(q[0]-p[0],q[2]-p[2]),body=new T.Group(),pivots=meta.wheels.map((w:{center:number[]})=>{const n=new T.Group();n.position.fromArray(w.center);body.add(n);return n;});let previous:{y:number;q:InstanceType<typeof T.Quaternion>}|undefined;
  for(let n=0;n<=200;n++){const d=n*.02;groundVehicle(body,pivots,meta.wheelRadius,p[0]+Math.cos(yaw)*d*sign,p[2]-Math.sin(yaw)*d*sign,yaw,(x,z)=>surface.height(x,z)??g.renderedHeight(x,z));const pose={y:body.position.y,q:body.quaternion.clone()};if(previous){maxY=Math.max(maxY,Math.abs(pose.y-previous.y));maxRotation=Math.max(maxRotation,pose.q.angleTo(previous.q));}previous=pose;samples++;}}
 return{samples,max_y_change_m_per_2cm:maxY,max_rotation_change_rad_per_2cm:maxRotation};};
 const before=scan(old),after=scan(current);fs.writeFileSync('reports/road-verge-audit.json',JSON.stringify({method:'Controlled geometry comparison: same current road/terrain/tyre support, asphalt-only fallback versus actual new shoulder triangles. Five source poses, both lateral directions, 0–4m lateral offset at 2cm increments. Reference contact geometry only; not human driving or an all-route pixel proof.',before,after},null,2));expect(after.max_y_change_m_per_2cm).toBeLessThan(.01);expect(after.max_rotation_change_rad_per_2cm).toBeLessThan(.02);expect(before.max_y_change_m_per_2cm).toBeGreaterThan(after.max_y_change_m_per_2cm*5);
});
