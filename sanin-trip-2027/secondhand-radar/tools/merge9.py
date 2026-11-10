import json,re,datetime
from collections import Counter
TW=datetime.timezone(datetime.timedelta(hours=8))
A=json.load(open('/mnt/user-data/uploads/Downloads/radar_bf9_all.json'))
O=json.load(open('/mnt/user-data/uploads/Downloads/radar_bf_all.json'));H=json.load(open('/mnt/user-data/uploads/Downloads/radar_bf_hobbyoff_himeji.json'));O['hobbyoff_himeji']={'posts':H['posts']}
for k,v in O.items():
    ids={p['id'] for p in A.get(k,{'posts':[]})['posts']}
    for p in v['posts']:
        if p['id'] not in ids and k in A: A[k]['posts'].append(p)
stores=[x for x in json.load(open('stores_list.json')) if x['id'] not in ('hardoff-tsuyama-innosho','hardoff-kurashiki-nakasho')]
h2s={s['x'].lower():s for s in stores}
hist=json.load(open('out/history.json'))
old={p['url'].split('/status/')[1]:p for p in hist['posts']}
R=lambda p:re.compile(p,re.I)
CARD=R(r'カード|トレカ|ポケカ|デュエル・?マスターズ|デュエマ|遊[戯☆]王|ヴァイス|ユニオンアリーナ|ドラゴンボールヒーローズ|\bMTG\b|\bcards?\b|TCG|ストレージ|プレイマット|playmat|スリーブ|sleeve|PSA\d*|鑑定品|BOX買取|ローダー')
SOFT=R(r'(?<!ソ)ソフト(?!ビ|ケース|クリーム)|software|game titles?|titles? (?:have|has)|ゲームソフト|カセット|cartridge|体験版|\bROMs?\b|PS[1-5]のディスク|ディスクオフモール|Switch2? ?ver|Z2V|超武[闘鬪]伝|リズム天国|Dragon Quest [IVX]+|ドッジ弾平')
CAT={
'公仔':R(r'フィギュア|figure|一番くじ|ichiban ?kuji|景品|プライズ|prize|amiibo|ねんどろいど|nendoroid|figma|リーメント|re-?ment|缶バッジ|アクスタ|アクキー|アクリル|ぬいぐるみ|plush|マスコット|mascot|グッズ|merch|ちいかわ|chiikawa|サンリオ|sanrio|クロミ|kuromi|スヌーピー|snoopy|ワンピース|one piece|ドラゴンボール|dragon ball|ポケモン|pok[eé]mon|ウマ娘|鬼滅|呪術|ハンター|hunter ?x ?hunter|ガチャ|gacha|tiny agents|カチューシャ|キーリング|keychain|キーホルダー|ぬい|法被|カプセル|POP UP|ソフビ|ジオラマ|スタチュー|statue'),
'玩具':R(r'トミカ|tomica|プラレール|plarail|レゴ|lego|ベイブレード|beyblade|ミニカー|mini ?cars?|hot ?wheels|ホットウィール|プラモ|ガンプラ|gunpla|plastic model|ザク|ガンダム|gundam|ゾイド|zoids|超合金|変身|transformation|ベルト|dx|おもちゃ|玩具|toys?\b|鉄道模型|nゲージ|n gauge|ラジコン|rc car|トランスフォーマー|transformers?|ボードゲーム|board ?game|ジグソー|パズル|puzzle|シルバニア|sylvanian|リカちゃん|メダル|ゴチゾウ|なりきり|スケール|京商|kyosho|モデルガン|model gun|エアガン|ブロック|blocks?|ミニ四駆|mini 4wd|ゴライオン|ジャンボグレード|仮面ライダー|kamen rider|戦隊|ウルトラマン|ultraman|プリキュア|precure|たまごっち|tamagotchi|csm|ドライバー|driver|ダイの剣|laq|デアゴスティーニ|deagostini|ラブブ|labubu|シルバニア|けん玉|ヨーヨー|ポケパーク'),
'衣物配件':R(r'服|衣料|衣類|古着|ジャケット|jacket|コート|coat|ダウン|down jacket|パーカー|hoodie|シャツ|shirt|ニット|knit|セーター|sweater|スカート|skirt|パンツ|pants|デニム|denim|ジーンズ|jeans|スニーカー|sneaker|シューズ|shoes|靴|ブーツ|boots|サンダル|sandal|バッグ|バック|bags?\b|リュック|backpack|ポーチ|pouch|財布|wallet|帽子|キャップ|hat\b|cap\b|アクセサリー|accessor|ネックレス|necklace|指輪|ピアス|腕時計|wristwatch|ブランド|brand|ヴィトン|vuitton|coach|gucci|prada|chanel|hermes|エルメス|north ?face|ノースフェイス|patagonia|パタゴニア|モンベル|mont-?bell|columbia|アウター|outer|ベスト|vest|マフラー|scarf|手袋|gloves|着物|kimono|浴衣|salomon|nike|ナイキ|adidas|アディダス|new balance|ニューバランス|ベビーキャリア|ワンピース(?=.*(服|レディース))|レディース|メンズ|ladies|men\'?s|キッズ服|子供服|apparel|clothing|カーディガン|cardigan|fendi|ブローチ|brooch|ストール|ショール|ネクタイ|tie\\b|サングラス|sunglasses|ジュエリー|jewelry|ゴルフウェア'),
'3C':R(r'ゲーム機|本体|switch|スイッチ|ps[2-5]\b|プレステ|playstation|3ds|\bds\b|psp|vita|ファミコン|famicom|スーファミ|ゲームボーイ|game ?boy|セガ|sega|メガドライブ|コントローラー|controller|パソコン|\bpc\b|ノートpc|laptop|タブレット|tablet|ipad|iphone|スマホ|smartphone|カメラ|camera|レンズ|lens|一眼|オーディオ|audio|スピーカー|speaker|アンプ|amp\b|amplifier|ヘッドホン|イヤホン|headphone|earphone|ヘッドセット|headset|プレーヤー|player|ウォークマン|walkman|レコーダー|recorder|テレビ|\btv\b|モニター|monitor|家電|appliance|電子レンジ|炊飯器|掃除機|vacuum|ドライヤー|dryer|冷蔵庫|洗濯機|扇風機|ヒーター|heater|ストーブ|ワープロ|word processor|プリンター|printer|ミキサー|mixer|サウンドバー|soundbar|pixel|smart ?watch|ラジカセ|radio|ラジオ|ビデオデッキ|vhs|dvdドライブ|マウス|mouse|キーボード|keyboard|シュレッダー|shredder|双眼鏡|binocular|ゲーミング|gaming|apple ?watch|アップルウォッチ|ジャンク|junk|ネオジオ|neo ?geo|pcケース|デジカメ|ビデオカメラ|camcorder|ドクターエア|マッサージ|電動|充電|bluetooth'),
}
HIT=[('滑雪盆',R(r'ソリ|そり|スノーボート|snow ?sled|\bsled')),('雪球夾',R(r'雪玉|スノーボールメーカー|ゆきだま|snowball')),('Sacoche',R(r'サコッシュ|sacoche|山と道|yamatomichi')),('帆布包',R(r'帆布|キャンバス(?:バッグ|トート)|canvas')),('鋼筆文具',R(r'万年筆|fountain pen|文房具|文具|stationery')),('柯南',R(r'コナン|conan')),('寶可夢',R(r'ポケモン|pok[eé]mon|ピカチュウ|pikachu')),('絣',R(r'絣|かすり'))]
GREET=R(r'^(?:[\W\s]*(?:こんばんは|こんにちは|こんにちわ|おはようございます|good (?:evening|morning|afternoon)|hello|hi|ウホウホ|うほうほ|uhouho|ooh ooh)[!！。.,、♪～〜ー\s]*)+')
INTRO=R(r'^(?:this is |it\'s |here is |we are )?[^。！!.\n]{0,25}(?:店です|店でございます|店より|(?:store|shop)(?: here)?[!！.。])[!！。.♪\s]*')
NOISE=R(r'営業中|営業時間|スタッフ(?:大)?募集|求人|recruit|臨時休業|定休|お休み|閉店|open for business|we\'re open|instagram|インスタ')
def clean(t):
    t=re.sub(r'#\S+','',t);t=re.sub(r'https?://\S+|\S+\.(?:jp|com)/\S*','',t);t=re.sub(r'\s+',' ',t).strip()
    for _ in range(2): t=GREET.sub('',t).strip(); t=INTRO.sub('',t).strip()
    t=re.sub(r'^[\\/【】\s!！]+','',t)
    return t
TAGS=[('Tomica',r'トミカ|tomica'),('Plarail 火車',r'プラレール|plarail'),('LEGO',r'レゴ|lego'),('戰鬥陀螺',r'ベイブレード|beyblade'),('Hot Wheels',r'hot ?wheels|ホットウィール'),('鋼彈/模型',r'ガンプラ|gunpla|ガンダム|gundam|ザク|プラモ|plastic model'),('比例模型',r'スケール|京商|kyosho|1/\d{2}'),('假面騎士',r'仮面ライダー|kamen rider|csm|ドライバー'),('超級戰隊',r'戦隊|sentai'),('超人力霸王',r'ウルトラマン|ultraman'),('變形金剛',r'トランスフォーマー|transformers?'),('鐵道模型',r'nゲージ|鉄道模型|n gauge'),('迷你四驅',r'ミニ四駆|mini 4wd'),('模型槍',r'モデルガン|エアガン|model gun'),('桌遊/拼圖',r'ボードゲーム|board ?game|パズル|puzzle|ジグソー'),('Sylvanian',r'シルバニア|sylvanian'),('寶可夢',r'ポケモン|pok[eé]mon|ピカチュウ|pikachu'),('七龍珠',r'ドラゴンボール|dragon ?ball'),('航海王',r'ワンピース(?!.*(服|ドレス))|one piece'),('鬼滅之刃',r'鬼滅|demon slayer'),('咒術迴戰',r'呪術'),('火影',r'ナルト|naruto'),('名偵探柯南',r'コナン|conan'),('吉卜力',r'ジブリ|ghibli|トトロ|totoro|ラピュタ'),('三麗鷗',r'サンリオ|sanrio|キティ|kitty|クロミ|kuromi|マイメロ|melody|シナモロール|ハンギョドン|ポムポムプリン'),('吉伊卡哇',r'ちいかわ|chiikawa'),('史努比',r'スヌーピー|snoopy|peanuts'),('迪士尼',r'ディズニー|disney|ミッキー|mickey'),('賽馬娘',r'ウマ娘|uma musume'),('EVA',r'エヴァ|evangelion'),('初音未來',r'初音ミク|hatsune'),('一番賞',r'一番くじ|ichiban'),('景品',r'景品|プライズ|prize'),('amiibo',r'amiibo'),('Re-Ment',r'リーメント|re-?ment'),('黏土人',r'ねんどろいど|nendoroid'),('絨毛玩偶',r'ぬいぐるみ|plush|マスコット|mascot'),('扭蛋',r'ガチャ|gacha|カプセル'),('壓克力/徽章',r'アクスタ|アクキー|アクリル|缶バッジ|acrylic|badge'),('Switch',r'switch|スイッチ'),('PlayStation',r'ps[2-5]\b|プレステ|playstation|psp|vita'),('任天堂掌機',r'3ds|\bds\b|ゲームボーイ|game ?boy'),('懷舊主機',r'ファミコン|famicom|スーファミ|メガドライブ|セガ|sega|ネオジオ|neo ?geo|64'),('相機/鏡頭',r'カメラ|camera|レンズ|lens|一眼'),('音響',r'オーディオ|audio|スピーカー|speaker|アンプ|amp\b|ヘッドホン|イヤホン|headphone|サウンドバー|ミキサー|mixer|レコード|record'),('電腦/手機',r'apple ?watch|パソコン|\bpc\b|laptop|ipad|iphone|スマホ|タブレット|tablet|モニター'),('家電',r'家電|電子レンジ|炊飯器|掃除機|ドライヤー|冷蔵庫|洗濯機|扇風機|ヒーター|ストーブ'),('樂器',r'ギター|guitar|ベース|bass|ドラム|drum|キーボード|ピアノ|ウクレレ|エフェクター|木琴'),('戶外品牌',r'north ?face|ノースフェイス|patagonia|パタゴニア|モンベル|mont-?bell|columbia|salomon|arc.?teryx|アークテリクス|snow ?peak|スノーピーク|coleman|コールマン'),('精品',r'ヴィトン|vuitton|coach|gucci|prada|chanel|hermes|エルメス|fendi|burberry|バーバリー|ロレックス|rolex|tiffany|ティファニー|ブランド'),('運動鞋',r'スニーカー|sneaker|nike|ナイキ|adidas|new balance|ニューバランス|asics|アシックス'),('外套',r'ジャケット|jacket|コート|coat|ダウン|アウター|outer|パーカー|hoodie|ベスト'),('包包',r'バッグ|バック|\bbags?\b|リュック|backpack|ポーチ|pouch|トート|tote|サコッシュ'),('童裝/嬰兒',r'キッズ|子供服|ベビー|baby|kids'),('餐具/廚具',r'食器|皿|カップ|マグ|鍋|土鍋|グラス|tableware'),('聖誕/季節',r'クリスマス|christmas|ハロウィン|halloween|お正月|雛'),('文具',r'万年筆|文房具|文具|stationery|ボールペン|fountain pen')]
TAGS=[(n,R(p)) for n,p in TAGS]
ATTR=[('未開封',r'未開封|unopened|sealed'),('未使用/新品',r'未使用|新品|unused|brand new'),('Junk',r'ジャンク|junk'),('盒裝',r'箱あり|箱付|box(?:ed)? '),('無盒',r'箱無し|箱なし|loose|boxless'),('限定',r'限定|limited'),('特價',r'特価|セール|sale|値下|半額|% ?off|割引'),('大量到貨',r'大量|多数|たくさん|lots of|large (?:number|quantity|shipment)|a ton of'),('收購情報',r'買取|purchase|bought|buy'),('Offmall 上架',r'オフモール|offmall')]
ATTR=[(n,R(p)) for n,p in ATTR]
def pname(raw,tags):
    m=re.search(r'[「『【]([^」』】]{2,30})[」』】]',raw)
    if m and not re.search(r'入荷|情報|お知らせ|ポケモンカード|デュエル',m.group(1)): return m.group(1)
    m=re.search(r'([A-Za-z0-9\u30A0-\u30FF\u4E00-\u9FFF・ー\-\s]{3,28}?)(?:が|を|の)?(?:入荷|納車|買取|arrived|in stock)',clean(raw))
    if m: return m.group(1).strip(' のをが')
    return '・'.join(tags[:3]) if tags else clean(raw)[:24]
def murl(f):
    i,e=f.rsplit('.',1);return f"https://pbs.twimg.com/media/{i}?format={e}&name=large"
now=datetime.datetime.now(TW).isoformat(timespec='seconds')
out=[];drop=Counter();kept=Counter()
for handle,blk in A.items():
    s=h2s.get(handle.lower())
    if not s: print('no store',handle);continue
    for p in blk['posts']:
        url=f"https://x.com/{s['x']}/status/{p['id']}"
        raw=p['x']; dt=datetime.datetime.fromisoformat(p['t'].replace('Z','+00:00')).astimezone(TW)
        if dt.date()<datetime.date(2026,9,1): continue
        if CARD.search(raw): drop['卡牌']+=1;continue
        if SOFT.search(raw): drop['遊戲軟體']+=1;continue
        cats=[k for k,r in CAT.items() if r.search(raw)]
        imgs=[murl(f) for f in p['i']]
        if not cats:
            if NOISE.search(raw) or not imgs or len(clean(raw))<12 or re.search(r'オフモール(?:を)?更新|お待ちしております$',clean(raw)): drop['問候/無商品']+=1;continue
            cats=['其他']
        hit=[n for n,r in HIT if r.search(raw)]
        tags=[n for n,r in TAGS if r.search(raw)];attrs=[n for n,r in ATTR if r.search(raw)]
        o=old.get(p['id'])
        hl=o['highlight'] if o else clean(raw)[:60]
        out.append(dict(storeId=s['id'],url=url,date=dt.strftime('%Y-%m-%d'),categories=o['categories'] if o else cats,highlight=hl,hit=hit,imgCount=len(imgs) or (o['imgCount'] if o else 0),imgs=imgs or (o.get('imgs',[]) if o else []),seenAt=o['seenAt'] if o else now,name=pname(raw,tags),tags=tags,attrs=attrs,text=clean(raw)[:200],src='backfill' if not o else 'daily'))
        for c in out[-1]['categories']: kept[c]+=1
# existing posts not in bf data (none expected) -> keep if not software/cards by highlight
ids={x['url'] for x in out}
for p in hist['posts']:
    if p['url'] not in ids:
        print('old not in bf:',p['url'],p['highlight'])
out.sort(key=lambda x:(x['date'],x['url']),reverse=True)
print('kept',len(out),dict(kept),'dropped',dict(drop))
print('hits',Counter(h for x in out for h in x['hit']))
json.dump(out,open('bf/merged.json','w'),ensure_ascii=False)
