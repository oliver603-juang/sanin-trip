/**
 * app.js - 2027 寒假山陰鳥取冬遊（底版 kyushu-trip v47） (最終極致版 - Fix: Correct Google Maps URLs)
 * * 修復項目：
 * 1. [Critical] 修正所有地圖連結：移除錯誤的 googleusercontent 前綴，改用標準 https://www.google.com/maps/...
 * 2. [Feat] 保留所有 AI 票價估算 (排除飯店)、手動修改票價、行程連動、記帳功能。
 */

const { useState, useEffect, useMemo, useCallback, useRef } = React;

// ============================================================================
// SECTION 0: ICON POLYFILLS
// ============================================================================
(function ensureIcons() {
  if (!window.Icons) window.Icons = {};
  const e = React.createElement;
  const iconDef = (d) => (p) =>
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
      d.map((path, i) =>
        typeof path === "string"
          ? e("path", { d: path, key: i })
          : e(path.tag, { ...path.attr, key: i })
      )
    );

  if (!window.Icons.Map)
    window.Icons.Map = iconDef([
      {
        tag: "polygon",
        attr: { points: "3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6" },
      },
      { tag: "line", attr: { x1: "9", x2: "9", y1: "3", y2: "18" } },
      { tag: "line", attr: { x1: "15", x2: "15", y1: "6", y2: "21" } },
    ]);
  if (!window.Icons.Image)
    window.Icons.Image = iconDef([
      {
        tag: "rect",
        attr: { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" },
      },
      { tag: "circle", attr: { cx: "9", cy: "9", r: "2" } },
      "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",
    ]);
  if (!window.Icons.Loader2)
    window.Icons.Loader2 = iconDef(["M21 12a9 9 0 1 1-6.219-8.56"]);
  if (!window.Icons.AlertTriangle)
    window.Icons.AlertTriangle = iconDef([
      "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z",
      "M12 9v4",
      "M12 17h.01",
    ]);
  if (!window.Icons.Sparkles)
    window.Icons.Sparkles = iconDef([
      "m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z",
      "M5 3v4",
      "M9 3v4",
      "M3 5h4",
      "M3 9h4",
    ]);
  if (!window.Icons.Edit)
    window.Icons.Edit = iconDef([
      "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z",
    ]);
  if (!window.Icons.Download)
    window.Icons.Download = iconDef(["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","M7 10l5 5 5-5","M12 15V3"]);
  if (!window.Icons.Upload)
    window.Icons.Upload = iconDef(["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","M17 8l-5-5-5 5","M12 3v12"]);
})();

// ==========================================
// 1. 工具函數 (Utilities)
// ==========================================

// [Helper] 判斷是否為住宿地點 (關鍵字過濾)
const isHotel = (name) => {
  const keywords = [
    "飯店",
    "酒店",
    "民宿",
    "旅店",
    "商旅",
    "行館",
    "會館",
    "渡假村",
    "度假村",
    "Hotel",
    "Resort",
    "Inn",
    "Villa",
    "Hostel",
    "溫暖的家",
  ];
  if (keywords.some((kw) => name.includes(kw))) return true;
  if (window.HOTEL_INFO && window.HOTEL_INFO.some((h) => name.includes(h.name)))
    return true;
  return false;
};

// [Helper] 判斷是否為「本來就不用門票」的地點（商店/停車場/餐廳/交通）
// 這類地點永遠不該有門票金額，也不送去 AI 估價，避免估出天價
const FREE_SPOT_PATTERNS = [
  /BOOK\s*OFF/i, /HARD\s*OFF/i, /HOBBY\s*OFF/i, /OFF\s*HOUSE/i,
  /ハードオフ/, /ブックオフ/, /ホビーオフ/, /オフハウス/,
  /駿河屋/, /まんだらけ/, /おもちゃ/, /トイザらス/,
  /停車場/, /駐車場/, /パーキング/, /Parking/i, /Times/i, /タイムズ/,
  /機場/, /空港/, /Airport/i, /車站/, /駅$/,
  /レンタカー/, /租車/, /ORIX/i, /ＯＲＩＸ/, /Toyota Rent/i, /NIPPON/i, /ニッポンレンタカー/, /營業所/,
  /すき家/, /薩莉亞/, /サイゼリヤ/, /Saizeriya/i, /松屋/, /吉野家/,
  /超市/, /スーパー/, /藥妝/, /ドンキ/, /唐吉軻德/, /便利商店/, /ローソン/, /セブン/,
  /商店街/, /アーケード/, /Mall/i, /百貨/, /丸井/, /AEON/i, /イオン/,
  /2nd\s*Street/i, /セカンドストリート/, /Treasure Factory/i, /マンガ倉庫/, /Otakara/i, /お宝/, /御宝/,
  /LAMU/i, /MaxValu/i, /The Big/i, /youme/i, /HANDS/i, /LOFT/i, /Usagiya/i, /C-pla/i, /Shin Ajiso/i, /NAGASAWA/i,
  // 山陰版補充：商店、紀念品店、戶外用品店、接駁、免費戶外區
  /帆布/, /意匠/, /播産館/, /賣店/, /売店/, /茶店/, /ハイマートベルク/, /アウトドア/, /PenStyle/i, /接泊/, /接駁/, /綠洲/, /西松屋/, /BAZAAR/i, /永旺/, /馬場/,
];
const isFreeSpot = (name) => {
  if (!name) return false;
  return FREE_SPOT_PATTERNS.some((re) => re.test(name));
};

// [Helper] 門票估價的合理上限（日圓）。超過就視為 AI 估錯，直接丟棄。
const TICKET_SANITY_MAX = { spot: 6000, hotel: 60000 };
// 把 AI 回傳的估價過濾成「可信的那幾筆」
const sanitizeEstimates = (raw, kind, nameOf) => {
  const max = TICKET_SANITY_MAX[kind] || TICKET_SANITY_MAX.spot;
  const out = {};
  Object.keys(raw || {}).forEach((k) => {
    const v = raw[k];
    if (!v || typeof v !== "object") return;
    const name = nameOf ? nameOf(k) : "";
    if (isFreeSpot(name)) return; // 商店/停車場/餐廳：一律不給門票
    const a = Number(v.adult),
      c = Number(v.child || 0);
    if (!isFinite(a) || a < 0 || a > max) return; // 明顯離譜就丟掉
    if (!isFinite(c) || c < 0 || c > max) return;
    if (a === 0 && c === 0) return;
    out[k] = { adult: Math.round(a), child: Math.round(c), est: true };
  });
  return out;
};

// --- 消費分類（記帳/明細/Email 共用）---
const CATEGORY_META = {
  food: { label: "餐飲", icon: "🍜" },
  shopping: { label: "購物", icon: "🛍️" },
  transport: { label: "交通", icon: "⛽" },
  parking: { label: "停車", icon: "🅿️" },
  ticket: { label: "門票", icon: "🎫" },
  lodging: { label: "住宿", icon: "🏨" },
  other: { label: "其他", icon: "📦" },
};
const catMeta = (key) => CATEGORY_META[key] || CATEGORY_META.other;

// 門票取得：config 設 locked:true 的票價為「確定價」（免費或已查證），AI 估算/手動覆蓋均不生效
// 商店／停車場／交通／餐廳一律視為免門票：只有使用者手動輸入（manual）的價格才算數，
// AI 估算或舊資料殘留的金額每次載入都直接忽略（等於自動清洗，不必跑遷移）
const isManualTicket = (o) => !!o && (o.manual === true || (!!o.currency && !o.est));
const getTicket = (spot, overrides) => {
  if (spot.ticket && spot.ticket.locked) return spot.ticket;
  const o = overrides[spot.id];
  if (isFreeSpot(spot.name) && !isHotel(spot.name)) return isManualTicket(o) ? o : null;
  return o || spot.ticket;
};

// ═══ Gemini Model Fallback Chain ═══
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];
let GEMINI_MODEL = localStorage.getItem("ft-gemini-model") || GEMINI_MODELS[0];

const generateGeminiContent = async (
  prompt,
  base64Image = null,
  useSearch = false,
  opts = {}
) => {
  const apiKey = localStorage.getItem("gemini_api_key") || "";
  if (!apiKey) throw new Error("NO_API_KEY");

  const contents = [{ role: "user", parts: [{ text: prompt }] }];
  if (base64Image) {
    const data = base64Image.split(",")[1] || base64Image;
    contents[0].parts.unshift({
      inlineData: { mimeType: "image/jpeg", data: data },
    });
  }

  const payload = {
    contents,
    tools: useSearch ? [{ google_search: {} }] : undefined,
  };
  if (opts.maxTokens) {
    payload.generationConfig = { maxOutputTokens: opts.maxTokens };
  }

  let lastErr = null;
  for (let mi = 0; mi < GEMINI_MODELS.length; mi++) {
    const model = mi === 0 ? GEMINI_MODEL : GEMINI_MODELS[mi];
    if (mi > 0 && model === GEMINI_MODEL) continue;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    // Gemini 2.5 預設會先「思考」，現場比價不需要，關掉可省一大段延遲
    if (opts.noThinking && /2\.5/.test(model)) {
      payload.generationConfig = Object.assign({}, payload.generationConfig, {
        thinkingConfig: { thinkingBudget: 0 },
      });
    } else if (payload.generationConfig) {
      delete payload.generationConfig.thinkingConfig;
    }

    for (let i = 0; i < 3; i++) {
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          if (model !== GEMINI_MODEL) {
            GEMINI_MODEL = model;
            try { localStorage.setItem("ft-gemini-model", model); } catch(e) {}
            console.log("🔄 已切換到模型:", model);
          }
          const result = await response.json();
          const parts = result.candidates?.[0]?.content?.parts || [];
          const joined = parts.map((pt) => pt && pt.text).filter(Boolean).join("\n").trim();
          if (joined) return joined;
          const fr = result.candidates?.[0]?.finishReason;
          if (fr && fr !== "STOP") return `（回應被中斷：${fr}。請再按一次查詢，或把商品名寫得完整一點。）`;
          return "無內容生成";
        }
        const code = response.status;
        if (code === 429 && i < 2) {
          let waitMs = 2000 * (i + 1);
          try {
            const errData = await response.json();
            const ri = errData?.error?.details?.find(d => d["@type"]?.includes("RetryInfo"));
            if (ri?.retryDelay) { const m = ri.retryDelay.match(/(\d+(?:\.\d+)?)s/); if (m && parseFloat(m[1]) < 10) waitMs = Math.ceil(parseFloat(m[1]) * 1000) + 200; }
          } catch(e) {}
          console.log(`⏳ 429 retry ${i+1}/2, wait ${waitMs}ms`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        if (code === 404) { lastErr = new Error(`MODEL_NOT_FOUND: ${model}`); break; }
        if (code === 429) { throw new Error("QUOTA_EXHAUSTED: 配額用完，請稍後再試"); }
        if (code === 400) {
          try { const ed = await response.json(); if (ed?.error?.message?.includes("API key")) throw new Error("BAD_API_KEY"); } catch(e) { if (e.message === "BAD_API_KEY") throw e; }
        }
        throw new Error(`API Error: ${code}`);
      } catch (error) {
        if (error.message === "NO_API_KEY" || error.message === "BAD_API_KEY" || error.message.startsWith("QUOTA_EXHAUSTED")) throw error;
        lastErr = error;
        if (i === 2) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  throw lastErr || new Error("ALL_MODELS_FAILED");
};

const timeToMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const minutesToTimeStr = (m) => {
  let h = Math.floor(m / 60);
  let min = Math.floor(m % 60);
  h = h % 24;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
};
const parseStayDuration = (s) => {
  if (!s || s === "-" || s === "Overnight") return 0;
  if (s.includes("hr")) return parseFloat(s) * 60;
  if (s.includes("min")) return parseInt(s);
  return 0;
};
const formatTime = (ts) => {
  if (!ts) return "";
  const date = new Date(ts);
  if (isNaN(date.getTime())) return String(ts);
  return date.toLocaleString("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

// ==========================================
// 2. 共用 UI 組件 (Components)
// ==========================================

const MarkdownRenderer = ({ content, className = "" }) => {
  const html = marked.parse(content || "");
  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const ApiKeyModal = ({ isOpen, onClose }) => {
  const [tempKey, setTempKey] = useState(
    localStorage.getItem("gemini_api_key") || ""
  );
  const Icons = window.Icons;
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
      <div className="glass-panel rounded-2xl p-6 w-full max-w-sm shadow-2xl bg-[#1e293b] text-slate-200 border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Icons.Settings size={20} className="text-[#4ECDC4]" /> 設定 AI 金鑰
          </h3>
          <button onClick={onClose}>
            <Icons.X size={20} className="text-slate-400 hover:text-white" />
          </button>
        </div>
        <input
          type="password"
          value={tempKey}
          onChange={(e) => setTempKey(e.target.value)}
          placeholder="Paste API Key"
          className="w-full bg-slate-800 p-3 rounded-xl mb-4 text-white outline-none border border-slate-600 focus:border-[#4ECDC4]"
        />
        <div className="flex gap-2">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center py-2.5 rounded-xl border border-slate-600 text-xs font-bold text-slate-400"
          >
            取得 Key
          </a>
          <button
            onClick={() => {
              localStorage.setItem("gemini_api_key", tempKey);
              onClose();
              window.location.reload();
            }}
            className="flex-1 bg-[#4ECDC4] text-white rounded-xl font-bold"
          >
            儲存
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>🤖 模型：<code className="text-[#4ECDC4]">{GEMINI_MODEL}</code></span>
          <button onClick={() => { GEMINI_MODEL = GEMINI_MODELS[0]; localStorage.setItem("ft-gemini-model", GEMINI_MODELS[0]); alert("已重設為 " + GEMINI_MODELS[0]); }} className="px-2 py-0.5 rounded border border-slate-600 text-slate-400 hover:text-white">重設</button>
        </div>
      </div>
    </div>
  );
};

// --- ExpenseModal ---
const ExpenseModal = ({
  isOpen,
  onClose,
  currentEditingSpot,
  expenseForm,
  setExpenseForm,
  handleImageUpload,
  pendingReceipts,
  togglePendingReceipt,
  removePendingReceipt,
  saveExpense,
  expenses,
  deleteExpense,
  isAnalyzingReceipt,
  quotaStatus,
  twdJpyRate,
}) => {
  const Icons = window.Icons;
  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "desc",
  });
  const [detailRec, setDetailRec] = useState(null); // 點紀錄卡片 → 彈出完整明細

  if (!isOpen || !currentEditingSpot) return null;
  const safePendingReceipts = pendingReceipts || [];

  const currentSpotExpenses = expenses[currentEditingSpot.id] || [];
  const sortedExpenses = [...currentSpotExpenses].sort((a, b) => {
    const valA = sortConfig.key === "date" ? a.timestamp || a.id : a.amount;
    const valB = sortConfig.key === "date" ? b.timestamp || b.id : b.amount;
    return sortConfig.direction === "asc" ? valA - valB : valB - valA;
  });

  const toggleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel rounded-3xl p-6 w-full max-w-sm bg-white border border-gray-100 flex flex-col max-h-[85vh] shadow-2xl">
        <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-gray-800">
          <Icons.Wallet size={20} className="text-[#E4C2C1]" />{" "}
          {currentEditingSpot.name}
        </h3>
        {window.SHARED_ALBUM_URL && (
          <a
            href={window.SHARED_ALBUM_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 mb-3 px-3 py-2 bg-[#F9F7F5] border border-[#A9BFA8]/40 rounded-xl text-xs font-bold text-[#A9BFA8] hover:bg-white"
          >
            📤 收據共享相簿
            <span className="text-gray-400 font-normal">看家人上傳的收據 → 用相簿鈕選圖入帳</span>
          </a>
        )}

        <div className="flex-1 overflow-y-auto pr-1 no-scrollbar">
          <input
            type="text"
            value={expenseForm.note}
            onChange={(e) =>
              setExpenseForm({ ...expenseForm, note: e.target.value })
            }
            className="w-full bg-gray-50 p-3 rounded-xl mb-3 text-sm outline-none border border-gray-200 text-gray-800 focus:border-[#E4C2C1]"
            placeholder="備註"
          />
          {/* 分類選擇（手動記帳；AI 收據會自動分類） */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {["food", "shopping", "transport", "parking", "other"].map((k) => (
              <button
                key={k}
                onClick={() => setExpenseForm({ ...expenseForm, category: k })}
                className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 transition-colors ${
                  (expenseForm.category || "food") === k
                    ? "bg-[#E4C2C1] text-white border-[#E4C2C1]"
                    : "bg-white text-gray-500 border-gray-200"
                }`}
              >
                {CATEGORY_META[k].icon} {CATEGORY_META[k].label}
              </button>
            ))}
            <span className="mx-1 border-l border-gray-200"></span>
            {[
              { c: "JPY", t: "¥ 日圓" },
              { c: "TWD", t: "NT$ 台幣" },
            ].map(({ c, t }) => (
              <button
                key={c}
                onClick={() => setExpenseForm({ ...expenseForm, currency: c })}
                className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 transition-colors ${
                  (expenseForm.currency || "JPY") === c
                    ? "bg-[#A9BFA8] text-white border-[#A9BFA8]"
                    : "bg-white text-gray-500 border-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {(expenseForm.currency || "JPY") === "TWD" && (
            <div className="text-[11px] text-[#A9BFA8] font-bold -mt-2 mb-3 ml-1">
              台幣消費將以 1:{(twdJpyRate || 4.6).toFixed(2)} 自動轉為日圓入帳
            </div>
          )}
          <div className="relative mb-4">
            <input
              type="number"
              value={expenseForm.amount}
              onChange={(e) =>
                setExpenseForm({ ...expenseForm, amount: e.target.value })
              }
              className="w-full bg-gray-50 p-3 rounded-xl text-2xl font-mono border border-gray-200 outline-none text-gray-800 focus:border-[#E4C2C1] pr-12 font-bold placeholder-gray-300"
              placeholder="0"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  id="modal-gallery-upload"
                  className="hidden"
                  multiple
                  onChange={handleImageUpload}
                  disabled={isAnalyzingReceipt}
                />
                <label
                  htmlFor="modal-gallery-upload"
                  className={`p-1.5 rounded-lg cursor-pointer flex items-center justify-center transition-colors ${
                    isAnalyzingReceipt
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-400 hover:text-[#4ECDC4] hover:bg-gray-100"
                  }`}
                >
                  <Icons.Image size={20} />
                </label>
              </div>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  id="modal-camera-upload"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isAnalyzingReceipt}
                />
                <label
                  htmlFor="modal-camera-upload"
                  className={`p-1.5 rounded-lg cursor-pointer flex items-center justify-center transition-colors ${
                    isAnalyzingReceipt
                      ? "text-[#E4C2C1] animate-pulse"
                      : "text-gray-400 hover:text-[#4ECDC4] hover:bg-gray-100"
                  }`}
                >
                  {isAnalyzingReceipt ? (
                    <Icons.Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Icons.Camera size={20} />
                  )}
                </label>
              </div>
            </div>
          </div>

          {safePendingReceipts.length > 0 && (
            <div className="mb-6 space-y-2 bg-[#F9F7F5] p-3 rounded-xl border border-gray-200">
              <div className="text-xs font-bold text-[#A9BFA8] flex justify-between px-1">
                <span>AI 辨識結果</span>
                <span>{quotaStatus.text}</span>
              </div>
              {safePendingReceipts.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                    item.isChecked
                      ? "bg-white border border-[#E4C2C1]"
                      : "bg-gray-100 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.isChecked}
                    onChange={() => togglePendingReceipt(item.id)}
                    className="accent-[#E4C2C1] w-4 h-4 cursor-pointer rounded"
                  />
                  <div className="flex-1 min-w-0">
                    {item.isAnalyzing ? (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Icons.Loader2 size={12} className="animate-spin" />{" "}
                        分析中...
                      </div>
                    ) : (
                      <>
                        <div className="text-sm truncate text-gray-800">
                          {item.note}
                        </div>
                        <div className="flex justify-between items-center mt-0.5">
                          <div className="text-xs text-[#E4C2C1] font-mono font-bold">
                            NT${item.amount}
                          </div>
                          {item.timestamp && (
                            <div className="text-[10px] text-gray-400">
                              {formatTime(item.timestamp)}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => removePendingReceipt(item.id)}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <Icons.X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-dashed border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                歷史紀錄
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => toggleSort("date")}
                  className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                    sortConfig.key === "date"
                      ? "bg-[#E4C2C1] text-white border-[#E4C2C1]"
                      : "bg-gray-50 text-gray-400 border-gray-200"
                  }`}
                >
                  時間{" "}
                  {sortConfig.key === "date" &&
                    (sortConfig.direction === "desc" ? "↓" : "↑")}
                </button>
                <button
                  onClick={() => toggleSort("amount")}
                  className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                    sortConfig.key === "amount"
                      ? "bg-[#A9BFA8] text-white border-[#A9BFA8]"
                      : "bg-gray-50 text-gray-400 border-gray-200"
                  }`}
                >
                  金額{" "}
                  {sortConfig.key === "amount" &&
                    (sortConfig.direction === "desc" ? "↓" : "↑")}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {sortedExpenses.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-2">
                  無消費紀錄
                </div>
              )}
              {sortedExpenses.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setDetailRec(r)}
                  className="flex justify-between text-sm bg-gray-50 p-3 rounded-xl border border-gray-100 cursor-pointer active:bg-gray-100"
                >
                  <div className="flex flex-col">
                    <span className="text-gray-700 font-medium">
                      {r.note || "消費"}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatTime(r.timestamp || r.id)}
                      {r.itemsFull && r.itemsFull.length > 0 && (
                        <span className="ml-1 text-[#A9BFA8] font-bold">
                          📋 {r.itemsFull.length} 項
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <span className="font-mono font-bold text-gray-800">
                      ¥{(r.amount || 0).toLocaleString()}
                      {r.currency === "TWD" && r.origAmount != null && (
                        <span className="block text-[9px] text-gray-400 text-right font-normal">
                          NT${r.origAmount.toLocaleString()}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteExpense(currentEditingSpot.id, r.id);
                      }}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <Icons.X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4 shrink-0 pt-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors font-medium"
          >
            取消
          </button>
          <button
            onClick={saveExpense}
            className="flex-1 bg-[#E4C2C1] text-white rounded-xl font-bold py-3 shadow-md hover:brightness-105 active:scale-95 transition-all"
          >
            儲存
          </button>
        </div>
        {/* 消費明細彈窗 */}
        {detailRec && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4"
            onClick={() => setDetailRec(null)}
          >
            <div
              className="bg-white rounded-3xl p-5 w-full max-w-sm max-h-[75vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-bold text-gray-800 text-base leading-snug pr-2">
                  {detailRec.note || "消費"}
                </h4>
                <button
                  onClick={() => setDetailRec(null)}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                >
                  <Icons.X size={18} />
                </button>
              </div>
              <div className="text-[11px] text-gray-400 mb-3">
                {formatTime(detailRec.timestamp || detailRec.id)}
              </div>
              <div className="overflow-y-auto no-scrollbar flex-1">
                {detailRec.itemsFull && detailRec.itemsFull.length > 0 ? (
                  <div className="space-y-1.5">
                    {detailRec.itemsFull.map((it, i) => (
                      <div
                        key={i}
                        className="flex justify-between gap-3 text-sm py-1.5 border-b border-dashed border-gray-100"
                      >
                        <span className="text-gray-700">{it.name}</span>
                        <span className="font-mono text-gray-800 shrink-0">
                          ¥{(it.price || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 leading-relaxed">
                    這筆紀錄沒有逐項明細（舊紀錄或手動記帳）。
                    之後用「AI 掃收據」入帳的消費，會自動保留完整品項。
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center pt-3 mt-2 border-t border-gray-200">
                <span className="text-xs font-bold text-gray-500">
                  合計（實付為準）
                </span>
                <span className="font-mono font-black text-lg text-gray-900">
                  ¥{(detailRec.amount || 0).toLocaleString()}
                  {detailRec.currency === "TWD" &&
                    detailRec.origAmount != null && (
                      <span className="block text-[10px] text-gray-400 text-right font-normal">
                        NT${detailRec.origAmount.toLocaleString()}
                      </span>
                    )}
                </span>
              </div>
            </div>
          </div>
        )}
        <div className="hidden">
        </div>
      </div>
    </div>
  );
};

// --- Email 發送彈窗 ---
const EmailModal = ({
  isOpen,
  onClose,
  emailInput,
  setEmailInput,
  handleSendEmail,
  isSendingEmail,
}) => {
  const Icons = window.Icons;
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
      <div className="glass-panel rounded-3xl p-6 w-full max-w-sm bg-white border border-gray-100 shadow-xl">
        <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-gray-800">
          <Icons.Mail size={20} className="text-[#A9BFA8]" /> 寄送報表
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          將本次旅程的詳細花費清單 (HTML 表格) 發送至您的信箱。
        </p>
        <input
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="Email"
          className="w-full bg-gray-50 p-3 rounded-xl mb-4 border border-gray-200 outline-none focus:border-[#E4C2C1] text-gray-800"
        />
        <button
          onClick={handleSendEmail}
          className="w-full bg-[#E4C2C1] text-white rounded-xl font-bold py-3 shadow-md flex items-center justify-center gap-2 hover:brightness-105"
          disabled={isSendingEmail}
        >
          {isSendingEmail ? (
            <Icons.Loader2 size={16} className="animate-spin" />
          ) : (
            "確認發送"
          )}
        </button>
        <button
          onClick={onClose}
          className="w-full mt-2 text-gray-400 py-2 hover:text-gray-600"
        >
          取消
        </button>
      </div>
    </div>
  );
};

// --- 每日明細彈窗 ---
const DailyDetailModal = ({
  isOpen,
  onClose,
  dayData,
  allExpenses,
  spotTicketCounts = {},
  selectedCurrency,
  exchangeRate,
  tripData,
  ticketOverrides = {},
  getTicketCounts,
}) => {
  const Icons = window.Icons;
  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "desc",
  });

  if (!isOpen || !dayData) return null;
  const isTotalSummary = dayData.isTotalSummary;
  const filteredDays = isTotalSummary ? tripData : [dayData];
  const dayExpensesList = [];

  filteredDays.forEach((day) => {
    day.spots.forEach((spot) => {
      const expenses = allExpenses[spot.id] || [];
      expenses.forEach((r) =>
        dayExpensesList.push({ ...r, spotName: spot.name })
      );

      // 門票/住宿邏輯：有價格才列出（與 dailyStats 計算一致）
      const currentTicket = getTicket(spot, ticketOverrides);
      if (
        currentTicket &&
        (currentTicket.adult > 0 || currentTicket.child > 0)
      ) {
        const counts = getTicketCounts
          ? getTicketCounts(spot.id)
          : { adult: 2, child: 2 };
        if (isHotel(spot.name)) {
          // 住宿：房價 × 房數（原版漏列，造成明細加總 < 卡片總額）
          const cost = currentTicket.adult * counts.adult;
          if (cost > 0)
            dayExpensesList.push({
              id: `h-${spot.id}`,
              amount: cost,
              note: `住宿 (${counts.adult} 房)`,
              spotName: spot.name,
              timestamp: 0,
              category: "lodging",
            });
        } else {
          const cost =
            currentTicket.adult * counts.adult +
            currentTicket.child * counts.child;
          if (cost > 0)
            dayExpensesList.push({
              id: `t-${spot.id}`,
              amount: cost,
              note: `門票 (大${counts.adult} 小${counts.child})`,
              spotName: spot.name,
              timestamp: 0,
              category: "ticket",
            });
        }
      }
    });
  });

  const totalTWD = dayExpensesList.reduce((sum, item) => sum + item.amount, 0);

  // 類別小計
  const catTotals = {};
  dayExpensesList.forEach((item) => {
    const k = CATEGORY_META[item.category] ? item.category : "other";
    catTotals[k] = (catTotals[k] || 0) + item.amount;
  });

  const sortedList = [...dayExpensesList].sort((a, b) => {
    const valA = sortConfig.key === "date" ? a.timestamp || 0 : a.amount;
    const valB = sortConfig.key === "date" ? b.timestamp || 0 : b.amount;
    return sortConfig.direction === "asc" ? valA - valB : valB - valA;
  });

  const toggleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[130] p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="glass-panel rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[85vh] flex flex-col bg-white border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
          <div>
            <div className="text-xs font-bold text-gray-400">
              {isTotalSummary ? "整個行程" : dayData.date}
            </div>
            <h3 className="font-black text-xl text-gray-800">
              {isTotalSummary ? "總花費明細" : dayData.title}
            </h3>
          </div>
          <button onClick={onClose}>
            <Icons.X size={20} className="text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {Object.keys(catTotals).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.entries(catTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <span
                  key={k}
                  className="px-2 py-1 rounded-full text-[10px] font-bold bg-gray-50 border border-gray-200 text-gray-600"
                >
                  {catMeta(k).icon} {catMeta(k).label} ¥{v.toLocaleString()}
                </span>
              ))}
          </div>
        )}

        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-xs font-bold text-gray-400 uppercase">
            消費列表
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => toggleSort("date")}
              className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                sortConfig.key === "date"
                  ? "bg-[#E4C2C1] text-white border-[#E4C2C1]"
                  : "bg-gray-50 text-gray-400 border-gray-200"
              }`}
            >
              時間{" "}
              {sortConfig.key === "date" &&
                (sortConfig.direction === "desc" ? "↓" : "↑")}
            </button>
            <button
              onClick={() => toggleSort("amount")}
              className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                sortConfig.key === "amount"
                  ? "bg-[#A9BFA8] text-white border-[#A9BFA8]"
                  : "bg-gray-50 text-gray-400 border-gray-200"
              }`}
            >
              金額{" "}
              {sortConfig.key === "amount" &&
                (sortConfig.direction === "desc" ? "↓" : "↑")}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-1">
          {sortedList.length === 0 && (
            <div className="text-center text-gray-400 py-10">尚無紀錄</div>
          )}
          {sortedList.map((item, idx) => (
            <div
              key={item.id || idx}
              className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex justify-between items-center"
            >
              <div className="flex flex-col">
                <div className="text-xs text-[#A9BFA8] font-bold mb-0.5">
                  {item.spotName}
                  {item.by && (
                    <span className="text-gray-400 font-normal">・{item.by}</span>
                  )}
                </div>
                <div className="text-sm font-bold text-gray-600">
                  {catMeta(item.category).icon} {item.note}
                </div>
                {item.timestamp > 0 && (
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {formatTime(item.timestamp)}
                  </div>
                )}
              </div>
              <div className="font-mono font-bold text-[#E4C2C1] text-lg text-right">
                ¥{item.amount.toLocaleString()}
                {item.currency === "TWD" && item.origAmount != null && (
                  <div className="text-[9px] text-gray-400 font-normal">
                    NT${item.origAmount.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 space-y-1">
          <div className="flex justify-between">
            <span className="text-sm font-bold text-gray-500">總計 (JPY)</span>
            <span className="text-xl font-mono font-black text-[#E4C2C1]">
              ¥{totalTWD.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-bold text-gray-400">
              約合 ({selectedCurrency.code})
            </span>
            <span className="text-sm font-mono font-bold text-gray-500">
              {selectedCurrency.symbol}{" "}
              {(totalTWD * exchangeRate).toFixed(0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- CurrencySwitcher ---
const CurrencySwitcher = ({
  selectedCurrency,
  exchangeRate,
  isRateLoading,
  setSelectedCurrency,
}) => {
  const Icons = window.Icons;
  return (
    <div className="flex items-center gap-2">
      <div className="text-[10px] sm:text-xs font-bold text-gray-400 italic whitespace-nowrap hidden sm:block">
        {isRateLoading
          ? "..."
          : `1 JPY ≈ ${exchangeRate.toFixed(4)} ${selectedCurrency.code}`}
      </div>
      <div className="bg-white p-1.5 sm:p-2 rounded-xl shadow-sm border border-gray-200 relative group hover:border-[#A9BFA8] transition-colors">
        <select
          value={selectedCurrency.code}
          onChange={(e) => {
            const f = window.CURRENCY_OPTIONS.find(
              (c) => c.code === e.target.value
            );
            if (f) setSelectedCurrency(f);
          }}
          className="bg-transparent outline-none cursor-pointer text-sm font-bold appearance-none pr-5 text-gray-600"
          disabled={isRateLoading}
        >
          {(window.CURRENCY_OPTIONS || []).map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
        <Icons.ArrowDown
          size={12}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-[#A9BFA8]"
        />
      </div>
    </div>
  );
};

// ==========================================
// 2.9 每日行程進度環（已動身 X/Y · 還剩 N 站）
// ==========================================

const DayProgress = ({ spots }) => {
  const total = spots.length;
  const done = spots.filter((s) => s.isDeparted).length;
  const remaining = total - done;
  const pct = total > 0 ? done / total : 0;
  const R = 16;
  const C = 2 * Math.PI * R;
  const isDone = remaining === 0 && total > 0;
  const color = isDone ? "#22C55E" : "#6366F1";
  return (
    <div className="ml-auto flex items-center gap-2.5 bg-white rounded-2xl pl-3 pr-4 py-2 shadow-md border-2 border-gray-100 shrink-0">
      <div className="relative w-11 h-11">
        <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
          <circle cx="22" cy="22" r={R} fill="none" stroke="#E5E7EB" strokeWidth="5" />
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[11px] font-black"
          style={{ color }}
        >
          {isDone ? "✓" : `${Math.round(pct * 100)}%`}
        </span>
      </div>
      <div className="text-right leading-tight">
        <div className="text-base font-black text-gray-800 font-mono">
          {done}/{total}
        </div>
        <div
          className={`text-[10px] font-bold whitespace-nowrap ${
            isDone ? "text-green-600" : "text-gray-400"
          }`}
        >
          {isDone ? "今日完成 🎉" : `還剩 ${remaining} 站`}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 路線縮圖（瑪利歐賽車風格的完成度小地圖）
// 淡灰 = 五天全部路線；莫蘭迪咖啡 = 已完成（樹枝）；莫蘭迪綠 = 本日（新芽）
// ==========================================
const RT_W = 72;
const RT_H = 40;
const RT_PAD = 6;
const RT_GRAY = "#d9dde2";
const RT_BRANCH = "#a1897a";
const RT_SPROUT = "#8fae9b";

const RT_ROAD_POLY = [
  "ge~kEace{WhJr_@aM`MlG}IcmAds@{c@aRkvCuNmK{MoLw]fSsnBcYy`BxSgnBub@otBiJGxHuWkXmAsm@nq@gYjiA|St^ieA~e@`JmLfp@wYdd@dCyCqWy{Ak|Ayl@wtAow@_bAwHqp@syA_cBiXa{BeUee@inBytAyc@e~@cp@kf@e`@kcAiNebCxJwt@i[c`@oBej@nSmcAqFwp@sRgHkIak@cx@qf@e~AaScQiXks@iMoEiZygBt|@esAxVko@ePgK}m@{zAmcA_e@kz@vBak@yUwi@Dg{@ee@iOenBnF}SktDtGmiD}tAstBbGyl@lk@kq@nF}kC{C}c@mh@kA",
  "k`xmEgty}Wuh@nj@}KkhAjCdFJe@~nDhI~mHt`DnjGwfAnnDjdBxp@cb@`nE{@`pDf`An|Cz_KvKjfIr}BhnFVj_DfoD}YpiBdeAti@p|DtiBlbBhmAbRnBxrAltAhz@de@drCf{@~cAi\\pz@es@|Gbh@|i@n`@h_E}o@bkAmfD~nAgWbUx~CfjFvbByr@uAy|@{vCazDtT{p@|~BoEr_IanE~dBhA~uCay@|yLbPz`B}i@rqAcsA`Fva@lvAxG~_AdaA~o@nwDm|@rg@whBwN{WtbCps@|a@|HhlCvo@dt@|C~{A`}AfbEdtB}ElVrgBrdBz[o`@hkBhKriJafBtq@",
  "}u_jEochzWnbAaBlsA}BvW_FnMwWteAwIueAvIeNfXiWm@oQ~vC}pCrb@eh@tDx^|yA`]ltDeeE|gD~QdcE~QtVtGlaAkY|sDlVk_@dKlg@naAlqAjq@bsCd_B`dAndC`rCld@nQvVaFxGjNr[sO`a@vSnpAxrBf]gg@r]wKhHnQfYf@|\\wXf[l^xAvoA~VvnAjWfj@xxAhq@x@tn@dZlgA{AtsBkb@ziBu^|h@_Nz_AtHtaGc^foAet@jmAeGzu@hGfi@~a@vv@bIpaApcAhnA`@f|B|Tnw@m^p{AxIt_D{V`m@gt@hAq`Alu@~NaO_EhItwAgbByJgpAfPiXeMk|@",
  "_gkiEcq_wWvG|fDijAtoC~p@~xBm@jzAl@kzAeq@gzB|H_}@hu@u|@_Ecs@|C_w@|DkvA`fA}jAaVctDadA}mAgv@qnDWd^aj@uz@ekHj\\oqDii@q`Bq|A}eAuFcpA~cBc_ChcAyt@hAun@s~@weBzLtT{NsT{ZghC}Cgk@{]li@aaBqm@{`@gOmy@y`BteAym@iK{[stBw_CahCkFwmAyuA}dC~Os^|ZqyA|i@sWa}@{|H}z@}dAqmB|t@ahCctAgf@hG}|AujIxGooBgw@a{Bw@e{AsdBmeFeq@qi@a`EwqImQ_cAz`@izDnIceJs{B{}Hqf@`MfG`Dzx@sv@`DtE",
  "wc~kEa||zW~@m@DgGiHc^{Use@?_DoDGIaBq@Ey@AIrFdHBh@iX{LuNaLqKtg@so@aAeC|DaFl@qCwCw@gBeCE{JeCsDGsAh@aA~OwIpBmDlC}BXaCqAwCqa@zV_AMeAl@K~@sCjBsIjDnIsDfC}AViAnAs@t@Nba@kVJc@iByE",
];

// 每一段（景點到景點）的實際道路路線，供各景點縮圖使用
const RT_ROAD_LEGS = [
  [
    "ge~kEace{WFCfBtE?b@JFdAnCMnABF\\\\d@@\\JVT\\t@?lAOf@{@vAAVHh@t@vANl@V^aM`Mk@eAxFeF~@q@",
    "q_~kEi_d{WrDcBoYpWcYzCc^zX{c@aRkvCuNmK{MoLw]xQktAl@gYsCmUgQqm@gBy[jAuQfP}w@d@sb@mEkg@e[io@a@y[iJGnHuDH_R",
    "czglEsjs{WaA_E{FjA_AqBmLvC]hKoLn@wNfTQzI{NpCFvJaCzQmUvj@F~AnS~VDtCoKJeDxBwGnKgLbHs]dLbKwDa@uF",
    "ubllE}vm{W`@tFbPkF`^aZdd@dCyCqWmf@wq@kt@si@{Pcg@sXcWiAoTow@_bA?g^wHiQob@ok@g[kLiAwMqWkZiXa{BeUee@inBytAyc@e~@cp@kf@e`@kcA_L_x@iAeiAxJwt@i[c`@oBej@nSmcAqFwp@sRgHkIak@cx@qf@e~AaScQiXks@iMoEiZq|@hYgj@jb@go@fS}b@pBko@ePyRak@pF{A",
    "yalmEuny|WqFzAgJ{Pgd@ec@yb@gP_e@kz@{@wPrDiYoCmQiQiWDg{@wSwAmPqLcQnEa|A^{Awu@}Jix@jBs]oHue@jBqfA|Ign@kD}ZGuVwM{PwFcOaw@m~@kFeSn@u[rEcPdRy\\fXqSnF}kC{C}c@yR{@mXbHyAwArE{E",
  ],
  [
    "k`xmEgty}W_EbE`B`Ac@bAkLlA?`Aw@~GmA|QkCzJ{Lu@_Ca@@iBbAaD",
    "ajymEwhx}WcA`DAhBoJsDxGq\\oOeAQIc@}CWeFLoGbBeMzBcMvE|AG`@_AS^VMn@s@W",
    "_wymEcrz}WjCbALRXLg@~B",
    "srymE}jz}WJe@",
    "grymEclz}W{FzXhf@~IpoCqY~mHt`DnjGwfAnnDjdBxp@cb@`nE{@`pDf`An|Cz_KvKjfIr}BhnFVj_DfoD}YpiBdeAti@p|DtiBlbBhmAbRnBxrAltAhz@de@drCf{@~cAi\\pz@es@|Gbh@|i@",
    "ekqkEexv{WC~CtBdCpAe@dAcEhBLoDlXMjWpMdHpBfFf@l`AvMrAJxa@uEzS}o@bkAiF`Bq[iAuFl@e}@hu@kJdDab@jH{XnRWc@jJmH",
    "abwkEw{k{W`T{Kdb@mHzIoFrLoLtOx_@tJxJbE`NjVpf@~ElC~Q{AdGvB`KbRdDxNpi@pn@fC`KdBz^mBvQi@[",
    "wvokEene{WuAy|@yz@oqAea@iD{x@gbBtT{p@~}@lK|_A}QlmBupArrC_gAp}@kt@~dBhA~uCay@frAdOprF{SbsBxTz`B}i@rqAcsA`Fva@lvAxG~_AdaA~o@nwD",
    "c~cjE}mq{WFgEiAdKcq@tDgH~[e`ANqg@gOU|bAeWv~@~g@zRpJ`N|HhlCrLfWbb@|[|C~{A|`@ns@b{@vmCdtB}ElFh}@~Nhi@xm@cExu@~a@cKtaAkTrh@bFhrBgCtc@tKhPqI`dAhFf{BicBvYjA~QcD|C",
  ],
  [
    "}u_jEochzWr@bHti@oHdD?~Di@~Jk@",
    "mr}iEqfhzW~TkApNaBhRyDbOq@dJ\\F|F",
    "_~ziEojhzWG}FtRvAhDy@vAuBdEaOpD_Dps@sBtUf@UuF{BU",
    "apwiE_uizWzBTTtFuUg@qs@rBaD`CuE~OmBdCsCh@uRwAkF~`CsC~LoE~FmFtCkQlEcwBnW",
    "ub`jEyvbzWeh@tDzC`^|Yzz@`]ltDk}DbxCyFxN~QdcE~QtVqAhSfJbm@gKdsAp@nh@uNfv@zGuBpMu[_C~DdOla@naAlqAlYlcB|Vtn@n^h^t_Avd@`h@vq@pr@fj@zg@`t@ld@nQvVaFxGjNr[sO`a@vSnpAxrBdToP`HwUr]wKhHnQnMyFvJ`H",
    "akoiEiltxW|FbC|AsT`RgGf[l^vE|TwGrSxCde@|MlZ`Hhs@jWfj@xxAhq@x@tn@hUzi@zCp\\{H`j@~ErhAiWjl@aJn|@u^|h@_Nz_AsEvy@tHzu@kAhu@zJfu@{Anc@c^foAc]d_@aVdm@eGzu@hGfi@~a@vv@Ldh@tHjXpQt\\hc@pVtL`YwDpu@xEteA|Tnw@m^p{AxIt_D{V`m@{Tw@eWlIeFkEq`Alu@",
    "}`niEe`wvWi@B]o@fQuM",
    "}pmiEgpwvWjBsALTqJbHv@bB",
    "}vmiE}ewvWcAyB~NqKnG_@tDcC~HkG`MsMhX_b@vAl@nGeT}@sKGoMu@yHHeLyD_KI_KcAcFTkE`KyFhAqAl@wAVyDm@eEkGcIuEmOMuGvA}R",
  ],
  [
    "_gkiEcq_wWwA|RLtGtElO|FfHv@dDaAlIkMjIUjEbAbFClIfEpLIdLzB|c@oGdTz@`@yBhGR~CsHzJg@hFwHvDuKtPuJtIiKdQeGrd@jIzl@`J~HrClLEfFyClJB`FbM`UnK`AdAxARxEyBzHj@le@{CtO~B|@OpGxFnFaEp@",
    "_ykiEccovW_AwHV{F_C}@pCiMmAie@vCqIEsGeAyAoKaAcMaUCaFxCmJDgFsCmLaJ_IqIcn@bDi^`JaRgEsJ~[uYhX_b@t@{O_DyQkFsPtCd@",
    "ookiEqi{vWsA[aAIqGwRMoA?kARuAh@{BpDmL\\m@~@_AvGuDQa@",
    "qjkiEqa}vWrPwN{Ood@dDca@tIwTjn@gM~K}f@cUwt@]k~BadA}mAgIuaAgc@}y@wG}p@Wd^aj@uz@co@wOaz@lVm`DTq^~ToqDii@sz@{_@qAkWkb@ic@}eAuFcpA~cBc_ApM__Avt@yt@hAun@s~@sz@|LmT}NuTzN",
    "mapjEimpwWmBgFbXsGsT{ZmL`DyzB_I{VgEqCgSyNkC|Rs^tAwj@xRuUqWs\\_UgCgOmy@oRaC_f@`YySte@oQ~HuPmIc\\{@gBmz@cPcVMqKuF~EzCaIgDmRwe@_ScAkVuFiEaDrG}Wc\\kQmr@y^mNkFwmAcV}PkHk]s\\a_@qGe`@cOkS~Os^",
    "ufbkE{sfxW|ZqyA|i@sWgh@irCySqiD_Yms@}`@oPqmB|t@ahCctAgf@hGaTstAiZam@tB{q@gp@ctCxGooBma@ciByT}Pw@e{AsdBmeFeq@qi@gcAiqC}aAqsA{x@{jBmQ_cAhOgs@yCiuAjUwo@nIceJ}_@wkBq~@ikBc[ydBqf@`M",
    "}j`lEep{zW]LaA|AhClC|EwA",
    "ub`lEck{zWlA[bAsArLsD~@k@be@ga@h@i@aCcGhAm@",
    "yh~kEwb}zWiAl@`CbGhB{A",
  ],
  [
    "wc~kEa||zW~@m@DgGiHc^cTgc@w@kA?_DoDGOED{Aq@E",
    "ci_lE_t_{WpFEXmP{LuNaLqKtg@so@aAeC|DaFl@qCwCw@gBeCE{JeCsDGsAh@aA~OwIpBmDlC}BXaCqAwCqa@zV_AMeAl@K~@sCjBsIjDnIsDfC}AViAnAs@t@Nba@kVJc@iByE",
  ],
];

// Google/OSRM encoded polyline 解碼
const rtDecodePoly = (str) => {
  let i = 0, lat = 0, lon = 0;
  const out = [];
  while (i < str.length) {
    let r = 0, sh = 0, b;
    do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32);
    lat += (r & 1) ? ~(r >> 1) : (r >> 1);
    r = 0; sh = 0;
    do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32);
    lon += (r & 1) ? ~(r >> 1) : (r >> 1);
    out.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }
  return out;
};

let _rtCache = null;
const buildRouteChains = (tripData) => {
  if (_rtCache && _rtCache.src === tripData) return _rtCache.val;
  // 優先使用實際道路路徑（OSRM 預先算好的行車路線），沒有才退回直線連點
  const daysPts = (tripData || []).map((d, i) => {
    const road = RT_ROAD_POLY[i];
    if (road) return rtDecodePoly(road);
    return (d.spots || []).filter((s) => typeof s.lat === "number" && typeof s.lon === "number");
  });
  const all = daysPts.flat();
  let val = null;
  if (all.length >= 2) {
    const las = all.map((p) => p.lat);
    const los = all.map((p) => p.lon);
    const minLa = Math.min(...las), maxLa = Math.max(...las);
    const minLo = Math.min(...los), maxLo = Math.max(...los);
    const dLa = maxLa - minLa || 1e-6;
    const dLo = maxLo - minLo || 1e-6;
    const sc = Math.min((RT_W - 2 * RT_PAD) / dLo, (RT_H - 2 * RT_PAD) / dLa);
    const ox = RT_PAD + ((RT_W - 2 * RT_PAD) - dLo * sc) / 2;
    const oy = RT_PAD + ((RT_H - 2 * RT_PAD) - dLa * sc) / 2;
    const P = (p) =>
      (ox + (p.lon - minLo) * sc).toFixed(1) + "," + (oy + (maxLa - p.lat) * sc).toFixed(1);
    const chains = daysPts.map((pts, i) => {
      const prev = i > 0 ? daysPts[i - 1] : null;
      const seq = [...(prev && prev.length ? [prev[prev.length - 1]] : []), ...pts];
      return seq.length >= 2 ? seq.map(P).join(" ") : "";
    });
    val = { chains, allChain: chains.filter(Boolean).join(" ") };
  }
  _rtCache = { src: tripData, val };
  return val;
};

// idx = -1 代表「全部」（整條淡灰）
const RouteThumb = ({ tripData, idx }) => {
  const data = buildRouteChains(tripData);
  if (!data) return null;
  const { chains, allChain } = data;
  const cur = idx >= 0 ? chains[idx] || "" : "";
  const done = idx > 0 ? chains.slice(0, idx).filter(Boolean).join(" ") : "";
  let endPt = null;
  if (cur) {
    const parts = cur.split(" ");
    endPt = parts[parts.length - 1].split(",");
  }
  return (
    <svg
      viewBox={`0 0 ${RT_W} ${RT_H}`}
      width={RT_W}
      height={RT_H}
      className="block mx-auto mb-0.5"
      aria-hidden="true"
    >
      <polyline points={allChain} fill="none" stroke={RT_GRAY} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {done ? (
        <polyline points={done} fill="none" stroke={RT_BRANCH} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {cur ? (
        <polyline points={cur} fill="none" stroke={RT_SPROUT} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {endPt ? (
        <circle cx={endPt[0]} cy={endPt[1]} r="2.8" fill="#ffffff" stroke={RT_SPROUT} strokeWidth="1.8" />
      ) : null}
    </svg>
  );
};

// ------------------------------------------
// 單一景點的路線縮圖
// 淡灰 = 本日所有路線；樹枝咖啡 = 本日已完成路線；新芽綠 = 本景點路線
// ------------------------------------------
const SRT_W = 44;
const SRT_H = 28;
const SRT_PAD = 4;

const _srtCache = {};
const buildSpotRoute = (dayIdx) => {
  if (_srtCache[dayIdx] !== undefined) return _srtCache[dayIdx];
  const raw = RT_ROAD_LEGS[dayIdx];
  let val = null;
  if (raw && raw.length) {
    const legs = raw.map((s) => (s ? rtDecodePoly(s) : []));
    const all = legs.reduce(
      (acc, p, k) => acc.concat(k ? p.slice(1) : p),
      []
    );
    if (all.length >= 2) {
      const las = all.map((p) => p.lat);
      const los = all.map((p) => p.lon);
      const minLa = Math.min(...las), maxLa = Math.max(...las);
      const minLo = Math.min(...los), maxLo = Math.max(...los);
      const dLa = maxLa - minLa || 1e-6;
      const dLo = maxLo - minLo || 1e-6;
      const sc = Math.min((SRT_W - 2 * SRT_PAD) / dLo, (SRT_H - 2 * SRT_PAD) / dLa);
      const ox = SRT_PAD + ((SRT_W - 2 * SRT_PAD) - dLo * sc) / 2;
      const oy = SRT_PAD + ((SRT_H - 2 * SRT_PAD) - dLa * sc) / 2;
      const P = (p) =>
        (ox + (p.lon - minLo) * sc).toFixed(1) + "," + (oy + (maxLa - p.lat) * sc).toFixed(1);
      val = {
        allChain: all.map(P).join(" "),
        legChains: legs.map((p) => (p.length >= 2 ? p.map(P).join(" ") : "")),
        legPts: legs.map((p) => p.map(P)),
      };
    }
  }
  _srtCache[dayIdx] = val;
  return val;
};

// dayIdx = 第幾天（0 起算）；spotIdx = 當天第幾個景點（0 起算）
const SpotRouteThumb = ({ dayIdx, spotIdx }) => {
  const data = buildSpotRoute(dayIdx);
  if (!data) return null;
  // 第一天沒有「前一天最後一站」當起點，所以第 1 個景點沒有抵達路段
  const li = dayIdx === 0 ? spotIdx - 1 : spotIdx;
  const cur = li >= 0 ? data.legChains[li] || "" : "";
  const done =
    li > 0
      ? data.legPts
          .slice(0, li)
          .reduce((acc, p, k) => acc.concat(k ? p.slice(1) : p), [])
          .join(" ")
      : "";
  let endPt = null;
  if (cur) {
    const parts = cur.split(" ");
    endPt = parts[parts.length - 1].split(",");
  }
  return (
    <svg
      viewBox={`0 0 ${SRT_W} ${SRT_H}`}
      width={SRT_W}
      height={SRT_H}
      className="block shrink-0"
      aria-hidden="true"
    >
      <polyline points={data.allChain} fill="none" stroke={RT_GRAY} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {done ? (
        <polyline points={done} fill="none" stroke={RT_BRANCH} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {cur ? (
        <polyline points={cur} fill="none" stroke={RT_SPROUT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {endPt ? (
        <circle cx={endPt[0]} cy={endPt[1]} r="2.6" fill="#ffffff" stroke={RT_SPROUT} strokeWidth="1.6" />
      ) : null}
    </svg>
  );
};

// ==========================================
// 3. 分頁組件 (Tabs)
// ==========================================

// ------------------------------------------
// 景點／住宿 AI 掃雷（原本在「防雷」頁的住宿防雷＋每日景點防雷，合併成景點名稱右邊的一顆按鈕）
// ------------------------------------------
const _spotScanCache = (() => {
  try {
    return JSON.parse(localStorage.getItem("spot_scan_cache") || "{}");
  } catch (e) {
    return {};
  }
})();

// 依名稱關鍵字判斷景點類型，決定要追加哪一組問題
const SCAN_SHOP_RE =
  /(BOOK\s*OFF|BOOKOFF|HARD\s*OFF|HARDOFF|ハードオフ|ブックオフ|HOBBY\s*OFF|ホビーオフ|OFF\s*HOUSE|オフハウス|イオン|AEON|モール|MALL|アウトレット|OUTLET|唐吉訶德|ドン・キホーテ|驛|商店|店)/i;
const SCAN_MUSEUM_RE =
  /(博物館|美術館|科學館|科学館|水族館|動物園|植物園|資料館|記念館|紀念館|展示館|美術センター|展（|展\(|MUSEUM|AQUARIUM|ZOO|館)/i;

// 先判館所再判商店：館所關鍵字較明確，避免「○○館」被「店」規則搶走
const scanKindOf = (name) => {
  if (SCAN_MUSEUM_RE.test(name)) return "museum";
  if (SCAN_SHOP_RE.test(name)) return "shop";
  return "spot";
};

const SpotScanRow = ({ spot, isAccommodation, openKeyModal }) => {
  const Icons = window.Icons;
  const scanKey = spot.sid || spot.name;
  const [result, setResult] = useState(_spotScanCache[scanKey] || "");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const run = async () => {
    if (loading) return;
    setLoading(true);
    setOpen(true);
    try {
      const hotels = window.HOTEL_INFO || [];
      const h = isAccommodation
        ? hotels.find(
            (x) =>
              x.name === spot.name ||
              spot.name.indexOf(x.name) >= 0 ||
              x.name.indexOf(spot.name) >= 0
          )
        : null;
      const prompt = isAccommodation
        ? `請查詢「${spot.name}」${h && h.location ? "(" + h.location + ")" : ""} 的【最新資訊】：
1. Google Maps 最新評分與近期評價摘要（1個月內）
2. 周邊治安與機能（便利商店、餐廳、停車場）
3. 住客常見正面/負面回饋
4. 入住/退房注意事項
請用繁體中文回答，標注資訊來源。`
        : (() => {
            // 第一層：所有景點共用的定位資訊與核心問題
            const kind = scanKindOf(spot.name);
            const head = `請查詢下列地點的【最新即時資訊】。

地點名稱：${spot.name}
GPS 座標：${spot.lat}, ${spot.lon}${
              spot.mapCode ? "\nMapCode：" + spot.mapCode : ""
            }${spot.desc ? "\n行程備註：" + spot.desc : ""}
造訪期間：2027 年 1 月 25 日～1 月 30 日（冬季自駕，注意雪季營業時間縮短、冬季休館）

※ 重要：若名稱是連鎖品牌或名稱不完整，請「以 GPS 座標為準」判斷是哪一家分店，
   並先明確寫出該分店的官方全名（含日文）與完整住所、電話。
   若無法完全確定，請列出座標 500 公尺內最可能的 1～2 家並註明，
   不要反問我、不要要求我補充地址。
※ 查不到的項目請直接寫「官網未載明」，不要臆測。

請回答：
1. 該地點的官方名稱、住所、電話
2. 目前營業狀態（是否正常營業、臨時公告）
3. 近期 Google 評價重點（好評 2 條、雷點 2 條）`;
            const tail =
              kind === "shop"
                ? `4. 營業時間與公休日（造訪期間當天是否營業）
5. 停車場（免費/收費、車位數）
6. 主打商品線：樂高／玩具／模型／公仔／家電／樂器／服飾，
   以及是否有 Hobby Off、Off House、BOOKOFF 等同址併設店
7. 是否可免稅（Tax Free）、是否收信用卡／IC 卡
8. 步行 5 分鐘內的用餐或便利商店`
                : kind === "museum"
                  ? `4. 休館日（日本館所多為週一休；若遇國定假日是否順延至隔天，請明確說明）
5. 開館時間與【最後入館時間】（常比閉館早 30～60 分鐘）
6. 最新門票價格（成人/兒童/優惠），以及造訪期間是否有特別展／企劃展影響票價
7. 是否需要事先線上預約或指定入館時段
8. 若為水族館／動物園：餵食秀、海豚或動物表演的每日時間表
9. 建議停留時間與周邊 2 個平價用餐選擇`
                  : `4. 最新門票價格（成人/兒童/優惠）
5. 建議停留時間與最佳到訪時段
6. 雪天備案（若為戶外景點：積雪、冬季休館、縮短營業）
7. 周邊 3 個高評價平價美食推薦（含 Google 評分）`;
            return head + "\n" + tail + "\n請用繁體中文回答，標注查詢日期與資訊來源。";
          })();
      const res = await generateGeminiContent(prompt, null, true);
      setResult(res);
      _spotScanCache[scanKey] = res;
      try {
        localStorage.setItem("spot_scan_cache", JSON.stringify(_spotScanCache));
      } catch (e) {}
    } catch (e) {
      setResult("分析失敗");
      if (e.message.indexOf("NO_API_KEY") >= 0 || e.message === "BAD_API_KEY") {
        if (openKeyModal) openKeyModal(true);
      } else if (e.message.indexOf("QUOTA_EXHAUSTED") === 0) {
        alert("⏳ Gemini 配額用完，請稍後再試或明天 16:00 重置");
      }
    }
    setLoading(false);
  };

  const accent = isAccommodation ? "#E4C2C1" : "#E8D595";

  return (
    <div className="mb-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-2xl font-black text-gray-900">{spot.name}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={run}
            disabled={loading}
            title={isAccommodation ? "AI 住宿防雷" : "AI 景點防雷"}
            className="flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg font-bold text-[11px] shadow-sm transition-all hover:text-white"
            style={{ color: accent, borderColor: accent + "88" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = accent)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >
            {loading ? (
              <Icons.Loader2 size={12} className="animate-spin" />
            ) : (
              <Icons.Shield size={12} />
            )}
            AI 掃雷
          </button>
          {result && !loading ? (
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-[11px] font-bold text-gray-400 px-1.5 py-1.5"
            >
              {open ? "收合" : "展開"}
            </button>
          ) : null}
        </div>
      </div>
      {open && (loading || result) ? (
        <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 leading-relaxed">
          {loading ? (
            <span className="flex items-center gap-2">
              <Icons.Loader2 size={12} className="animate-spin" /> 分析中...
            </span>
          ) : (
            <MarkdownRenderer content={result} />
          )}
        </div>
      ) : null}
    </div>
  );
};

const ItineraryTab = ({
  tripData,
  selectedDay,
  setSelectedDay,
  dayStartTimes,
  handleDayStartTimeChange,
  handleDepartureToggle,
  handleTransportToggle,
  handleStayChangeNew,
  openExpenseModal,
  transportModes,
  expenses,
  getTicketCounts,
  updateSpotTicketCount,
  STAY_OPTIONS,
  getMatchingItems,
  scanSpotNearby,
  openChainFinder,
  ticketOverrides,
  handleManualTicketEdit,
  isTicketEstimating,
  openKeyModal,
}) => {
  const Icons = window.Icons;
  const filteredTripData =
    selectedDay === "all"
      ? tripData
      : tripData.filter((day) => day.dayId === selectedDay);

  return (
    <div className="animate-in fade-in duration-700 pb-20">
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar sticky top-20 z-30 bg-[#F9F7F5]/90 backdrop-blur-sm py-2 -mx-4 px-4">
        <button
          onClick={() => setSelectedDay("all")}
          className={`px-2 pt-1.5 pb-1 rounded-xl font-bold text-sm border transition-all ${
            selectedDay === "all"
              ? "bg-white text-gray-800 border-gray-200 shadow-sm"
              : "bg-transparent text-gray-400 border-transparent hover:bg-white/50"
          }`}
        >
          <RouteThumb tripData={tripData} idx={-1} />
          全部
        </button>
        {tripData.map((day, di) => (
          <button
            key={day.dayId}
            onClick={() => setSelectedDay(day.dayId)}
            className={`px-2 pt-1.5 pb-1 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
              selectedDay === day.dayId
                ? `bg-white text-gray-800 border-gray-200 shadow-md transform scale-105`
                : "text-gray-400 border-transparent hover:bg-white/50"
            }`}
          >
            <RouteThumb tripData={tripData} idx={di} />
            {day.date.split(" ")[0]}
          </button>
        ))}
      </div>

      <div className="space-y-12">
        {filteredTripData.map((day) => (
          <div key={day.dayId} className="relative">
            <div className="flex items-center gap-4 mb-6 px-2">
              <div
                className={`${day.themeColor} w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-white shadow-md border-2 border-white -rotate-3`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                  Day
                </span>
                <span className="text-xl font-black leading-none">
                  {day.dayId.replace("day", "")}
                </span>
              </div>
              <div>
                <div className="text-2xl font-black text-gray-800">
                  {day.date}
                </div>
                <div className="text-sm font-bold text-gray-400">
                  {day.title}
                </div>
              </div>
              <DayProgress spots={day.spots} />
            </div>

            <div className="space-y-0 pl-6 border-l-2 border-dashed border-gray-300 ml-9 relative pb-4">
              {day.spots.map((spot, index) => {
                const spotExpenses = expenses[spot.id] || [];
                const spotTotal = spotExpenses.reduce(
                  (sum, r) => sum + (r.amount || 0),
                  0
                );
                const counts = getTicketCounts(spot.id);
                // Merge AI ticket info
                const currentTicket = getTicket(spot, ticketOverrides);
                const isAccommodation = isHotel(spot.name);
                
                // 統一處理：景點門票或住宿費用
                const hasCostInfo = currentTicket && (currentTicket.adult > 0 || currentTicket.child > 0);
                const ticketTotal = hasCostInfo
                  ? isAccommodation
                    ? currentTicket.adult * counts.adult // 住宿：房價×房數
                    : currentTicket.adult * counts.adult + currentTicket.child * counts.child // 門票
                  : 0;

                const isWalk = transportModes[spot.id] === "walk";

                // 今日進度（與 DayProgress 連動）
                const dayTotal = day.spots.length;
                const dayDone = day.spots.filter((s) => s.isDeparted).length;
                const dayRemaining = dayTotal - dayDone;

                return (
                  <div key={spot.id} className="relative group mb-10 last:mb-0">
                    <div
                      className={`absolute -left-[31px] top-8 w-5 h-5 rounded-full border-4 z-10 transition-all ${
                        spot.isDeparted
                          ? "bg-gray-400 border-gray-200"
                          : "bg-white border-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.2)]"
                      }`}
                    ></div>
                    <div
                      className={`rounded-2xl p-6 mb-0 border-2 transition-all shadow-md ${
                        spot.isDeparted
                          ? "opacity-60 bg-gray-50 grayscale border-gray-200"
                          : "bg-white border-gray-200 hover:border-indigo-300 hover:shadow-lg"
                      }`}
                    >
                      {/* 時間顯示 + 今日進度徽章 */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-baseline gap-2 bg-gray-100 px-4 py-2 rounded-xl border border-gray-200 inline-flex">
                          <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                            {index === 0 ? "出發" : "抵達"}
                          </span>
                          {index === 0 ? (
                            <input
                              type="time"
                              value={dayStartTimes[day.dayId] || day.defaultStart || "09:00"}
                              onChange={(e) =>
                                handleDayStartTimeChange(day.dayId, e.target.value)
                              }
                              className="bg-transparent font-mono font-black text-2xl text-gray-900 w-24 outline-none"
                            />
                          ) : (
                            <span className="font-mono font-black text-2xl text-gray-900">
                              {spot.time}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                        <SpotRouteThumb
                          dayIdx={parseInt(day.dayId.replace("day", ""), 10) - 1}
                          spotIdx={index}
                        />
                        <div
                          className={`text-right shrink-0 px-3 py-1.5 rounded-xl border-2 ${
                            dayRemaining === 0
                              ? "bg-green-50 border-green-200"
                              : "bg-indigo-50 border-indigo-100"
                          }`}
                        >
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                            今日進度 · 第 {index + 1}/{dayTotal} 站
                          </div>
                          <div
                            className={`text-sm font-black ${
                              dayRemaining === 0
                                ? "text-green-600"
                                : "text-indigo-600"
                            }`}
                          >
                            {dayRemaining === 0
                              ? "✅ 今日完成"
                              : `已完成 ${dayDone} · 還剩 ${dayRemaining} 站`}
                          </div>
                        </div>
                        </div>
                      </div>

                      <div>
                        {/* 景點名稱 - 加大加粗 + AI 掃雷 */}
                        <SpotScanRow
                          spot={spot}
                          isAccommodation={isAccommodation}
                          openKeyModal={openKeyModal}
                        />
                        <div className="flex items-center gap-4 text-sm font-bold text-gray-600 mb-4">
                          <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg border border-gray-200">
                            <Icons.Clock size={12} />
                            <span>停留</span>
                            <select
                              value={spot.stay}
                              onChange={(e) =>
                                handleStayChangeNew(spot.id, e.target.value)
                              }
                              className="bg-transparent text-[#E4C2C1] outline-none font-bold cursor-pointer"
                              disabled={spot.isDeparted}
                            >
                              {STAY_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* === 費用顯示區（門票 or 住宿） === */}
                        {hasCostInfo ? (
                          <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl mb-4">
                            {isAccommodation ? (
                              /* 住宿費用顯示 */
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-xs">
                                  <div className="flex items-center gap-1 text-gray-600">
                                    <Icons.Hotel size={14} className="text-[#A9BFA8]" />
                                    <span>住宿費</span>
                                    <span className="font-mono font-bold text-[#E4C2C1]">¥{currentTicket.adult.toLocaleString()}</span>
                                    <span className="text-gray-400">×</span>
                                    <div className="flex items-center bg-white border rounded-lg px-1 shadow-sm">
                                      <button onClick={() => updateSpotTicketCount(spot.id, "adult", -1)} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-gray-300 rounded-xl text-xl text-gray-700 active:bg-gray-200 shadow-sm font-bold">-</button>
                                      <span className="text-gray-900 font-black px-2 text-lg">{counts.adult}</span>
                                      <button onClick={() => updateSpotTicketCount(spot.id, "adult", 1)} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-gray-300 rounded-xl text-xl text-gray-700 active:bg-gray-200 shadow-sm font-bold">+</button>
                                    </div>
                                    <span className="text-gray-400">晚</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-mono font-bold text-[#E4C2C1]">共 ¥{ticketTotal.toLocaleString()}</span>
                                  <button onClick={() => handleManualTicketEdit(spot.id)} className="text-gray-300 hover:text-gray-500"><Icons.Edit size={12} /></button>
                                </div>
                              </div>
                            ) : (
                              /* 門票費用顯示 */
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs">
                                    <div className="flex items-center gap-1 text-gray-600">
                                      <Icons.Ticket size={14} className="text-[#E4C2C1]" />
                                      <span>成人票</span>
                                      <span className="font-mono font-bold text-[#E4C2C1]">¥{currentTicket.adult.toLocaleString()}</span>
                                      <span className="text-gray-400">×</span>
                                      <div className="flex items-center bg-white border rounded-lg px-1 shadow-sm">
                                        <button onClick={() => updateSpotTicketCount(spot.id, "adult", -1)} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-gray-300 rounded-xl text-xl text-gray-700 active:bg-gray-200 shadow-sm font-bold">-</button>
                                        <span className="text-gray-900 font-black px-2 text-lg">{counts.adult}</span>
                                        <button onClick={() => updateSpotTicketCount(spot.id, "adult", 1)} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-gray-300 rounded-xl text-xl text-gray-700 active:bg-gray-200 shadow-sm font-bold">+</button>
                                      </div>
                                    </div>
                                    {currentTicket.child > 0 && (
                                      <div className="flex items-center gap-1 text-gray-600">
                                        <span>兒童票</span>
                                        <span className="font-mono font-bold text-[#A9BFA8]">¥{currentTicket.child.toLocaleString()}</span>
                                        <span className="text-gray-400">×</span>
                                        <div className="flex items-center bg-white border rounded-lg px-1 shadow-sm">
                                          <button onClick={() => updateSpotTicketCount(spot.id, "child", -1)} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-gray-300 rounded-xl text-xl text-gray-700 active:bg-gray-200 shadow-sm font-bold">-</button>
                                          <span className="text-gray-900 font-black px-2 text-lg">{counts.child}</span>
                                          <button onClick={() => updateSpotTicketCount(spot.id, "child", 1)} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-gray-300 rounded-xl text-xl text-gray-700 active:bg-gray-200 shadow-sm font-bold">+</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {!(spot.ticket && spot.ticket.locked) && (<button onClick={() => handleManualTicketEdit(spot.id)} className="text-gray-300 hover:text-gray-500 shrink-0"><Icons.Edit size={12} /></button>)}
                                </div>
                                <div className="text-right text-sm font-mono font-bold text-[#E4C2C1]">共 ¥{ticketTotal.toLocaleString()}</div>
                              </div>
                            )}
                            {ticketOverrides[spot.id] && !(spot.ticket && spot.ticket.locked) && (
                              <div className="text-right text-[9px] text-[#A9BFA8] italic mt-1">AI 估算</div>
                            )}
                          </div>
                        ) : (
                          !isAccommodation && (
                            <div className="text-[10px] text-gray-300 mb-4 flex items-center gap-1">
                              <Icons.Ticket size={12} /> {spot.ticket && spot.ticket.locked ? "免費（已確認）" : isTicketEstimating ? "AI 估價中..." : "免費 / 待估價"}
                            </div>
                          )
                        )}

                        <p className="text-sm text-gray-500 mb-2 leading-relaxed">
                          {spot.desc}
                        </p>
                        {/* 免税標示 */}
              {spot.taxFree && (
                <div className={`mb-3 p-3 rounded-xl border-2 ${
                  spot.taxFree.ok === true ? "bg-emerald-50 border-emerald-200"
                  : spot.taxFree.ok === false ? "bg-rose-50 border-rose-200"
                  : "bg-gray-50 border-gray-200"
                }`}>
                  <div className={`flex items-center gap-2 text-xs font-black ${
                    spot.taxFree.ok === true ? "text-emerald-800"
                    : spot.taxFree.ok === false ? "text-rose-800" : "text-gray-600"
                  }`}>
                    <span className="text-base">
                      {spot.taxFree.ok === true ? "🟢" : spot.taxFree.ok === false ? "🔴" : "⚪"}
                    </span>
                    <span>
                      {spot.taxFree.ok === true ? "可免税（未税滿 ¥5,000・帶護照）"
                        : spot.taxFree.ok === false ? "不可免税" : "免税未確認"}
                    </span>
                  </div>
                  <div className={`text-[11px] mt-1 leading-relaxed ${
                    spot.taxFree.ok === true ? "text-emerald-700"
                    : spot.taxFree.ok === false ? "text-rose-700" : "text-gray-500"
                  }`}>
                    {spot.taxFree.note}
                  </div>
                </div>
              )}

              {/* 步行順買提醒 */}
                        {spot.walkBuy && (
                          <a href={spot.walkBuy.url} target="_blank" rel="noreferrer"
                            className="block mb-3 p-3 bg-amber-50 rounded-xl border-2 border-amber-200 active:scale-95 transition">
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                              <span className="text-base">🚶</span>
                              <span className="flex-1">順路：步行 {spot.walkBuy.min} 分到 {spot.walkBuy.name}</span>
                              <span>🗺️</span>
                            </div>
                            <div className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                              <div className="font-bold mb-0.5">🛍️ 記得買：</div>
                              {(spot.walkBuy.items || [spot.walkBuy.item]).filter(Boolean).map((it, i) => (
                                <div key={i} className="pl-3">・{it}</div>
                              ))}
                              {spot.walkBuy.note && <div className="mt-1 text-amber-800 font-bold">💡 {spot.walkBuy.note}</div>}
                            </div>
                          </a>
                        )}
                        {/* MapCode + 車程 */}
                        {(spot.mapCode || spot.driveTime) && (
                          <div className="flex flex-wrap gap-2 mb-4 text-xs">
                            {spot.mapCode && (
                              <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-mono font-bold border border-blue-200">
                                MC {spot.mapCode}
                              </span>
                            )}
                            {spot.driveTime && (
                              <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded-lg font-bold border border-green-200">
                                🚗 {spot.driveTime}
                              </span>
                            )}
                          </div>
                        )}

                        {/* 購物提醒徽章 */}
                        {getMatchingItems(spot.name).length > 0 && (
                          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 mb-4 animate-pulse">
                            <div className="text-xs font-bold text-amber-700 mb-1">🛒 這裡可以買！</div>
                            <div className="flex flex-wrap gap-1">
                              {getMatchingItems(spot.name).map(item => (
                                <span key={item.id} className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-bold">
                                  {item.icon} {item.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <a
                            href={spot.gmapLink}
                            target="_blank"
                            className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:bg-gray-200 transition border-2 border-gray-200"
                          >
                            <Icons.MapPin
                              size={14}
                              className="text-[#A9BFA8]"
                            />{" "}
                            地圖
                          </a>
                          <button
                            onClick={() => scanSpotNearby(spot.lat, spot.lon, spot.name)}
                            className="flex-1 bg-amber-50 text-amber-700 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:bg-amber-100 transition border-2 border-amber-200"
                          >
                            <Icons.Search size={14} /> 附近買
                          </button>
                          <button
                            onClick={() => openExpenseModal(spot)}
                            className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:bg-gray-200 transition border-2 border-gray-200"
                          >
                            <Icons.Wallet size={14} /> 記帳
                          </button>
                        </div>

                        {(spotTotal > 0 || ticketTotal > 0) && (
                          <div className="mt-3 pt-3 border-t-2 border-gray-200 text-right">
                            <span className="text-xs text-gray-500 mr-2 font-bold">
                              小計
                            </span>
                            <span className="text-xl font-mono font-black text-indigo-700">
                              NT${(spotTotal + ticketTotal).toLocaleString()}
                            </span>
                          </div>
                        )}

                        {/* 確認動身 - 滿版大按鈕 */}
                        <button
                          onClick={() => handleDepartureToggle(spot.id)}
                          className={`w-full mt-5 py-4 rounded-xl font-black text-lg shadow-lg transition-all active:scale-95 ${
                            spot.isDeparted
                              ? "bg-green-600 text-white shadow-green-600/30"
                              : "bg-gray-900 text-white shadow-gray-900/30"
                          }`}
                        >
                          {spot.isDeparted
                            ? `✅ 已動身 ${spot.actualDepTime}`
                            : "確認動身"}
                        </button>
                      </div>
                    </div>

                    {spot.nextStop && (
                      <div className="py-4 flex flex-col items-center">
                        <div className="bg-white border-2 border-indigo-200 rounded-2xl p-4 w-full max-w-[280px] text-center shadow-md relative z-10">
                          <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex justify-between px-2">
                            <span>NEXT</span>
                            <span>{spot.nextStop.distance}</span>
                          </div>
                          <div className="text-xs font-bold text-gray-700 truncate mb-2">
                            {spot.nextStop.name}
                          </div>
                          <div className="h-px bg-gray-100 w-full mb-2"></div>
                          <div className="flex justify-between items-center px-1">
                            <button
                              onClick={() => handleTransportToggle(spot.id)}
                              className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors ${
                                isWalk
                                  ? "text-orange-400 bg-orange-50"
                                  : "text-[#A9BFA8] bg-[#A9BFA8]/10"
                              }`}
                            >
                              {isWalk ? (
                                <Icons.Footprints size={14} />
                              ) : (
                                <Icons.Car size={14} />
                              )}
                              {isWalk
                                ? spot.nextStop.walkTime
                                : spot.nextStop.driveTime}
                            </button>
                            <button
                              onClick={() => {
                                const curSpot = spot;
                                const nextData = spot.nextStop;
                                openChainFinder(
                                  {
                                    name: curSpot.name,
                                    lat: curSpot.lat,
                                    lon: curSpot.lon,
                                    time: curSpot.time,
                                    stay: curSpot.stay,
                                    actualDepTime: curSpot.actualDepTime,
                                  },
                                  { name: nextData.name, lat: nextData.lat, lon: nextData.lon }
                                );
                              }}
                              className="flex items-center gap-1 bg-orange-50 text-orange-600 px-3 py-2.5 rounded-xl font-bold active:scale-95 transition-transform text-sm border-2 border-orange-200"
                            >
                              🍚
                            </button>
                            <a
                              href={spot.nextStop.navLink}
                              target="_blank"
                              className="flex items-center gap-1 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg active:scale-95 transition-transform text-sm"
                            >
                              導航
                            </a>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-gray-400 mt-2 bg-white px-2 py-0.5 rounded-full border border-gray-100 shadow-sm">
                          預計 {spot.nextArrivalTime} 抵達
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- 出發前核對清單 ---
const TripChecklist = () => {
  const Icons = window.Icons;
  const groups = window.CHECKLIST || [];
  const [checked, setChecked] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem("checklist_state") || "{}");
    } catch (e) {
      return {};
    }
  });
  const [openGroup, setOpenGroup] = React.useState(groups[0] ? groups[0].id : "");

  React.useEffect(() => {
    localStorage.setItem("checklist_state", JSON.stringify(checked));
  }, [checked]);

  const toggle = (key) =>
    setChecked((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });

  const allItems = groups.reduce((n, g) => n + g.items.length, 0);
  const doneItems = groups.reduce(
    (n, g) => n + g.items.filter((it) => checked[g.id + "." + it.id]).length,
    0
  );
  const pct = allItems ? Math.round((doneItems / allItems) * 100) : 0;
  const missingCritical = groups
    .flatMap((g) =>
      g.items
        .filter((it) => it.critical && !checked[g.id + "." + it.id])
        .map((it) => it.text)
    );

  return (
    <div className="glass-panel p-6 rounded-3xl bg-white border-gray-100 shadow-lg">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
          ✅ 出發前核對清單
        </h3>
        <span className="text-sm font-black text-gray-700">
          {doneItems}/{allItems}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
        <div
          className="h-full bg-[#A9BFA8] transition-all duration-500"
          style={{ width: pct + "%" }}
        />
      </div>

      {missingCritical.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700 leading-relaxed">
          <div className="font-black mb-1">
            ⚠️ 還有 {missingCritical.length} 項關鍵物品未確認
          </div>
          {missingCritical.slice(0, 3).map((t, i) => (
            <div key={i}>・{t}</div>
          ))}
          {missingCritical.length > 3 && (
            <div className="text-red-500">…等 {missingCritical.length} 項</div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {groups.map((g) => {
          const done = g.items.filter((it) => checked[g.id + "." + it.id]).length;
          const open = openGroup === g.id;
          return (
            <div
              key={g.id}
              className="border border-gray-200 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setOpenGroup(open ? "" : g.id)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <span className="font-bold text-[13px] text-gray-800">
                  {g.icon} {g.title}
                </span>
                <span
                  className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                    done === g.items.length
                      ? "bg-[#A9BFA8] text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {done}/{g.items.length}
                </span>
              </button>
              {open && (
                <div className="p-2 space-y-1">
                  {g.items.map((it) => {
                    const key = g.id + "." + it.id;
                    const on = !!checked[key];
                    return (
                      <label
                        key={it.id}
                        className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                          on ? "bg-green-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(key)}
                          className="mt-0.5 w-5 h-5 accent-[#A9BFA8] shrink-0"
                        />
                        <span
                          className={`text-[13px] leading-relaxed ${
                            on
                              ? "line-through text-gray-400"
                              : it.critical
                              ? "text-gray-800 font-bold"
                              : "text-gray-700"
                          }`}
                        >
                          {it.critical && !on && (
                            <span className="text-red-500 mr-1">必備</span>
                          )}
                          {it.text}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => {
          if (confirm("確定要清空所有勾選嗎？")) setChecked({});
        }}
        className="mt-4 text-[11px] text-gray-400 underline"
      >
        清空全部勾選
      </button>
    </div>
  );
};

// --- 租車臨櫃填寫用：飯店日文資料 ---
const HotelDeskCard = () => {
  const hotels = window.HOTEL_INFO || [];
  const [copiedKey, setCopiedKey] = React.useState("");

  const copyText = (text, key) => {
    const done = () => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallback(text, done));
    } else fallback(text, done);
  };
  const fallback = (text, done) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch (e) {}
    document.body.removeChild(ta);
  };

  return (
    <div className="glass-panel p-6 rounded-3xl bg-white border-2 border-[#E4C2C1] shadow-lg">
      <h3 className="font-bold text-lg mb-1 text-gray-800">
        🚗 租車櫃檯填表用｜飯店日文資料
      </h3>
      <p className="text-[12px] text-gray-500 leading-relaxed mb-4">
        ORIX 租車契約書會要求填「日本國內聯絡處」。<b>只要填第一晚（1/25 神戶元町）即可</b>，
        其餘備查。日文名稱與住址可直接照抄給櫃檯。
      </p>
      <div className="space-y-3">
        {hotels.map((h, i) => (
          <div
            key={i}
            className={`p-4 rounded-2xl border ${
              i === 0
                ? "bg-[#FDF6F5] border-[#E4C2C1]"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded text-white ${
                  i === 0 ? "bg-[#D89B99]" : "bg-gray-400"
                }`}
              >
                {h.day}
                {i === 0 ? "・租車填這個" : ""}
              </span>
              <span className="text-[12px] font-bold text-gray-600">
                {h.name}
              </span>
            </div>
            <div className="space-y-1.5 text-[13px] text-gray-800 leading-relaxed select-all">
              <div>
                <span className="text-gray-400 text-[11px] mr-1">ホテル名</span>
                <b>{h.jpName}</b>
              </div>
              <div>
                <span className="text-gray-400 text-[11px] mr-1">住所</span>
                {h.zip} {h.jpAddress}
              </div>
              <div>
                <span className="text-gray-400 text-[11px] mr-1">TEL</span>
                <a href={`tel:${h.tel}`} className="text-blue-600 underline">
                  {h.tel}
                </a>
              </div>
              {h.booking ? (
                <div className="mt-2 p-2 rounded-lg bg-green-50 border border-green-200 text-[11px] text-green-900 leading-relaxed">
                  ✅ 已訂（{h.booking.via}）{h.booking.room}・{h.booking.guests}<br />入住 {h.booking.checkIn} 起・退房 {h.booking.checkOut} 前{h.booking.price ? <>・<b>¥{h.booking.price.toLocaleString()}</b></> : null}<br />{h.booking.pay}・{h.booking.cancelBy}
                </div>
              ) : (
                <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-800 font-bold">❗ 尚未訂房</div>
              )}
              {h.note && (
                <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-bold leading-relaxed">
                  📌 {h.note}
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() =>
                  copyText(
                    h.jpName + "\n" + h.zip + " " + h.jpAddress + "\nTEL " + h.tel,
                    "h" + i
                  )
                }
                className="flex-1 py-2 rounded-xl bg-gray-800 text-white text-[12px] font-bold hover:bg-gray-700 transition-colors"
              >
                {copiedKey === "h" + i ? "✓ 已複製" : "複製全部"}
              </button>
              <button
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lon}`,
                    "_blank"
                  )
                }
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-[12px] font-bold hover:bg-gray-200 transition-colors"
              >
                地圖
              </button>
            </div>
            {h.mapCode && (
              <div className="mt-2 text-[11px] text-gray-500">
                車機 MapCode：<b className="text-gray-700">{h.mapCode}</b>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-800 leading-relaxed">
        櫃檯還會要求填「台灣的地址與電話」。建議出發前先把中英文住址與手機號碼
        （國際碼寫成 +886-9xx-xxx-xxx）存進手機備忘錄，臨櫃直接抄。
      </div>
    </div>
  );
};

// --- ❄️ 雪況預警：氣象廳警報注意報 + 沿線降雪預報（取代九州版颱風模組） ---
const DAY_COLORS = ["#4C86C6", "#E4735A", "#5FA86E", "#E0A94F", "#8E6BC6", "#3AA6A0"];

const haversineKm = (a, b, c, d) => {
  const R = 6371;
  const t = Math.PI / 180;
  const dLat = (c - a) * t;
  const dLon = (d - b) * t;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a * t) * Math.cos(c * t) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

const TRIP_YEAR = 2027;

// "1/26 (二)" -> "2027-01-26"
const ymdOfTripDate = (s) => {
  const m = String(s || "").match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!m) return null;
  return `${TRIP_YEAR}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
};

const todayYmdJst = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};
const addDaysYmd = (ymd, n) => {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// 氣象廳 警報・注意報代碼（令和8年新制 r8 JSON 沿用的氣象警報代碼）
const JMA_WARN_CODES = {
  "02": { t: "暴風雪警報", lv: 3, snow: true },
  "03": { t: "大雨警報", lv: 3 },
  "04": { t: "洪水警報", lv: 3 },
  "05": { t: "暴風警報", lv: 3 },
  "06": { t: "大雪警報", lv: 3, snow: true },
  "07": { t: "波浪警報", lv: 3 },
  "08": { t: "高潮警報", lv: 3 },
  "10": { t: "大雨注意報", lv: 2 },
  "12": { t: "大雪注意報", lv: 2, snow: true },
  "13": { t: "風雪注意報", lv: 2, snow: true },
  "14": { t: "雷注意報", lv: 1 },
  "15": { t: "強風注意報", lv: 2 },
  "16": { t: "波浪注意報", lv: 1 },
  "17": { t: "融雪注意報", lv: 1, snow: true },
  "18": { t: "洪水注意報", lv: 1 },
  "19": { t: "高潮注意報", lv: 1 },
  "20": { t: "濃霧注意報", lv: 1 },
  "21": { t: "乾燥注意報", lv: 1 },
  "22": { t: "なだれ注意報", lv: 2, snow: true },
  "23": { t: "低温注意報", lv: 2, snow: true },
  "24": { t: "霜注意報", lv: 1, snow: true },
  "25": { t: "着氷注意報", lv: 2, snow: true },
  "26": { t: "着雪注意報", lv: 2, snow: true },
  "32": { t: "暴風雪特別警報", lv: 4, snow: true },
  "33": { t: "大雨特別警報", lv: 4 },
  "35": { t: "暴風特別警報", lv: 4 },
  "36": { t: "大雪特別警報", lv: 4, snow: true },
};
const warnMeta = (code) => JMA_WARN_CODES[code] || { t: "警報・注意報(" + code + ")", lv: 1 };
const JMA_OFFICE_NAME = { "280000": "兵庫縣", "310000": "鳥取縣", "330000": "岡山縣" };
const jmaWarnPage = (office) =>
  `https://www.jma.go.jp/bosai/warning/#area_type=offices&area_code=${office}&lang=ja`;

// 抓氣象廳 r8 警報 JSON（新版；舊版 /data/warning/ 已於 2026/5 停止更新）
const fetchJmaWarnings = async (offices) => {
  const out = {};
  for (const off of offices) {
    try {
      const r = await fetch(`https://www.jma.go.jp/bosai/warning/data/r8/${off}.json`, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      const reports = Array.isArray(j) ? j : Object.values(j || {});
      const latest = reports
        .filter((x) => x && x.reportDatetime && x.warning)
        .sort((a, b) => (a.reportDatetime < b.reportDatetime ? 1 : -1))[0];
      const areas = {};
      ((latest && latest.warning && latest.warning.class10Items) || []).forEach((it) => {
        areas[it.areaCode] = (it.kinds || [])
          .filter((k) => k.code && (k.status === "発表" || k.status === "継続"))
          .map((k) => ({ code: k.code, status: k.status, ...warnMeta(k.code) }));
      });
      out[off] = {
        ok: true,
        time: latest ? latest.reportDatetime : "",
        headline: latest ? latest.headlineText || "" : "",
        areas,
      };
    } catch (e) {
      out[off] = { ok: false, err: String((e && e.message) || e), areas: {} };
    }
  }
  return out;
};

// Open-Meteo：沿線檢查點的降雪／氣溫預報（免金鑰、允許跨網域）
const fetchSnowForecast = async (points) => {
  if (!points.length) return [];
  const lat = points.map((p) => p.lat).join(",");
  const lon = points.map((p) => p.lon).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=snowfall_sum,temperature_2m_min,temperature_2m_max,precipitation_sum` +
    `&current=temperature_2m,snow_depth,snowfall&timezone=Asia%2FTokyo&forecast_days=16`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("Open-Meteo " + r.status);
  const j = await r.json();
  const arr = Array.isArray(j) ? j : [j];
  return arr.map((x, i) => ({ ...points[i], daily: x.daily || {}, current: x.current || {} }));
};

const snowLevel = ({ snowCm, tmin, warnLv, warnSnow }) => {
  if ((warnSnow && warnLv >= 3) || snowCm >= 10) return "high";
  if ((warnSnow && warnLv >= 2) || snowCm >= 3 || (tmin != null && tmin <= -2)) return "medium";
  if (snowCm > 0 || (tmin != null && tmin <= 0)) return "watch";
  return "low";
};
const LEVEL_STYLE = {
  high: { dot: "🔴", label: "高風險", cls: "bg-red-50 border-red-300 text-red-800", color: "#dc2626" },
  medium: { dot: "🟡", label: "注意", cls: "bg-amber-50 border-amber-300 text-amber-800", color: "#f59e0b" },
  watch: { dot: "🔵", label: "留意結冰", cls: "bg-sky-50 border-sky-200 text-sky-800", color: "#0ea5e9" },
  low: { dot: "🟢", label: "大致安全", cls: "bg-emerald-50 border-emerald-200 text-emerald-800", color: "#10b981" },
  static_high: { dot: "🔴", label: "高風險（歷年）", cls: "bg-red-50 border-red-200 text-red-800", color: "#dc2626" },
  static_medium: { dot: "🟡", label: "中風險（歷年）", cls: "bg-amber-50 border-amber-200 text-amber-800", color: "#f59e0b" },
  static_low: { dot: "🟢", label: "低風險（歷年）", cls: "bg-emerald-50 border-emerald-200 text-emerald-800", color: "#10b981" },
};

const SnowRiskMap = () => {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const ptLayer = useRef(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState("loading"); // loading | ok | error
  const [err, setErr] = useState("");
  const [warn, setWarn] = useState({});
  const [fc, setFc] = useState([]);
  const [stamp, setStamp] = useState("");

  const routes = window.WINTER_ROUTES || [];
  const days = (window.RAW_KML_DATA || []).map((d, i) => ({
    dayId: d.dayId,
    date: d.date,
    title: d.title,
    color: DAY_COLORS[i % DAY_COLORS.length],
    pts: (d.spots || []).filter((s) => s.lat && s.lon).map((s) => ({ lat: s.lat, lon: s.lon, name: s.name })),
  }));

  const checkpoints = useMemo(() => {
    const seen = {};
    const list = [];
    routes.forEach((r) =>
      (r.checkpoints || []).forEach((c) => {
        const k = c.lat.toFixed(3) + "," + c.lon.toFixed(3);
        if (!seen[k]) {
          seen[k] = true;
          list.push({ n: c.n, lat: c.lat, lon: c.lon });
        }
      })
    );
    return list;
  }, []);

  const offices = useMemo(() => {
    const s = {};
    routes.forEach((r) => (r.jmaAreas || []).forEach((a) => (s[a.office] = true)));
    return Object.keys(s);
  }, []);

  // 地圖（只建一次）
  useEffect(() => {
    if (!window.L || !mapEl.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(mapEl.current, { scrollWheelZoom: false });
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 18,
    }).addTo(map);
    const all = [];
    days.forEach((d) => {
      const ll = d.pts.map((p) => [p.lat, p.lon]);
      if (!ll.length) return;
      all.push(...ll);
      L.polyline(ll, { color: d.color, weight: 4, opacity: 0.8 }).addTo(map);
    });
    if (all.length) map.fitBounds(all, { padding: [20, 20] });
    else map.setView([35.1, 134.3], 8);
    setReady(true);
    setTimeout(() => map.invalidateSize(), 200);
  }, []);

  const load = React.useCallback(() => {
    setState("loading");
    setErr("");
    Promise.allSettled([fetchJmaWarnings(offices), fetchSnowForecast(checkpoints)]).then(([w, f]) => {
      if (w.status === "fulfilled") setWarn(w.value);
      if (f.status === "fulfilled") setFc(f.value);
      if (w.status === "rejected" && f.status === "rejected") {
        setErr(String(f.reason && f.reason.message));
        setState("error");
      } else setState("ok");
      setStamp(new Date().toLocaleString("zh-TW", { hour12: false }));
    });
  }, [offices, checkpoints]);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayYmdJst();
  const horizon = addDaysYmd(today, 15);
  const tripStart = ymdOfTripDate((window.RAW_KML_DATA || [])[0] && window.RAW_KML_DATA[0].date);
  const daysToTrip = tripStart
    ? Math.round((new Date(tripStart + "T00:00:00Z") - new Date(today + "T00:00:00Z")) / 86400000)
    : null;
  const fcStart = tripStart ? addDaysYmd(tripStart, -15) : "";

  const fcOf = (c) => fc.find((x) => Math.abs(x.lat - c.lat) < 1e-3 && Math.abs(x.lon - c.lon) < 1e-3);
  const dayVal = (f, ymd, key) => {
    if (!f || !f.daily || !f.daily.time) return null;
    const i = f.daily.time.indexOf(ymd);
    return i < 0 ? null : f.daily[key][i];
  };

  const rows = routes.map((r) => {
    const ymd = ymdOfTripDate(r.date);
    const inRange = ymd && ymd >= today && ymd <= horizon;
    let snowCm = 0;
    let tmin = null;
    const pts = (r.checkpoints || []).map((c) => {
      const f = fcOf(c);
      const s = inRange ? dayVal(f, ymd, "snowfall_sum") : null;
      const t = inRange ? dayVal(f, ymd, "temperature_2m_min") : null;
      if (s != null) snowCm = Math.max(snowCm, s);
      if (t != null) tmin = tmin == null ? t : Math.min(tmin, t);
      return { ...c, snow: s, tmin: t, now: f && f.current };
    });
    let warnLv = 0;
    let warnSnow = false;
    const warns = [];
    (r.jmaAreas || []).forEach((a) => {
      const w = warn[a.office];
      const list = (w && w.areas && w.areas[a.code]) || [];
      list.forEach((x) => {
        warns.push({ ...x, area: a.name });
        if (x.snow) warnSnow = true;
        if (x.lv > warnLv) warnLv = x.lv;
      });
    });
    const RANK = { low: 0, static_low: 0, watch: 1, medium: 2, static_medium: 2, high: 3, static_high: 3 };
    const live = snowLevel({ snowCm, tmin, warnLv, warnSnow });
    const stat = "static_" + (r.risk || "low");
    // 已進入預報範圍：以預報＋警報為主；尚未進入：取「歷年風險」與「現在警報」較嚴重者
    const level = inRange ? live : warns.length && RANK[live] > RANK[stat] ? live : stat;
    return { r, ymd, inRange, pts, snowCm, tmin, warns, level };
  });

  // 檢查點標記（顏色＝目前積雪／低溫）
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map) return;
    if (ptLayer.current) map.removeLayer(ptLayer.current);
    const g = L.layerGroup().addTo(map);
    ptLayer.current = g;
    checkpoints.forEach((c) => {
      const f = fcOf(c);
      const cur = (f && f.current) || {};
      const depthCm = cur.snow_depth != null ? Math.round(cur.snow_depth * 100) : null;
      const color = depthCm >= 10 ? "#dc2626" : depthCm > 0 ? "#f59e0b" : cur.temperature_2m <= 0 ? "#0ea5e9" : "#10b981";
      L.circleMarker([c.lat, c.lon], { radius: 8, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 })
        .addTo(g)
        .bindPopup(
          `<b>❄️ ${c.n}</b><br>` +
            (cur.temperature_2m != null ? `現在 ${cur.temperature_2m}°C` : "") +
            (depthCm != null ? `｜積雪 ${depthCm} cm` : "")
        );
    });
  }, [fc, ready]);

  const officeList = offices.map((o) => ({ o, w: warn[o] }));

  return (
    <div className="glass-panel p-5 rounded-3xl bg-white border-gray-100 shadow-lg space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-lg text-gray-800">❄️ 沿線雪況預警</h3>
        <button
          onClick={load}
          className="ml-auto shrink-0 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[11px] font-black"
        >
          {state === "loading" ? "抓取中…" : "🔄 重新抓取"}
        </button>
      </div>
      <div className="text-[11px] text-gray-400 font-bold leading-relaxed">
        自動抓取①日本氣象廳 鳥取・岡山・兵庫的警報／注意報（大雪、風雪、著雪、なだれ、低溫…）②Open-Meteo 沿線檢查點（六甲山、和田山、人形峠…）的降雪量與最低氣溫，逐日判斷路段風險。
        {daysToTrip != null && daysToTrip > 15 && (
          <span className="block mt-1 text-indigo-500">
            ⏳ 距出發還有 {daysToTrip} 天，降雪預報最遠只到 16 天後；約 {Number(fcStart.slice(5, 7))}/{Number(fcStart.slice(8, 10))} 起會自動顯示行程當天的預報。在那之前先顯示歷年風險＋目前沿線實況。
          </span>
        )}
      </div>

      <div
        ref={mapEl}
        className="w-full rounded-2xl overflow-hidden border-2 border-gray-200 bg-gray-100"
        style={{ height: "300px" }}
      />
      {!ready && <div className="text-[11px] text-gray-400 font-bold">地圖載入中…（需要連網）</div>}
      <div className="flex flex-wrap gap-2 text-[10px] font-bold text-gray-500">
        <span>● 檢查點顏色＝目前狀況：</span>
        <span className="text-red-600">● 積雪 ≥10cm</span>
        <span className="text-amber-500">● 有積雪</span>
        <span className="text-sky-500">● 0°C 以下</span>
        <span className="text-emerald-500">● 無雪</span>
      </div>

      {/* 氣象廳 警報・注意報 */}
      <div className="space-y-2">
        {officeList.map(({ o, w }) => {
          const active = w && w.ok ? Object.values(w.areas).flat() : [];
          const snowy = active.filter((x) => x.snow);
          return (
            <div
              key={o}
              className={`p-3 rounded-2xl border-2 ${
                snowy.some((x) => x.lv >= 3)
                  ? "bg-red-50 border-red-300"
                  : snowy.length
                  ? "bg-amber-50 border-amber-300"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-gray-800">🇯🇵 {JMA_OFFICE_NAME[o] || o}</span>
                {w && w.time && (
                  <span className="text-[10px] text-gray-400 font-bold">發表 {w.time.slice(5, 16).replace("T", " ")}</span>
                )}
                <a
                  href={jmaWarnPage(o)}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-[10px] font-black text-indigo-600 underline"
                >
                  氣象廳原文
                </a>
              </div>
              {!w ? (
                <div className="text-[11px] text-gray-400 font-bold mt-1">讀取中…</div>
              ) : !w.ok ? (
                <div className="text-[11px] text-gray-500 font-bold mt-1">⚠️ 讀取失敗（{w.err}），請點「氣象廳原文」。</div>
              ) : (
                <div className="mt-1 space-y-1">
                  {(window.WINTER_ROUTES || [])
                    .flatMap((r) => r.jmaAreas || [])
                    .filter((a, i, arr) => a.office === o && arr.findIndex((b) => b.code === a.code) === i)
                    .map((a) => {
                      const list = w.areas[a.code] || [];
                      return (
                        <div key={a.code} className="text-[11px] font-bold text-gray-700 flex flex-wrap gap-1 items-center">
                          <span className="text-gray-500 mr-1">{a.name}</span>
                          {list.length ? (
                            list.map((x) => (
                              <span
                                key={x.code}
                                className={`px-2 py-0.5 rounded-full text-white ${
                                  x.lv >= 3 ? "bg-red-600" : x.snow ? "bg-amber-500" : "bg-gray-400"
                                }`}
                              >
                                {x.snow ? "❄️" : ""}
                                {x.t}
                              </span>
                            ))
                          ) : (
                            <span className="text-emerald-600">✅ 無發表中的警報・注意報</span>
                          )}
                        </div>
                      );
                    })}
                  {w.headline && (
                    <div className="text-[10px] text-gray-500 leading-relaxed mt-1">📄 {w.headline}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 每日路段 */}
      <div className="space-y-2">
        {rows.map(({ r, inRange, pts, snowCm, tmin, warns, level }) => {
          const st = LEVEL_STYLE[level] || LEVEL_STYLE.low;
          return (
            <div key={r.day} className={`p-3 rounded-2xl border-2 ${st.cls}`}>
              <div className="flex items-center gap-2 font-black text-sm">
                <span>{st.dot}</span>
                <span>
                  {r.day}・{r.date}
                </span>
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-white/80">{st.label}</span>
              </div>
              <div className="text-[11px] font-bold mt-1">{r.route}</div>
              {inRange ? (
                <div className="text-[11px] mt-1">
                  🌨️ 當天最大降雪 <b>{Math.round(snowCm * 10) / 10} cm</b>
                  {tmin != null && (
                    <>
                      ｜🌡️ 最低 <b>{tmin}°C</b>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-[11px] mt-1 opacity-80">📅 行程日期尚未進入 16 天預報範圍，先依歷年風險判斷。</div>
              )}
              <div className="flex flex-wrap gap-1 mt-1">
                {pts.map((p) => {
                  const cur = p.now || {};
                  const depth = cur.snow_depth != null ? Math.round(cur.snow_depth * 100) : null;
                  return (
                    <span key={p.n} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-white">
                      {p.n}
                      {inRange && p.snow != null ? ` ${p.snow}cm/${p.tmin}°C` : ""}
                      {!inRange && cur.temperature_2m != null
                        ? `｜現在 ${cur.temperature_2m}°C${depth ? "・積雪" + depth + "cm" : ""}`
                        : ""}
                    </span>
                  );
                })}
              </div>
              {warns.length > 0 && (
                <div className="text-[11px] font-black mt-1">
                  ⚠️ 現在發表中：{warns.map((w) => w.area + " " + w.t).join("、")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {state === "error" && (
        <div className="text-[11px] text-red-600 font-bold">抓取失敗：{err}（離線時可用下方官方連結）</div>
      )}
      {stamp && (
        <div className="text-[10px] text-gray-400 font-bold">
          更新於 {stamp}｜資料：氣象廳 bosai、Open-Meteo。警報為「現在」狀態，非行程當天預報；實際以氣象廳與 NEXCO 公告為準。
        </div>
      )}
    </div>
  );
};

// --- 即時天氣／降雪雷達 ---
const WeatherSnowCard = () => {
  const [show, setShow] = useState(false);
  const [layer, setLayer] = useState("snowAccu");
  // 山陰～中國山地中心點
  const LAT = 35.15;
  const LON = 134.2;
  const LAYERS = [
    { k: "snowAccu", label: "🌨️ 新雪" },
    { k: "snowcover", label: "⛄ 積雪深" },
    { k: "temp", label: "🌡️ 氣溫" },
    { k: "wind", label: "🌬️ 風速" },
  ];
  const embedSrc =
    `https://embed.windy.com/embed2.html?lat=${LAT}&lon=${LON}` +
    `&detailLat=${LAT}&detailLon=${LON}&width=650&height=450&zoom=7` +
    `&level=surface&overlay=${layer}&menu=&message=true&marker=` +
    `&calendar=now&pressure=&type=map&location=coordinates&detail=` +
    `&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;

  const ess = window.WINTER_ESSENTIALS || {};
  const OUT_LINKS = [
    { t: "🌨️ 氣象廳 今後の雪", u: "https://www.jma.go.jp/bosai/snow/", c: "bg-sky-50 border-sky-200 text-sky-700" },
    { t: "⚠️ 鳥取 警報・注意報", u: jmaWarnPage("310000"), c: "bg-rose-50 border-rose-200 text-rose-700" },
    { t: "⚠️ 岡山 警報・注意報", u: jmaWarnPage("330000"), c: "bg-rose-50 border-rose-200 text-rose-700" },
    { t: "⚠️ 兵庫 警報・注意報", u: jmaWarnPage("280000"), c: "bg-rose-50 border-rose-200 text-rose-700" },
    {
      t: "☁️ 氣象廳 雨雲・雪雲動態",
      u: "https://www.jma.go.jp/bosai/nowc/#zoom:8/lat:35.200000/lon:134.000000/colordepth:normal/elements:hrpns",
      c: "bg-indigo-50 border-indigo-200 text-indigo-700",
    },
    ...((ess.links || []).filter((l) => !/jma\.go\.jp\/bosai\/snow/.test(l.url)).map((l) => ({
      t: l.icon + " " + l.name,
      u: l.url,
      c: "bg-gray-50 border-gray-200 text-gray-700",
    }))),
  ];

  return (
    <div className="glass-panel p-5 rounded-3xl bg-white border-gray-100 shadow-lg space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">🌨️ 即時天氣／降雪</h3>
        <span className="text-[11px] font-bold text-gray-400">1 月山陰・中國山地是降雪高峰</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {OUT_LINKS.map((l) => (
          <a key={l.t} href={l.u} target="_blank" rel="noreferrer" className={`px-3 py-2 rounded-full border-2 text-xs font-black ${l.c}`}>
            {l.t}
          </a>
        ))}
      </div>

      <button
        onClick={() => setShow(!show)}
        className="w-full py-2.5 rounded-2xl border-2 border-gray-200 bg-white text-gray-700 text-xs font-black"
      >
        {show ? "▲ 收起即時降雪圖" : "▼ 展開即時降雪圖（需連網）"}
      </button>

      {show && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {LAYERS.map((l) => (
              <button
                key={l.k}
                onClick={() => setLayer(l.k)}
                className={`flex-1 py-2 rounded-xl border-2 text-[11px] font-black ${
                  layer === l.k ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-gray-500"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="rounded-2xl overflow-hidden border-2 border-gray-200">
            <iframe key={layer} src={embedSrc} title="Windy 即時降雪" width="100%" height="320" frameBorder="0" loading="lazy" />
          </div>
          <div className="text-[10px] text-gray-400 font-bold">
            畫面對準鳥取～岡山北部。資料來源 Windy.com。離線時這張圖不會載入，其他頁面照常可用。
          </div>
        </div>
      )}
    </div>
  );
};

// --- 🚗 租車資訊卡 ---
const RentalCard = () => {
  const c = window.CAR_RENTAL_INFO;
  if (!c) return null;
  const nav = () =>
    window.open("https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent("オリックスレンタカー 三宮駅前店 神戸市中央区八幡通3-2-23"), "_blank");
  return (
    <div className="glass-panel p-5 rounded-3xl bg-white border-2 border-[#A2C4C9] shadow-lg space-y-2">
      <h3 className="font-bold text-lg text-gray-800">🚗 租車｜{c.company}</h3>
      <div className="text-[13px] text-gray-700 leading-relaxed space-y-1">
        <div>🚙 <b>{c.carType}</b></div>
        <div>📥 取車 <b>{c.pickupDate} {c.pickupTime}</b>｜{c.pickupLocation}</div>
        <div>📤 還車 <b>{c.returnDate} {c.returnTime}</b>｜{c.returnLocation}</div>
        {c.reservation && <div>🔖 預約號碼 <b>{c.reservation}</b>{c.tel && <>｜📞 <a href={"tel:" + c.tel.replace(/-/g, "")} className="underline font-bold">{c.tel}</a></>}</div>}
        {c.note && <div className="p-2 rounded-lg bg-sky-50 border border-sky-200 text-[12px] text-sky-800 font-bold">📌 {c.note}</div>}
      </div>
      <button onClick={nav} className="w-full py-2 rounded-xl bg-gray-800 text-white text-[12px] font-bold">
        🧭 導航到 ORIX 三宮駅前店（八幡通3-2-23 B1）
      </button>
    </div>
  );
};

// --- InfoTab ---
const InfoTab = () => {
  const Icons = window.Icons;
  const flightInfo = window.FLIGHT_INFO || { outbound: {}, inbound: {} };
  const hotelInfo = window.HOTEL_INFO || [];

  const NAV_BUTTONS = [
    {
      title: "超市/熟食",
      query: "supermarket",
      icon: Icons.ShoppingBag,
      color: "text-green-600 bg-green-50 border-green-100",
    },
    {
      title: "便利商店",
      query: "convenience store",
      icon: Icons.Store,
      color: "text-orange-500 bg-orange-50 border-orange-100",
    },
    {
      title: "咖啡廳",
      query: "coffee",
      icon: Icons.Coffee,
      color: "text-amber-600 bg-amber-50 border-amber-100",
    },
    {
      title: "加油站",
      query: "gas station",
      icon: Icons.Fuel,
      color: "text-red-500 bg-red-50 border-red-100",
    },
    {
      title: "藥妝店",
      query: "drug store",
      icon: Icons.Smile,
      color: "text-blue-500 bg-blue-50 border-blue-100",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      <TripChecklist />
      <WeatherSnowCard />
      <SnowRiskMap />
      <RentalCard />
      <HotelDeskCard />

      <div className="glass-panel p-6 rounded-3xl bg-white border-gray-100 shadow-lg">
        <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
          <Icons.Navigation size={20} className="text-[#A9BFA8]" /> 周邊機能
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {NAV_BUTTONS.map((btn, i) => (
            <button
              key={i}
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    btn.query
                  )}`,
                  "_blank"
                )
              }
              className={`p-3 rounded-xl flex items-center gap-2 transition-all border text-sm font-bold hover:brightness-95 ${btn.color}`}
            >
              <btn.icon size={18} /> {btn.title}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl bg-white border-gray-100 shadow-lg">
        <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
          <Icons.Plane size={20} className="text-[#E4C2C1]" /> 航班資訊
        </h3>
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="flex justify-between mb-2">
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded text-white bg-[#A9BFA8]`}
              >
                去程
              </span>
              <span className="text-[10px] font-bold text-gray-400">
                {flightInfo.outbound?.date}
              </span>
            </div>
            <div className="flex justify-between items-center text-gray-800">
              <div className="text-center">
                <div className="text-xl font-black">
                  {flightInfo.outbound?.dep}
                </div>
                <div className="text-[10px] text-gray-500">
                  {flightInfo.outbound?.from}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-400">
                  {flightInfo.outbound?.flight}
                </span>
                <div className="w-10 h-px bg-gray-300 my-1"></div>
              </div>
              <div className="text-center">
                <div className="text-xl font-black">
                  {flightInfo.outbound?.arr}
                </div>
                <div className="text-[10px] text-gray-500">
                  {flightInfo.outbound?.to}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="flex justify-between mb-2">
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded text-white bg-[#E4C2C1]`}
              >
                回程
              </span>
              <span className="text-[10px] font-bold text-gray-400">
                {flightInfo.inbound?.date}
              </span>
            </div>
            <div className="flex justify-between items-center text-gray-800">
              <div className="text-center">
                <div className="text-xl font-black">
                  {flightInfo.inbound?.dep}
                </div>
                <div className="text-[10px] text-gray-500">
                  {flightInfo.inbound?.from}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-400">
                  {flightInfo.inbound?.flight}
                </span>
                <div className="w-16 h-px bg-gray-300 relative">
                  <Icons.Plane
                    size={14}
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-slate-400 rotate-90"
                  />
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl font-black">
                  {flightInfo.inbound?.arr}
                </div>
                <div className="text-[10px] text-gray-500">
                  {flightInfo.inbound?.to}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 行李限額 */}
      {flightInfo.baggage && (
      <div className="glass-panel p-6 rounded-3xl bg-white border-gray-100 shadow-lg">
        <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
          <Icons.ShoppingBag size={20} className="text-[#A2C4C9]" /> 行李限額
        </h3>
        <div className="space-y-3">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div className="text-xs font-bold text-blue-700 mb-2">每人託運額度（{flightInfo.baggage.cabin}）</div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">託運行李</span>
              <span className="font-black text-gray-900">{flightInfo.baggage.checkedPerPerson}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-gray-700">尺寸限制</span>
              <span className="text-xs text-gray-500">{flightInfo.baggage.checkedSizeLimit}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-gray-700">隨身行李</span>
              <span className="text-xs text-gray-500">{flightInfo.baggage.carryOnPerPerson}</span>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-xl border border-green-100">
            <div className="text-xs font-bold text-green-700 mb-2">全家行李總額（{flightInfo.baggage.family?.reduce((s,f)=>s+f.count,0)}人）</div>
            {flightInfo.baggage.family?.map((f, i) => (
              <div key={i} className="flex justify-between items-center mt-1">
                <span className="text-sm text-gray-700">{f.type} ×{f.count}</span>
                <span className="font-bold text-gray-800">{f.checkedPieces}件 {f.checkedKg}kg</span>
              </div>
            ))}
            <div className="border-t border-green-200 mt-2 pt-2 flex justify-between items-center">
              <span className="font-bold text-green-800">託運合計</span>
              <span className="font-black text-lg text-green-800">{flightInfo.baggage.totalCheckedPieces}件 {flightInfo.baggage.totalCheckedKg}kg</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-gray-600">隨身合計</span>
              <span className="font-bold text-gray-600">{flightInfo.baggage.totalCarryOnKg}kg</span>
            </div>
          </div>
          {flightInfo.baggage.note && (
            <div className="text-xs text-gray-400 italic px-1">{flightInfo.baggage.note}</div>
          )}
        </div>
      </div>
      )}

      <div className="glass-panel p-6 rounded-3xl bg-white border-gray-100 shadow-lg">
        <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
          <Icons.Hotel size={20} className="text-[#E8D595]" /> 住宿安排
        </h3>
        <div className="space-y-3">
          {hotelInfo.map((h, i) => {
            // 修正網址並補上遺漏的 $ 符號
            const safeLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              h.name + " " + (h.location || "")
            )}`;
            return (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 mb-2 last:mb-0"
              >
                <div className="bg-[#A9BFA8] text-white font-bold text-xs h-10 w-10 flex items-center justify-center rounded-lg">
                  {h.day.split("/")[1]}日
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-800 truncate">
                    {h.name}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {h.location}
                  </div>
                </div>
                <a
                  href={safeLink}
                  target="_blank"
                  className="p-2 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-[#E4C2C1]"
                >
                  <Icons.Navigation size={14} />
                </a>
              </div>
            );
          })}
        </div>
      </div>

      {/* 資料備份/還原 */}
      <div className="glass-panel p-6 rounded-3xl bg-white border-gray-100 shadow-lg">
        <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
          <Icons.Download size={20} className="text-[#4ECDC4]" /> 資料備份 / 還原
        </h3>
        <div className="space-y-3">
          <button
            onClick={() => {
              const tripId = window.TRIP_ID || "unknown";
              const keysToExport = ["shopping_list","expenses","trip_spot_tickets","ticket_overrides","start_times","departures","stays","modes","2026_currency","gemini_api_key","themeIndex","user_email"];
              const data = { _meta: { tripId, exportedAt: new Date().toISOString(), device: navigator.userAgent.substring(0,80), version: 1 } };
              keysToExport.forEach(key => { const v = localStorage.getItem(key); if (v !== null) data[key] = v; });
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              const ts = new Date().toISOString().replace(/[T:]/g,"-").substring(0,16);
              a.href = url; a.download = tripId + "-backup-" + ts + ".json"; a.click();
              URL.revokeObjectURL(url);
              alert("✅ 備份完成！\n\n檔案：" + a.download + "\n\n請存到 Google Drive 或分享到 LINE，其他裝置就能匯入。");
            }}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-base shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <Icons.Download size={18} /> 📤 匯出全部資料（備份）
          </button>

          <div className="relative">
            <input
              type="file"
              accept=".json"
              id="import-file-input"
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  try {
                    const imported = JSON.parse(evt.target.result);
                    const meta = imported._meta;
                    if (!meta) { alert("❌ 無效的備份檔案（缺少 _meta）"); return; }

                    const localTripId = window.TRIP_ID || "unknown";
                    if (meta.tripId !== localTripId) {
                      if (!confirm("⚠️ 行程不一致！\n\n備份行程：" + meta.tripId + "\n本機行程：" + localTripId + "\n\n確定要匯入不同行程的資料嗎？")) return;
                    }

                    const exportTime = new Date(meta.exportedAt).toLocaleString("zh-TW");
                    const keysToImport = Object.keys(imported).filter(k => k !== "_meta");

                    let diffReport = "📋 匯入預覽：\n\n";
                    diffReport += "行程：" + meta.tripId + "\n";
                    diffReport += "備份時間：" + exportTime + "\n";
                    diffReport += "備份裝置：" + (meta.device || "未知").substring(0,40) + "\n\n";

                    keysToImport.forEach(key => {
                      const local = localStorage.getItem(key);
                      const remote = imported[key];
                      if (local === null) {
                        diffReport += "🆕 " + key + "（本機無 ← 匯入新增）\n";
                      } else if (local !== remote) {
                        diffReport += "🔄 " + key + "（將覆蓋）\n";
                      } else {
                        diffReport += "✅ " + key + "（相同，不變）\n";
                      }
                    });

                    diffReport += "\n共 " + keysToImport.length + " 項資料。確定匯入？";

                    if (confirm(diffReport)) {
                      keysToImport.forEach(key => { localStorage.setItem(key, imported[key]); });
                      alert("✅ 匯入完成！頁面將重新載入。");
                      window.location.reload();
                    }
                  } catch (err) {
                    alert("❌ 檔案解析失敗：" + err.message);
                  }
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
            />
            <button className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-bold text-base border-2 border-gray-200 flex items-center justify-center gap-2 pointer-events-none">
              <Icons.Upload size={18} /> 📥 匯入資料（還原）
            </button>
          </div>

          {/* 家人記帳合併：只合併消費記錄，不動其他資料 */}
          <div className="relative">
            <input
              type="file"
              accept=".json"
              id="merge-expense-input"
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  try {
                    const imported = JSON.parse(evt.target.result);
                    if (!imported._meta) { alert("❌ 無效的備份檔案（缺少 _meta）"); return; }
                    if (!imported.expenses) { alert("❌ 備份檔中沒有消費記錄"); return; }
                    const theirExpenses = JSON.parse(imported.expenses);
                    const mine = JSON.parse(localStorage.getItem("expenses") || "{}");
                    let added = 0, skipped = 0;
                    Object.entries(theirExpenses).forEach(([spotId, recs]) => {
                      if (!Array.isArray(recs)) return;
                      const mineList = mine[spotId] || [];
                      const mineIds = new Set(mineList.map((r) => r.id));
                      recs.forEach((r) => {
                        if (mineIds.has(r.id)) { skipped++; return; }
                        mineList.push(r); added++;
                      });
                      mine[spotId] = mineList;
                    });
                    if (added === 0) { alert("沒有新記錄可合併（重複 " + skipped + " 筆已略過）"); return; }
                    if (confirm("🧾 合併預覽：\n\n備份裝置：" + (imported._meta.device || "未知").substring(0, 40) + "\n新增 " + added + " 筆消費記錄\n略過重複 " + skipped + " 筆\n\n只會合併消費記錄，不影響其他資料。確定合併？")) {
                      localStorage.setItem("expenses", JSON.stringify(mine));
                      alert("✅ 合併完成！頁面將重新載入。");
                      window.location.reload();
                    }
                  } catch (err) {
                    alert("❌ 檔案解析失敗：" + err.message);
                  }
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
            />
            <button className="w-full py-4 bg-[#F9F7F5] text-[#A9BFA8] rounded-xl font-bold text-base border-2 border-[#A9BFA8]/40 flex items-center justify-center gap-2 pointer-events-none">
              <Icons.Upload size={18} /> 🧾 合併家人的消費記錄
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">匯入（還原）會覆蓋全部資料；「合併」只加入對方的消費記錄（依 ID 去重），適合家人各自記帳後彙整。</p>
        </div>
      </div>
    </div>
  );
};
const StatsTab = ({
  dailyStats,
  handleOpenDailyDetail,
  handleOpenEmailClick,
  stats,
  selectedCurrency,
  exchangeRate,
  syncStatus,
  onSyncNow,
  syncEnabled,
}) => {
  const Icons = window.Icons;
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      <div className="glass-panel p-6 rounded-3xl bg-white border-gray-100 shadow-lg text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#E4C2C1] to-[#E8D595]"></div>
        <div className="text-sm font-bold text-gray-400 mb-1">總花費估算</div>
        <div className="text-4xl font-black text-gray-800 mb-2 tracking-tight">
          {selectedCurrency.symbol}{" "}
          {(stats.totalJpy * exchangeRate).toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}
        </div>
        <div className="text-xs text-gray-400 font-mono mb-6">
          ( ¥{stats.totalJpy.toLocaleString()} )
        </div>
        <button
          onClick={handleOpenEmailClick}
          className="w-full py-3 bg-[#F9F7F5] border border-gray-200 text-[#A9BFA8] rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-white hover:shadow-md transition-all"
        >
          <Icons.Mail size={16} /> 發送詳細報表
        </button>
        {window.SHARED_ALBUM_URL && (
          <a
            href={window.SHARED_ALBUM_URL}
            target="_blank"
            rel="noreferrer"
            className="w-full mt-2 py-3 bg-[#F9F7F5] border border-gray-200 text-[#E4C2C1] rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-white hover:shadow-md transition-all"
          >
            📤 收據共享相簿（全家上傳）
          </a>
        )}
        {syncEnabled && (
          <div className="mt-2">
            <button
              onClick={onSyncNow}
              disabled={syncStatus.state === "syncing"}
              className="w-full py-3 bg-[#F9F7F5] border border-gray-200 text-[#A2C4C9] rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-white hover:shadow-md transition-all disabled:opacity-50"
            >
              ☁️ {syncStatus.state === "syncing" ? "同步中..." : "同步全家帳（Firebase）"}
            </button>
            <div
              className={`text-[11px] mt-1.5 font-bold ${
                syncStatus.state === "err"
                  ? "text-red-500"
                  : syncStatus.state === "warn"
                  ? "text-amber-500"
                  : "text-gray-400"
              }`}
            >
              {syncStatus.text}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-400 uppercase ml-1">
          每日明細
        </h3>
        {dailyStats.map((day) => (
          <div
            key={day.dayId}
            onClick={() => handleOpenDailyDetail(day)}
            className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center hover:translate-y-[-2px] transition-transform cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`${day.themeColor} w-1.5 h-8 rounded-full`}></div>
              <div>
                <div className="text-sm font-bold text-gray-800">
                  {day.date}
                </div>
                <div className="text-xs text-gray-500">{day.title}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-mono font-bold text-[#E4C2C1]">
                {selectedCurrency.symbol}{" "}
                {(day.totalTwd * exchangeRate).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


// --- 緊急查核：把災情新聞轉成一段可貼進 Claude 外掛的查核提問 ---
const EmergencyCheck = ({ tripData, flightInfo, hotelInfo }) => {
  const [news, setNews] = useState("");
  const [copied, setCopied] = useState(false);

  const days = (tripData || [])
    .map(function (d) {
      var date = String(d.date || "").split(" ")[0];
      var names = (d.spots || []).map(function (sp) { return sp.name; }).join("、");
      return date + "：" + names;
    })
    .join("\n");

  const hotels = (hotelInfo || [])
    .map(function (h) { return h.name + "（" + (h.location || "") + "）"; })
    .join("；");

  const ob = (flightInfo && flightInfo.outbound) || {};
  const ib = (flightInfo && flightInfo.inbound) || {};
  const flights =
    "去程 " + (ob.date || "") + " " + (ob.flight || "") + " " + (ob.from || "") + "→" + (ob.to || "") +
    "；回程 " + (ib.date || "") + " " + (ib.flight || "") + " " + (ib.from || "") + "→" + (ib.to || "");

  const prompt =
    "我要去日本山陰（鳥取）・岡山・兵庫冬季自駕旅遊（1 月，雪季），以下是我的行程與剛發生的災情新聞。請你【實際上網查證】，再逐日告訴我哪幾段受阻、哪幾段沒事。不要只複述我的行程。\n\n" +
    "===== 災情新聞（我貼上的） =====\n" +
    (news.trim() || "（尚未貼上新聞）") + "\n" +
    "===== 新聞結束 =====\n\n" +
    "【我的航班】" + flights + "\n" +
    "【我的住宿】" + hotels + "\n" +
    "【每日行程】\n" + days + "\n\n" +
    "【請查證這五項，每項都要附上你查到的頁面連結與資料時間】\n" +
    "1. 氣象廳（jma.go.jp）對鳥取・岡山・兵庫三縣的警報、注意報（大雪、暴風雪、著雪、なだれ）與降雪預報\n" +
    "2. 上面那兩班飛機的航空公司運航情報頁，該日是否正常運航\n" +
    "3. 中國電力／關西電力停電情報（teideninfo.energia.co.jp、kepco），特別是我住宿所在的市町\n" +
    "4. NEXCO 西日本（ihighway.jp）的高速公路通行止、チェーン規制、冬用タイヤ規制\n" +
    "5. JARTIC（jartic.or.jp）鳥取・岡山・兵庫三縣的一般道路通行止（特別是人形峠 國道179號、國道9號、國道53號）\n\n" +
    "【輸出格式】\n" +
    "先用一段話講整體影響程度；接著逐日列出「日期｜受影響的景點或路段｜原因｜建議」，沒受影響的日期也要寫一行「無影響」；最後給我一句結論：需不需要調整行程。請用繁體中文。";

  const copy = function () {
    var done = function () { setCopied(true); setTimeout(function () { setCopied(false); }, 1800); };
    try {
      navigator.clipboard.writeText(prompt).then(done, function () {
        var ta = document.createElement("textarea");
        ta.value = prompt; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); done(); } catch (e) { alert("複製失敗，請長按下方文字手動複製"); }
        document.body.removeChild(ta);
      });
    } catch (e) {
      alert("複製失敗，請長按下方文字手動複製");
    }
  };

  return (
    <div className="glass-panel p-6 rounded-3xl bg-white border-2 border-red-200 shadow-lg">
      <h3 className="font-bold text-red-600 mb-1 flex items-center gap-2">
        🚨 緊急查核（大雪／地震）
      </h3>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">
        貼上新聞報導 → 按複製 → 在 Chrome 打開 Claude 外掛貼上，它會實際上網查證並逐日告訴你哪幾段受阻。
      </p>
      <textarea
        value={news}
        onChange={(e) => setNews(e.target.value)}
        rows={5}
        placeholder="在這裡貼上災情的新聞報導全文（大雪、通行止め、停電、停飛、地震等）"
        className="w-full min-w-0 p-3 border-2 border-gray-200 rounded-xl text-sm leading-relaxed focus:border-red-300 outline-none"
      />
      <button
        onClick={copy}
        className={`mt-3 w-full py-3 rounded-xl font-black text-white shadow-md ${copied ? "bg-emerald-500" : "bg-red-500 hover:brightness-105"}`}
      >
        {copied ? "✅ 已複製，去 Claude 外掛貼上" : "📋 複製查核提問"}
      </button>
      {news.trim() && (
        <details className="mt-3">
          <summary className="text-xs text-gray-400 cursor-pointer">預覽會複製的內容</summary>
          <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-[11px] text-gray-600 whitespace-pre-wrap break-words">
            {prompt}
          </pre>
        </details>
      )}
    </div>
  );
};

// --- ❄️ 冬季路況防雷（每日路段＋AI 查即時雪況） ---
const WinterRouteGuard = ({ openKeyModal, aiLoading, setAiLoading }) => {
  const Icons = window.Icons;
  const [snowAnalysis, setSnowAnalysis] = useState({});
  const winterRoutes = window.WINTER_ROUTES || [];
  const winterEssentials = window.WINTER_ESSENTIALS || null;
  if (!winterRoutes.length) return null;

  const checkSnowRoute = async (route) => {
    setAiLoading(true);
    setSnowAnalysis((p) => ({ ...p, [route.day]: "分析中..." }));
    try {
      const prompt = `請查詢【2027年${route.date} ${route.route}】的冬季路況與降雪預報：

翻越路段：${route.passes.length ? route.passes.join("、") : "無山區"}
使用道路：${route.roads.join("、")}
氣象廳區域：${(route.jmaAreas || []).map((a) => a.name).join("、") || route.jmaArea}
自駕車：ORIX 租車 WA 級廂型車（2WD、雪胎）

請用 Google Search 查詢並提供：
1. 該區域 ${route.date} 前後 3 日的降雪預報（氣象廳、tenki.jp）
2. 上述高速公路／國道目前是否有冬季封閉、チェーン規制、通行止め（NEXCO 西日本、各縣道路情報）
3. 已知的積雪／凍結危險路段
4. 建議出發時間（避開清晨結冰與傍晚風雪）
5. 若主要路線封閉的替代路線
請用繁體中文回答，標注資訊查詢時間。若查不到即時資料，請根據該區域 1 月歷史氣候給出一般性建議。`;
      const res = await generateGeminiContent(prompt, null, true);
      setSnowAnalysis((p) => ({ ...p, [route.day]: res }));
    } catch (e) {
      setSnowAnalysis((p) => ({ ...p, [route.day]: "分析失敗" }));
      if (e.message.includes("NO_API_KEY") || e.message === "BAD_API_KEY") openKeyModal(true);
      else if (e.message.startsWith("QUOTA_EXHAUSTED")) alert("⏳ Gemini 配額用完，請稍後再試或明天 16:00 重置");
    }
    setAiLoading(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-800 flex items-center gap-2 px-1 text-lg">❄️ 雪況路況防雷</h3>

      {winterEssentials && (
        <div className="glass-panel p-5 rounded-3xl bg-gradient-to-br from-blue-50 to-white border-blue-100 shadow-lg">
          <h4 className="font-bold text-blue-700 mb-3 flex items-center gap-2">🚗 冬季駕駛必備</h4>
          <div className="space-y-2.5 mb-4">
            {["tire", "chain", "fuel", "emergency", "gear"].map(
              (k) =>
                winterEssentials[k] && (
                  <div key={k} className="flex gap-2.5 text-sm">
                    <span className="text-lg flex-shrink-0">{winterEssentials[k].icon}</span>
                    <div>
                      <span className="font-bold text-gray-800">{winterEssentials[k].title}：</span>
                      <span className="text-gray-600">{winterEssentials[k].detail}</span>
                    </div>
                  </div>
                )
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(winterEssentials.links || []).map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-white border border-blue-200 rounded-full text-xs font-bold text-blue-700 hover:bg-blue-50 transition"
              >
                {l.icon} {l.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {winterRoutes.map((r) => {
        const riskStyle =
          r.risk === "high"
            ? { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-500", label: "高風險", dot: "🔴" }
            : r.risk === "medium"
            ? { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-500", label: "中風險", dot: "🟡" }
            : { bg: "bg-green-50", border: "border-green-200", badge: "bg-green-500", label: "低風險", dot: "🟢" };
        return (
          <div key={r.day} className={`glass-panel p-5 rounded-3xl ${riskStyle.bg} ${riskStyle.border} border-2 shadow-lg`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{riskStyle.dot}</span>
                <span className="font-black text-gray-800">{r.day}</span>
                <span className="text-sm text-gray-500">{r.date}</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold text-white ${riskStyle.badge}`}>
                {riskStyle.label}（歷年）
              </span>
            </div>
            <div className="font-bold text-sm text-gray-800 mb-2">{r.route}</div>
            {r.passes.length > 0 && <div className="text-xs text-gray-600 mb-1.5">⛰️ {r.passes.join(" / ")}</div>}
            <div className="text-xs text-gray-500 mb-2">🛣️ {r.roads.join(" → ")}</div>
            <div className="text-xs text-gray-700 bg-white/70 rounded-xl p-3 mb-3 leading-relaxed">💬 {r.notes}</div>
            {snowAnalysis[r.day] && (
              <div className="mb-3 p-3 bg-white border border-gray-200 rounded-xl text-xs text-gray-600 leading-relaxed">
                {snowAnalysis[r.day] === "分析中..." ? (
                  <Icons.Loader2 size={14} className="animate-spin" />
                ) : (
                  <MarkdownRenderer content={snowAnalysis[r.day]} />
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => checkSnowRoute(r)}
                disabled={aiLoading}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-700 disabled:opacity-50 shadow-md"
              >
                {aiLoading && snowAnalysis[r.day] === "分析中..." ? <Icons.Loader2 size={14} className="animate-spin" /> : "🤖"} AI 查即時雪況
              </button>
              <a
                href="https://ihighway.jp/"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-white border border-gray-300 rounded-xl font-bold text-xs text-gray-700 flex items-center gap-1.5 hover:bg-gray-50 shadow-sm"
              >
                📍 NEXCO
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// --- GuardTab ---
const GuardTab = ({
  tripData,
  flightInfo,
  hotelInfo,
  openKeyModal,
  aiLoading,
  setAiLoading,
}) => {
  const Icons = window.Icons;
  const [flightAnalysis, setFlightAnalysis] = useState("");
  const [hotelAnalysis, setHotelAnalysis] = useState({});
  const [spotAnalysis, setSpotAnalysis] = useState({});
  const [aiInput, setAiInput] = useState("");
  const [aiGeneralResult, setAiGeneralResult] = useState("");

  const allSpots = useMemo(() => {
    return tripData.flatMap((day) =>
      day.spots.map((spot) => ({ ...spot, dayDate: day.date.split(" ")[0] }))
    );
  }, [tripData]);

  const checkFlight = async () => {
    setAiLoading(true);
    setFlightAnalysis("分析中...");
    try {
      const prompt = `請查詢以下交通資訊的【最新即時狀態】：
去程：${flightInfo.outbound?.date} ${flightInfo.outbound?.flight} 從${flightInfo.outbound?.from}到${flightInfo.outbound?.to}
回程：${flightInfo.inbound?.date} ${flightInfo.inbound?.flight} 從${flightInfo.inbound?.from}到${flightInfo.inbound?.to}

請提供：
1. 當日天氣預報（冬季重點：降雪、強風、跑道除雪對神戶機場航班的影響）
2. 神戶機場聯絡橋／Port Liner 運行與路況資訊
3. 預估交通時間與建議出發時段
4. 替代路線建議
請用繁體中文回答，標注資訊查詢時間。`;
      const res = await generateGeminiContent(prompt, null, true);
      setFlightAnalysis(res);
    } catch (e) {
      setFlightAnalysis("分析失敗");
      if (e.message.includes("NO_API_KEY") || e.message === "BAD_API_KEY") openKeyModal(true); else if (e.message.startsWith("QUOTA_EXHAUSTED")) alert("⏳ Gemini 配額用完，請稍後再試或明天 16:00 重置");
    }
    setAiLoading(false);
  };

  const checkHotel = async (h) => {
    setAiLoading(true);
    setHotelAnalysis((p) => ({ ...p, [h.name]: "分析中..." }));
    try {
      const prompt = `請查詢「${h.name}」(${h.location}) 的【最新資訊】：
1. Google Maps 最新評分與近期評價摘要（1個月內）
2. 周邊治安與機能（便利商店、餐廳、停車場）
3. 住客常見正面/負面回饋
4. 入住/退房注意事項
請用繁體中文回答，標注資訊來源。`;
      const res = await generateGeminiContent(prompt, null, true);
      setHotelAnalysis((p) => ({ ...p, [h.name]: res }));
    } catch (e) {
      setHotelAnalysis((p) => ({ ...p, [h.name]: "分析失敗" }));
      if (e.message.includes("NO_API_KEY") || e.message === "BAD_API_KEY") openKeyModal(true); else if (e.message.startsWith("QUOTA_EXHAUSTED")) alert("⏳ Gemini 配額用完，請稍後再試或明天 16:00 重置");
    }
    setAiLoading(false);
  };

  const checkSpot = async (s) => {
    setAiLoading(true);
    setSpotAnalysis((p) => ({ ...p, [s.id]: "分析中..." }));
    try {
      const prompt = `請查詢景點「${s.name}」的【最新即時資訊】：
1. 目前營業狀態（是否正常營業、臨時公告、休館日）
2. 最新門票價格（成人/兒童/優惠）
3. 建議停留時間與最佳到訪時段
4. 雪天備案（若為戶外景點：積雪、冬季休館、縮短營業）
5. 周邊 3 個高評價平價美食推薦（含 Google 評分）
請用繁體中文回答，標注查詢日期。`;
      const res = await generateGeminiContent(prompt, null, true);
      setSpotAnalysis((p) => ({ ...p, [s.id]: res }));
    } catch (e) {
      setSpotAnalysis((p) => ({ ...p, [s.id]: "分析失敗" }));
      if (e.message.includes("NO_API_KEY") || e.message === "BAD_API_KEY") openKeyModal(true); else if (e.message.startsWith("QUOTA_EXHAUSTED")) alert("⏳ Gemini 配額用完，請稍後再試或明天 16:00 重置");
    }
    setAiLoading(false);
  };

  const analyzeGeneral = async () => {
    if (!aiInput) return;
    setAiGeneralResult("分析中...");
    setAiLoading(true);
    try {
      const res = await generateGeminiContent(
        `分析旅遊情報：${aiInput}`,
        null,
        true
      );
      setAiGeneralResult(res);
    } catch (e) {
      setAiGeneralResult("分析失敗");
      if (e.message.includes("NO_API_KEY") || e.message === "BAD_API_KEY") openKeyModal(true); else if (e.message.startsWith("QUOTA_EXHAUSTED")) alert("⏳ Gemini 配額用完，請稍後再試或明天 16:00 重置");
    }
    setAiLoading(false);
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
        <Icons.Shield className="text-[#A9BFA8]" /> AI 旅遊防雷
      </h1>
      <EmergencyCheck tripData={tripData} flightInfo={flightInfo} hotelInfo={hotelInfo} />
      <WinterRouteGuard openKeyModal={openKeyModal} aiLoading={aiLoading} setAiLoading={setAiLoading} />
      <div className="glass-panel p-6 rounded-3xl bg-white border-gray-100 shadow-lg">
        <h3 className="font-bold text-[#A9BFA8] mb-4 flex items-center gap-2">
          <Icons.Plane size={20} /> 交通防雷
        </h3>
        <button
          onClick={checkFlight}
          disabled={aiLoading}
          className="w-full bg-[#A9BFA8] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-105 shadow-md"
        >
          {aiLoading && flightAnalysis === "分析中..." ? (
            <Icons.Loader2 className="animate-spin" />
          ) : (
            <Icons.Search size={16} />
          )}{" "}
          開始分析
        </button>
        {flightAnalysis && flightAnalysis !== "分析中..." && (
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 leading-relaxed">
            <MarkdownRenderer content={flightAnalysis} />
          </div>
        )}
      </div>
      <div className="glass-panel p-5 rounded-3xl bg-white border-gray-100 shadow-lg text-sm text-gray-500 leading-relaxed">
        <div className="font-bold text-gray-700 mb-1 flex items-center gap-2">
          <Icons.MapPin size={18} className="text-[#E8D595]" /> 住宿防雷 · 每日景點防雷
        </div>
        已移到「行程」頁：每個景點／飯店名稱右邊的「AI 掃雷」按鈕，點一下就會查該地點的最新狀況。
      </div>
      <div className="glass-panel p-6 rounded-3xl bg-white border-gray-100 shadow-lg">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Icons.Bot size={20} className="text-[#A2C4C9]" /> 通用情報分析
        </h3>
        <textarea
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          placeholder="貼上攻略或注意事項..."
          className="w-full h-24 bg-gray-50 rounded-xl p-3 text-sm text-gray-800 outline-none border border-gray-200 focus:border-[#E4C2C1] resize-none mb-3"
        />
        <button
          onClick={analyzeGeneral}
          disabled={aiLoading || !aiInput}
          className="w-full bg-[#A2C4C9] text-white py-3 rounded-xl font-bold transition-all shadow-md"
        >
          開始分析
        </button>
        {aiGeneralResult && (
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
            {aiGeneralResult === "分析中..." ? (
              <Icons.Loader2 className="animate-spin" />
            ) : (
              <MarkdownRenderer content={aiGeneralResult} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- WishlistTab (願望清單) ---
const WishlistTab = ({ aiLoading, setAiLoading, openKeyModal }) => {
  const Icons = window.Icons;
  const wishlist = window.WISHLIST_DATA || [];
  const [spotInfo, setSpotInfo] = useState({});

  const fetchSpotInfo = async (spot) => {
    const key = `${spot.lat}-${spot.lon}`;
    setAiLoading(true);
    setSpotInfo((p) => ({ ...p, [key]: "查詢中..." }));
    try {
      const prompt = `請查詢景點「${spot.name}」的【最新即時資訊】：
1. 景點簡介（50字內）
2. 目前營業狀態（是否營業中、今日營業時間）
3. Google Maps 最新評分
4. 門票價格（成人/兒童）
5. 建議停留時間
6. 最適合的到訪時段
7. 距離我目前行程最近的景點約幾分鐘車程
請用繁體中文簡潔回答。`;
      const res = await generateGeminiContent(prompt, null, true);
      setSpotInfo((p) => ({ ...p, [key]: res }));
    } catch (e) {
      setSpotInfo((p) => ({ ...p, [key]: "查詢失敗，請確認 API Key。" }));
      if (e.message.includes("NO_API_KEY") || e.message === "BAD_API_KEY") openKeyModal(true); else if (e.message.startsWith("QUOTA_EXHAUSTED")) alert("⏳ Gemini 配額用完，請稍後再試或明天 16:00 重置");
    }
    setAiLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">
      <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
        <Icons.Heart className="text-[#E4C2C1]" /> 願望清單
      </h1>
      <p className="text-sm text-gray-400 -mt-4">
        行程中臨時想去？點擊查詢即時資訊，一鍵導航出發。
      </p>
      {wishlist.length === 0 && (
        <div className="text-center py-16 text-gray-300">
          <Icons.Compass size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-sm">KMZ 中沒有 pocket_list 圖層</p>
        </div>
      )}
      {wishlist.map((spot, idx) => {
        const key = `${spot.lat}-${spot.lon}`;
        const info = spotInfo[key];
        const gmapLink = `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lon}`;
        const navLink = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}&travelmode=driving`;
        return (
          <div
            key={idx}
            className="glass-panel p-6 rounded-3xl bg-white border-gray-100 shadow-lg"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#E4C2C1]/20 flex items-center justify-center text-[#E4C2C1] shrink-0">
                <Icons.Star size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-black text-gray-800 mb-1">{spot.name}</h3>
                <p className="text-xs text-gray-400">{spot.desc}</p>
              </div>
            </div>

            {info && info !== "查詢中..." && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 leading-relaxed">
                <MarkdownRenderer content={info} />
              </div>
            )}
            {info === "查詢中..." && (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl flex items-center gap-2 text-sm text-gray-400">
                <Icons.Loader2 size={14} className="animate-spin" /> AI 查詢中...
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => fetchSpotInfo(spot)}
                disabled={aiLoading}
                className="flex-1 bg-[#E4C2C1] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:brightness-105 shadow-md transition-all"
              >
                <Icons.Sparkles size={14} /> AI 即時資訊
              </button>
              <a
                href={gmapLink}
                target="_blank"
                className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:bg-gray-200 transition border-2 border-gray-200"
              >
                <Icons.MapPin size={14} className="text-[#A9BFA8]" /> 地圖
              </a>
              <a
                href={navLink}
                target="_blank"
                className="bg-gray-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-700 transition-colors shadow-md"
              >
                <Icons.Navigation size={14} /> 導航
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// --- SewingTab (二手縫紉機鑑價) ---
const SEWING_VERDICT = {
  BUY:   { emoji: "🟢", text: "可以下手", bg: "bg-emerald-50", bd: "border-emerald-300", tx: "text-emerald-800" },
  WATCH: { emoji: "🟡", text: "看價格再決定", bg: "bg-amber-50", bd: "border-amber-300", tx: "text-amber-800" },
  AVOID: { emoji: "🔴", text: "避開，別買", bg: "bg-rose-50", bd: "border-rose-300", tx: "text-rose-800" },
  UNKNOWN: { emoji: "⚪", text: "資料庫沒有，請用 AI 查", bg: "bg-gray-50", bd: "border-gray-300", tx: "text-gray-700" }
};

const SewingTab = ({ aiLoading, setAiLoading, openKeyModal }) => {
  const Icons = window.Icons;
  const DB = window.SEWING_DB || [];
  const HINT = window.SEWING_BRAND_HINT || {};
  const CHECK = window.SEWING_CHECKLIST || [];
  const TAGS = window.SEWING_TAGS || [];

  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const [result, setResult] = useState(null);
  const [aiText, setAiText] = useState("");
  const [showCheck, setShowCheck] = useState(false);

  const judge = () => {
    const q = (model || "").trim();
    setAiText("");
    if (!q) { setResult(null); return; }
    const hit = DB.find((r) => { try { return new RegExp(r.re, "i").test(q); } catch (e) { return false; } });
    const lower = q.toLowerCase();
    const hintKey = Object.keys(HINT).find((b) => lower.includes(b));
    const p = parseInt(String(price).replace(/[^\d]/g, ""), 10);
    let priceMsg = "";
    let verdict = hit ? hit.verdict : "UNKNOWN";
    if (hit && !isNaN(p)) {
      const [lo, hi] = hit.price;
      if (hit.verdict === "AVOID") {
        priceMsg = `不管標 ¥${p.toLocaleString()} 都不建議，這台過不了皮外套的厚度。`;
      } else if (p <= lo) {
        priceMsg = `✅ ¥${p.toLocaleString()} 低於行情下緣（¥${lo.toLocaleString()}），撿到了，直接抱走。`;
        verdict = "BUY";
      } else if (p <= hi) {
        priceMsg = `👌 ¥${p.toLocaleString()} 在合理行情內（¥${lo.toLocaleString()}~¥${hi.toLocaleString()}），狀態 OK 就買。`;
      } else {
        priceMsg = `⚠️ ¥${p.toLocaleString()} 高於行情上緣（¥${hi.toLocaleString()}），二手不值這價，觀望。`;
        verdict = "WATCH";
      }
    }
    setResult({ q, hit, verdict, priceMsg, hint: hintKey ? HINT[hintKey] : "" });
  };

  const askAi = async () => {
    const q = (model || "").trim();
    if (!q) return;
    setAiLoading(true);
    setAiText("查詢中...");
    try {
      const prompt = `你是二手縫紉機鑑價專家。使用者人在日本二手店（BOOKOFF／ハードオフ）現場，看到一台縫紉機，型號是「${q}」${price ? `，標價 ¥${price}` : ""}。
他的用途是：更換皮包與外套的拉鍊、縫製收納包 —— 也就是需要強大的「吃厚能力」（穿透多層帆布、合成皮、厚料）。
請用繁體中文簡潔回答，格式如下，每項一行：
1. 機種定位（職業用／高階家用／中階／輕便入門）
2. 吃厚能力（★1~★5）與能不能勝任皮外套拉鍊
3. 日本二手合理價區間（日圓）
4. 機身重量（回程托運要算）
5. 結論：🟢可以下手 ／ 🟡看價格 ／ 🔴避開，並用一句話說明理由
6. 這台特別要現場檢查的一個重點
若查無此型號請直說，不要編造。`;
      const res = await generateGeminiContent(prompt, null, true);
      setAiText(res);
    } catch (e) {
      setAiText("查詢失敗，請確認 API Key。");
      if (e.message.includes("NO_API_KEY") || e.message === "BAD_API_KEY") openKeyModal(true);
      else if (e.message.startsWith("QUOTA_EXHAUSTED")) alert("⏳ Gemini 配額用完，請稍後再試");
    }
    setAiLoading(false);
  };

  const V = result ? (SEWING_VERDICT[result.verdict] || SEWING_VERDICT.UNKNOWN) : null;

  return (
    <div className="space-y-5 animate-in fade-in duration-700 pb-24">
      <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
        <span className="text-2xl">🧵</span> 二手縫紉機鑑價
      </h1>
      <p className="text-sm text-gray-400 -mt-3 leading-relaxed">
        用途鎖定：換皮包／外套拉鍊、縫收納包。在店裡輸入型號，馬上判斷買或觀望。
      </p>

      <div className="glass-panel p-5 rounded-3xl bg-white border-gray-100 shadow-lg space-y-3">
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") judge(); }}
          placeholder="輸入品牌型號，例：JUKI HZL-F600"
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 text-base font-bold text-gray-800 focus:border-indigo-400 outline-none"
        />
        <div className="flex gap-2">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") judge(); }}
            inputMode="numeric"
            placeholder="標價 ¥（可留空）"
            className="flex-1 px-4 py-3 rounded-2xl border-2 border-gray-200 text-sm font-bold text-gray-800 focus:border-indigo-400 outline-none"
          />
          <button
            onClick={judge}
            className="px-6 bg-gray-800 text-white rounded-2xl text-sm font-black active:scale-95 transition shadow-md"
          >
            判定
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["JUKI TL-30", "HZL-F600", "JP510", "MP400", "brother PS202"].map((s) => (
            <button
              key={s}
              onClick={() => { setModel(s); setResult(null); setAiText(""); }}
              className="px-2.5 py-1 rounded-full bg-gray-100 text-[11px] font-bold text-gray-500 active:bg-gray-200"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className={`p-5 rounded-3xl border-2 ${V.bg} ${V.bd} shadow-lg space-y-3`}>
          <div className="flex items-center gap-2">
            <span className="text-3xl">{V.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className={`text-lg font-black ${V.tx}`}>{V.text}</div>
              <div className="text-[11px] text-gray-500 truncate">你輸入：{result.q}</div>
            </div>
          </div>

          {result.hit ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="px-2 py-1 rounded-lg bg-white/70 text-gray-700">📋 {result.hit.label}</span>
                <span className="px-2 py-1 rounded-lg bg-white/70 text-gray-700">🏷️ {result.hit.tier}</span>
                <span className="px-2 py-1 rounded-lg bg-white/70 text-gray-700">
                  吃厚 {"★".repeat(result.hit.thick)}{"☆".repeat(5 - result.hit.thick)}
                </span>
                <span className="px-2 py-1 rounded-lg bg-white/70 text-gray-700">⚖️ {result.hit.weight}</span>
                <span className="px-2 py-1 rounded-lg bg-white/70 text-gray-700">
                  💴 行情 ¥{result.hit.price[0].toLocaleString()}~¥{result.hit.price[1].toLocaleString()}
                </span>
              </div>
              <p className={`text-sm font-bold leading-relaxed ${V.tx}`}>{result.hit.note}</p>
              {result.priceMsg && (
                <p className="text-sm font-black leading-relaxed text-gray-800 bg-white/70 p-3 rounded-xl">
                  {result.priceMsg}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed">
              資料庫裡沒有這個型號。{result.hint && <span className="font-bold">{result.hint}</span>}
              <br />按下方「AI 現場查詢」讓 Gemini 上網幫你判斷。
            </p>
          )}

          <button
            onClick={askAi}
            disabled={aiLoading}
            className="w-full bg-indigo-600 text-white py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition shadow-md disabled:opacity-50"
          >
            <Icons.Sparkles size={16} /> AI 現場查詢（上網比對）
          </button>

          {aiText === "查詢中..." ? (
            <div className="p-4 bg-white/70 rounded-xl flex items-center gap-2 text-sm text-gray-400">
              <Icons.Loader2 size={14} className="animate-spin" /> AI 查詢中...
            </div>
          ) : aiText ? (
            <div className="p-4 bg-white/80 border border-gray-200 rounded-xl text-sm text-gray-700 leading-relaxed">
              <MarkdownRenderer content={aiText} />
            </div>
          ) : null}
        </div>
      )}

      <div className="glass-panel p-5 rounded-3xl bg-white border-gray-100 shadow-lg">
        <button
          onClick={() => setShowCheck((v) => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-base font-black text-gray-800">🔍 現場實測檢查清單</span>
          <span className="text-gray-400 text-sm">{showCheck ? "收合 ▲" : "展開 ▼"}</span>
        </button>
        {showCheck && (
          <div className="mt-4 space-y-3">
            {CHECK.map((c, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-lg bg-gray-800 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-black text-gray-800">{c.k}</div>
                  <div className="text-xs text-gray-500 leading-relaxed">{c.t}</div>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-100">
              <div className="text-xs font-black text-gray-700 mb-2">🏷️ 標籤看到這些字就加分</div>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map((t) => (
                  <span key={t} className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 text-xs text-amber-800 leading-relaxed font-bold">
        ✈️ 吃厚型縫紉機多半 7~12kg。這趟有租車不怕搬，但長榮回程的托運重量與件數要先算好，必要時現場買行李箱裝。
      </div>
    </div>
  );
};

// --- CompareTab (現場比價：文具新品／二手家電3C古著／縫紉機) ---
const CMP_MODES = [
  { k: "shin", label: "文具・新品", icon: "🖊️" },
  { k: "used", label: "二手 3C／家電／古著", icon: "📻" },
  { k: "sew", label: "縫紉機", icon: "🧵" }
];

const PriceCompare = ({ mode, aiLoading, setAiLoading, openKeyModal, twdJpyRate }) => {
  const [name, setName] = useState("");
  const [yen, setYen] = useState("");
  const [taxFree, setTaxFree] = useState(false);
  const [bookoffFee, setBookoffFee] = useState(false);
  const [ans, setAns] = useState("");
  const [img, setImg] = useState(null);
  const [imgKind, setImgKind] = useState("tag");
  const [copied, setCopied] = useState(false);
  const [secs, setSecs] = useState(0);
  const fileRef = useRef(null);
  const galleryRef = useRef(null);
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("compare_saved") || "[]");
    } catch (e) {
      return [];
    }
  });
  const [justSaved, setJustSaved] = useState(false);

  const rate = twdJpyRate && twdJpyRate > 0 ? twdJpyRate : 4.6;
  const yenNum = parseInt(String(yen).replace(/[^\d]/g, ""), 10);
  const effYen = isNaN(yenNum)
    ? null
    : Math.round(yenNum * (taxFree ? (bookoffFee ? 0.9 + 0.03 : 0.9) : 1));
  const twd = effYen == null ? null : Math.round(effYen / rate);

  // src: "camera" 直接開相機（手機）／"gallery" 開圖庫或檔案（手機、筆電都可）
  const pickImg = (kind, src) => {
    setImgKind(kind);
    const ref = src === "gallery" ? galleryRef : fileRef;
    if (ref.current) ref.current.click();
  };

  // 手機原圖動輒 3~5MB，base64 後更大，上傳就吃掉大半時間。
  // 縮到長邊 1024px、JPEG 0.75，辨識力幾乎不變但體積剩 5~10%。
  const shrink = (file) =>
    new Promise((resolve) => {
      const r = new FileReader();
      r.onload = (ev) => {
        const im = new Image();
        im.onload = () => {
          try {
            const MAX = 1024;
            const sc = Math.min(1, MAX / Math.max(im.width, im.height));
            const cv = document.createElement("canvas");
            cv.width = Math.round(im.width * sc);
            cv.height = Math.round(im.height * sc);
            cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
            resolve(cv.toDataURL("image/jpeg", 0.75));
          } catch (err) {
            resolve(ev.target.result);
          }
        };
        im.onerror = () => resolve(ev.target.result);
        im.src = ev.target.result;
      };
      r.readAsDataURL(file);
    });

  const readImg = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setImg(await shrink(f));
  };

  const modeBrief = {
    shin:
      "這是日本文具店（LOFT／ハンズ／伊東屋／ドンキ）的【全新】商品。台灣比價基準請用 momo／PChome／蝦皮的【全新品】售價。",
    used:
      "這是日本二手店（BOOKOFF／ハードオフ／駿河屋）的【二手】商品（家電／3C／古著）。台灣比價基準請優先用【二手行情】（蝦皮二手、旋轉拍賣、Y拍），並另外附上台灣全新價當參考；不可只拿台灣新品價來比。古著請以同品牌同年代的台灣二手成交價為準。",
    sew:
      "這是日本二手店的二手縫紉機。用途是換皮包／外套拉鍊、縫收納包，需要吃厚能力。台灣比價請用二手行情。"
  }[mode];

  const ask = async () => {
    const q = (name || "").trim();
    if (!q && !img) return;
    setAiLoading(true);
    setAns("");
    setSecs(0);
    const t0 = Date.now();
    const tick = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 1000);
    try {
      const hasYen = !isNaN(yenNum);
      const prompt = `你是台日購物比價專家，使用者人在日本店裡現場，需要 30 秒內決定買不買。
${modeBrief}

===== 以下是背景資料，只供你參考，絕對不要在回答中複述 =====
${q ? `使用者輸入的商品：${q}` : "使用者沒有輸入商品名稱。"}
${img ? (imgKind === "item"
  ? "使用者附了【商品實物照片】。請先辨識這是什麼商品：品牌、系列、型號、容量／尺寸盡量認出來；認不出來就說認不出來，不要猜一個像的。"
  : "使用者附了【店家價格標照片】。請讀出商品名稱與日圓價格，日文一併翻成中文。") : ""}
${hasYen ? `日本標價：¥${yenNum.toLocaleString()}（未税）` : "使用者沒有提供日本標價，照片上可能也沒有。"}
${taxFree && hasYen ? `此店可免税，實付約 ¥${effYen.toLocaleString()}${bookoffFee ? "（已扣 BOOKOFF 3% 手續費）" : ""}。` : ""}
匯率：1 TWD ≈ ${rate} JPY${twd ? `，日本實付約 NT$${twd.toLocaleString()}` : ""}。
===== 背景資料結束 =====

【最重要】請務必實際用 Google 搜尋查證「台灣現在的售價」。就算使用者沒給日本標價，台灣售價也一定要查出來給他 —— 那正是他最需要知道的數字。不要因為缺日本價就跳過。

【輸出規則】每點一行，格式為「編號. 短標題：答案」。不要開場白、不要總結、不要 ** 粗體、不要把括號說明寫進答案、不要只寫標題就換行。答案簡短，每點最多 30 字。

【格式】照抄這 8 個標題，冒號後填答案：
1. 商品名稱：（中文名 ／ 日文名，含型號與容量。這是要拿去台灣購物網搜尋用的，寫成可直接貼進搜尋框的字串）
2. 台灣售價：（NT$ 區間，並註明 momo／PChome／蝦皮 哪一家。${mode === "shin" ? "查全新品" : "以二手行情為主、全新價為輔"}）
3. 資料來源：（至少一個實際網址。真的查不到就寫「查不到，以下為推估」，絕對不要編造）
4. 日本行情：（日圓。使用者沒給標價時，查這件商品在日本一般賣多少）
5. 價差：（在日本買省多少 NT$、省幾 %）
6. 結論：（🟢現場買 ／ 🟡再想想 ／ 🔴台灣買就好，加一句話理由）
7. 門檻：（日本標價低於 ¥____ 才值得帶回去）
8. ${mode !== "shin" ? "現場檢查：（這件二手品最該檢查的一個重點）" : "台灣有貨嗎：（若台灣根本沒進，直接說「台灣買不到，這是加分項」）"}

括號裡是給你的說明，不要寫進答案裡。某一點查不到就寫「查不到」，但不要整段跳過，也不要編造。`;
      const res = await generateGeminiContent(prompt, img, true, {
        noThinking: true,
        maxTokens: 900,
      });
      setAns(res);
    } catch (e) {
      setAns("查詢失敗，請確認 API Key。");
      if (e.message.includes("NO_API_KEY") || e.message === "BAD_API_KEY") openKeyModal(true);
      else if (e.message.startsWith("QUOTA_EXHAUSTED")) alert("⏳ Gemini 配額用完，請稍後再試");
    }
    clearInterval(tick);
    setAiLoading(false);
  };

  // 從 AI 回答裡抓出商品名稱（第 1 點），沒有就退回使用者輸入
  const stripMd = (t) =>
    (t || "").replace(/\*\*/g, "").replace(/^[*\-•]\s*/, "").trim();

  const pickName = () => {
    const typed = (name || "").trim();
    if (!ans) return typed;
    const lines = ans.split("\n").map(stripMd).filter(Boolean);

    let idx = lines.findIndex((l) => /^1[.、)]/.test(l));
    if (idx < 0) idx = lines.findIndex((l) => /商品(正式)?名稱/.test(l));
    if (idx < 0) return typed;

    const clean = (t) =>
      stripMd(t)
        .replace(/^1[.、)]\s*/, "")
        .replace(/^商品(正式)?名稱\s*[：:]?\s*/, "")
        .replace(/^(中文|日文)\s*[：:]\s*/, "")
        .replace(/^[（(][^）)]*[）)]\s*[：:]?\s*/, "")
        .replace(/^此商品為\s*/, "")
        .replace(/[。，,]\s*$/, "")
        .trim();

    // 候選：第 1 點該行，以及它後面兩行（AI 常把標題和答案拆開）
    const cands = [];
    for (let i = idx; i < Math.min(idx + 3, lines.length); i++) {
      if (i > idx && /^[2-8][.、)]/.test(lines[i])) break;
      const c = clean(lines[i]);
      // 只剩標題字樣、或整行都是說明括號的，不算答案
      if (!c) continue;
      if (/^[（(].*[）)]$/.test(c)) continue;
      if (/^(含型號容量|中／日文|中\/日文)$/.test(c)) continue;
      cands.push({ raw: lines[i], txt: c });
    }
    if (!cands.length) return typed;
    // 優先拿標了「中文：」的那行，其次拿最長的（資訊最多）
    const zh = cands.find((c) => /^\s*[*\-•]?\s*中文\s*[：:]/.test(c.raw));
    const best = zh || cands.sort((a, b) => b.txt.length - a.txt.length)[0];
    let t = best.txt;
    // 只取「／」之前的中文段，避免中日文一起貼進搜尋框
    if (t.includes(" / ")) t = t.split(" / ")[0].trim();
    else if (t.includes("／")) t = t.split("／")[0].trim();
    return t || typed;
  };

  const bestName = pickName();

  const copyName = async () => {
    const t = bestName;
    if (!t) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(t);
      } else {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      alert("複製失敗，請長按文字手動複製：\n" + t);
    }
  };

  // 從 AI 回答裡抓第 N 點的答案（例：2 台灣售價、6 結論、7 門檻）
  const pickPoint = (n) => {
    if (!ans) return "";
    const lines = ans.split("\n").map(stripMd).filter(Boolean);
    const i = lines.findIndex((l) => new RegExp("^" + n + "[.、)]").test(l));
    if (i < 0) return "";
    let t = lines[i].replace(new RegExp("^" + n + "[.、)]\\s*"), "");
    const c = t.indexOf("：") >= 0 ? t.indexOf("：") : t.indexOf(":");
    if (c >= 0) t = t.slice(c + 1);
    t = t.trim();
    // 標題與答案被拆成兩行時，往下抓一行
    if (!t && lines[i + 1] && !/^[1-8][.、)]/.test(lines[i + 1]))
      t = stripMd(lines[i + 1]);
    return t.trim();
  };

  const persistSaved = (list) => {
    setSaved(list);
    try {
      localStorage.setItem("compare_saved", JSON.stringify(list));
    } catch (e) {
      alert("儲存空間已滿，請先刪掉幾筆舊紀錄。");
    }
  };

  const saveItem = () => {
    if (!bestName) return;
    const d = new Date();
    const item = {
      id: String(d.getTime()),
      name: bestName,
      mode,
      yen: isNaN(yenNum) ? null : yenNum,
      effYen: effYen,
      twd: twd,
      tw: pickPoint(2),
      verdict: pickPoint(6),
      threshold: pickPoint(7),
      bought: false,
      date: `${d.getMonth() + 1}/${d.getDate()}`,
    };
    persistSaved([item, ...saved.filter((s) => s.name !== item.name)]);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  const toggleBought = (id) =>
    persistSaved(
      saved.map((s) => (s.id === id ? { ...s, bought: !s.bought } : s))
    );
  const removeItem = (id) => persistSaved(saved.filter((s) => s.id !== id));

  const copyAllSaved = () => {
    const txt = saved
      .map(
        (s, i) =>
          `${i + 1}. ${s.name}${s.bought ? "（已買）" : ""}\n   日本 ${
            s.yen ? "¥" + s.yen.toLocaleString() : "—"
          }${s.twd ? " ≈ NT$" + s.twd.toLocaleString() : ""}\n   台灣 ${
            s.tw || "—"
          }\n   ${s.verdict || ""}`
      )
      .join("\n\n");
    const done = () => alert("清單已複製，可以貼到 LINE 或備忘錄。");
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(txt).then(done, () => alert(txt));
    else alert(txt);
  };

  const modeIcon = { shin: "🖊️", used: "📻", sew: "🧵" };

  const q = encodeURIComponent(bestName);
  const links = [
    { t: "momo", u: `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${q}`, c: "bg-pink-50 border-pink-200 text-pink-700" },
    { t: "PChome", u: `https://24h.pchome.com.tw/search/?q=${q}`, c: "bg-sky-50 border-sky-200 text-sky-700" },
    { t: "蝦皮", u: `https://shopee.tw/search?keyword=${q}`, c: "bg-orange-50 border-orange-200 text-orange-700" },
    { t: "Google購物", u: `https://www.google.com/search?tbm=shop&q=${q}`, c: "bg-gray-50 border-gray-200 text-gray-700" }
  ];

  return (
    <div className="space-y-4">
      <div className="glass-panel p-5 rounded-3xl bg-white border-gray-100 shadow-lg space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={mode === "shin" ? "商品名，例：Pentel Ain 替芯 0.5" : mode === "used" ? "商品名／型號，例：SONY WH-1000XM4" : "品牌型號，例：JUKI HZL-F600"}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 text-base font-bold text-gray-800 focus:border-indigo-400 outline-none"
        />
        <input
          value={yen}
          onChange={(e) => setYen(e.target.value)}
          inputMode="numeric"
          placeholder="日本標價（¥，未税）"
          className="w-full min-w-0 px-4 py-3 rounded-2xl border-2 border-gray-200 text-base font-bold text-gray-800 focus:border-indigo-400 outline-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => pickImg("item", "camera")}
            className="min-w-0 px-3 py-3 rounded-2xl border-2 border-indigo-200 bg-indigo-50 text-indigo-700 font-black text-sm"
          >
            📷 拍實物
          </button>
          <button
            onClick={() => pickImg("tag", "camera")}
            className="min-w-0 px-3 py-3 rounded-2xl border-2 border-indigo-200 bg-indigo-50 text-indigo-700 font-black text-sm"
          >
            🏷️ 拍價格標
          </button>
          <button
            onClick={() => pickImg("item", "gallery")}
            className="min-w-0 px-3 py-2.5 rounded-2xl border-2 border-gray-200 bg-white text-gray-600 font-black text-[13px]"
          >
            🖼️ 選實物圖
          </button>
          <button
            onClick={() => pickImg("tag", "gallery")}
            className="min-w-0 px-3 py-2.5 rounded-2xl border-2 border-gray-200 bg-white text-gray-600 font-black text-[13px]"
          >
            🖼️ 選價格標圖
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={readImg} className="hidden" />
          <input ref={galleryRef} type="file" accept="image/*" onChange={readImg} className="hidden" />
        </div>

        {img && (
          <div className="flex items-center gap-2">
            <img src={img} alt="價格標" className="w-16 h-16 object-cover rounded-xl border-2 border-gray-200" />
            <span className="text-xs text-gray-500 font-bold">
              {imgKind === "item" ? "已附商品實物照，AI 會先認出這是什麼" : "已附價格標照，AI 會讀出品名與日圓價"}
            </span>
            <button onClick={() => setImg(null)} className="ml-auto text-xs font-black text-rose-500">移除</button>
          </div>
        )}

        <div className="text-[11px] text-gray-400 font-bold leading-relaxed">
          品名／價格可以只填一個，或完全不填直接拍照讓 AI 認。上排開相機（手機現場用），下排從圖庫／檔案選圖（筆電也能用）。
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTaxFree(!taxFree)}
            className={`px-3 py-2 rounded-full border-2 text-xs font-black ${taxFree ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}
          >
            {taxFree ? "✅" : "⬜"} 這家可免税（滿 ¥5,000）
          </button>
          {taxFree && (
            <button
              onClick={() => setBookoffFee(!bookoffFee)}
              className={`px-3 py-2 rounded-full border-2 text-xs font-black ${bookoffFee ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}
            >
              {bookoffFee ? "✅" : "⬜"} BOOKOFF 扣 3% 手續費
            </button>
          )}
        </div>

        {twd != null && (
          <div className="p-3 rounded-2xl bg-indigo-50 border-2 border-indigo-100 text-sm font-black text-indigo-800">
            實付約 ¥{effYen.toLocaleString()} ≈ NT${twd.toLocaleString()}
            <span className="text-[11px] font-bold text-indigo-400 ml-2">（1 TWD ≈ {rate} JPY）</span>
          </div>
        )}

        <button
          onClick={ask}
          disabled={aiLoading}
          className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm disabled:opacity-40"
        >
          {aiLoading ? `查詢中… ${secs}s` : "🔍 查台灣售價並給建議"}
        </button>
      </div>

      {ans && (
        <div className="glass-panel p-5 rounded-3xl bg-white border-gray-100 shadow-lg space-y-3">
          {bestName && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-indigo-50 border-2 border-indigo-100">
              <div className="flex-1 min-w-0 text-sm font-black text-indigo-900 break-words">{bestName}</div>
              <button
                onClick={copyName}
                className={`shrink-0 px-3 py-2 rounded-xl border-2 text-xs font-black ${
                  copied ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-indigo-200 text-indigo-700"
                }`}
              >
                {copied ? "✓ 已複製" : "📋 複製"}
              </button>
            </div>
          )}
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-words">
            {ans
              .replace(/\*\*/g, "")
              .replace(/\[([^\]]+)\]\((https?:\/\/[^)]*vertexaisearch[^)]*)\)/g, "$1")
              .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 → $2")}
          </div>
          {bestName && (
            <button
              onClick={saveItem}
              className={`w-full py-3 rounded-2xl border-2 font-black text-sm ${
                justSaved
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "bg-white border-indigo-300 text-indigo-700"
              }`}
            >
              {justSaved ? "✓ 已存入待買清單" : "💾 存進待買清單（回台灣繼續買）"}
            </button>
          )}
        </div>
      )}

      {bestName && (
        <div>
          <div className="text-xs font-black text-gray-500 mb-2">👀 自己再確認一下（已帶入關鍵字，會開新分頁）</div>
          <div className="flex flex-wrap gap-2">
            {links.map((l) => (
              <a key={l.t} href={l.u} target="_blank" rel="noreferrer"
                className={`px-3 py-2 rounded-full border-2 text-xs font-black ${l.c}`}>
                {l.t}
              </a>
            ))}
          </div>
        </div>
      )}

      {saved.length > 0 && (
        <div className="glass-panel p-5 rounded-3xl bg-white border-gray-100 shadow-lg space-y-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-black text-gray-800">
              🛒 待買清單
              <span className="ml-2 text-[11px] font-bold text-gray-400">
                {saved.filter((s) => !s.bought).length} 待買 / {saved.length} 筆
              </span>
            </div>
            <button
              onClick={copyAllSaved}
              className="ml-auto shrink-0 px-3 py-1.5 rounded-xl border-2 border-gray-200 bg-white text-gray-600 text-[11px] font-black"
            >
              📋 複製整份
            </button>
          </div>

          <div className="space-y-2">
            {saved.map((s) => {
              const sq = encodeURIComponent(s.name);
              return (
                <div
                  key={s.id}
                  className={`p-3 rounded-2xl border-2 ${
                    s.bought ? "bg-gray-50 border-gray-150 opacity-60" : "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => toggleBought(s.id)}
                      className="shrink-0 text-lg leading-none pt-0.5"
                    >
                      {s.bought ? "✅" : "⬜"}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-black text-gray-800 break-words ${
                          s.bought ? "line-through" : ""
                        }`}
                      >
                        <span className="mr-1">{modeIcon[s.mode] || "🛍️"}</span>
                        {s.name}
                      </div>
                      <div className="text-[11px] font-bold text-gray-500 mt-0.5">
                        日本 {s.yen ? "¥" + s.yen.toLocaleString() : "—"}
                        {s.twd ? ` ≈ NT$${s.twd.toLocaleString()}` : ""}
                        <span className="text-gray-300 mx-1">·</span>
                        {s.date}
                      </div>
                      {s.tw && (
                        <div className="text-[11px] font-bold text-gray-500 break-words">
                          台灣 {s.tw}
                        </div>
                      )}
                      {s.verdict && (
                        <div className="text-[11px] font-black text-indigo-600 break-words mt-0.5">
                          {s.verdict}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <a
                          href={`https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${sq}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-full border-2 border-pink-200 bg-pink-50 text-pink-700 text-[10px] font-black"
                        >
                          momo
                        </a>
                        <a
                          href={`https://shopee.tw/search?keyword=${sq}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-full border-2 border-orange-200 bg-orange-50 text-orange-700 text-[10px] font-black"
                        >
                          蝦皮
                        </a>
                        <a
                          href={`https://www.google.com/search?tbm=shop&q=${sq}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-full border-2 border-gray-200 bg-gray-50 text-gray-600 text-[10px] font-black"
                        >
                          Google購物
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(s.id)}
                      className="shrink-0 text-[11px] font-black text-rose-400 pt-0.5"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-gray-400 font-bold">
            清單存在這支手機／這台電腦的瀏覽器裡，換裝置不會同步。要帶走請按「複製整份」貼到 LINE。
          </div>
        </div>
      )}

      <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 text-[11px] text-amber-800 leading-relaxed font-bold">
        ⚠️ AI 給的台灣價是「查證後的估算」，不是即時報價。金額大的東西，請按下面的連結自己看一眼再決定。
        {mode === "used" && " 二手品請用台灣二手行情比，不要拿新品價騙自己。"}
      </div>
    </div>
  );
};

const CompareTab = ({ aiLoading, setAiLoading, openKeyModal, twdJpyRate }) => {
  const [mode, setMode] = useState("shin");
  return (
    <div className="space-y-5 animate-in fade-in duration-700 pb-24">
      <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
        <span className="text-2xl">💱</span> 現場比價
      </h1>
      <p className="text-sm text-gray-400 -mt-3 leading-relaxed">
        站在架子前輸入品名與日圓標價（或直接拍價格標），馬上算出台灣價差與買不買。
      </p>

      <div className="flex gap-2">
        {CMP_MODES.map((m) => (
          <button
            key={m.k}
            onClick={() => setMode(m.k)}
            className={`flex-1 py-2.5 rounded-2xl border-2 text-xs font-black leading-tight ${
              mode === m.k ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-gray-500"
            }`}
          >
            <div className="text-base">{m.icon}</div>
            {m.label}
          </button>
        ))}
      </div>

      {mode === "sew" ? (
        <SewingTab aiLoading={aiLoading} setAiLoading={setAiLoading} openKeyModal={openKeyModal} />
      ) : (
        <PriceCompare
          mode={mode}
          aiLoading={aiLoading}
          setAiLoading={setAiLoading}
          openKeyModal={openKeyModal}
          twdJpyRate={twdJpyRate}
        />
      )}
    </div>
  );
};


// ==========================================
// 3.9 一次性資料搬遷：位置鍵 dayN-sM -> 穩定 sid（治本）
// 舊版把景點資料存成「第幾天-第幾個」，只要行程插入/刪除景點，
// 所有金額就會整段位移。這裡用「已上線版本的景點順序」把舊鍵
// 對回景點名稱，再換成 config.js 裡每個景點固定的 sid。
// ==========================================
(function migrateSpotKeys() {
  var FLAG = "spot_keys_migrated_v2";
  try {
    if (localStorage.getItem(FLAG)) return;

    // 舊版（已上線）各天的景點順序，索引即為舊鍵的 sM
    var LEGACY_ORDER = {}; // 新旅程（山陰版）沒有舊版位置鍵需要搬遷

    // 目前 config.js 的 名稱 -> sid（同名優先取同一天）
    var byDayName = {}, byName = {};
    (window.RAW_KML_DATA || []).forEach(function (d) {
      byDayName[d.dayId] = byDayName[d.dayId] || {};
      (d.spots || []).forEach(function (sp) {
        if (!sp || !sp.sid) return;
        if (!byDayName[d.dayId][sp.name]) byDayName[d.dayId][sp.name] = sp.sid;
        if (!byName[sp.name]) byName[sp.name] = sp.sid;
      });
    });

    var resolve = function (key) {
      var m = /^(day\d+)-s(\d+)$/.exec(key);
      if (!m) return null;                 // 已經是 sid 或其他格式，原樣保留
      var names = LEGACY_ORDER[m[1]];
      if (!names) return null;
      var nm = names[parseInt(m[2], 10)];
      if (!nm) return null;
      return (byDayName[m[1]] && byDayName[m[1]][nm]) || byName[nm] || null;
    };

    var STORES = ["ticket_overrides","trip_spot_tickets","stays","departures","modes","expenses"];
    var stamp = String(Date.now());
    var changed = 0;

    STORES.forEach(function (store) {
      var raw = localStorage.getItem(store);
      if (!raw) return;
      var obj;
      try { obj = JSON.parse(raw); } catch (e) { return; }
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;

      var out = {}, touched = false;
      Object.keys(obj).forEach(function (k) {
        var sid = resolve(k);
        if (sid && !(sid in obj)) { out[sid] = obj[k]; touched = true; changed++; }
        else { out[k] = obj[k]; }
      });
      if (touched) {
        try { localStorage.setItem(store + "_backup_" + stamp, raw); } catch (e) {}
        localStorage.setItem(store, JSON.stringify(out));
      }
    });

    localStorage.setItem(FLAG, stamp);
    if (changed) console.log("[migrate] 已把 " + changed + " 筆位置鍵改為固定 sid");
  } catch (e) {
    console.warn("[migrate] 搬遷失敗，維持原資料", e);
  }
})();

// ------------------------------------------
// 清掉 AI 估價估錯的門票（商店被估成飯店價、館所被估成天價）
// 每支手機第一次載入新版時會自動跑一次，並先備份
// ------------------------------------------
(function cleanBogusTickets() {
  var FLAG = "ticket_sanity_v1";
  try {
    if (localStorage.getItem(FLAG)) return;
    var raw = localStorage.getItem("ticket_overrides");
    if (!raw) {
      localStorage.setItem(FLAG, "1");
      return;
    }
    var obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      localStorage.setItem(FLAG, "1");
      return;
    }
    if (!obj || typeof obj !== "object") {
      localStorage.setItem(FLAG, "1");
      return;
    }

    var bySid = {};
    (window.RAW_KML_DATA || []).forEach(function (d) {
      (d.spots || []).forEach(function (sp) {
        if (sp && sp.sid) bySid[sp.sid] = sp;
      });
    });

    var out = {},
      removed = [],
      fixed = [];
    Object.keys(obj).forEach(function (k) {
      var v = obj[k] || {};
      var sp = bySid[k];
      var a = Number(v.adult) || 0;
      if (v.currency && !v.est) {
        out[k] = v; // 手動輸入的價格一律保留
        return;
      }
      if (sp && isFreeSpot(sp.name)) {
        removed.push(sp.name + " ¥" + a); // 商店/停車場/餐廳不該有門票
        return;
      }
      var base = sp && sp.ticket ? Number(sp.ticket.adult) || 0 : 0;
      if (base > 0 && a > base * 1.5) {
        // config 是查證過的公告票價，AI 估得離譜就拉回公告價
        fixed.push(sp.name + " ¥" + a + "→¥" + base);
        out[k] = {
          adult: base,
          child: Number(sp.ticket.child) || 0,
          currency: "JPY",
        };
        return;
      }
      var isHtl = sp ? isHotel(sp.name) : false;
      if (a > (isHtl ? 60000 : 6000)) {
        removed.push((sp ? sp.name : k) + " ¥" + a);
        return;
      }
      out[k] = v;
    });

    if (removed.length || fixed.length) {
      try {
        localStorage.setItem("ticket_overrides_bogus_backup", raw);
      } catch (e) {}
      localStorage.setItem("ticket_overrides", JSON.stringify(out));
      console.log("[ticket-sanity] 移除:", removed, " 修正:", fixed);
    }
    localStorage.setItem(FLAG, "1");
  } catch (e) {
    console.warn("[ticket-sanity] 清理失敗，維持原資料", e);
  }
})();

// ==========================================
// 4. 主應用程式 (App) - 整合所有邏輯
// ==========================================

// ============================================================================
// 🚇 METRO HOME（捷運路線圖首頁：環狀路線 → 當日直線 → 站點提醒）
//    針對 Pixel 9a（Chrome Android，CSS 視窗約 412×915、DPR 2.625、手勢返回）調校
// ============================================================================
const METRO = {
  bg: "#F7F4EE",
  ink: "#1F1D1A",
  sub: "#5E584E",
  line: "#E6E0D5",
  here: "#E2342F",
  past: "#CFC9BE",
  colors: ["#1767B3", "#D61F35", "#13804A", "#E89B00", "#7B52AE", "#A86B25"],
  tints: ["#B9D2EA", "#F2B7BF", "#A9D6BB", "#F6D899", "#CDBCE2", "#E2CBAE"],
  onColor: ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#1F1D1A", "#FFFFFF", "#FFFFFF"],
  tripStart: [2027, 0, 25], // 1/25（月份 0 起算）
  returnFlight: "19:00",
};
const MONO = "'Roboto Mono', 'JetBrains Mono', ui-monospace, monospace";
const SUPERMARKET_RE = /AEON|永旺|イオン|MaxValu|マックスバリュ|The Big|ザ・ビッグ|LAMU|ラ・ムー|Ajiso|新鮮館|youme|ゆめタウン|umie|スーパー|超市|業務/i;
const MINOR_RE = /^步行到|^接泊到|停車場|駐車場|[Pp]arking/;
const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const metroShort = (name) => {
  let n = (name || "").replace(/^步行到\s*|^接泊到\s*/, "").replace(/#/g, "");
  n = n.replace(/\s*[\(（｜|].*$/, "").trim();
  return n.length > 12 ? n.slice(0, 11) + "…" : n;
};
const haptic = (ms = 12) => {
  try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {}
};
// 📸 一鍵把比價指令複製到剪貼簿，再喚醒手機的 Gemini App（Pixel 9a 也可長按電源鍵叫出 Gemini）
const GEMINI_PRICE_PROMPT_DEFAULT = `你是我的日本旅遊尋寶與比價助手。請分析我接下來上傳的商品或標價照片：
1.【匯率換算】抓出日幣價格（分清稅拔／稅込），以 1 日圓 ≈ 0.215 台幣換算，並提示同店消費是否已滿 5,000 日圓可退稅。
2.【行情比價】辨識商品型號／番號，比對台灣網拍或二手行情，直接告訴我「值得買」「普通」或「台灣買就好」。
3.【防雷提醒】若是二手玩具、樂高、動漫周邊或電子產品，用一句話提醒常見缺件、盜版特徵或通病。
請用極簡條列回答，讓我在店內 3 秒看完做決定。`;
const launchGemini = async (prompt) => {
  haptic(20);
  let copied = false;
  try { await navigator.clipboard.writeText(prompt); copied = true; } catch (e) {}
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    // 有裝 Gemini App 就開 App，沒有就退回網頁版
    window.location.href = "intent://gemini.google.com/app#Intent;scheme=https;package=com.google.android.apps.bard;S.browser_fallback_url=https%3A%2F%2Fgemini.google.com%2Fapp;end";
  } else {
    window.open("https://gemini.google.com/app", "_blank");
  }
  return copied;
};
const mapsDir = (lat, lon, via) =>
  "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lon +
  (via ? "&waypoints=" + via.lat + "," + via.lon : "") + "&travelmode=driving";
const mapsSearchNear = (q, lat, lon) =>
  "https://www.google.com/maps/search/" + encodeURIComponent(q) + "/@" + lat + "," + lon + ",14z";

// ---- 環狀路線幾何（逆時針圓角矩形，起點在右下＝神戶） ----
const RING = { W: 380, H: 470, x0: 46, x1: 334, y0: 50, y1: 424, r: 42 };
const ringGeom = (() => {
  const { x0, x1, y0, y1, r } = RING;
  const V = y1 - y0 - 2 * r, Hh = x1 - x0 - 2 * r, A = (Math.PI * r) / 2;
  const segs = [
    { t: "L", len: V, p: [x1, y1 - r], d: [0, -1] },
    { t: "A", len: A, c: [x1 - r, y0 + r], a0: 0, a1: -Math.PI / 2 },
    { t: "L", len: Hh, p: [x1 - r, y0], d: [-1, 0] },
    { t: "A", len: A, c: [x0 + r, y0 + r], a0: -Math.PI / 2, a1: -Math.PI },
    { t: "L", len: V, p: [x0, y0 + r], d: [0, 1] },
    { t: "A", len: A, c: [x0 + r, y1 - r], a0: Math.PI, a1: Math.PI / 2 },
    { t: "L", len: Hh, p: [x0 + r, y1], d: [1, 0] },
    { t: "A", len: A, c: [x1 - r, y1 - r], a0: Math.PI / 2, a1: 0 },
  ];
  const P = segs.reduce((s, g) => s + g.len, 0);
  const at = (s) => {
    s = ((s % P) + P) % P;
    for (const g of segs) {
      if (s <= g.len) {
        if (g.t === "L") {
          const x = g.p[0] + g.d[0] * s, y = g.p[1] + g.d[1] * s;
          return { x, y, tx: g.d[0], ty: g.d[1], nx: g.d[1], ny: -g.d[0] };
        }
        const th = g.a0 + (g.a1 - g.a0) * (s / g.len);
        const x = g.c[0] + r * Math.cos(th), y = g.c[1] + r * Math.sin(th);
        const tx = Math.sin(th), ty = -Math.cos(th); // 逆時針切線
        return { x, y, tx, ty, nx: ty, ny: -tx };
      }
      s -= g.len;
    }
    return at(0);
  };
  const d =
    `M ${x1} ${y1 - r} L ${x1} ${y0 + r} A ${r} ${r} 0 0 0 ${x1 - r} ${y0} L ${x0 + r} ${y0} ` +
    `A ${r} ${r} 0 0 0 ${x0} ${y0 + r} L ${x0} ${y1 - r} A ${r} ${r} 0 0 0 ${x0 + r} ${y1} ` +
    `L ${x1 - r} ${y1} A ${r} ${r} 0 0 0 ${x1} ${y1 - r}`;
  return { P, at, d };
})();

// ---- 現在時間（可模擬）與旅程狀態 ----
const useMetroClock = (sim) => {
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 30000);
    const vis = () => document.visibilityState === "visible" && setTick(Date.now());
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, []);
  return useMemo(() => {
    const [Y, M, D] = METRO.tripStart;
    if (sim) {
      const d = new Date(Y, M, D + sim.dayIdx, 0, 0);
      d.setMinutes(sim.min);
      return d;
    }
    return new Date(tick);
  }, [tick, sim]);
};

// 時刻跨午夜時不歸零（避免 00:09 被當成清晨）
const metroTimeline = (spots) => {
  let prev = -1, add = 0;
  return spots.map((s) => {
    let a = timeToMinutes(s.time) + add;
    if (a < prev) { add += 1440; a += 1440; }
    prev = a;
    let dep = s.actualDepTime ? timeToMinutes(s.actualDepTime) + add : a + parseStayDuration(s.stay);
    if (dep < a) dep += 1440;
    return { a, dep };
  });
};
// 依實際進度順延今天剩下的行程：
//  ・GPS 到站時記下的「實際到達」比預計晚／早 → 後面全部跟著移
//  ・已到站、超過預計出發時間還沒按出發 → 以「現在」當出發，後面順延（每分鐘更新）
//  ・按「出發往下一站」的實際時間，本來就會在 tripData 裡往後串
//  ・只有「時間推估」的位置不順延（避免推估又推估）
const applyLiveTiming = (tripData, st, nowMin, arrivals) => {
  if (st.phase !== "trip" || st.source === "time" || st.source === "hotel") return { data: tripData, delay: 0 };
  const di = st.dayIdx, c = st.spotIdx;
  const spots = tripData[di].spots;
  const tl = metroTimeline(spots);
  const cur = spots[c];
  let delta = 0;
  const arr = arrivals[cur.id];
  if (arr) delta = timeToMinutes(arr) - tl[c].a;
  if (!cur.isDeparted) {
    const plannedDep = tl[c].dep + delta;
    if (nowMin > plannedDep) delta += nowMin - plannedDep;
  }
  if (Math.abs(delta) < 1) return { data: tripData, delay: 0 };
  const newSpots = spots.map((s, i) => {
    if (i < c) return s;
    const a = i === c ? (arr ? timeToMinutes(arr) : tl[i].a) : tl[i].a + delta;
    return { ...s, time: minutesToTimeStr(a), plannedTime: s.time, shifted: i > c };
  });
  const data = tripData.slice();
  data[di] = { ...tripData[di], spots: newSpots };
  return { data, delay: Math.round(delta) };
};

const computeMetroState = (tripData, now, gps, shoppingList) => {
  const [Y, M, D] = METRO.tripStart;
  const start = new Date(Y, M, D);
  const nDays = tripData.length;
  const dayIdxRaw = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - start) / 86400000);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const flat = [];
  tripData.forEach((d, di) => d.spots.forEach((s, si) => flat.push({ di, si, s })));
  const globalIndex = (di, si) => flat.findIndex((f) => f.di === di && f.si === si);

  if (dayIdxRaw < 0) {
    const days = Math.ceil((start - now) / 86400000);
    return { phase: "pre", days, dayIdx: 0, spotIdx: 0, source: "time", moving: false, flat, globalIndex, nowMin };
  }
  const lastDay = nDays - 1;
  if (dayIdxRaw > lastDay || (dayIdxRaw === lastDay && nowMin >= timeToMinutes(METRO.returnFlight))) {
    return { phase: "done", dayIdx: lastDay, spotIdx: tripData[lastDay].spots.length - 1, source: "time", moving: false, flat, globalIndex, nowMin };
  }
  const di = dayIdxRaw;
  const spots = tripData[di].spots;
  // 1) 手動：最後一個「已出發」的下一站
  let manual = -1;
  spots.forEach((s, i) => { if (s.isDeparted) manual = i; });
  // 2) GPS：300 m 內
  let gpsIdx = -1;
  if (gps && gps.acc < 1000) {
    let best = 0.3;
    spots.forEach((s, i) => {
      const km = parseFloat(getDistanceFromLatLonInKm(gps.lat, gps.lon, s.lat, s.lon));
      if (km <= best) { best = km; gpsIdx = i; }
    });
  }
  // 3) 時刻推估
  let timeIdx = 0, moving = false, beforeStart = false;
  const tl = metroTimeline(spots);
  if (nowMin < tl[0].a) beforeStart = true;
  else {
    for (let i = 0; i < spots.length; i++) {
      const a = tl[i].a;
      const dep = tl[i].dep;
      const nextA = i < spots.length - 1 ? tl[i + 1].a : Infinity;
      if (nowMin >= a) timeIdx = i;
      if (nowMin >= dep && nowMin < nextA && i < spots.length - 1) moving = true;
      else if (nowMin >= a && nowMin < dep) moving = false;
    }
  }
  let spotIdx, source;
  if (manual >= 0 && manual < spots.length - 1) {
    spotIdx = manual + 1; source = "manual"; moving = false;
    if (gpsIdx > spotIdx) { spotIdx = gpsIdx; source = "gps"; }
  } else if (manual === spots.length - 1) {
    spotIdx = manual; source = "manual"; moving = false;
  } else if (gpsIdx >= 0) {
    spotIdx = gpsIdx; source = "gps"; moving = false;
  } else {
    spotIdx = timeIdx; source = beforeStart ? "hotel" : "time";
  }
  return { phase: "trip", dayIdx: di, spotIdx, source, moving, beforeStart, flat, globalIndex, nowMin };
};

// 午餐補給：當天第一段落在 12:00–16:00 的移動
const findLunchLeg = (spots) => {
  const tl = metroTimeline(spots);
  for (let i = 0; i < spots.length - 1; i++) {
    const dep = tl[i].dep;
    const arr = tl[i + 1].a;
    if (arr >= 12 * 60 && dep <= 16 * 60 && !MINOR_RE.test(spots[i + 1].name)) return i;
  }
  return -1;
};
const nearestBackup = (a, b) => {
  const list = window.BACKUP_RESTAURANTS || [];
  const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
  let best = null;
  list.forEach((r) => {
    const km = parseFloat(getDistanceFromLatLonInKm(mid.lat, mid.lon, r.lat, r.lon));
    if (km < 25 && (!best || km < best.km)) best = { ...r, km };
  });
  return { best, mid };
};
const hotelIndex = (spots) => {
  let h = -1;
  spots.forEach((s, i) => { if (isHotel(s.name) || /萬翠樓|旅館|ホテル/.test(s.name)) h = i; });
  return h;
};
const dinnerStops = (spots, from) => {
  const h = hotelIndex(spots);
  if (h < 0) return { h, list: [] };
  const list = [];
  for (let i = Math.max(0, from); i < h; i++) if (SUPERMARKET_RE.test(spots[i].name)) list.push(i);
  return { h, list };
};

// ---- 小元件 ----
const MetroBadge = ({ i, size = 30, ring }) => (
  <span
    style={{
      width: size, height: size, borderRadius: size / 2, background: METRO.colors[i], color: METRO.onColor[i],
      fontFamily: MONO, fontSize: size * 0.38, fontWeight: 700, display: "inline-flex", alignItems: "center",
      justifyContent: "center", flexShrink: 0, boxShadow: ring ? `0 0 0 3px ${METRO.tints[i]}` : "none",
    }}
  >
    {String(i + 1).padStart(2, "0")}
  </span>
);
const Chevron = ({ color = "currentColor", size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
    <path d="M4 2 L9 6 L4 10" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SectionCard = ({ color, title, right, children }) => (
  <div style={{ background: "#fff", border: `1px solid ${METRO.line}`, borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 8, height: 22, borderRadius: 4, background: color }} />
      <div style={{ fontSize: 15, fontWeight: 900 }}>{title}</div>
      {right && <div style={{ marginLeft: "auto", fontSize: 11, color: METRO.sub }}>{right}</div>}
    </div>
    {children}
  </div>
);
const PillBtn = ({ href, onClick, dark, children, style }) => {
  const s = {
    flex: 1, minHeight: 48, borderRadius: 12, fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center",
    justifyContent: "center", gap: 6, padding: "0 10px", textAlign: "center", textDecoration: "none",
    background: dark ? METRO.ink : "#fff", color: dark ? "#fff" : METRO.ink, border: `2px solid ${METRO.ink}`, ...style,
  };
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" style={s} onClick={() => haptic()}>{children}</a>
  ) : (
    <button onClick={() => { haptic(); onClick && onClick(); }} style={{ ...s, fontFamily: "inherit" }}>{children}</button>
  );
};

// ============================================================================
// 主元件
// ============================================================================
const MetroTab = ({
  tripData, view, go, back, shoppingList, toggleBought, handleDepartureToggle, simDeps, setSimDeps,
  openExpenseModal, openChainFinder, scanSpotNearby, openSettings, openDetail, winterRoutes, simRequest, launchGemini: launchGeminiPrice, edit, openKeyModal, intelAllRequest, twdJpyRate, setTwdJpyRate, radarRequest, addCustomSpot, removeCustomSpot, addShoppingItem,
}) => {
  const [radarOpen, setRadarOpen] = useState(false);
  useEffect(() => { if (radarRequest) setRadarOpen(true); }, [radarRequest]);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = (text, undo) => {
    clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = setTimeout(() => setToast(null), undo ? 6000 : 3000);
  };
  const [sim, setSim] = useState(() => {
    try { return JSON.parse(localStorage.getItem("metro_sim") || "null"); } catch (e) { return null; }
  });
  const [simOpen, setSimOpen] = useState(false);
  useEffect(() => { if (simRequest) setSimOpen(true); }, [simRequest]);
  // 更多 › AI 查核今天所有站：逐站查、每站間隔 1.2 秒、失敗跳過
  const [intelProg, setIntelProg] = useState(null);
  useEffect(() => {
    if (!intelAllRequest) return;
    if (!localStorage.getItem("gemini_api_key")) { openKeyModal && openKeyModal(true); return; }
    const di = sim ? sim.dayIdx : st.phase === "trip" ? st.dayIdx : 0;
    const day = tripData[di];
    let cancelled = false;
    (async () => {
      const all = loadIntel();
      let ok = 0;
      for (let i = 0; i < day.spots.length; i++) {
        if (cancelled) break;
        const sp = day.spots[i];
        setIntelProg({ i: i + 1, n: day.spots.length, name: metroShort(sp.name) });
        try {
          const dep = minutesToTimeStr(timeToMinutes(sp.time) + parseStayDuration(sp.stay));
          const text = await generateGeminiContent(buildIntelPrompt(sp, day, sp.time, dep, "car"), null, true, { maxTokens: 4096 });
          const o = parseIntel(text); o.at = Date.now(); all[sp.id] = o; saveIntel(all); ok++;
        } catch (e) { if (/QUOTA/.test(e.message)) break; }
        await new Promise((r) => setTimeout(r, 1200));
      }
      setIntelProg(null);
      showToast(`AI 查核完成：${ok}／${day.spots.length} 站（${day.title}）`);
    })();
    return () => { cancelled = true; };
  }, [intelAllRequest]);
  const [gps, setGps] = useState(null);
  const [gpsOn, setGpsOn] = useState(() => localStorage.getItem("metro_gps") === "1");
  const now = useMetroClock(sim);
  const st = useMemo(() => computeMetroState(tripData, now, sim ? null : gps, shoppingList), [tripData, now, gps, sim, shoppingList]);
  // GPS 第一次靠站 → 記錄實際到達時間（試玩模式不記）
  const [arrivals, setArrivals] = useState(() => {
    try { return JSON.parse(localStorage.getItem("metro_arrivals") || "{}"); } catch (e) { return {}; }
  });
  const curSpot = st.phase === "trip" ? tripData[st.dayIdx].spots[st.spotIdx] : null;
  useEffect(() => {
    if (sim || st.source !== "gps" || !curSpot || arrivals[curSpot.id]) return;
    const next = { ...arrivals, [curSpot.id]: hhmm(new Date()) };
    setArrivals(next);
    try { localStorage.setItem("metro_arrivals", JSON.stringify(next)); } catch (e) {}
  }, [st.source, curSpot && curSpot.id, sim]);
  // 試玩開始／結束時，切換記憶體中的出發紀錄
  useEffect(() => { setSimDeps(sim ? (simDeps || {}) : null); }, [!!sim]);
  const toggleDep = (id) => {
    if (sim) setSimDeps((p) => { const n = { ...(p || {}) }; if (n[id]) delete n[id]; else n[id] = hhmm(now); return n; });
    else handleDepartureToggle(id);
  };
  // 出發／取消出發：只有旅途「當天」可按；取消要確認；出發後 6 秒內可復原
  const depart = (dayIdx, s) => {
    if (sim ? dayIdx !== sim.dayIdx : st.phase !== "trip" || dayIdx !== st.dayIdx) {
      haptic(30);
      showToast(sim ? "試玩只能操作試玩的那一天" : st.phase === "pre" ? "旅途當天（1/25 起）才會記錄出發" : "只能記錄「今天」的出發");
      return false;
    }
    if (s.actualDepTime) {
      if (!window.confirm(`取消 ${s.actualDepTime} 的出發紀錄？\n後面各站時間會改回預估。`)) return false;
      toggleDep(s.id);
      showToast("已取消出發紀錄");
      return false;
    }
    toggleDep(s.id);
    showToast(`已記錄 ${hhmm(now)} 從「${metroShort(s.name)}」出發`, () => toggleDep(s.id));
    return true;
  };
  const live = useMemo(() => applyLiveTiming(tripData, st, st.nowMin, sim ? {} : arrivals), [tripData, st, arrivals, sim]);
  const liveData = live.data;

  useEffect(() => {
    try { sim ? localStorage.setItem("metro_sim", JSON.stringify(sim)) : localStorage.removeItem("metro_sim"); } catch (e) {}
  }, [sim]);

  // GPS：只在 App 可見時追蹤（Pixel 9a 雙頻 GNSS，開高精度；背景自動停以省電）
  useEffect(() => {
    if (!gpsOn || !navigator.geolocation) return;
    let id = null;
    const startW = () => {
      if (id != null) return;
      id = navigator.geolocation.watchPosition(
        (p) => setGps({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, t: Date.now() }),
        () => {},
        { enableHighAccuracy: true, maximumAge: 20000, timeout: 30000 }
      );
    };
    const stopW = () => { if (id != null) { navigator.geolocation.clearWatch(id); id = null; } };
    const vis = () => (document.visibilityState === "visible" ? startW() : stopW());
    startW();
    document.addEventListener("visibilitychange", vis);
    return () => { stopW(); document.removeEventListener("visibilitychange", vis); };
  }, [gpsOn]);

  const enableGps = () => {
    haptic();
    if (!navigator.geolocation) return alert("此瀏覽器不支援定位");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, t: Date.now() });
        setGpsOn(true);
        localStorage.setItem("metro_gps", "1");
      },
      (e) => alert("無法取得定位：" + (e.code === 1 ? "請在 Chrome 網站設定允許「位置」" : e.message)),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Android 狀態列顏色跟著頁面走
  const dayIdxView = view.level === "ring" ? null : view.day;
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const prev = meta.getAttribute("content");
    meta.setAttribute("content", dayIdxView == null ? METRO.bg : METRO.colors[dayIdxView]);
    return () => meta.setAttribute("content", prev);
  }, [dayIdxView]);

  const common = { tripData: liveData, st, now, go, back, sim, delay: live.delay, edit };
  return (
    <div style={{ background: METRO.bg, color: METRO.ink, minHeight: "100%", fontFamily: "'Noto Sans TC', system-ui, sans-serif" }}>
      {sim && (
        <div style={{ background: "#FFE08A", color: "#5A4300", fontSize: 12, fontWeight: 900, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1 }}>試玩模式：{`1/${25 + sim.dayIdx} ${minutesToTimeStr(sim.min)}`}（不是真實時間）</span>
          <button onClick={() => setSimOpen(true)} style={{ minHeight: 32, padding: "0 10px", borderRadius: 16, border: "2px solid #5A4300", background: "transparent", fontWeight: 900, color: "#5A4300", fontFamily: "inherit" }}>調整</button>
          <button onClick={() => { haptic(); setSim(null); }} style={{ minHeight: 32, padding: "0 10px", borderRadius: 16, border: 0, background: "#5A4300", color: "#fff", fontWeight: 900, fontFamily: "inherit" }}>結束</button>
        </div>
      )}
      {view.level === "ring" && (
        <RingHome {...common} gpsOn={gpsOn} gps={gps} enableGps={enableGps} openSettings={openSettings} openKeyModal={openKeyModal} twdJpyRate={twdJpyRate} setTwdJpyRate={setTwdJpyRate} showToast={showToast}
          openSim={() => setSimOpen(true)} shoppingList={shoppingList} />
      )}
      {view.level === "day" && <DayLine {...common} dayIdx={view.day} openDetail={openDetail} depart={depart} winterRoutes={winterRoutes} />}
      {view.level === "station" && (
        <StationPage {...common} dayIdx={view.day} spotIdx={view.spot} shoppingList={shoppingList} toggleBought={toggleBought}
          depart={depart} openExpenseModal={openExpenseModal} openChainFinder={openChainFinder}
          showToast={showToast} winterRoutes={winterRoutes} launchGemini={launchGeminiPrice} openKeyModal={openKeyModal} removeCustomSpot={removeCustomSpot} />
      )}
      {intelProg && (
        <div style={{ position: "fixed", left: 16, right: 16, top: "calc(12px + env(safe-area-inset-top))", zIndex: 90, background: "#1767B3", color: "#fff", borderRadius: 14, padding: "10px 14px", fontSize: 13, fontWeight: 700, boxShadow: "0 6px 20px rgba(0,0,0,.3)" }}>
          ✨ AI 查核中 {intelProg.i}／{intelProg.n}：{intelProg.name}
        </div>
      )}
      {toast && (
        <div role="status" style={{ position: "fixed", left: 16, right: 16, bottom: "calc(100px + env(safe-area-inset-bottom))", zIndex: 90, background: "#1C1B19", color: "#fff", borderRadius: 14, padding: "10px 12px 10px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 6px 20px rgba(0,0,0,.3)", fontSize: 13, fontWeight: 700 }}>
          <span style={{ flex: 1 }}>{toast.text}</span>
          {toast.undo && (
            <button onClick={() => { haptic(); toast.undo(); setToast(null); }} style={{ minHeight: 40, padding: "0 12px", borderRadius: 10, border: 0, background: "#FFC24D", color: METRO.ink, fontWeight: 900, fontFamily: "inherit" }}>復原</button>
          )}
        </div>
      )}
      {radarOpen && <EventRadar tripData={liveData} close={() => setRadarOpen(false)} openKeyModal={openKeyModal} showToast={showToast} addCustomSpot={addCustomSpot} addShoppingItem={addShoppingItem} st={st} sim={sim} go={go} />}
      {simOpen && <SimSheet sim={sim} setSim={setSim} close={() => setSimOpen(false)} tripData={tripData} />}
    </div>
  );
};

// ---- 試玩模式（出發前就能看旅途中畫面） ----
const SimSheet = ({ sim, setSim, close, tripData }) => {
  const [d, setD] = useState(sim ? sim.dayIdx : 2);
  const [m, setM] = useState(sim ? sim.min : 12 * 60 + 20);
  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 80, display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "#fff", borderRadius: "24px 24px 0 0", padding: "18px 16px calc(18px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: METRO.past, alignSelf: "center" }} />
        <div style={{ fontSize: 17, fontWeight: 900 }}>試玩：假裝現在是…</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {tripData.map((day, i) => (
            <button key={i} onClick={() => { haptic(); setD(i); }}
              style={{ minHeight: 48, borderRadius: 12, border: d === i ? `3px solid ${METRO.colors[i]}` : `2px solid ${METRO.line}`, background: d === i ? METRO.tints[i] : "#fff", fontFamily: "inherit", fontWeight: 900, fontSize: 13, color: METRO.ink }}>
              1/{25 + i}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, width: 92 }}>{minutesToTimeStr(m)}</div>
          <input type="range" min={6 * 60} max={22 * 60} step={10} value={m} onChange={(e) => setM(+e.target.value)}
            style={{ flex: 1, height: 40, accentColor: METRO.colors[d] }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <PillBtn onClick={() => { setSim(null); close(); }}>用真實時間</PillBtn>
          <PillBtn dark onClick={() => { setSim({ dayIdx: d, min: m }); close(); }}>開始試玩</PillBtn>
        </div>
      </div>
    </div>
  );
};

// ---- ① 首頁：環狀路線圖 ----
// ✨ 站點情報：Gemini + Google Search 查核營業／公休／停車／現場攻略（結果存手機）
const INTEL_KEY = "metro_intel";
const loadIntel = () => { try { return JSON.parse(localStorage.getItem(INTEL_KEY) || "{}"); } catch (e) { return {}; } };
const saveIntel = (obj) => { try { localStorage.setItem(INTEL_KEY, JSON.stringify(obj)); } catch (e) {} };
const spotKind = (s) => {
  if (isHotel(s.name)) return "hotel";
  if (/砂丘|沙丘|滑雪|城|馬場|海岸|公園|展望/.test(s.name) && !/美術館|博物館/.test(s.name)) return "outdoor";
  if (isFreeSpot(s.name) || MINOR_RE.test(s.name)) return "shop";
  return "museum";
};
const KIND_CHECKS = {
  shop: "這是商店／商場／二手店／交通節點。請查：1) 該日是否營業、開店與打烊時間，抵達時間是否已開店；2) 是否有免稅（Tax-Free）櫃台與免稅門檻；3) 停車場是否免費或需消費折抵、入口在哪；4) 這類店冬季常見的尋寶重點（例如二手雪具、滑雪盆、玩具區）。",
  museum: "這是博物館／科學館／展館。請查：1) 該日（含星期幾）是否公休、1 月底冬季開館時間與最後入場時間，是否與抵達／離開時段衝突；2) 停留時段內有沒有定時導覽、實驗秀、機關演示的場次；3) 小學生適合的互動展區或體驗活動；4) 停車場位置與費用。",
  outdoor: "這是戶外景點／古蹟／雪場。請查：1) 1 月底積雪、暴風雪、強風導致封閉或纜車停駛的風險與官方公告；2) 冬季開放時間與最後入場（如城郭 16:00 閉門）；3) 需脫鞋、地面結冰、裝備（防滑、厚襪、暖暖包）等實戰注意；4) 停車場與冬季路況。",
  hotel: "這是住宿。請查：1) 入住與退房時間、停車場費用與是否需預約；2) 晚餐／早餐時段與最後入場；3) 溫泉或設施的使用時間、小學生可否使用；4) 附近 1 公里內的超市或便利商店（買隔天早餐）。",
};
const buildIntelPrompt = (s, day, arr, dep, mode) => {
  const fam = localStorage.getItem("travelers") || window.TRAVELERS || "2 大 2 小（兩個小學男生）";
  const date = "2027 年 " + day.date.replace(/\s*\(/, "（").replace(/\)/, "）");
  return `你是日本山陰山陽冬季自駕旅遊的「副駕情報官」。請用 Google 搜尋該地點的日文官方資訊，給出極簡、高價值的實戰提醒。

地點：${s.name}
座標：${s.lat},${s.lon}
日期：${date}
預計抵達 ${arr}、離開 ${dep}（停留 ${s.stay}）
移動方式：${mode === "walk" ? "步行" : "開車自駕（租車、雪胎）"}
成員：${fam}

${KIND_CHECKS[spotKind(s)]}

規則：
- 嚴禁輸出「注意保暖、穿好走的鞋、祝旅途愉快」等常識廢話。
- 2027 年 1 月的臨時公告若尚未公布，請依「固定星期公休」與「歷年 1 月底冬季慣例」給預警，並在句尾加「（依歷年慣例）」。
- 查不到就寫「未查到」，不要編造。
- 只輸出以下 JSON，不要加任何說明或 markdown 標記：
{"status":"營業檢核：該日是否營業、時間、與抵達時段是否衝突（30 字內）","status_level":"ok 或 warn 或 closed","must_know":"現場攻略一句（40 字內）","parking":"停車／交通一句（30 字內）","extra":"其他重要提醒，沒有就空字串（40 字內）"}`;
};
const parseIntel = (text) => {
  const t = (text || "").replace(/```json|```/g, "").trim();
  try {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) { const o = JSON.parse(m[0]); if (o && (o.status || o.must_know)) return o; }
  } catch (e) {}
  // JSON 被截斷或格式不全：逐欄位用正規式撈，撈得到就照卡片顯示
  const pick = (k) => { const m = t.match(new RegExp('"' + k + '"\\s*:\\s*"([^"]*)')); return m ? m[1] : ""; };
  const o = { status: pick("status"), status_level: pick("status_level"), must_know: pick("must_know"), parking: pick("parking"), extra: pick("extra") };
  if (o.status || o.must_know) return o;
  return { raw: t.replace(/^\{?\s*"[a-z_]+"\s*:\s*"/i, "").replace(/"\s*,\s*"[a-z_]+"\s*:\s*"/gi, "\n• ").replace(/"\s*\}?$/, "") };
};
// 🛍️ 這站附近哪裡買：通路類型即開地圖（做法一）＋ AI 聯網找具體店家（做法二）
const STORE_KEY = "metro_stores";
const loadStores = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch (e) { return {}; } };
const itemChannels = (it) => (it.channels && it.channels.length ? it.channels : [it.name]);
const buildStorePrompt = (s, it) => `使用者目前在日本「${s.name}」（座標 ${s.lat},${s.lon}），時間是 2027 年 1 月底冬季。
想買：「${it.name}」${it.note ? "（" + it.note + "）" : ""}。
可能有賣的通路類型：${itemChannels(it).join("、")}。

請用 Google 搜尋，找出距離此地點車程 10 分鐘內（或步行可達）、實際有在賣這項商品的 3 家具體實體店鋪。
注意：小型 BOOKOFF 只賣書和軟體，雪具、玩具類要找 SUPER BAZAAR 或 Hard Off / Hobby Off；百元店只在冬季擺雪球夾等季節品。
找不到就回傳空陣列，不要編造店名。
只輸出 JSON 陣列，不加 markdown：
[{"store":"店名＋分店名（日文，供地圖搜尋）","why":"推薦理由與距離（30 字內）","q":"地圖搜尋用的店名＋分店名"}]`;
const parseStores = (text) => {
  const t = (text || "").replace(/```json|```/g, "").trim();
  try { const m = t.match(/\[[\s\S]*\]/); if (m) { const a = JSON.parse(m[0]); if (Array.isArray(a)) return a.filter((x) => x && x.store); } } catch (e) {}
  const out = []; const re = /"store"\s*:\s*"([^"]*)"[\s\S]*?"why"\s*:\s*"([^"]*)"(?:[\s\S]*?"q"\s*:\s*"([^"]*)")?/g; let m;
  while ((m = re.exec(t))) out.push({ store: m[1], why: m[2], q: m[3] || m[1] });
  return out;
};
const StoreFinder = ({ s, it, openKeyModal, showToast, close }) => {
  const key = s.id + "|" + it.id;
  const [res, setRes] = useState(() => loadStores()[key] || null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!localStorage.getItem("gemini_api_key")) { openKeyModal && openKeyModal(true); return; }
    if (!navigator.onLine) { showToast && showToast("沒有網路，請先用上面的通路按鈕開地圖"); return; }
    haptic(); setBusy(true);
    try {
      const text = await generateGeminiContent(buildStorePrompt(s, it), null, true, { maxTokens: 4096 });
      const list = parseStores(text);
      const o = { list, at: Date.now(), raw: list.length ? null : text.slice(0, 300) };
      const all = loadStores(); all[key] = o; try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch (e) {}
      setRes(o);
    } catch (e) {
      if (/NO_API_KEY|BAD_API_KEY/.test(e.message)) openKeyModal && openKeyModal(true);
      else showToast && showToast(e.message.startsWith("QUOTA") ? "Gemini 配額用完，請稍後再試" : "搜尋失敗：" + e.message);
    }
    setBusy(false);
  };
  return (
    <div style={{ background: "#F7F4EE", borderRadius: 14, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, color: METRO.sub }}>{it.icon} {it.name}・這站附近哪裡買</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {itemChannels(it).map((c) => (
          <a key={c} href={mapsSearchNear(c, s.lat, s.lon)} target="_blank" rel="noreferrer" onClick={() => haptic()}
            style={{ minHeight: 36, padding: "0 12px", borderRadius: 18, border: `2px solid ${METRO.line}`, background: "#fff", fontSize: 12, fontWeight: 900, color: METRO.ink, display: "flex", alignItems: "center", textDecoration: "none" }}>🗺️ {c}</a>
        ))}
      </div>
      {res && res.list && res.list.length > 0 && res.list.map((st, i) => (
        <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 900 }}>📍 {st.store}</div>
            <div style={{ fontSize: 11, color: METRO.sub }}>{st.why}</div>
          </div>
          <a href={mapsDir(0, 0).replace("destination=0,0", "destination=" + encodeURIComponent(st.q || st.store))} target="_blank" rel="noreferrer" onClick={() => haptic()}
            style={{ minHeight: 40, padding: "0 10px", borderRadius: 10, background: METRO.ink, color: "#fff", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}>導航</a>
        </div>
      ))}
      {res && res.list && !res.list.length && <div style={{ fontSize: 12, color: METRO.sub }}>AI 沒找到確定有賣的店{res.raw ? "：" + res.raw : ""}。請用上面的通路按鈕看地圖。</div>}
      <div style={{ display: "flex", gap: 6 }}>
        <PillBtn dark onClick={run} style={{ opacity: busy ? 0.6 : 1, minHeight: 40, fontSize: 12 }}>{busy ? "AI 搜尋中…" : res ? "🔄 AI 再找附近賣家" : "🔍 AI 找附近賣家（聯網）"}</PillBtn>
        <PillBtn onClick={close} style={{ flex: 0, minHeight: 40, fontSize: 12, borderColor: METRO.line }}>收起</PillBtn>
      </div>
    </div>
  );
};
const IntelCard = ({ s, day, arr, dep, mode, openKeyModal, showToast }) => {
  const [intel, setIntel] = useState(() => loadIntel()[s.id] || null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setIntel(loadIntel()[s.id] || null); }, [s.id]);
  const run = async () => {
    if (!localStorage.getItem("gemini_api_key")) { openKeyModal && openKeyModal(true); return; }
    if (!navigator.onLine) { showToast && showToast("沒有網路，無法查核"); return; }
    haptic();
    setBusy(true);
    try {
      const text = await generateGeminiContent(buildIntelPrompt(s, day, arr, dep, mode), null, true, { maxTokens: 4096 });
      const o = parseIntel(text);
      o.at = Date.now();
      const all = loadIntel(); all[s.id] = o; saveIntel(all);
      setIntel(o);
    } catch (e) {
      if (/NO_API_KEY|BAD_API_KEY/.test(e.message)) openKeyModal && openKeyModal(true);
      else showToast && showToast(e.message.startsWith("QUOTA") ? "Gemini 配額用完，請稍後再試" : "查核失敗：" + e.message);
    }
    setBusy(false);
  };
  const lvl = intel && (intel.status_level || "ok");
  const statusColor = lvl === "closed" ? ["#FFD2CC", "#8A1C12", "🔴"] : lvl === "warn" ? ["#FFE08A", "#5A4300", "🟡"] : ["#CDEBD8", "#0B5E36", "🟢"];
  const Row = ({ bg, fg, icon, label, text }) => text ? (
    <div style={{ display: "flex", gap: 8, background: bg, borderRadius: 12, padding: "8px 10px" }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, lineHeight: "19px", color: fg }}><b>{label}：</b>{text}</span>
    </div>
  ) : null;
  const when = intel && intel.at ? new Date(intel.at) : null;
  return (
    <SectionCard color="#1767B3" title="AI 查核" right={when ? `查核於 ${when.getMonth() + 1}/${when.getDate()}` : "營業・公休・停車"}>
      {intel && !intel.raw && (
        <>
          <Row bg={statusColor[0]} fg={statusColor[1]} icon={statusColor[2]} label="營業檢核" text={intel.status} />
          <Row bg="#FFF6E3" fg="#5A4300" icon="💡" label="現場攻略" text={intel.must_know} />
          <Row bg="#EAF2FB" fg="#0F3F70" icon="🅿️" label="停車交通" text={intel.parking} />
          <Row bg="#F4EFFA" fg="#5B3A8A" icon="📌" label="其他" text={intel.extra} />
        </>
      )}
      {intel && intel.raw && <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: "20px" }}>{intel.raw}</div>}
      {!intel && <div style={{ fontSize: 12, color: METRO.sub }}>用 Gemini 聯網查這站當天是否營業、公休、冬季時間、停車與現場攻略。現在查抓固定規則，出發前一週再按一次更新臨時公告。</div>}
      <PillBtn dark={!intel} onClick={run} style={{ opacity: busy ? 0.6 : 1 }}>
        {busy ? "查核中…（約 10–20 秒）" : intel ? "🔄 重新查核 2027/1 營業與避雷" : "✨ AI 查核 2027/1 營業與避雷"}
      </PillBtn>
      {intel && <div style={{ fontSize: 11, color: METRO.sub }}>AI 聯網查核仍可能有誤，出發前請以官網為準。</div>}
    </SectionCard>
  );
};

// 📡 期間限定活動雷達：走廊搜尋（當天全部站點座標＋飯店）→ 一鍵插站或存清單
const EVENTS_KEY = "metro_events";
const loadEvents = () => { try { return JSON.parse(localStorage.getItem(EVENTS_KEY) || "{}"); } catch (e) { return {}; } };
const buildEventPrompt = (day, dayIdx, tripData) => {
  const hotels = window.HOTEL_INFO || [];
  const wr = (window.WINTER_ROUTES || []).find((w) => w.dayId === day.dayId);
  const pts = day.spots.filter((s) => !MINOR_RE.test(s.name)).map((s) => `${metroShort(s.name)}(${s.lat.toFixed(3)},${s.lon.toFixed(3)})`);
  const stayNames = [hotels[dayIdx - 1], hotels[dayIdx]].filter(Boolean).map((h) => h.location).join("、");
  const weekend = /六|日/.test(day.date);
  const fam = localStorage.getItem("travelers") || window.TRAVELERS || "2 大 2 小（小學男生）";
  return `請用 Google 搜尋日本在地公開資訊（優先：いこーよ、Walkerplus、神戸ジャーナル、岡山観光WEB、とっとり旅、フリマガイド、こくちーずプロ、各博物館與百貨官網、駿河屋／BOOKOFF 官方 X）。
我們（${fam}，喜歡科學實驗、鐵道、樂高、動漫二手玩具、市集尋寶）將於 2027 年 ${day.date} 自駕走這條路線：
路線：${wr ? wr.route : day.title}；住宿地：${stayNames || "無"}
當天站點與座標：${pts.join("、")}

請找出「2027 年 ${day.date} 當天正在舉辦」、且地點在上述任一站點 15 公里內或路線繞路 20 分鐘內的期間限定活動：
${weekend ? "1) 蚤の市・フリーマーケット・骨董市・マルシェ・ハンドメイドイベント（週末重點）\n2) " : "1) "}博物館／科學館的企画展・特別展・ワークショップ
${weekend ? "3)" : "2)"} 商場、車站大樓、百貨的ポップアップストア・催事・セール（動漫、卡牌、玩具、二手）
${weekend ? "" : "3) 平日限定的工作坊或體驗\n"}
規則：只列目前已公開、日期確認含當天的活動；查不到就回傳空陣列，嚴禁編造。每個活動給大約座標（lat,lon，查官網或地圖）。
只輸出 JSON 陣列，不加 markdown：
[{"title":"活動名（附日文原名）","venue":"場地名（供地圖定位）","lat":34.7,"lon":135.2,"date_time":"期間與時間","type":"特展／蚤之市／市集／快閃店／工作坊","highlight":"為什麼適合小學生或尋寶（30 字內）","source":"來源網站或官網關鍵字"}]`;
};
const parseEvents = (text) => {
  const t = (text || "").replace(/```json|```/g, "").trim();
  try { const m = t.match(/\[[\s\S]*\]/); if (m) { const a = JSON.parse(m[0]); if (Array.isArray(a)) return a.filter((x) => x && x.title); } } catch (e) {}
  return [];
};
const EventRadar = ({ tripData, close, openKeyModal, showToast, addCustomSpot, addShoppingItem, st, sim, go }) => {
  const [di, setDi] = useState(sim ? sim.dayIdx : st.phase === "trip" ? st.dayIdx : 0);
  const [all, setAll] = useState(() => loadEvents());
  const [busy, setBusy] = useState(false);
  const day = tripData[di];
  const res = all[day.dayId];
  const run = async () => {
    if (!localStorage.getItem("gemini_api_key")) { openKeyModal(true); return; }
    if (!navigator.onLine) { showToast("沒有網路"); return; }
    haptic(); setBusy(true);
    try {
      const text = await generateGeminiContent(buildEventPrompt(day, di, tripData), null, true, { maxTokens: 6000 });
      const list = parseEvents(text);
      const next = { ...all, [day.dayId]: { list, at: Date.now(), raw: list.length ? null : text.slice(0, 200) } };
      setAll(next); try { localStorage.setItem(EVENTS_KEY, JSON.stringify(next)); } catch (e) {}
    } catch (e) {
      if (/NO_API_KEY|BAD_API_KEY/.test(e.message)) openKeyModal(true);
      else showToast(e.message.startsWith("QUOTA") ? "Gemini 配額用完，請稍後再試" : "掃描失敗：" + e.message);
    }
    setBusy(false);
  };
  const nearestSid = (ev) => {
    if (!(ev.lat && ev.lon)) return null;
    let best = null, bd = 1e9;
    day.spots.forEach((sp) => { if (MINOR_RE.test(sp.name) || isHotel(sp.name)) return; const d = parseFloat(getDistanceFromLatLonInKm(ev.lat, ev.lon, sp.lat, sp.lon)); if (d < bd) { bd = d; best = sp; } });
    return best ? { sid: best.sid || best.id, name: best.name, km: bd } : null;
  };
  const insert = (ev) => {
    const near = nearestSid(ev);
    const sid = "c" + Date.now();
    addCustomSpot(day.dayId, {
      sid, name: "⭐ " + (ev.venue || ev.title), lat: ev.lat || (near ? day.spots.find((x) => (x.sid || x.id) === near.sid).lat : day.spots[0].lat), lon: ev.lon || (near ? day.spots.find((x) => (x.sid || x.id) === near.sid).lon : day.spots[0].lon),
      desc: `${ev.title}｜${ev.date_time || ""}｜${ev.highlight || ""}｜來源：${ev.source || ""}`, defaultStay: "1 hr", afterSid: near ? near.sid : null, mapCode: "", ticket: { adult: 0, child: 0 }, custom: true, event: ev,
    });
    haptic(20);
    showToast(`已插進 Day ${di + 1}${near ? "・" + metroShort(near.name) + " 之後" : ""}`);
  };
  const toList = (ev) => {
    addShoppingItem(ev.title, "event", [ev.venue, ev.title].filter(Boolean).join(","), "📡", `${ev.date_time || ""} ${ev.highlight || ""}`.trim());
    haptic(20); showToast("已加進清單，到該站會提醒");
  };
  const card = { background: "#fff", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 6, border: `1px solid ${METRO.line}` };
  return (
    <Sheet title="📡 期間限定活動雷達" close={close}>
      <div style={{ fontSize: 12, color: METRO.sub, marginTop: -6 }}>用當天全部站點的座標當走廊，找 15 公里內或繞路 20 分內的特展、蚤之市、市集、快閃店。日本活動多在 1 月初才公布，建議 1/5 後再掃。</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
        {tripData.map((d, i) => (
          <button key={i} onClick={() => { haptic(); setDi(i); }}
            style={{ minHeight: 48, borderRadius: 12, border: di === i ? `3px solid ${METRO.colors[i]}` : `2px solid ${METRO.line}`, background: di === i ? METRO.tints[i] : "#fff", fontFamily: "inherit", fontWeight: 900, fontSize: 12, color: METRO.ink, padding: 0 }}>
            {d.date.replace(/\s*\(.*\)/, "")}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 900 }}>{day.date}・{day.title}{res ? <span style={{ fontSize: 11, color: METRO.sub, fontWeight: 700 }}>・掃描於 {new Date(res.at).getMonth() + 1}/{new Date(res.at).getDate()}</span> : null}</div>
      <PillBtn dark onClick={run} style={{ opacity: busy ? 0.6 : 1 }}>{busy ? "掃描中…（約 20–40 秒）" : res ? "🔄 重新掃描這一天" : "📡 掃描這一天的活動"}</PillBtn>
      {res && res.list.length === 0 && <div style={{ fontSize: 13, color: METRO.sub }}>這天沒找到已公開的活動{res.raw ? "：" + res.raw : ""}</div>}
      {res && res.list.map((ev, i) => {
        const near = nearestSid(ev);
        return (
          <div key={i} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ height: 20, padding: "0 7px", borderRadius: 10, background: METRO.tints[di], fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center" }}>{ev.type || "活動"}</span>
              <span style={{ fontSize: 14, fontWeight: 900, flex: 1 }}>{ev.title}</span>
            </div>
            <div style={{ fontSize: 12 }}>📍 {ev.venue}{near ? <span style={{ color: METRO.sub }}>・離 {metroShort(near.name)} {near.km.toFixed(1)} km</span> : null}</div>
            <div style={{ fontSize: 12, color: METRO.sub }}>🕘 {ev.date_time}</div>
            {ev.highlight && <div style={{ fontSize: 12, color: "#5A4300", background: "#FFF6E3", borderRadius: 8, padding: "6px 8px" }}>💡 {ev.highlight}</div>}
            {ev.source && <div style={{ fontSize: 11, color: METRO.sub }}>來源：{ev.source}</div>}
            <div style={{ display: "flex", gap: 6 }}>
              <PillBtn dark onClick={() => insert(ev)} style={{ minHeight: 44, fontSize: 12 }}>➕ 插進 Day {di + 1}</PillBtn>
              <PillBtn onClick={() => toList(ev)} style={{ minHeight: 44, fontSize: 12 }}>🛍️ 存入清單</PillBtn>
              <a href={mapsSearchHere(ev.venue || ev.title)} target="_blank" rel="noreferrer" onClick={() => haptic()} style={{ minHeight: 44, padding: "0 12px", borderRadius: 12, border: `2px solid ${METRO.line}`, display: "flex", alignItems: "center", fontSize: 12, fontWeight: 900, color: METRO.ink, textDecoration: "none" }}>地圖</a>
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: METRO.sub }}>插進去的站在環狀圖和直線圖以 ⭐ 顯示，預設停留 1 小時，可在站點頁改或移除。AI 結果請以官網為準。</div>
    </Sheet>
  );
};

// ⚙️ 設定：金鑰、匯率、旅伴、資料備份（不常動的底層設定）
const BACKUP_KEYS = ["stays", "departures", "modes", "expenses", "trip_spot_tickets", "ticket_overrides", "shopping_list", "start_times", "checklist_state", "metro_intel", "metro_stores", "metro_arrivals", "metro_checkout", "metro_fuel", "twd_jpy_rate", "travelers"];
const SettingsSheet = ({ close, openKeyModal, twdJpyRate, setTwdJpyRate, showToast }) => {
  const [trav, setTrav] = useState(() => localStorage.getItem("travelers") || window.TRAVELERS || "");
  const [rate, setRate] = useState(String(twdJpyRate || ""));
  const hasKey = !!localStorage.getItem("gemini_api_key");
  const saveTrav = (v) => { setTrav(v); try { localStorage.setItem("travelers", v); } catch (e) {} };
  const saveRate = () => {
    const r = parseFloat(rate);
    if (r > 1 && r < 20) { setTwdJpyRate(r); localStorage.setItem("twd_jpy_rate", String(r)); localStorage.setItem("twd_jpy_rate_date", new Date().toDateString()); showToast("匯率已更新"); }
    else showToast("請輸入 1 台幣兌多少日圓，例如 4.6");
  };
  const exportData = () => {
    const obj = {}; BACKUP_KEYS.forEach((k) => { const v = localStorage.getItem(k); if (v != null) obj[k] = v; });
    const blob = new Blob([JSON.stringify({ v: 1, at: new Date().toISOString(), data: obj })], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sanin-trip-backup-" + new Date().toISOString().slice(0, 10) + ".json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const importData = (file) => {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result); const d = o.data || o;
        let n = 0; Object.keys(d).forEach((k) => { if (BACKUP_KEYS.includes(k)) { localStorage.setItem(k, d[k]); n++; } });
        showToast(`已還原 ${n} 項，重新載入中…`); setTimeout(() => location.reload(), 800);
      } catch (e) { showToast("檔案格式不對"); }
    };
    rd.readAsText(file);
  };
  const resetTrip = () => {
    if (!window.confirm("清除所有行程紀錄（出發紀錄、停留時間、記帳、清單打勾、AI 查核）？金鑰會保留。")) return;
    BACKUP_KEYS.forEach((k) => localStorage.removeItem(k)); location.reload();
  };
  const row = { display: "flex", flexDirection: "column", gap: 6, padding: "10px 0", borderTop: `1px solid ${METRO.line}` };
  const input = { minHeight: 44, borderRadius: 12, border: `2px solid ${METRO.line}`, padding: "0 12px", fontSize: 14, fontFamily: "inherit", color: METRO.ink, background: "#fff", width: "100%", boxSizing: "border-box" };
  return (
    <Sheet title="設定" close={close}>
      <div style={{ fontSize: 12, color: METRO.sub, marginTop: -6 }}>不常改的底層設定。旅途工具在底部「更多」。</div>
      <div style={{ ...row, borderTop: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900 }}>🔑 Gemini API 金鑰 <span style={{ fontSize: 11, color: hasKey ? "#0B5E36" : "#8A1C12", fontWeight: 700 }}>{hasKey ? "已設定" : "未設定（AI 查核、找賣家、估票價都需要）"}</span></div>
        <PillBtn onClick={() => { close(); openKeyModal(true); }}>{hasKey ? "更換金鑰" : "設定金鑰"}</PillBtn>
      </div>
      <div style={row}>
        <div style={{ fontSize: 13, fontWeight: 900 }}>💱 匯率（1 台幣 ＝ ? 日圓）<span style={{ fontSize: 11, color: METRO.sub, fontWeight: 700 }}>記帳換算用，有金鑰時每天自動更新</span></div>
        <div style={{ display: "flex", gap: 6 }}>
          <input type="number" inputMode="decimal" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} style={{ ...input, fontFamily: MONO }} />
          <PillBtn dark onClick={saveRate} style={{ flex: 0, padding: "0 16px" }}>儲存</PillBtn>
        </div>
      </div>
      <div style={row}>
        <div style={{ fontSize: 13, fontWeight: 900 }}>👥 旅伴 <span style={{ fontSize: 11, color: METRO.sub, fontWeight: 700 }}>AI 查核會依此給建議</span></div>
        <input value={trav} onChange={(e) => saveTrav(e.target.value)} placeholder="例：2 大 2 小（9 歲、10 歲男生）" style={input} />
      </div>
      <div style={row}>
        <div style={{ fontSize: 13, fontWeight: 900 }}>💾 資料備份 <span style={{ fontSize: 11, color: METRO.sub, fontWeight: 700 }}>換手機或清快取前先匯出</span></div>
        <div style={{ display: "flex", gap: 6 }}>
          <PillBtn onClick={exportData}>匯出 JSON</PillBtn>
          <label style={{ flex: 1, minHeight: 48, borderRadius: 12, border: `2px solid ${METRO.ink}`, background: "#fff", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", color: METRO.ink }}>
            匯入還原<input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => e.target.files[0] && importData(e.target.files[0])} />
          </label>
        </div>
        <PillBtn onClick={resetTrip} style={{ borderColor: "#E2342F", color: "#E2342F" }}>重置行程紀錄</PillBtn>
      </div>
    </Sheet>
  );
};

// 🩹 順路補給：以「目前位置」在 Google 地圖搜尋（地圖自己定位，不需要本 App 的 GPS 權限）
const SOS_GROUPS = [
  { title: "🎮 小學生＆爸爸尋寶", items: [
    ["🧱", "玩具／樂高", "おもちゃ屋"], ["♻️", "二手店", "ホビーオフ"], ["🕵️", "駿河屋", "駿河屋"],
    ["✏️", "文具", "文房具店"], ["🎰", "扭蛋", "ガチャガチャ"], ["🛒", "唐吉訶德", "ドン・キホーテ"],
    ["🏬", "大型超市", "イオン"], ["🔧", "居家量販", "ホームセンター"],
  ] },
  { title: "🚗 自駕救急", items: [
    ["💊", "藥妝店", "ドラッグストア"], ["🏪", "超商・廁所", "コンビニ"], ["⛽", "加油站", "ガソリンスタンド"], ["🅿️", "停車場", "駐車場"],
  ] },
];
const mapsSearchHere = (q) => "https://www.google.com/maps/search/" + encodeURIComponent(q);
const Sheet = ({ title, close, children }) => (
  <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 80, display: "flex", alignItems: "flex-end" }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxHeight: "85dvh", overflowY: "auto", background: "#fff", borderRadius: "24px 24px 0 0", padding: "14px 16px calc(18px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 12, color: METRO.ink, fontFamily: "'Noto Sans TC', system-ui, sans-serif" }}>
      <div style={{ width: 40, height: 4, borderRadius: 2, background: METRO.past, alignSelf: "center" }} />
      <div style={{ fontSize: 17, fontWeight: 900 }}>{title}</div>
      {children}
    </div>
  </div>
);
const SosSheet = ({ close }) => (
  <Sheet title="周邊搜・順路找" close={close}>
    <div style={{ fontSize: 12, color: METRO.sub }}>用目前位置在 Google 地圖搜最近的店，開車時請讓副駕操作</div>
    {SOS_GROUPS.map((g) => (
      <div key={g.title} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 900 }}>{g.title}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {g.items.map(([ic, name, q]) => (
            <a key={q} href={mapsSearchHere(q)} target="_blank" rel="noreferrer" onClick={() => haptic()}
              style={{ minHeight: 52, borderRadius: 14, border: `2px solid ${METRO.line}`, background: "#fff", display: "flex", alignItems: "center", gap: 10, padding: "0 12px", textDecoration: "none", color: METRO.ink }}>
              <span style={{ fontSize: 22 }}>{ic}</span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}><span style={{ fontSize: 14, fontWeight: 900 }}>{name}</span><span style={{ fontSize: 11, color: METRO.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q}</span></span>
            </a>
          ))}
        </div>
      </div>
    ))}
    <div style={{ fontSize: 11, color: METRO.sub }}>日本緊急電話：警察 110・救護車／消防 119。租車故障請打 ORIX 078-261-0543（免付費 0120-29-1543）。</div>
  </Sheet>
);
const CHECKOUT_ITEMS = ["護照・錢包", "車鑰匙・ETC 卡", "充電線・行動電源", "小孩外套・手套", "冰箱裡的食物", "浴室・榻榻米上的東西", "停車場付費／取車"];
const HotelSheet = ({ dayIdx, close, tripData }) => {
  const hotels = window.HOTEL_INFO || [];
  const tonight = hotels[dayIdx] || null;
  const last = dayIdx > 0 ? hotels[dayIdx - 1] : null;
  const [checked, setChecked] = useState(() => { try { return JSON.parse(localStorage.getItem("metro_checkout") || "{}"); } catch (e) { return {}; } });
  const key = (i) => dayIdx + "-" + i;
  const toggle = (i) => setChecked((p) => { const n = { ...p, [key(i)]: !p[key(i)] }; try { localStorage.setItem("metro_checkout", JSON.stringify(n)); } catch (e) {} return n; });
  const HotelCard = ({ h, label, color }) => h ? (
    <div style={{ background: "#F7F4EE", borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ height: 22, padding: "0 8px", borderRadius: 11, background: color, color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center" }}>{label}</span>
        <span style={{ fontSize: 12, color: METRO.sub }}>{h.day}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 900 }}>{h.name}</div>
      <div style={{ fontSize: 12, color: METRO.sub, userSelect: "all" }}>{h.jpName}<br />{h.jpAddress}</div>
      {h.booking ? (
        <div style={{ fontSize: 12, lineHeight: "19px", background: "#fff", borderRadius: 10, padding: "6px 10px" }}>
          ✅ 已訂（{h.booking.via}）・{h.booking.room}<br />入住 {h.booking.checkIn} 起・退房 {h.booking.checkOut} 前{h.booking.price ? "・¥" + h.booking.price.toLocaleString() : ""}<br />{h.booking.pay}・{h.booking.cancelBy}
        </div>
      ) : (
        <div style={{ fontSize: 12, fontWeight: 900, color: "#8A1C12", background: "#FFD2CC", borderRadius: 10, padding: "6px 10px" }}>❗ 尚未訂房</div>
      )}
      {h.note && <div style={{ fontSize: 12, color: "#5A4300", background: "#FFF6E3", borderRadius: 10, padding: "6px 10px" }}>{h.note}</div>}
      <div style={{ display: "flex", gap: 6 }}>
        {h.tel && <PillBtn dark href={"tel:" + h.tel.replace(/-/g, "")}>📞 {h.tel}</PillBtn>}
        <PillBtn href={mapsDir(h.lat, h.lon)}>導航過去</PillBtn>
      </div>
    </div>
  ) : null;
  return (
    <Sheet title="飯店快捷" close={close}>
      <HotelCard h={tonight} label="今晚" color="#7B52AE" />
      <HotelCard h={last} label="昨晚（折返拿東西）" color="#5E584E" />
      {!tonight && !last && <div style={{ fontSize: 13 }}>今天沒有住宿（回程日）</div>}
      {last && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 4 }}>退房檢查</div>
          {CHECKOUT_ITEMS.map((t, i) => (
            <button key={i} onClick={() => { haptic(); toggle(i); }} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, border: 0, background: "transparent", padding: 0, fontFamily: "inherit", textAlign: "left", color: METRO.ink }}>
              <span style={{ width: 22, height: 22, boxSizing: "border-box", borderRadius: 6, border: `2px solid ${checked[key(i)] ? "#13804A" : "#C9C3B8"}`, background: checked[key(i)] ? "#13804A" : "#fff", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{checked[key(i)] ? "✓" : ""}</span>
              <span style={{ fontSize: 14, textDecoration: checked[key(i)] ? "line-through" : "none", color: checked[key(i)] ? "#8C8578" : METRO.ink }}>{t}</span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
};
// Day 6 還車倒數：進入最後一天且剩下 ≤3 站（或已過 12:00）時啟用
const returnMode = (st, tripData) => {
  if (st.phase !== "trip") return null;
  const last = tripData.length - 1;
  if (st.dayIdx !== last) return null;
  const spots = tripData[last].spots;
  const ret = spots.findIndex((s) => /還車/.test(s.name));
  if (ret < 0) return null;
  if (!(ret - st.spotIdx <= 3 || st.nowMin >= 12 * 60)) return null;
  const retTime = (window.CAR_RENTAL_INFO && window.CAR_RENTAL_INFO.returnTime) || "17:00";
  const left = timeToMinutes(retTime) - st.nowMin;
  return { retIdx: ret, retTime, left, spot: spots[ret] };
};
const RingHome = ({ tripData, st, now, go, gpsOn, gps, enableGps, openSettings, openSim, shoppingList, sim, delay, openKeyModal, twdJpyRate, setTwdJpyRate, showToast }) => {
  const [sheet, setSheet] = useState(null); // "sos" | "hotel"
  const rm = returnMode(st, tripData);
  const [fuelDone, setFuelDone] = useState(() => localStorage.getItem("metro_fuel") === "1");
  const { flat } = st;
  const N = flat.length;
  const P = ringGeom.P;
  const step = P / N;
  const sAt = (g) => step * (g + 0.5);
  const curG = st.globalIndex(st.dayIdx, st.spotIdx);
  const dayRanges = tripData.map((d, di) => {
    const a = st.globalIndex(di, 0), b = st.globalIndex(di, d.spots.length - 1);
    return { s0: step * a, s1: step * (b + 1) };
  });
  const today = tripData[st.dayIdx];
  const spots = today.spots;
  const cur = spots[st.spotIdx];
  const next = spots[st.spotIdx + 1];
  const curPt = ringGeom.at(sAt(curG) + (st.moving ? step / 2 : 0));
  const pct = (v, tot) => (v / tot) * 100 + "%";
  const lunchLeg = findLunchLeg(spots);
  const dinner = dinnerStops(spots, st.spotIdx);
  const shopCount = shoppingList.filter((x) => !x.bought).length;
  const matchHere = shoppingList.filter((x) => !x.bought && x.keywords?.some((k) => (cur?.name || "").toLowerCase().includes(k.toLowerCase())));
  const isPre = st.phase === "pre", isDone = st.phase === "done";
  const color = METRO.colors[st.dayIdx];
  const dateLabel = `${now.getMonth() + 1}/${now.getDate()} ${hhmm(now)}`;
  const doneCount = isPre ? 0 : st.spotIdx;

  // 標籤：住宿（轉乘站）＋起點
  const labels = [];
  tripData.forEach((d, di) => {
    const h = hotelIndex(d.spots);
    if (h >= 0) {
      const info = (window.HOTEL_INFO || [])[di];
      labels.push({ g: st.globalIndex(di, h), text: info ? info.location : metroShort(d.spots[h].name), hotel: true });
    }
  });
  labels.push({ g: 0, text: "神戶機場", start: true });

  const segColor = (di) => {
    if (isDone) return METRO.colors[di];
    if (isPre) return METRO.colors[di];
    if (di < st.dayIdx) return METRO.past;
    return METRO.colors[di];
  };

  const ringLabelEl = (lb, i) => {
    const p = ringGeom.at(sAt(lb.g));
    const ox = p.x + p.nx * 14, oy = p.y + p.ny * 14;
    const anchor = Math.abs(p.nx) > 0.5 ? (p.nx < 0 ? "end" : "start") : "middle";
    const dy = Math.abs(p.ny) > 0.5 ? (p.ny > 0 ? 12 : -4) : 4;
    return (
      <text key={"lb" + i} x={ox} y={oy + dy} textAnchor={anchor} fontSize="11" fontWeight="700" fill={METRO.ink}
        style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3, strokeLinejoin: "round" }}>
        {lb.text}
      </text>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100dvh - 88px)", paddingBottom: 8 }}>
      {/* 頂部列 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "calc(10px + env(safe-area-inset-top)) 16px 8px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>{window.APP_TITLE || "旅程"}</div>
          <div style={{ fontSize: 12, color: METRO.sub }}>
            {isPre ? `今天 ${now.getMonth() + 1}/${now.getDate()}・還有 ${st.days} 天出發`
              : isDone ? "旅程完成・全線 6 條到站"
              : `${dateLabel}・Day ${st.dayIdx + 1} / ${tripData.length}・全程第 ${curG + 1} / ${N} 站`}
          </div>
        </div>
        <button aria-label="重新定位" onClick={enableGps}
          style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${gpsOn ? "#1767B3" : METRO.ink}`, background: gpsOn ? "#EAF2FB" : "#fff", color: gpsOn ? "#1767B3" : METRO.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" fill="currentColor" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3" /></svg>
        </button>
        <button aria-label="設定" onClick={() => { haptic(); setSheet("settings"); }}
          style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${METRO.line}`, background: "#fff", color: METRO.sub, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </div>

      {/* 路線圖 */}
      <div style={{ margin: "0 16px", background: "#fff", borderRadius: 24, border: `1px solid ${METRO.line}`, padding: "10px 0 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px" }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>旅程路線圖</div>
          <div style={{ fontSize: 11, color: METRO.sub }}>逆時針一圈・點路線看當日站點</div>
        </div>
        <div style={{ position: "relative", aspectRatio: `${RING.W} / ${RING.H}`, width: `min(100%, calc((100dvh - ${isPre || isDone ? 340 : 430}px) * ${RING.W} / ${RING.H}))`, minWidth: `calc(300px * ${RING.W} / ${RING.H})`, margin: "0 auto" }}>
          <svg viewBox={`0 0 ${RING.W} ${RING.H}`} preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            {/* 各日路線 */}
            {dayRanges.map((r, di) => (
              <path key={"seg" + di} d={ringGeom.d} fill="none" stroke={segColor(di)} strokeWidth={di === st.dayIdx && !isPre && !isDone ? 10 : 8}
                strokeDasharray={`${r.s1 - r.s0 - 1.5} ${P}`} strokeDashoffset={-r.s0} />
            ))}
            {/* 今天已走過的部分 */}
            {st.phase === "trip" && (
              <path d={ringGeom.d} fill="none" stroke={METRO.tints[st.dayIdx]} strokeWidth={10}
                strokeDasharray={`${Math.max(0, sAt(curG) - dayRanges[st.dayIdx].s0)} ${P}`} strokeDashoffset={-dayRanges[st.dayIdx].s0} />
            )}
            {/* 方向箭頭 */}
            {dayRanges.map((r, di) => {
              const p = ringGeom.at((r.s0 + r.s1) / 2 + step * 0.5);
              const ang = (Math.atan2(p.ty, p.tx) * 180) / Math.PI;
              return (
                <path key={"ar" + di} d="M-3 -4 L2 0 L-3 4" transform={`translate(${p.x} ${p.y}) rotate(${ang})`}
                  fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              );
            })}
            {/* 站點 */}
            {flat.map((f, g) => {
              if (g === curG) return null;
              const p = ringGeom.at(sAt(g));
              const minor = MINOR_RE.test(f.s.name);
              const hotel = isHotel(f.s.name) || /萬翠樓/.test(f.s.name);
              const passed = !isPre && (isDone || g < curG);
              if (hotel)
                return <rect key={g} x={p.x - 8} y={p.y - 8} width="16" height="16" rx="8" fill="#fff" stroke={passed ? "#8C8578" : METRO.ink} strokeWidth="3" />;
              if (g === 0)
                return (
                  <g key={g} transform={`translate(${p.x} ${p.y})`}>
                    <circle r="11" fill={METRO.ink} stroke="#fff" strokeWidth="3" />
                    <path d="M-6 3 L6 -1 L-6 -5 L-3.5 -1 Z" fill="#fff" transform="translate(0 1)" />
                  </g>
                );
              if (f.s.custom)
                return <text key={g} x={p.x} y={p.y + 5} textAnchor="middle" fontSize="14" style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}>⭐</text>;
              return minor ? (
                <circle key={g} cx={p.x} cy={p.y} r="1.8" fill="#fff" />
              ) : (
                <circle key={g} cx={p.x} cy={p.y} r={passed ? 3.5 : 4.5} fill={passed ? "#fff" : "#fff"} stroke={passed ? "rgba(0,0,0,.18)" : segColor(f.di)} strokeWidth={passed ? 0 : 2.5} />
              );
            })}
            {labels.map(ringLabelEl)}
            {/* 我在這 */}
            <circle cx={curPt.x} cy={curPt.y} r="18" fill={METRO.here} opacity=".3" className="metro-pulse" style={{ transformOrigin: `${curPt.x}px ${curPt.y}px` }} />
            <circle cx={curPt.x} cy={curPt.y} r="9" fill="#fff" stroke={METRO.here} strokeWidth="5"
              strokeDasharray={st.source === "time" ? "4 3" : "none"} />
          </svg>

          {/* 路線編號：點了進該日直線圖 */}
          {dayRanges.map((r, di) => {
            const p = ringGeom.at((r.s0 + r.s1) / 2);
            const bx = p.x - p.nx * 26, by = p.y - p.ny * 26;
            return (
              <button key={"b" + di} aria-label={`${tripData[di].title} 站點圖`} onClick={() => { haptic(); go({ level: "day", day: di }); }}
                style={{ position: "absolute", left: pct(bx, RING.W), top: pct(by, RING.H), transform: "translate(-50%,-50%)", width: 48, height: 48, border: 0, background: "transparent", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ opacity: !isPre && !isDone && di < st.dayIdx ? 0.55 : 1, display: "flex" }}>
                  <MetroBadge i={di} size={30} ring={di === st.dayIdx && st.phase === "trip"} />
                </span>
              </button>
            );
          })}

          {/* 我在這 泡泡 → 站點提醒 */}
          {(() => {
            const bx = curPt.x - curPt.nx * 0 + curPt.nx * 30, by = curPt.y + curPt.ny * 30;
            return (
              <button onClick={() => { haptic(); go({ level: "station", day: st.dayIdx, spot: st.spotIdx }); }}
                style={{ position: "absolute", left: pct(bx, RING.W), top: pct(by, RING.H), transform: "translate(-50%,-50%)", minHeight: 36, maxWidth: 170, padding: "0 12px", borderRadius: 18, border: 0, background: METRO.here, color: "#fff", fontSize: 12, fontWeight: 900, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, boxShadow: "0 2px 8px rgba(0,0,0,.25)", whiteSpace: "nowrap", zIndex: 2 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isPre ? "起點・" : isDone ? "終點・" : st.source === "time" ? "推估・" : st.moving ? "移動中・" : "我在這・"}{metroShort(cur?.name)}
                </span>
                <Chevron color="#fff" size={10} />
              </button>
            );
          })()}

          {/* 環內：今天 */}
          <button onClick={() => { haptic(); go({ level: "day", day: st.dayIdx }); }}
            style={{ position: "absolute", left: "31.5%", top: "30%", width: "37%", height: "42%", borderRadius: 18, background: "rgba(255,255,255,.96)", border: `2px solid ${METRO.tints[st.dayIdx]}`, zIndex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 5, textAlign: "left", fontFamily: "inherit", color: METRO.ink }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <span style={{ height: 22, padding: "0 7px", borderRadius: 11, background: color, color: METRO.onColor[st.dayIdx], fontFamily: MONO, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center" }}>
                DAY {st.dayIdx + 1}/{tripData.length}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#3D3830" }}>{today.date.replace(/\s*\(.*\)/, "")}</span>
            </span>
            {isPre ? (
              <>
                <span style={{ display: "flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" }}>
                  <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, lineHeight: "34px" }}>{st.days}</span>
                  <span style={{ fontSize: 12, fontWeight: 900 }}>天後發車</span>
                </span>
                <span style={{ fontSize: 11, color: "#3D3830" }}>首日：{today.title}</span>
              </>
            ) : rm ? (
              <>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#8A1C12" }}>距 {rm.retTime} 還車</span>
                <span style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, lineHeight: "34px", color: rm.left < 60 ? "#E2342F" : METRO.ink }}>{rm.left >= 0 ? `${Math.floor(rm.left / 60)}:${String(rm.left % 60).padStart(2, "0")}` : "已過"}</span>
                  {rm.left >= 0 && <span style={{ fontSize: 12, fontWeight: 900 }}>小時</span>}
                </span>
                <span style={{ fontSize: 11, color: "#3D3830" }}>{fuelDone ? "⛽ 已加滿油" : "⛽ 還車前在三宮加滿油"}・第 {st.spotIdx + 1}/{spots.length} 站</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 19, fontWeight: 900, lineHeight: "24px" }}>{today.title}</span>
                <span style={{ height: 6, borderRadius: 3, background: METRO.tints[st.dayIdx] + "88", overflow: "hidden", display: "block" }}>
                  <span style={{ width: `${Math.round(((isDone ? spots.length : doneCount + 1) / spots.length) * 100)}%`, height: 6, borderRadius: 3, background: color, display: "block" }} />
                </span>
                <span style={{ fontSize: 11, color: "#3D3830" }}>第 {st.spotIdx + 1} / {spots.length} 站</span>
              </>
            )}
            <span style={{ marginTop: "auto", minHeight: 36, borderRadius: 10, background: color, color: METRO.onColor[st.dayIdx], fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              看{isPre ? "第一天" : "今天"} {spots.length} 站 <Chevron size={10} />
            </span>
          </button>
        </div>
      </div>

      {/* 飯店快捷 ＋ 還車加油 */}
      {!isPre && !isDone && (
        <div style={{ display: "flex", gap: 8, padding: "8px 16px 0" }}>
          <button onClick={() => { haptic(); setSheet("hotel"); }} style={{ flex: 1, minHeight: 40, borderRadius: 20, border: `2px solid ${METRO.line}`, background: "#fff", fontFamily: "inherit", fontSize: 12, fontWeight: 900, color: METRO.ink, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 10px", overflow: "hidden" }}>
            <span>🏨</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(window.HOTEL_INFO || [])[st.dayIdx] ? `今晚 ${(window.HOTEL_INFO || [])[st.dayIdx].location}${(window.HOTEL_INFO || [])[st.dayIdx].booking ? "" : "・❗未訂房"}` : "昨晚飯店・退房檢查"}</span>
          </button>
          {rm && (
            <>
              <a href={mapsSearchHere("ガソリンスタンド")} target="_blank" rel="noreferrer" onClick={() => haptic()} style={{ minHeight: 40, borderRadius: 20, border: "2px solid #E2342F", background: fuelDone ? "#fff" : "#FFD2CC", color: "#8A1C12", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", padding: "0 12px", textDecoration: "none" }}>⛽ 找加油站</a>
              <button onClick={() => { haptic(); const v = !fuelDone; setFuelDone(v); localStorage.setItem("metro_fuel", v ? "1" : "0"); }} style={{ minHeight: 40, borderRadius: 20, border: `2px solid ${fuelDone ? "#13804A" : METRO.line}`, background: fuelDone ? "#13804A" : "#fff", color: fuelDone ? "#fff" : METRO.ink, fontFamily: "inherit", fontSize: 12, fontWeight: 900, padding: "0 12px" }}>{fuelDone ? "✓ 收據" : "📸 收據"}</button>
            </>
          )}
        </div>
      )}

      {/* 現在 → 下一站 ＋ 周邊搜：左半看本站，右半直接導航下一站 */}
      <div style={{ display: "flex", gap: 8, margin: "8px 16px 0" }}>
      <div style={{ flex: 1, minWidth: 0, minHeight: 68, background: "#1C1B19", borderRadius: 18, color: "#fff", display: "flex", alignItems: "stretch", overflow: "hidden" }}>
        <button onClick={() => { haptic(); go({ level: "station", day: st.dayIdx, spot: st.spotIdx }); }}
          style={{ flex: 1, minWidth: 0, padding: "8px 12px", border: 0, background: "transparent", color: "#fff", fontFamily: "inherit", textAlign: "left", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <span style={{ fontSize: 11, color: "#FF8A80", fontWeight: 900 }}>
            {isPre ? "起點" : st.source === "hotel" ? "出發前・在飯店" : st.moving ? "移動中・剛離開" : st.source === "time" ? "推估位置" : st.source === "gps" ? "GPS・我在這" : "我在這"}
          </span>
          <span style={{ fontSize: 15, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{metroShort(cur?.name)}</span>
          <span style={{ fontSize: 10, color: "#C9C3B8" }}>點看本站提醒 ›</span>
        </button>
        {next ? (
          <a href={mapsDir(next.lat, next.lon)} target="_blank" rel="noreferrer" onClick={() => haptic()}
            style={{ flex: 1, minWidth: 0, padding: "8px 12px 8px 10px", borderLeft: "1px solid rgba(255,255,255,.15)", color: "#fff", textDecoration: "none", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span style={{ fontSize: 11, color: delay > 0 ? "#FFC24D" : "#C9C3B8" }}>下一站・{next.time}{delay > 0 ? `（晚 ${delay} 分）` : delay < 0 ? `（早 ${-delay} 分）` : ""}</span>
            <span style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{metroShort(next.name)}</span>
            <span style={{ fontSize: 10, color: "#FFC24D", fontWeight: 900 }}>📍 點我導航</span>
          </a>
        ) : (
          <div style={{ flex: 1, padding: "8px 12px", borderLeft: "1px solid rgba(255,255,255,.15)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span style={{ fontSize: 11, color: "#C9C3B8" }}>今日終點</span><span style={{ fontSize: 15, fontWeight: 700 }}>休息</span>
          </div>
        )}
      </div>
      <button aria-label="周邊搜" onClick={() => { haptic(); setSheet("sos"); }}
        style={{ width: 64, minHeight: 68, borderRadius: 18, border: 0, background: "#E2342F", color: "#fff", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, flexShrink: 0 }}>
        <span style={{ fontSize: 22, lineHeight: "24px" }}>🔍</span><span style={{ fontSize: 11, fontWeight: 900 }}>周邊搜</span>
      </button>
      </div>
      {sheet === "sos" && <SosSheet close={() => setSheet(null)} />}
      {sheet === "hotel" && <HotelSheet dayIdx={st.dayIdx} tripData={tripData} close={() => setSheet(null)} />}
      {sheet === "settings" && <SettingsSheet close={() => setSheet(null)} openKeyModal={openKeyModal} twdJpyRate={twdJpyRate} setTwdJpyRate={setTwdJpyRate} showToast={showToast} />}

      {/* 提醒膠囊（旅途中才有） */}
      {!isPre && !isDone && <div style={{ display: "flex", gap: 8, padding: "8px 16px 0" }}>
        {isPre || isDone ? null : (
          <>
            {lunchLeg >= st.spotIdx - 1 && lunchLeg >= 0 && st.nowMin < 16 * 60 && (
              <button onClick={() => { haptic(); go({ level: "station", day: st.dayIdx, spot: lunchLeg }); }} style={chipStyle("#FFF6E3", "#E89B00", "#5A4300")}>午餐順路</button>
            )}
            {matchHere.length > 0 && (
              <button onClick={() => { haptic(); go({ level: "station", day: st.dayIdx, spot: st.spotIdx }); }} style={chipStyle("#FFF1E8", "#D9822B", "#6B3A00")}>
                這站可買 {matchHere.length} 項
              </button>
            )}
            {dinner.h >= 0 && st.spotIdx <= dinner.h && (
              <button onClick={() => { haptic(); go({ level: "station", day: st.dayIdx, spot: dinner.list.length ? dinner.list[dinner.list.length - 1] : Math.max(0, dinner.h - 1) }); }} style={chipStyle("#F4EFFA", "#7B52AE", "#5B3A8A")}>
                晚餐採買
              </button>
            )}
          </>
        )}
      </div>}
    </div>
  );
};
const chipStyle = (bg, bd, fg) => ({
  flex: 1, minHeight: 48, borderRadius: 24, background: bg, border: `2px solid ${bd}`, color: fg, fontSize: 12,
  fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", padding: "0 6px",
});

// ---- ② 當日直線路線 ----
const DayLine = ({ tripData, st, dayIdx, go, back, openDetail, depart, winterRoutes, delay, edit }) => {
  const day = tripData[dayIdx];
  const spots = day.spots;
  const color = METRO.colors[dayIdx], tint = METRO.tints[dayIdx], on = METRO.onColor[dayIdx];
  const isToday = st.phase === "trip" && st.dayIdx === dayIdx;
  const isPastDay = st.phase === "done" || (st.phase === "trip" && dayIdx < st.dayIdx);
  const cur = isToday ? st.spotIdx : -1;
  const lunchLeg = findLunchLeg(spots);
  const dinner = dinnerStops(spots, 0);
  const wr = (winterRoutes || []).find((w) => w.dayId === day.dayId);
  const risk = wr ? { high: ["高風險", "#FFD2CC", "#8A1C12"], medium: ["中風險", "#FFE08A", "#5A4300"], low: ["低風險", "#CDEBD8", "#0B5E36"] }[wr.risk] : null;
  const prevHotel = dayIdx > 0 ? (window.HOTEL_INFO || [])[dayIdx - 1] : null;
  const curRef = useRef(null);
  useEffect(() => {
    if (curRef.current) curRef.current.scrollIntoView({ block: "center", behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
    else window.scrollTo(0, 0);
  }, [dayIdx]);

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ background: color, color: on, padding: "calc(12px + env(safe-area-inset-top)) 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button aria-label="返回路線圖" onClick={() => { haptic(); back(); }}
            style={{ width: 48, height: 48, borderRadius: 24, background: "rgba(255,255,255,.2)", color: on, border: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <span style={{ width: 36, height: 36, borderRadius: 18, background: "#fff", color: METRO.colors[dayIdx], fontFamily: MONO, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {String(dayIdx + 1).padStart(2, "0")}
          </span>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{day.title}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>{day.date}・Day {dayIdx + 1} / {tripData.length}{isToday ? "・今天" : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {isToday && <span style={hdrChip("#fff", color)}>已完成 {st.spotIdx} 站</span>}
          <label style={{ ...hdrChip("rgba(255,255,255,.2)", on), gap: 4, cursor: "pointer" }}>
            {spots.length} 站・出發
            <input type="time" value={(edit && edit.dayStartTimes[day.dayId]) || day.defaultStart} onChange={(e) => edit && e.target.value && edit.handleDayStartTimeChange(day.dayId, e.target.value)}
              style={{ background: "transparent", border: 0, color: on, fontFamily: MONO, fontSize: 12, fontWeight: 700, width: 78, padding: 0, colorScheme: "dark" }} />
            ✎
          </label>
          {risk && <span style={hdrChip(risk[1], risk[2])}>雪況 {risk[0]}</span>}
          {isToday && delay !== 0 && <span style={hdrChip(delay > 0 ? "#FFD2CC" : "#CDEBD8", delay > 0 ? "#8A1C12" : "#0B5E36")}>{delay > 0 ? `進度晚 ${delay} 分・後面已順延` : `進度早 ${-delay} 分`}</span>}
        </div>
        {isToday && (() => {
          const ret = spots.findIndex((x) => /還車/.test(x.name));
          if (ret >= 0 && ret > cur) {
            const eta = metroTimeline(spots)[ret].a;
            const deadline = timeToMinutes((window.CAR_RENTAL_INFO && window.CAR_RENTAL_INFO.returnTime) || "16:30");
            if (eta > deadline) return (
              <div style={{ background: "#FFD2CC", color: "#8A1C12", borderRadius: 12, padding: "8px 10px", fontSize: 12, fontWeight: 900 }}>
                ⚠️ 照目前進度 {minutesToTimeStr(eta)} 才到還車點，已超過 {minutesToTimeStr(deadline)}。請跳過一站或縮短停留，不然趕不上飛機。
              </div>
            );
            return null;
          }
          const h = hotelIndex(spots);
          if (h < 0 || h <= cur) return null;
          const eta = metroTimeline(spots)[h].a;
          if (eta < 21 * 60) return null;
          return (
            <div style={{ background: "rgba(0,0,0,.18)", borderRadius: 12, padding: "8px 10px", fontSize: 12, fontWeight: 700 }}>
              照目前進度 {minutesToTimeStr(eta)} 才到飯店，建議跳過一站或縮短停留（到「詳細卡片」改停留時間）
            </div>
          );
        })()}
        {/* 左右滑換日 */}
        <div style={{ display: "flex", gap: 8 }}>
          {dayIdx > 0 && (
            <button onClick={() => { haptic(); go({ level: "day", day: dayIdx - 1 }, true); }} style={hdrNav(on)}>‹ 前一天 {String(dayIdx).padStart(2, "0")}</button>
          )}
          {dayIdx < tripData.length - 1 && (
            <button onClick={() => { haptic(); go({ level: "day", day: dayIdx + 1 }, true); }} style={{ ...hdrNav(on), marginLeft: "auto" }}>後一天 {String(dayIdx + 2).padStart(2, "0")} ›</button>
          )}
        </div>
      </div>

      <div style={{ padding: "14px 16px 0" }}>
        {prevHotel && (
          <StopRow time="" lineTop={null} lineBottom={METRO.past} dot={<span style={capsule("#8C8578")} />}>
            <div style={{ fontSize: 14, color: "#6F695F" }}>{prevHotel.name}</div>
            <div style={{ fontSize: 11, color: "#6F695F" }}>起點・由 {String(dayIdx).padStart(2, "0")} 轉乘</div>
          </StopRow>
        )}
        {spots.map((s, i) => {
          const done = isPastDay || (isToday && i < cur);
          const here = i === cur;
          const minor = MINOR_RE.test(s.name);
          const hotel = isHotel(s.name) || /萬翠樓/.test(s.name);
          const lineC = done ? tint : color;
          const lineAfter = i < spots.length - 1 ? (isPastDay || (isToday && i < cur) ? tint : color) : null;
          const isNext = isToday && i === cur + 1;
          const isDinner = dinner.list.includes(i);
          const items = [];
          items.push(
            <StopRow key={s.id} refEl={here ? curRef : null} time={s.time} timeColor={here ? METRO.here : s.shifted && delay > 0 ? "#C2410C" : isNext ? color : done ? "#6F695F" : "#3D3830"}
              lineTop={i === 0 && !prevHotel ? null : lineC} lineBottom={lineAfter}
              dot={here ? <span style={{ width: 26, height: 26, boxSizing: "border-box", borderRadius: 13, background: "#fff", border: `7px solid ${METRO.here}` }} />
                : hotel ? <span style={capsule(METRO.ink)} />
                : s.custom ? <span style={{ fontSize: 16, lineHeight: "18px" }}>⭐</span>
                : minor ? <span style={{ width: 8, height: 8, borderRadius: 4, background: done ? tint : "#fff", border: done ? 0 : `2px solid ${color}` }} />
                : <span style={{ width: 18, height: 18, boxSizing: "border-box", borderRadius: 9, background: done ? tint : "#fff", border: done ? 0 : `4px solid ${color}` }} />}
              onClick={() => { haptic(); go({ level: "station", day: dayIdx, spot: i }); }}>
              {here ? (
                <div style={{ background: "#fff", border: `2px solid ${METRO.here}`, borderRadius: 16, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, flex: 1 }}>{s.name}</div>
                    <span style={{ height: 22, padding: "0 8px", borderRadius: 11, background: METRO.here, color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", flexShrink: 0 }}>
                      {st.source === "time" ? "推估" : "我在這"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#3D3830" }}>停留 {s.stay}・{s.actualDepTime ? `已於 ${s.actualDepTime} 出發` : delay > 0 ? `原定 ${minutesToTimeStr(timeToMinutes(s.time) + parseStayDuration(s.stay))} 出發・已超過，出發時按下方按鈕` : `預計 ${minutesToTimeStr(timeToMinutes(s.time) + parseStayDuration(s.stay))} 出發`}</div>
                  {s.desc && <div style={{ fontSize: 12, color: "#0B5E36", fontWeight: 700, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>觀光：{s.desc}</div>}
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                    {i < spots.length - 1 && (
                      <PillBtn dark onClick={() => depart(dayIdx, s)} style={{ background: color, borderColor: color, color: on, flex: 2 }}>
                        {s.actualDepTime ? "取消出發" : "出發往下一站"}
                      </PillBtn>
                    )}
                    <PillBtn onClick={() => go({ level: "station", day: dayIdx, spot: i })} style={{ color: METRO.here, borderColor: METRO.here }}>看提醒 ›</PillBtn>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2, paddingBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: minor ? 13 : 14, fontWeight: isNext || hotel ? 900 : 400, color: done ? "#6F695F" : METRO.ink }}>{s.name}</span>
                    {isNext && <span style={{ height: 20, padding: "0 7px", borderRadius: 10, border: `2px solid ${color}`, color: dayIdx === 3 ? "#8A5A00" : color, fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center" }}>下一站</span>}
                    {isDinner && <span style={{ height: 20, padding: "0 7px", borderRadius: 10, background: "#7B52AE", color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center" }}>晚餐採買</span>}
                    {done && <span style={{ fontSize: 11, color: "#6F695F" }}>✓</span>}
                  </div>
                  {s.nextStop && !hotel && <div style={{ fontSize: 11, color: "#6F695F" }}>停留 {s.stay}・往下站 {s.nextStop.driveTime.replace("m", " 分")}</div>}
                  {hotel && dayIdx < tripData.length - 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: "#3D3830" }}>明天轉乘</span>
                      <span style={{ height: 24, padding: "0 8px", borderRadius: 12, background: METRO.colors[dayIdx + 1], color: METRO.onColor[dayIdx + 1], fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontFamily: MONO }}>{String(dayIdx + 2).padStart(2, "0")}</span>{tripData[dayIdx + 1].title}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </StopRow>
          );
          if (i === lunchLeg) {
            items.push(
              <StopRow key={s.id + "-lunch"} time="午餐" timeColor="#8A5A00" lineTop={lineAfter} lineBottom={lineAfter} dot={null}
                onClick={() => { haptic(); go({ level: "station", day: dayIdx, spot: i }); }}>
                <div style={{ background: "#FFF6E3", border: "2px dashed #E89B00", borderRadius: 14, padding: "8px 12px", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#5A4300" }}>午餐順路（12–16 點移動）</div>
                  <div style={{ fontSize: 12, color: "#5A4300" }}>內用丼飯／外帶飯糰，點這裡看順路店家</div>
                </div>
              </StopRow>
            );
          }
          if (dinner.h >= 0 && !dinner.list.length && i === dinner.h - 1) {
            items.push(
              <StopRow key={s.id + "-dinner"} time="採買" timeColor="#5B3A8A" lineTop={lineAfter} lineBottom={lineAfter} dot={null}
                onClick={() => { haptic(); go({ level: "station", day: dayIdx, spot: i }); }}>
                <div style={{ background: "#F4EFFA", border: "2px dashed #7B52AE", borderRadius: 14, padding: "8px 12px", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#5B3A8A" }}>進飯店前採買折扣便當</div>
                  <div style={{ fontSize: 12, color: "#5B3A8A" }}>沿路找超市／便利商店</div>
                </div>
              </StopRow>
            );
          }
          return items;
        })}
        <div style={{ marginTop: 10, fontSize: 11, color: METRO.sub, lineHeight: "18px" }}>
          時間依「出發時間＋各站停留＋車程」推算；點標題的出發時間可改。按「出發往下一站」或 GPS 進入站點 300 m 內，我的位置就前進一站。各站停留、門票在站點頁可改。
        </div>
      </div>
    </div>
  );
};
const hdrChip = (bg, fg) => ({ height: 28, padding: "0 10px", borderRadius: 14, background: bg, color: fg, fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center" });
const hdrNav = (on) => ({ minHeight: 40, padding: "0 12px", borderRadius: 20, border: 0, background: "rgba(255,255,255,.2)", color: on, fontFamily: "inherit", fontSize: 12, fontWeight: 900 });
const capsule = (c) => ({ width: 26, height: 18, boxSizing: "border-box", borderRadius: 9, background: "#fff", border: `3px solid ${c}` });
const StopRow = ({ time, timeColor, lineTop, lineBottom, dot, children, onClick, refEl }) => (
  <div ref={refEl} onClick={onClick} style={{ display: "flex", gap: 10, minHeight: 52, cursor: onClick ? "pointer" : "default", WebkitTapHighlightColor: "transparent" }}>
    <div style={{ width: 44, paddingTop: 4, fontFamily: MONO, fontSize: 12, fontWeight: 700, color: timeColor || "#3D3830", textAlign: "right", flexShrink: 0 }}>{time}</div>
    <div style={{ width: 26, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
      <div style={{ width: 6, height: 6, background: lineTop || "transparent" }} />
      {dot}
      <div style={{ width: 6, flexGrow: 1, background: lineBottom || "transparent" }} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

// ---- ③ 站點提醒 ----
const StationPage = ({
  tripData, st, dayIdx, spotIdx, go, back, shoppingList, toggleBought, depart,
  openExpenseModal, openChainFinder, showToast, winterRoutes, sim, launchGemini: launchGeminiPrice, edit, openKeyModal, removeCustomSpot,
}) => {
  const isActiveDay = sim ? sim.dayIdx === dayIdx : st.phase === "trip" && st.dayIdx === dayIdx;
  const [ticketOpen, setTicketOpen] = useState(false);
  const [finderId, setFinderId] = useState(null);
  useEffect(() => { setTicketOpen(false); setFinderId(null); }, [dayIdx, spotIdx]);
  const copyMapCode = () => {
    haptic();
    try { navigator.clipboard.writeText(s.mapCode.replace(/\s/g, "")); showToast(`MapCode ${s.mapCode} 已複製，可貼到租車導航`); }
    catch (e) { showToast(`MapCode：${s.mapCode}`); }
  };
  const day = tripData[dayIdx];
  const spots = day.spots;
  const s = spots[spotIdx];
  const next = spots[spotIdx + 1];
  const color = METRO.colors[dayIdx], on = METRO.onColor[dayIdx];
  const isHere = st.phase === "trip" && st.dayIdx === dayIdx && st.spotIdx === spotIdx;
  const lunchLeg = findLunchLeg(spots);
  const showLunch = next && lunchLeg === spotIdx;
  const dinner = dinnerStops(spots, spotIdx);
  const hotelI = dinner.h;
  const hotel = hotelI >= 0 ? spots[hotelI] : null;
  const wr = (winterRoutes || []).find((w) => w.dayId === day.dayId);
  const matches = shoppingList.filter((x) => x.keywords?.some((k) => s.name.toLowerCase().includes(k.toLowerCase()) || (s.desc || "").toLowerCase().includes(k.toLowerCase())));
  const unbought = shoppingList.filter((x) => !x.bought);
  const lunch = next ? nearestBackup(s, next) : null;
  const depMin = s.actualDepTime ? timeToMinutes(s.actualDepTime) : timeToMinutes(s.time) + parseStayDuration(s.stay);
  useEffect(() => { window.scrollTo(0, 0); }, [dayIdx, spotIdx]);

  return (
    <div style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom))" }}>
      <div style={{ background: color, color: on, padding: "calc(12px + env(safe-area-inset-top)) 16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, flexWrap: "wrap" }}>
          <button onClick={() => { haptic(); go({ level: "ring" }, "root"); }} style={crumb(on)}>路線圖</button>
          <span style={{ opacity: 0.7 }}>›</span>
          <button onClick={() => { haptic(); go({ level: "day", day: dayIdx }, "replaceParent"); }} style={crumb(on)}>{String(dayIdx + 1).padStart(2, "0")} {day.title}</button>
          <span style={{ opacity: 0.7 }}>›</span>
          <span>本站</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isHere && <span style={{ height: 24, padding: "0 9px", borderRadius: 12, background: METRO.here, color: "#fff", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center" }}>{st.source === "time" ? "推估在這" : "我在這"}</span>}
          <span style={{ fontSize: 12, opacity: 0.85 }}>第 {spotIdx + 1} 站／共 {spots.length} 站・{day.date} {s.time} 到</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, lineHeight: "28px" }}>{s.name}</div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>停留 {s.stay}・{s.actualDepTime ? `已於 ${s.actualDepTime} 出發` : `建議 ${minutesToTimeStr(depMin)} 出發`}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={s.gmapLink} target="_blank" rel="noreferrer" style={hdrLink(on)}>地圖</a>
          {s.mapCode && <button onClick={copyMapCode} style={hdrLink(on)}>MapCode {s.mapCode} ⧉</button>}
          {spotIdx > 0 && <button onClick={() => { haptic(); go({ level: "station", day: dayIdx, spot: spotIdx - 1 }, true); }} style={{ ...hdrLink(on), marginLeft: "auto" }}>‹ 上站</button>}
          {next && <button onClick={() => { haptic(); go({ level: "station", day: dayIdx, spot: spotIdx + 1 }, true); }} style={{ ...hdrLink(on), marginLeft: spotIdx > 0 ? 0 : "auto" }}>下站 ›</button>}
        </div>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {edit && (() => {
          const stayOpts = ["0 min", "20 min", "30 min", "40 min", "1 hr", "1.5 hr", "2 hr", "3 hr"];
          const curStay = s.stay;
          const mode = edit.transportModes[s.id] || "car";
          const tk = getTicket(s, edit.ticketOverrides) || { adult: 0, child: 0 };
          const cnt = edit.getTicketCounts(s.id);
          const hotel = isHotel(s.name);
          const locked = !!(s.ticket && s.ticket.locked);
          const setPrice = (k, v) => edit.setTicketOverrides((p) => ({ ...p, [s.id]: { ...(p[s.id] || { adult: 0, child: 0 }), [k]: Math.max(0, parseInt(v) || 0), manual: true } }));
          const freeKind = !hotel && isFreeSpot(s.name);
          const showTicket = hotel || !freeKind || isManualTicket(edit.ticketOverrides[s.id]) || ticketOpen;
          const spent = (edit.expenses[s.id] || []).reduce((a, e) => a + (e.amount || 0), 0);
          const inputSt = { width: 84, minHeight: 40, borderRadius: 10, border: `2px solid ${METRO.line}`, fontFamily: MONO, fontSize: 15, fontWeight: 700, textAlign: "right", padding: "0 8px", color: METRO.ink, background: locked ? "#F7F4EE" : "#fff" };
          const stepBtn = { width: 40, height: 40, borderRadius: 10, border: `2px solid ${METRO.line}`, background: "#fff", fontFamily: "inherit", fontSize: 18, fontWeight: 900, color: METRO.ink };
          return (
            <SectionCard color="#5E584E" title="本站設定" right={spent ? `已記帳 ¥${spent.toLocaleString()}` : null}>
              <div style={{ fontSize: 12, color: METRO.sub }}>停留時間（改了後面各站時間會重算）</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(stayOpts.includes(curStay) ? stayOpts : [...stayOpts, curStay]).map((o) => (
                  <button key={o} onClick={() => { haptic(); edit.handleStayChangeNew(s.id, o); }}
                    style={{ minHeight: 40, padding: "0 12px", borderRadius: 20, border: `2px solid ${o === curStay ? color : METRO.line}`, background: o === curStay ? color : "#fff", color: o === curStay ? on : METRO.ink, fontFamily: MONO, fontSize: 13, fontWeight: 700 }}>
                    {o.replace(" min", "分").replace(" hr", "小時")}
                  </button>
                ))}
              </div>
              {next && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 12, color: METRO.sub, flex: 1 }}>往下一站的方式</div>
                  <button onClick={() => { haptic(); edit.handleTransportToggle(s.id); }}
                    style={{ minHeight: 40, padding: "0 14px", borderRadius: 20, border: `2px solid ${METRO.ink}`, background: mode === "car" ? METRO.ink : "#fff", color: mode === "car" ? "#fff" : METRO.ink, fontFamily: "inherit", fontSize: 13, fontWeight: 900 }}>
                    {mode === "car" ? "🚗 開車" : "🚶 步行"}・點擊切換
                  </button>
                </div>
              )}
              {!showTicket && (
                <button onClick={() => { haptic(); setTicketOpen(true); }} style={{ alignSelf: "flex-start", minHeight: 32, padding: "0 10px", borderRadius: 16, border: `1px dashed ${METRO.past}`, background: "transparent", color: METRO.sub, fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}>
                  商店／交通不收門票・➕ 有特展或入場費才加
                </button>
              )}
              {showTicket && <div style={{ borderTop: `1px solid ${METRO.line}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, color: METRO.sub }}>{hotel ? "房價（每晚）與房數" : "門票（日圓）與人數"}{locked ? "・已確認免費" : freeKind ? "・手動輸入的入場費" : ""}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, width: 36 }}>{hotel ? "房價" : "成人"}</span>
                  <input type="number" inputMode="numeric" value={tk.adult || ""} placeholder="0" disabled={locked} onChange={(e) => setPrice("adult", e.target.value)} style={inputSt} />
                  <span style={{ flex: 1 }} />
                  <button style={stepBtn} onClick={() => { haptic(); edit.updateSpotTicketCount(s.id, "adult", -1); }}>−</button>
                  <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, width: 44, textAlign: "center" }}>{cnt.adult} {hotel ? "房" : "人"}</span>
                  <button style={stepBtn} onClick={() => { haptic(); edit.updateSpotTicketCount(s.id, "adult", 1); }}>＋</button>
                </div>
                {!hotel && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, width: 36 }}>兒童</span>
                    <input type="number" inputMode="numeric" value={tk.child || ""} placeholder="0" disabled={locked} onChange={(e) => setPrice("child", e.target.value)} style={inputSt} />
                    <span style={{ flex: 1 }} />
                    <button style={stepBtn} onClick={() => { haptic(); edit.updateSpotTicketCount(s.id, "child", -1); }}>−</button>
                    <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, width: 44, textAlign: "center" }}>{cnt.child} 人</span>
                    <button style={stepBtn} onClick={() => { haptic(); edit.updateSpotTicketCount(s.id, "child", 1); }}>＋</button>
                  </div>
                )}
                <div style={{ fontSize: 12, color: METRO.sub }}>小計 ¥{(hotel ? tk.adult * cnt.adult : tk.adult * cnt.adult + tk.child * cnt.child).toLocaleString()}{freeKind ? "" : "・「更多 › AI 估算全部票價」可自動填"}</div>
              </div>}
            </SectionCard>
          );
        })()}
        {s.custom && (
          <div style={{ background: "#FFF6E3", border: "2px solid #E89B00", borderRadius: 14, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#5A4300", flex: 1 }}>⭐ 這是你臨時加的站（活動雷達／手動）</span>
            <PillBtn onClick={() => { if (window.confirm("移除這一站？")) { removeCustomSpot(day.dayId, s.sid); go({ level: "day", day: dayIdx }, "replaceParent"); } }} style={{ flex: 0, minHeight: 40, fontSize: 12, borderColor: "#E2342F", color: "#E2342F" }}>移除</PillBtn>
          </div>
        )}
        <SectionCard color="#13804A" title="觀光提醒">
          <div style={{ fontSize: 13, lineHeight: "21px", whiteSpace: "pre-wrap" }}>{s.desc ? s.desc.replace(/\s*｜\s*/g, "\n") : "這站沒有備註。"}</div>
        </SectionCard>
        <IntelCard s={s} day={day} arr={s.time} dep={minutesToTimeStr(depMin)} mode={(edit && edit.transportModes[s.id]) || "car"} openKeyModal={openKeyModal} showToast={showToast} />

        <SectionCard color="#E89B00" title="購物提醒" right={matches.length ? "這站可能買得到" : `清單還有 ${unbought.length} 項`}>
          {(matches.length ? [...matches].sort((a, b) => a.bought - b.bought) : unbought.slice(0, 4)).map((it) => (
            <React.Fragment key={it.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => { haptic(); toggleBought(it.id); }}
              style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, minHeight: 48, border: 0, background: "transparent", padding: 0, fontFamily: "inherit", textAlign: "left", color: METRO.ink }}>
              <span style={{ width: 24, height: 24, boxSizing: "border-box", borderRadius: 6, border: `2px solid ${it.bought ? "#13804A" : "#C9C3B8"}`, background: it.bought ? "#13804A" : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{it.bought ? "✓" : ""}</span>
              <span style={{ fontSize: 14, flex: 1, textDecoration: it.bought ? "line-through" : "none", color: it.bought ? "#8C8578" : METRO.ink }}>{it.icon} {it.name}</span>
              <span style={{ fontSize: 11, color: METRO.sub, maxWidth: 110, textAlign: "right" }}>{it.note}</span>
            </button>
            {!it.bought && (
              <button onClick={() => { haptic(); setFinderId(finderId === it.id ? null : it.id); }}
                style={{ minWidth: 64, minHeight: 40, borderRadius: 10, border: `2px solid ${finderId === it.id ? METRO.ink : METRO.line}`, background: finderId === it.id ? METRO.ink : "#fff", fontSize: 12, fontWeight: 900, color: finderId === it.id ? "#fff" : METRO.ink, fontFamily: "inherit", flexShrink: 0 }}>哪裡買</button>
            )}
            </div>
            {finderId === it.id && <StoreFinder key={"f" + it.id} s={s} it={it} openKeyModal={openKeyModal} showToast={showToast} close={() => setFinderId(null)} />}
            </React.Fragment>
          ))}
          {!matches.length && !unbought.length && <div style={{ fontSize: 13, color: METRO.sub }}>清單都買齊了</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <PillBtn dark onClick={() => { launchGeminiPrice(); showToast("比價指令已複製，到 Gemini 貼上後拍標價"); }}>📸 拍照比價・抓地雷</PillBtn>
          </div>
          <div style={{ fontSize: 11, color: METRO.sub }}>「哪裡買」會列出這項商品在日本買得到的通路類型，點了在 Google 地圖搜這站附近；也可用 AI 聯網找具體店家。打勾會存在手機，離線也記得。</div>
        </SectionCard>

        {next && (
          <SectionCard color={METRO.ink} title="下一站">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 20, height: 20, boxSizing: "border-box", borderRadius: 10, border: `5px solid ${color}`, flexShrink: 0 }} />
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{next.name}</div>
                <div style={{ fontSize: 12, color: "#3D3830" }}>車程約 {s.nextStop?.driveTime.replace("m", " 分")}・{s.nextStop?.distance}・預計 {next.time} 到</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <PillBtn dark href={mapsDir(next.lat, next.lon)}>導航到下一站</PillBtn>
            </div>
            {showLunch && (
              <div style={{ background: "#FFF6E3", border: "2px dashed #E89B00", borderRadius: 14, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#5A4300" }}>午餐順路（這段移動在 12:00–16:00）</div>
                {lunch.best && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ height: 22, padding: "0 8px", borderRadius: 11, background: "#E89B00", color: METRO.ink, fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", flexShrink: 0 }}>內用丼飯</span>
                    <span style={{ fontSize: 13, flex: 1 }}>{lunch.best.name}</span>
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  {lunch.best ? (
                    <PillBtn dark href={mapsDir(next.lat, next.lon, lunch.best)}>經すき家再到下一站</PillBtn>
                  ) : (
                    <PillBtn dark href={mapsSearchNear("牛丼", lunch.mid.lat, lunch.mid.lon)}>找沿路丼飯</PillBtn>
                  )}
                  <PillBtn href={mapsSearchNear("コンビニ", lunch.mid.lat, lunch.mid.lon)}>外帶飯糰（超商）</PillBtn>
                </div>
                <PillBtn onClick={() => openChainFinder(s, next)} style={{ borderStyle: "dashed" }}>更多連鎖店（吉野家・松屋…）</PillBtn>
              </div>
            )}
          </SectionCard>
        )}

        {hotel && spotIdx < hotelI && (
          <SectionCard color="#7B52AE" title="進飯店前採買" right={`今晚：${metroShort(hotel.name)}`}>
            {dinner.list.map((i) => (
              <button key={i} onClick={() => { haptic(); go({ level: "station", day: dayIdx, spot: i }, true); }}
                style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, border: 0, background: "transparent", padding: 0, fontFamily: "inherit", textAlign: "left", color: METRO.ink }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: "#7B52AE" }}>{spots[i].time}</span>
                <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{metroShort(spots[i].name)}</span>
                <span style={{ fontSize: 11, color: METRO.sub }}>熟食 18:30 後貼折扣</span>
              </button>
            ))}
            {!dinner.list.length && <div style={{ fontSize: 13 }}>今天行程沒排超市，可在最後一段順路找。</div>}
            <div style={{ display: "flex", gap: 6 }}>
              <PillBtn href={mapsSearchNear("スーパー", hotel.lat, hotel.lon)}>飯店附近超市</PillBtn>
              <PillBtn href={mapsSearchNear("コンビニ", hotel.lat, hotel.lon)}>飯店附近超商</PillBtn>
            </div>
          </SectionCard>
        )}

        {wr && (
          <div style={{ background: "#EAF2FB", borderRadius: 18, padding: "12px 14px", display: "flex", gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1767B3" strokeWidth="2.4" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1L19.1 4.9" /></svg>
            <div style={{ fontSize: 12, color: "#0F3F70", lineHeight: "18px" }}>
              <b>今天路況（{{ high: "高風險", medium: "中風險", low: "低風險" }[wr.risk]}）：</b>{wr.notes}
            </div>
          </div>
        )}
      </div>

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 45, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", background: `linear-gradient(rgba(247,244,238,0), ${METRO.bg} 30%)`, display: "flex", gap: 8 }}>
        {next ? (
          isActiveDay ? (
            <PillBtn dark onClick={() => { if (depart(dayIdx, s)) go({ level: "day", day: dayIdx }, "replaceParent"); }}
              style={{ flex: 3, minHeight: 56, borderRadius: 16, fontSize: 15, background: s.actualDepTime ? "#fff" : color, color: s.actualDepTime ? METRO.ink : on, borderColor: s.actualDepTime ? METRO.line : color }}>
              {s.actualDepTime ? `已於 ${s.actualDepTime} 出發・取消` : "出發往下一站"}
            </PillBtn>
          ) : (
            <PillBtn dark href={mapsDir(next.lat, next.lon)} style={{ flex: 3, minHeight: 56, borderRadius: 16, fontSize: 15 }}>導航到下一站</PillBtn>
          )
        ) : (
          <PillBtn dark onClick={() => go({ level: "day", day: dayIdx }, "replaceParent")} style={{ flex: 3, minHeight: 56, borderRadius: 16 }}>回今日路線</PillBtn>
        )}
        <PillBtn onClick={() => openExpenseModal(s)} style={{ minHeight: 56, borderRadius: 16, borderColor: METRO.line }}>記帳</PillBtn>
      </div>
    </div>
  );
};
const crumb = (on) => ({ minHeight: 32, padding: "0 10px", borderRadius: 16, border: 0, background: "rgba(255,255,255,.2)", color: on, fontFamily: "inherit", fontSize: 12, fontWeight: 700 });
const hdrLink = (on) => ({ minHeight: 36, padding: "0 12px", borderRadius: 18, border: 0, background: "rgba(255,255,255,.2)", color: on, fontFamily: "inherit", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", textDecoration: "none" });


function App() {
  const Icons = window.Icons;

  // --- States (UI Control) ---
  const [activeTab, setActiveTabRaw] = useState("metro");
  // --- 🚇 路線圖導覽堆疊（與瀏覽器歷史同步，Android 手勢返回可用） ---
  const [metroStack, setMetroStack] = useState([{ level: "ring" }]);
  const metroStackRef = useRef(metroStack);
  metroStackRef.current = metroStack;
  useEffect(() => {
    try { history.replaceState({ metroDepth: 1 }, ""); } catch (e) {}
    const onPop = (e) => {
      const depth = (e.state && e.state.metroDepth) || 1;
      setMetroStack((st) => st.slice(0, Math.max(1, Math.min(depth, st.length))));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const metroGo = (v, mode) => {
    const st = metroStackRef.current;
    if (mode === "root") {
      if (st.length > 1) history.go(-(st.length - 1));
      return;
    }
    if (mode === "replaceParent") {
      if (st.length >= 2) {
        setMetroStack((x) => { const y = x.slice(); y[y.length - 2] = v; return y; });
        history.back();
      } else {
        setMetroStack([st[0], v]);
        history.pushState({ metroDepth: 2 }, "");
      }
      return;
    }
    if (mode === true) {
      setMetroStack((x) => { const y = x.slice(); y[y.length - 1] = v; return y; });
      return;
    }
    const nx = [...st, v];
    setMetroStack(nx);
    history.pushState({ metroDepth: nx.length }, "");
  };
  const metroBack = () => {
    if (metroStackRef.current.length > 1) history.back();
  };
  const setActiveTab = (t) => {
    const st = metroStackRef.current;
    if (st.length > 1) history.go(-(st.length - 1));
    setActiveTabRaw(t);
    window.scrollTo(0, 0);
  };
  const metroView = metroStack[metroStack.length - 1];
  const [selectedDay, setSelectedDay] = useState("all");
  const [currentThemeIndex, setCurrentThemeIndex] = useState(() =>
    parseInt(localStorage.getItem("themeIndex") || "0", 10)
  );

  // --- States (Data) ---
  const [dayStartTimes, setDayStartTimes] = useState(() =>
    JSON.parse(localStorage.getItem("start_times") || "{}")
  );
  // 試玩模式的出發紀錄只放記憶體，不寫入真實行程
  const [simDeps, setSimDeps] = useState(null);
  const [actualDepartures, setActualDepartures] = useState(() =>
    JSON.parse(localStorage.getItem("departures") || "{}")
  );
  const [stays, setStays] = useState(() =>
    JSON.parse(localStorage.getItem("stays") || "{}")
  );
  const [transportModes, setTransportModes] = useState(() =>
    JSON.parse(localStorage.getItem("modes") || "{}")
  );
  const [expenses, setExpenses] = useState(() =>
    JSON.parse(localStorage.getItem("expenses") || "{}")
  );
  const [spotTicketCounts, setSpotTicketCounts] = useState(() => {
    const saved = localStorage.getItem("trip_spot_tickets");
    return saved ? JSON.parse(saved) : {};
  });
  // NEW: Ticket Overrides
  const [ticketOverrides, setTicketOverrides] = useState(() =>
    JSON.parse(localStorage.getItem("ticket_overrides") || "{}")
  );

  // --- Shopping List ---
  const [shoppingList, setShoppingList] = useState(() => {
    const saved = localStorage.getItem("shopping_list");
    return saved ? JSON.parse(saved) : (window.SHOPPING_LIST || []);
  });
  const [showShoppingPanel, setShowShoppingPanel] = useState(false);
  const [shoppingAlert, setShoppingAlert] = useState(null);
  const [nearbyResults, setNearbyResults] = useState(null);
  const [scanningNearby, setScanningNearby] = useState(false);

  // --- Chain Store Finder ---
  const [showChainPanel, setShowChainPanel] = useState(false);
  const [chainMidpoint, setChainMidpoint] = useState(null);
  const chains = window.CHAIN_STORES || [];

  // v6：不再預計算繞路距離。點品牌 → 複製關鍵字 → 開 Maps 導航（目前位置→下一景點），
  //     使用者在 Maps 按「新增停靠站」貼上關鍵字，用 Google 即時沿路線搜尋自選分店。
  const openChainFinder = (spotA, spotB) => {
    const d1km = parseFloat(getDistanceFromLatLonInKm(spotA.lat, spotA.lon, spotB.lat, spotB.lon));
    // 估算通過時刻（實際出發時間優先，否則抵達＋停留）
    let passMinutes = null;
    if (spotA.actualDepTime) {
      passMinutes = timeToMinutes(spotA.actualDepTime);
    } else if (spotA.time) {
      passMinutes = timeToMinutes(spotA.time) + parseStayDuration(spotA.stay || "40 min");
    }
    setChainMidpoint({ fromName: spotA.name, toName: spotB.name, toLat: spotB.lat, toLon: spotB.lon, d1km, passMinutes });
    setCopiedChain(null);
    setShowChainPanel(true);
  };

  // 起點省略 = Google Maps 自動用目前位置
  const chainNavUrl = (mp) =>
    "https://www.google.com/maps/dir/?api=1&destination=" + mp.toLat + "," + mp.toLon + "&travelmode=driving";

  const [copiedChain, setCopiedChain] = useState(null);
  const launchChain = (c, mp) => {
    const kw = c.query || c.name;
    try {
      navigator.clipboard.writeText(kw);
    } catch (e) {}
    setCopiedChain(c.name);
    setTimeout(() => window.open(chainNavUrl(mp), "_blank"), 350);
  };

  useEffect(() => {
    localStorage.setItem("shopping_list", JSON.stringify(shoppingList));
  }, [shoppingList]);

  // 購物清單同步：勾選狀態可變 → 用 updatedAt「後寫贏」(last-write-wins)
  const pushShopItem = (item) => {
    enqueueSync({ type: "shop", itemId: item.id, item });
    flushSyncQueue();
  };

  const toggleBought = (id) => {
    setShoppingList(prev => prev.map(item => {
      if (item.id !== id) return item;
      const next = { ...item, bought: !item.bought, updatedAt: Date.now() };
      pushShopItem(next);
      return next;
    }));
  };

  const addShoppingItem = (name, category, keywords, icon, note) => {
    const newItem = {
      id: "s" + Date.now(),
      name, category,
      keywords: keywords.split(",").map(k => k.trim()),
      icon: icon || "🛒",
      note: note || "",
      bought: false,
      updatedAt: Date.now(),
    };
    setShoppingList(prev => [...prev, newItem]);
    pushShopItem(newItem);
  };

  const removeShoppingItem = (id) => {
    setShoppingList(prev => {
      const target = prev.find((i) => i.id === id);
      if (target) pushShopItem({ ...target, deleted: true, updatedAt: Date.now() });
      return prev.filter(item => item.id !== id);
    });
  };

  // Match shopping items to a spot name
  const getMatchingItems = (spotName) => {
    if (!spotName || !shoppingList) return [];
    const name = spotName.toLowerCase();
    return shoppingList.filter(item =>
      !item.bought && item.keywords?.some(kw => name.toLowerCase().includes(kw.toLowerCase()))
    );
  };

  // AI Nearby Shopping Scanner
  const scanNearbyShops = async (lat, lon, spotName) => {
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) { alert("請先設定 Gemini API Key"); return; }

    const unbought = shoppingList.filter(i => !i.bought);
    if (unbought.length === 0) { alert("購物清單已全部買完！"); return; }

    const mapsFallback = "https://www.google.com/maps/search/" + encodeURIComponent(unbought[0].keywords?.[0] || unbought[0].name) + "/@" + lat + "," + lon + ",14z";
    if (!navigator.onLine) {
      setShowShoppingPanel(true);
      setNearbyResults({ stores: [], notes: [], raw: "目前沒有網路，AI 搜尋暫停。可先用 Google 地圖（有離線地圖時也能搜）。", fallbackUrl: mapsFallback });
      return;
    }
    setScanningNearby(true);
    setNearbyResults(null);

    const itemList = unbought.map(i => i.icon + " " + i.name + "（找：" + i.keywords?.slice(0,3).join("/") + "）").join("\n");

    const prompt = "我目前的 GPS 座標是 " + lat + "," + lon + "（" + spotName + "）。\n" +
      "請先依座標判斷我所在的城市/區域（不要假設國家），再用 Google Search 搜尋我步行範圍（約 1 公里內）可能買到清單物品的實體商店。\n\n" +
      "我的購物清單（還沒買的）：\n" + itemList + "\n\n" +
      "⚠️ 回覆格式要求（嚴格遵守）：\n" +
      "每間商店一行，格式：\n" +
      "STORE|商店名稱|完整地址|緯度,經度|可買物品（用逗號分隔）\n" +
      "緯度經度請從搜尋結果取得；若真的查不到，該欄填 ?\n" +
      "❌ 不要自行估計或輸出距離——距離會由我方程式用座標計算。\n" +
      "最多列 6 間，只列你有把握真實存在的商店，不確定的不要列。\n\n" +
      "範例：\nSTORE|ブックオフ鳥取安長店|鳥取県鳥取市安長1-2-3|35.5128,134.2053|滑雪盆,雪球夾\n" +
      "STORE|HARD OFF 倉敷中庄店|岡山県倉敷市中庄1-1|?|倉敷帆布包\n\n" +
      "最後如果有找不到的物品，加一行：\nNOTE|找不到的說明\n\n" +
      "只輸出 STORE| 和 NOTE| 開頭的行，不要其他文字。";

    try {
      const ctrl = new AbortController();
      const killer = setTimeout(() => ctrl.abort(), 25000); // 訊號差時 25 秒放棄，改給地圖備案
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey, {
        signal: ctrl.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
      });
      clearTimeout(killer);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Parse structured response
      const lines = text.split("\n").filter(l => l.trim());
      const stores = [];
      const notes = [];
      lines.forEach(line => {
        const sm = line.match(/STORE\|(.+?)\|(.+?)\|(.+?)\|(.+)/);
        if (sm) {
          const name = sm[1].trim();
          const addr = sm[2].trim();
          const cm = sm[3].match(/(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
          // 距離一律由 App 用座標自己算（haversine），不信任 AI 的數字
          let dist = null;
          if (cm) {
            const km = parseFloat(getDistanceFromLatLonInKm(lat, lon, parseFloat(cm[1]), parseFloat(cm[2])));
            if (isFinite(km)) dist = Math.round(km * 1000);
          }
          // 導航目的地優先用「店名+地址」（最不易導錯），沒地址才用座標/店名
          const dest = addr && addr !== "?" ? name + " " + addr : (cm ? cm[1] + "," + cm[2] : name);
          stores.push({ name, addr, dist, items: sm[4].split(",").map(s=>s.trim()), navUrl: "https://www.google.com/maps/dir/?api=1&origin=" + lat + "," + lon + "&destination=" + encodeURIComponent(dest) + "&travelmode=walking" });
        }
        const nm = line.match(/NOTE\|(.+)/);
        if (nm) notes.push(nm[1]);
      });
      // 依實算距離排序（不明距離排最後）
      stores.sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

      if (stores.length > 0) {
        setNearbyResults({ stores, notes, raw: null });
      } else {
        // Fallback: show raw text + generic map search link
        setNearbyResults({ stores: [], notes: [], raw: text, fallbackUrl: "https://www.google.com/maps/search/藥妝+ドラッグストア/@" + lat + "," + lon + ",16z" });
      }
    } catch (e) {
      setNearbyResults({ stores: [], notes: [], raw: e.name === "AbortError" ? "網路太慢，AI 搜尋逾時。" : "搜尋失敗：" + e.message, fallbackUrl: mapsFallback });
    }
    setScanningNearby(false);
  };

  // 「附近買」= 用景點座標偵察（不需 GPS）
  const scanSpotNearby = (spotLat, spotLon, spotName) => {
    setShowShoppingPanel(true);
    scanNearbyShops(spotLat, spotLon, spotName);
  };

  // 「AI 購物雷達」= 用 GPS 即時定位掃描
  const triggerGPSRadar = () => {
    setShowShoppingPanel(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => scanNearbyShops(pos.coords.latitude, pos.coords.longitude, "📍 GPS 即時定位"),
        () => { alert("GPS 定位失敗，請確認已授權位置權限"); setScanningNearby(false); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      alert("此裝置不支援 GPS 定位");
    }
  };

  // --- States (AI & Feature) ---
  const [selectedCurrency, setSelectedCurrency] = useState(() => {
    const saved = localStorage.getItem("2026_currency") || window.DEFAULT_CURRENCY || "TWD";
    return (
      window.CURRENCY_OPTIONS.find((c) => c.code === saved) ||
      window.CURRENCY_OPTIONS[1]
    );
  });
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isRateLoading, setIsRateLoading] = useState(false);
  // TWD→JPY 換匯率（台幣消費入帳時轉日圓；每日自動更新一次，失敗用快取/預設）
  const [twdJpyRate, setTwdJpyRate] = useState(
    () => parseFloat(localStorage.getItem("twd_jpy_rate")) || 4.6
  );
  useEffect(() => {
    const today = new Date().toDateString();
    if (localStorage.getItem("twd_jpy_rate_date") === today) return;
    if (!localStorage.getItem("gemini_api_key")) return;
    (async () => {
      try {
        const res = await generateGeminiContent(
          "1 TWD to JPY exchange rate? number only",
          null,
          true
        );
        const m = res.match(/[\d.]+/g);
        const r = m ? parseFloat(m[m.length - 1]) : null;
        if (r && r > 1 && r < 20) {
          setTwdJpyRate(r);
          localStorage.setItem("twd_jpy_rate", String(r));
          localStorage.setItem("twd_jpy_rate_date", today);
        }
      } catch (e) {}
    })();
  }, []);

  const [aiLoading, setAiLoading] = useState(false);
  const [isAnalyzingReceipt, setIsAnalyzingReceipt] = useState(false);
  const [isTicketEstimating, setIsTicketEstimating] = useState(false); // New AI state
  const [pendingReceipts, setPendingReceipts] = useState([]);
  const [quotaStatus, setQuotaStatus] = useState({
    type: "normal",
    text: "AI Ready",
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditingSpot, setCurrentEditingSpot] = useState(null);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState(
    localStorage.getItem("user_email") || "yofarn@gmail.com"
  );
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isDailyDetailOpen, setIsDailyDetailOpen] = useState(false);
  const [selectedDailyStats, setSelectedDailyStats] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    category: "food",
    currency: "JPY",
    amount: "",
    note: "",
  });

  // --- Persistence Effects ---
  useEffect(() => {
    localStorage.setItem("start_times", JSON.stringify(dayStartTimes));
  }, [dayStartTimes]);
  useEffect(() => {
    localStorage.setItem("departures", JSON.stringify(actualDepartures));
  }, [actualDepartures]);
  // 出發前按到的「出發」都是測試，旅程開始前自動清掉，避免 1/25 當天時間錯亂
  useEffect(() => {
    const [Y, M, D] = METRO.tripStart;
    if (Date.now() < new Date(Y, M, D).getTime()) {
      if (Object.keys(actualDepartures).length) setActualDepartures({});
      try { localStorage.removeItem("metro_arrivals"); } catch (e) {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("stays", JSON.stringify(stays));
  }, [stays]);
  useEffect(() => {
    localStorage.setItem("modes", JSON.stringify(transportModes));
  }, [transportModes]);
  useEffect(() => {
    localStorage.setItem("expenses", JSON.stringify(expenses));
  }, [expenses]);
  useEffect(() => {
    localStorage.setItem("trip_spot_tickets", JSON.stringify(spotTicketCounts));
  }, [spotTicketCounts]);
  useEffect(() => {
    localStorage.setItem("ticket_overrides", JSON.stringify(ticketOverrides));
  }, [ticketOverrides]);
  useEffect(() => {
    localStorage.setItem("themeIndex", currentThemeIndex);
    if (window.THEMES && window.THEMES[currentThemeIndex])
      document.body.className = `theme-${window.THEMES[currentThemeIndex].name}`;
  }, [currentThemeIndex]);
  useEffect(() => {
    if (window.emailjs) window.emailjs.init("mYOFMMnqLdDxR0wjj");
  }, []);

  // --- 行程切換偵測：config 換了就提示清除舊資料 ---
  useEffect(() => {
    const currentTripId = window.TRIP_ID;
    if (!currentTripId) return;
    const savedTripId = localStorage.getItem("active_trip_id");
    if (savedTripId && savedTripId !== currentTripId) {
      const oldName = savedTripId;
      const newName = currentTripId;
      if (
        confirm(
          `偵測到行程已更換！\n\n舊行程：${oldName}\n新行程：${newName}\n\n是否清除舊行程的記帳與設定資料？\n（API Key 會保留）`
        )
      ) {
        const apiKey = localStorage.getItem("gemini_api_key");
        const email = localStorage.getItem("user_email");
        // 清除所有 trip-related localStorage
        const keysToKeep = ["gemini_api_key", "user_email", "active_trip_id"];
        Object.keys(localStorage).forEach((key) => {
          if (!keysToKeep.includes(key)) localStorage.removeItem(key);
        });
        if (apiKey) localStorage.setItem("gemini_api_key", apiKey);
        if (email) localStorage.setItem("user_email", email);
        localStorage.setItem("active_trip_id", currentTripId);
        window.location.reload();
        return;
      }
    }
    localStorage.setItem("active_trip_id", currentTripId);
  }, []);

  // --- Currency Fetch ---
  useEffect(() => {
    const fetchRate = async () => {
      // 基準幣別 = JPY（日本行程：消費/門票/住宿皆以日圓入帳）
      if (selectedCurrency.code === "JPY") {
        setExchangeRate(1);
        return;
      }
      setIsRateLoading(true);
      try {
        const res = await generateGeminiContent(
          `1 JPY to ${selectedCurrency.code} rate? number only`,
          null,
          true
        );
        const matches = res.match(/[\d.]+/g);
        const rate = matches ? parseFloat(matches[matches.length - 1]) : 1;
        setExchangeRate(rate);
      } catch (e) {
        setExchangeRate(1);
      }
      setIsRateLoading(false);
    };
    fetchRate();
  }, [selectedCurrency]);

  // --- 核心運算：行程瀑布流 ---
  // ⭐ 旅途中臨時加的站（活動雷達／手動插站），存手機；依 afterSid 插在指定站之後
  const [customSpots, setCustomSpots] = useState(() => { try { return JSON.parse(localStorage.getItem("metro_custom") || "{}"); } catch (e) { return {}; } });
  useEffect(() => { try { localStorage.setItem("metro_custom", JSON.stringify(customSpots)); } catch (e) {} }, [customSpots]);
  const addCustomSpot = (dayId, spot) => setCustomSpots((p) => ({ ...p, [dayId]: [...(p[dayId] || []), spot] }));
  const removeCustomSpot = (dayId, sid) => setCustomSpots((p) => ({ ...p, [dayId]: (p[dayId] || []).filter((x) => x.sid !== sid) }));
  const mergeCustom = (day) => {
    const list = customSpots[day.dayId] || [];
    if (!list.length) return day.spots;
    const out = day.spots.slice();
    list.forEach((c) => {
      let i = out.findIndex((x) => x.sid === c.afterSid);
      if (i < 0) { const h = out.findIndex((x) => isHotel(x.name)); i = h > 0 ? h - 1 : out.length - 1; }
      out.splice(i + 1, 0, { ...c, custom: true });
    });
    return out;
  };
  const tripData = useMemo(() => {
    return window.RAW_KML_DATA.map((rawDay, dayIdx) => {
      const day = { ...rawDay, spots: mergeCustom(rawDay) };
      // 出發時間優先序：使用者手動設定 > config 的 day.defaultStart >
      // 第一天自動採用去程班機抵達時間（FLIGHT_INFO.outbound.arr，未來行程通用）> 09:00
      const resolvedStart =
        day.defaultStart ||
        (dayIdx === 0 && window.FLIGHT_INFO?.outbound?.arr) ||
        "09:00";
      let currentMinutes = timeToMinutes(dayStartTimes[day.dayId] || resolvedStart);
      const newSpots = day.spots.map((spot, idx) => {
        const spotId = spot.sid || `${day.dayId}-s${idx}`;
        // 停車場類景點預設停留 0 分鐘（僅停車/取車，不佔行程時間）
        const isParkingSpot = /停車場|駐車場|[Pp]arking/.test(spot.name);
        const stayStr = stays[spotId] || spot.defaultStay || (isParkingSpot ? "0 min" : "40 min"); // 預設每站 40 分，config 可用 defaultStay 覆寫
        const stayMinutes = parseStayDuration(stayStr);
        const arrivalTimeStr = minutesToTimeStr(currentMinutes);
        let departureMinutes;
        let isDeparted = false;
        let actualDepTime = null;
        const depSrc = simDeps || actualDepartures;
        if (depSrc[spotId]) {
          actualDepTime = depSrc[spotId];
          departureMinutes = timeToMinutes(actualDepTime);
          isDeparted = true;
        } else {
          departureMinutes = currentMinutes + stayMinutes;
        }
        let nextStopInfo = null;
        let nextArrivalTimeStr = "";
        if (idx < day.spots.length - 1) {
          const nextSpot = day.spots[idx + 1];
          const dist = getDistanceFromLatLonInKm(
            spot.lat,
            spot.lon,
            nextSpot.lat,
            nextSpot.lon
          );
          // 「步行到 …」的站預設用步行（不加停車緩衝）
          const mode = transportModes[spotId] || (/^步行到/.test(nextSpot.name) ? "walk" : "car");
          // v5：優先用預計算真實車程（calculator v5 / Routes API 交通感知），無資料才退回直線估算
          const dtKey = `${spot.name}→${nextSpot.name}`;
          const dt = window.DRIVE_TIMES ? window.DRIVE_TIMES[dtKey] : null;
          const driveBuffer = window.DRIVE_BUFFER_MIN != null ? window.DRIVE_BUFFER_MIN : 5;
          const hasRealDrive = !!(dt && dt.min != null);
          const speed = mode === "car" ? 40 : 4;
          let travelMinutes;
          if (mode === "car" && hasRealDrive) {
            travelMinutes = dt.min + driveBuffer; // 真實車程＋停車緩衝
          } else {
            travelMinutes = Math.round((dist / speed) * 60);
            if (mode === "car") travelMinutes += 10;
          }
          currentMinutes = departureMinutes + travelMinutes;
          nextArrivalTimeStr = minutesToTimeStr(currentMinutes);
          nextStopInfo = {
            name: nextSpot.name,
            lat: nextSpot.lat,
            lon: nextSpot.lon,
            distance: hasRealDrive && dt.km != null ? `${dt.km} km` : `${dist} km`,
            isRealDrive: hasRealDrive,
            driveTime:
              (hasRealDrive ? dt.min + driveBuffer : Math.round((dist / 40) * 60 + 10)) + "m",
            walkTime: Math.round((dist / 4) * 60) + "m",
            navLink: `https://www.google.com/maps/dir/?api=1&origin=${
              spot.lat
            },${spot.lon}&destination=${nextSpot.lat},${
              nextSpot.lon
            }&travelmode=${mode === "car" ? "driving" : "walking"}`,
          };
        }
        return {
          ...spot,
          id: spotId,
          time: arrivalTimeStr,
          stay: stayStr,
          isDeparted,
          actualDepTime,
          nextStop: nextStopInfo,
          nextArrivalTime: nextArrivalTimeStr,
          mapcodeDisplay: spot.mapCode || "GPS",
          gmapLink: `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lon}`,
          weather: "sunny",
          temp: "10°C",
          ticket: spot.ticket || null,
        };
      });
      return { ...day, defaultStart: resolvedStart, spots: newSpots };
    });
  }, [dayStartTimes, actualDepartures, simDeps, stays, transportModes, customSpots]);

  // --- 統計數據計算 ---
  const dailyStats = useMemo(() => {
    return tripData.map((d) => {
      let dayTotal = 0;
      d.spots.forEach((spot) => {
        const spotExpenses = expenses[spot.id] || [];
        spotExpenses.forEach((e) => (dayTotal += e.amount || 0));
        const currentTicket = getTicket(spot, ticketOverrides);
        if (currentTicket && (currentTicket.adult > 0 || currentTicket.child > 0)) {
          const counts = spotTicketCounts[spot.id] || { adult: 2, child: 2 };
          if (isHotel(spot.name)) {
            dayTotal += currentTicket.adult * counts.adult; // 住宿：房價×房數
          } else {
            dayTotal += currentTicket.adult * counts.adult + currentTicket.child * counts.child;
          }
        }
      });
      return { ...d, totalTwd: dayTotal };
    });
  }, [tripData, expenses, spotTicketCounts, ticketOverrides]);
  const stats = {
    totalJpy: dailyStats.reduce((sum, d) => sum + d.totalTwd, 0),
  };

  // --- Handlers ---
  const handleDayStartTimeChange = (id, val) =>
    setDayStartTimes((p) => ({ ...p, [id]: val }));
  const handleStayChangeNew = (id, val) =>
    setStays((p) => ({ ...p, [id]: val }));
  const handleTransportToggle = (id) =>
    setTransportModes((p) => ({
      ...p,
      [id]: p[id] === "walk" ? "car" : "walk",
    }));
  const handleDepartureToggle = (id) =>
    setActualDepartures((p) => {
      const newState = { ...p };
      if (newState[id]) delete newState[id];
      else {
        const now = new Date();
        newState[id] = `${now.getHours().toString().padStart(2, "0")}:${now
          .getMinutes()
          .toString()
          .padStart(2, "0")}`;
      }
      return newState;
    });
  const getTicketCounts = (id) =>
    spotTicketCounts[id] || { adult: 2, child: 2 };
  const updateSpotTicketCount = (spotId, type, delta) => {
    setSpotTicketCounts((prev) => {
      const current = prev[spotId] || { adult: 2, child: 2 };
      const newValue = Math.max(0, current[type] + delta);
      return { ...prev, [spotId]: { ...current, [type]: newValue } };
    });
  };

  // Manual Ticket / Hotel Cost Edit Handler
  const handleManualTicketEdit = (spotId) => {
    const current = ticketOverrides[spotId] || { adult: 0, child: 0 };
    // 判斷是否為住宿
    const spotName = tripData.flatMap(d => d.spots).find(s => s.id === spotId)?.name || "";
    const isAccom = isHotel(spotName);
    
    if (isAccom) {
      const roomPrice = prompt("請輸入每晚房價 (¥):", current.adult);
      if (roomPrice === null) return;
      setTicketOverrides((prev) => ({
        ...prev,
        [spotId]: { adult: parseInt(roomPrice) || 0, child: 0 },
      }));
    } else {
      const adultPrice = prompt("請輸入成人票價 (¥):", current.adult);
      if (adultPrice === null) return;
      const childPrice = prompt("請輸入兒童票價 (¥):", current.child);
      if (childPrice === null) return;
      setTicketOverrides((prev) => ({
        ...prev,
        [spotId]: {
          adult: parseInt(adultPrice) || 0,
          child: parseInt(childPrice) || 0,
        },
      }));
    }
  };

  const openExpenseModal = (spot) => {
    setCurrentEditingSpot(spot);
    setExpenseForm({ category: "food", currency: "JPY", amount: "", note: "" });
    setPendingReceipts([]);
    setIsModalOpen(true);
  };
  // ═══ 消費記錄雲端同步（Firebase RTDB REST；多裝置全家帳）═══
  const SYNC_ROOT = window.FIREBASE_DB_URL
    ? window.FIREBASE_DB_URL + "/trips/" + (window.TRIP_ID || "trip")
    : null;
  const SYNC_BASE = SYNC_ROOT ? SYNC_ROOT + "/expenses" : null;
  const TOMB_BASE = SYNC_ROOT ? SYNC_ROOT + "/deleted" : null; // 刪除墓碑：一機刪、全家消
  const SHOP_BASE = SYNC_ROOT ? SYNC_ROOT + "/shopping" : null; // 購物清單（含勾選狀態）
  const [syncStatus, setSyncStatus] = useState({
    state: "idle",
    text: localStorage.getItem("sync_last") ? "上次同步 " + localStorage.getItem("sync_last") : "尚未同步",
  });
  const getSyncName = () => {
    let n = localStorage.getItem("sync_name");
    if (!n) {
      n = (window.prompt("第一次同步：輸入你的暱稱（會顯示在全家帳目上）", "") || "").trim() || "匿名";
      localStorage.setItem("sync_name", n);
    }
    return n;
  };
  const enqueueSync = (op) => {
    if (!SYNC_BASE) return;
    const q = JSON.parse(localStorage.getItem("sync_queue") || "[]");
    q.push(op);
    localStorage.setItem("sync_queue", JSON.stringify(q));
  };
  const flushSyncQueue = async () => {
    if (!SYNC_BASE) return 0;
    const q = JSON.parse(localStorage.getItem("sync_queue") || "[]");
    if (q.length === 0) return 0;
    const remain = [];
    for (const op of q) {
      try {
        if (op.type === "shop") {
          const r2 = await fetch(SHOP_BASE + "/" + op.itemId + ".json", {
            method: "PUT",
            body: JSON.stringify(op.item),
          });
          if (!r2.ok) throw new Error("HTTP " + r2.status);
          continue;
        }
        const res = await fetch(SYNC_BASE + "/" + op.spotId + "/r" + op.recId + ".json", {
          method: op.type === "del" ? "DELETE" : "PUT",
          body: op.type === "del" ? undefined : JSON.stringify(op.rec),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        // 刪除時同步寫入墓碑，讓其他裝置下次同步自動移除本機那筆
        if (op.type === "del") {
          const tomb = await fetch(TOMB_BASE + "/r" + op.recId + ".json", {
            method: "PUT",
            body: JSON.stringify({ t: Date.now() }),
          });
          if (!tomb.ok) throw new Error("HTTP " + tomb.status);
        }
      } catch (e) {
        remain.push(op);
      }
    }
    localStorage.setItem("sync_queue", JSON.stringify(remain));
    return remain.length;
  };
  const syncNow = async () => {
    if (!SYNC_BASE) return;
    setSyncStatus({ state: "syncing", text: "同步中..." });
    try {
      const pending = await flushSyncQueue();
      const remote = await fetch(SYNC_BASE + ".json").then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
      // 墓碑：任一裝置刪除的記錄 id 清單
      const tombs = (await fetch(TOMB_BASE + ".json").then((r) => (r.ok ? r.json() : null))) || {};
      const isDead = (id) => !!tombs["r" + id];
      let added = 0;
      let removed = 0;
      {
        const next = { ...expenses };
        // 1) 合併雲端新記錄（跳過已刪除的）
        if (remote) {
          Object.entries(remote).forEach(([spotId, recs]) => {
            const list = [...(next[spotId] || [])];
            const ids = new Set(list.map((r) => r.id));
            Object.values(recs || {}).forEach((r) => {
              if (r && r.id != null && !ids.has(r.id) && !isDead(r.id)) {
                list.push(r);
                ids.add(r.id);
                added++;
              }
            });
            next[spotId] = list;
          });
        }
        // 2) 依墓碑清除本機殘留（一機刪、全家消）
        Object.keys(next).forEach((spotId) => {
          const before = next[spotId].length;
          next[spotId] = next[spotId].filter((r) => !isDead(r.id));
          removed += before - next[spotId].length;
        });
        if (added > 0 || removed > 0) setExpenses(next);
      }
      // 3) 購物清單：以 updatedAt 後寫贏合併（勾選/新增/刪除都會同步）
      let shopChanged = 0;
      try {
        const rShop = (await fetch(SHOP_BASE + ".json").then((r) => (r.ok ? r.json() : null))) || {};
        const localMap = new Map(shoppingList.map((i) => [i.id, i]));
        Object.values(rShop).forEach((ri) => {
          if (!ri || !ri.id) return;
          const li = localMap.get(ri.id);
          if (!li) {
            if (!ri.deleted) { localMap.set(ri.id, ri); shopChanged++; }
            return;
          }
          if ((ri.updatedAt || 0) > (li.updatedAt || 0)) {
            if (ri.deleted) localMap.delete(ri.id);
            else localMap.set(ri.id, ri);
            shopChanged++;
          }
        });
        // 本機有、雲端沒有的（含預設清單）→ 補上傳
        shoppingList.forEach((li) => {
          if (!rShop[li.id]) enqueueSync({ type: "shop", itemId: li.id, item: { ...li, updatedAt: li.updatedAt || 1 } });
        });
        if (shopChanged > 0) setShoppingList(Array.from(localMap.values()));
        await flushSyncQueue();
      } catch (e) {}

      const now = new Date();
      const timeStr =
        now.getMonth() + 1 + "/" + now.getDate() + " " +
        String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
      localStorage.setItem("sync_last", timeStr);
      setSyncStatus({
        state: pending > 0 ? "warn" : "ok",
        text:
          (added > 0 || removed > 0
            ? (added > 0 ? "⬇ 新增 " + added + " 筆" : "") +
              (removed > 0 ? (added > 0 ? "、" : "") + "🗑 移除 " + removed + " 筆" : "") + "・"
            : "已是最新・") +
          timeStr +
          (shopChanged > 0 ? "・🛒 清單更新 " + shopChanged : "") +
          (pending > 0 ? "・" + pending + " 筆待上傳" : ""),
      });
    } catch (e) {
      setSyncStatus({ state: "err", text: "離線或同步失敗，記錄已排入佇列，連網後自動補傳" });
    }
  };
  useEffect(() => {
    if (!SYNC_BASE) return;
    syncNow();
    const onOnline = () => flushSyncQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const saveExpense = () => {
    const newRecs = [];
    const timestamp = Date.now();
    // 非日圓 → 以 twdJpyRate 轉為日圓入帳，保留原幣金額顯示
    const toJpyRec = (amt, cur) => {
      if (cur === "TWD") {
        return { amount: Math.round(amt * twdJpyRate), origAmount: amt, currency: "TWD" };
      }
      return { amount: amt, currency: "JPY" };
    };
    if (expenseForm.amount) {
      const conv = toJpyRec(parseInt(expenseForm.amount), expenseForm.currency || "JPY");
      newRecs.push({
        id: timestamp,
        timestamp: timestamp,
        note: expenseForm.note || "手動記帳",
        category: expenseForm.category || "food",
        ...conv,
      });
    }
    pendingReceipts.forEach((p, idx) => {
      if (p.isChecked && !p.isAnalyzing) {
        let recordTime = timestamp + idx + 1;
        if (p.note && p.note.match(/^\d{4}\/\d{2}\/\d{2}/)) {
          const aiDate = new Date(
            p.note.split(" ")[0] + " " + (p.note.split(" ")[1] || "12:00")
          );
          if (!isNaN(aiDate.getTime())) recordTime = aiDate.getTime();
        }
        const conv = toJpyRec(parseInt(p.amount), p.currency || "JPY");
        newRecs.push({
          id: timestamp + idx + 100,
          timestamp: recordTime,
          note: p.note,
          category: p.category || "other",
          ...(p.itemsFull && p.itemsFull.length ? { itemsFull: p.itemsFull } : {}),
          ...conv,
        });
      }
    });
    if (newRecs.length > 0) {
      // 疑似重複偵測：同景點已有「金額相同＋消費時間差1分鐘內」的記錄（含家人同步的）→ 確認後才入帳
      const existing = expenses[currentEditingSpot.id] || [];
      const dups = newRecs.filter((r) =>
        existing.some(
          (e) =>
            e.amount === r.amount &&
            Math.abs((e.timestamp || 0) - (r.timestamp || 0)) < 60000
        )
      );
      if (dups.length > 0) {
        const list = dups.map((d) => "・" + d.note + "（¥" + d.amount + "）").join("\n");
        if (
          !window.confirm(
            "⚠️ 疑似重複入帳（同金額＋同時間已存在，可能是同一張收據掃了兩次）：\n\n" +
              list +
              "\n\n仍要入帳嗎？"
          )
        )
          return;
      }
      // 記帳人暱稱（雲端同步時顯示在全家帳目）
      const finalRecs = SYNC_BASE
        ? newRecs.map((r) => ({ ...r, by: getSyncName() }))
        : newRecs;
      setExpenses((p) => ({
        ...p,
        [currentEditingSpot.id]: [
          ...(p[currentEditingSpot.id] || []),
          ...finalRecs,
        ],
      }));
      // 推送到雲端（離線時留在佇列，連網自動補傳）
      finalRecs.forEach((r) =>
        enqueueSync({ type: "put", spotId: currentEditingSpot.id, recId: r.id, rec: r })
      );
      flushSyncQueue().then((remain) => {
        if (remain === 0) {
          const now = new Date();
          const timeStr =
            now.getMonth() + 1 + "/" + now.getDate() + " " +
            String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
          localStorage.setItem("sync_last", timeStr);
          setSyncStatus({ state: "ok", text: "⬆ 已上傳・" + timeStr });
        } else if (remain > 0) {
          setSyncStatus({ state: "warn", text: remain + " 筆待上傳（離線佇列）" });
        }
      });
      setIsModalOpen(false);
    }
  };
  const deleteExpense = (sid, rid) => {
    setExpenses((p) => ({ ...p, [sid]: p[sid].filter((r) => r.id !== rid) }));
    // 同步刪除雲端記錄
    enqueueSync({ type: "del", spotId: sid, recId: rid });
    flushSyncQueue();
  };

  const handleOpenEmailClick = () => {
    setEmailInput(localStorage.getItem("user_email") || "");
    setIsEmailModalOpen(true);
  };
  const handleOpenDailyDetail = (dayData) => {
    setSelectedDailyStats(dayData);
    setIsDailyDetailOpen(true);
  };
  // --- 產生 Gmail 友善的詳細明細 HTML（全 inline style、table 排版）---
  const buildExpenseReportHtml = () => {
    const esc = (s) =>
      String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const yen = (n) => "&yen;" + (n || 0).toLocaleString();
    const tdL = 'style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;color:#444;text-align:left"';
    const tdR = 'style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;color:#444;text-align:right;font-family:Consolas,monospace;white-space:nowrap"';

    const catTotals = {};
    let grand = 0;
    let daysHtml = "";

    tripData.forEach((day) => {
      const rows = [];
      day.spots.forEach((spot) => {
        (expenses[spot.id] || []).forEach((r) => {
          const k = CATEGORY_META[r.category] ? r.category : "other";
          const noteWithOrig =
            r.note +
            (r.currency === "TWD" && r.origAmount != null
              ? "（NT$" + r.origAmount.toLocaleString() + "）"
              : "");
          const spotLabel = spot.name + (r.by ? "・" + r.by : "");
          rows.push({ cat: k, note: noteWithOrig, spot: spotLabel, ts: r.timestamp, amount: r.amount || 0 });
        });
        const t = getTicket(spot, ticketOverrides);
        if (t && (t.adult > 0 || t.child > 0)) {
          const c = spotTicketCounts[spot.id] || { adult: 2, child: 2 };
          if (isHotel(spot.name)) {
            const cost = t.adult * c.adult;
            if (cost > 0) rows.push({ cat: "lodging", note: "住宿 (" + c.adult + " 房)", spot: spot.name, ts: 0, amount: cost });
          } else {
            const cost = t.adult * c.adult + t.child * c.child;
            if (cost > 0) rows.push({ cat: "ticket", note: "門票 (大" + c.adult + " 小" + c.child + ")", spot: spot.name, ts: 0, amount: cost });
          }
        }
      });
      const dayTotal = rows.reduce((s, r) => s + r.amount, 0);
      grand += dayTotal;
      rows.forEach((r) => (catTotals[r.cat] = (catTotals[r.cat] || 0) + r.amount));
      if (rows.length === 0) return;
      rows.sort((a, b) => (a.ts || 0) - (b.ts || 0));

      let body = "";
      rows.forEach((r, i) => {
        const bg = i % 2 === 0 ? "#ffffff" : "#faf8f6";
        const timeStr = r.ts > 0 ? formatTime(r.ts) : "";
        body +=
          '<tr style="background:' + bg + '">' +
          "<td " + tdL + ">" + catMeta(r.cat).icon + " " + esc(catMeta(r.cat).label) + "</td>" +
          "<td " + tdL + ">" + esc(r.note) + '<br><span style="font-size:11px;color:#999">' + esc(r.spot) + (timeStr ? "・" + esc(timeStr) : "") + "</span></td>" +
          "<td " + tdR + ">" + yen(r.amount) + "</td>" +
          "</tr>";
      });
      daysHtml +=
        '<h3 style="margin:22px 0 6px;font-size:15px;color:#4a4a4a;border-left:4px solid #E4C2C1;padding-left:8px">' +
        esc(day.date + " " + day.title) + "</h3>" +
        '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #eee;border-radius:6px">' +
        '<tr style="background:#f3efec">' +
        '<th style="padding:6px 8px;font-size:12px;color:#888;text-align:left;width:70px">類別</th>' +
        '<th style="padding:6px 8px;font-size:12px;color:#888;text-align:left">項目 / 地點</th>' +
        '<th style="padding:6px 8px;font-size:12px;color:#888;text-align:right;width:90px">金額</th>' +
        "</tr>" + body +
        '<tr style="background:#f9f4f3"><td colspan="2" style="padding:7px 8px;font-size:13px;font-weight:bold;color:#4a4a4a">小計</td>' +
        '<td style="padding:7px 8px;font-size:14px;font-weight:bold;color:#c76b68;text-align:right;font-family:Consolas,monospace">' + yen(dayTotal) + "</td></tr>" +
        "</table>";
    });

    // 類別統計
    let catRows = "";
    Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => {
        catRows +=
          "<tr><td " + tdL + ">" + catMeta(k).icon + " " + esc(catMeta(k).label) + "</td>" +
          "<td " + tdR + ">" + yen(v) + "</td>" +
          "<td " + tdR + ">" + (grand > 0 ? Math.round((v / grand) * 100) : 0) + "%</td></tr>";
      });

    const converted = (grand * exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 0 });
    const now = new Date();
    const genTime = now.getFullYear() + "/" + (now.getMonth() + 1) + "/" + now.getDate() + " " +
      String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");

    return (
      '<div style="font-family:\'Microsoft JhengHei\',\'PingFang TC\',Arial,sans-serif;max-width:640px;margin:0 auto;padding:8px;color:#4a4a4a">' +
      '<h2 style="margin:0 0 4px;font-size:20px;color:#4a4a4a">🗾 ' + esc(window.APP_TITLE || "旅遊") + " 花費明細</h2>" +
      '<p style="margin:0 0 16px;font-size:12px;color:#999">製表時間 ' + genTime + "・幣別 JPY（日圓）</p>" +
      '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#faf7f5;border:1px solid #eee;border-radius:6px">' +
      '<tr><td style="padding:12px 14px"><div style="font-size:12px;color:#999">總花費</div>' +
      '<div style="font-size:26px;font-weight:bold;color:#c76b68;font-family:Consolas,monospace">' + yen(grand) + "</div>" +
      '<div style="font-size:12px;color:#999">約合 ' + esc(selectedCurrency.code) + " " + esc(selectedCurrency.symbol) + converted + "</div></td></tr></table>" +
      '<h3 style="margin:18px 0 6px;font-size:15px;color:#4a4a4a;border-left:4px solid #A9BFA8;padding-left:8px">類別統計</h3>' +
      '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #eee">' +
      '<tr style="background:#f0f3ef"><th style="padding:6px 8px;font-size:12px;color:#888;text-align:left">類別</th>' +
      '<th style="padding:6px 8px;font-size:12px;color:#888;text-align:right;width:100px">金額</th>' +
      '<th style="padding:6px 8px;font-size:12px;color:#888;text-align:right;width:60px">佔比</th></tr>' +
      catRows + "</table>" +
      daysHtml +
      '<p style="margin:20px 0 0;font-size:11px;color:#bbb">由 ' + esc(window.APP_TITLE || "") + " App 自動產生・門票/住宿為預估或 AI 查價，實際以收據為準</p>" +
      "</div>"
    );
  };

  const handleSendEmail = async () => {
    if (!emailInput) {
      alert("請輸入信箱");
      return;
    }
    setIsSendingEmail(true);
    localStorage.setItem("user_email", emailInput);
    try {
      const htmlMessage = buildExpenseReportHtml();
      await window.emailjs.send("service_5yh7x6g", "template_dlbyml8", {
        email: emailInput,
        to_email: emailInput,
        subject: (window.APP_TITLE || "旅遊") + " 花費明細 " + new Date().toLocaleDateString("zh-TW"),
        message: htmlMessage,
      });
      alert("發送成功！");
      setIsEmailModalOpen(false);
    } catch (e) {
      alert("發送失敗: " + e.message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsAnalyzingReceipt(true);
    setQuotaStatus({ type: "normal", text: "分析中..." });
    const newItems = files.map((f) => ({
      id: Math.random().toString(36),
      file: f,
      isAnalyzing: true,
      isChecked: true,
      amount: 0,
      note: "辨識中...",
    }));
    setPendingReceipts((p) => [...p, ...newItems]);

    const processFile = (item) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const res = await generateGeminiContent(
              `這是一張日本消費收據（レシート）的照片。請仔細擷取以下欄位：
1. amount：實付總額（優先找「合計」「お買上げ計」「クレジット支払」的稅込金額，純數字）
2. store：店家名稱（收據抬頭，保留日文即可）
3. date：交易日期時間，轉為西曆 "YYYY/MM/DD HH:mm"。注意令和年號換算：令和N年 = 2018+N 年（例：令和8年=2026）。找不到回傳 null
4. category：消費分類，從以下擇一：food(餐飲/超商食品)、shopping(購物/藥妝/玩具/雜貨)、transport(加油/過路費/交通票)、parking(停車費)、other(其他)
5. items：主要品項摘要，最多列 3 項、共 15 字內（例如「牛丼×2、味噌湯」），超過加「等」；看不清楚回傳 null
6. currency：幣別判斷。日本收據（円、税込、日文格式）回傳 "JPY"；台灣收據（NT$、新台幣、統一發票、台灣門市如超商/LOUISA/路易莎）回傳 "TWD"；其他國家回傳 ISO 代碼
7. itemsFull：完整逐項明細陣列 [{"name":"品名","price":淨價數字}, ...]，規則：
   - 「免税5%引き」「値引」「割引」等折扣行不是獨立品項，要併入前一項算成折後淨價
   - ¥0 的行（如付款方式、VISA免税優待、袋代0円）與「小計」「合計」「お預り」「お釣り」行都排除
   - 品名保留收據原文即可；同品項×N 就寫「品名×N」價格寫合計
   - 自我驗算：所有 price 加總應等於 amount，不一致時仍以「合計」為 amount
   - 收據品項超過 30 項或看不清楚時回傳 null
只回傳純 JSON：{amount, store, date, category, items, currency, itemsFull}`,
              reader.result
            );
            const jsonMatch = res.match(/\{[\s\S]*\}/);
            const json = JSON.parse(jsonMatch ? jsonMatch[0] : res);
            setPendingReceipts((prev) =>
              prev.map((p) => {
                if (p.id !== item.id) return p;
                const cur = json.currency || "JPY";
                const displayNote =
                  (json.date ? json.date + " " : "") +
                  (json.store || "未命名收據") +
                  (json.items ? "・" + json.items : "") +
                  (cur !== "JPY" ? "（" + cur + " " + json.amount + "）" : "");
                return {
                  ...p,
                  isAnalyzing: false,
                  amount: json.amount,
                  currency: cur,
                  note: displayNote,
                  itemsFull: Array.isArray(json.itemsFull) ? json.itemsFull : null,
                  category: json.category || "other",
                  timestamp: json.date
                    ? new Date(json.date).getTime()
                    : Date.now(),
                };
              })
            );
          } catch (e) {
            setPendingReceipts((prev) =>
              prev.map((p) =>
                p.id === item.id
                  ? { ...p, isAnalyzing: false, note: "辨識失敗" }
                  : p
              )
            );
          } finally {
            resolve();
          }
        };
        reader.readAsDataURL(item.file);
      });
    };
    await Promise.all(newItems.map(processFile));
    setIsAnalyzingReceipt(false);
    setQuotaStatus({ type: "normal", text: "完成" });
  };

  // --- Handle Auto Estimate ALL Costs (Tickets + Hotels) ---
  const handleEstimateTickets = async (silent = false) => {
    if (isTicketEstimating) return;
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
      if (!silent) setIsKeyModalOpen(true);
      return;
    }

    setIsTicketEstimating(true);

    const spotList = [];
    const hotelList = [];

    tripData.forEach((day) => {
      day.spots.forEach((spot) => {
        if (spot.ticket && spot.ticket.locked) return; // 確定價（免費/已查證）不估
        if (isFreeSpot(spot.name)) return; // 商店/停車場/餐廳：本來就沒門票，不送估價
        if (spot.ticket && Number(spot.ticket.adult) > 0) return; // config 已有查證票價，不覆寫
        if (isHotel(spot.name)) {
          hotelList.push({ id: spot.id, name: spot.name });
        } else {
          spotList.push({ id: spot.id, name: spot.name });
        }
      });
    });

    try {
      // 1. 估算景點門票
      if (spotList.length > 0) {
        const prompt = `請用 Google Search 查詢以下旅遊景點的【最新門票價格】。
如果該景點需要門票，請回傳成人票與兒童票(6-12歲)的價格。
幣值請根據景點所在國家（日本用 JPY、台灣用 TWD）。
只針對「封閉式收費景點」回傳：博物館、美術館、動物園、水族館、城郭天守閣、滑雪場、主題樂園、需付費入場的科學館。
以下一律視為免費、不要回傳：百貨商場（AEON、umie、ゆめタウン）、商店街與觀光街區本身（倉敷美觀地區、柯南小鎮街道）、二手店、文具店、戶外用品店、超市、便利商店、餐廳、車站、機場、停車場、開放式自然景觀（鳥取砂丘砂地本身）。
嚴禁把商場內的個別付費設施（摩天輪、遊樂區、特展）、餐飲或停車費當成該地點的門票。
請務必查詢最新資訊，不要猜測。

景點列表:
${JSON.stringify(spotList)}

請回傳純 JSON 格式 (不要 Markdown):
{
  "spot_id": { "adult": 200, "child": 100 },
  ...
}`;
        const result = await generateGeminiContent(prompt, null, true);
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const estimates = JSON.parse(jsonMatch[0]);
          const nameMap = {};
          spotList.forEach((s) => {
            nameMap[s.id] = s.name;
          });
          const safe = sanitizeEstimates(
            estimates,
            "spot",
            (k) => nameMap[k] || ""
          );
          setTicketOverrides((prev) => ({ ...prev, ...safe }));
        }
      }

      // 2. 估算住宿費用（含入住日期）
      if (hotelList.length > 0) {
        // 從行程資料中取得入住日期
        const hotelWithDates = [];
        tripData.forEach((day) => {
          day.spots.forEach((spot) => {
            if (isHotel(spot.name)) {
              hotelWithDates.push({ id: spot.id, name: spot.name, checkInDate: day.date });
            }
          });
        });

        const hotelPrompt = `請用 Google Search 查詢以下飯店在指定入住日的【實際每晚房價】。

請查詢各飯店官網或訂房平台（Booking.com、Agoda、Hotels.com、じゃらん、楽天トラベル）上的標準雙人房或家庭房價格。
幣值請根據飯店所在國家（日本用 JPY、台灣用 TWD）。
請盡量查詢接近入住日期的真實房價，而非平均價。

飯店列表（含入住日期）:
${JSON.stringify(hotelWithDates)}

回傳 adult 欄位填入每晚房價，child 填 0。
請回傳純 JSON 格式 (不要 Markdown):
{
  "spot_id": { "adult": 3500, "child": 0 },
  ...
}`;
        const hotelResult = await generateGeminiContent(hotelPrompt, null, true);
        const hotelMatch = hotelResult.match(/\{[\s\S]*\}/);
        if (hotelMatch) {
          const hotelEstimates = JSON.parse(hotelMatch[0]);
          const hotelNameMap = {};
          hotelWithDates.forEach((s) => {
            hotelNameMap[s.id] = s.name;
          });
          const safeHotels = sanitizeEstimates(
            hotelEstimates,
            "hotel",
            (k) => hotelNameMap[k] || ""
          );
          setTicketOverrides((prev) => ({ ...prev, ...safeHotels }));
        }
      }

      if (!silent) alert("費用估算完成！門票與住宿已自動更新。");
    } catch (e) {
      console.error(e);
      if (!silent) alert("估算失敗，請稍後再試。");
    } finally {
      setIsTicketEstimating(false);
    }
  };

  // --- 首次載入自動估價 ---
  useEffect(() => {
    const hasEstimates = Object.keys(ticketOverrides).length > 0;
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!hasEstimates && apiKey && tripData.length > 0) {
      const timer = setTimeout(() => handleEstimateTickets(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [tripData.length]);

  const handleOpenMap = () => {
    let points = [];
    if (selectedDay === "all") {
      tripData.forEach((day) => {
        day.spots.forEach((spot) => {
          if (spot.lat && spot.lon && spot.lat > 30) {
            points.push(`${spot.lat},${spot.lon}`);
          }
        });
      });
    } else {
      const currentDay = tripData.find((d) => d.dayId === selectedDay);
      if (currentDay) {
        points = currentDay.spots.filter((s) => s.lat && s.lon && s.lat > 30).map((s) => `${s.lat},${s.lon}`);
      }
    }

    if (points.length > 0) {
      // [Fixed] 標準 Google Maps Dir 連結
      const url = `https://www.google.com/maps/dir/?api=1&origin=${
        points[0]
      }&destination=${points[points.length - 1]}&waypoints=${points
        .slice(1, -1)
        .join("|")}&travelmode=driving`;
      window.open(url, "_blank");
    } else {
      alert("目前行程無有效的座標點");
    }
  };

  const [showMore, setShowMore] = useState(false);
  const [metroSimRequest, setMetroSimRequest] = useState(0);
  const [intelAllRequest, setIntelAllRequest] = useState(0);
  const [radarRequest, setRadarRequest] = useState(0);
  const launchGeminiPriceCheck = () => launchGemini(window.GEMINI_PRICE_PROMPT || GEMINI_PRICE_PROMPT_DEFAULT);
  const shoppingBody = (
    <>
            {/* 清單項目 */}
            <div className="space-y-2 mb-4">
              {shoppingList.map(item => (
                <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition ${item.bought ? "bg-gray-50 border-gray-100 opacity-50" : "bg-white border-gray-200"}`}>
                  <button onClick={() => toggleBought(item.id)} className="text-xl flex-shrink-0">
                    {item.bought ? "✅" : "⬜"}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm ${item.bought ? "line-through text-gray-400" : "text-gray-900"}`}>
                      {item.icon} {item.name}
                    </div>
                    {item.note && <div className="text-xs text-gray-400 truncate">{item.note}</div>}
                    <div className="text-xs text-blue-400 mt-0.5">{item.keywords?.join(" / ")}</div>
                  </div>
                  <button onClick={() => removeShoppingItem(item.id)} className="text-gray-300 hover:text-red-400 p-1 flex-shrink-0">
                    <Icons.X size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* 新增項目 */}
            <details className="mb-4">
              <summary className="text-sm font-bold text-indigo-600 cursor-pointer">+ 新增購物項目</summary>
              <div className="mt-2 space-y-2 bg-gray-50 p-3 rounded-xl">
                <input id="shop-name" placeholder="商品名稱" className="w-full p-2 rounded-lg border text-sm" />
                <input id="shop-keywords" placeholder="關鍵字（逗號分隔，如：BOOKOFF,Hard Off）" className="w-full p-2 rounded-lg border text-sm" />
                <input id="shop-note" placeholder="備註（選填）" className="w-full p-2 rounded-lg border text-sm" />
                <button onClick={() => {
                  const n = document.getElementById("shop-name").value;
                  const k = document.getElementById("shop-keywords").value;
                  const note = document.getElementById("shop-note").value;
                  if (n && k) {
                    addShoppingItem(n, "custom", k, "🛒", note);
                    document.getElementById("shop-name").value = "";
                    document.getElementById("shop-keywords").value = "";
                    document.getElementById("shop-note").value = "";
                  }
                }} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm">新增</button>
              </div>
            </details>

            {/* AI 附近掃描 */}
            <button
              onClick={() => triggerGPSRadar()}
              disabled={scanningNearby}
              className="w-full py-4 bg-amber-500 text-white rounded-xl font-black text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-50 mb-3"
            >
              {scanningNearby ? "🔍 AI 掃描中..." : "📡 AI 購物雷達（GPS 即時定位）"}
            </button>

            {/* AI 結果 */}
            {nearbyResults && (
              <div className="space-y-3">
                <div className="font-bold text-blue-700 text-sm">🤖 AI 搜尋結果</div>
                {nearbyResults.stores?.map((store, i) => {
                  const dLabel = store.dist == null ? "距離不明" : store.dist >= 1000 ? "約 " + (store.dist / 1000).toFixed(1) + " km" : "約 " + store.dist + " m";
                  const badgeCls = store.dist == null ? "bg-gray-100 text-gray-500" : store.dist <= 1000 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700";
                  return (
                  <div key={i} className="bg-white border-2 border-gray-200 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-gray-900">{store.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeCls}`}>🚶 {dLabel}</span>
                    </div>
                    {store.addr && store.addr !== "?" && (
                      <div className="text-[10px] text-gray-400 mb-2">{store.addr}</div>
                    )}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {store.items?.map((item, j) => (
                        <span key={j} className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full text-xs font-bold border border-amber-200">{item}</span>
                      ))}
                    </div>
                    <a href={store.navUrl} target="_blank" rel="noreferrer"
                      className="block w-full py-3 bg-gray-900 text-white text-center rounded-xl font-bold text-sm">
                      🚶 步行導航（{dLabel}）
                    </a>
                  </div>
                  );
                })}
                {nearbyResults.notes?.map((note, i) => (
                  <div key={i} className="text-xs text-gray-500 px-1">{note}</div>
                ))}
                {nearbyResults.raw && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {nearbyResults.raw}
                    {nearbyResults.fallbackUrl && (
                      <a href={nearbyResults.fallbackUrl} target="_blank" rel="noreferrer"
                        className="block mt-3 py-3 bg-gray-900 text-white text-center rounded-xl font-bold text-sm">
                        🔍 改用 Google 地圖搜附近
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
    </>
  );
  return (
    <div className={"min-h-screen bg-[#F9F7F5] " + (activeTab === "metro" ? (metroView.level === "station" ? "" : "pb-24 !bg-[#F7F4EE]") : "pb-24")}>
      {activeTab !== "metro" && (
        <nav className="sticky top-0 z-50 border-b" style={{ background: "#F7F4EE", borderColor: "#E6E0D5", paddingTop: "env(safe-area-inset-top)" }}>
          <div className="flex items-center gap-2 px-4" style={{ minHeight: 56 }}>
            <button onClick={() => setActiveTab("metro")} aria-label="回路線圖" className="w-11 h-11 rounded-full flex items-center justify-center" style={{ color: "#1F1D1A" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <div className="flex-1 font-black text-[17px]" style={{ color: "#1F1D1A" }}>{{ info: "資訊", list: "清單", stats: "統計", guard: "防雷", compare: "比價", wishlist: "願望" }[activeTab] || window.APP_TITLE}</div>
            <CurrencySwitcher
              selectedCurrency={selectedCurrency}
              exchangeRate={exchangeRate}
              isRateLoading={isRateLoading}
              setSelectedCurrency={setSelectedCurrency}
            />
            <button onClick={() => setShowMore(true)} aria-label="更多" className="w-11 h-11 rounded-full flex items-center justify-center border-2 bg-white" style={{ borderColor: "#E6E0D5", color: "#5E584E" }}>
              <Icons.Settings size={20} />
            </button>
          </div>
        </nav>
      )}
      {activeTab === "metro" && (
        <MetroTab
          tripData={tripData}
          view={metroView}
          go={metroGo}
          back={metroBack}
          shoppingList={shoppingList}
          toggleBought={toggleBought}
          handleDepartureToggle={handleDepartureToggle}
          simDeps={simDeps}
          setSimDeps={setSimDeps}
          openExpenseModal={openExpenseModal}
          openChainFinder={openChainFinder}
          scanSpotNearby={scanSpotNearby}
          openSettings={() => setShowMore(true)}
          openKeyModal={setIsKeyModalOpen}
          twdJpyRate={twdJpyRate}
          setTwdJpyRate={setTwdJpyRate}
          radarRequest={radarRequest}
          addCustomSpot={addCustomSpot}
          removeCustomSpot={removeCustomSpot}
          addShoppingItem={addShoppingItem}
          intelAllRequest={intelAllRequest}
          simRequest={metroSimRequest}
          launchGemini={launchGeminiPriceCheck}
          openDetail={null}
          edit={{
            stays, handleStayChangeNew, STAY_OPTIONS: window.STAY_OPTIONS,
            dayStartTimes, handleDayStartTimeChange,
            transportModes, handleTransportToggle,
            ticketOverrides, setTicketOverrides, getTicketCounts, updateSpotTicketCount,
            expenses, handleEstimateTickets, isTicketEstimating,
          }}
          winterRoutes={window.WINTER_ROUTES}
        />
      )}
      <main className={activeTab === "metro" ? "hidden" : "max-w-5xl mx-auto p-4 md:p-8"}>
        {activeTab === "info" && <InfoTab />}
        {activeTab === "stats" && (
          <StatsTab
            dailyStats={dailyStats}
            stats={stats}
            selectedCurrency={selectedCurrency}
            exchangeRate={exchangeRate}
            handleOpenDailyDetail={(d) => {
              setSelectedDailyStats(d);
              setIsDailyDetailOpen(true);
            }}
            handleOpenEmailClick={() => setIsEmailModalOpen(true)}
            syncStatus={syncStatus}
            onSyncNow={syncNow}
            syncEnabled={!!SYNC_BASE}
          />
        )}
        {activeTab === "guard" && (
          <GuardTab
            tripData={tripData}
            flightInfo={window.FLIGHT_INFO}
            hotelInfo={window.HOTEL_INFO}
            openKeyModal={setIsKeyModalOpen}
            aiLoading={aiLoading}
            setAiLoading={setAiLoading}
          />
        )}
        {activeTab === "compare" && (
          <CompareTab
            aiLoading={aiLoading}
            setAiLoading={setAiLoading}
            openKeyModal={setIsKeyModalOpen}
            twdJpyRate={twdJpyRate}
          />
        )}
        {activeTab === "list" && (
          <div className="space-y-6 pb-20">
            <button onClick={launchGeminiPriceCheck} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-[#1C1B19] text-white text-left shadow-lg active:scale-[.98] transition-transform">
              <span className="text-3xl">📸</span>
              <span className="flex-1"><span className="block font-black text-base">拍照比價・抓地雷（手機 Gemini）</span><span className="block text-xs text-white/70">按一下 → 開啟 Gemini → 貼上指令 → 拍標價。算台幣、比台灣行情、提醒缺件盜版</span></span>
            </button>
            <div className="glass-panel p-5 rounded-3xl bg-white border-gray-100 shadow-lg">
              <h2 className="text-xl font-black text-gray-900 mb-3">🛒 購物清單</h2>
              {shoppingBody}
            </div>
            <WishlistTab
              aiLoading={aiLoading}
              setAiLoading={setAiLoading}
              openKeyModal={setIsKeyModalOpen}
            />
          </div>
        )}
        {activeTab === "wishlist" && (
          <WishlistTab
            aiLoading={aiLoading}
            setAiLoading={setAiLoading}
            openKeyModal={setIsKeyModalOpen}
          />
        )}
      </main>
      {/* 連鎖店搜尋面板 */}
      {showChainPanel && chainMidpoint && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setShowChainPanel(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-lg font-black text-gray-900">🍚 沿途連鎖店</h2>
              <button onClick={() => setShowChainPanel(false)} className="p-2 text-gray-400"><Icons.X size={24} /></button>
            </div>
            <div className="text-xs text-gray-400 mb-1">{chainMidpoint.fromName} → {chainMidpoint.toName}</div>
            <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 text-center text-sm">
              📏 直達 <span className="font-black text-gray-900">{chainMidpoint.d1km} km</span>
              {chainMidpoint.d1min != null && (
                <span className="text-gray-500"> ・🚗 約 {chainMidpoint.d1min} 分</span>
              )}
              {chainMidpoint.passMinutes != null && (
                <span className="text-gray-400 text-xs"> ・預計 {minutesToTimeStr(chainMidpoint.passMinutes)} 出發</span>
              )}
            </div>

            <div className="text-[11px] text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 leading-relaxed">
              點品牌後會<b>自動複製關鍵字</b>並開啟 Google Maps 導航（目前位置 → {chainMidpoint.toName}）。
              在 Maps 按「<b>⋮ 新增停靠站</b>」→ 長按<b>貼上</b>關鍵字，即可沿路線即時搜尋、自選分店。
            </div>
            {copiedChain && (
              <div className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
                ✅ 已複製「{copiedChain}」，到 Maps 新增停靠站貼上即可
              </div>
            )}
            <div className="space-y-2">
              {[
                { cat: "丼飯", label: "🍚 丼飯連鎖", box: "bg-orange-50 border-orange-200 text-orange-800", head: "text-orange-600" },
                { cat: "超市", label: "🛒 超市", box: "bg-green-50 border-green-200 text-green-800", head: "text-green-600" },
                { cat: "挖寶", label: "🎁 挖寶（二手）", box: "bg-purple-50 border-purple-200 text-purple-800", head: "text-purple-600" },
                { cat: "文具", label: "✏️ 文具／生活雜貨", box: "bg-blue-50 border-blue-200 text-blue-800", head: "text-blue-600" },
                { cat: "家電", label: "🔌 家電量販", box: "bg-purple-50 border-purple-200 text-purple-800", head: "text-purple-600" },
              ].map((g) => {
                const items = chains.filter((c) => c.cat === g.cat);
                if (items.length === 0) return null;
                return (
                  <div key={g.cat}>
                    <div className={`text-xs font-bold mb-2 ${g.head}`}>{g.label}</div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {items.map((c, i) => (
                        <button key={i} onClick={() => launchChain(c, chainMidpoint)}
                          className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-bold text-left active:scale-95 transition ${g.box}`}>
                          <span className="text-lg">{c.icon}</span><span className="flex-1 min-w-0 truncate">{c.name}</span><span className="text-xs">🚗</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 購物清單浮動按鈕 */}
      {false && <button
        onClick={() => { if (!showShoppingPanel && SHOP_BASE) syncNow(); setShowShoppingPanel(!showShoppingPanel); }}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-amber-500 text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-90 transition-transform"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        🛒
        {shoppingList.filter(i => !i.bought).length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {shoppingList.filter(i => !i.bought).length}
          </span>
        )}
      </button>}

      {/* 購物清單面板 */}
      {showShoppingPanel && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => { setShowShoppingPanel(false); setNearbyResults(null); }}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black text-gray-900">🛒 購物清單</h2>
              <button onClick={() => { setShowShoppingPanel(false); setNearbyResults(null); }} className="p-2 text-gray-400"><Icons.X size={24} /></button>
            </div>

            {shoppingBody}
          </div>
        </div>
      )}

      {!(activeTab === "metro" && metroView.level === "station") && <div className="fixed bottom-0 w-full bg-white/95 backdrop-blur-md border-t-2 border-gray-200 z-40 flex justify-around pt-2 text-xs font-bold text-gray-500" style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}>
        <button
          onClick={() => setActiveTab("metro")}
          className={`flex flex-col items-center gap-1 p-2 min-w-[64px] ${
            activeTab === "metro" ? "text-[#13804A]" : "hover:text-gray-900"
          }`}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="4" r="1.6" fill="currentColor" /><circle cx="4" cy="12" r="1.6" fill="currentColor" /><circle cx="20" cy="14" r="2.4" fill="#E2342F" stroke="none" /></svg> 路線圖
        </button>
        <button
          onClick={() => setActiveTab("info")}
          className={`flex flex-col items-center gap-1 p-2 min-w-[64px] ${
            activeTab === "info" ? "text-[#13804A]" : "hover:text-gray-900"
          }`}
        >
          <Icons.LayoutGrid size={26} /> 資訊
        </button>
        <button
          onClick={() => { if (SHOP_BASE) syncNow(); setActiveTab("list"); }}
          className={`relative flex flex-col items-center gap-1 p-2 min-w-[64px] ${
            activeTab === "list" ? "text-[#13804A]" : "hover:text-gray-900"
          }`}
        >
          <span className="text-[22px] leading-[26px]">🛍️</span> 清單
          {shoppingList.filter(i => !i.bought).length > 0 && (
            <span className="absolute top-1 right-2 bg-[#E2342F] text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-black">
              {shoppingList.filter(i => !i.bought).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowMore(true)}
          className={`flex flex-col items-center gap-1 p-2 min-w-[64px] ${
            ["stats", "guard", "compare"].includes(activeTab) ? "text-[#13804A]" : "hover:text-gray-900"
          }`}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2.4" /><circle cx="12" cy="12" r="2.4" /><circle cx="19" cy="12" r="2.4" /></svg> 更多
        </button>
      </div>}
      {showMore && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-end" onClick={() => setShowMore(false)}>
          <div className="bg-white w-full rounded-t-3xl p-4" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }} onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded bg-gray-300 mx-auto mb-3" />
            <div className="text-xs text-gray-400 px-2 mb-2">不常用的功能都收在這裡</div>
            {[
              ["stats", "📊", "統計", "總花費・每日明細・寄帳單"],
              ["guard", "🛡️", "防雷", "雪況路況・航班飯店・緊急應變（各站卡片也會自動顯示當天路況）"],
              ["compare", "💱", "比價（網頁版）", "手動輸入品名比價；店內建議改用下面的拍照比價"],
            ].map(([t, ic, name, desc]) => (
              <button key={t} onClick={() => { setShowMore(false); setActiveTab(t); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 text-left min-h-[56px]">
                <span className="text-2xl w-9 text-center">{ic}</span>
                <span className="flex-1"><span className="block font-black text-gray-800">{name}</span><span className="block text-xs text-gray-400">{desc}</span></span>
              </button>
            ))}
            <button onClick={() => { setShowMore(false); launchGeminiPriceCheck(); }} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#EAF2FB] text-left min-h-[56px] mt-1">
              <span className="text-2xl w-9 text-center">📸</span>
              <span className="flex-1"><span className="block font-black text-[#0F3F70]">拍照比價（手機 Gemini）</span><span className="block text-xs text-[#0F3F70]/70">複製指令並開啟 Gemini，拍標價就能算台幣＋比行情＋抓地雷</span></span>
            </button>
            <div className="border-t border-gray-100 my-2" />
            <button onClick={() => { setShowMore(false); handleOpenMap(); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 text-left min-h-[56px]">
              <span className="text-2xl w-9 text-center">🗺️</span>
              <span className="flex-1"><span className="block font-black text-gray-800">全程地圖預覽</span><span className="block text-xs text-gray-400">在地圖上看所有站點</span></span>
            </button>
            <button onClick={() => { setShowMore(false); setActiveTab("metro"); setRadarRequest(Date.now()); }} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#FFF6E3] text-left min-h-[56px]">
              <span className="text-2xl w-9 text-center">📡</span>
              <span className="flex-1"><span className="block font-black text-[#5A4300]">掃描期間限定活動</span><span className="block text-xs text-[#5A4300]/70">特展・蚤之市・市集・快閃店，一鍵插進行程（1/5 後再掃）</span></span>
            </button>
            <button onClick={() => { setShowMore(false); setActiveTab("metro"); setIntelAllRequest(Date.now()); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 text-left min-h-[56px]">
              <span className="text-2xl w-9 text-center">✨</span>
              <span className="flex-1"><span className="block font-black text-gray-800">AI 查核今天所有站</span><span className="block text-xs text-gray-400">逐站查營業／公休／停車（出發前與行前一週各跑一次）</span></span>
            </button>
            <button onClick={() => { setShowMore(false); handleEstimateTickets(); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 text-left min-h-[56px]">
              <span className="text-2xl w-9 text-center">🎫</span>
              <span className="flex-1"><span className="block font-black text-gray-800">AI 估算全部票價</span><span className="block text-xs text-gray-400">用 Gemini 填入各站門票與房價（需金鑰）</span></span>
            </button>
            <button onClick={() => { setShowMore(false); setMetroSimRequest(Date.now()); setActiveTab("metro"); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 text-left min-h-[56px]">
              <span className="text-2xl w-9 text-center">🎮</span>
              <span className="flex-1"><span className="block font-black text-gray-800">試玩旅途中畫面</span><span className="block text-xs text-gray-400">出發前預覽「我在這」的樣子</span></span>
            </button>
            <div className="text-xs text-gray-400 px-2 pt-2">金鑰、匯率、旅伴、備份 → 路線圖右上角 ⚙️</div>
          </div>
        </div>
      )}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
      />
      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentEditingSpot={currentEditingSpot}
        expenseForm={expenseForm}
        twdJpyRate={twdJpyRate}
        setExpenseForm={setExpenseForm}
        handleImageUpload={handleImageUpload}
        pendingReceipts={pendingReceipts}
        saveExpense={saveExpense}
        expenses={expenses}
        deleteExpense={deleteExpense}
        quotaStatus={quotaStatus}
        togglePendingReceipt={(id) =>
          setPendingReceipts((p) =>
            p.map((x) => (x.id === id ? { ...x, isChecked: !x.isChecked } : x))
          )
        }
        removePendingReceipt={(id) =>
          setPendingReceipts((p) => p.filter((x) => x.id !== id))
        }
        isAnalyzingReceipt={isAnalyzingReceipt}
      />
      <EmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        emailInput={emailInput}
        setEmailInput={setEmailInput}
        handleSendEmail={handleSendEmail}
        isSendingEmail={isSendingEmail}
      />
      <DailyDetailModal
        isOpen={isDailyDetailOpen}
        onClose={() => setIsDailyDetailOpen(false)}
        dayData={selectedDailyStats}
        allExpenses={expenses}
        spotTicketCounts={spotTicketCounts}
        selectedCurrency={selectedCurrency}
        exchangeRate={exchangeRate}
        tripData={tripData}
        ticketOverrides={ticketOverrides}
        getTicketCounts={getTicketCounts}
      />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
