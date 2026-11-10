import json,math,datetime,html
from collections import Counter,defaultdict
m=json.load(open('bf/merged.json'));S=[s for s in json.load(open('stores_list.json')) if s['id'] not in ('hardoff-tsuyama-innosho','hardoff-kurashiki-nakasho')]
INPWA={'hobbyoff-himeji-mitachi','offhouse-himeji-nozato','hobbyoff-kobe-seiryodai','hardoff-sanda'}
SAME={'hardoff-himeji-mitachi':'與行程中的 Hobby Off 御立同一處','offhouse-himeji-mitachi':'與行程中的 Hobby Off 御立同一處','offhouse-kobe-seiryodai':'與行程中的 Hobby Off 星陵台同址'}
CATS=['玩具','公仔','3C','衣物配件','其他'];COL={'玩具':'#E89B00','公仔':'#D61F35','3C':'#1767B3','衣物配件':'#7B52AE','其他':'#8C8578'}
def pie(c,size=150):
    tot=sum(c.values());
    if not tot: return '<svg width="%d" height="%d"></svg>'%(size,size)
    r=size/2-2;cx=cy=size/2;a=-math.pi/2;out=[]
    for k in CATS:
        v=c.get(k,0)
        if not v: continue
        if v==tot: out.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{COL[k]}"><title>{k} {v}</title></circle>');break
        b=a+2*math.pi*v/tot;la=1 if b-a>math.pi else 0
        out.append(f'<path d="M{cx},{cy} L{cx+r*math.cos(a):.1f},{cy+r*math.sin(a):.1f} A{r},{r} 0 {la} 1 {cx+r*math.cos(b):.1f},{cy+r*math.sin(b):.1f} Z" fill="{COL[k]}" stroke="var(--card)" stroke-width="1.5"><title>{k} {v} 件（{v*100/tot:.0f}%）</title></path>');a=b
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{r*0.52:.1f}" fill="var(--card)"/><text x="{cx}" y="{cy-2}" text-anchor="middle" font-size="{size/7:.0f}" font-weight="700" fill="var(--ink)">{tot}</text><text x="{cx}" y="{cy+size/10:.0f}" text-anchor="middle" font-size="{size/13:.0f}" fill="var(--mute)">則</text>')
    return f'<svg viewBox="0 0 {size} {size}" width="{size}" height="{size}" role="img">{"".join(out)}</svg>'
def legend(c):
    tot=sum(c.values()) or 1
    return ''.join(f'<li><span class="sw" style="background:{COL[k]}"></span>{k}<b>{c.get(k,0)}</b><i>{c.get(k,0)*100/tot:.0f}%</i></li>' for k in CATS)
allc=Counter();rows=[]
for s in S:
    ps=[p for p in m if p['storeId']==s['id']]
    c=Counter(p['categories'][0] if len(p['categories'])==1 else p['categories'][0] for p in ps)  # primary category per post
    c=Counter()
    for p in ps:
        for k in p['categories']: c[k]+=1/len(p['categories'])
    c=Counter({k:round(v) for k,v in c.items()})
    allc.update(c)
    tags=Counter(t for p in ps for t in p['tags']).most_common(8)
    attrs=Counter(a for p in ps for a in p['attrs'] if a not in('收購情報','Offmall 上架')).most_common(4)
    names=Counter(p['name'] for p in ps if len(p['name'])>1).most_common(6)
    core=c['玩具']+c['3C']+c['衣物配件'];n=len(ps)
    rows.append(dict(s=s,n=n,c=c,tags=tags,attrs=attrs,names=names,core=core,share=core/n if n else 0,ps=ps))
rows.sort(key=lambda r:-r['core'])
def reco(r):
    s=r['s']
    if s['id'] in INPWA: return '<span class="pill in">已在行程</span>'
    if s['id'] in SAME: return f'<span class="pill same">{SAME[s["id"]]}，延長停留即可</span>'
    if r['core']>=40 and r['share']>=0.5: return '<span class="pill go">建議加入</span>'
    if r['core']>=20: return '<span class="pill maybe">可考慮</span>'
    return '<span class="pill no">量少</span>'
cards=[]
for r in rows:
    s=r['s'];e=html.escape
    thumbs=''.join(f'<a href="{p["imgs"][0]}" target="_blank" rel="noopener" title="{e(p["date"]+" "+p["name"])}"><img loading="lazy" src="{p["imgs"][0].replace("name=large","name=small")}" alt=""></a>' for p in [p for p in r['ps'] if p['imgs'] and p['categories'][0] in ('玩具','3C','衣物配件')][:6])
    cards.append(f'''<section class="card"><div class="hd"><div><h3>{e(s["name"])}</h3><div class="m">Day {s["day"]}・近 {e(s["near"])}・繞路約 {s["detourMin"]} 分</div></div>{reco(r)}</div>
<div class="body">{pie(r["c"],140)}<ul class="lg">{legend(r["c"])}</ul></div>
<div class="kv"><b>玩具＋3C＋衣物</b> {r["core"]} 則（{r["share"]*100:.0f}%）</div>
<div class="kv"><b>常見標籤</b> {"".join(f'<span class="tag">{e(t)} {n}</span>' for t,n in r["tags"]) or "—"}</div>
<div class="kv"><b>屬性</b> {"".join(f'<span class="tag a">{e(t)} {n}</span>' for t,n in r["attrs"]) or "—"}</div>
<div class="kv"><b>常見商品</b> {"、".join(e(t) for t,n in r["names"])}</div>
<div class="th">{thumbs}</div>
<div class="btns"><a href="https://www.google.com/maps/dir/?api=1&destination={s["lat"]},{s["lon"]}" target="_blank">導航</a><a href="https://x.com/{s["x"]}" target="_blank">看分店 X</a><button onclick="cp('{e(s["name"])} @{s["lat"]},{s["lon"]}')">📋 複製地點</button></div></section>''')
tot=len(m);now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).strftime('%Y-%m-%d %H:%M')
page=f'''<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>二手店商品分析</title>
<style>:root{{--bg:#F7F5F0;--card:#fff;--ink:#2B2A28;--mute:#8C8578;--line:#E3DED3}}@media (prefers-color-scheme:dark){{:root{{--bg:#1C1B19;--card:#262522;--ink:#EDE9E1;--mute:#A39D90;--line:#3A3833}}}}
*{{box-sizing:border-box}}body{{margin:0;font-family:-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif;background:var(--bg);color:var(--ink)}}
.wrap{{max-width:1100px;margin:0 auto;padding:16px}}h1{{font-size:20px;margin:0 0 4px}}.sub{{color:var(--mute);font-size:13px}}
.top{{display:flex;flex-wrap:wrap;gap:20px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:14px 0}}
.lg{{list-style:none;padding:0;margin:0;font-size:13px;min-width:150px}}.lg li{{display:flex;gap:6px;align-items:center;margin:3px 0}}.lg b{{margin-left:auto}}.lg i{{color:var(--mute);font-style:normal;width:38px;text-align:right}}
.sw{{width:10px;height:10px;border-radius:3px;display:inline-block}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}}.hd{{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}}
h3{{font-size:15px;margin:0}}.m{{font-size:12px;color:var(--mute);margin-top:2px}}.body{{display:flex;gap:14px;align-items:center;margin:10px 0}}
.kv{{font-size:12.5px;margin:5px 0;line-height:1.7}}.kv b{{color:var(--mute);font-weight:500;margin-right:4px}}
.tag{{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:0 7px;margin:0 3px 3px 0;font-size:12px}}.tag.a{{border-style:dashed}}
.pill{{font-size:11.5px;padding:3px 8px;border-radius:999px;white-space:nowrap}}.go{{background:#13804A;color:#fff}}.maybe{{background:#E89B00;color:#fff}}.in{{background:var(--line)}}.same{{background:#DCEAF7;color:#1767B3;white-space:normal;max-width:150px;text-align:center}}.no{{color:var(--mute);border:1px solid var(--line)}}
.th{{display:flex;gap:4px;flex-wrap:wrap;margin:8px 0}}.th a{{width:52px;height:52px;border-radius:6px;overflow:hidden;background:var(--line);display:block}}.th img{{width:100%;height:100%;object-fit:cover}}
.btns{{display:flex;gap:6px;flex-wrap:wrap}}.btns a,.btns button{{font-size:12px;padding:5px 9px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--ink);text-decoration:none;cursor:pointer}}
.note{{font-size:12px;color:var(--mute);margin-top:16px;line-height:1.7}}</style></head><body><div class="wrap">
<h1>沿路二手店・商品分析</h1><div class="sub">9/1–11/3・13 家分店 X・{tot} 則（已排除卡牌 120、遊戲軟體 104、問候 56）・更新 {now}</div>
<div class="top">{pie(allc,170)}<ul class="lg">{legend(allc)}</ul><div class="note" style="margin:0;max-width:420px">依「玩具＋3C＋衣物配件」貼文數排序。綠色＝件數 ≥40 且佔比 ≥50%，建議加入行程；橘色＝可考慮。一則貼文有多個分類時平均分配。縮圖點開是原圖。</div></div>
<div class="grid">{"".join(cards)}</div>
<div class="note">分類、標籤、屬性與「常見商品」都是用關鍵字從貼文文字自動抽出，少數可能不準。圖片從 X 載入，需要網路。</div></div>
<script>function cp(t){{(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>alert('已複製：'+t)).catch(()=>prompt('複製這段：',t))}}</script></body></html>'''
open('out/stats.html','w').write(page)
for r in rows: print(r['s']['name'][:14],r['n'],r['core'],f"{r['share']:.0%}",reco(r)[:60])
