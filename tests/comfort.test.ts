import {test,expect} from 'vitest';import * as T from 'three';import fs from 'node:fs';import crypto from 'node:crypto';
import {interpolateCar} from '../src/presentation';import {spawn,type World} from '../src/core';import {RoadSurface,ribbonGeometry} from '../src/road-surface';import {groundVehicle,wheelContacts} from '../src/vehicle-grounding';import {Lines} from '../src/geography';import {guardrailBeam} from '../src/facilities';

test('presentation interpolates fixed-step motion evenly and takes the short yaw arc without changing physics',()=>{
 const route:[[number,number,number],[number,number,number]]=[[0,0,0],[0,0,30]],a=spawn(route),b={...a,z:.2,yaw:-Math.PI+.01},previous={...a,yaw:Math.PI-.01};const original={...b};
 const samples=[0,.25,.5,.75,1].map(alpha=>interpolateCar(previous,b,alpha));for(let i=1;i<samples.length;i++)expect(samples[i].z-samples[i-1].z).toBeCloseTo(.05,9);expect(samples[2].yaw).toBeCloseTo(Math.PI,8);expect(b).toEqual(original);expect(interpolateCar(b,b,.5)).toEqual(b);
});
test('asphalt sampler matches submitted triangles, chooses the visible upper surface and rejects outside points',()=>{
 const s=new RoadSurface();for(const y of [1,2]){const g=ribbonGeometry([[0,y,0],[0,y+1,10]],3.8,.055);s.add(g.positions,g.indices);}expect(s.height(1,5)).toBeCloseTo(2.555,8);expect(s.height(4,5)).toBeUndefined();expect(s.height(-3,10)).toBeCloseTo(3.055,8);
});
test('actual two-way route supports keep reference tyre contacts grounded across all source poses',()=>{
 const world=JSON.parse(fs.readFileSync('public/data/world.json','utf8'))as World,meta=JSON.parse(fs.readFileSync('source-data/carconcept.json','utf8')).meta,road=new RoadSurface(),lines=new Lines(world.routes.map((points,i)=>({points,id:String(i)})),90);
 for(const r of world.routes){const g=ribbonGeometry(r,3.8,.055);road.add(g.positions,g.indices);}const height=(x:number,z:number)=>road.height(x,z)??lines.nearest(x,z).y+.055,before:number[]=[],after:number[]=[];let poses=0,maxSuspension=0;
 for(const route of world.routes)for(let i=1;i<route.length-1;i++){const p=route[i],q=route[i+1],yaw=Math.atan2(q[0]-p[0],q[2]-p[2]),body=new T.Group(),pivots=meta.wheels.map((w:{center:number[]})=>{const o=new T.Group();o.position.fromArray(w.center);body.add(o);return o;});const n=lines.nearest(p[0],p[2]);body.rotation.order='YXZ';body.rotation.y=yaw;body.rotation.x=-Math.atan2(n.b[1]-n.a[1],Math.hypot(n.b[0]-n.a[0],n.b[2]-n.a[2]))*Math.cos(yaw-Math.atan2(n.b[0]-n.a[0],n.b[2]-n.a[2]));body.position.set(p[0],p[1]+.07,p[2]);body.updateMatrixWorld(true);before.push(...wheelContacts(body,pivots,meta.wheelRadius,height).map(c=>Math.abs(c.gap_m)));
  groundVehicle(body,pivots,meta.wheelRadius,p[0],p[2],yaw,height);const contacts=wheelContacts(body,pivots,meta.wheelRadius,height);after.push(...contacts.map(c=>Math.abs(c.gap_m)));maxSuspension=Math.max(maxSuspension,...contacts.map(c=>Math.abs(c.suspension_m)));poses++;
 }
 const summary=(a:number[])=>{a.sort((x,y)=>x-y);return{count:a.length,max_m:a.at(-1)!,p95_m:a[Math.ceil(a.length*.95)-1]};},audit={method:'Offline reference tyre contact points using actual submitted route ribbon triangles, source GLB wheel centers/radius, both routes at every interior source point. Upper rendered asphalt at overlaps; nearest-profile fallback outside ribbons. Not a rigid-body or pixel/tyre-mesh contact proof.',poses,before:summary(before),after:summary(after),max_suspension_m:maxSuspension,world_sha256:crypto.createHash('sha256').update(fs.readFileSync('public/data/world.json')).digest('hex')};
 fs.writeFileSync('reports/comfort-contact-audit.json',JSON.stringify(audit,null,2));console.log(JSON.stringify(audit));expect(audit.after.p95_m).toBeLessThan(.003);expect(audit.after.max_m).toBeLessThan(.02);expect(maxSuspension).toBeLessThanOrEqual(.080001);
});
test('corrugated guardrail sections share identical seven-point joints and retain a real W profile',()=>{
 const a:[number,number,number]=[0,0,0],b:[number,number,number]=[2,.2,5],c:[number,number,number]=[3,.3,10],g=guardrailBeam(a,b,[1,0],[.9,-.1]),h=guardrailBeam(b,c,[.9,-.1],[1,0]),p=g.getAttribute('position'),q=h.getAttribute('position');for(let i=0;i<7;i++)expect([p.getX(i+7),p.getY(i+7),p.getZ(i+7)]).toEqual([q.getX(i),q.getY(i),q.getZ(i)]);expect(g.index!.count/3).toBe(12);expect(p.getX(3)-p.getX(1)).toBeGreaterThan(.09);
});
