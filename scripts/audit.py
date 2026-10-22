import gzip,json,xml.etree.ElementTree as E,math,pathlib,collections
w=json.load(open('public/data/world.json'));r=E.fromstring(gzip.decompress(pathlib.Path('source-data/osm.xml.gz').read_bytes()));ns={n.attrib['id']:n for n in r.findall('node')};ways={n.attrib['id']:n for n in r.findall('way')};report={}
for i,src in enumerate(w['routeSources']):
 ids=src['nodeIds'];legal=[]
 for a,b in zip(ids,ids[1:]):
  matches=[]
  for wid in src['wayIds']:
   el=ways[wid];tags={t.attrib['k']:t.attrib['v'] for t in el.findall('tag')};refs=[n.attrib['ref'] for n in el.findall('nd')]
   if any(x==a and y==b for x,y in zip(refs,refs[1:])):matches.append(wid)
   if tags.get('oneway')!='yes' and any(x==b and y==a for x,y in zip(refs,refs[1:])):matches.append(wid)
  legal.append(bool(matches))
 endpoints=[{'nodeId':k,'lon':float(ns[k].attrib['lon']),'lat':float(ns[k].attrib['lat']),'url':'https://www.openstreetmap.org/node/'+k} for k in [ids[0],ids[-1]]]
 rr=w['routes'][i];length=sum(math.hypot(b[0]-a[0],b[2]-a[2]) for a,b in zip(rr,rr[1:]))
 report[str(i)]={'direction':'白沙灣 → 石門洞' if i==0 else '石門洞 → 白沙灣','endpoints':endpoints,'length_m':length,'all_edges_follow_osm_oneway':all(legal),'edges':len(legal),'wayIds':src['wayIds'],'max_segment_m':max(math.hypot(b[0]-a[0],b[2]-a[2]) for a,b in zip(rr,rr[1:]))}
rr=w['routes'][0];sample=[];s=0
for a,b in zip(rr,rr[1:]):
 sample.append(a);s+=math.hypot(b[0]-a[0],b[2]-a[2])
 if s>=500:break
counts=collections.Counter()
for f in w['features']:
 if min(math.hypot(p[0]-q[0],p[2]-q[2]) for p in f['points'] for q in sample)<250:counts[f['kind']]+=1
report['sample_500m_within_250m_feature_vertices']=dict(counts)
pathlib.Path('reports/route-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
