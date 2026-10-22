"""Regress all source XY against raw cached OSM, and preserve frozen road XY."""
import pathlib,json,gzip,xml.etree.ElementTree as E,math,hashlib
w=json.loads(pathlib.Path('public/data/world.json').read_text());old=json.loads(gzip.decompress(pathlib.Path('source-data/outbound-plane-reference.json.gz').read_bytes()));root=E.fromstring(gzip.decompress(pathlib.Path('source-data/osm.xml.gz').read_bytes()));nodes={n.attrib['id']:n for n in root.findall('node')};ways={n.attrib['id']:n for n in root.findall('way')}
def xy(k):
 n=nodes[k];return [(float(n.attrib['lon'])-121.522)*100650,-(float(n.attrib['lat'])-25.284)*111320]
max_xy=0
for f in w['features']:
 ids=[f['id']] if f['type']=='node' else [n.attrib['ref'] for n in ways[f['id']].findall('nd') if n.attrib['ref'] in nodes]
 assert len(ids)==len(f['points'])
 for p,k in zip(f['points'],ids):
  q=xy(k);max_xy=max(max_xy,math.hypot(p[0]-q[0],p[2]-q[1]))
assert max_xy<.001
routes=[]
for r,o,s in zip(w['routes'],old['routes'],w['routeSources']):
 assert len(r)==len(o);delta=max(math.hypot(a[0]-b[0],a[2]-b[2]) for a,b in zip(r,o));assert delta==0
 rebuilt=[]
 for a,b in zip(s['nodeIds'],s['nodeIds'][1:]):
  p,q=xy(a),xy(b);count=max(1,math.ceil(math.dist(p,q)/5))
  rebuilt.extend([[p[j]+(q[j]-p[j])*i/count for j in range(2)] for i in range(count)])
 rebuilt.append(xy(s['nodeIds'][-1]));assert len(rebuilt)==len(r)
 err=max(math.hypot(p[0]-q[0],p[2]-q[1]) for p,q in zip(r,rebuilt));assert err<.001
 routes.append({'points':len(r),'xy_delta_to_outbound_freeze_max_m':delta,'xy_error_to_raw_max_m':err})
report={'world_sha256':hashlib.sha256(pathlib.Path('public/data/world.json').read_bytes()).hexdigest(),'features_checked':len(w['features']),'feature_xy_error_max_m':max_xy,'routes':routes,'scope':'Raw OSM plane geometry and frozen XY preservation only; does not establish site accuracy, heights, road widths or facility positions.'}
pathlib.Path('reports/geometry-regression.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
pathlib.Path('reports/elevation-revised.json').write_text(json.dumps(w['metadata']['elevationProcessing'],indent=2))
