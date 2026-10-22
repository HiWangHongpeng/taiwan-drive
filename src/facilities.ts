import * as T from 'three';
/** Original connected lamp, in one local frame. Placement is an estimate. */
export function lamp(material:T.Material){
 const group=new T.Group();
 const pole=new T.Mesh(new T.CylinderGeometry(.075,.12,7,7),material);pole.position.y=3.5;pole.name='pole';group.add(pole);
 const arm=new T.Mesh(new T.BoxGeometry(1.9,.12,.12),material);arm.position.set(-.9,6.96,0);arm.name='arm';group.add(arm);
 const head=new T.Mesh(new T.BoxGeometry(.62,.18,.3),new T.MeshStandardMaterial({color:'#e3ddc6',roughness:1}));head.position.set(-1.75,6.95,0);head.name='head';group.add(head);
 return group;
}
