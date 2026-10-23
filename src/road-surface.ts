import * as T from 'three';
import type {Point} from './core';

/** The exact submitted asphalt triangles; no independent DEM resampling at the tyres. */
export function ribbonGeometry(ps:Point[],halfWidth:number,offset=0,side=0){
 const positions:number[]=[],indices:number[]=[];
 ps.forEach((p,i)=>{const a=ps[Math.max(0,i-1)],b=ps[Math.min(ps.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
  for(const k of [-halfWidth+side,halfWidth+side])positions.push(p[0]+(b[2]-a[2])/l*k,p[1]+offset,p[2]-(b[0]-a[0])/l*k);
  if(i<ps.length-1){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
 });return{positions,indices};
}
export class RoadSurface{
 private cells=new Map<string,{a:T.Vector3;b:T.Vector3;c:T.Vector3;den:number}[]>();
 add(positions:number[],indices:number[]){for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3).map(n=>new T.Vector3(...positions.slice(n*3,n*3+3))),den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-9)continue;const tri={a,b,c,den};for(let x=Math.floor(Math.min(a.x,b.x,c.x)/32);x<=Math.floor(Math.max(a.x,b.x,c.x)/32);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/32);z<=Math.floor(Math.max(a.z,b.z,c.z)/32);z++){const key=`${x},${z}`,list=this.cells.get(key)??[];list.push(tri);this.cells.set(key,list);}}}
 height(x:number,z:number){let height=-Infinity;for(const {a,b,c,den}of this.cells.get(`${Math.floor(x/32)},${Math.floor(z/32)}`)??[]){const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)height=Math.max(height,u*a.y+v*b.y+(1-u-v)*c.y);}return height===-Infinity?undefined:height;}
}
