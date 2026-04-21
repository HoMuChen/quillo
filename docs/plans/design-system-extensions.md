# Quillo Design System — Extensions

**Companion to** `docs/plans/design-system.md`（核心 tokens、排版、chip、tree/graph）**與** `docs/demo.html`（視覺基準）。

這份延伸文件不重複核心 tokens，只補上 spec.md 涵蓋、但 demo 尚未演示的應用層規格：資料成熟度、文章狀態、儀表板、圖表、編輯器面板、表單、表格、通知、空/載入/錯誤狀態、響應式、i18n。

所有 class 與 token 直接沿用核心系統（`bg`, `ink`, `ochre`, `rust`, `sage`, `rule`, `mist`, `p1/p2/p3`, `serif/sans/mono`）。**不引入新色**，只在既有色上定義用法。

---

## 0. 風格定位複述（給新加入者）

> **Editorial × Operational 雙模式，共用一套 ink-on-off-white token。**
>
> 寫作區偏靜——紙底、斜體襯線標題、留白、克制動效。資料區偏密——hairline grid、KPI、sparkline、hover 揭示。兩者以 token 統一，以容器寬度與密度切換。

**不要做的事**：純黑純白、彩色陰影、玻璃擬態、emoji 當 icon、scale hover、裝飾性無限動畫、置中對齊內文。

---

## 1. 資訊架構與主導覽

### 1.1 Sidebar primary nav（固定順序）

| Slot | zh-TW | en | Icon (Lucide) | Route |
|---|---|---|---|---|
| 1 | 規劃 | Plan | `network` | `/projects/[id]/plan` |
| 2 | 文章 | Articles | `file-text` | `/projects/[id]/articles` |
| 3 | 發布 | Publish | `send` | `/projects/[id]/publish` |
| 4 | 追蹤 | Track | `trending-up` | `/projects/[id]/track`（M2+）|
| 5 | 建議 | Suggest | `sparkles`（ochre filled） | `/projects/[id]/suggest`（M2+）|
| 6 | 設定 | Settings | `settings` | `/projects/[id]/settings` |

底部固定：Tenant / Project 切換器（serif italic 專案名）、使用者頭像。

### 1.2 Topbar crumb 規則

```
Quillo  /  {Project Name}  /  {Section}  ·  {Detail}
^serif italic   ^ink weight 500     ^ink-3 uppercase tracking-0.08em
```

Crumb 永遠左對齊。右側只放：通知鈴鐺、主要動作（例如「Publish」當頁才出現）、使用者選單。

### 1.3 Context panel（右側 340px）觸發規則

| 主區頁面 | 右 panel 內容 |
|---|---|
| Plan（Pillar 樹圖） | 選中節點詳情（關鍵字、意圖、cluster 統計） |
| Article 編輯器 | 三 tab：大綱 / 訪談 / SEO |
| Publish | 發布目標設定（Ghost 連線、排程、預覽） |
| Track 單篇 | Query 列表 + 目標關鍵字達成狀況 |
| Settings, Projects list | 無 panel（`.no-panel`，main 佔 column 2–3） |

---

## 2. 資料成熟度視覺系統（spec §6.3, §7.2, §8.1）

這是 Quillo 獨有、必須嚴格執行的視覺規則。使用者必須**不用讀文字就能辨識**這筆數字是否可信。

### 2.1 三級狀態對應

| 狀態 | 視覺 | 色 token | 適用範圍 |
|---|---|---|---|
| `stable` | 無裝飾，正常 ink 呈現 | `text-ink` | T-5 及以前 |
| `stabilizing` | 前綴 `◐` 半圓符號 + `text-sage` | `sage` (`#6a8466`) | T-3 ~ T-4 |
| `preliminary` | 前綴 `◌` 虛圓 + `text-ochre` + 數字上方加 dotted underline | `ochre` (`#c28c3c`) | T-1 ~ T-2 |

### 2.2 KPI 卡片範例

```tsx
<div className="rounded-xl border border-rule bg-bg p-5 shadow-sh-1">
  <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4 mb-2">Impressions</div>
  <div className="flex items-baseline gap-2">
    <span className="font-mono text-[28px] leading-none text-ink tabular-nums">12,480</span>
    <span className="font-mono text-[11px] text-sage">+18.2%</span>
  </div>
  {/* 成熟度標記 */}
  <div className="mt-3 text-[10px] text-ochre flex items-center gap-1.5">
    <span>◌</span> 初步資料 · T-2 可能再調整
  </div>
</div>
```

### 2.3 圖表資料成熟度

時間序列線圖中，`preliminary` 區段用**虛線 1.5px dashed**，`stabilizing` 用 **1.5px solid sage**，`stable` 用 **1.75px solid 主色**。hover tooltip 顯示「資料狀態：初步 / 調整中 / 穩定」。

### 2.4 自動觸發守門（spec §8.1）

任何 AI 建議、警示、週月報**只讀 `stable` 資料**。UI 上若使用者強制切換「包含未穩定資料」，卡片邊框改為 `border-dashed border-ochre`，提醒：**「此建議包含未穩定資料，可能在幾天內改變」**。

---

## 3. 文章狀態系統

### 3.1 Lifecycle（spec §18.1，M1 用前五個）

```
planned → outlined → interviewing → drafted → editing → published
                                                            ↓
                                                     needs_update
```

### 3.2 狀態 chip 定義（擴充既有 chip system）

| 狀態 | chip 樣式 | dot 色 |
|---|---|---|
| `planned` | `bg-bg text-ink-3 border-rule` | `bg-ink-4` |
| `outlined` | `bg-bg text-ink-2 border-rule` | `bg-sage` |
| `interviewing` | `bg-p1-tint text-p1 border-p1/20` | `bg-p1` + 脈動 1.2s |
| `drafted` | `bg-bg text-ochre-2 border-ochre/40` | `bg-ochre` |
| `editing` | `bg-bg text-ink border-ink-3 border-dashed` | `bg-ink-3` |
| `published` | `bg-ink text-bg border-ink` | `bg-ochre` |
| `needs_update` | `bg-[#f9f2e0] text-rust border-rust/40` | `bg-rust` |

所有 chip 繼承既有 `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-wide`。

### 3.3 Publish target 狀態（spec §5.3, §5.4）

一篇文章可對多個目標發布。Publish panel 中每個目標獨立顯示：

```
▲ Ghost · myblog.com            ●Published    2026-04-18 14:22   ↗ View
▲ WordPress · site.com (M2)     ◌Not set
```

狀態點色：`published` ochre / `draft_on_site` ink-3 / `error` rust / `unpublished` ink-4。

---

## 4. 編輯器表面（spec §4.1–§4.6）

### 4.1 Tiptap 編輯器容器

```tsx
<article className="mx-auto max-w-[720px] px-8 py-12 font-serif text-[17px] leading-[1.75] text-ink">
  {/* 繁中切換為 Noto Serif TC；編輯切換為 Geist sans（左下 toggle） */}
</article>
```

- 內容寬 **720px** 置中（CJK 最佳行長 35–40 字 / 行）
- Body 字級 17px、line-height 1.75（中文需要）
- H1 用 Instrument Serif italic 32px，H2 22px，H3 18px（既有規則）
- 段落間距 `mt-5`，不用 `<br>` 撐版面

### 4.2 Bubble menu（selection toolbar）

```tsx
<div className="flex items-center gap-0.5 rounded-lg border border-rule bg-bg shadow-sh-2 p-1">
  {/* Bold, Italic, H2, H3, Link, AI Rewrite ✦ */}
  <button className="h-7 px-2 rounded text-[12px] hover:bg-mist" />
</div>
```

AI Rewrite 按鈕用 `text-ochre` + ✦ 符號，與其他格式按鈕視覺分離。

### 4.3 Outline drawer（右 panel tab 1）

樹狀大綱，每個 section：
- 標題 serif italic 14px
- `needs_interview` 節點右側標 `◌ 待訪談` chip
- 拖拉排序用 `cursor-grab`，拖起時 opacity 0.5

### 4.4 訪談介面（spec §4.2）

**一次一題**佔滿主區，避免使用者在問題列表間分心。

```
┌──────────────────────── 主區 ────────────────────────┐
│                                                       │
│  Q3 / 6                                               │
│                                                       │
│  ╱╱ serif italic 24px question text ╱╱                │
│                                                       │
│  ┌─ textarea 10 行 ──────────────────────────────┐   │
│  │                                                │   │
│  └────────────────────────────────────────────────┘   │
│                                                       │
│  對應段落：H2「{section title}」  ↗ 定位                │
│                                                       │
│  [← 上一題]    [跳過]          [儲存進度] [下一題 →]   │
│                                                       │
└───────────────────────────────────────────────────────┘
```

- 問題用 serif italic，答案用 sans body
- 「全部跳過」藏在右上 ghost button（二次確認）
- 下方**進度條**用 `h-0.5 bg-ochre`，已答題 ochre，跳過 ink-4，未答 mist
- 底部永遠顯示「對應段落」快速跳回

### 4.5 AI 改寫 popover

選取文字後出現 bubble：

```
[更簡潔] [更詳細] [改語氣 ▾] [Custom prompt...]
```

送出後，**原文 + 改寫**並排 diff 顯示，使用者按「採用」才寫回。diff：刪除 `bg-rust/10 line-through text-rust`，新增 `bg-sage/10 text-ink`。

### 4.6 SEO panel（右 panel tab 3，spec §4.5）

每欄位下方即時 hint：
- Meta Title：長度 bar（0–60 ink-3 / 60–70 sage / 70+ rust）
- URL Slug：mono font，預覽 `myblog.com/{slug}`
- Focus Keyword：出現次數即時統計（`在內文出現 7 次`）
- Tags：chip 輸入，Enter 新增

### 4.7 圖片管理（spec §4.4）

- Feature image 區塊在文章標題上方，dashed border 的 drop zone（空狀態）
- 內文圖片點選後出現 floating toolbar：`Alt text` `Caption` `替換` `刪除`
- Alt text 欄位永遠顯示「SEO 重要」紅字 hint（若空）

---

## 5. 儀表板與圖表（spec §7，M2+）

### 5.1 儀表板 grid

寬螢幕（≥1280）：12 欄 grid、gutter 24px。

```
┌── KPI row (4 cards × 3 cols) ─────────────────────┐
│  Impressions | Clicks | CTR | Avg Position        │
├────────────── Main chart (cols 1-8) ───── Queries table (cols 9-12) ──┤
│                                                                        │
├─ Pillar performance (cols 1-6) ─┬─ Top / Worst articles (cols 7-12) ──┤
│                                 │                                      │
└─────────────────────────────────┴──────────────────────────────────────┘
```

### 5.2 KPI card（見 §2.2 範例）

- 標籤 10px uppercase ink-4
- 數值 Geist Mono 28px tabular-nums
- 變化 `+/-` 用 sage / rust，絕不用 green/red（避免偏離調色板）
- 底部 sparkline 7 天趨勢（stroke 1.5px ink-3）

### 5.3 線圖（Recharts，editorial 調色）

```tsx
const chartColors = {
  impressions: '#2b3f36',  // p1 sage-ink
  clicks: '#c28c3c',       // ochre
  ctr: '#6a8466',          // sage
  position: '#2d4a66',     // p2 blue-ink（反向 Y 軸）
};
```

- Grid line：`stroke: #d9d2bf` (rule), `strokeDasharray: 2 4`
- Axis label：`fill: #8a9891, fontSize: 11, fontFamily: Geist Mono`
- Tooltip：`bg-bg border-rule shadow-sh-2 rounded-lg p-3`，日期 mono，數值 mono，資料成熟度 badge
- 線條一律 1.75px、圓角頂點、無 shadow、不填色（多指標對比時才填 8% opacity）
- 點：只在 hover 時出現，4px 圓實心配色線

### 5.4 圖表類型對應

| 資料型態 | 圖表 | Library |
|---|---|---|
| 時間趨勢（曝光/點擊/CTR/排名） | Line（排名反向 Y） | Recharts |
| Pillar 表現對比 | Horizontal bar，pillar 色 | Recharts |
| Query × 文章密度 | Heatmap | visx 或 nivo |
| 關鍵字機會漏斗 | Funnel（4 階段） | Recharts |
| 內部連結關係（M2 內部連結） | Force graph（與 pillar tree 同風格） | d3-force + 現有 SVG |

### 5.5 資料表格（spec §7.1 query 列表、§10.2 文章列表）

```tsx
<table className="w-full text-[13px]">
  <thead className="sticky top-0 bg-bg/95 backdrop-blur border-b border-rule">
    <tr className="text-ink-4 text-[10px] uppercase tracking-[0.14em]">
      <th className="text-left font-normal py-2.5 px-3">Query</th>
      <th className="text-right font-normal py-2.5 px-3">Impr.</th>
      {/* ... */}
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-rule/60 hover:bg-mist cursor-pointer">
      <td className="py-3 px-3 text-ink">{query}</td>
      <td className="py-3 px-3 text-right font-mono tabular-nums">{impr}</td>
    </tr>
  </tbody>
</table>
```

- 數字欄一律 `font-mono tabular-nums text-right`
- 排序 header 加 `↕` 符號，啟用時 `↑` 或 `↓` ochre
- 一列高度 48px（確保行間呼吸）
- 「目標關鍵字」標註：列前方加 ochre `▸` icon

---

## 6. 表單系統

### 6.1 Multi-step wizard（專案建立、品牌訪談）

```
  ●─────●─────○─────○
  基本  品牌  受眾  語氣
```

- 步驟點：完成 `bg-ink`，當前 `bg-ochre ring-2 ring-ochre/30`，未到 `bg-bg border border-rule`
- 連線：完成段 `bg-ink`，未到 `bg-rule`
- 步驟標籤 mono 11px ink-3

### 6.2 Field group

```tsx
<label className="block mb-5">
  <span className="block text-[12px] font-medium text-ink mb-1.5">
    專案名稱 <span className="text-rust">*</span>
  </span>
  <input className="{既有 input style}" />
  <span className="block text-[11px] text-ink-4 mt-1.5">
    顯示在 Quillo 內部，可隨時修改
  </span>
</label>
```

- Required 標示：`*` rust
- Hint 小字 ink-4
- 錯誤：邊框 `border-rust`，下方 `text-rust text-[11px]` 並加 `⚠` prefix
- 成功：邊框 `border-sage` 只在非同步驗證完成時出現

### 6.3 品牌訪談（spec §2.2）六欄 textarea

每個 textarea 上方掛一張 AI 示例卡（見既有 §AI-accent note card 樣式），內容是「寫這題可以怎麼想」的引導文字。使用者可隨時略過。

---

## 7. 通知、橫幅、確認對話框

### 7.1 Toast

右下固定堆疊，最多 3 個，max-width 380px。

```tsx
<div className="rounded-xl border border-rule bg-bg shadow-sh-2 px-4 py-3 flex items-start gap-3">
  <span className="text-ochre mt-0.5">✦</span>  {/* 或 ✓ sage / ✕ rust */}
  <div className="flex-1">
    <div className="text-[13px] font-medium text-ink">已發布到 Ghost</div>
    <div className="text-[11px] text-ink-3 mt-0.5">{title} · 2 秒前 ↗ 檢視</div>
  </div>
  <button className="text-ink-4 hover:text-ink">✕</button>
</div>
```

自動消失：success 4s、info 6s、error 不自動消失。

### 7.2 頁內 banner

發生在頁面頂部，例如「Ghost 連線已過期」：

```tsx
<div className="border-b border-rust/30 bg-[#f9f2e0] px-6 py-2.5 text-[12px] text-rust flex items-center gap-2">
  <span>⚠</span>
  <span>Ghost 連線驗證失敗，此專案的發布功能已暫停。</span>
  <a className="underline underline-offset-2 ml-auto">重新連線 →</a>
</div>
```

### 7.3 確認對話框（destructive）

所有刪除、取消發布、全部跳過訪談必須二次確認。

```
  ┌────────────────────────────────────────┐
  │                                        │
  │  {italic serif 22px}                   │
  │  確定要刪除此 Pillar？                   │
  │                                        │
  │  這會連同 {n} 篇 Cluster 文章一起刪除，   │
  │  且無法還原。                            │
  │                                        │
  │  輸入「DELETE」以確認：                  │
  │  ┌────────────────────┐                │
  │  │                    │                │
  │  └────────────────────┘                │
  │                                        │
  │              [取消]  [刪除（disabled）]  │
  │                      ^rust primary      │
  └────────────────────────────────────────┘
```

- Modal bg：`bg-bg` 非半透明；backdrop `bg-ink/40 backdrop-blur-sm`
- 破壞性動作預設 disabled，直到確認輸入匹配才啟用 rust primary
- 一般確認用 ink primary 即可

---

## 8. 空 / 載入 / 錯誤狀態

三態必須同時設計，缺一不可。

### 8.1 Empty state

```tsx
<div className="flex flex-col items-center justify-center py-20 text-center">
  <svg className="w-10 h-10 text-ink-4 mb-4" />  {/* hairline line-art icon */}
  <h3 className="font-serif italic text-[22px] text-ink-2 mb-2">
    尚未規劃任何 Pillar
  </h3>
  <p className="text-[13px] text-ink-3 mb-5 max-w-[340px]">
    從輸入你想寫的主題開始，AI 會協助你發想 3–5 個 Pillar 方向。
  </p>
  <button className="btn primary">開始規劃 →</button>
</div>
```

- 標題用 serif italic 22px，全站空狀態統一
- 圖示用 24x24 viewbox、stroke-width 1.5 的線條圖（Lucide）
- 絕不用 emoji、絕不用 3D 插畫、絕不用漸層

### 8.2 Loading skeleton

原地替換為 skeleton，不要 spinner 覆蓋整個畫面（阻斷體感）。

```tsx
<div className="animate-pulse">
  <div className="h-6 w-2/3 bg-mist rounded mb-3" />
  <div className="h-4 w-full bg-mist rounded mb-2" />
  <div className="h-4 w-5/6 bg-mist rounded" />
</div>
```

- Skeleton 色用 `bg-mist`（非灰色塊）
- 只有超過 300ms 的動作才顯示（更短直接顯示結果，避免閃爍）
- 尊重 `prefers-reduced-motion`：`motion-safe:animate-pulse`

### 8.3 AI 長時任務進度（spec §12：「需顯示進度狀態」）

AI 動作可能 10–60 秒，必須用**具體階段進度**而非無盡 spinner：

```
┌─ AI 生成中 ─────────────────────────────────┐
│                                              │
│  ✓ 分析主題方向                              │
│  ✓ 搜尋關鍵字脈絡                            │
│  ◐ 正在生成 Pillar…   （ochre 脈動）         │
│  ○ 配對 Cluster 文章                         │
│                                              │
│  約 20 秒  · [取消]                           │
└──────────────────────────────────────────────┘
```

- `✓` 已完成 sage、`◐` 進行中 ochre 脈動、`○` 等待 ink-4
- 每階段有文案，不是只有「Loading...」
- 總計時間估算（`約 X 秒`），mono font
- 永遠提供「取消」，呼叫 AbortController

### 8.4 錯誤狀態

頁級錯誤：

```tsx
<div className="flex flex-col items-center py-20 text-center">
  <div className="font-mono text-[10px] tracking-[0.14em] text-rust mb-3 uppercase">
    Error · {code}
  </div>
  <h3 className="font-serif italic text-[22px] text-ink-2 mb-2">
    無法載入此文章
  </h3>
  <p className="text-[13px] text-ink-3 mb-5 max-w-[360px]">
    {friendly message}
  </p>
  <div className="flex gap-2">
    <button className="btn">重試</button>
    <button className="btn ghost">回文章列表</button>
  </div>
</div>
```

行內錯誤：`text-rust text-[11px]` + `⚠` prefix，不使用紅色背景塊（太刺眼）。

---

## 9. 響應式策略（spec §12：桌面優先、平板可用、手機僅查看）

### 9.1 Breakpoints（對齊 Tailwind）

| Token | 寬度 | 行為 |
|---|---|---|
| `xl` ≥1280 | 三欄 app shell 完整 | 編輯、分析、規劃全可用 |
| `lg` 1024–1279 | 右 panel 變 drawer，左 sidebar 保留 | 編輯可用，右 panel 點按觸發 |
| `md` 768–1023 | 左 sidebar 收合為 icon 64px；右 drawer full-height | 列表、查看、簡單編輯 |
| `sm` 640–767 | 單欄，上方漢堡 | **唯讀模式**：查看、儀表板 summary |
| `<640` | 同上 + 警示 | 編輯器顯示「請以桌面使用」banner |

### 9.2 手機唯讀 banner

```tsx
<div className="border-b border-ochre/30 bg-[#f9f2e0] px-4 py-2 text-[11px] text-ochre-2 flex items-center gap-2 md:hidden">
  <span>⚠</span>
  <span>Quillo 的編輯功能需要桌面瀏覽器，手機建議用於查看。</span>
</div>
```

### 9.3 儀表板折疊規則

- ≥xl：12 欄 grid
- lg：8 欄 grid，KPI 變 2×2
- md：單欄 stack，KPI 變 2×2，圖表全寬
- sm：KPI 4×1 stack，圖表隱藏或簡化為 sparkline-only

### 9.4 不做的事

- 不做 mobile drawer 編輯器（體驗會爛，不如明說「請用桌面」）
- 不做響應式 pillar tree（太小看不清），手機顯示 flat list
- 不在手機上顯示完整 GSC 圖表，只給 KPI summary

---

## 10. i18n 字體與排版

### 10.1 Locale 切換規則

| Locale | UI sans | 標題 serif | Body（編輯器） |
|---|---|---|---|
| `zh-TW`（主） | Geist + Noto Sans TC cascade | Instrument Serif + Noto Serif TC cascade | Noto Serif TC 400 |
| `en` | Geist | Instrument Serif | Instrument Serif 400（可選） 或 Geist |

Next.js `next/font` 設定已在既有 design-system.md `§Typography`。在 `<html lang={locale}>` 切換 class。

### 10.2 中英混排微調

- 中文段落 `line-height: 1.75`、`letter-spacing: 0.01em`
- 英文詞夾中文段落時，Geist 會被優先使用（font stack 排序確保）
- 數字 / 百分號 / URL 片段強制 mono（`<code>` 或 `<span className="font-mono">`）避免 proportional 跳動

### 10.3 英文斜體 fallback

Instrument Serif 有 italic，Noto Serif TC 沒有。中文字體不渲染 italic，由 browser 忽略，**這是預期行為**——不要用 `transform: skew()` 偽造斜體（會破壞字形）。

### 10.4 Date / number 格式

- 日期：`Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`（zh-TW: `2026年4月21日` / en: `Apr 21, 2026`）
- 數字千分位：`Intl.NumberFormat(locale)` 永遠使用，不手刻
- 百分比：`10.5%` 不加空格

---

## 11. 無障礙檢查（editorial 色盤特別注意）

### 11.1 既有色盤對比率（白字/深字 on `#faf7f0`）

| 色 | on `#faf7f0` | 結論 |
|---|---|---|
| `ink #12221c` | 14.8:1 | ✓ AAA |
| `ink-2 #2b3f36` | 10.1:1 | ✓ AAA |
| `ink-3 #5a6b62` | 5.2:1 | ✓ AA（正文可用）|
| `ink-4 #8a9891` | 2.8:1 | ⚠ 僅供裝飾 / label，不可當正文 |
| `ochre #c28c3c` | 3.1:1 | ⚠ 僅供標籤、chip、focus ring；**不可當正文**；按鈕用 `ochre` 底 + 白字（需白字 on ochre = 3.4:1，限大字 + 非薄字重 500+）|
| `rust #9c4a30` | 4.9:1 | ✓ AA |
| `sage #6a8466` | 3.8:1 | ⚠ 限非正文（label、icon、chart） |

**執行規則**：`ink-4`、`ochre`、`sage` 出現在正文時，必須升級到 `ink-3` 或搭配粗體 / 尺寸加大。CI 跑 axe-core。

### 11.2 Focus ring

既有 `--sh-focus` 使用 ochre，對比率 3.1:1。**可接受（WCAG 2.2 non-text contrast 3:1）**，但要確保 ring 至少 2px + offset 2px（見既有 button `focus:ring-2 focus:ring-ochre focus:ring-offset-2`）。

### 11.3 Reduced motion

全站 CSS：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

`inkBloom` / `drawStroke` 動畫被禁用時，直接呈現終態。進度脈動（`◐`）改為靜態。

### 11.4 鍵盤流

- Tab 順序永遠跟視覺順序一致
- 所有 modal 進入時 focus trap，Esc 關閉
- 編輯器快捷鍵：`⌘K` 全站搜尋、`⌘S` 強制儲存、`⌘/` 顯示快捷鍵表、`⌘⇧P` command palette（M2）
- Icon-only 按鈕必須 `aria-label`

### 11.5 色彩非唯一訊號

- Chip 已帶文字（`Draft` / `Published`），不是只有顏色
- 圖表多指標必須用線型 / dash pattern 區分，不只是顏色
- 資料成熟度有 `◌ ◐` 符號前綴，不只是色

---

## 12. 元件清單（M1 → M2 對照）

| 元件 | M1 | M2+ | 備註 |
|---|---|---|---|
| Button (5 variants) | ✓ | | 既有 cva |
| Input / Textarea / Select | ✓ | | 既有 |
| Status chip（7 states）| ✓（5）| +2 | needs_update, interviewing 等 M1 只用 5 |
| Pillar tree / graph | ✓ | | 既有 demo.html |
| AI note card | ✓ | | 既有 |
| KPI card | | ✓ | |
| Line / Bar chart | | ✓ | |
| Data table | ✓（文章列表）| ✓（query list）| M1 只用簡單版 |
| Wizard stepper | ✓ | | 建專案、品牌 |
| Toast / Banner / Confirm | ✓ | | |
| Tiptap editor chrome | ✓ | | bubble menu、outline |
| Interview UI | ✓ | | |
| AI progress | ✓ | | 大綱、訪談、草稿 |
| Image manager | ✓ | | |
| SEO panel | ✓ | | |
| Publish panel | ✓（Ghost）| +WP/Shopify | |
| Data maturity badge | | ✓ | GSC 才需要 |
| Skeleton library | ✓ | | 幾個基本形 |
| Empty state templates | ✓ | | |

---

## 13. Token / 變數追蹤原則

- 新增顏色必須經過本文件更新 §0 與 §11.1 才可進 tailwind config
- 元件類（button, chip, card）統一放 `src/components/ui/`，使用 cva
- 儀表板與圖表元件獨立 `src/components/charts/`，wrapper Recharts 並強制套用本文件 §5.3 樣式
- 變數命名規則：`--{scope}-{role}-{modifier?}`；例如 `--chart-grid-dashed`
- 如果 demo.html 與本文件衝突：**demo.html 為視覺基準，本文件補行為與情境**；兩者不一致時先開 PR 討論

---

## 14. 待辦 / 開放問題

- [ ] 暗色模式：目前全站 light，暗色是否需要？（spec 未要求，暫不做）
- [ ] Pillar 超過 3 個時顏色循環策略（`p1/p2/p3` cycle？還是加 `p4/p5`？）
- [ ] 編輯器字級使用者可調整？（目前固定 17px，可能需要 14/17/20 三檔）
- [ ] 儀表板「專案總覽」在 M1 是否需要最簡版（僅文章數、狀態分佈）？
- [ ] 通知中心（站內）M1 範圍：是否需要？（spec §9.2 提到）

---

**更新此文件時，務必同步**：`docs/plans/design-system.md`（如牽動 token）、`docs/demo.html`（如牽動視覺）、Tailwind config、`src/components/ui/` 元件 props 文件。
