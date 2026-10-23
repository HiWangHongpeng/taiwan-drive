import * as T from 'three';

// Original deterministic raster materials. No photographs, downloaded textures or runtime requests.
export type Quality='low'|'standard'|'high';
export const GRAPHICS_KEY='island-drive:graphics:v1';
export const isQuality=(value:unknown):value is Quality=>value==='low'||value==='standard'||value==='high';
export const qualityBudget=(quality:Quality)=>quality==='low'?{pixelRatio:1,shadowSize:0}:quality==='high'?{pixelRatio:2,shadowSize:1536}:{pixelRatio:1.5,shadowSize:1024};

export function terrainTint(x:number,z:number,normalY:number,base:T.Color){
 const macro=Math.sin(x*.021+Math.sin(z*.017)*2)*Math.cos(z*.026)+.45*Math.sin(x*.091+z*.077),shade=.89+.09*macro;
 const stone=T.MathUtils.clamp((1-normalY-.055)*2.6,0,.6);
 return base.clone().multiplyScalar(shade).lerp(new T.Color('#8b8d7e').multiplyScalar(.92+.07*macro),stone);
}

function random(seed:number){let n=seed;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function canvasTexture(size:number,draw:(ctx:CanvasRenderingContext2D)=>void){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 draw(canvas.getContext('2d')!);const texture=new T.CanvasTexture(canvas);
 texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;
 return texture;
}
function grain(seed:number,base:number,range:number,fibres=false){
 return canvasTexture(256,ctx=>{
  const rng=random(seed),image=ctx.createImageData(256,256);
  for(let i=0;i<image.data.length;i+=4){const value=base+(rng()-.5)*range;image.data[i]=value;image.data[i+1]=value;image.data[i+2]=value;image.data[i+3]=255;}
  ctx.putImageData(image,0,0);
  if(fibres){ctx.strokeStyle='#ffffff19';ctx.lineWidth=1;for(let i=0;i<1100;i++){const x=rng()*256,y=rng()*256;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rng()-.5)*4,y+2+rng()*5);ctx.stroke();}}
 });
}

export class Surfaces{
 environment:T.Texture|null=null;private detailedBump=false;private mappedMaterials:T.MeshStandardMaterial[]=[];
 readonly asphalt=canvasTexture(1024,c=>{const rng=random(12),image=c.createImageData(1024,1024),noise=Array.from({length:256},()=>rng()),fade=(v:number)=>v*v*(3-2*v);const macro=(x:number,y:number)=>{const u=x/64,v=y/64,a=Math.floor(u),b=Math.floor(v),tx=fade(u-a),ty=fade(v-b),at=(i:number,j:number)=>noise[((j+16)%16)*16+(i+16)%16];return (at(a,b)*(1-tx)+at(a+1,b)*tx)*(1-ty)+(at(a,b+1)*(1-tx)+at(a+1,b+1)*tx)*ty;};
  for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){const i=(y*1024+x)*4,v=166+(rng()-.5)*64+38*(macro(x,y)-.5);image.data[i]=v;image.data[i+1]=v;image.data[i+2]=v;image.data[i+3]=255;}c.putImageData(image,0,0);
  for(let i=0;i<42000;i++){const v=95+rng()*140;c.fillStyle=`rgb(${v} ${v} ${v})`;c.beginPath();c.ellipse(rng()*1024,rng()*1024,.6+rng()*2.4,.5+rng()*1.2,rng()*Math.PI,0,Math.PI*2);c.fill();}
 });
 readonly ground=canvasTexture(512,c=>{const rng=random(33);c.fillStyle='#c3c5ac';c.fillRect(0,0,512,512);for(let i=0;i<18000;i++){const v=155+rng()*90;c.strokeStyle=`rgb(${v-8} ${v} ${v-24})`;c.lineWidth=.5+rng();const x=rng()*512,y=rng()*512;c.beginPath();c.moveTo(x,y);c.lineTo(x+(rng()-.5)*5,y-1-rng()*5);c.stroke();}for(let i=0;i<2400;i++){const v=150+rng()*80;c.fillStyle=`rgb(${v} ${v-4} ${v-17})`;c.beginPath();c.ellipse(rng()*512,rng()*512,.6+rng()*2,.5+rng(),rng()*Math.PI,0,Math.PI*2);c.fill();}});
 readonly concrete=grain(54,230,26);
 readonly plaster=grain(71,242,15);
 readonly waterNormal:T.CanvasTexture;
 readonly sky:T.CanvasTexture;
 readonly contact:T.CanvasTexture;
 readonly foliage:T.CanvasTexture;
 constructor(renderer:T.WebGLRenderer){
  const anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  for(const texture of [this.asphalt,this.ground,this.concrete,this.plaster])texture.anisotropy=anisotropy;
  this.waterNormal=canvasTexture(256,ctx=>{
   const image=ctx.createImageData(256,256);
   for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const i=(y*256+x)*4,a=x*Math.PI/32,b=y*Math.PI/16;
    image.data[i]=128+18*Math.sin(a+b)+9*Math.sin(a*2-b);
    image.data[i+1]=128+19*Math.cos(a-b)+8*Math.sin(b*2);
    image.data[i+2]=250;image.data[i+3]=255;
   }ctx.putImageData(image,0,0);
  });this.waterNormal.colorSpace=T.NoColorSpace;this.waterNormal.repeat.set(1700,1700);
  const sky=document.createElement('canvas');sky.width=1024;sky.height=512;
  const ctx=sky.getContext('2d')!,gradient=ctx.createLinearGradient(0,0,0,512);
  for(const [stop,color]of [[0,'#507fae'],[.3,'#85abc9'],[.5,'#c9dade'],[.55,'#afbdb7'],[1,'#64715d']] as const)gradient.addColorStop(stop,color);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,512);
  const rng=random(103);ctx.filter='blur(7px)';
  for(let i=0;i<55;i++){
   const x=rng()*1024,y=85+rng()*125,width=20+rng()*70;
   ctx.fillStyle=`rgba(247,245,233,${.07+rng()*.16})`;ctx.beginPath();ctx.ellipse(x,y,width,3+rng()*9,0,0,Math.PI*2);ctx.fill();
  }
  ctx.filter='none';this.sky=new T.CanvasTexture(sky);this.sky.mapping=T.EquirectangularReflectionMapping;this.sky.colorSpace=T.SRGBColorSpace;
  this.contact=canvasTexture(128,c=>{const g=c.createRadialGradient(64,64,10,64,64,64);g.addColorStop(0,'#17231ec0');g.addColorStop(.5,'#17231e65');g.addColorStop(1,'#17231e00');c.fillStyle=g;c.fillRect(0,0,128,128);});
  this.foliage=canvasTexture(512,c=>{
   const rng=random(277);c.strokeStyle='#524e38';c.lineCap='round';
   for(let i=0;i<28;i++){const x=90+rng()*330,y=110+rng()*220;c.lineWidth=1+rng()*3;c.beginPath();c.moveTo(256,435);c.quadraticCurveTo(250+(x-256)*.3,300,x,y);c.stroke();}
   for(let i=0;i<7200;i++){
    const x=45+rng()*420,y=35+rng()*400;
    if(![[175,255,125,133],[322,256,132,126],[255,157,125,118],[257,325,140,95]].some(([cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<1))continue;
    const light=23+(1-y/512)*18+rng()*15;c.fillStyle=`hsl(${90+rng()*24} ${23+rng()*13}% ${light}%)`;c.beginPath();c.ellipse(x,y,2+rng()*4,1+rng()*2,rng()*Math.PI,0,Math.PI*2);c.fill();
   }
  });this.foliage.wrapS=this.foliage.wrapT=T.ClampToEdgeWrapping;
 }
 material(color:string,vertexColors=false){
  const asphalt=['#65706e','#929a8e','#8b9288','#71786c'].includes(color),terrain=vertexColors;
  const concrete=['#bdbca4','#b6b49c','#c2bca2','#a6aa96','#c4c5ad'].includes(color);
  const plaster=color==='#d1c9b3';
  const metal=['#bac3ad','#98a18b','#7e8e81','#b5bfb0','#8b9a89'].includes(color);
  const glass=['#859c99','#89a29d','#8fa9a5'].includes(color);
  const map=terrain?this.ground:asphalt?this.asphalt:concrete?this.concrete:plaster?this.plaster:null;
  const material=new T.MeshStandardMaterial({color,vertexColors,map,roughness:glass?.25:metal?.55:asphalt?.97:.88,metalness:metal?.6:glass?.25:0,flatShading:false,side:T.DoubleSide});
  if(map){material.userData.detailMap=map;material.userData.asphalt=asphalt;material.bumpScale=terrain?.08:asphalt?.025:.035;this.mappedMaterials.push(material);if(this.detailedBump||asphalt)material.bumpMap=map;}if(metal||glass){material.envMap=this.environment;material.envMapIntensity=.65;}
  material.userData.uvScale=asphalt?4:terrain?4:concrete?3:2;
  return material;
 }
 setQuality(quality:Quality){this.detailedBump=quality==='high';for(const texture of [this.asphalt,this.ground,this.concrete,this.plaster]){texture.anisotropy=quality==='high'?8:quality==='standard'?8:1;texture.needsUpdate=true;}for(const material of this.mappedMaterials){material.bumpMap=(this.detailedBump||(quality!=='low'&&material.userData.asphalt))?material.userData.detailMap:null;material.needsUpdate=true;}}
 sea(){return new T.MeshStandardMaterial({envMap:this.environment,color:'#54808d',roughness:.32,metalness:.28,normalMap:this.waterNormal,normalScale:new T.Vector2(.35,.35),envMapIntensity:.8});}
}
