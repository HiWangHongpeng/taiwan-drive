// REJECTED experiment: dense audit found up to 8.993m difference near streams. Never imported by Game.
import * as T from 'three';
import type {Bounds} from '../../src/geography';

/** Merge only visually equivalent terrain cells; protect mapped features and keep shared edges. */
export function adaptiveTerrain(bounds:Bounds,height:(x:number,z:number)=>number,kind:(x:number,z:number)=>string,protectedCell:(x:number,z:number)=>boolean,channel:(x:number,z:number)=>boolean){
 const leaves:{x:number;z:number;size:number}[]=[],rows=new Map<number,Set<number>>(),cols=new Map<number,Set<number>>();let coarse=0,fine=0,maxMergeError=0;
 const add=(x:number,z:number,size:number)=>{leaves.push({x,z,size});for(const [xx,zz]of[[x,z],[x+size,z],[x,z+size],[x+size,z+size]]){if(!rows.has(zz))rows.set(zz,new Set());rows.get(zz)!.add(xx);if(!cols.has(xx))cols.set(xx,new Set());cols.get(xx)!.add(zz);}};
 for(let z=bounds.minZ;z<bounds.maxZ;z+=8)for(let x=bounds.minX;x<bounds.maxX;x+=8){let canMerge=x+8<=bounds.maxX&&z+8<=bounds.maxZ&&!protectedCell(x+4,z+4)&&!channel(x+4,z+4),error=0;const a=height(x,z),b=height(x+8,z),c=height(x,z+8),d=height(x+8,z+8),base=kind(x,z);
  for(const u of [0,.5,1])for(const v of [0,.5,1]){const xx=x+u*8,zz=z+v*8,h=u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);error=Math.max(error,Math.abs(height(xx,zz)-h));if(kind(xx,zz)!==base)canMerge=false;}
  if(canMerge&&error<=.03){add(x,z,8);coarse++;maxMergeError=Math.max(maxMergeError,error);}else for(let zz=z;zz<Math.min(z+8,bounds.maxZ);zz+=4)for(let xx=x;xx<Math.min(x+8,bounds.maxX);xx+=4){if(channel(xx+2,zz+2)){for(let j=0;j<4;j++)for(let i=0;i<4;i++)add(xx+i,zz+j,1);fine++;}else add(xx,zz,4);}
 }
 const rs=new Map([...rows].map(([k,v])=>[k,[...v].sort((a,b)=>a-b)])),cs=new Map([...cols].map(([k,v])=>[k,[...v].sort((a,b)=>a-b)]));
 const between=(a:number[],lo:number,hi:number)=>{let l=0,r=a.length;while(l<r){const m=(l+r)>>1;if(a[m]<lo)l=m+1;else r=m;}const out:number[]=[];while(l<a.length&&a[l]<=hi)out.push(a[l++]);return out;};
 const positions:number[]=[],indices:number[]=[],vertex=new Map<string,number>(),buckets=new Map<string,number[]>();
 const id=(x:number,z:number)=>{const key=`${x},${z}`;let i=vertex.get(key);if(i===undefined){i=positions.length/3;positions.push(x,height(x,z),z);vertex.set(key,i);}return i;};
 for(const {x,z,size:s}of leaves){const loop=[...between(cs.get(x)!,z,z+s).map(zz=>id(x,zz)),...between(rs.get(z+s)!,x+1e-5,x+s).map(xx=>id(xx,z+s)),...between(cs.get(x+s)!,z,z+s-1e-5).reverse().map(zz=>id(x+s,zz)),...between(rs.get(z)!,x+1e-5,x+s-1e-5).reverse().map(xx=>id(xx,z))],start=indices.length;
  if(loop.length===4)indices.push(loop[0],loop[1],loop[3],loop[1],loop[2],loop[3]);else{const center=id(x+s/2,z+s/2);for(let i=0;i<loop.length;i++)indices.push(center,loop[i],loop[(i+1)%loop.length]);}
  const key=`${Math.floor((x-bounds.minX)/8)},${Math.floor((z-bounds.minZ)/8)}`,list=buckets.get(key)??[];for(let i=start;i<indices.length;i+=3)list.push(i);buckets.set(key,list);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const p=geo.getAttribute('position');
 const sample=(x:number,z:number)=>{if(x<bounds.minX||x>=bounds.maxX||z<bounds.minZ||z>=bounds.maxZ)return undefined;let result:number|undefined;for(const i of buckets.get(`${Math.floor((x-bounds.minX)/8)},${Math.floor((z-bounds.minZ)/8)}`)??[]){const [a,b,c]=indices.slice(i,i+3),ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c),den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-8)continue;const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den;if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)result=u*p.getY(a)+v*p.getY(b)+(1-u-v)*p.getY(c);}return result;};
 return{geo,sample,stats:{coarse8mCells:coarse,channel4mCellsRefinedTo1m:fine,leafCells:leaves.length,triangles:indices.length/3,maxMergedHeightError_m:maxMergeError}};
}
