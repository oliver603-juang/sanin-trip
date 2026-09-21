/**
 * app.js - 2027 寒假山陰鳥取冬遊 (from kyushu-trip + 冬季雪況路況)
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

// ═══ Gemini Model Fallback Chain ═══
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];
let GEMINI_MODEL = localStorage.getItem("ft-gemini-model") || GEMINI_MODELS[0];

const generateGeminiContent = async (
  prompt,
  base64Image = null,
  useSearch = false
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

  let lastErr = null;
  for (let mi = 0; mi < GEMINI_MODELS.length; mi++) {
    const model = mi === 0 ? GEMINI_MODEL : GEMINI_MODELS[mi];
    if (mi > 0 && model === GEMINI_MODEL) continue;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
          return result.candidates?.[0]?.content?.parts?.[0]?.text || "無內容生成";
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
}) => {
  const Icons = window.Icons;
  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "desc",
  });

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
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800">
          <Icons.Wallet size={20} className="text-[#E4C2C1]" />{" "}
          {currentEditingSpot.name}
        </h3>

        <div className="flex-1 overflow-y-auto pr-1 no-scrollbar">
          <input
            type="text"
            value={expenseForm.note}
            onChange={(e) =>
              setExpenseForm({ ...expenseForm, note: e.target.value })
            }
            className="w-full bg-gray-50 p-3 rounded-xl mb-4 text-sm outline-none border border-gray-200 text-gray-800 focus:border-[#E4C2C1]"
            placeholder="備註"
          />
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
                  className="flex justify-between text-sm bg-gray-50 p-3 rounded-xl border border-gray-100"
                >
                  <div className="flex flex-col">
                    <span className="text-gray-700 font-medium">
                      {r.note || "消費"}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatTime(r.timestamp || r.id)}
                    </span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <span className="font-mono font-bold text-gray-800">
                      NT${r.amount}
                    </span>
                    <button
                      onClick={() => deleteExpense(currentEditingSpot.id, r.id)}
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

      // 門票邏輯：排除飯店，且有票價才顯示
      if (!isHotel(spot.name)) {
        const currentTicket = ticketOverrides[spot.id] || spot.ticket;
        // 有票價資訊才計算
        if (
          currentTicket &&
          (currentTicket.adult > 0 || currentTicket.child > 0)
        ) {
          // 使用傳入的 getTicketCounts 或 fallback
          const counts = getTicketCounts
            ? getTicketCounts(spot.id)
            : { adult: 2, child: 2 };
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
            });
        }
      }
    });
  });

  const totalTWD = dayExpensesList.reduce((sum, item) => sum + item.amount, 0);

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
                </div>
                <div className="text-sm font-bold text-gray-600">
                  {item.note}
                </div>
                {item.timestamp > 0 && (
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {formatTime(item.timestamp)}
                  </div>
                )}
              </div>
              <div className="font-mono font-bold text-[#E4C2C1] text-lg">
                NT${item.amount.toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 space-y-1">
          <div className="flex justify-between">
            <span className="text-sm font-bold text-gray-500">總計 (TWD)</span>
            <span className="text-xl font-mono font-black text-[#E4C2C1]">
              NT${totalTWD.toLocaleString()}
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
          : `1 TWD ≈ ${exchangeRate.toFixed(4)} ${selectedCurrency.code}`}
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
// 3. 分頁組件 (Tabs)
// ==========================================

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
          className={`px-4 py-2 rounded-xl font-bold text-sm border transition-all ${
            selectedDay === "all"
              ? "bg-white text-gray-800 border-gray-200 shadow-sm"
              : "bg-transparent text-gray-400 border-transparent hover:bg-white/50"
          }`}
        >
          全部
        </button>
        {tripData.map((day) => (
          <button
            key={day.dayId}
            onClick={() => setSelectedDay(day.dayId)}
            className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
              selectedDay === day.dayId
                ? `bg-white text-gray-800 border-gray-200 shadow-md transform scale-105`
                : "text-gray-400 border-transparent hover:bg-white/50"
            }`}
          >
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
                const currentTicket = ticketOverrides[spot.id] || spot.ticket;
                const isAccommodation = isHotel(spot.name);
                
                // 統一處理：景點門票或住宿費用
                const hasCostInfo = currentTicket && (currentTicket.adult > 0 || currentTicket.child > 0);
                const ticketTotal = hasCostInfo
                  ? isAccommodation
                    ? currentTicket.adult * counts.adult // 住宿：房價×房數
                    : currentTicket.adult * counts.adult + currentTicket.child * counts.child // 門票
                  : 0;

                const isWalk = transportModes[spot.id] === "walk";

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
                      {/* 時間顯示 - 放大字體 */}
                      <div className="flex items-baseline gap-2 bg-gray-100 px-4 py-2 rounded-xl border border-gray-200 mb-4 inline-flex">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                          {index === 0 ? "出發" : "抵達"}
                        </span>
                        {index === 0 ? (
                          <input
                            type="time"
                            value={dayStartTimes[day.dayId] || "09:00"}
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

                      <div>
                        {/* 景點名稱 - 加大加粗 */}
                        <h3 className="text-2xl font-black text-gray-900 mb-2">
                          {spot.name}
                        </h3>
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
                                    <span className="font-mono font-bold text-[#E4C2C1]">NT${currentTicket.adult.toLocaleString()}</span>
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
                                  <span className="text-sm font-mono font-bold text-[#E4C2C1]">共 NT${ticketTotal.toLocaleString()}</span>
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
                                      <span className="font-mono font-bold text-[#E4C2C1]">NT${currentTicket.adult.toLocaleString()}</span>
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
                                        <span className="font-mono font-bold text-[#A9BFA8]">NT${currentTicket.child.toLocaleString()}</span>
                                        <span className="text-gray-400">×</span>
                                        <div className="flex items-center bg-white border rounded-lg px-1 shadow-sm">
                                          <button onClick={() => updateSpotTicketCount(spot.id, "child", -1)} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-gray-300 rounded-xl text-xl text-gray-700 active:bg-gray-200 shadow-sm font-bold">-</button>
                                          <span className="text-gray-900 font-black px-2 text-lg">{counts.child}</span>
                                          <button onClick={() => updateSpotTicketCount(spot.id, "child", 1)} className="w-10 h-10 flex items-center justify-center bg-white border-2 border-gray-300 rounded-xl text-xl text-gray-700 active:bg-gray-200 shadow-sm font-bold">+</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <button onClick={() => handleManualTicketEdit(spot.id)} className="text-gray-300 hover:text-gray-500 shrink-0"><Icons.Edit size={12} /></button>
                                </div>
                                <div className="text-right text-sm font-mono font-bold text-[#E4C2C1]">共 NT${ticketTotal.toLocaleString()}</div>
                              </div>
                            )}
                            {ticketOverrides[spot.id] && (
                              <div className="text-right text-[9px] text-[#A9BFA8] italic mt-1">AI 估算</div>
                            )}
                          </div>
                        ) : (
                          !isAccommodation && (
                            <div className="text-[10px] text-gray-300 mb-4 flex items-center gap-1">
                              <Icons.Ticket size={12} /> {isTicketEstimating ? "AI 估價中..." : "免費 / 待估價"}
                            </div>
                          )
                        )}

                        <p className="text-sm text-gray-500 mb-2 leading-relaxed">
                          {spot.desc}
                        </p>
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
                                  { name: curSpot.name, lat: curSpot.lat, lon: curSpot.lon },
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
          <p className="text-xs text-gray-400 text-center">匯入前會顯示差異比對，確認後才覆蓋。不同行程的資料會額外警告。</p>
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
          ( NT${stats.totalJpy.toLocaleString()} )
        </div>
        <button
          onClick={handleOpenEmailClick}
          className="w-full py-3 bg-[#F9F7F5] border border-gray-200 text-[#A9BFA8] rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-white hover:shadow-md transition-all"
        >
          <Icons.Mail size={16} /> 發送詳細報表
        </button>
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
  const [snowAnalysis, setSnowAnalysis] = useState({});
  const winterRoutes = window.WINTER_ROUTES || [];
  const winterEssentials = window.WINTER_ESSENTIALS || null;

  const allSpots = useMemo(() => {
    return tripData.flatMap((day) =>
      day.spots.map((spot) => ({ ...spot, dayDate: day.date.split(" ")[0] }))
    );
  }, [tripData]);

  const checkSnowRoute = async (route) => {
    setAiLoading(true);
    setSnowAnalysis((p) => ({ ...p, [route.day]: "分析中..." }));
    try {
      const prompt = `請查詢【2027年${route.date} ${route.route}】的冬季路況與降雪預報：

翻越路段：${route.passes.length ? route.passes.join("、") : "無山區"}
使用道路：${route.roads.join("、")}
氣象廳區域：${route.jmaArea}

請用 Google Search 查詢並提供：
1. 該區域 ${route.date} 前後 3 日的降雪預報（氣象廳、tenki.jp）
2. 上述高速公路/國道目前是否有冬季封閉、チェーン規制、通行止め
3. 已知的積雪/凍結危險路段
4. 建議出發時間（避開清晨結冰與傍晚風雪）
5. 若主要路線封閉的替代路線
請用繁體中文回答，標注資訊查詢時間。若查不到即時資料，請根據該區域 1 月歷史氣候給出一般性建議。`;
      const res = await generateGeminiContent(prompt, null, true);
      setSnowAnalysis((p) => ({ ...p, [route.day]: res }));
    } catch (e) {
      setSnowAnalysis((p) => ({ ...p, [route.day]: "分析失敗" }));
      if (e.message.includes("NO_API_KEY") || e.message === "BAD_API_KEY") openKeyModal(true); else if (e.message.startsWith("QUOTA_EXHAUSTED")) alert("⏳ Gemini 配額用完，請稍後再試或明天 16:00 重置");
    }
    setAiLoading(false);
  };

  const checkFlight = async () => {
    setAiLoading(true);
    setFlightAnalysis("分析中...");
    try {
      const prompt = `請查詢以下交通資訊的【最新即時狀態】：
去程：${flightInfo.outbound?.date} ${flightInfo.outbound?.flight} 從${flightInfo.outbound?.from}到${flightInfo.outbound?.to}
回程：${flightInfo.inbound?.date} ${flightInfo.inbound?.flight} 從${flightInfo.inbound?.from}到${flightInfo.inbound?.to}

請提供：
1. 當日天氣預報（冬季重點：降雪、強風對航班影響）
2. 神戶機場冬季航班延誤/取消風險
3. 機場往返市區的路況（下雪時港島聯絡橋可能管制）
4. 預估交通時間與建議出發時段
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
4. 雨天備案（若為戶外景點）
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

      {/* ❄️ 冬季雪況路況 */}
      {winterRoutes.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 px-1 text-lg">
            ❄️ 雪況路況
          </h3>

          {/* 冬季駕駛必備 */}
          {winterEssentials && (
            <div className="glass-panel p-5 rounded-3xl bg-gradient-to-br from-blue-50 to-white border-blue-100 shadow-lg">
              <h4 className="font-bold text-blue-700 mb-3 flex items-center gap-2">🚗 冬季駕駛必備</h4>
              <div className="space-y-2.5 mb-4">
                {["tire","chain","fuel","emergency","gear"].map((k) => winterEssentials[k] && (
                  <div key={k} className="flex gap-2.5 text-sm">
                    <span className="text-lg flex-shrink-0">{winterEssentials[k].icon}</span>
                    <div>
                      <span className="font-bold text-gray-800">{winterEssentials[k].title}：</span>
                      <span className="text-gray-600">{winterEssentials[k].detail}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {winterEssentials.links.map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noreferrer"
                    className="px-3 py-1.5 bg-white border border-blue-200 rounded-full text-xs font-bold text-blue-700 hover:bg-blue-50 transition">
                    {l.icon} {l.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 每日路段風險 */}
          {winterRoutes.map((r) => {
            const riskStyle = r.risk === "high"
              ? { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-500", label: "高風險", dot: "🔴" }
              : r.risk === "medium"
              ? { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-500", label: "中風險", dot: "🟡" }
              : { bg: "bg-green-50", border: "border-green-200", badge: "bg-green-500", label: "低風險", dot: "🟢" };
            const nexcoUrl = "https://www.c-nexco.co.jp/road_info/";
            return (
              <div key={r.day} className={`glass-panel p-5 rounded-3xl ${riskStyle.bg} ${riskStyle.border} border-2 shadow-lg`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{riskStyle.dot}</span>
                    <span className="font-black text-gray-800">{r.day}</span>
                    <span className="text-sm text-gray-500">{r.date}</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold text-white ${riskStyle.badge}`}>{riskStyle.label}</span>
                </div>
                <div className="font-bold text-sm text-gray-800 mb-2">{r.route}</div>
                {r.passes.length > 0 && (
                  <div className="text-xs text-gray-600 mb-1.5">⛰️ {r.passes.join(" / ")}</div>
                )}
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
                  <button onClick={() => checkSnowRoute(r)} disabled={aiLoading}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-700 disabled:opacity-50 shadow-md">
                    {aiLoading && snowAnalysis[r.day] === "分析中..." ? <Icons.Loader2 size={14} className="animate-spin" /> : "🤖"} AI 查即時雪況
                  </button>
                  <a href={nexcoUrl} target="_blank" rel="noreferrer"
                    className="px-4 py-2.5 bg-white border border-gray-300 rounded-xl font-bold text-xs text-gray-700 flex items-center gap-1.5 hover:bg-gray-50 shadow-sm">
                    📍 NEXCO
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
      <div className="glass-panel p-6 rounded-3xl bg-white border-gray-100 shadow-lg">
        <h3 className="font-bold text-[#E4C2C1] mb-4 flex items-center gap-2">
          <Icons.Hotel size={20} /> 住宿防雷
        </h3>
        <div className="space-y-4">
          {hotelInfo.map((h, i) => (
            <div
              key={i}
              className="mb-4 last:mb-0 bg-gray-50 border border-gray-200 p-4 rounded-xl"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-gray-800 text-sm">{h.name}</h4>
                <button
                  onClick={() => checkHotel(h)}
                  disabled={aiLoading}
                  className="bg-white border border-gray-200 p-2 rounded-full text-gray-400 hover:text-[#E4C2C1] shadow-sm"
                >
                  <Icons.Search size={14} />
                </button>
              </div>
              {hotelAnalysis[h.name] && (
                <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg text-xs text-gray-500 leading-relaxed">
                  {hotelAnalysis[h.name] === "分析中..." ? (
                    <Icons.Loader2 size={12} className="animate-spin" />
                  ) : (
                    <MarkdownRenderer content={hotelAnalysis[h.name]} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 px-1">
          <Icons.MapPin size={20} className="text-[#E8D595]" /> 每日景點防雷
        </h3>
        {allSpots.map((spot) => (
          <div
            key={spot.id}
            className="glass-panel p-5 rounded-3xl bg-white border-gray-100 shadow-lg flex flex-col gap-3"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#E8D595] text-white flex flex-col items-center justify-center shadow-md">
                <span className="text-xs font-bold">
                  {spot.dayDate.split("/")[0]}
                </span>
                <span className="text-sm font-black">
                  {spot.dayDate.split("/")[1]}
                </span>
              </div>
              <div className="flex-1 font-bold text-gray-800">{spot.name}</div>
            </div>
            {spotAnalysis[spot.id] && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600">
                {spotAnalysis[spot.id] === "分析中..." ? (
                  <Icons.Loader2 className="animate-spin" size={14} />
                ) : (
                  <MarkdownRenderer content={spotAnalysis[spot.id]} />
                )}
              </div>
            )}
            <button
              onClick={() => checkSpot(spot)}
              disabled={aiLoading}
              className="w-full bg-white border border-gray-200 text-[#E8D595] hover:text-white hover:bg-[#E8D595] py-2 rounded-lg font-bold text-xs transition-all shadow-sm"
            >
              AI 掃雷 (Plan B)
            </button>
          </div>
        ))}
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

// ==========================================
// 4. 主應用程式 (App) - 整合所有邏輯
// ==========================================

function App() {
  const Icons = window.Icons;

  // --- States (UI Control) ---
  const [activeTab, setActiveTab] = useState("itinerary");
  const [selectedDay, setSelectedDay] = useState("all");
  const [currentThemeIndex, setCurrentThemeIndex] = useState(() =>
    parseInt(localStorage.getItem("themeIndex") || "0", 10)
  );

  // --- States (Data) ---
  const [dayStartTimes, setDayStartTimes] = useState(() =>
    JSON.parse(localStorage.getItem("start_times") || "{}")
  );
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
  const [chainStores, setChainStores] = useState([]);
  const chains = window.CHAIN_STORES || [];

  const openChainFinder = (spotA, spotB) => {
    const midLat = ((spotA.lat || 0) + (spotB.lat || 0)) / 2;
    const midLon = ((spotA.lon || 0) + (spotB.lon || 0)) / 2;
    const routeKey = spotA.name + "→" + spotB.name;
    const preCalc = window.CHAIN_ROUTES?.[routeKey];
    const d1 = preCalc?.d1 || null;
    const d1km = d1 ? (d1 / 1000).toFixed(1) : parseFloat(getDistanceFromLatLonInKm(spotA.lat, spotA.lon, spotB.lat, spotB.lon));
    setChainMidpoint({ midLat, midLon, fromName: spotA.name, toName: spotB.name, fromLat: spotA.lat, fromLon: spotA.lon, toLat: spotB.lat, toLon: spotB.lon, d1km, hasPreCalc: !!preCalc });
    // Use pre-calculated stores if available, filter out huge detours (>30km = not in area)
    const preStores = preCalc?.stores?.filter(s => s.detour != null && s.detour < 30000) || [];
    setChainStores(preStores);
    setShowChainPanel(true);
  };

  const chainNavUrl = (storeName, mp, storeLat, storeLng) =>
    "https://www.google.com/maps/dir/?api=1&origin=" + mp.fromLat + "," + mp.fromLon + "&destination=" + mp.toLat + "," + mp.toLon + "&waypoints=" + (storeLat ? storeLat + "," + storeLng : encodeURIComponent(storeName)) + "&travelmode=driving";

  useEffect(() => {
    localStorage.setItem("shopping_list", JSON.stringify(shoppingList));
  }, [shoppingList]);

  const toggleBought = (id) => {
    setShoppingList(prev => prev.map(item =>
      item.id === id ? { ...item, bought: !item.bought } : item
    ));
  };

  const addShoppingItem = (name, category, keywords, icon, note) => {
    const newItem = {
      id: "s" + Date.now(),
      name, category,
      keywords: keywords.split(",").map(k => k.trim()),
      icon: icon || "🛒",
      note: note || "",
      bought: false,
    };
    setShoppingList(prev => [...prev, newItem]);
  };

  const removeShoppingItem = (id) => {
    setShoppingList(prev => prev.filter(item => item.id !== id));
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

    setScanningNearby(true);
    setNearbyResults(null);

    const itemList = unbought.map(i => i.icon + " " + i.name + "（找：" + i.keywords?.slice(0,3).join("/") + "）").join("\n");

    const prompt = "我現在在日本九州，位置座標 " + lat + "," + lon + "（" + spotName + " 附近）。\n\n" +
      "我的購物清單（還沒買的）：\n" + itemList + "\n\n" +
      "請用 Google Search 搜尋我目前位置 500 公尺內可能買到清單物品的商店。\n\n" +
      "⚠️ 回覆格式要求（嚴格遵守）：\n" +
      "每間商店用以下格式，一行一項：\n" +
      "STORE|商店名稱|步行距離（公尺）|可買物品（用逗號分隔）\n\n" +
      "範例：\nSTORE|サンドラッグ箱崎店|225|太田胃散,DARIYA SALON de PRO\n" +
      "STORE|BOOKOFF福岡東店|0|LEGO Ninjago 70654,二手BALMUDA\n\n" +
      "最後如果有找不到的物品，加一行：\nNOTE|找不到的說明\n\n" +
      "只輸出 STORE| 和 NOTE| 開頭的行，不要其他文字。";

    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Parse structured response
      const lines = text.split("\n").filter(l => l.trim());
      const stores = [];
      const notes = [];
      lines.forEach(line => {
        const sm = line.match(/STORE\|(.+?)\|(\d+)\|(.+)/);
        if (sm) stores.push({ name: sm[1], dist: parseInt(sm[2]), items: sm[3].split(",").map(s=>s.trim()), navUrl: "https://www.google.com/maps/dir/?api=1&origin=" + lat + "," + lon + "&destination=" + encodeURIComponent(sm[1]) + "&travelmode=walking" });
        const nm = line.match(/NOTE\|(.+)/);
        if (nm) notes.push(nm[1]);
      });

      if (stores.length > 0) {
        setNearbyResults({ stores, notes, raw: null });
      } else {
        // Fallback: show raw text + generic map search link
        setNearbyResults({ stores: [], notes: [], raw: text, fallbackUrl: "https://www.google.com/maps/search/藥妝+ドラッグストア/@" + lat + "," + lon + ",16z" });
      }
    } catch (e) {
      setNearbyResults({ stores: [], notes: [], raw: "搜尋失敗：" + e.message, fallbackUrl: null });
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
      if (selectedCurrency.code === "TWD") {
        setExchangeRate(1);
        return;
      }
      setIsRateLoading(true);
      try {
        const res = await generateGeminiContent(
          `1 TWD to ${selectedCurrency.code} rate? number only`,
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
  const tripData = useMemo(() => {
    return window.RAW_KML_DATA.map((day) => {
      let currentMinutes = timeToMinutes(dayStartTimes[day.dayId] || "09:00");
      const newSpots = day.spots.map((spot, idx) => {
        const spotId = `${day.dayId}-s${idx}`;
        const stayStr = stays[spotId] || "1.5 hr";
        const stayMinutes = parseStayDuration(stayStr);
        const arrivalTimeStr = minutesToTimeStr(currentMinutes);
        let departureMinutes;
        let isDeparted = false;
        let actualDepTime = null;
        if (actualDepartures[spotId]) {
          actualDepTime = actualDepartures[spotId];
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
          const mode = transportModes[spotId] || "car";
          const speed = mode === "car" ? 40 : 4;
          let travelMinutes = Math.round((dist / speed) * 60);
          if (mode === "car") travelMinutes += 10;
          currentMinutes = departureMinutes + travelMinutes;
          nextArrivalTimeStr = minutesToTimeStr(currentMinutes);
          nextStopInfo = {
            name: nextSpot.name,
            lat: nextSpot.lat,
            lon: nextSpot.lon,
            distance: `${dist} km`,
            driveTime: Math.round((dist / 40) * 60 + 10) + "m",
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
      return { ...day, spots: newSpots };
    });
  }, [dayStartTimes, actualDepartures, stays, transportModes]);

  // --- 統計數據計算 ---
  const dailyStats = useMemo(() => {
    return tripData.map((d) => {
      let dayTotal = 0;
      d.spots.forEach((spot) => {
        const spotExpenses = expenses[spot.id] || [];
        spotExpenses.forEach((e) => (dayTotal += e.amount || 0));
        const currentTicket = ticketOverrides[spot.id] || spot.ticket;
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
      const roomPrice = prompt("請輸入每晚房價 (NT$):", current.adult);
      if (roomPrice === null) return;
      setTicketOverrides((prev) => ({
        ...prev,
        [spotId]: { adult: parseInt(roomPrice) || 0, child: 0 },
      }));
    } else {
      const adultPrice = prompt("請輸入成人票價 (NT$):", current.adult);
      if (adultPrice === null) return;
      const childPrice = prompt("請輸入兒童票價 (NT$):", current.child);
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
    setExpenseForm({ category: "food", amount: "", note: "" });
    setPendingReceipts([]);
    setIsModalOpen(true);
  };
  const saveExpense = () => {
    const newRecs = [];
    const timestamp = Date.now();
    if (expenseForm.amount) {
      newRecs.push({
        id: timestamp,
        timestamp: timestamp,
        amount: parseInt(expenseForm.amount),
        note: expenseForm.note || "手動記帳",
        category: "food",
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
        newRecs.push({
          id: timestamp + idx + 100,
          timestamp: recordTime,
          amount: parseInt(p.amount),
          note: p.note,
          category: "food",
        });
      }
    });
    if (newRecs.length > 0) {
      setExpenses((p) => ({
        ...p,
        [currentEditingSpot.id]: [
          ...(p[currentEditingSpot.id] || []),
          ...newRecs,
        ],
      }));
      setIsModalOpen(false);
    }
  };
  const deleteExpense = (sid, rid) =>
    setExpenses((p) => ({ ...p, [sid]: p[sid].filter((r) => r.id !== rid) }));

  const handleOpenEmailClick = () => {
    setEmailInput(localStorage.getItem("user_email") || "");
    setIsEmailModalOpen(true);
  };
  const handleOpenDailyDetail = (dayData) => {
    setSelectedDailyStats(dayData);
    setIsDailyDetailOpen(true);
  };
  const handleSendEmail = async () => {
    if (!emailInput) {
      alert("請輸入信箱");
      return;
    }
    setIsSendingEmail(true);
    localStorage.setItem("user_email", emailInput);
    try {
      const htmlMessage = `<html><body><h2>旅遊報表</h2><p>總花費: NT$${stats.totalJpy}</p></body></html>`;
      await window.emailjs.send("service_5yh7x6g", "template_dlbyml8", {
        email: emailInput,
        to_email: emailInput,
        subject: "旅遊花費報表",
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
              `分析這張收據的金額、店家名稱與時間。回傳 JSON: {amount: number, store: string, date: "YYYY/MM/DD HH:mm"}。如果找不到時間，date 回傳 null。`,
              reader.result
            );
            const jsonMatch = res.match(/\{[\s\S]*\}/);
            const json = JSON.parse(jsonMatch ? jsonMatch[0] : res);
            setPendingReceipts((prev) =>
              prev.map((p) => {
                if (p.id !== item.id) return p;
                const displayNote =
                  (json.date ? json.date + " " : "") +
                  (json.store || "未命名收據");
                return {
                  ...p,
                  isAnalyzing: false,
                  amount: json.amount,
                  note: displayNote,
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
如果該景點免費(如公園、街道、車站、購物店)，請不要回傳該項目。
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
          setTicketOverrides((prev) => ({ ...prev, ...estimates }));
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
          setTicketOverrides((prev) => ({ ...prev, ...hotelEstimates }));
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

  return (
    <div className="min-h-screen pb-24 bg-[#F9F7F5]">
      <nav className="sticky top-0 z-50 bg-[#F9F7F5]/90 backdrop-blur-md p-4 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full border-2 border-[#E4C2C1] overflow-hidden">
              <img
                src={window.APP_LOGO || "logo.jpg"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = "https://placehold.co/100";
                }}
              />
            </div>
            <h1 className="font-black text-lg text-gray-800">
              {window.APP_TITLE || "親子遊"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <CurrencySwitcher
              selectedCurrency={selectedCurrency}
              exchangeRate={exchangeRate}
              isRateLoading={isRateLoading}
              setSelectedCurrency={setSelectedCurrency}
            />

            {/* Auto Ticket Button */}
            <button
              onClick={handleEstimateTickets}
              className={`p-2 rounded-full text-white shadow-md transition-all flex items-center justify-center w-9 h-9 ${
                isTicketEstimating
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#E4C2C1] hover:brightness-110"
              }`}
              title="AI 估算票價"
              disabled={isTicketEstimating}
            >
              {isTicketEstimating ? (
                <Icons.Loader2 size={18} className="animate-spin" />
              ) : (
                <Icons.Ticket size={18} />
              )}
            </button>

            {/* Map FAB */}
            <button
              onClick={handleOpenMap}
              className="bg-[#A9BFA8] p-2 rounded-full text-white shadow-md hover:brightness-110 transition-all flex items-center justify-center w-9 h-9"
              title="預覽地圖"
            >
              <Icons.Map size={18} />
            </button>

            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="p-2 bg-white rounded-full text-gray-400 border border-gray-200 hover:text-[#E4C2C1] hover:border-[#E4C2C1] transition-all shadow-sm"
            >
              <Icons.Settings size={20} />
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {activeTab === "itinerary" && (
          <ItineraryTab
            tripData={tripData}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            dayStartTimes={dayStartTimes}
            handleDayStartTimeChange={handleDayStartTimeChange}
            handleDepartureToggle={handleDepartureToggle}
            handleTransportToggle={handleTransportToggle}
            handleStayChangeNew={handleStayChangeNew}
            openExpenseModal={openExpenseModal}
            transportModes={transportModes}
            expenses={expenses}
            getTicketCounts={getTicketCounts}
            updateSpotTicketCount={updateSpotTicketCount}
            STAY_OPTIONS={window.STAY_OPTIONS}
            ticketOverrides={ticketOverrides}
            handleManualTicketEdit={handleManualTicketEdit}
            isTicketEstimating={isTicketEstimating}
            getMatchingItems={getMatchingItems}
            scanSpotNearby={scanSpotNearby}
            openChainFinder={openChainFinder}
          />
        )}
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
            </div>

            {chainStores.length > 0 ? (
              <div className="space-y-2">
                {chainStores.map((store, i) => {
                  const detourKm = store.detour >= 1000 ? (store.detour / 1000).toFixed(1) + "km" : store.detour + "m";
                  const colorClass = store.detour <= 500 ? "bg-green-50 border-green-300 text-green-800" : store.detour <= 2000 ? "bg-green-50 border-green-200 text-green-800" : store.detour <= 5000 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-red-50 border-red-200 text-red-800";
                  const badgeClass = store.detour <= 500 ? "bg-green-100 text-green-700" : store.detour <= 2000 ? "bg-green-100 text-green-700" : store.detour <= 5000 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
                  const catIcon = store.cat === "丼飯" ? "🍚" : "🛒";
                  return (
                    <a key={i} href={chainNavUrl(store.branch && store.branch.match(/[\u3000-\u9fff]/) ? store.branch : store.name + " " + (store.branch || ""), chainMidpoint, store.lat, store.lng)} target="_blank" rel="noreferrer"
                      className={`block p-3 rounded-xl border-2 ${colorClass} active:scale-[0.98] transition`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">{store.icon} {store.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeClass}`}>
                          {store.detour <= 500 ? "✅ 不繞路" : "🔄 +" + detourKm}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{catIcon} {store.branch || store.name}</span>
                        <span className="text-xs font-bold">🚗 導航</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-bold text-orange-600 mb-2">🍚 丼飯連鎖</div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {chains.filter(c => c.cat === "丼飯").map((c, i) => (
                    <a key={i} href={chainNavUrl(c.name, chainMidpoint)} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 p-3 bg-orange-50 rounded-xl border-2 border-orange-200 text-sm font-bold text-orange-800 active:scale-95 transition">
                      <span className="text-lg">{c.icon}</span><span className="flex-1">{c.name}</span><span className="text-xs">🚗</span>
                    </a>
                  ))}
                </div>
                <div className="text-xs font-bold text-green-600 mb-2">🛒 超市連鎖</div>
                <div className="grid grid-cols-2 gap-2">
                  {chains.filter(c => c.cat === "超市").map((c, i) => (
                    <a key={i} href={chainNavUrl(c.name, chainMidpoint)} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border-2 border-green-200 text-sm font-bold text-green-800 active:scale-95 transition">
                      <span className="text-lg">{c.icon}</span><span className="flex-1">{c.name}</span><span className="text-xs">🚗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 購物清單浮動按鈕 */}
      <button
        onClick={() => setShowShoppingPanel(!showShoppingPanel)}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-amber-500 text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-90 transition-transform"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        🛒
        {shoppingList.filter(i => !i.bought).length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {shoppingList.filter(i => !i.bought).length}
          </span>
        )}
      </button>

      {/* 購物清單面板 */}
      {showShoppingPanel && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => { setShowShoppingPanel(false); setNearbyResults(null); }}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black text-gray-900">🛒 購物清單</h2>
              <button onClick={() => { setShowShoppingPanel(false); setNearbyResults(null); }} className="p-2 text-gray-400"><Icons.X size={24} /></button>
            </div>

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
                {nearbyResults.stores?.map((store, i) => (
                  <div key={i} className="bg-white border-2 border-gray-200 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-gray-900">{store.name}</span>
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">🚶 {store.dist}m</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {store.items?.map((item, j) => (
                        <span key={j} className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full text-xs font-bold border border-amber-200">{item}</span>
                      ))}
                    </div>
                    <a href={store.navUrl} target="_blank" rel="noreferrer"
                      className="block w-full py-3 bg-gray-900 text-white text-center rounded-xl font-bold text-sm">
                      🚶 步行導航（{store.dist}m）
                    </a>
                  </div>
                ))}
                {nearbyResults.notes?.map((note, i) => (
                  <div key={i} className="text-xs text-gray-500 px-1">{note}</div>
                ))}
                {nearbyResults.raw && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {nearbyResults.raw}
                    {nearbyResults.fallbackUrl && (
                      <a href={nearbyResults.fallbackUrl} target="_blank" rel="noreferrer"
                        className="block mt-3 py-3 bg-gray-900 text-white text-center rounded-xl font-bold text-sm">
                        🔍 在 Google Maps 搜附近藥妝店
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 w-full bg-white/95 backdrop-blur-md border-t-2 border-gray-200 pb-safe z-40 flex justify-around py-3 text-xs font-bold text-gray-500">
        <button
          onClick={() => setActiveTab("itinerary")}
          className={`flex flex-col items-center gap-1 p-2 ${
            activeTab === "itinerary" ? "text-indigo-600" : "hover:text-gray-900"
          }`}
        >
          <Icons.List size={26} /> 行程
        </button>
        <button
          onClick={() => setActiveTab("info")}
          className={`flex flex-col items-center gap-1 p-2 ${
            activeTab === "info" ? "text-indigo-600" : "hover:text-gray-900"
          }`}
        >
          <Icons.LayoutGrid size={26} /> 資訊
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex flex-col items-center gap-1 p-2 ${
            activeTab === "stats" ? "text-indigo-600" : "hover:text-gray-900"
          }`}
        >
          <Icons.Calculator size={26} /> 統計
        </button>
        <button
          onClick={() => setActiveTab("guard")}
          className={`flex flex-col items-center gap-1 p-2 ${
            activeTab === "guard" ? "text-indigo-600" : "hover:text-gray-900"
          }`}
        >
          <Icons.Shield size={26} /> 防雷
        </button>
        <button
          onClick={() => setActiveTab("wishlist")}
          className={`flex flex-col items-center gap-1 p-2 ${
            activeTab === "wishlist" ? "text-indigo-600" : "hover:text-gray-900"
          }`}
        >
          <Icons.Heart size={26} /> 願望
        </button>
      </div>
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
      />
      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentEditingSpot={currentEditingSpot}
        expenseForm={expenseForm}
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
