#!/usr/bin/env python3
# IG 貼文 → 分類後併入 history.json（與 X 去重）
import json, re, sys, difflib, datetime as dt
SRC = open('merge.py', encoding='utf-8').read().split('\nvmap = {}')[0]
exec(SRC)  # 取得 VEN, CATS, classify, dates, TAGS, CLOSE_RE, CLOSE_EXCL, GREET, TRIP0, TRIP1
IGRAW = sys.argv[1] if len(sys.argv) > 1 else '/mnt/user-data/uploads/Downloads/kids_ig_all.json'
IGMAP = {'kobe_kagakukan':'bando-kobe','kobe_animalkingdom':'kobe-animal','kobe_sumasea':'suma-sea','toysrus_jp':'toysrus-kobe',
 'arimatoys':'arima-toys','sakyu_visitor':'tottori-sakyu','tottori_sandmuseum':'sand-museum','kanikkokan_official':'kanikko',
 'warabekan_official':'warabe','gamf_hokuei':'conan','kurakagaku':'kurakagaku','himejicastle_operations_office':'himeji-castle',
 'kobe_maritime_m':'kobe-maritime','hcpsafari':'himeji-cp','hcpeast':'himeji-cp','japan_toy_museum':'toy-museum'}
V = {v['id']: v for v in VEN}
for v in VEN: v['ig'] = []
for acc, vid in IGMAP.items():
    for v in VEN:
        if v['id'] == vid or (vid == 'toysrus-kobe' and v['id'].startswith('toysrus')): v['ig'].append(acc)
H = json.load(open('history.json'))
X = [p for p in H['posts'] if p.get('platform', 'x') == 'x']
for p in X: p['platform'] = 'x'; p['platforms'] = ['x']
ig = json.load(open(IGRAW))
TOK = re.compile(r'\d{1,2}[/月]\d{1,2}日?|\d{1,2}:\d{2}|\d[\d,]{2,}')
def toks(t): return set(re.sub(r'月', '/', re.sub(r'日', '', x)) for x in TOK.findall(t))
new, dup = [], 0
for acc, blk in ig.items():
    v = V[IGMAP[acc]]; typ = v['type']
    vx = [p for p in X if p['handle'] in [h.lower() for h in v['x']]]
    for p in blk['posts']:
        x = re.sub(r'\\n|\s+', ' ', p['cap']).strip()
        date = p['date']
        if not date: continue
        if not p.get('pin') and date < '2026-10-01': continue
        greet = bool(GREET.match(x)) or len(x) < 12
        ds = dates(x, date)
        cats = ['其他'] if greet else classify(x, typ)
        closing = bool(CLOSE_RE.search(x)) and not (CLOSE_EXCL.search(x) and not re.search(r'休館|臨時休|休園', x))
        if closing and '休館・營業資訊' in CATS[typ] and '休館・營業資訊' not in cats:
            cats = (['休館・營業資訊'] + [c for c in cats if c != '其他'])[:2]
        tags = [n for n, rx in TAGS if rx.search(x)]
        ev = [d for d in ds if d[1] >= date and d[0] <= '2027-06-30']
        intrip = any(a <= TRIP1 and b >= TRIP0 for a, b in ev)
        if any(a <= '2027-01-31' and b >= '2027-01-01' for a, b in ev): tags.insert(0, '1月有效')
        url = f'https://www.instagram.com/{acc}/{p["code"]}/'
        d0 = dt.date.fromisoformat(date); tk = toks(x); match = None
        for q in vx:
            if abs((dt.date.fromisoformat(q['date']) - d0).days) > 1: continue
            r = difflib.SequenceMatcher(None, x[:120], q['text'][:120]).ratio()
            qt = toks(q['text']); sh = tk & qt
            if q.get('_m'): continue
            if r >= 0.6 or (len(sh) >= 2 and len(sh) / max(1, min(len(tk), len(qt))) >= 0.5):
                    match = q; break
        if not match:
            # 同一天只剩一則 X、一則 IG 都還沒配對時，視為同一則（跨平台同步發文）
            sameX = [q for q in vx if q['date'] == date and not q.get('_m')]
            sameI = [r_ for r_ in blk['posts'] if r_['date'] == date]
            if len(sameX) == 1 and len(sameI) == 1: match = sameX[0]
        if match:
            match['_m'] = 1; dup += 1; match['platforms'] = ['x', 'ig']; match['igUrl'] = url
            if p['th'] and not match.get('imgs'): match['th'] = p['th']
            for t in tags:
                if t not in match['tags']: match['tags'].append(t)
            if intrip and not match['inTrip']: match['inTrip'] = True; match['eventFrom'] = min(a for a,b in ev); match['eventTo'] = max(b for a,b in ev)
            continue
        m = re.match(r'^[^\w]*[【「『]([^】」』]{2,40})[】」』]', x)
        new.append(dict(venueId=v['id'], type=typ, handle=acc, url=url, date=date, pinned=bool(p.get('pin')),
            categories=cats, tags=tags, name=m.group(1) if m else '', eventFrom=min((a for a,b in ev), default=None),
            eventTo=max((b for a,b in ev), default=None), ranges=ev, inTrip=intrip, closure=closing, greet=greet,
            text=x[:400], imgs=[], th=p['th'], platform='ig', platforms=['ig'], seenAt=dt.datetime.now().isoformat(timespec='seconds'), src='ig'))
for q in X: q.pop('_m', None)
posts = X + new
posts.sort(key=lambda p: (p['date'], p['url']), reverse=True)
H['posts'] = posts
H['runs'].append({'at': dt.datetime.now().isoformat(timespec='seconds'), 'src': IGRAW, 'igNew': len(new), 'igDup': dup})
json.dump(H, open('history.json', 'w'), ensure_ascii=False, indent=0)
json.dump(VEN, open('venues.json', 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print('ig new', len(new), 'dup', dup, 'total', len(posts))
print(Counter(p['handle'] for p in new))
print('inTrip', sum(p['inTrip'] for p in posts), 'closure', sum(p['closure'] for p in posts))
