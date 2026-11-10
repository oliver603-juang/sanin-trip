# 親子場館雷達：交接

> 更新：2026-11-04（台灣時間）。抓取方法沿用 `secondhand-radar\HANDOFF.md` §6。

## 檔案（venue-radar\）
- `venues.json`：21 個場館（13 個 X 帳號以外另有共用帳號，共 21 個帳號）。欄位有 id、name、type、x[]、lat、lon、day、near、detourMin、inTrip、alerts[]。
- `history.json`：{runs, posts}，10/1–11/3 共 659 則。每則貼文以 handle 為準，不重複；同一個帳號對應多家店的情況（例如トイザらス 3 店）由地圖端合併。
- `map.html`：完整版地圖。`share\index.html`：分享版，拿掉 5 晚住宿站點，加了 noindex。`share\sanin-kids.zip`：上傳用的壓縮檔。
- `tools\`：`def_venue.js`（抓取器，截止 2026-09-30T15:00，key 是 venue_bf，保留置頂貼文）、`merge.py`（分類、標籤、日期、休館警示）、`build.py`、`map_tpl.html`。

## 場館
- **行程中有 X 的**：神戸科学館、六甲山スノーパーク、有馬玩具博物館、鳥取砂丘（@Sakyu_visitor＋@tottori_saq）、砂の美術館、かにっこ館、わらべ館、青山剛昌ふるさと館、倉敷科学センター、姫路城、神戸海洋博物館。
- **沿途新增**：王子動物園、神戸どうぶつ王国、須磨シーワールド、人と自然の博物館、明石天文科学館、姫路セントラルパーク（2 個帳號）、日本玩具博物館、トイザらス 神戸、倉敷、岡山（全國帳號 @toysrus_jp）。
- **沒有 X、所以不顯示**：倉吉ふるさと工芸館、津山まなびの鉄道館、桃太郎のからくり博物館、岡山市水道記念館、岡電ミュージアム。
- **排除**：姫路科学館（8/11 後沒發文）、こどもの館（2021 年停更）、さじアストロパーク、花回廊（超出範圍）、@kawasakiGTworld（2012 年停更）。

## 人工警示（venues.json 的 alerts，來源是官網，不是 X）
- 青山剛昌ふるさと館：現館 2027/1/11 閉館，新館春天開。周邊商店 1/14–2/28 營業。
- 砂の美術館：第 17 期展到 1/3。換期休館是推測的，要再確認。
- 日本玩具博物館：行程期間展出「未・羊の郷土玩具」＋常設展。
- トイザらス：撤出日本，由唐吉訶德收購，門市可能有變動。

## 注意
- X 的介面語言會讓很多貼文自動翻成英文（659 則裡只有 117 則是日文原文），所以 `merge.py` 的關鍵字是中英日都有。
- 抽查 20 則，分類大約 8 成正確。
- X 的 People 搜尋大約 35 次就會被限流 15 分鐘以上。用 `history.pushState` 換頁會一直出錯，要整頁 navigate。
- 更新步驟：抓取 → 存到 localStorage → 到 robots.txt 下載 → stage → `python3 merge.py <json>` → `python3 build.py` → zip → 在 Cloudflare 上傳。

## Instagram（2026-11-04 加入）
- **IG 帳號**（16 個，記在 venues.json 的 `ig[]`）：kobe_kagakukan、kobe_animalkingdom、kobe_sumasea、toysrus_jp（3 間店共用）、arimatoys、sakyu_visitor、tottori_sandmuseum、kanikkokan_official、warabekan_official、gamf_hokuei、kurakagaku、himejicastle_operations_office、kobe_maritime_m、hcpsafari、hcpeast、japan_toy_museum。
- **沒納入**：rokkosan_snow_park（2026/3 之後沒更新，12 月開季後再看）、kobeojizoo（2025/2 停更）、oji_zoo_goodsshop（商店帳號）、mainichi_tottori_sakyu（2024 停更）。ひとはく、明石天文科學館找不到 IG。
- **抓取工具**：`tools\ig_kids.js`。從二手店的 ig.js 改來，改動如下：
  - localStorage 的 key 改成 `kids_ig`、`kq_*`。
  - 截止日改成 10/1。
  - 縮圖改成 160px、品質 0.62，避免超過 localStorage 5MB 的上限。
  - 最前面 3 則就算是舊貼文也保留，標成 pin，這樣置頂的舊貼文不會讓抓取提早停下來。
  - 先用 `__igcollect()` 收集貼文代碼，每次最多 60 個。
- **結果**：10/1 起 IG 共 242 則（含置頂），其中跟 X 重複 82 則，新增 160 則。合併後總共 819 則。
- **去重**：`tools\merge_ig_kids.py`。X 有八成的貼文被自動翻成英文，所以除了文字相似度，另外加了兩條規則：
  - 日期、時間、金額這類數字有一半以上相同。
  - 同一天 X 和 IG 各只有一則還沒配對的。
  - 抽查 12 組，大約 10 組配對正確。
- **IG 帶來的新增**：神戸どうぶつ王国 36、わらべ館 22、日本玩具博物館 19、須磨シーワールド 18、姫路セントラルパーク 19。有馬玩具博物館的 X 已經停更，**只有 IG 有新貼文**。
- **地圖**：
  - 篩選列加了「平台：全部／只看 X／只看 IG」。
  - 卡片會顯示「X 限定／IG 限定／兩邊都有」各幾則，以及 X、IG 帳號按鈕。
  - IG 縮圖是 dataURL，所以分享版也能顯示。
- **更新步驟**：
  1. `python3 merge.py <X json>`
  2. `python3 merge_ig_kids.py <IG json>`
  3. `python3 build.py`
