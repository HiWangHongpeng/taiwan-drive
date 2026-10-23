import * as T from 'three';
import {clamp,inside,nearest,treeAllowed,type World,type Point,type Car} from './core';
import {Ground,DETAIL,CORRIDOR,contains,bounds,densify,type Bounds} from './geography';
import {lamp,guardrailBeam} from './facilities';
import {Surfaces,qualityBudget,terrainTint,type Quality} from './surfaces';
import {makeVehicle} from './vehicle';
import {loadImportedVehicle} from './imported-vehicle';
import {RoadSurface,ribbonGeometry} from './road-surface';
import {groundVehicle,wheelContacts} from './vehicle-grounding';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

type Bucket={material:T.Material;positions:number[];normals:number[];colors:number[];uvs:number[];castShadow:boolean;receiveShadow:boolean};
export class View {
 readonly scene=new T.Scene();readonly camera=new T.PerspectiveCamera(65,1,.1,5500);
 readonly renderer=new T.WebGLRenderer({antialias:true});readonly vehicle:T.Group;
 readonly surfaces:Surfaces;readonly sun=new T.DirectionalLight(0xffebcf,2.6);
 private quality:Quality;private shadowCell='';private shadowUpdates=0;private waterTime=0;
 private readonly motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
 private canopyMeshes:T.InstancedMesh[]=[];
 readonly ground:Ground;cockpit=false;readonly stopPlacements:ReturnType<Ground['busPlacement']>[]=[];
 private materials=new Map<string,T.MeshStandardMaterial>();private wheels:T.Object3D[]=[];
 private frontWheels:T.Object3D[]=[];private cullable:T.Mesh[]=[];
 private original:ReturnType<typeof makeVehicle>;private imported?:Awaited<ReturnType<typeof loadImportedVehicle>>;private concept=true;
 private tyreShadows:T.Mesh[]=[];
 private cameraMode='';
 readonly roadSurface=new RoadSurface();
 private constructionMs=0;private renderTimes:number[]=[];private submittedInstances=0;
 private frameDiagnostics:{x:number;z:number;dt:number;lod_ms:number;render_ms:number;total_ms:number;shadow_update:boolean;calls:number;triangles:number}[]=[];
 readonly diagnostics={trees:0,shrubs:0,treeGroups:0,buildingParts:0,buildings:0,parkingLots:0,paths:0,steps:0,busStops:0,shelters:0,lamps:0,roadTerrainClearanceMin:Infinity,waterTerrainGapMax:0,buildingFootingMax:0,terrainTriangles:0};
 constructor(container:HTMLElement,readonly world:World,quality:Quality='standard'){
  const start=performance.now();this.ground=new Ground(world);this.quality=quality;this.surfaces=new Surfaces(this.renderer);
  this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
  this.scene.background=this.surfaces.sky;
  const environment=new T.PMREMGenerator(this.renderer);this.surfaces.environment=environment.fromEquirectangular(this.surfaces.sky).texture;environment.dispose();this.scene.environmentIntensity=.48;
  this.renderer.setClearColor('#c9dade');this.scene.fog=new T.Fog('#c9dade',450,2200);container.append(this.renderer.domElement);
  this.scene.add(new T.HemisphereLight(0xdceafa,0x6e725b,1.1));this.sun.position.set(-110,180,-100);this.scene.add(this.sun,this.sun.target);
  this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=450;this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.18;
  this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;
  const sea=new T.Mesh(new T.PlaneGeometry(26000,26000),this.surfaces.sea());sea.rotation.x=-Math.PI/2;sea.position.y=.15;sea.userData.unbatched=true;this.scene.add(sea);
  this.terrain();this.roads();this.parking();this.buildings();this.pathsAndStreams();this.stops();this.vegetation();this.roadside();
  this.batchSpatially();this.original=makeVehicle(this.surfaces.contact,this.surfaces.environment);this.vehicle=new T.Group();this.vehicle.add(this.original.group);this.wheels=this.original.wheels;this.frontWheels=this.original.frontWheels;this.scene.add(this.vehicle);for(let i=0;i<4;i++){const shadow=new T.Mesh(new T.PlaneGeometry(.48,.8),new T.MeshBasicMaterial({map:this.surfaces.contact,transparent:true,depthWrite:false,opacity:.85,polygonOffset:true,polygonOffsetFactor:-1}));shadow.rotation.x=-Math.PI/2;this.vehicle.add(shadow);this.tyreShadows.push(shadow);}this.setQuality(quality);this.constructionMs=performance.now()-start;
  addEventListener('resize',()=>this.resize());this.resize();
 }
 private mat(color:string,vertexColors=false){const key=color+vertexColors;let material=this.materials.get(key);if(!material){material=this.surfaces.material(color,vertexColors);this.materials.set(key,material);}return material;}
 private box(w:number,h:number,d:number,color:string,x:number,y:number,z:number,parent:T.Object3D=this.scene){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),this.mat(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 private mesh(positions:number[],indices:number[],color:string){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const mesh=new T.Mesh(g,this.mat(color));mesh.receiveShadow=true;this.scene.add(mesh);return mesh;}
 private ribbon(ps:Point[],halfWidth:number,color:string,offset=0,side=0){if(ps.length<2)return;const {positions,indices}=ribbonGeometry(ps,halfWidth,offset,side);this.mesh(positions,indices,color);if(color==='#65706e')this.roadSurface.add(positions,indices);}
 private terrain(){
  const g=this.world.terrain,far={minX:g.x,maxX:g.x+(g.nx-1)*g.step,minZ:g.z,maxZ:g.z+(g.nz-1)*g.step};
  const patch=(b:Bounds,step:number,hole?:Bounds)=>{const nx=Math.round((b.maxX-b.minX)/step),nz=Math.round((b.maxZ-b.minZ)/step),pos:number[]=[],colors:number[]=[],idx:number[]=[];
   for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=b.minX+i*step,z=b.minZ+j*step;pos.push(x,this.ground.height(x,z),z);const c=new T.Color(this.ground.color(x,z)).multiplyScalar(.94+.06*Math.sin(x*.047)*Math.cos(z*.061));colors.push(c.r,c.g,c.b);}
   for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=b.minX+(i+.5)*step,z=b.minZ+(j+.5)*step;if(hole&&contains(hole,x,z))continue;if(step===4&&this.ground.streams.nearest(x,z).distance<12){const base=pos.length/3;for(let v=0;v<=4;v++)for(let u=0;u<=4;u++){const xx=b.minX+i*step+u,zz=b.minZ+j*step+v;pos.push(xx,this.ground.height(xx,zz),zz);const c=new T.Color(this.ground.color(xx,zz));colors.push(c.r,c.g,c.b);}for(let v=0;v<4;v++)for(let u=0;u<4;u++){const a=base+v*5+u;idx.push(a,a+5,a+1,a+1,a+5,a+6);}continue;}const a=j*(nx+1)+i;idx.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(idx);geo.computeVertexNormals();const normals=geo.getAttribute('normal'),cp=geo.getAttribute('color'),pp=geo.getAttribute('position');for(let i=0;i<pp.count;i++){const c=terrainTint(pp.getX(i),pp.getZ(i),normals.getY(i),new T.Color().fromBufferAttribute(cp,i));cp.setXYZ(i,c.r,c.g,c.b);}this.diagnostics.terrainTriangles+=idx.length/3;const mesh=new T.Mesh(geo,this.mat('#ffffff',true));mesh.receiveShadow=true;this.scene.add(mesh);
  };
  patch(far,50,CORRIDOR);patch(CORRIDOR,20,DETAIL);patch(DETAIL,4);
  // Vertical skirts close only resolution boundaries; the terrain height is shared on both sides.
  for(const b of [CORRIDOR,DETAIL]){const loop:Point[]=[[b.minX,0,b.minZ],[b.maxX,0,b.minZ],[b.maxX,0,b.maxZ],[b.minX,0,b.maxZ],[b.minX,0,b.minZ]];const ps=densify(loop,4),p:number[]=[],idx:number[]=[];ps.forEach((q,i)=>{const h=this.ground.height(q[0],q[2]);p.push(q[0],h-.03,q[2],q[0],h-3,q[2]);if(i<ps.length-1){const n=i*2;idx.push(n,n+1,n+2,n+1,n+3,n+2);}});this.mesh(p,idx,'#a7ad91');}
 }
 private roads(){
  // Show genuine mapped continuation beyond playable endpoints. Do not duplicate the playable road mesh.
  for(const f of this.world.features.filter(f=>f.kind==='road')){let run:Point[]=[];const ends=this.world.routes.flatMap(r=>[r[0],r.at(-1)!]);const flush=()=>{this.ribbon(run,4.05,'#65706e');this.ribbon(run,.065,'#e3ddbf',.02,3.4);this.ribbon(run,.065,'#e3ddbf',.02,-3.4);run=[];};for(const p of densify(f.points,2)){const n=this.ground.road.nearest(p[0],p[2]),nearEnd=ends.some(e=>Math.hypot(e[0]-p[0],e[2]-p[2])<20);if(n.distance<1&&!nearEnd){flush();continue;}run.push([p[0],(n.distance<9?n.y:this.ground.renderedHeight(p[0],p[2])+.17)+.045,p[2]]);}flush();}
  for(const r of this.world.routes){this.ribbon(r,4.02,'#bdbca4',.025);this.ribbon(r,3.8,'#65706e',.055);this.ribbon(r,.16,'#71786c',.057,3.62);this.ribbon(r,.16,'#71786c',.057,-3.62);this.ribbon(r,.065,'#e3ddbf',.075,3.4);this.ribbon(r,.065,'#e3ddbf',.075,-3.4);for(let i=0;i<r.length-2;i+=5)this.ribbon(r.slice(i,i+2),.065,'#e0ddc7',.08);for(let i=0;i<r.length;i+=8){const p=r[i];this.diagnostics.roadTerrainClearanceMin=Math.min(this.diagnostics.roadTerrainClearanceMin,p[1]+.055-this.ground.renderedHeight(p[0],p[2]));}}
  // Mapped service/residential roads are scenery only, not additional driveable routes.
  for(const f of this.world.features.filter(f=>f.kind==='access')){const b=bounds(f.points);if(b.maxX<DETAIL.minX-100||b.minX>DETAIL.maxX+200||b.maxZ<DETAIL.minZ-100||b.minZ>DETAIL.maxZ+100)continue;const ps=densify(f.points,2).map(p=>[p[0],this.ground.renderedHeight(p[0],p[2])+.04,p[2]] as Point);this.ribbon(ps,f.tags.service==='parking_aisle'?1.5:2.5,'#8b9288');}
 }
 private polygon(ps:Point[],y:number,color:string){const points=ps.slice();if(points.length>1&&points[0][0]===points.at(-1)![0]&&points[0][2]===points.at(-1)![2])points.pop();const indices=T.ShapeUtils.triangulateShape(points.map(p=>new T.Vector2(p[0],p[2])),[]).flat(),vertices=points.flatMap(p=>[p[0],y,p[2]]);this.mesh(vertices,indices,color);}
 private parking(){for(const p of this.ground.parks){this.diagnostics.parkingLots++;this.polygon(p.points,p.floor+.03,'#929a8e');const b=bounds(p.points);for(let x=b.minX+2;x<b.maxX-2;x+=2.6)for(let z=b.minZ+2;z<b.maxZ-5;z+=11){if(!inside(x,z,p.points)||!inside(x,z+4.7,p.points)||this.ground.road.nearest(x,z).distance<11)continue;this.ribbon([[x,p.floor+.055,z],[x,p.floor+.055,z+4.7]],.035,'#dad9bd');}const closed=p.points[0][0]===p.points.at(-1)![0]?p.points:[...p.points,p.points[0]];this.ribbon(closed.map(q=>[q[0],p.floor+.09,q[2]]),.10,'#c4c5ad');}}
 private buildings(){const unique=new Set<string>();for(const part of this.ground.buildings){unique.add(part.feature.id);this.diagnostics.buildingParts++;const shape=new T.Shape(part.points.map(p=>new T.Vector2(p[0],-p[2]))),support=Math.min(part.floor-.55,...densify([...part.points,part.points[0]],2).map(p=>this.ground.renderedHeight(p[0],p[2])-.15));const mesh=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:part.floor+part.height-support,bevelEnabled:false}),this.mat('#d1c9b3'));mesh.rotation.x=-Math.PI/2;mesh.position.y=support;mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);this.polygon(part.points,part.floor+part.height+.025,'#a6aa96');if(contains(DETAIL,part.points[0][0],part.points[0][2]))this.ribbon([...part.points,part.points[0]].map(p=>[p[0],part.floor+part.height+.15,p[2]] as Point),.13,'#b6b49c');for(const p of part.points){const gap=support-this.ground.renderedHeight(p[0],p[2]);this.diagnostics.buildingFootingMax=Math.max(this.diagnostics.buildingFootingMax,gap);}}
  this.diagnostics.buildings=unique.size;
  // Original facade details on original OSM outer edges. Heights and window placement remain estimates.
  for(const f of this.world.features.filter(f=>f.kind==='building')){for(let i=0;i<f.points.length-1;i++){const a=f.points[i],b=f.points[i+1],length=Math.hypot(b[0]-a[0],b[2]-a[2]);if(length>150)continue;const yaw=Math.atan2(b[0]-a[0],b[2]-a[2]);for(let d=1.6;d<length-1;d+=3.4){const x=a[0]+(b[0]-a[0])*d/length,z=a[2]+(b[2]-a[2])*d/length,parts=this.ground.buildings.filter(p=>p.feature.id===f.id),part=parts.find(p=>inside(x,z,p.points))??parts.find(p=>nearest([...p.points,p.points[0]],x,z).distance<.2);if(!part)continue;for(let h=1.7;h<part.height-.5;h+=2.8){const win=this.box(1.15,.85,.065,'#859c99',x,part.floor+h,z);win.rotation.y=yaw+Math.PI/2;if(contains(DETAIL,x,z)){const sill=this.box(1.3,.09,.18,'#b6b49c',x,part.floor+h-.45,z);sill.rotation.y=yaw+Math.PI/2;const frame=this.box(.055,.86,.09,'#b5bfb0',x,part.floor+h,z);frame.rotation.y=yaw+Math.PI/2;}}}}}
 }
 private pathsAndStreams(){
  for(const f of this.world.features){if(f.kind==='path'){this.diagnostics.paths++;const ps=densify(f.points,f.tags.highway==='steps'?.7:1.5).map(p=>[p[0],this.ground.renderedHeight(p[0],p[2])+.055,p[2]] as Point);if(f.tags.highway==='steps'){this.diagnostics.steps++;for(let i=0;i<ps.length-1;i++){const a=ps[i],b=ps[i+1],l=Math.hypot(b[0]-a[0],b[2]-a[2]);const step=this.box(1.45,.12,l+.04,'#b6b49c',(a[0]+b[0])/2,Math.max(a[1],b[1])+.04,(a[2]+b[2])/2);step.rotation.y=Math.atan2(b[0]-a[0],b[2]-a[2]);}}else this.ribbon(ps,.8,'#c2bca2');}
   if(f.kind==='stream'){const ps=densify(f.points,1),water=ps.map(p=>[p[0],this.ground.waterHeight(p[0],p[2]),p[2]] as Point);this.ribbon(water,.48,'#819b97');for(let i=0;i<ps.length;i+=5){const p=ps[i],r=this.ground.road.nearest(p[0],p[2]);if(r.distance>9)this.diagnostics.waterTerrainGapMax=Math.max(this.diagnostics.waterTerrainGapMax,water[i][1]-this.ground.renderedHeight(p[0],p[2]));}}
  }
 }
 private stops(){for(const f of this.world.features.filter(f=>f.kind==='bus')){this.diagnostics.busStops++;const placement=this.ground.busPlacement(f);this.stopPlacements.push(placement);const p=placement.point;const group=new T.Group();group.position.set(p[0],p[1],p[2]);group.rotation.y=placement.yaw+Math.PI/2;this.scene.add(group);this.box(.1,2.7,.1,'#b5bfb0',0,1.35,0,group);this.box(.7,.7,.1,'#42847b',0,2.5,0,group);if(f.tags.shelter==='yes'){this.diagnostics.shelters++;this.box(4.4,.16,2,'#607e70',0,2.65,0,group);for(const x of [-1.9,1.9])this.box(.1,2.6,.1,'#7b8e80',x,1.3,0,group);this.box(3.2,.15,.6,'#adb299',0,.6,.3,group);for(const x of [-1.3,1.3])this.box(.1,.55,.45,'#7b8e80',x,.28,.3,group);this.box(3.9,1.15,.055,'#859c99',0,1.65,.82,group);this.box(4.35,.09,.09,'#b5bfb0',0,2.45,.82,group);for(const x of [-1.9,1.9])this.box(.09,1.5,.09,'#b5bfb0',x,1.7,.82,group);}}}
 private vegetation(){const trees:Point[]=[],shrubs:Point[]=[],seen=new Set<string>();
  const woods=this.world.features.filter(f=>f.kind==='wood');const jitter=(x:number,z:number)=>{const n=Math.sin(x*12.9898+z*78.233)*43758.5453;return n-Math.floor(n);};
  for(const detailed of [true,false])for(const f of woods){const b=bounds(f.points),step=detailed?11:25,minX=Math.max(b.minX,detailed?DETAIL.minX:this.world.terrain.x),maxX=Math.min(b.maxX,detailed?DETAIL.maxX:6650),minZ=Math.max(b.minZ,detailed?DETAIL.minZ:-3400),maxZ=Math.min(b.maxZ,detailed?DETAIL.maxZ:2300);
   for(let x=Math.floor(minX/step)*step;x<maxX;x+=step)for(let z=Math.floor(minZ/step)*step;z<maxZ;z+=step){if(!detailed&&contains(DETAIL,x,z))continue;const key=`${detailed}:${x},${z}`;if(seen.has(key))continue;seen.add(key);const xx=x+(jitter(x,z)-.5)*step*.85,zz=z+(jitter(z,x+11)-.5)*step*.85;if(this.ground.road.nearest(xx,zz).distance<12||!treeAllowed(xx,zz,this.ground.nearbyFeatures(xx,zz),[]))continue;if(trees.length<11000)trees.push([xx,this.ground.renderedHeight(xx,zz),zz]);if(detailed&&jitter(xx,zz)>.45&&shrubs.length<2000&&this.ground.road.nearest(xx+1.5,zz-1).distance>=12&&treeAllowed(xx+1.5,zz-1,this.ground.nearbyFeatures(xx+1.5,zz-1),[]))shrubs.push([xx+1.5,this.ground.renderedHeight(xx+1.5,zz-1),zz-1]);}
  }
  // One stable canopy representation at every distance: no moving LOD replacement or buffer rebuild.
  const cards=[0,Math.PI/3,Math.PI*2/3].map(a=>new T.PlaneGeometry(2,2.2).rotateY(a));for(const a of [-.7,.7])cards.push(new T.PlaneGeometry(1.5,1.65).rotateX(a));
  const canopy=mergeGeometries(cards)!;for(const g of cards)g.dispose();const cp=canopy.getAttribute('position'),cn=canopy.getAttribute('normal');for(let i=0;i<cp.count;i++){const n=new T.Vector3(cp.getX(i),cp.getY(i)*.6+.4,cp.getZ(i)).normalize();cn.setXYZ(i,n.x,n.y,n.z);}
  const leaves=new T.MeshStandardMaterial({color:'#e7edda',map:this.surfaces.foliage,emissive:'#1e2818',emissiveIntensity:.4,roughness:.94,alphaTest:.45,alphaToCoverage:true,side:T.DoubleSide});
  const instance=(ps:Point[],small:boolean)=>{const chunks=new Map<string,Point[]>();for(const p of ps){const key=`${Math.floor(p[0]/512)},${Math.floor(p[2]/512)}`,points=chunks.get(key)??[];points.push(p);chunks.set(key,points);}for(const points of chunks.values()){
   const crowns=new T.InstancedMesh(canopy,leaves,points.length),trunks=small?null:new T.InstancedMesh(new T.CylinderGeometry(.13,.24,3.8,6),this.mat('#786c58'),points.length),o=new T.Object3D();
   points.forEach((p,i)=>{const v=jitter(p[0],p[2]),s=small?.8+v*.6:2.7+v*2.1;o.position.set(p[0],p[1]+(small?.65:s*.8+2),p[2]);o.rotation.y=v*Math.PI*2;o.scale.set(s,small?.6+v*.4:s*.8,s);o.updateMatrix();crowns.setMatrixAt(i,o.matrix);crowns.setColorAt(i,new T.Color().setHSL(.24+v*.06,.13,.68+v*.2));
    if(trunks){o.position.set(p[0],p[1]+1.9,p[2]);o.scale.set(1,1,1);o.updateMatrix();trunks.setMatrixAt(i,o.matrix);}
   });
   if(!small)this.canopyMeshes.push(crowns);
   for(const m of [crowns,trunks])if(m){m.computeBoundingSphere();m.castShadow=true;m.receiveShadow=true;m.onBeforeRender=()=>{this.submittedInstances+=m.count;};this.scene.add(m);this.cullable.push(m);}this.diagnostics.treeGroups++;
  }};
  instance(trees,false);instance(shrubs,true);this.diagnostics.trees=trees.length;this.diagnostics.shrubs=shrubs.length;
 }
 private roadside(){const r=this.world.routes[0],poles:{x:number;y:number;z:number;yaw:number}[]=[];
  for(let i=0;i<r.length-1;i+=12){const p=r[i],q=r[Math.min(i+3,r.length-1)],yaw=Math.atan2(q[0]-p[0],q[2]-p[2]),x=p[0]+Math.cos(yaw)*5.5,z=p[2]-Math.sin(yaw)*5.5,y=this.ground.renderedHeight(x,z);const l=lamp(this.mat('#7e8e81'));l.position.set(x,y,z);l.rotation.y=yaw;this.scene.add(l);this.diagnostics.lamps++;}
  for(let i=6;i<r.length-1;i+=22){const p=r[i],q=r[Math.min(i+2,r.length-1)],yaw=Math.atan2(q[0]-p[0],q[2]-p[2]),x=p[0]+Math.cos(yaw)*7,z=p[2]-Math.sin(yaw)*7,y=this.ground.renderedHeight(x,z);const group=new T.Group();group.position.set(x,y,z);group.rotation.y=yaw;this.scene.add(group);this.box(.22,8,.22,'#a19b85',0,4,0,group);this.box(3,.13,.13,'#818a77',0,7.6,0,group);poles.push({x,y,z,yaw});}
  for(let i=0;i<poles.length-1;i++)for(const k of [-1.2,1.2]){const a=poles[i],b=poles[i+1],p1=new T.Vector3(a.x+Math.cos(a.yaw)*k,a.y+7.6,a.z-Math.sin(a.yaw)*k),p2=new T.Vector3(b.x+Math.cos(b.yaw)*k,b.y+7.6,b.z-Math.sin(b.yaw)*k),mid=p1.clone().lerp(p2,.5);mid.y-=.65;const curve=new T.QuadraticBezierCurve3(p1,mid,p2),geo=new T.BufferGeometry().setFromPoints(curve.getPoints(8));this.scene.add(new T.Line(geo,new T.LineBasicMaterial({color:'#6d7b70'})));}
  for(const route of this.world.routes){const ps=densify(route,5),normals=ps.map((p,i)=>{const a=ps[Math.max(0,i-1)],b=ps[Math.min(ps.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[2]-a[2])||1;return[(b[2]-a[2])/l,-(b[0]-a[0])/l]as[number,number];}),edge=ps.map((p,i)=>{const x=p[0]+normals[i][0]*5,z=p[2]+normals[i][1]*5;return[x,this.ground.renderedHeight(x,z),z]as Point;});
   for(let i=0;i<edge.length-1;i++){const a=edge[i],b=edge[i+1],x=a[0],z=a[2],sy=a[1];
    const gap=this.ground.nearbyFeatures(x,z).some(f=>(['path','access'].includes(f.kind)&&nearest(f.points,x,z).distance<4)||f.kind==='parking'&&inside(x,z,f.points)||f.kind==='bus'&&Math.hypot(x-f.points[0][0],z-f.points[0][2])<8);if(gap)continue;
    const post=this.box(.09,.85,.12,'#8b9a89',x,sy+.425,z);post.rotation.y=Math.atan2(normals[i][0],normals[i][1]);
    const rail=new T.Mesh(guardrailBeam(a,b,normals[i],normals[i+1]),this.mat('#bac3ad'));rail.castShadow=rail.receiveShadow=true;this.scene.add(rail);
    if(i%4===0){const foot=this.box(.23,.035,.26,'#98a18b',x,sy+.018,z);foot.rotation.y=post.rotation.y;const reflector=this.box(.12,.075,.04,'#e3ddbf',x+normals[i][0]*.07,sy+.78,z+normals[i][1]*.07);reflector.rotation.y=post.rotation.y;}
   }
  }
  for(const [i,route] of this.world.routes.entries())for(const index of [10,Math.max(11,route.length-25)]){const p=route[index],q=route[index+1],yaw=Math.atan2(q[0]-p[0],q[2]-p[2]),x=p[0]+Math.cos(yaw)*5.6,z=p[2]-Math.sin(yaw)*5.6,y=this.ground.renderedHeight(x,z);const group=new T.Group();group.position.set(x,y,z);group.rotation.y=yaw;this.scene.add(group);this.box(.12,3,.12,'#98a18b',0,1.5,0,group);this.box(3.2,1.15,.12,'#417868',0,3,0,group);const canvas=document.createElement('canvas');canvas.width=768;canvas.height=288;const c=canvas.getContext('2d')!;c.fillStyle='#417868';c.fillRect(0,0,768,288);c.strokeStyle='#e8edda';c.lineWidth=5;c.strokeRect(8,8,752,272);c.fillStyle='#e8edda';c.font='bold 75px sans-serif';c.fillText('台 2',32,95);c.font='bold 86px sans-serif';c.fillText(i?'白沙灣  ←':'石門洞  →',32,215);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const face=new T.Mesh(new T.PlaneGeometry(3.08,1.05),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));face.position.set(0,3,-.066);face.rotation.y=Math.PI;group.add(face);}
 }
 private batchSpatially(){const buckets=new Map<string,Bucket>(),remove:T.Mesh[]=[];this.scene.updateMatrixWorld(true);
  this.scene.traverse(o=>{if(!(o instanceof T.Mesh)||o instanceof T.InstancedMesh||!(o.material instanceof T.MeshStandardMaterial)||o.material.transparent||o.userData.unbatched)return;
   const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);const p=geo.getAttribute('position'),n=geo.getAttribute('normal'),c=geo.getAttribute('color'),scale=Number(o.material.userData.uvScale)||5;
   for(let i=0;i<p.count;i+=3){const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3,key=`${o.material.uuid}:${!!c}:${o.castShadow}:${o.receiveShadow}:${Math.floor(x/512)},${Math.floor(z/512)}`;const b=buckets.get(key)??{material:o.material,positions:[],normals:[],colors:[],uvs:[],castShadow:o.castShadow,receiveShadow:o.receiveShadow};
    for(let j=i;j<i+3;j++){const xx=p.getX(j),yy=p.getY(j),zz=p.getZ(j);b.positions.push(xx,yy,zz);b.normals.push(n.getX(j),n.getY(j),n.getZ(j));if(c)b.colors.push(c.getX(j),c.getY(j),c.getZ(j));
     // World-space box projection keeps asphalt grain continuous across route segments/chunks.
     if(Math.abs(n.getY(j))>.7)b.uvs.push(xx/scale,zz/scale);else if(Math.abs(n.getX(j))>.7)b.uvs.push(zz/scale,yy/scale);else b.uvs.push(xx/scale,yy/scale);
    }buckets.set(key,b);
   }geo.dispose();remove.push(o);
  });remove.forEach(o=>{o.removeFromParent();o.geometry.dispose();});for(const b of buckets.values()){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.uvs,2));if(b.colors.length)g.setAttribute('color',new T.Float32BufferAttribute(b.colors,3));g.computeBoundingSphere();const m=new T.Mesh(g,b.material);m.castShadow=b.castShadow;m.receiveShadow=b.receiveShadow;this.scene.add(m);this.cullable.push(m);}
 }
 setQuality(quality:Quality){
  this.quality=quality;this.surfaces.setQuality(quality);const budget=qualityBudget(quality);
  this.renderer.shadowMap.type=quality==='high'?T.PCFSoftShadowMap:T.VSMShadowMap;this.sun.shadow.blurSamples=4;this.sun.shadow.radius=2;this.renderer.setPixelRatio(Math.min(devicePixelRatio,budget.pixelRatio));
  // Shadow sampler defines are compiled into every receiving shader, including unmapped materials.
  this.scene.traverse(o=>{if(o instanceof T.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material])material.needsUpdate=true;});
  this.renderer.shadowMap.enabled=budget.shadowSize>0;this.sun.castShadow=budget.shadowSize>0;
  if(this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}if(this.sun.shadow.mapPass){this.sun.shadow.mapPass.dispose();this.sun.shadow.mapPass=null;}
  this.sun.shadow.mapSize.set(budget.shadowSize||512,budget.shadowSize||512);
  const camera=this.sun.shadow.camera;camera.left=camera.bottom=-100;camera.right=camera.top=100;camera.updateProjectionMatrix();
  this.vehicle.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=quality==='high'&&!o.material.transparent;});
  this.imported?.setQuality(quality);
  this.shadowCell='';this.resize();
 }
 async loadVehicle(){this.imported=await loadImportedVehicle(`${import.meta.env.BASE_URL}models/carconcept.glb?v=2`,this.surfaces.contact,this.surfaces.environment);this.vehicle.add(this.imported.group);this.imported.setQuality(this.quality);this.selectVehicle(true);}
 selectVehicle(concept:boolean){this.concept=concept;const imported=concept&&this.imported;this.original.group.visible=!imported;if(this.imported)this.imported.group.visible=Boolean(imported);this.wheels=imported?imported.wheels:this.original.wheels;this.frontWheels=imported?imported.frontWheels:this.original.frontWheels;this.shadowCell='';}
 vehicleSnapshot(){const imported=this.imported,active=Boolean(imported&&this.concept);return{loaded:Boolean(imported),active,contacts:wheelContacts(this.vehicle,this.wheels.map(w=>w.parent!),active?imported!.wheelRadius:.34,(x,z)=>this.roadSurface.height(x,z)??this.ground.renderedHeight(x,z)),triangles:imported?.triangles,meshes:imported?.meshes,cockpitCameraError:active&&this.cockpit?this.camera.position.distanceTo(this.vehicle.localToWorld(imported!.eye.clone())):undefined,dashboard:imported?.dashboard(),wheelRadius:imported?.wheelRadius,frontWheels:this.frontWheels.map(w=>({position:w.position.toArray(),angle:w.rotation.y})),wheelSpin:this.wheels.map(w=>w.rotation.x),steeringAngle:active?imported!.steering.quaternion.angleTo(new T.Quaternion()):0,steeringCenter:active?imported!.steering.getWorldPosition(new T.Vector3()).project(this.camera).toArray():undefined,steeringMarker:active?imported!.marker.getWorldPosition(new T.Vector3()).project(this.camera).toArray():undefined};}
 performanceSnapshot(){let meshes=0,instances=0,instanceGroups=0;this.scene.traverse(o=>{if(o instanceof T.Mesh)meshes++;if(o instanceof T.InstancedMesh){instances+=o.count;instanceGroups++;}});return{constructionMs:this.constructionMs,renderTimes:this.renderTimes,frameDiagnostics:this.frameDiagnostics,info:{render:{...this.renderer.info.render},memory:{...this.renderer.info.memory}},instances,instanceGroups,submittedInstances:this.submittedInstances,meshes,vehicle:this.vehicleSnapshot(),terrainMesh:{detailStep_m:4,channelStep_m:1,adaptive:false},diagnostics:this.diagnostics,graphics:{quality:this.quality,budget:qualityBudget(this.quality),shadowUpdates:this.shadowUpdates,treeRepresentation:'stable-instanced-cluster-cards',canopyInstances:this.canopyMeshes.reduce((n,c)=>n+c.count,0),pixelRatio:this.renderer.getPixelRatio(),textureSource:'original deterministic Canvas rasters'}};}
 screenPoint(p:Point){return new T.Vector3(p[0],p[1],p[2]).project(this.camera).toArray();}
 private resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
 render(car:Car,dt:number,steer=0,driving=true){const start=performance.now();
  const shadowBefore=this.shadowUpdates;const lodMs=performance.now()-start;if(!this.motionQuery.matches)this.waterTime+=dt;this.surfaces.waterNormal.offset.set(this.waterTime*.005,this.waterTime*.002);
  const cell=`${Math.floor(car.x/16)},${Math.floor(car.z/16)}`;
  if(this.renderer.shadowMap.enabled&&(cell!==this.shadowCell||this.quality==='high')){const x=Math.floor(car.x/16)*16,z=Math.floor(car.z/16)*16;this.sun.position.set(x-110,car.y+180,z-100);this.sun.target.position.set(x,car.y,z);this.renderer.shadowMap.needsUpdate=true;this.shadowCell=cell;this.shadowUpdates++;}
  const imported=this.concept&&this.imported,pivots=this.wheels.map(w=>w.parent!),radius=imported?imported.wheelRadius:.34;
  groundVehicle(this.vehicle,pivots,radius,car.x,car.z,car.yaw,(x,z)=>this.roadSurface.height(x,z)??this.ground.renderedHeight(x,z));
  this.vehicle.visible=!this.cockpit||Boolean(imported);if(imported){imported.steering.quaternion.setFromAxisAngle(imported.steeringAxis,steer*2.4);imported.updateDashboard(car.speed,dt);}
  for(let i=0;i<pivots.length;i++){const p=pivots[i];this.tyreShadows[i].position.set(p.position.x,p.position.y-radius+.004,p.position.z);}
  document.body.classList.toggle('detailed-cockpit',this.cockpit&&Boolean(imported));const fov=this.cockpit&&imported?75:65;if(this.camera.fov!==fov){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
  this.frontWheels.forEach(w=>{w.rotation.y=steer*.35;});this.wheels.forEach(w=>{if(driving)w.rotation.x+=car.speed*dt/(imported?imported.wheelRadius:.34);});this.vehicle.updateMatrixWorld(true);
  const heading=car.yaw,target=this.cockpit?(imported?this.vehicle.localToWorld(imported.eye.clone()):new T.Vector3(car.x,car.y+1.42,car.z)):new T.Vector3(car.x-Math.sin(heading)*8.5,car.y+4.2,car.z-Math.cos(heading)*8.5),cameraMode=this.cockpit?(imported?'imported':'original'):'chase';if(this.cockpit||this.cameraMode!==cameraMode||this.camera.position.distanceTo(target)>80){this.camera.position.copy(target);this.cameraMode=cameraMode;}else this.camera.position.lerp(target,this.motionQuery.matches?1:1-Math.exp(-6*dt));
  if(this.cockpit&&imported)this.camera.lookAt(this.vehicle.localToWorld(imported.lookAt.clone()));else this.camera.lookAt(car.x+Math.sin(heading)*(this.cockpit?30:8),car.y+(this.cockpit?1.3:.95),car.z+Math.cos(heading)*(this.cockpit?30:8));
  for(const m of this.cullable){const sphere=m instanceof T.InstancedMesh?m.boundingSphere:m.geometry.boundingSphere;if(sphere)m.visible=this.camera.position.distanceTo(sphere.center)<=2200+sphere.radius;}
  this.submittedInstances=0;const renderStart=performance.now();this.renderer.render(this.scene,this.camera);if(import.meta.env.DEV){const end=performance.now();this.renderTimes.push(end-start);this.frameDiagnostics.push({x:car.x,z:car.z,dt,lod_ms:lodMs,render_ms:end-renderStart,total_ms:end-start,shadow_update:this.shadowUpdates!==shadowBefore,calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles});}
 }
}
