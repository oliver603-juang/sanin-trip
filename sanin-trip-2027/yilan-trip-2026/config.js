// ==========================================
// config.js - 2026 宜蘭頭城親子 2 日（11/22 日 – 11/23 一）
// 來源：Google 我的地圖「Day 1 2026/11/22-23 頭城」(18 點) ＋ OA Hotel 訂房信
// 程式底版：sanin-trip v35（山陰版）→ 台灣版：拿掉日本專用（免稅比價、匯率、租車、航班、雪況、羅盤）
// ==========================================

// 1. APP 基本設定
window.TRIP_ID = "2026-yilan-1122";
window.TRIP_YEAR = 2026;
window.TRIP_START = [2026, 10, 22]; // 11/22（月份 0 起算）
window.START_LABEL = "🏠 台北出發";
window.METRO_COLORS = ["#1767B3", "#13804A"];
window.METRO_TINTS = ["#B9D2EA", "#A9D6BB"];
window.METRO_ON = ["#FFFFFF", "#FFFFFF"];
window.APP_TITLE = "2026 宜蘭頭城親子 2 日";
window.APP_LOGO = "icon-192.png";
window.DEFAULT_CURRENCY = "TWD";
window.BASE_CUR = { code: "TWD", sym: "NT$", label: "台幣" }; // 記帳、票價、統計都以台幣入帳
window.CURRENCY_OPTIONS = [{ code: "TWD", symbol: "NT$", label: "台幣" }];
window.STAY_OPTIONS = ["0 min", "20 min", "30 min", "40 min", "50 min", "1 hr", "1.5 hr", "2 hr", "2.5 hr", "3 hr", "Overnight", "-"];

// 台灣版功能開關（app.js 會讀）
window.FEATURES = { compare: false, compass: false, snow: false, jpDesk: false, rental: false, flight: false, currency: false, highway: true };

// AI 提示詞的地區脈絡（取代山陰版寫死的「日本山陰山陽冬季」）
window.AI_CONTEXT = {
  region: "台灣宜蘭（頭城・礁溪・羅東）親子自駕 2 日",
  country: "台灣",
  officialSrc: "中文官網、Facebook 粉絲專頁與 Google 地圖最新評論",
  year: 2026,
  monthNote: "11 月下旬（東北季風、宜蘭多雨）",
  seasonRule: "11/22 是週日、11/23 是週一：請特別確認週一公休與 DIY 是否需預約；臨時公告沒公布就依固定公休日判斷並加「（依固定公休）」。",
  geoHint: "本行程只在宜蘭縣頭城鎮、礁溪鄉、五結鄉、羅東鎮一帶，請確認找到的店家位於宜蘭縣境內（同名他縣分店不算）",
  radarRole: "台灣在地親子活動情報員",
  radarSources: "宜蘭勁好玩（yilan.travel）、蘭陽博物館官網、Accupass、宜蘭縣政府文化局、羅東文化工場、頭城鎮公所、各觀光工廠官網與 FB 粉專",
  radarLang: "中文",
  radarTypes: "親子手作體驗、觀光工廠 DIY、博物館特展、市集、農場活動",
  emergency: "台灣緊急電話：警察 110・救護／消防 119・1968 國道路況。鄰近醫院：國立陽明交大附醫（宜蘭市 03 932 5192）、羅東博愛醫院（03 954 3131）。",
};

// 🛣️ 國 5 雪隧（取代雪況卡）：出門時間、壅塞時段、高乘載管制
window.HIGHWAY_INFO = {
  title: "國 5 雪隧",
  outbound: { day: "11/22（日）", leave: "05:40", note: "國 3 → 國 5，07:00 前過南港系統。週日南下 07:30 起開始塞，08:00 後雪隧前常回堵到南港。" },
  inbound: { day: "11/23（一）", leave: "15:00", note: "週一下午北上順暢，約 80 分到家。高乘載管制只在例假日 15:00–20:00（宜蘭／羅東／蘇澳北上入口需 3 人以上，你們 4 人不受影響）。" },
  links: [
    { name: "1968 即時路況（高公局）", url: "https://1968.freeway.gov.tw/", icon: "🛣️" },
    { name: "國 5 雪隧即時影像", url: "https://1968.freeway.gov.tw/cctv", icon: "📹" },
    { name: "中央氣象署 宜蘭預報", url: "https://www.cwa.gov.tw/V8/C/W/County/County.html?CID=10002", icon: "🌦️" },
  ],
};
window.ROUTE_RISK_LABEL = "國5";

// 退房檢查（清單分頁「🎒 行前與退房檢核」）
window.CHECKOUT_ITEMS = ["手機・錢包・車鑰匙", "充電線・行動電源", "泳裝（風呂後容易忘在浴室）", "小孩外套・拖鞋", "玩沙工具・濕衣袋", "冰箱裡的宵夜飲料", "地下停車場取車"];
window.LIST_TITLE = "🍜 必吃小吃與全聯採買";

// 返家倒數（取代還車倒數）：最後一天進入「北返」前幾站時顯示
window.RETURN_INFO = { matchRe: "北返|返家|回家", deadline: "16:30", label: "到家", lateText: "（目標 15:00 從羅東上國 5、16:30 前到家）", fuelNote: "上國 5 前在羅東加油" };

// 午餐卡文案（取代すき家）
window.LUNCH_UI = { hint: "平價小吃／麵店，點這裡看順路店家", chainName: "在地小吃", nearQ: "小吃 麵店", nearLabel: "找沿路小吃", takeoutQ: "7-ELEVEN 全家", takeoutLabel: "超商簡餐" };

// 2. 主行程資料（Day 1 13 站・Day 2 7 站）
window.RAW_KML_DATA = [
  {
    dayId: "day1", date: "11/22 (日)", title: "頭城海線", themeColor: "bg-[#A2C4C9]", defaultStart: "05:40",
    spots: [
      { sid: "y001", name: "🏠 家出發（大同區延平北路）", lat: 25.0665753, lon: 121.5104712, desc: "台北市大同區延平北路三段104巷3之2號1樓。05:40 出門，走國 3 接國 5，07:00 前過南港系統避開週日南下車潮。", mapCode: "", driveTime: "", defaultStay: "0 min", ticket: { adult: 0, child: 0, locked: true } },
      { sid: "y002", name: "頭城瑞麟美又美早餐店", lat: 24.856801, lon: 121.822895, desc: "早餐。備案：對面龍記牛肉麵（吉祥路 13 號，07:50 起）、阿嬤蔥油餅（頂埔三和路 18 號，08:00）、九號咖啡外澳館（海景，08:00）。", mapCode: "", driveTime: "", defaultStay: "40 min", ticket: { adult: 0, child: 0 } },
      { sid: "y003", name: "頭城運動公園", lat: 24.8755321, lon: 121.8248098, desc: "放電第一站。免費停車，大草皮、蜂巢滑梯與攀爬網。玩到 08:50 再去 09:00 開館的蘭陽博物館。", mapCode: "", driveTime: "", defaultStay: "1.5 hr", ticket: { adult: 0, child: 0, locked: true } },
      { sid: "y004", name: "蘭陽博物館", lat: 24.868656, lon: 121.832741, desc: "09:00 開館（週三休）。常設展山之層、海之層、兒童考古探索廳，冷氣遮雨。距 OA Hotel 2 分鐘。", mapCode: "", driveTime: "", defaultStay: "2 hr", ticket: { adult: 0, child: 0 } },
      { sid: "y005", name: "礁溪 湯圍溝公園", lat: 24.8290203, lon: 121.7692101, desc: "免費泡腳池，填掉博物館到午餐的空檔。帶小毛巾。", mapCode: "", driveTime: "", defaultStay: "1.5 hr", ticket: { adult: 0, child: 0, locked: true } },
      { sid: "y006", name: "玉仁八寶冬粉 1號店", lat: 24.822923, lon: 121.771539, desc: "午餐。同一條街：柯氏蔥油餅（礁溪路四段 128 號）、吳記花生捲冰淇淋。", mapCode: "", driveTime: "", defaultStay: "1 hr", ticket: { adult: 0, child: 0 } },
      { sid: "y007", name: "步行到 柯氏蔥油餅＋吳記花生捲冰淇淋", lat: 24.82125, lon: 121.769825, desc: "午餐第二攤，邊走邊吃。", mapCode: "", driveTime: "", defaultStay: "30 min", ticket: { adult: 0, child: 0 } },
      { sid: "y008", name: "OA Hotel 烏石港（寄行李）", lat: 24.871532, lon: 121.839582, desc: "14:30 先寄行李，15:00 後進房。烏石港路 301 號，連大烏石港度假村左手邊黑色建築，地下停車場。訂房 BBA26082421210011（陳榮芳）03 977 1166。", mapCode: "", driveTime: "", defaultStay: "20 min", ticket: { adult: 0, child: 0, locked: true } },
      { sid: "y009", name: "外澳沙灘", lat: 24.877811, lon: 121.843071, desc: "玩沙踏浪。飯店後方過馬路即到，有沖腳區。帶玩沙工具、換洗衣物。", mapCode: "", driveTime: "", defaultStay: "1.5 hr", ticket: { adult: 0, child: 0, locked: true } },
      { sid: "y009b", name: "OA Hotel 沖洗換衣（寄行李）", lat: 24.871532, lon: 121.839582, desc: "沙灘回來先回房沖洗換衣，17:20 前出發去老街。", mapCode: "", driveTime: "", defaultStay: "30 min", ticket: { adult: 0, child: 0, locked: true } },
      { sid: "y010", name: "頭城老街：品誼古早味小吃", lat: 24.85805, lon: 121.822837, desc: "晚餐。米粉羹、春捲、臭豆腐，營業至 18:30（沙成路 50 號）。備案：瑞宏麻醬麵（青雲路三段 123 號，至 19:00）。老街小吃多在 19:00–19:30 打烊，17:30 前一定要到。", mapCode: "", driveTime: "", defaultStay: "1 hr", ticket: { adult: 0, child: 0 } },
      { sid: "y011", name: "步行到 聯發芋冰老店", lat: 24.857527, lon: 121.825442, desc: "飯後：土芭樂冰、芋頭冰（青雲路三段 190 號）。", mapCode: "", driveTime: "", defaultStay: "15 min", ticket: { adult: 0, child: 0 } },
      { sid: "y012", name: "全聯福利中心 頭城青雲店", lat: 24.859195, lon: 121.826559, desc: "回飯店前買宵夜零食、隔天早上要喝的。", mapCode: "", driveTime: "", defaultStay: "25 min", ticket: { adult: 0, child: 0, locked: true } },
      { sid: "y013", name: "OA Hotel 烏石港", lat: 24.871532, lon: 121.839582, desc: "海景風呂 16:00–23:00（22:30 最後入場），入住當日免費，要帶泳裝。不提供牙刷、牙膏、梳子、拖鞋。", mapCode: "", driveTime: "", defaultStay: "Overnight", ticket: { adult: 0, child: 0, locked: true, note: "已訂房" } },
    ],
  },
  {
    dayId: "day2", date: "11/23 (一)", title: "五結・羅東", themeColor: "bg-[#A9BFA8]", defaultStart: "08:00",
    spots: [
      { sid: "y014", name: "OA Hotel 早餐", lat: 24.871532, lon: 121.839582, desc: "早餐時段 06:30–08:00／08:00–09:30（人多時加開 09:30–11:00）。", mapCode: "", driveTime: "", defaultStay: "1 hr", ticket: { adult: 0, child: 0, locked: true } },
      { sid: "y015", name: "步行到 外澳沙灘（退房前再玩）", lat: 24.877811, lon: 121.843071, desc: "10:40 回房收拾，11:00 前退房。", mapCode: "", driveTime: "", defaultStay: "1.5 hr", ticket: { adult: 0, child: 0, locked: true } },
      { sid: "y016", name: "OA Hotel 退房・取車", lat: 24.871532, lon: 121.839582, desc: "11:00 前退房，地下停車場取車。", mapCode: "", driveTime: "", defaultStay: "20 min", ticket: { adult: 0, child: 0, locked: true } },
      { sid: "y017", name: "玉兔鉛筆學校", lat: 24.692823, lon: 121.7648874, desc: "五結中興路三段 330 號。DIY 鉛筆、導覽約 90 分，需預約（03 965 3670）。週一是否開放請先按「查核本站」。備案：菓風糖果工房（員山）、亞典蛋糕密碼館（宜蘭市）、國立傳藝中心（五結）。", mapCode: "", driveTime: "", defaultStay: "1.5 hr", ticket: { adult: 0, child: 0 } },
      { sid: "y018", name: "羅東 林場肉羹", lat: 24.6823653, lon: 121.7713492, desc: "午餐，平價小吃。中正北路 109 號。", mapCode: "", driveTime: "", defaultStay: "50 min", ticket: { adult: 0, child: 0 } },
      { sid: "y019", name: "步行到 羅東林業文化園區", lat: 24.6829939, lon: 121.7730403, desc: "免費散步，貯木池、森林鐵路。15:00 前回車上。", mapCode: "", driveTime: "", defaultStay: "40 min", ticket: { adult: 0, child: 0, locked: true } },
      { sid: "y020", name: "🏠 北返到家", lat: 25.0665753, lon: 121.5104712, desc: "15:00 從羅東上國 5 北上，週一下午順暢，約 16:20 到家。", mapCode: "", driveTime: "", defaultStay: "0 min", ticket: { adult: 0, child: 0, locked: true } },
    ],
  },
];

// 真實車程（分鐘／公里），key = 「上一站→下一站」
window.DRIVE_BUFFER_MIN = 3;
window.DRIVE_TIMES = {
  "🏠 家出發（大同區延平北路）→頭城瑞麟美又美早餐店": { min: 50, km: 58 },
  "頭城瑞麟美又美早餐店→頭城運動公園": { min: 6, km: 2.3 },
  "頭城運動公園→蘭陽博物館": { min: 6, km: 2.5 },
  "蘭陽博物館→礁溪 湯圍溝公園": { min: 20, km: 11 },
  "礁溪 湯圍溝公園→玉仁八寶冬粉 1號店": { min: 4, km: 1.2 },
  "步行到 柯氏蔥油餅＋吳記花生捲冰淇淋→OA Hotel 烏石港（寄行李）": { min: 22, km: 13 },
  "OA Hotel 烏石港（寄行李）→外澳沙灘": { min: 3, km: 0.8 },
  "外澳沙灘→OA Hotel 沖洗換衣（寄行李）": { min: 3, km: 0.8 },
  "OA Hotel 沖洗換衣（寄行李）→頭城老街：品誼古早味小吃": { min: 8, km: 3.5 },
  "步行到 聯發芋冰老店→全聯福利中心 頭城青雲店": { min: 3, km: 0.6 },
  "全聯福利中心 頭城青雲店→OA Hotel 烏石港": { min: 6, km: 2.4 },
  "OA Hotel 退房・取車→玉兔鉛筆學校": { min: 32, km: 24 },
  "玉兔鉛筆學校→羅東 林場肉羹": { min: 8, km: 2.8 },
  "步行到 羅東林業文化園區→🏠 北返到家": { min: 80, km: 75 },
};

window.WISHLIST_DATA = [];
// 4. 備用餐廳（平價小吃，午餐卡「順路」用）
window.BACKUP_RESTAURANTS = [
  { name: "玉仁八寶冬粉 1號店（礁溪）", lat: 24.822923, lon: 121.771539, mapCode: "" },
  { name: "樂屋日本料理（頭城火車站旁）", lat: 24.857186, lon: 121.822426, mapCode: "" },
  { name: "林場肉羹（羅東）", lat: 24.6823653, lon: 121.7713492, mapCode: "" },
  { name: "品誼古早味小吃（頭城老街）", lat: 24.85805, lon: 121.822837, mapCode: "" },
];

// 5. 航班／租車：台灣自駕沒有
window.FLIGHT_INFO = null;
window.CAR_RENTAL_INFO = null;

// 6. 住宿資訊
window.HOTEL_INFO = [
  { day: "11/22", name: "OA Hotel 烏石港", location: "烏石港", desc: "海景風呂、地下停車場", lat: 24.871532, lon: 121.839582, mapCode: "",
    jpName: "", zip: "261004", jpAddress: "宜蘭縣頭城鎮烏石港路 301 號", tel: "03-977-1166",
    booking: { via: "官網訂房（BBA26082421210011，陳榮芳）", room: "含早餐房型", guests: "2 大 2 小（9、11 歲）", checkIn: "15:00（14:30 可先寄行李）", checkOut: "11:00", price: 0, pay: "尚未扣款，現場結", cancelBy: "依訂房信" },
    note: "海景風呂 16:00–23:00（22:30 最後入場）入住當日免費，要帶泳裝。早餐 06:30–08:00／08:00–09:30。不提供牙刷、牙膏、梳子、棉花棒、刮鬍刀、浴帽、拖鞋。全館禁菸、禁空拍機。加棉被 $200／枕頭 $100／浴巾 $50。導航：國 5 頭城交流道右轉 → 青雲路 → 過蘭陽博物館 → 港口路右轉 → 烏石港路左轉 → 連大烏石港度假村左手邊黑色建築。" },
];

// 6-1. 出發前核對清單（台灣親子版）
window.CHECKLIST = [
  { id: "hotel", title: "OA Hotel 不提供的備品（一定要自己帶）", icon: "🏨", items: [
    { id: "toothbrush", text: "牙刷、牙膏（4 人份）", critical: true },
    { id: "slippers", text: "拖鞋（4 雙）", critical: true },
    { id: "comb", text: "梳子、棉花棒、刮鬍刀" },
    { id: "swim", text: "泳裝（海景風呂 16:00–23:00 要穿）", critical: true },
    { id: "towel", text: "小毛巾（礁溪泡腳、沙灘沖腳用）" },
  ] },
  { id: "beach", title: "外澳沙灘", icon: "🏖️", items: [
    { id: "sandtoys", text: "玩沙工具、水桶", critical: true },
    { id: "change", text: "小孩換洗衣物、拖鞋、大塑膠袋裝濕衣" },
    { id: "sun", text: "防曬、帽子、防風外套（11 月東北季風）" },
  ] },
  { id: "car", title: "開車", icon: "🚗", items: [
    { id: "etc", text: "ETC 餘額足夠（國 5 來回）", critical: true },
    { id: "fuel", text: "出門前油箱加滿" },
    { id: "booking", text: "OA 訂房信截圖（BBA26082421210011）", critical: true },
    { id: "cash", text: "現金（老街小吃多半只收現金）", critical: true },
    { id: "charger", text: "手機車充、行動電源" },
  ] },
  { id: "day2", title: "Day 2", icon: "✏️", items: [
    { id: "pencil", text: "玉兔鉛筆學校 DIY 預約確認（03 965 3670）", critical: true },
    { id: "rain", text: "雨具（宜蘭 11 月下雨機率高）" },
  ] },
];
const e = React.createElement;
window.Icons = {
  Plane: (p) =>
    e(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: 24,
        height: 24,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        ...p,
      },
      e("path", { d: "M2 12h5" }),
      e("path", { d: "M13 12h3" }),
      e("path", {
        d: "M19.74 7.33a2.3 2.3 0 0 1 2.93 2.93l-3.33 3.33a2.3 2.3 0 0 1-3.25 0l-7.34-7.34a2.3 2.3 0 0 1 0-3.25l3.33-3.33z",
      }),
      e("path", { d: "M14.66 14.66 9 22H2l2.5-9" }),
      e("path", { d: "M7 17l-5 5" })
    ),
  Smile: (p) =>
    e(
      "svg",
      { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p },
      e("circle", { cx: 12, cy: 12, r: 10 }),
      e("path", { d: "M8 14s1.5 2 4 2 4-2 4-2" }),
      e("line", { x1: 9, x2: 9.01, y1: 9, y2: 9 }),
      e("line", { x1: 15, x2: 15.01, y1: 9, y2: 9 })
    ),
  List: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("line", { x1: 8, x2: 21, y1: 6, y2: 6 }), e("line", { x1: 8, x2: 21, y1: 12, y2: 12 }), e("line", { x1: 8, x2: 21, y1: 18, y2: 18 }), e("line", { x1: 3, x2: 3.01, y1: 6, y2: 6 }), e("line", { x1: 3, x2: 3.01, y1: 12, y2: 12 }), e("line", { x1: 3, x2: 3.01, y1: 18, y2: 18 })),
  LayoutGrid: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("rect", { width: 7, height: 7, x: 3, y: 3, rx: 1 }), e("rect", { width: 7, height: 7, x: 14, y: 3, rx: 1 }), e("rect", { width: 7, height: 7, x: 14, y: 14, rx: 1 }), e("rect", { width: 7, height: 7, x: 3, y: 14, rx: 1 })),
  Calculator: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("rect", { width: 16, height: 20, x: 4, y: 2, rx: 2 }), e("line", { x1: 8, x2: 16, y1: 6, y2: 6 }), e("line", { x1: 16, x2: 16, y1: 14, y2: 18 }), e("path", { d: "M16 10h.01" }), e("path", { d: "M12 10h.01" }), e("path", { d: "M8 10h.01" }), e("path", { d: "M12 14h.01" }), e("path", { d: "M8 14h.01" }), e("path", { d: "M12 18h.01" }), e("path", { d: "M8 18h.01" })),
  Clock: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("circle", { cx: 12, cy: 12, r: 10 }), e("polyline", { points: "12 6 12 12 16 14" })),
  Wallet: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M21 12V7H5a2 2 0 0 1 0-4h14v4" }), e("path", { d: "M3 5v14a2 2 0 0 0 2 2h16v-5" }), e("path", { d: "M18 12a2 2 0 0 0 0 4h4v-4Z" })),
  MapPin: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" }), e("circle", { cx: 12, cy: 10, r: 3 })),
  Ticket: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" }), e("path", { d: "M13 5v2" }), e("path", { d: "M13 17v2" }), e("path", { d: "M13 11v2" })),
  X: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M18 6 6 18" }), e("path", { d: "m6 6 12 12" })),
  Settings: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" }), e("circle", { cx: 12, cy: 12, r: 3 })),
  Search: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("circle", { cx: 11, cy: 11, r: 8 }), e("path", { d: "m21 21-4.3-4.3" })),
  Navigation: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("polygon", { points: "3 11 22 2 13 21 11 13 3 11" })),
  ArrowDown: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "m6 9 6 6 6-6" })),
  Mail: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("rect", { width: 20, height: 16, x: 2, y: 4, rx: 2 }), e("path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" })),
  Car: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" }), e("circle", { cx: 7, cy: 17, r: 2 }), e("path", { d: "M9 17h6" }), e("circle", { cx: 17, cy: 17, r: 2 })),
  Footprints: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" }), e("path", { d: "M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" })),
  Hotel: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M10 22v-6.57" }), e("path", { d: "M12 11h.01" }), e("path", { d: "M12 7h.01" }), e("path", { d: "M14 15.43V22" }), e("path", { d: "M15 16a5 5 0 0 0-6 0" }), e("path", { d: "M16 11h.01" }), e("path", { d: "M16 7h.01" }), e("path", { d: "M8 11h.01" }), e("path", { d: "M8 7h.01" }), e("rect", { x: 4, y: 2, width: 16, height: 20, rx: 2 })),
  Store: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" }), e("path", { d: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" }), e("path", { d: "M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" }), e("path", { d: "M2 7h20" }), e("path", { d: "M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" })),
  Fuel: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("line", { x1: 3, x2: 15, y1: 22, y2: 22 }), e("line", { x1: 4, x2: 14, y1: 9, y2: 9 }), e("path", { d: "M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" }), e("path", { d: "M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" })),
  Shield: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })),
  Bot: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M12 8V4H8" }), e("rect", { width: 16, height: 12, x: 4, y: 8, rx: 2 }), e("path", { d: "M2 14h2" }), e("path", { d: "M20 14h2" }), e("path", { d: "M15 13v2" }), e("path", { d: "M9 13v2" })),
  Camera: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" }), e("circle", { cx: 12, cy: 13, r: 3 })),
  Image: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("rect", { width: 18, height: 18, x: 3, y: 3, rx: 2, ry: 2 }), e("circle", { cx: 9, cy: 9, r: 2 }), e("path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" })),
  ShoppingBag: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" }), e("path", { d: "M3 6h18" }), e("path", { d: "M16 10a4 4 0 0 1-8 0" })),
  Coffee: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M10 2v2" }), e("path", { d: "M14 2v2" }), e("path", { d: "M16 8a1 1 0 0 1 1 1v5.917a3 3 0 0 1-2.556 2.967l-.476.07A7.06 7.06 0 0 1 13 18H9a7.06 7.06 0 0 1-.968-.046l-.476-.07A3 3 0 0 1 5 14.917V9a1 1 0 0 1 1-1Z" }), e("path", { d: "M16 8h2a2 2 0 0 1 2 2v.5a2.5 2.5 0 0 1-2.5 2.5H16" }), e("path", { d: "M6 2v2" }), e("path", { d: "M4 22h16" })),
  Loader2: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M21 12a9 9 0 1 1-6.219-8.56" })),
  Map: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("polygon", { points: "3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6" }), e("line", { x1: 9, x2: 9, y1: 3, y2: 18 }), e("line", { x1: 15, x2: 15, y1: 6, y2: 21 })),
  AlertTriangle: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" }), e("path", { d: "M12 9v4" }), e("path", { d: "M12 17h.01" })),
  Star: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" })),
  Heart: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" })),
  Compass: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("circle", { cx: 12, cy: 12, r: 10 }), e("polygon", { points: "16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" })),
  Sparkles: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" }), e("path", { d: "M5 3v4" }), e("path", { d: "M19 17v4" }), e("path", { d: "M3 5h4" }), e("path", { d: "M17 19h4" })),
  Edit: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" })),
  Utensils: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" }), e("path", { d: "M7 2v20" }), e("path", { d: "M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" })),
  LocateFixed: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("line", { x1: 2, x2: 5, y1: 12, y2: 12 }), e("line", { x1: 19, x2: 22, y1: 12, y2: 12 }), e("line", { x1: 12, x2: 12, y1: 2, y2: 5 }), e("line", { x1: 12, x2: 12, y1: 19, y2: 22 }), e("circle", { cx: 12, cy: 12, r: 7 }), e("circle", { cx: 12, cy: 12, r: 3 })),
  ShoppingBasket: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "m5 11 4-7" }), e("path", { d: "m19 11-4-7" }), e("path", { d: "M2 11h20" }), e("path", { d: "m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8c.9 0 1.8-.7 2-1.6l1.7-7.4" }), e("path", { d: "m9 11 1 9" }), e("path", { d: "m15 11-1 9" })),
  Gift: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("rect", { x: 3, y: 8, width: 18, height: 4, rx: 1 }), e("path", { d: "M12 8v13" }), e("path", { d: "M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" })),
  Plus: (p) => e("svg", { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...p }, e("path", { d: "M5 12h14" }), e("path", { d: "M12 5v14" })),
};


// 9. 購物清單


// 9. 清單：平價小吃（吃過打勾）＋全聯宵夜（買了打勾）
window.SHOPPING_LIST = [
  { id: "f1", channels: ["早餐店", "牛肉麵"], name: "頭城早餐：瑞麟美又美／龍記牛肉麵", category: "food", keywords: ["早餐", "牛肉麵", "吉祥路"], icon: "🍳", note: "Day 1 06:30", bought: false },
  { id: "f2", channels: ["小吃店"], name: "礁溪：玉仁八寶冬粉", category: "food", keywords: ["八寶冬粉", "礁溪"], icon: "🍜", note: "Day 1 午餐", bought: false },
  { id: "f3", channels: ["蔥油餅", "冰淇淋"], name: "礁溪：柯氏蔥油餅＋吳記花生捲冰淇淋", category: "food", keywords: ["蔥油餅", "花生捲", "礁溪路四段"], icon: "🥞", note: "午餐同一條街", bought: false },
  { id: "f4", channels: ["小吃店"], name: "頭城老街：品誼米粉羹、春捲、臭豆腐", category: "food", keywords: ["品誼", "米粉羹", "沙成路"], icon: "🥢", note: "18:30 打烊", bought: false },
  { id: "f5", channels: ["麵店"], name: "頭城老街：瑞宏麻醬麵、餛飩湯", category: "food", keywords: ["麻醬麵", "瑞宏", "青雲路"], icon: "🍝", note: "19:00 打烊", bought: false },
  { id: "f6", channels: ["冰店"], name: "聯發芋冰：土芭樂冰、芋頭冰", category: "food", keywords: ["聯發", "芋冰", "青雲路三段190號"], icon: "🍧", note: "飯後", bought: false },
  { id: "f7", channels: ["小吃店"], name: "羅東：林場肉羹", category: "food", keywords: ["林場肉羹", "羅東", "中正北路"], icon: "🍲", note: "Day 2 午餐", bought: false },
  { id: "g1", channels: ["全聯福利中心", "超市", "便利商店"], name: "宵夜零食、飲料", category: "grocery", keywords: ["全聯", "零食"], icon: "🍪", note: "全聯頭城青雲店，18:50", bought: false },
  { id: "g2", channels: ["全聯福利中心", "超市"], name: "隔天早上的水果／牛奶", category: "grocery", keywords: ["全聯", "水果"], icon: "🍌", note: "飯店早餐之外", bought: false },
  { id: "g3", channels: ["全聯福利中心", "藥局"], name: "防蚊液、OK 繃（沙灘用）", category: "grocery", keywords: ["全聯", "藥局"], icon: "🩹", note: "忘了帶再買", bought: false },
];

// 10. 周邊連鎖快速搜尋（台灣版）
window.CHAIN_STORES = [
  { cat: "超市", name: "全聯", icon: "🛒", query: "全聯福利中心" },
  { cat: "超市", name: "家樂福", icon: "🛒", query: "家樂福" },
  { cat: "超商", name: "7-ELEVEN", icon: "🏪", query: "7-ELEVEN" },
  { cat: "超商", name: "全家", icon: "🏪", query: "全家便利商店" },
  { cat: "小吃", name: "麵店／小吃", icon: "🍜", query: "小吃 麵店" },
  { cat: "小吃", name: "早餐店", icon: "🍳", query: "早餐店" },
  { cat: "親子", name: "公園遊戲場", icon: "🛝", query: "公園 遊戲場" },
  { cat: "親子", name: "親子餐廳", icon: "🧸", query: "親子餐廳" },
  { cat: "車", name: "加油站", icon: "⛽", query: "加油站" },
  { cat: "車", name: "停車場", icon: "🅿️", query: "停車場" },
  { cat: "醫", name: "藥局", icon: "💊", query: "藥局" },
  { cat: "醫", name: "診所", icon: "🏥", query: "小兒科 診所" },
];

// 🔍 周邊搜（首頁紅鍵）：台灣版關鍵字
window.SOS_GROUPS = [
  { title: "🍜 吃", items: [["🍜", "小吃麵店", "小吃 麵店"], ["🍳", "早餐店", "早餐店"], ["🧸", "親子餐廳", "親子餐廳"], ["🏪", "超商・廁所", "7-ELEVEN"]] },
  { title: "🛒 買", items: [["🛒", "全聯", "全聯福利中心"], ["💊", "藥局", "藥局"], ["🧱", "玩具店", "玩具店"], ["✏️", "文具店", "文具店"]] },
  { title: "🚗 車", items: [["⛽", "加油站", "加油站"], ["🅿️", "停車場", "停車場"], ["🚿", "洗車", "洗車"], ["🔧", "修車", "汽車修理"]] },
  { title: "🚑 急", items: [["🧒", "小兒科", "小兒科 診所"], ["🏥", "急診", "醫院 急診"], ["🚻", "廁所", "公共廁所"], ["👮", "警察局", "警察局"]] },
];

// 11. 📡 活動雷達：每天的中文檢索詞（地區／主場館／商場）
window.RADAR_KEYS = {
  day1: { cities: ["頭城", "礁溪", "宜蘭"], venues: ["蘭陽博物館", "頭城運動公園", "外澳"], malls: ["礁溪 溫泉公園", "頭城老街", "烏石港"] },
  day2: { cities: ["五結", "羅東", "宜蘭"], venues: ["玉兔鉛筆學校", "國立傳統藝術中心", "羅東林業文化園區"], malls: ["羅東夜市", "羅東文化工場", "蘭城新月"] },
};

// 路線風險（取代雪況；risk: low／mid／high）
window.WINTER_ROUTES = [
  { day: "Day1", date: "11/22", dayId: "day1", checkpoints: [{ n: "南港系統", lat: 25.04, lon: 121.61 }, { n: "雪隧", lat: 24.94, lon: 121.72 }, { n: "頭城", lat: 24.86, lon: 121.82 }], jmaAreas: [],
    route: "台北 → 國 3 → 國 5 雪隧 → 頭城（週日南下）", risk: "medium",
    notes: "週日南下車潮 07:30 起，08:00 後雪隧前回堵。05:40 出門、07:00 前過南港系統即可避開；萬一晚出門，改走台 9 北宜或等 10:00 後。" },
  { day: "Day2", date: "11/23", dayId: "day2", checkpoints: [{ n: "羅東", lat: 24.68, lon: 121.77 }, { n: "雪隧", lat: 24.94, lon: 121.72 }, { n: "台北", lat: 25.07, lon: 121.51 }], jmaAreas: [],
    route: "羅東 → 國 5 北上 → 台北（週一）", risk: "low",
    notes: "週一下午北上順暢，約 80 分。高乘載管制只在例假日 15–20 時。" },
];
window.WINTER_ESSENTIALS = {
  tire: { title: "ETC", detail: "確認 ETC 餘額。國 5 南港系統—頭城單程約 NT$40–50。", icon: "💳" },
  chain: { title: "高乘載", detail: "例假日 15:00–20:00 國 5 北上（宜蘭／羅東／蘇澳入口）3 人以上才能上。11/23 是週一不適用。", icon: "👨‍👩‍👦‍👦" },
  fuel: { title: "油量", detail: "出門前加滿；回程上國 5 前在羅東加油。", icon: "⛽" },
  emergency: { title: "救援", detail: "國道救援：撥 1968 或各保險道路救援專線。警察 110、救護 119。", icon: "🆘" },
  gear: { title: "車內必備", detail: "雨具、小孩換洗衣物、大塑膠袋、暈車藥、水。", icon: "🧰" },
  links: [
    { name: "1968 即時路況", url: "https://1968.freeway.gov.tw/", icon: "🛣️" },
    { name: "中央氣象署 宜蘭", url: "https://www.cwa.gov.tw/V8/C/W/County/County.html?CID=10002", icon: "🌦️" },
    { name: "宜蘭勁好玩 活動", url: "https://www.yilan.travel/", icon: "🎪" },
  ],
};

window.GEMINI_PRICE_PROMPT = "";
// 13. ✨ AI 查核用的成員描述
window.TRAVELERS = "2 大 2 小（兩個小學男生，9 歲與 11 歲）";
