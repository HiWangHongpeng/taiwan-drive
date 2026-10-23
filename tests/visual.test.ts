import {expect,test,vi} from 'vitest';
import * as T from 'three';
import {makeVehicle} from '../src/vehicle';
import {isQuality,qualityBudget,GRAPHICS_KEY} from '../src/surfaces';
import {SAVE_KEY} from '../src/core';

test('vehicle geometry merges without dropping body parts, keeps wheels grounded and +Z steering axle',()=>{
 const errors=vi.spyOn(console,'error');
 const car=makeVehicle(new T.Texture());car.group.updateMatrixWorld(true);
 expect(errors.mock.calls).toEqual([]);errors.mockRestore();
 expect(car.wheels).toHaveLength(4);expect(car.frontWheels).toHaveLength(2);
 for(const front of car.frontWheels)expect(front.position.z).toBeGreaterThan(1);
 const bounds=new T.Box3();let meshes=0;
 car.group.traverse(o=>{if(!(o instanceof T.Mesh)||o.material.transparent)return;meshes++;bounds.union(new T.Box3().setFromObject(o));const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++)expect([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite)).toBe(true);});
 const size=bounds.getSize(new T.Vector3());expect(size.x).toBeGreaterThan(1.8);expect(size.x).toBeLessThan(2.4);expect(size.z).toBeGreaterThan(4.2);expect(size.z).toBeLessThan(4.5);expect(bounds.min.y).toBeGreaterThanOrEqual(0);expect(size.y).toBeGreaterThan(1.5);expect(meshes).toBeLessThan(30);
});

test('graphics accepts only known budgets and has a separate persistence key from driving saves',()=>{
 expect(GRAPHICS_KEY).not.toBe(SAVE_KEY);
 for(const value of [null,undefined,'mouse',{},'HIGH',0])expect(isQuality(value)).toBe(false);
 for(const value of ['low','standard','high'])expect(isQuality(value)).toBe(true);
 expect(qualityBudget('standard').shadowSize).toBeLessThan(qualityBudget('high').shadowSize);
 expect(qualityBudget('low').shadowSize).toBe(0);
});
