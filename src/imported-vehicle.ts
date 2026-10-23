import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {Quality} from './surfaces';

export async function loadImportedVehicle(url:string,contact:T.Texture,environment:T.Texture|null){
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`車輛 HTTP ${response.status}`);
 const bytes=await response.arrayBuffer();if(bytes.byteLength>20*1024*1024)throw Error('車輛檔案過大');
 const gltf=await new GLTFLoader().parseAsync(bytes,''),group=gltf.scene;
 const metadata=group.userData as {steeringAxis:number[];wheelRadius:number;eye:number[];lookAt:number[]};
 const wheelNames=['WheelFrontL','WheelFrontR','WheelRearL','WheelRearR'];
 const frontWheels=wheelNames.slice(0,2).map(name=>group.getObjectByName(name)!);
 const wheels=wheelNames.map(name=>group.getObjectByName(`${name}Spin`)!);
 const steering=group.getObjectByName('Steering');
 if(!steering||[...frontWheels,...wheels].some(o=>!o)||!metadata.steeringAxis||!metadata.eye)throw Error('車輛部件不完整');
 const steeringAxis=new T.Vector3(...metadata.steeringAxis),marker=new T.Mesh(new T.BoxGeometry(.026,.018,.018),new T.MeshStandardMaterial({color:'#d3b77d',roughness:.6}));
 // Original neutral marker on the imported wheel, following its tilted shaft.
 const up=new T.Vector3(0,1,0).projectOnPlane(steeringAxis).normalize();marker.position.copy(up.multiplyScalar(.145)).addScaledVector(steeringAxis,.025);steering.add(marker);
 const display=document.createElement('canvas');display.width=512;display.height=128;const ctx=display.getContext('2d')!,displayTexture=new T.CanvasTexture(display);displayTexture.flipY=false;displayTexture.colorSpace=T.SRGBColorSpace;
 let displayElapsed=1,dashboardSpeed=-1,dashboardGear='';
 const updateDashboard=(speed:number,dt:number)=>{displayElapsed+=dt;const value=Math.round(Math.abs(speed)*3.6),gear=speed<-.1?'R':'D';if(displayElapsed<.1||value===dashboardSpeed&&gear===dashboardGear)return;displayElapsed=0;dashboardSpeed=value;dashboardGear=gear;ctx.fillStyle='#101b1b';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#8cae9a';ctx.lineWidth=3;ctx.strokeRect(8,8,496,112);ctx.fillStyle='#d4e8ce';ctx.textAlign='center';ctx.font='bold 76px sans-serif';ctx.fillText(String(value),256,88);ctx.font='22px sans-serif';ctx.fillText('km/h',390,85);ctx.font='bold 38px sans-serif';ctx.fillText(gear,78,83);displayTexture.needsUpdate=true;};updateDashboard(0,1);
 const pairs=new Map<T.MeshStandardMaterial,{original:T.MeshStandardMaterial;standard:T.MeshStandardMaterial}>();
 let triangles=0,meshes=0;
 group.traverse(o=>{if(!(o instanceof T.Mesh))return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;o.receiveShadow=true;
  for(const material of Array.isArray(o.material)?o.material:[o.material])if(material instanceof T.MeshStandardMaterial&&!pairs.has(material)){
   if(material.name==='Dashboard'){material.emissiveMap=displayTexture;material.emissive.setRGB(1,1,1);material.emissiveIntensity=.8;}
   if(material.metalness>.1||/Paint|Glass|Mirror/.test(material.name)){material.envMap=environment;material.envMapIntensity=.6;}
   const standard=new T.MeshStandardMaterial().copy(material);pairs.set(material,{original:material,standard});
  }
 });
 const originals=new Map<T.Mesh,T.MeshStandardMaterial|T.MeshStandardMaterial[]>();group.traverse(o=>{if(o instanceof T.Mesh)originals.set(o,o.material);});
 const shadow=new T.Mesh(new T.PlaneGeometry(3,5.3),new T.MeshBasicMaterial({map:contact,transparent:true,depthWrite:false,opacity:.65,polygonOffset:true,polygonOffsetFactor:-1}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.008;group.add(shadow);
 return{group,wheels,frontWheels,steering,marker,steeringAxis,wheelRadius:metadata.wheelRadius,eye:new T.Vector3(...metadata.eye),lookAt:new T.Vector3(...metadata.lookAt),triangles,meshes,updateDashboard,dashboard:()=>({speed:dashboardSpeed,gear:dashboardGear}),
  setQuality(quality:Quality){for(const [mesh,materials]of originals){const pick=(m:T.MeshStandardMaterial)=>{const pair=pairs.get(m);return pair?(quality==='high'?pair.original:pair.standard):m;};mesh.material=Array.isArray(materials)?materials.map(pick):pick(materials);mesh.castShadow=quality==='high'&&!(Array.isArray(mesh.material)?mesh.material[0]:mesh.material).transparent;}
   for(const pair of pairs.values())for(const m of [pair.original,pair.standard])m.needsUpdate=true;
  }
 };
}
