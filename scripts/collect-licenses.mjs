import fs from 'node:fs';import path from 'node:path';
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8')),records=[];fs.mkdirSync('licenses',{recursive:true});
for(const [folder,entry]of Object.entries(lock.packages)){
 if(!folder||!fs.existsSync(path.join(folder,'package.json')))continue;
 const pkg=JSON.parse(fs.readFileSync(path.join(folder,'package.json'),'utf8'));records.push({name:pkg.name,version:pkg.version,license:pkg.license??entry.license??'SEE LICENSE',repository:pkg.repository,developmentOnly:Boolean(entry.dev),optional:Boolean(entry.optional)});
 for(const file of fs.readdirSync(folder))if(/^(license|copying|notice)(\.|$)/i.test(file)&&fs.statSync(path.join(folder,file)).isFile()){
  const source=path.join(folder,file),name=pkg.name.replaceAll('/','__');let destination=path.join('licenses',`${name}__${file}`);
  // Different installed versions can carry different copyright notices; preserve both.
  if(fs.existsSync(destination)&&!fs.readFileSync(destination).equals(fs.readFileSync(source)))destination=path.join('licenses',`${name}__${pkg.version}__${file}`);
  fs.copyFileSync(source,destination);
 }
}
records.sort((a,b)=>a.name.localeCompare(b.name));fs.writeFileSync('THIRD_PARTY.json',JSON.stringify(records,null,2)+'\n');console.log(`Recorded ${records.length} installed dependency licenses; asset attribution is in SOURCES.md and licenses/carconcept.`);
