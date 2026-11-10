import json,re,datetime,difflib
from collections import Counter
src=open('merge9.py').read().split('\nnow=')[0]
src=src.replace("A=json.load(open('/mnt/user-data/uploads/Downloads/radar_bf9_all.json'))","A={}").replace("O=json.load(open('/mnt/user-data/uploads/Downloads/radar_bf_all.json'));H=json.load(open('/mnt/user-data/uploads/Downloads/radar_bf_hobbyoff_himeji.json'));O['hobbyoff_himeji']={'posts':H['posts']}","O={}")
exec(src)
IGMAP={'offhouse_kakogawabefu':'offhouse-kakogawa-befu','offhouse_kobeseiryoudai':'offhouse-kobe-seiryodai','offhouse_nozato':'offhouse-himeji-nozato','hobbyoff_suzurandai':'hardoff-kobe-suzurandai'}
X=json.load(open('bf/merged.json'))
for p in X: p['platforms']=['x']
D=json.load(open('/mnt/user-data/uploads/Downloads/radar_ig_all.json'))
drop=Counter();new=[];dup=0
def norm(t): return re.sub(r'[\s#＃!！。、♪✨😊]+','',clean(t))[:40]
for acc,blk in D.items():
    sid=IGMAP[acc]
    xs=[p for p in X if p['storeId']==sid]
    for p in blk['posts']:
        raw=p['cap'].replace('\\n',' ')
        if CARD.search(raw): drop['卡牌']+=1;continue
        if SOFT.search(raw): drop['遊戲軟體']+=1;continue
        cats=[k for k,r in CAT.items() if r.search(raw)]
        if not cats:
            if NOISE.search(raw) or len(clean(raw))<12: drop['問候/無商品']+=1;continue
            cats=['其他']
        url=f"https://www.instagram.com/{acc}/{p['code']}/"
        d0=datetime.date.fromisoformat(p['date']);n=norm(raw);match=None
        for x in xs:
            if abs((datetime.date.fromisoformat(x['date'])-d0).days)<=1:
                if difflib.SequenceMatcher(None,n,norm(x.get('text') or x['highlight'])).ratio()>=0.6: match=x;break
        if match:
            dup+=1;match['platforms']=sorted(set(match['platforms']+['ig']));match['igUrl']=url
            if p['th'] and not match.get('imgs'): match['th']=p['th']
            continue
        tags=[n_ for n_,r in TAGS if r.search(raw)];attrs=[n_ for n_,r in ATTR if r.search(raw)];hit=[n_ for n_,r in HIT if r.search(raw)]
        new.append(dict(storeId=sid,url=url,date=p['date'],categories=cats,highlight=clean(raw)[:60],hit=hit,imgCount=1 if p['th'] else 0,imgs=[],th=p['th'],name=pname(raw,tags),tags=tags,attrs=attrs,text=clean(raw)[:200],platforms=['ig'],src='ig'))
allp=X+new;allp.sort(key=lambda x:(x['date'],x['url']),reverse=True)
print('ig kept new',len(new),'dup',dup,'dropped',dict(drop),'total',len(allp))
print(Counter(p['storeId'] for p in new))
json.dump(allp,open('bf/merged_xig.json','w'),ensure_ascii=False)
