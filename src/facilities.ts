import * as T from 'three';
import type {Point} from './core';
/** Original W-beam section. End profiles share the same offset-curve vertices. */
export function guardrailBeam(a:Point,b:Point,normalA:[number,number],normalB:[number,number]){
 const geometry=new T.BufferGeometry(),positions:number[]=[],indices:number[]=[];
 const ys=[-.15,-.11,-.055,0,.055,.11,.15],depth=[0,-.045,.015,.055,.015,-.045,0];
 for(const [point,n]of[[a,normalA],[b,normalB]]as const)for(let i=0;i<ys.length;i++)positions.push(point[0]+n[0]*depth[i],point[1]+.65+ys[i],point[2]+n[1]*depth[i]);
 for(let i=0;i<6;i++)indices.push(i,i+7,i+1,i+1,i+7,i+8);geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
/** Original connected lamp, in one local frame. Placement is an estimate. */
export function lamp(material:T.Material){
 const group=new T.Group();
 const pole=new T.Mesh(new T.CylinderGeometry(.075,.12,7,7),material);pole.position.y=3.5;pole.name='pole';group.add(pole);
 const arm=new T.Mesh(new T.BoxGeometry(1.9,.12,.12),material);arm.position.set(-.9,6.96,0);arm.name='arm';group.add(arm);
 const head=new T.Mesh(new T.BoxGeometry(.62,.18,.3),new T.MeshStandardMaterial({color:'#e3ddc6',roughness:1}));head.position.set(-1.75,6.95,0);head.name='head';group.add(head);
 return group;
}
