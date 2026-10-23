import {test,expect} from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {validateBytes} from 'gltf-validator';
import * as T from 'three';

test('shipped GLB is valid, self-contained, attributed and retains independent grounded +Z vehicle parts',async()=>{
 const bytes=fs.readFileSync('public/models/carconcept.glb'),audit=JSON.parse(fs.readFileSync('source-data/carconcept.json','utf8'));
 expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(audit.output_sha256);
 const validation=await validateBytes(new Uint8Array(bytes),{maxIssues:100});expect(validation.issues.numErrors).toBe(0);
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).readBinary(bytes),nodes=doc.getRoot().listNodes(),scene=new T.Scene(),bounds=new T.Box3();
 for(const node of nodes){const mesh=node.getMesh();if(!mesh)continue;for(const p of mesh.listPrimitives()){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(Float32Array.from(p.getAttribute('POSITION')!.getArray()!),3));g.setIndex(new T.BufferAttribute(Uint32Array.from(p.getIndices()!.getArray()!),1));
  const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.name=p.getMaterial()!.getName();m.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));if(m.name!=='Glass')scene.add(m);
  for(let i=0;i<g.getAttribute('position').count;i++){const v=new T.Vector3().fromBufferAttribute(g.getAttribute('position'),i).applyMatrix4(m.matrix);expect(Number.isFinite(v.x+v.y+v.z)).toBe(true);bounds.expandByPoint(v);}
  if(m.name==='Dashboard')expect(p.getAttribute('TEXCOORD_0')).not.toBeNull();
  if(m.name==='Headlight'){g.computeBoundingBox();expect(g.boundingBox!.getCenter(new T.Vector3()).z).toBeGreaterThan(1.5);}
 }}
 expect(bounds.min.y).toBeGreaterThan(-.002);expect(bounds.getSize(new T.Vector3()).z).toBeGreaterThan(4.2);expect(bounds.getSize(new T.Vector3()).z).toBeLessThan(4.6);
 for(const name of ['WheelFrontL','WheelFrontR','WheelRearL','WheelRearR']){const wheel=nodes.find(n=>n.getName()===name)!;expect(wheel).toBeDefined();expect(wheel.getTranslation()[1]).toBeCloseTo(.384,2);expect(wheel.listChildren().map(n=>n.getName()).sort()).toEqual([`${name}Brake`,`${name}Spin`].sort());if(name.includes('Front'))expect(wheel.getTranslation()[2]).toBeGreaterThan(1);else expect(wheel.getTranslation()[2]).toBeLessThan(-1);}
 expect(nodes.find(n=>n.getName()==='Steering')).toBeDefined();expect(doc.getRoot().listMaterials().find(m=>m.getName()==='License')!.getBaseColorTexture()).toBeNull();
 expect(doc.getRoot().listTextures().every(t=>Math.max(...t.getSize()!)<=1024)).toBe(true);
 expect(fs.readFileSync('public/credits/carconcept.txt','utf8')).toContain('Eric Chadwick');
 const b=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());expect(b.images.every((i:{uri?:string})=>!i.uri)).toBe(true);
 scene.updateMatrixWorld(true);const eye=new T.Vector3(...b.scenes[0].extras.eye);
 for(const x of [-.1,0,.1])expect(new T.Raycaster(eye,new T.Vector3(x,0,1).normalize(),.02,2).intersectObjects(scene.children)).toHaveLength(0);
});
