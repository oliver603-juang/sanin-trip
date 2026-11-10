import json,datetime as dt,os
R=json.load(open('/mnt/user-data/uploads/sanin-trip-2027/secondhand-radar/tools/route.json'))
V=json.load(open('venues.json'));H=json.load(open('history.json'))
keep=['handle','url','date','pinned','categories','tags','name','eventFrom','eventTo','inTrip','closure','greet','text','imgs','platform','platforms','igUrl','th']
P=[{k:p[k] for k in keep if p.get(k) not in (None,'',[]) or k in ('categories','tags','platforms','text','date','handle','url')} for p in H['posts']]
for p in P: p['text']=p['text'][:260]
up=dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat(timespec='minutes')
tpl=open('map_tpl.html',encoding='utf-8').read()
HOTEL=['多美迎','Green Rich','萬翠樓','Royal Art','里士滿']
def emb(route,noindex):
  d='const ROUTE='+json.dumps(route,ensure_ascii=False)+';\nconst VENUES='+json.dumps(V,ensure_ascii=False)+';\nconst POSTS='+json.dumps(P,ensure_ascii=False)+';\nconst UPDATED="'+up+'";'
  s=tpl.replace('/*DATA*/',d)
  return s.replace('<!--NOINDEX-->','<meta name="robots" content="noindex,nofollow">' if noindex else '')
open('map.html','w').write(emb(R,False))
R2=[dict(d,pts=[p for p in d['pts'] if not any(h in p['name'] for h in HOTEL)]) for d in R]
os.makedirs('share',exist_ok=True)
open('share/index.html','w').write(emb(R2,True))
print(os.path.getsize('map.html'),sum(len(d['pts']) for d in R)-sum(len(d['pts']) for d in R2),'hotel pts removed')
