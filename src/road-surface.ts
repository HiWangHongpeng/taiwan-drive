import * as T from 'three';
import type {Point} from './core';

/** Visual corner rounding only; source route remains untouched. Quadratic corners stay
 * within 0.20 m of the source polyline, with at most 0.9 m cutback each side. */
export function roundedRoad(ps:Point[]):Point[]{
 if(ps.length<3)return ps.map(p=>[...p]);const out:Point[]=[[...ps[0]]];
 for(let i=1;i<ps.length-1;i++){const a=ps[i-1],p=ps[i],b=ps[i+1],l=Math.hypot(p[0]-a[0],p[2]-a[2]),r=Math.hypot(b[0]-p[0],b[2]-p[2]);
  if(l<1e-6||r<1e-6){out.push([...p]);continue;}
  const dot=Math.max(-1,Math.min(1,((p[0]-a[0])*(b[0]-p[0])+(p[2]-a[2])*(b[2]-p[2]))/(l*r))),sinHalf=Math.sqrt((1-dot)/2);
  if(sinHalf<.002){out.push([...p]);continue;}
  const cut=Math.min(.9,l*.24,r*.24,.4/sinHalf),enter=p.map((v,k)=>v+(a[k]-v)*cut/l)as Point,exit=p.map((v,k)=>v+(b[k]-v)*cut/r)as Point;
  out.push(enter);for(let j=1;j<=6;j++){const t=j/6;out.push(p.map((v,k)=>(1-t)**2*enter[k]+2*(1-t)*t*v+t*t*exit[k])as Point);}
 }out.push([...ps.at(-1)!]);return out;
}

/** The exact submitted asphalt triangles; no independent DEM resampling at the tyres. */
export function ribbonGeometry(ps:Point[],halfWidth:number,offset=0,side=0){
 const positions:number[]=[],indices:number[]=[];
 ps.forEach((p,i)=>{const a=ps[Math.max(0,i-1)],b=ps[Math.min(ps.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
  const incoming=Math.hypot(p[0]-a[0],p[2]-a[2]),projection=incoming>1e-8?((b[0]-a[0])*(p[0]-a[0])+(b[2]-a[2])*(p[2]-a[2]))/(l*incoming):1,miter=1/Math.max(.8,projection);
  for(const k of [-halfWidth+side,halfWidth+side])positions.push(p[0]+(b[2]-a[2])/l*k*miter,p[1]+offset,p[2]-(b[0]-a[0])/l*k*miter);
  if(i<ps.length-1){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
 });return{positions,indices};
}
export class RoadSurface{
 private cells=new Map<string,{a:T.Vector3;b:T.Vector3;c:T.Vector3;den:number}[]>();
 add(positions:number[],indices:number[]){for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3).map(n=>new T.Vector3(...positions.slice(n*3,n*3+3))),den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-9)continue;const tri={a,b,c,den};for(let x=Math.floor(Math.min(a.x,b.x,c.x)/32);x<=Math.floor(Math.max(a.x,b.x,c.x)/32);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/32);z<=Math.floor(Math.max(a.z,b.z,c.z)/32);z++){const key=`${x},${z}`,list=this.cells.get(key)??[];list.push(tri);this.cells.set(key,list);}}}
 height(x:number,z:number){let height=-Infinity;for(const {a,b,c,den}of this.cells.get(`${Math.floor(x/32)},${Math.floor(z/32)}`)??[]){const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)height=Math.max(height,u*a.y+v*b.y+(1-u-v)*c.y);}return height===-Infinity?undefined:height;}
}

/** Estimated soft shoulder, joined exactly to the asphalt edge and sampled ground. */
export function vergeGeometry(ps:Point[],height:(x:number,z:number)=>number,sign:number){
 const positions:number[]=[],indices:number[]=[],width=5.4-3.8,rows=5;
 const strips=Array.from({length:rows},(_,j)=>ribbonGeometry(ps,0,.055,sign*(3.8+width*j/(rows-1))).positions);
 ps.forEach((p,i)=>{const outer=strips.at(-1)!,outerY=height(outer[i*6],outer[i*6+2])+.005;
  for(let j=0;j<rows;j++){const t=j/(rows-1),blend=t*t*(3-2*t);positions.push(strips[j][i*6],(p[1]+.055)*(1-blend)+outerY*blend,strips[j][i*6+2]);}
  if(i<ps.length-1)for(let j=0;j<rows-1;j++){const n=i*rows+j;if(sign>0)indices.push(n,n+rows,n+1,n+1,n+rows,n+rows+1);else indices.push(n,n+1,n+rows,n+1,n+rows+1,n+rows);}
 });return{positions,indices,rows};
}
