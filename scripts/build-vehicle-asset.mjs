// Reproducible, offline-after-cache preparation of the CC-BY CarConcept sample.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,join,simplify,weld,textureCompress} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
import * as T from 'three';
import {execFileSync} from 'node:child_process';

const revision='15cd02d304e54cb42a4db4eefe719f76190f4b68';
const sourceURL=`https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/${revision}/Models/CarConcept/glTF-Binary/CarConcept.glb`;
const expected='c272098089d78c5cd9fd9f24ff50ee8acf8d932c55f2d55fc10adb6c8998966b';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const input='work/asset-research/CarConcept.glb',output='public/models/carconcept.glb';
await fs.mkdir('work/asset-research',{recursive:true});await fs.mkdir('public/models',{recursive:true});
let bytes;try{bytes=await fs.readFile(input);}catch{
 // curl preserves the configured proxy and CA trust, including in the managed cloud executor.
 bytes=execFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','40','--max-filesize','33554432','--proto','=https',sourceURL],{maxBuffer:33*1024*1024});await fs.writeFile(input,bytes);
}
if(hash(bytes)!==expected)throw Error('Unexpected source hash; retained cache requires review');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.readBinary(bytes);
const root=doc.getRoot(),oldNodes=root.listNodes(),oldMeshes=root.listMeshes(),buffer=doc.createBuffer('prepared');
const wheelNames=['WheelFrontL','WheelFrontR','WheelRearL','WheelRearR'];
const sourceBounds=new T.Box3();
for(const node of oldNodes){const mesh=node.getMesh();if(!mesh)continue;const matrix=new T.Matrix4().fromArray(node.getWorldMatrix());for(const primitive of mesh.listPrimitives()){const a=primitive.getAttribute('POSITION').getArray();for(let i=0;i<a.length;i+=3)sourceBounds.expandByPoint(new T.Vector3(a[i],a[i+1],a[i+2]).applyMatrix4(matrix));}}
const offset=new T.Vector3(-(sourceBounds.min.x+sourceBounds.max.x)/2,-sourceBounds.min.y,-(sourceBounds.min.z+sourceBounds.max.z)/2);
const steeringSource=oldNodes.find(n=>n.getName()==='InteriorSteeringCylinder');
const steeringCenter=new T.Vector3(...oldNodes.find(n=>n.getName()==='InteriorSteeringWheel01').getWorldTranslation()).add(offset);
const steeringAxis=new T.Vector3(0,1,0).transformDirection(new T.Matrix4().fromArray(steeringSource.getWorldMatrix()));
const sourceWheelX=new T.Vector3(1,0,0).transformDirection(new T.Matrix4().fromArray(oldNodes.find(n=>n.getName()==='InteriorSteeringWheel01').getWorldMatrix())),neutralCorrection=Math.atan2(steeringAxis.dot(sourceWheelX.clone().cross(new T.Vector3(1,0,0))),sourceWheelX.x);
const categories=new Map(),wheelInfo=[];
const body=doc.createNode('Body').setMesh(doc.createMesh('Body'));categories.set('Body',body);
const steering=doc.createNode('Steering').setTranslation(steeringCenter.toArray()).setMesh(doc.createMesh('Steering'));categories.set('Steering',steering);
const scene=root.getDefaultScene();for(const child of scene.listChildren())scene.removeChild(child);scene.addChild(body).addChild(steering);
for(const name of wheelNames){const source=oldNodes.find(n=>n.getName()===name),center=new T.Vector3(...source.getWorldTranslation()).add(offset),axis=new T.Vector3(1,0,0).transformDirection(new T.Matrix4().fromArray(source.getWorldMatrix()));
 const yaw=Math.atan2(-axis.z,axis.x),pivot=doc.createNode(name).setTranslation(center.toArray()),spin=doc.createNode(`${name}Spin`).setMesh(doc.createMesh(`${name}Spin`)),brake=doc.createNode(`${name}Brake`).setMesh(doc.createMesh(`${name}Brake`));pivot.addChild(spin).addChild(brake);scene.addChild(pivot);categories.set(`${name}Spin`,spin);categories.set(`${name}Brake`,brake);wheelInfo.push({name,center:center.toArray(),removed_source_yaw_radians:yaw});}
// Remove the entire logo-bearing material texture, rather than altering a logo image.
for(const material of root.listMaterials()){
 if(material.getName()==='License')material.setBaseColorTexture(null).setBaseColorFactor([.72,.74,.70,1]);
 // Close-up review also found the upstream wordmark in the tyre-side colour/normal maps.
 if(material.getName()==='Tireside')material.setBaseColorTexture(null).setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setBaseColorFactor([.035,.039,.04,1]).setRoughnessFactor(.92);
 if(material.getName()==='Dashboard'){const svg='<svg xmlns="http://www.w3.org/2000/svg" width="512" height="128"><rect width="512" height="128" fill="#101b1b"/><rect x="8" y="8" width="496" height="112" rx="4" fill="none" stroke="#8cae9a" stroke-width="3"/><rect x="235" y="26" width="42" height="68" rx="8" fill="none" stroke="#d4e8ce" stroke-width="8"/></svg>';const image=await sharp(Buffer.from(svg)).png().toBuffer();material.setEmissiveTexture(doc.createTexture('original-live-display-placeholder').setImage(image).setMimeType('image/png')).setBaseColorFactor([.02,.03,.03,1]).setMetallicFactor(0).setRoughnessFactor(.8);}
 material.setExtension('KHR_materials_variants',null);
 // Transmission requires an extra scene pass. Use ordinary transparent glass in the browser trial.
 if(material.getName()==='Glass')material.setExtension('KHR_materials_transmission',null).setAlphaMode('BLEND').setBaseColorFactor([.65,.77,.80,.12]).setDoubleSided(false).setMetallicFactor(.15).setRoughnessFactor(.16);
}
const oldMaterialCount=root.listMaterials().length;
for(const node of oldNodes){
 if(node.getName()==='InteriorSteeringEmblem'||!node.getMesh())continue;
 let ancestor=node,wheel;while(ancestor){if(wheelNames.includes(ancestor.getName())){wheel=ancestor.getName();break;}ancestor=ancestor.getParentNode();}
 const inSteering=node===steeringSource||node.getParentNode()===steeringSource;
 const category=wheel?`${wheel}${node.getName().includes('BrakePad')?'Brake':'Spin'}`:inSteering?'Steering':'Body';
 const target=categories.get(category),world=new T.Matrix4().fromArray(node.getWorldMatrix()),matrix=new T.Matrix4().makeTranslation(...offset.toArray()).multiply(world);
 if(wheel){const info=wheelInfo.find(w=>w.name===wheel);matrix.premultiply(new T.Matrix4().makeTranslation(...info.center.map(n=>-n)));matrix.premultiply(new T.Matrix4().makeRotationY(-info.removed_source_yaw_radians));}
 else if(inSteering){matrix.premultiply(new T.Matrix4().makeTranslation(...steeringCenter.toArray().map(n=>-n)));matrix.premultiply(new T.Matrix4().makeRotationAxis(steeringAxis,neutralCorrection));}
 const normal=new T.Matrix3().getNormalMatrix(matrix);
 for(const primitive of node.getMesh().listPrimitives()){
  const copy=doc.createPrimitive().setMaterial(primitive.getMaterial()).setMode(primitive.getMode());
  for(const semantic of primitive.listSemantics()){
   const source=primitive.getAttribute(semantic),array=source.getArray().slice(),size=source.getElementSize();
   if(semantic==='POSITION'||semantic==='NORMAL'||semantic==='TANGENT')for(let i=0;i<array.length;i+=size){const v=new T.Vector3(array[i],array[i+1],array[i+2]);if(semantic==='POSITION')v.applyMatrix4(matrix);else v.applyMatrix3(normal).normalize();array[i]=v.x;array[i+1]=v.y;array[i+2]=v.z;}
   copy.setAttribute(semantic,doc.createAccessor().setType(source.getType()).setArray(array).setNormalized(source.getNormalized()).setBuffer(buffer));
  }
  if(primitive.getIndices()){const source=primitive.getIndices();copy.setIndices(doc.createAccessor().setType('SCALAR').setArray(source.getArray().slice()).setBuffer(buffer));}
  target.getMesh().addPrimitive(copy);
 }
}
for(const node of oldNodes)node.dispose();for(const mesh of oldMeshes)mesh.dispose();
for(const extension of root.listExtensionsUsed())if(['KHR_materials_variants','KHR_materials_iridescence','KHR_materials_transmission'].includes(extension.extensionName))extension.dispose();
await MeshoptSimplifier.ready;
await doc.transform(prune(),dedup(),join({keepMeshes:true}),weld(),simplify({simplifier:MeshoptSimplifier,ratio:.5,error:.001,lockBorder:true}),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:90}),dedup(),prune());
const meta={source:'CarConcept / Eric Chadwick / Darmstadt Graphics Group GmbH',license:'CC-BY-4.0',forward:'+Z',steeringAxis:steeringAxis.toArray(),steeringCenter:steeringCenter.toArray(),neutralSteeringCorrection:neutralCorrection,wheelRadius:wheelInfo[0].center[1],eye:[0,.94,.04],lookAt:[0,.94,30],wheels:wheelInfo};
scene.setExtras(meta);
const prepared=await io.writeBinary(doc);await fs.writeFile(output,prepared);
const triangles=root.listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((s,p)=>s+p.getIndices().getCount()/3,0),0);
const report={source_url:sourceURL,upstream_revision:revision,source_sha256:hash(bytes),source_bytes:bytes.length,output,output_sha256:hash(prepared),output_bytes:prepared.length,triangles,mesh_groups:root.listMeshes().length,draw_primitives:root.listMeshes().reduce((s,m)=>s+m.listPrimitives().length,0),material_count:root.listMaterials().length,source_material_count:oldMaterialCount,textures:root.listTextures().map(t=>({mime:t.getMimeType(),size:t.getSize(),bytes:t.getImage().length})),meta,processing:['Baked original coordinate transforms to Y-up/+Z-forward; centered model and grounded its actual vertices','Removed source front-wheel showcase yaw; spin axles are now +X, calipers remain outside spin groups','Kept a distinct steering wheel and complete interior; neutralized 15 degree showcase steering pose; removed steering emblem mesh and logo-bearing plate texture; removed the decorative fixed-zero display texture for a live original Canvas instrument','Removed wordmark-bearing tyre-side colour/normal maps and replaced them with unbranded rough rubber; this corrects an omission discovered during close-up contact review','Joined compatible primitives per body/wheel/steering group; welded and simplified at ratio .5, error .001, borders locked','Capped textures at 1024, WebP quality90; no transmission scene pass or optional iridescent variants'],estimated:'Camera placement, visual ride height, light/material adaptation and source simplification are game estimates, not a surveyed Taiwanese production car'};
await fs.mkdir('source-data',{recursive:true});await fs.writeFile('source-data/carconcept.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
