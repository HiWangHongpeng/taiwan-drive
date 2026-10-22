import xml.etree.ElementTree as ET,math,heapq,json,gzip,struct,pathlib,hashlib
root=ET.fromstring(gzip.decompress(pathlib.Path('source-data/osm.xml.gz').read_bytes()))
N={n.attrib['id']:n for n in root.findall('node')}
def tags(e):return {t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}
def xy(n):return [(float(n.attrib['lon'])-121.522)*100650,-(float(n.attrib['lat'])-25.284)*111320]
P={k:xy(n) for k,n in N.items()}
def dist(a,b):return math.hypot(a[0]-b[0],a[1]-b[1])
g={};ways=[]
for w in root.findall('way'):
 t=tags(w); ids=[n.attrib['ref'] for n in w.findall('nd') if n.attrib['ref'] in N]
 if t.get('ref')=='2' and t.get('highway')=='primary':
  for a,b in zip(ids,ids[1:]):
   g.setdefault(a,[]).append((b,dist(P[a],P[b]),w.attrib['id']))
   if t.get('oneway')!='yes':g.setdefault(b,[]).append((a,dist(P[a],P[b]),w.attrib['id']))
 ways.append((w,ids,t))
def route(start,end):
 q=[(0,start)]; d={start:0}; prev={}
 while q:
  cost,a=heapq.heappop(q)
  if a==end:break
  if cost!=d[a]:continue
  for b,c,w in g.get(a,[]):
   if cost+c<d.get(b,1e20): d[b]=cost+c;prev[b]=(a,w);heapq.heappush(q,(cost+c,b))
 if end not in d:return None
 ns=[end];ws=[]
 while ns[-1]!=start:a,w=prev[ns[-1]];ns.append(a);ws.append(w)
 return ns[::-1],list(dict.fromkeys(ws[::-1])),d[end]
def near(lon,lat):return sorted(g,key=lambda k:dist(P[k],[(lon-121.522)*100650,-(lat-25.284)*111320]))[:8]
a=near(121.5219,25.2846);b=near(121.5684,25.29495)
opts=[r for s in a for e in b if (r:=route(s,e)) and r[2]<7000]
out=min(opts,key=lambda r:dist(P[r[0][0]],P[a[0]])+dist(P[r[0][-1]],P[b[0]]))
opts=[r for s in b for e in a if (r:=route(s,e)) and r[2]<7000]
back=min(opts,key=lambda r:dist(P[r[0][0]],P[b[0]])+dist(P[r[0][-1]],P[a[0]]))
hgt=gzip.decompress(pathlib.Path('source-data/N25E121.hgt.gz').read_bytes())
def elev(x,z):
 lon=x/100650+121.522;lat=25.284-z/111320
 row=max(0,min(3600,(26-lat)*3600));col=max(0,min(3600,(lon-121)*3600));j=int(row);i=int(col);u=col-i;v=row-j
 def sample(j,i):return max(0,struct.unpack_from('>h',hgt,2*(j*3601+i))[0])
 return (sample(j,i)*(1-u)+sample(j,min(3600,i+1))*u)*(1-v)+(sample(min(3600,j+1),i)*(1-u)+sample(min(3600,j+1),min(3600,i+1))*u)*v
def dense(ns):
 pts=[P[k] for k in ns];out=[]
 for a,b in zip(pts,pts[1:]):
  count=max(1,math.ceil(dist(a,b)/5))
  for i in range(count):out.append([a[0]+(b[0]-a[0])*i/count,a[1]+(b[1]-a[1])*i/count])
 out.append(pts[-1]);hs=[elev(*p) for p in out]
 # Initial 250m moving average; replaced below by the shared midpoint profile.
 hs=[sum(hs[max(0,i-25):i+26])/len(hs[max(0,i-25):i+26]) for i in range(len(hs))]
 return [[round(x,3),h+0.2,round(z,3)] for (x,z),h in zip(out,hs)]
routes=[dense(out[0]),dense(back[0])]
def cumulative(r):
 lengths=[0]
 for a,b in zip(r,r[1:]):lengths.append(lengths[-1]+math.hypot(b[0]-a[0],b[2]-a[2]))
 return lengths
def at(r,lengths,distance):
 import bisect
 i=max(0,min(len(r)-2,bisect.bisect_right(lengths,distance)-1));t=(distance-lengths[i])/(lengths[i+1]-lengths[i] or 1)
 return [r[i][k]+(r[i+1][k]-r[i][k])*t for k in range(3)]
lengths=[cumulative(r) for r in routes]
# This midpoint is an ESTIMATED grading reference, not a new driveable road.
center=[]
for p,d in zip(routes[0],lengths[0]):
 q=at(routes[1],lengths[1],lengths[1][-1]*(1-d/lengths[0][-1]));center.append([(p[0]+q[0])/2,0,(p[2]+q[2])/2])
raw_center=[elev(p[0],p[2])+.2 for p in center]
profile=[sum(raw_center[max(0,i-25):i+26])/len(raw_center[max(0,i-25):i+26]) for i in range(len(raw_center))]
initial_profile=profile[:]
projections=[]
for r in routes:
 projection=[]
 for p in r:
  best=(float('inf'),0,0)
  for i,(a,b) in enumerate(zip(center,center[1:])):
   dx,dz=b[0]-a[0],b[2]-a[2];t=max(0,min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz or 1)))
   d=math.hypot(p[0]-a[0]-dx*t,p[2]-a[2]-dz*t)
   if d<best[0]:best=(d,i,t)
  projection.append((best[1],best[2]))
 projections.append(projection)
constraints=[]
for i,(a,b) in enumerate(zip(center,center[1:])):constraints.append(({i:-1,i+1:1},math.hypot(b[0]-a[0],b[2]-a[2])*.06))
for r,projection in zip(routes,projections):
 for j,(a,b) in enumerate(zip(r,r[1:])):
  coef={}
  for sign,(i,t) in [(-1,projection[j]),(1,projection[j+1])]:
   coef[i]=coef.get(i,0)+sign*(1-t);coef[i+1]=coef.get(i+1,0)+sign*t
  constraints.append(({i:c for i,c in coef.items() if abs(c)>1e-12},math.hypot(b[0]-a[0],b[2]-a[2])*.06))
# Local cyclic projections; no global amplitude rescaling or flattening of low slopes.
for iteration in range(600):
 error=0
 for coef,limit in constraints:
  value=sum(profile[i]*c for i,c in coef.items());excess=abs(value)-limit
  if excess>1e-8:
   norm=sum(c*c for c in coef.values())
   if norm:
    correction=excess*(1 if value>0 else -1)/norm
    for i,c in coef.items():profile[i]-=correction*c
    error=max(error,excess)
 if error<1e-6:break
smoothed_diffs=[];raw_diffs=[];low_diffs=[]
for r,projection in zip(routes,projections):
 before=[initial_profile[i]*(1-t)+initial_profile[i+1]*t for i,t in projection]
 for j,(p,(i,t)) in enumerate(zip(r,projection)):
  p[1]=round(profile[i]*(1-t)+profile[i+1]*t,4);change=abs(p[1]-before[j]);smoothed_diffs.append(change);raw_diffs.append(abs(p[1]-.2-elev(p[0],p[2])))
  if j and abs(before[j]-before[j-1])/max(.001,math.hypot(p[0]-r[j-1][0],p[2]-r[j-1][2]))<.02:low_diffs.append(change)
for p,h in zip(center,profile):p[1]=round(h,4)
def stats(a):
 a=sorted(a);return {'max_m':max(a,default=0),'p95_m':a[min(len(a)-1,int(len(a)*.95))] if a else 0}
elevation_processing={'method':'Estimated midpoint of original directed carriageways; 250m DEM average; only local profile constraints on both projections','estimated':True,'soft_grade_goal':.06,'iterations':iteration+1,'residual_amplitude_factor':1,'difference_to_raw_dem':stats(raw_diffs),'difference_to_smoothed_dem':stats(smoothed_diffs),'low_initial_grade_under_2pct_change':stats(low_diffs),'actual_max_grade':[max(abs(b[1]-a[1])/math.hypot(b[0]-a[0],b[2]-a[2]) for a,b in zip(r,r[1:])) for r in routes]}
features=[]
for w,ids,t in ways:
 kind=''
 if t.get('ref')=='2' and t.get('highway')=='primary':kind='road'
 elif t.get('highway') in ['service','residential','living_street','unclassified','tertiary','secondary']:kind='access'
 elif 'building' in t:kind='building'
 elif t.get('amenity')=='parking':kind='parking'
 elif t.get('natural')=='beach':kind='beach'
 elif t.get('natural') in ['wood','scrub'] or t.get('landuse')=='forest':kind='wood'
 elif t.get('highway') in ['footway','path','steps']:kind='path'
 elif t.get('waterway') in ['stream','river']:kind='stream'
 elif t.get('natural')=='coastline':kind='coast'
 if kind and len(ids)>1:
  features.append({'id':w.attrib['id'],'type':'way','kind':kind,'tags':t,'source':{'url':'https://www.openstreetmap.org/'+('way' if w.tag=='way' else 'node')+'/'+w.attrib['id'],'date':'2026-10-22','license':'ODbL 1.0','timestamp':w.attrib.get('timestamp')},'nodeIds':ids,'points':[[round(P[k][0],3),round(elev(*P[k]),3),round(P[k][1],3)] for k in ids]})
for k,n in N.items():
 t=tags(n)
 if t.get('highway')=='bus_stop':features.append({'id':k,'type':'node','kind':'bus','tags':t,'source':{'url':'https://www.openstreetmap.org/node/'+k,'date':'2026-10-22','license':'ODbL 1.0','timestamp':n.attrib.get('timestamp')},'points':[[*([P[k][0],elev(*P[k]),P[k][1]])]]})
grid={'x':-1800,'z':-3400,'step':25,'nx':339,'nz':229}
grid['heights']=[round(elev(grid['x']+i*25,grid['z']+j*25),2) for j in range(grid['nz']) for i in range(grid['nx'])]
data={'elevationReference':center,'routes':routes,'routeSources':[{'nodeIds':out[0],'wayIds':out[1]},{'nodeIds':back[0],'wayIds':back[1]}],'features':features,'terrain':grid,'metadata':{'elevationProcessing':elevation_processing,'date':'2026-10-22','origin':[121.522,25.284],'osm':'https://api.openstreetmap.org/api/0.6/map?bbox=121.505,25.265,121.615,25.312','license':'ODbL 1.0','elevation':'Mapzen/Joerd Skadi N25E121; SRTM/GMTED2010/ETOPO1 courtesy USGS/NOAA; public domain per upstream attribution docs; not survey','estimates':['road width 8m per OSM carriageway','building heights default 6m','250m DEM average + estimated midpoint shared profile; local grading only; no global amplitude rescaling','terrain common road profile within 9m, blended to 48m; estimated']}}
pathlib.Path('public/data/world.json').write_text(json.dumps(data,separators=(',',':')))
print('route lengths',out[2],back[2],'features',len(features),'route nodes',len(out[0]))
