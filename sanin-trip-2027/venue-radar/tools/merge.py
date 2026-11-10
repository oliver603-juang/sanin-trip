#!/usr/bin/env python3
# 親子場館雷達：分類、標籤、日期、休館警示 → history.json
import json, re, sys, datetime as dt
RAW = sys.argv[1] if len(sys.argv) > 1 else '/mnt/user-data/uploads/Downloads/venue_bf_all.json'
VEN = json.load(open('venues.json'))
raw = json.load(open(RAW))
TRIP0, TRIP1 = '2027-01-25', '2027-01-30'

CATS = {
 'museum': ['企劃展・特展', '工作坊・體驗', '館內活動・表演', '商店・周邊限定', '休館・營業資訊', '其他'],
 'park_fun': ['遊樂設施', '季節活動（冬季、雪）', '角色・表演', '餐飲・限定商品', '營業・天候・雪況', '其他'],
 'outdoor': ['景色・雪景', '活動・祭典', '設施開放・整修', '天候・交通', '其他'],
 'kids': ['體驗・工作坊', '室內遊戲', '展示', '預約・營業資訊', '其他'],
 'toy': ['新品到貨', '限定・抽選', '活動・體驗會', '特價', '其他'],
}
I = re.I
K = lambda *a: re.compile('|'.join(a), I)
CLOSE_RE = K(r'休館', r'臨時休', r'休園', r'冬季休', r'点検', r'メンテナンス', r'運休', r'閉館', r'閉園', r'営業休止',
             r'temporar\w* clos', r'notice of (temporary )?closure', r'closure day', r'will be closed', r'closed (all day|on|from|for)',
             r'\bclosed\b(?! the gates)', r'inspection', r'suspend(ed|ing)? (operation|business)', r'maintenance (closure|work)')
CLOSE_EXCL = K(r'homepage|website|HP|ホームページ|ウェブサイト|サイト', r'closed day', r'closely', r'closing hours', r'closed the gates', r'閉門')
R = {
 'museum': [
  ('企劃展・特展', K(r'企画展', r'特別展', r'特展', r'展示中', r'開催中の展', r'exhibition', r'on display', r'\bexhibit', r'原画展', r'展覧会', r'restoration figure', r'ミニ展示', r'sand sculpt')),
  ('工作坊・體驗', K(r'ワークショップ', r'体験', r'工作', r'教室', r'workshop', r'hands-on', r'experience', r'making', r'craft', r'実験', r'experiment', r'participants?', r'参加者', r'recruit', r'募集', r'lecture', r'講座')),
  ('館內活動・表演', K(r'イベント', r'event', r'show', r'ショー', r'プラネタリウム', r'planetarium', r'観望', r'observation', r'festival', r'フェスティバル', r'talk', r'signing', r'サイン会', r'ステージ', r'performance', r'tour', r'ガイド', r'lottery', r'抽選', r'entry ticket')),
  ('商店・周邊限定', K(r'グッズ', r'goods', r'限定', r'limited', r'ショップ', r'(?<!work)shop', r'販売', r'on sale', r'souvenir', r'merch', r'ガチャ', r'gacha')),
  ('休館・營業資訊', K(r'休館', r'開館', r'営業', r'business hours', r'opening hours', r'clos', r'open as usual', r'notice', r'お知らせ', r'駐車', r'parking', r'混雑', r'crowd', r'new location', r'移転', r'営業時間')),
 ],
 'park_fun': [
  ('季節活動（冬季、雪）', K(r'christmas', r'クリスマス', r'winter', r'冬', r'雪', r'snow(?! leopard)', r'ski', r'スキー', r'sled', r'そり', r'illumination', r'イルミ', r'new year', r'正月', r'halloween', r'ハロウィン')),
  ('角色・表演', K(r'performance', r'パフォーマンス', r'ショー', r'\bshow\b', r'stadium', r'orca', r'シャチ', r'dolphin', r'イルカ', r'stroll', r'character', r'キャラクター', r'idol', r'feeding', r'ごはん', r'エサ', r'baby', r'赤ちゃん', r'あかちゃん', r'birthday', r'誕生日')),
  ('遊樂設施', K(r'workshop', r'ワークショップ', r'体験', r'experience', r'escape game', r'謎解き', r'making', r'attraction', r'アトラクション', r'ride', r'遊園地', r'amusement', r'safari', r'サファリ', r'pool', r'プール', r'course', r'コース', r'lift', r'リフト', r'kids park', r'キッズ')),
  ('餐飲・限定商品', K(r'buffet', r'dinner', r'lunch', r'menu', r'メニュー', r'food', r'グルメ', r'café', r'cafe', r'カフェ', r'restaurant', r'レストラン', r'goods', r'グッズ', r'限定', r'limited', r'(?<!work)shop\b', r'ショップ', r'fair trade', r'hotel', r'ホテル')),
  ('營業・天候・雪況', K(r'営業', r'operating', r'business', r'clos', r'休園', r'天候', r'weather', r'雪況', r'積雪', r'snow (condition|depth)', r'notice', r'お知らせ', r'parking', r'駐車', r'ticket', r'チケット', r'season pass', r'reservation', r'予約', r'homepage', r'website')),
 ],
 'outdoor': [
  ('天候・交通', K(r'weather', r'天気', r'rain', r'雨', r'wind', r'風', r'storm', r'嵐', r'台風', r'forecast', r'予報', r'temperature', r'気温', r'parking', r'駐車', r'交通', r'traffic', r'bus', r'バス', r'混雑', r'crowd')),
  ('設施開放・整修', K(r'renewal', r'リニューアル', r'construction', r'工事', r'整備', r'repair', r'修理', r'clos', r'休園', r'開園', r'opening', r'open', r'reservation', r'予約', r'admission', r'入園', r'homepage', r'website', r'crowdfunding')),
  ('活動・祭典', K(r'event', r'イベント', r'festival', r'祭', r'まつり', r'halloween', r'ハロウィン', r'christmas', r'クリスマス', r'workshop', r'ワークショップ', r'体験', r'guide', r'ガイド', r'tour', r'ツアー', r'stamp', r'スタンプ', r'day\b', r'記念日', r'campaign')),
  ('景色・雪景', K(r'scenery', r'景色', r'view', r'sunset', r'夕日', r'夕焼', r'sky', r'空', r'snow', r'雪', r'flower', r'花', r'autumn leaves', r'紅葉', r'photo', r'写真', r'dune', r'砂丘', r'beautiful', r'きれい', r'綺麗', r'moon', r'月', r'animal', r'giraffe', r'キリン', r'elephant', r'ゾウ', r'panda', r'パンダ', r'#', r'meal', r'nap')),
 ],
 'kids': [
  ('體驗・工作坊', K(r'ワークショップ', r'体験', r'工作', r'making', r'workshop', r'experience', r'craft', r'作り', r'つくり', r'strap', r'ストラップ', r'participants', r'参加')),
  ('室內遊戲', K(r'遊び', r'あそび', r'play', r'game', r'ゲーム', r'クイズ', r'quiz', r'touch', r'タッチ', r'ふれあい', r'puzzle')),
  ('展示', K(r'展示', r'exhibit', r'display', r'水槽', r'tank', r'crab', r'カニ', r'かに', r'蟹', r'fish', r'魚', r'ranch', r'牧場', r'couple')),
  ('預約・營業資訊', K(r'休館', r'開館', r'clos', r'予約', r'reservation', r'営業', r'business hours', r'notice', r'お知らせ', r'あいてます', r'open')),
 ],
 'toy': [
  ('限定・抽選', K(r'限定', r'limited', r'exclusive', r'抽選', r'lottery', r'予約', r'pre-?order', r'reservation', r'先行')),
  ('活動・體驗會', K(r'イベント', r'event', r'体験会', r'campaign', r'キャンペーン', r'contest', r'コンテスト', r'present', r'プレゼント', r'giveaway', r'follow')),
  ('特價', K(r'sale\b(?! to)', r'セール', r'特価', r'割引', r'discount', r'% ?off', r'お得', r'値下', r'point', r'ポイント', r'black friday', r'ブラックフライデー', r'coupon', r'クーポン')),
  ('新品到貨', K(r'on sale', r'now on sale', r'発売', r'new', r'新商品', r'新発売', r'入荷', r'arriv', r'release', r'登場', r'check out', r'item')),
 ],
}
TAGS = [
 ('雪', K(r'雪(?!豹)', r'snow(?! leopard| globe)', r'スキー', r'\bski', r'スノー')),
 ('科學', K(r'科学', r'science', r'実験', r'experiment', r'天文', r'planetarium', r'プラネタリウム', r'astronom', r'化石', r'fossil', r'恐竜', r'dinosaur', r'robot', r'ロボット')),
 ('天文', K(r'天文', r'planetarium', r'プラネタリウム', r'astronom', r'星空', r'starry', r'観望', r'eclipse', r'日食', r'月食', r'meteor')),
 ('恐龍・化石', K(r'恐竜', r'dinosaur', r'化石', r'fossil', r't-?rex', r'ティラノ')),
 ('鐵道', K(r'鉄道', r'railway', r'電車', r'\btrains?\b', r'新幹線', r'shinkansen', r'プラレール', r'plarail', r'列車')),
 ('LEGO', K(r'lego', r'レゴ')),
 ('寶可夢', K(r'pok[eé]mon', r'ポケモン', r'ピカチュウ', r'pikachu')),
 ('柯南', K(r'conan', r'コナン', r'青山', r'aoyama', r'gosho')),
 ('動漫・角色', K(r'kamen rider', r'仮面ライダー', r'anime', r'アニメ', r'disney', r'ディズニー', r'toy story', r'トイ・ストーリー', r'tomica', r'トミカ', r'sanrio', r'サンリオ', r'ultraman', r'ウルトラマン', r'gundam', r'ガンダム', r'mario', r'マリオ', r'beyblade', r'ベイブレード')),
 ('動物', K(r'animal', r'動物', r'giraffe', r'キリン', r'elephant', r'ゾウ', r'panda', r'パンダ', r'penguin', r'ペンギン', r'orca', r'シャチ', r'dolphin', r'イルカ', r'capybara', r'カピバラ', r'sloth', r'ナマケモノ', r'crab', r'カニ', r'かに', r'shoebill', r'ハシビロコウ', r'koala', r'コアラ', r'lion', r'ライオン', r'tiger', r'トラ')),
 ('尋寶・解謎', K(r'謎', r'mystery', r'treasure', r'宝探し', r'stamp rally', r'スタンプラリー', r'quiz', r'クイズ', r'探検', r'謎解き', r'escape game')),
 ('工作', K(r'工作', r'craft', r'making', r'作り', r'つくり', r'workshop', r'ワークショップ', r'diy')),
 ('免費', K(r'無料', r'free of charge', r'(?<!-)\bfree\b(?! time)', r'admission[- ]free', r'観覧無料', r'入場無料', r'参加費.{0,4}無料')),
 ('需預約', K(r'要予約', r'事前申込', r'事前予約', r'申込', r'予約', r'reservation', r'apply', r'application', r'lottery', r'抽選', r'定員', r'recruit', r'募集', r'pre-?registration')),
 ('冬休み', K(r'冬休み', r'winter (break|vacation|holiday)', r'年末年始', r'new year')),
 ('聖誕', K(r'christmas', r'クリスマス', r'xmas')),
 ('適合小學生', K(r'小学生', r'elementary', r'こども', r'子ども', r'子供', r'children', r'kids', r'キッズ', r'親子', r'family', r'ファミリー', r'自由研究', r'小学')),
]
GREET = K(r'^(good (morning|night|evening)|おはよう|おやすみ|こんばんは|こんにちは)[!！ 。.\w]{0,30}$')
MON = {m: i+1 for i, m in enumerate(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'])}

def year_for(m, post):
    py, pm = int(post[:4]), int(post[5:7])
    return py + 1 if m < pm - 2 else py

def dates(text, post):
    """Return list of (from,to) ISO strings."""
    t = text
    out = []
    def mk(y, m, d):
        try: return dt.date(y, m, d).isoformat()
        except Exception: return None
    pts = []  # (pos, iso)
    # 2027年1月25日 / 1月25日 / 令和9年1月11日
    for m in re.finditer(r'(?:(20\d\d)年|令和(\d+)年)?\s*(\d{1,2})月(\d{1,2})日', t):
        y = int(m.group(1)) if m.group(1) else (2018 + int(m.group(2)) if m.group(2) else year_for(int(m.group(3)), post))
        d = mk(y, int(m.group(3)), int(m.group(4)))
        if d: pts.append((m.start(), m.end(), d))
    # 2027/1/25  1/25(土)  12/20
    for m in re.finditer(r'(?<![\d/(（])(?:(20\d\d)[/.])?(\d{1,2})/(\d{1,2})(?![\d/)）])', t):
        mo, da = int(m.group(2)), int(m.group(3))
        if not (1 <= mo <= 12 and 1 <= da <= 31): continue
        y = int(m.group(1)) if m.group(1) else year_for(mo, post)
        d = mk(y, mo, da)
        if d: pts.append((m.start(), m.end(), d))
    # January 25, 2027 / Jan. 25 / December 19 (Sat), 20 (Sun)
    for m in re.finditer(r'\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*\([^)]{1,12}\))?(?:,?\s*(?:Reiwa\s*(\d+)|(20\d\d)))?', t, I):
        mo = MON[m.group(1).lower()]; da = int(m.group(2))
        y = int(m.group(4)) if m.group(4) else (2018 + int(m.group(3)) if m.group(3) else year_for(mo, post))
        d = mk(y, mo, da)
        if d: pts.append((m.start(), m.end(), d))
    # 10/1 written as "October 1st" covered; "the 25th" ignored
    pts.sort()
    # dedupe overlapping
    clean = []
    for p in pts:
        if clean and p[0] < clean[-1][1]: continue
        clean.append(p)
    i = 0
    RANGE = re.compile(r'^\s*(\([^)]{1,12}\))?\s*(～|〜|~|－|-|–|—|から|to|until|through|thru)\s*', I)
    while i < len(clean):
        a = clean[i]
        if i + 1 < len(clean) and RANGE.match(t[a[1]:clean[i+1][0]]) and clean[i+1][2] >= a[2]:
            out.append((a[2], clean[i+1][2])); i += 2; continue
        # "until X" / "まで"
        pre = t[max(0, a[0]-12):a[0]]; post_ = t[a[1]:a[1]+8]
        if re.search(r'(until|through|till|～|〜|~)\s*$', pre, I) or re.match(r'\s*(\([^)]{1,12}\))?\s*(まで|迄)', post_):
            out.append((post[:10], a[2]))
        else:
            out.append((a[2], a[2]))
        i += 1
    return out

def classify(text, typ):
    hits = [c for c, rx in R[typ] if rx.search(text)]
    return hits[:2] if hits else ['其他']

vmap = {}
for v in VEN:
    for h in v['x']:
        vmap.setdefault(h.lower(), []).append(v)
posts = []
for h, blob in raw.items():
    for p in blob['posts']:
        x = re.sub(r'https:// ', 'https://', p['x']).strip()
        date = (dt.datetime.fromisoformat(p['t'].replace('Z', '+00:00')) + dt.timedelta(hours=9)).date().isoformat()
        if not p['p'] and date < '2026-10-01': continue
        if not x and not p['i']: continue
        greet = bool(len(x) < 130 and re.match(r'^(check|click|details?|for (more )?details|詳細|詳しく)', x, I) and 'http' in x) or bool(GREET.match(x)) or (len(x) < 25 and not p['i'] and not re.search(r'\d', x))
        for v in vmap.get(h, [])[:1]:
            typ = v['type']
            ds = dates(x, date)
            cats = ['其他'] if greet else classify(x, typ)
            closing = bool(CLOSE_RE.search(x)) and not (CLOSE_EXCL.search(x) and not re.search(r'休館|臨時休|休園|temporar\w* clos|closure day|notice of closure', x, I))
            if closing and typ in CATS and '休館・營業資訊' in CATS[typ] and '休館・營業資訊' not in cats:
                cats = (['休館・營業資訊'] + [c for c in cats if c != '其他'])[:2]
            tags = [n for n, rx in TAGS if rx.search(x)]
            ev = [d for d in ds if d[1] >= date and d[0] <= '2027-06-30']  # future-ish dates only
            evf = min((d[0] for d in ev), default=None); evt = max((d[1] for d in ev), default=None)
            intrip = any(a <= TRIP1 and b >= TRIP0 for a, b in ev)
            jan = any(a <= '2027-01-31' and b >= '2027-01-01' for a, b in ev)
            if jan: tags.insert(0, '1月有效')
            if v['id'].startswith('toysrus') and False: pass
            hl = re.sub(r'\s+', ' ', x)
            m = re.match(r'^[【\[「『]([^】\]」』]{2,40})[】\]」』]', hl)
            name = m.group(1) if m else ''
            if not name:
                m = re.search(r'[「『"“]([^」』"”]{3,40})[」』"”]', hl)
                name = m.group(1) if m else ''
            posts.append(dict(venueId=v['id'], type=typ, handle=h, url=f'https://x.com/{h}/status/{p["id"]}', date=date,
                pinned=bool(p['p']), categories=cats, tags=tags, name=name, eventFrom=evf, eventTo=evt,
                ranges=ev, inTrip=intrip, closure=closing, greet=greet, text=hl[:400],
                imgs=[f'https://pbs.twimg.com/media/{i.rsplit(".",1)[0]}?format={i.rsplit(".",1)[1]}&name=large' for i in p['i']],
                video=p.get('v', 0), seenAt=dt.datetime.now().isoformat(timespec='seconds'), src='backfill'))
posts.sort(key=lambda p: (p['venueId'], p['date']), reverse=True)
json.dump({'runs': [{'at': dt.datetime.now().isoformat(timespec='seconds'), 'from': '2026-10-01', 'posts': len(posts), 'src': RAW}], 'posts': posts},
          open('history.json', 'w'), ensure_ascii=False, indent=0)
from collections import Counter
print(len(posts), 'posts')
print('inTrip', sum(p['inTrip'] for p in posts), 'closure', sum(p['closure'] for p in posts), 'greet', sum(p['greet'] for p in posts))
for v in VEN:
    ps = [p for p in posts if p['handle'] in [x.lower() for x in v['x']]]
    c = Counter(c for p in ps for c in p['categories'])
    print(v['id'], len(ps), dict(c))
