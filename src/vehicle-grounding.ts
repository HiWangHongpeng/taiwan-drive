import * as T from 'three';

export type HeightSampler=(x:number,z:number)=>number;
/** Visual support only. Physics position, heading and route data are never changed. */
export function groundVehicle(body:T.Group,pivots:T.Object3D[],radius:number,x:number,z:number,yaw:number,height:HeightSampler){
 const c=Math.cos(yaw),s=Math.sin(yaw);
 for(const p of pivots){p.userData.restY??=p.position.y;p.position.y=p.userData.restY;}
 const points=pivots.map(p=>({x:p.position.x,z:p.position.z,h:height(x+c*p.position.x+s*p.position.z,z-s*p.position.x+c*p.position.z)}));
 const mx=points.reduce((n,p)=>n+p.x,0)/4,mz=points.reduce((n,p)=>n+p.z,0)/4,mh=points.reduce((n,p)=>n+p.h,0)/4;
 let xx=0,zz=0,xz=0,xh=0,zh=0;for(const p of points){const dx=p.x-mx,dz=p.z-mz;xx+=dx*dx;zz+=dz*dz;xz+=dx*dz;xh+=dx*(p.h-mh);zh+=dz*(p.h-mh);}
 const determinant=xx*zz-xz*xz,a=(xh*zz-zh*xz)/determinant,b=(zh*xx-xh*xz)/determinant,h0=mh-a*mx-b*mz;
 const normal=new T.Vector3(-a,1,-b).normalize().applyAxisAngle(new T.Vector3(0,1,0),yaw),forward=new T.Vector3(s,0,c).projectOnPlane(normal).normalize(),right=normal.clone().cross(forward).normalize();forward.crossVectors(right,normal).normalize();
 body.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,normal,forward));
 const restContact=pivots.reduce((n,p)=>n+Number(p.userData.restY)-radius,0)/4;body.position.set(x,h0-restContact/normal.y,z);body.updateMatrixWorld(true);
 // A bounded visual suspension correction accommodates small non-planar triangle joins.
 for(const p of pivots){const foot=body.localToWorld(p.position.clone().add(new T.Vector3(0,-radius,0))),delta=(height(foot.x,foot.z)-foot.y)/normal.y;p.position.y+=T.MathUtils.clamp(delta,-.08,.08);}
 body.updateMatrixWorld(true);
}
export function wheelContacts(body:T.Group,pivots:T.Object3D[],radius:number,height:HeightSampler){return pivots.map(p=>{const foot=body.localToWorld(p.position.clone().add(new T.Vector3(0,-radius,0)));return{x:foot.x,y:foot.y,z:foot.z,surface_y:height(foot.x,foot.z),gap_m:foot.y-height(foot.x,foot.z),suspension_m:p.position.y-Number(p.userData.restY??p.position.y)};});}
