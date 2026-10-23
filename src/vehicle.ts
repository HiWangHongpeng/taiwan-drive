import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Original compact saloon, +Z forward. Dimensions are modelling estimates. */
export function makeVehicle(contact:T.Texture,environment:T.Texture|null=null){
 const group=new T.Group(),wheels:T.Group[]=[],frontWheels:T.Group[]=[];
 const paint=new T.MeshPhysicalMaterial({color:'#bda47f',roughness:.32,metalness:.5,clearcoat:.8,clearcoatRoughness:.22});
 const glass=new T.MeshPhysicalMaterial({color:'#344b56',roughness:.16,metalness:.28,clearcoat:1});
 const rubber=new T.MeshStandardMaterial({color:'#242a2b',roughness:.94});
 const trim=new T.MeshStandardMaterial({color:'#343b3b',roughness:.5,metalness:.2});
 const metal=new T.MeshStandardMaterial({color:'#9ea5a2',roughness:.32,metalness:.8});
 const lamp=new T.MeshStandardMaterial({color:'#e2e5cf',roughness:.2,metalness:.2});
 const tail=new T.MeshStandardMaterial({color:'#9b352b',roughness:.25,emissive:'#51150d',emissiveIntensity:.2});
 for(const material of [paint,glass,metal]){material.envMap=environment;material.envMapIntensity=.65;}
 const plate=new T.MeshStandardMaterial({color:'#e5e3d7',roughness:.8});
 const add=(geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0,parent:T.Object3D=group)=>{const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 const box=(w:number,h:number,d:number,material:T.Material,x:number,y:number,z:number,parent:T.Object3D=group)=>add(new T.BoxGeometry(w,h,d),material,x,y,z,parent);
 // A loft gives the nose, shoulders and boot distinct widths rather than one extruded slab.
 const sections=[[-2.13,.72,.48,.77],[-1.8,.86,.43,.98],[-1.1,.89,.43,1.02],[.95,.89,.43,1.02],[1.65,.83,.45,.88],[2.13,.7,.5,.76]];
 const pos:number[]=[],indices:number[]=[];
 sections.forEach(([z,w,lo,hi],i)=>{pos.push(-w,lo,z,w,lo,z,w,hi,z,-w,hi,z);if(i)for(let j=0;j<4;j++){const a=(i-1)*4+j,b=(i-1)*4+(j+1)%4,c=i*4+j,d=i*4+(j+1)%4;indices.push(a,b,c,b,d,c);}});
 indices.push(0,2,1,0,3,2,20,21,22,20,22,23);
 const body=new T.BufferGeometry();body.setAttribute('position',new T.Float32BufferAttribute(pos,3));body.setIndex(indices);body.computeVertexNormals();add(body,paint);
 const cabinShape=new T.Shape([new T.Vector2(-1.51,1),new T.Vector2(-.98,1.55),new T.Vector2(.64,1.55),new T.Vector2(1.25,1)]);
 const cabin=new T.ExtrudeGeometry(cabinShape,{depth:1.48,bevelEnabled:true,bevelThickness:.025,bevelSize:.035,bevelSegments:2,steps:1});
 cabin.rotateY(-Math.PI/2);cabin.translate(.74,0,0);add(cabin,paint);
 const pane=(points:number[][],material:T.Material)=>{const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();return add(geo,material);};
 // Both sides use two windows with a visible B pillar, rubber surrounds and door seam.
 for(const side of [-1,1]){
  const x=side*.786;
  const points=[[[x,1.06,-1.39],[x,1.5,-.94],[x,1.5,-.24],[x,1.06,-.24]],[[x,1.06,-.13],[x,1.5,-.13],[x,1.5,.6],[x,1.06,1.11]]];
  for(const ps of points){if(side<0)ps.reverse();pane(ps,glass);}
  box(.035,.46,.065,trim,x,1.28,-.18);box(.045,.05,2.55,trim,x,1.025,-.13);
  box(.022,.42,.018,trim,side*.892,.78,-.2);box(.028,.025,.22,metal,side*.902,.94,-.55);
  box(.028,.025,.22,metal,side*.902,.94,.55);
  const mirror=add(new T.SphereGeometry(1,12,6),paint,side*.97,1.1,.91);mirror.scale.set(.18,.10,.24);
  box(.12,.05,.08,trim,side*.89,1.04,.9);
  box(.025,.08,2.6,trim,side*.90,.43,0);
 }
 pane([[-.72,1.08,1.22],[.72,1.08,1.22],[.66,1.5,.75],[-.66,1.5,.75]],glass);
 pane([[-.66,1.5,-1.08],[.66,1.5,-1.08],[.72,1.08,-1.49],[-.72,1.08,-1.49]],glass);
 for(const z of [1.45,-1.65])box(1.5,.015,.018,trim,0,.97,z);
 box(1.25,.15,.035,trim,0,.59,2.14);box(.72,.12,.04,trim,0,.74,2.13);
 for(const x of [-.55,.55]){box(.38,.17,.07,lamp,x,.76,2.08);box(.4,.16,.075,tail,x,.76,-2.08);box(.18,.04,.07,lamp,x,.63,2.12);}
 box(1.42,.065,.08,metal,0,.45,2.10);box(1.42,.065,.08,trim,0,.45,-2.1);box(.44,.13,.025,plate,0,.59,-2.148);box(.44,.13,.025,plate,0,.55,2.15);
 for(const x of [-.89,.89])for(const z of [-1.32,1.31]){
  const steer=new T.Group();steer.position.set(x,.35,z);group.add(steer);if(z>0)frontWheels.push(steer);
  const spin=new T.Group();steer.add(spin);wheels.push(spin);
  const tire=add(new T.CylinderGeometry(.34,.34,.22,24),rubber,0,0,0,spin);tire.rotation.z=Math.PI/2;
  const rim=add(new T.CylinderGeometry(.23,.23,.235,20),trim,0,0,0,spin);rim.rotation.z=Math.PI/2;
  const hub=add(new T.CylinderGeometry(.075,.075,.25,12),metal,0,0,0,spin);hub.rotation.z=Math.PI/2;
  for(let i=0;i<5;i++){const angle=i*Math.PI*2/5,spoke=box(.25,.055,.23,metal,0,Math.cos(angle)*.13,Math.sin(angle)*.13,spin);spoke.rotation.x=angle;}
 }
 // Merge rigid parts by material in local coordinates, retaining separate steer/spin groups.
 function batch(parent:T.Group){const buckets=new Map<T.Material,T.BufferGeometry[]>(),remove:T.Mesh[]=[];parent.updateMatrixWorld(true);
  for(const child of parent.children){if(!(child instanceof T.Mesh)||Array.isArray(child.material))continue;const geo=child.geometry.clone().applyMatrix4(child.matrix);geo.deleteAttribute('uv');const list=buckets.get(child.material)??[];if(geo.index){list.push(geo.toNonIndexed());geo.dispose();}else list.push(geo);buckets.set(child.material,list);remove.push(child);}
  for(const mesh of remove){mesh.removeFromParent();mesh.geometry.dispose();}
  for(const [material,geometries]of buckets){const geometry=mergeGeometries(geometries);if(geometry)add(geometry,material,0,0,0,parent);for(const g of geometries)g.dispose();}
 }
 batch(group);for(const wheel of wheels)batch(wheel);
 const shadow=add(new T.PlaneGeometry(3,5.3),new T.MeshBasicMaterial({map:contact,transparent:true,depthWrite:false,opacity:.65,polygonOffset:true,polygonOffsetFactor:-1}),0,.008,0);
 shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;shadow.receiveShadow=false;
 return{group,wheels,frontWheels};
}
