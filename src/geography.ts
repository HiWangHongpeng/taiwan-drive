import {ShapeUtils,Vector2} from 'three';
import {clamp,inside,nearest,type Feature,type Point,type World} from './core';

export interface Bounds {minX:number;maxX:number;minZ:number;maxZ:number}
export const DETAIL:Bounds={minX:-700,maxX:1100,minZ:-800,maxZ:500};
export const CORRIDOR:Bounds={minX:-800,maxX:5500,minZ:-2000,maxZ:600};
export const contains=(b:Bounds,x:number,z:number)=>x>=b.minX&&x<b.maxX&&z>=b.minZ&&z<b.maxZ;
export const bounds=(ps:Point[]):Bounds=>({minX:Math.min(...ps.map(p=>p[0])),maxX:Math.max(...ps.map(p=>p[0])),minZ:Math.min(...ps.map(p=>p[2])),maxZ:Math.max(...ps.map(p=>p[2]))});
const smooth=(t:number)=>{const u=clamp(t,0,1);return u*u*(3-2*u);};
export function densify(ps:Point[],spacing=2):Point[]{const out:Point[]=[];for(let i=0;i<ps.length-1;i++){const a=ps[i],b=ps[i+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/spacing));for(let j=0;j<n;j++)out.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n,a[2]+(b[2]-a[2])*j/n]);}if(ps.length)out.push(ps.at(-1)!);return out;}
interface Segment{a:Point;b:Point;id:string}
export interface Hit{distance:number;x:number;y:number;z:number;a:Point;b:Point;id:string}
/** Spatial buckets preserve the input geometry and bound repeated terrain queries. */
export class Lines{
 private cells=new Map<string,Segment[]>();
 constructor(lines:{points:Point[];id:string}[],padding:number){for(const line of lines)for(let i=0;i<line.points.length-1;i++){const a=line.points[i],b=line.points[i+1],s={a,b,id:line.id};for(let x=Math.floor((Math.min(a[0],b[0])-padding)/128);x<=Math.floor((Math.max(a[0],b[0])+padding)/128);x++)for(let z=Math.floor((Math.min(a[2],b[2])-padding)/128);z<=Math.floor((Math.max(a[2],b[2])+padding)/128);z++){const key=`${x},${z}`,list=this.cells.get(key)??[];list.push(s);this.cells.set(key,list);}}}
 nearest(x:number,z:number):Hit{let best:Hit={distance:Infinity,x,y:0,z,a:[0,0,0],b:[0,0,0],id:''};for(const s of this.cells.get(`${Math.floor(x/128)},${Math.floor(z/128)}`)??[]){const dx=s.b[0]-s.a[0],dz=s.b[2]-s.a[2],t=clamp(((x-s.a[0])*dx+(z-s.a[2])*dz)/(dx*dx+dz*dz||1),0,1),px=s.a[0]+dx*t,pz=s.a[2]+dz*t,d=Math.hypot(x-px,z-pz);if(d<best.distance)best={distance:d,x:px,z:pz,y:s.a[1]+(s.b[1]-s.a[1])*t,a:s.a,b:s.b,id:s.id};}return best;}
}
class Polygons<T extends {points:Point[]}>{
 private cells=new Map<string,T[]>();
 constructor(items:T[],padding=8){for(const item of items){const b=bounds(item.points);for(let x=Math.floor((b.minX-padding)/64);x<=Math.floor((b.maxX+padding)/64);x++)for(let z=Math.floor((b.minZ-padding)/64);z<=Math.floor((b.maxZ+padding)/64);z++){const key=`${x},${z}`,list=this.cells.get(key)??[];list.push(item);this.cells.set(key,list);}}}
 at(x:number,z:number){return this.cells.get(`${Math.floor(x/64)},${Math.floor(z/64)}`)??[];}
}
export interface Pad{points:Point[];floor:number;feature:Feature}
export interface BuildingPart extends Pad {height:number;part:number}
function clip(ps:Point[],axis:0|2,edge:number,keepGreater:boolean):Point[]{const out:Point[]=[];for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],ia=keepGreater?a[axis]>=edge:a[axis]<=edge,ib=keepGreater?b[axis]>=edge:b[axis]<=edge;if(ia)out.push(a);if(ia!==ib){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,0,a[2]+(b[2]-a[2])*t]);}}return out;}
const area=(ps:Point[])=>Math.abs(ps.reduce((s,p,i)=>s+p[0]*ps[(i+1)%ps.length][2]-p[2]*ps[(i+1)%ps.length][0],0))/2;

export class Ground{
 readonly road:Lines;readonly streams:Lines;readonly coast:Lines;
 readonly parks:Pad[];readonly buildings:BuildingPart[]=[];
 private beaches:Polygons<Feature>;private woods:Polygons<Feature>;private parkIndex:Polygons<Pad>;private buildingIndex:Polygons<BuildingPart>;
 private allFeatures:Polygons<Feature>;
 private heights=new Map<string,number>();
 private landBoundary:Point[]=[];private shoreRows=new Map<number,number[]>();
 constructor(readonly world:World){
  // Join the cached OSM mainland coastline in its original direction. The open
  // clip is closed south of the cached area, outside every rendered point.
  const remaining=world.features.filter(f=>f.kind==='coast').map(f=>f.points.slice());
  const same=(a:Point,b:Point)=>a[0]===b[0]&&a[2]===b[2];
  const first=remaining.findIndex(a=>!remaining.some(b=>b!==a&&same(b.at(-1)!,a[0])));
  if(first>=0){this.landBoundary=remaining.splice(first,1)[0];let i=0;while((i=remaining.findIndex(p=>same(this.landBoundary.at(-1)!,p[0])))>=0)this.landBoundary.push(...remaining.splice(i,1)[0].slice(1));const a=this.landBoundary[0],b=this.landBoundary.at(-1)!,south=world.terrain.z+(world.terrain.nz-1)*world.terrain.step+1000;this.landBoundary.push([b[0],0,south],[a[0],0,south]);}
  this.allFeatures=new Polygons(world.features,14);
  this.road=new Lines(world.routes.map((points,i)=>({points,id:`route-${i}`})),90);
  this.streams=new Lines(world.features.filter(f=>f.kind==='stream'),12);
  this.coast=new Lines(world.features.filter(f=>f.kind==='coast'),400);
  this.beaches=new Polygons(world.features.filter(f=>f.kind==='beach'));
  this.woods=new Polygons(world.features.filter(f=>f.kind==='wood'));
  this.parks=world.features.filter(f=>f.kind==='parking').map(feature=>({feature,points:feature.points,floor:this.median(feature.points.map(p=>this.natural(p[0],p[2])))}));
  this.parkIndex=new Polygons(this.parks);
  for(const feature of world.features.filter(f=>f.kind==='building'))this.buildings.push(...this.splitBuilding(feature));
  this.buildingIndex=new Polygons(this.buildings,4);
 }
 private median(a:number[]){return a.sort((x,y)=>x-y)[Math.floor(a.length/2)]??0;}
 dem(x:number,z:number){const g=this.world.terrain,fi=clamp((x-g.x)/g.step,0,g.nx-1),fj=clamp((z-g.z)/g.step,0,g.nz-1),i=Math.floor(fi),j=Math.floor(fj),u=fi-i,v=fj-j;const h=(i:number,j:number)=>g.heights[Math.min(g.nz-1,j)*g.nx+Math.min(g.nx-1,i)];return(h(i,j)*(1-u)+h(i+1,j)*u)*(1-v)+(h(i,j+1)*(1-u)+h(i+1,j+1)*u)*v;}
 isLand(x:number,z:number){let xs=this.shoreRows.get(z);if(!xs){xs=[];for(let i=0,j=this.landBoundary.length-1;i<this.landBoundary.length;j=i++){const a=this.landBoundary[i],b=this.landBoundary[j];if((a[2]>z)!==(b[2]>z))xs.push((b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0]);}xs.sort((a,b)=>a-b);this.shoreRows.set(z,xs);}return xs.filter(v=>v>x).length%2===1;}
 natural(x:number,z:number){let h=this.isLand(x,z)?this.dem(x,z):-.25;const coast=this.coast.nearest(x,z);for(const beach of this.beaches.at(x,z))if(inside(x,z,beach.points))h=1.2+Math.min(2.4,coast.distance*.013);return h;}
 private grade(h:number,x:number,z:number){const r=this.road.nearest(x,z);if(r.distance<48){const t=smooth((r.distance-9)/39);return(r.y-.17)*(1-t)+h*t;}return h;}
 private beforeBuildings(x:number,z:number){let h=this.grade(this.natural(x,z),x,z);for(const park of this.parkIndex.at(x,z)){const d=nearest(park.points,x,z).distance;if(inside(x,z,park.points))h=park.floor;else if(d<5)h=park.floor*(1-smooth(d/5))+h*smooth(d/5);}const r=this.road.nearest(x,z);return r.distance<7?r.y-.17:h;}
 private splitBuilding(feature:Feature):BuildingPart[]{
  const ps=feature.points.slice();if(ps.length>1&&ps[0][0]===ps.at(-1)![0]&&ps[0][2]===ps.at(-1)![2])ps.pop();if(ps.length<3)return[];
  const hs=ps.map(p=>this.beforeBuildings(p[0],p[2]));const h=clamp(Number.parseFloat(feature.tags.height)||Number(feature.tags['building:levels'])*3||6,2.5,36);
  if(Math.max(...hs)-Math.min(...hs)<1.5)return[{feature,points:ps,floor:this.median(hs)+.18,height:h,part:0}];
  // Split only the height treatment into terrain-following terraces. XY footprint is the union of clipped original triangles.
  const triangles=ShapeUtils.triangulateShape(ps.map(p=>new Vector2(p[0],p[2])),[]),cells=new Map<string,{pieces:Point[][];samples:Point[]}>(),size=12;
  for(const ids of triangles){const tri=ids.map(i=>ps[i]),b=bounds(tri);for(let i=Math.floor(b.minX/size);i<=Math.floor(b.maxX/size);i++)for(let j=Math.floor(b.minZ/size);j<=Math.floor(b.maxZ/size);j++){let poly=clip(tri,0,i*size,true);poly=clip(poly,0,(i+1)*size,false);poly=clip(poly,2,j*size,true);poly=clip(poly,2,(j+1)*size,false);if(poly.length<3||area(poly)<.02)continue;const key=`${i},${j}`,cell=cells.get(key)??{pieces:[],samples:[]};cell.pieces.push(poly);cell.samples.push(...poly);cells.set(key,cell);}}
  const out:BuildingPart[]=[];let n=0;for(const cell of cells.values()){const floor=this.median(cell.samples.map(p=>this.beforeBuildings(p[0],p[2])))+.18;for(const points of cell.pieces)out.push({feature,points,floor,height:h,part:n++});}return out;
 }
 height(x:number,z:number){const key=`${x.toFixed(3)},${z.toFixed(3)}`,cached=this.heights.get(key);if(cached!==undefined)return cached;let h=this.beforeBuildings(x,z),built=false;
  for(const pad of this.buildingIndex.at(x,z)){const d=nearest([...pad.points,pad.points[0]],x,z).distance;if(inside(x,z,pad.points)){h=pad.floor-.18;built=true;break;}else if(d<2.5)h=(pad.floor-.18)*(1-smooth(d/2.5))+h*smooth(d/2.5);}
  const stream=this.streams.nearest(x,z),park=this.parkIndex.at(x,z).some(p=>inside(x,z,p.points));if(!built&&!park&&stream.distance<4.5){const bed=this.beforeBuildings(stream.x,stream.z)-.55,t=smooth((stream.distance-.65)/3.85);h=bed*(1-t)+h*t;}const r=this.road.nearest(x,z);if(r.distance<7)h=r.y-.17;
  if(this.heights.size<500000)this.heights.set(key,h);return h;
 }
 region(x:number,z:number){if(contains(DETAIL,x,z))return{...DETAIL,step:this.streams.nearest(x,z).distance<10?1:4};if(contains(CORRIDOR,x,z))return{...CORRIDOR,step:20};const g=this.world.terrain;return{minX:g.x,minZ:g.z,maxX:g.x+(g.nx-1)*g.step,maxZ:g.z+(g.nz-1)*g.step,step:50};}
 channel(x:number,z:number){return contains(DETAIL,x,z)&&this.streams.nearest(x,z).distance<4.5&&this.road.nearest(x,z).distance>9&&!this.parkIndex.at(x,z).some(p=>inside(x,z,p.points))&&!this.buildingIndex.at(x,z).some(p=>inside(x,z,p.points));}
 busPlacement(f:Feature){const p=f.points[0],r=this.road.nearest(p[0],p[2]),yaw=Number.isFinite(r.distance)?Math.atan2(r.b[0]-r.a[0],r.b[2]-r.a[2]):0;let x=p[0],z=p[2];if(r.distance<6){const dx=Math.cos(yaw),dz=-Math.sin(yaw),sign=(p[0]-r.x)*dx+(p[2]-r.z)*dz<0?-1:1;for(let offset=.1;offset<30;offset+=.1){x=p[0]+dx*sign*offset;z=p[2]+dz*sign*offset;if(this.road.nearest(x,z).distance>=6)break;}}return {sourceId:f.id,sourceRole:f.tags.public_transport??f.tags.highway,original:p,point:[x,this.renderedHeight(x,z),z] as Point,yaw,offset_m:Math.hypot(x-p[0],z-p[2]),center_road_distance_m:this.road.nearest(x,z).distance,estimated:true};}
 /** Match the submitted ground triangles, rather than floating water on an analytic curve. */
 renderedHeight(x:number,z:number){const r=this.region(x,z),x0=r.minX+Math.floor((x-r.minX)/r.step)*r.step,z0=r.minZ+Math.floor((z-r.minZ)/r.step)*r.step,u=(x-x0)/r.step,v=(z-z0)/r.step;const a=this.height(x0,z0),b=this.height(x0+r.step,z0),c=this.height(x0,z0+r.step),d=this.height(x0+r.step,z0+r.step);return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);}
 waterHeight(x:number,z:number){const h=this.renderedHeight(x,z)+.035,r=this.road.nearest(x,z);if(r.distance<8)return Math.min(h,r.y-.9);for(const p of this.parkIndex.at(x,z))if(inside(x,z,p.points))return p.floor-.5;return h;}
 color(x:number,z:number){if(this.beaches.at(x,z).some(f=>inside(x,z,f.points)))return'#d8c8a3';if(this.woods.at(x,z).some(f=>inside(x,z,f.points)))return'#809476';if(this.streams.nearest(x,z).distance<3.5)return'#8f9f86';return'#a7ad91';}
 nearbyFeatures(x:number,z:number){return this.allFeatures.at(x,z);}
}
