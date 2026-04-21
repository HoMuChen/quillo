# Quillo Design System

**Single source of truth for visuals and interaction.**

This document consolidates and refines the earlier exploration in `docs/plans/design-system.md` and `docs/demo.html`. Where this document differs from those files, **this document wins**. The demo HTML remains useful as a reference prototype but is no longer binding.

---

## 01 · 設計哲學

Quillo 是**給人專心寫長文的編輯器** + **給人理性看數字的儀表板**。兩個情境的美學要求正相反：

| | 寫作 | 儀表板 |
|---|---|---|
| 情緒 | 溫暖、靜、留白 | 冷靜、密、可掃讀 |
| 質感 | 紙、墨、印刷 | 線稿、網格、幾何 |
| 字體 | 襯線、斜體、留氣 | 無襯線、表列、精準 |

**解法**：一套 tokens，兩種密度，用「容器」切換。寫作區用 `canvas`（紙）；儀表板、表格、彈窗、導覽用 `chrome`（扁平）。品牌辨識（deep green + ochre + paper）兩邊都在，但紙紋只留在 canvas。

> Voice：Editorial × Operational。像編輯部的後台，不像行銷落地頁，也不像 Salesforce。

---

## 02 · 三項建議調整（含理由）

相較於既有實作的三個「輕微」但影響整體質感的調整：

### 調整一 · 紀律化 italic serif 的使用範圍

**現狀**：demo 中 `<h3>`、section label、AI 段落、panel 標題、KPI 標籤等都用 Instrument Serif italic。

**問題**：斜體襯線的力量在「稀缺」。到處都是時反而變成裝飾，且中文 fallback 到 Noto Serif TC 不渲染 italic，呈現不一致。

**調整為**：italic serif **只出現在這四種語意**——
1. 文章 / 頁面**主標**（`<h1>`）
2. **AI 產出內容**（大綱、訪談問題、改寫建議、空狀態鼓勵文）
3. **Brand lockup**（"Quillo"）
4. **大數字 KPI**（讓儀表板也有編輯氣質，唯一例外——見 §09）

其他標題（`<h2>` `<h3>`、section label、panel header）全部用 **Geist sans 500–600 + tighter tracking**。這樣 italic 一出現，使用者眼睛就知道「這是 AI」或「這是主角」。

### 調整二 · 加深 ochre 的文字版本

**現狀**：`ochre #c28c3c` 在 `#faf7f0` 紙底上對比率 **3.1:1**，不到 WCAG AA 4.5:1。demo 中有把它當成 hint 文字、小 badge 用，實務上對色弱使用者是失敗的。

**問題**：編輯系統靠 ochre 做「AI 在說話」的語意色，不能丟。

**調整為**：分兩層
- `ochre` `#C28C3C`：**填充用**（chip 底、按鈕底、圖表填色、focus ring）
- `ochre-ink` `#8A5A1C`（新增，7.0:1）：**文字用**（連結、hint、小標籤、徽章文字）

所有既有 `text-ochre` 應該重構為 `text-ochre-ink`。hover / active 下才能用原色。

### 調整三 · 分離 canvas 與 chrome

**現狀**：`body::before` 紙紋覆蓋整個視窗，包含儀表板與表格。

**問題**：紙紋 + `mix-blend-mode: multiply` 在**資料密度高的區域會讓數字邊緣毛糙**，並且在 Retina 以外的螢幕放大時產生 moiré。同時 `mix-blend-mode` 有輕微渲染成本（每幀都要合成），桌面尚可，老機器 / 手機不行。

**調整為**：
- 紙紋從 `body::before` 移到 `.canvas` class（套用在：編輯器、空狀態、Onboarding、登入頁）
- 其他區域（sidebar、topbar、dashboard、table、modal）用純 `--bg` 平面
- 視覺連貫不會斷裂——因為底色 `#faf7f0` 一致，只是去掉紋理

### 小調整 · Pillar 色加一階中間亮度

`p1 #2b3f36` / `p2 #2d4a66` / `p3 #6e3a2f` 三個都很深，在大節點（128px 圓）好看，在小 chip / tree leaf（24px）很難分辨。新增：

| Deep（既有） | Mid（新增，用於小元素） |
|---|---|
| `p1 #2b3f36` | `p1-mid #4a6b5c`（+25% 亮度） |
| `p2 #2d4a66` | `p2-mid #4c6f91`（+25%） |
| `p3 #6e3a2f` | `p3-mid #9a5d4f`（+25%） |

配套：`-tint` 繼續作為最淺底（hover、selected bg）。

---

## 03 · 色彩系統

### 3.1 Surface（表面）

| Token | Hex | 用途 |
|---|---|---|
| `bg` | `#FAF7F0` | App 底色、canvas、input bg |
| `bg-2` | `#EFEADC` | sidebar 底、hover 填色、nested surface |
| `bg-3` | `#F5EFDF` | 按鈕 hover、subtle chip 底 |
| `rule` | `#D9D2BF` | hairline 邊框、分隔線（1px） |
| `rule-strong` | `#BFB6A0` | 聚焦容器邊框、卡片 hover 邊 |
| `mist` | `rgba(18,34,28,0.06)` | 任意輕 hover |
| `ink-shade` | `rgba(18,34,28,0.40)` | modal backdrop |

### 3.2 Ink（墨色）

| Token | Hex | on `bg` | 用途 |
|---|---|---|---|
| `ink` | `#12221C` | 14.8 ✓AAA | 標題、正文、primary 按鈕 |
| `ink-2` | `#2B3F36` | 10.1 ✓AAA | 正文強調、serif 內文 |
| `ink-3` | `#5A6B62` | 5.2 ✓AA | 次要文字、caption |
| `ink-4` | `#8A9891` | 2.8 ⚠ | **只用於 icon / 裝飾 / placeholder / 圖表 grid line，絕不當正文** |

### 3.3 Accent

| Token | Hex | 角色 |
|---|---|---|
| `ochre` | `#C28C3C` | **Fill only**：chip 底、按鈕填色、focus ring、圖表主色 |
| `ochre-ink` | `#8A5A1C` | **Text only**：AI hint、連結、徽章文字、迷你標籤（7.0:1 ✓AA） |
| `ochre-tint` | `#F7EFD8` | AI 卡片底、selected 底 |
| `rust` | `#9C4A30` | 破壞性動作、錯誤、取消發布（4.9:1 ✓AA） |
| `sage` | `#6A8466` | 成功、上升趨勢、stable 資料標記（3.8:1，非正文） |
| `sage-ink` | `#4A5E47` | sage 文字版（4.9:1 ✓AA） |
| `indigo-ink` | `#2D4A66` | **資料語意專用**：連結、query 連結、排名、info banner（8.1:1 ✓AAA） |

> **三色分工**：`ochre`＝AI 的顏色，`rust`＝小心的顏色，`indigo-ink`＝資料的顏色。這個分工規則不可違反，使用者會從顏色預期「這個動作會做什麼」。

### 3.4 Pillar（樹 / 圖）

| Token | Deep | Mid | Tint |
|---|---|---|---|
| p1 · Writing | `#2B3F36` | `#4A6B5C` | `#E6EDE6` |
| p2 · SEO | `#2D4A66` | `#4C6F91` | `#E4EAF0` |
| p3 · Strategy | `#6E3A2F` | `#9A5D4F` | `#EFE2DC` |

若 Pillar 超過 3 個，第 4–6 個循環使用，**不要再加新色**——太多色會破壞編輯感。實務上 spec 允許 3–5 個 Pillar，4 與 5 用 p1/p2 循環。

### 3.5 陰影

```css
--sh-1: 0 1px 0 rgba(18,34,28,0.05), 0 2px 8px rgba(18,34,28,0.04);
--sh-2: 0 2px 0 rgba(18,34,28,0.06), 0 8px 24px rgba(18,34,28,0.08);
--sh-3: 0 4px 0 rgba(18,34,28,0.06), 0 16px 48px rgba(18,34,28,0.12); /* modal */
--sh-focus: 0 0 0 2px var(--bg), 0 0 0 3.5px var(--ochre);
```

不使用彩色陰影、多層霓虹光、或 `filter: drop-shadow()`。

---

## 04 · 字體系統

### 4.1 Font stacks

```css
--sans:  "Geist", "Noto Sans TC", system-ui, -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif;
--serif: "Instrument Serif", "Noto Serif TC", Georgia, "PingFang TC", serif;
--mono:  "Geist Mono", "JetBrains Mono", ui-monospace, Menlo, monospace;
```

Noto Sans/Serif TC 在 zh-TW locale 會被**中文字形 fallback 優先**，英文字形交給 Geist / Instrument Serif。這是預期行為，不需要偵測 locale 切換 class。

### 4.2 角色對應（配合 §02 調整一）

| 類型 | Font + class | 使用 |
|---|---|---|
| `display` | serif italic 40/1.1 | 登入頁 hero |
| `h1-editorial` | serif italic 32/1.2 tracking-tight | 文章標題、頁面主標 |
| `h2` | **sans** 600 20/1.3 tracking-tight | 區塊標題（改自既有 serif） |
| `h3` | **sans** 600 16/1.4 | 卡片標題、panel header |
| `section-label` | sans 500 10/1.2 uppercase tracking-[0.14em] ink-4 | `PILLARS` `STATS` 這類小標 |
| `body` | sans 400 14/1.55 ink | UI 預設 |
| `body-editor` | serif 400 17/1.75 ink | Tiptap 編輯器內文（zh-TW 最佳閱讀尺寸） |
| `body-editor-sans` | sans 400 16/1.7 ink | 編輯器 sans 模式（使用者可切） |
| `body-small` | sans 400 12/1.5 ink-3 | 次要資訊 |
| `caption` | sans 400 11/1.4 ink-3 | 時間戳、hint |
| `mono-data` | mono tabular-nums 13/1.3 | 表格數字、百分比、排名、URL slug |
| `mono-micro` | mono 10/1.2 tracking-[0.04em] ink-3 | 關鍵字 tag、代碼片段、快捷鍵 `⌘K` |
| `ai-content` | serif italic 400 15/1.6 ink-2 | AI 產出的引用 / 建議（搭配 ✦） |
| `kpi-number` | **serif italic** 400 36/1 tracking-tight | 儀表板 KPI 大數字（唯一讓 italic 進資料區的例外） |

### 4.3 為什麼 KPI 用 serif italic

儀表板常陷入「一堆 mono 數字像 terminal」的無聊。讓 KPI 大數字用 Instrument Serif italic 是 Quillo 的**識別特徵**——資料依舊精準（小表格仍用 mono），但儀表板第一眼有編輯部的溫度。中英數混用時 Instrument Serif 處理漂亮，中文不會出現（KPI 沒有中文字）。

```tsx
<div className="font-serif italic text-[36px] leading-none tracking-tight tabular-nums">
  12,480
</div>
```

---

## 05 · 尺度與間距

### 5.1 Spacing（4pt base）

4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 96

預設卡片內距 24，panel 內距 28，section 上下距 40，頁面邊距 32。

### 5.2 Radius

| Token | px | 用途 |
|---|---|---|
| `r-sm` | 4 | chip、tag |
| `r-md` | 8 | button、input、card（預設） |
| `r-lg` | 12 | panel、modal、AI 卡 |
| `r-xl` | 16 | 登入 / empty state container |
| `r-full` | 9999 | pill、swatch |

### 5.3 Container widths

| 用途 | 寬 |
|---|---|
| 編輯器 content 欄 | **720px**（中文 35–40 字 / 行，黃金行長） |
| 登入 / 表單卡 | 440px |
| Modal（小） | 480px |
| Modal（中） | 640px |
| Dashboard max | 1440px |
| App shell | 100vw minus sidebar |

### 5.4 z-index scale

10 sticky · 20 dropdown · 30 tooltip · 40 drawer · 50 modal · 60 toast · 70 dev overlay

---

## 06 · 版面與響應式

### 6.1 App shell

```
┌─ header 60px ────────────────────────────────────────────────┐
│ Quillo  /  {Project}  /  {Section}              🔔 avatar    │
├─ sidebar 256px ─┬─ main ────────────────────────┬─ panel 340 │
│ Plan            │                               │            │
│ Articles        │   content                     │  context   │
│ Publish         │                               │            │
│ Track           │                               │            │
│ Suggest         │                               │            │
│ Settings        │                               │            │
│                 │                               │            │
│ [Project ▾]     │                               │            │
│ avatar          │                               │            │
└─────────────────┴───────────────────────────────┴────────────┘
```

- **Sidebar 256px**（較原 260 略窄，整數對齊 grid），可收合為 64px icon rail
- **Context panel 340px**，`.no-panel` 時 main 展開

### 6.2 Breakpoints

| | 寬 | 策略 |
|---|---|---|
| `xl` | ≥1280 | 三欄完整 |
| `lg` | 1024–1279 | 右 panel 變 drawer，hover trigger |
| `md` | 768–1023 | sidebar 收合 icon rail，右 drawer 全高 |
| `sm` | 640–767 | 單欄，漢堡選單，**唯讀模式** |
| `xs` | <640 | 同上 + 「請以桌面使用編輯功能」banner |

**編輯功能手機不可用**——不要做妥協版，直接告訴使用者用桌面。Spec §12 明說「手機僅查看不編輯」。

### 6.3 Canvas vs Chrome

```tsx
// 寫作區 / 空狀態 / onboarding / 登入頁
<main className="canvas">...</main>

// 儀表板 / 表格 / modal / sidebar / topbar
<main>...</main>
```

```css
.canvas {
  background: var(--bg);
  position: relative;
}
.canvas::before {
  content: "";
  position: absolute; inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(rgba(18,34,28,0.035) 1px, transparent 1.2px),
    radial-gradient(rgba(18,34,28,0.025) 1px, transparent 1.2px);
  background-size: 3px 3px, 7px 7px;
  background-position: 0 0, 1px 2px;
  mix-blend-mode: multiply;
  opacity: 0.9;
}
@media (prefers-reduced-motion: reduce), (max-width: 768px) {
  .canvas::before { display: none; } /* 小螢幕不划算 */
}
```

---

## 07 · 元件庫

所有元件放 `src/components/ui/`，一律用 `cva` + `cn`。以下是最小穩定集。

### 7.1 Button

```tsx
const button = cva(
  'inline-flex items-center justify-center gap-1.5 font-medium leading-none ' +
  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
  {
    variants: {
      variant: {
        default:     'bg-bg text-ink border border-rule hover:border-ink-3 hover:bg-bg-3',
        primary:     'bg-ink text-bg border border-ink hover:bg-ink-2 hover:border-ink-2',
        ochre:       'bg-ochre text-white border border-[#A6762B] hover:bg-[#A6762B]', /* 發布、生成 */
        ghost:       'bg-transparent text-ink hover:bg-mist border-0',
        destructive: 'bg-rust text-white border border-rust hover:opacity-90',
        link:        'text-indigo-ink underline-offset-2 hover:underline bg-transparent border-0 p-0 h-auto',
      },
      size: {
        sm:   'h-8  px-2.5 rounded-md text-[12px]',
        md:   'h-10 px-4 rounded-md text-[13px]',
        lg:   'h-11 px-5 rounded-md text-[14px]',
        icon: 'h-8 w-8 rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
)
```

- **不用 scale hover**（造成 layout shift）
- 按鈕內快捷鍵：`<span className="ml-1 font-mono text-[10px] opacity-60">⌘K</span>`
- Loading 狀態：`disabled` + 前置 spinner（見 §08.3），不替換 label

### 7.2 Input / Textarea / Select

```tsx
// 共用 class
const inputBase =
  'w-full rounded-md border border-rule bg-bg text-[14px] text-ink ' +
  'placeholder:text-ink-4 ' +
  'focus:outline-none focus:ring-2 focus:ring-ochre focus:ring-offset-2 focus:ring-offset-bg focus:border-rule ' +
  'disabled:bg-bg-2 disabled:cursor-not-allowed'

// <input>  className={cn(inputBase, 'h-10 px-3')}
// <textarea> className={cn(inputBase, 'min-h-[96px] p-3 leading-[1.6]')}
```

錯誤狀態加 `border-rust ring-rust/20`，下方掛 `<p className="mt-1 text-[11px] text-rust flex items-center gap-1">⚠ {msg}</p>`。

### 7.3 Chip（article state / publish target / data maturity）

```tsx
const chip = cva(
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ' +
  'text-[11px] font-medium uppercase tracking-wide whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral:      'bg-bg text-ink-2 border border-rule',
        planned:      'bg-bg text-ink-3 border border-rule',
        outlined:     'bg-bg text-ink-2 border border-rule',
        interviewing: 'bg-p1-tint text-p1 border border-p1/20',
        drafted:      'bg-bg text-ochre-ink border border-ochre/40',
        editing:      'bg-bg text-ink border border-ink-3 border-dashed',
        published:    'bg-ink text-bg border border-ink',
        needsUpdate:  'bg-ochre-tint text-rust border border-rust/40',
        error:        'bg-bg text-rust border border-rust/40',
        // maturity
        preliminary:  'bg-bg text-ochre-ink border border-ochre/40 border-dashed',
        stabilizing:  'bg-bg text-sage-ink border border-sage/40',
        stable:       'bg-bg text-ink-3 border border-rule',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
)

// <Chip tone="published"><Dot /> Published</Chip>
const Dot = ({ cls = 'bg-ink-3' }) => <span className={cn('w-1.5 h-1.5 rounded-full', cls)} />
```

### 7.4 Card

```tsx
<article className="rounded-lg border border-rule bg-bg shadow-sh-1 p-5 hover:border-rule-strong transition-colors">
  {/* content */}
</article>
```

Hover 加深邊框，**不改背景**（保持紙感）。

### 7.5 KPI card（儀表板）

```tsx
<div className="rounded-lg border border-rule bg-bg p-5">
  <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4 mb-3">
    Impressions
  </div>
  <div className="flex items-baseline gap-3">
    <span className="font-serif italic text-[36px] leading-none tracking-tight text-ink tabular-nums">
      12,480
    </span>
    <span className="font-mono text-[11px] text-sage-ink tabular-nums">+18.2%</span>
  </div>
  {/* 7d sparkline */}
  <svg className="mt-3 w-full h-8" /* recharts inline */ />
  {/* maturity */}
  <div className="mt-3 text-[10px] text-ochre-ink flex items-center gap-1.5">
    <span aria-hidden>◌</span>
    <span>初步資料 · T-2 可能再調整</span>
  </div>
</div>
```

### 7.6 AI note（AI 產出內容容器）

```tsx
<aside className="relative rounded-lg border border-rule p-5 bg-[linear-gradient(180deg,#F7EFD8_0%,#F1E7C6_100%)]">
  <span aria-hidden className="absolute top-3 right-3 text-ochre text-[14px]">✦</span>
  <div className="font-sans text-[10px] font-medium tracking-[0.14em] uppercase text-ochre-ink mb-2">
    AI 建議
  </div>
  <p className="font-serif italic text-[15px] leading-[1.6] text-ink-2">
    {text}
  </p>
</aside>
```

這是 AI 內容的**唯一容器**，全站不重新設計另一種 AI 卡片。

### 7.7 Toast

右下堆疊，max 3，380px，自動消失（success 4s / info 6s / error 持續）。

```tsx
<div role="status" aria-live="polite"
  className="rounded-lg border border-rule bg-bg shadow-sh-2 px-4 py-3 flex items-start gap-3 w-[380px]">
  <span aria-hidden className="mt-0.5 text-ochre">✦</span>
  <div className="flex-1">
    <div className="text-[13px] font-medium text-ink">已發布到 Ghost</div>
    <div className="text-[11px] text-ink-3 mt-0.5">
      {title} · 2 秒前 · <a className="text-indigo-ink underline-offset-2 hover:underline">檢視 ↗</a>
    </div>
  </div>
  <button aria-label="關閉" className="text-ink-4 hover:text-ink">✕</button>
</div>
```

### 7.8 Modal / Confirm dialog

破壞性動作全部走確認輸入：

```tsx
<Dialog>
  <DialogOverlay className="bg-ink-shade backdrop-blur-sm" />
  <DialogContent className="rounded-xl border border-rule bg-bg shadow-sh-3 p-7 max-w-[480px]">
    <h2 className="font-serif italic text-[22px] text-ink mb-2">確定要刪除此 Pillar？</h2>
    <p className="text-[13px] text-ink-3 leading-[1.6] mb-5">
      這會連同底下 {n} 篇文章一起刪除，且無法還原。
    </p>
    <label className="block text-[12px] text-ink mb-1.5">輸入 <code className="font-mono text-[12px] text-rust">DELETE</code> 以確認：</label>
    <input className={cn(inputBase, 'h-10 px-3')} />
    <div className="flex justify-end gap-2 mt-6">
      <Button variant="default">取消</Button>
      <Button variant="destructive" disabled>刪除</Button>
    </div>
  </DialogContent>
</Dialog>
```

### 7.9 Pillar tree node（複用既有 demo）

保留 demo.html 291–445 的節點 CSS，但把小節點的底色從 `var(--p1)` 改成 `var(--p1-mid)`（見 §02 小調整）。

---

## 08 · 狀態模式

### 8.1 資料成熟度（spec §6.3 / §7.2 / §8.1）

| 狀態 | 前綴 | 色 | 圖表 |
|---|---|---|---|
| `preliminary`（T-1~T-2） | `◌` | `ochre-ink` | 虛線 1.5px dashed |
| `stabilizing`（T-3~T-4） | `◐` | `sage-ink` | 細線 1.5px solid |
| `stable`（T-5+） | — | `ink` | 粗線 1.75px solid |

**鐵律**：AI 建議、警示、週月報**只讀 `stable` 資料**。如果使用者在 UI 打開「包含未穩定資料」開關，卡片邊框改虛線 + 標註，讓責任回到使用者。

### 8.2 文章狀態生命週期

```
planned → outlined → interviewing → drafted → editing → published
                                                           ↓
                                                    needs_update
```

對應 chip tone 見 §7.3。M1 只用 planned / outlined / drafted / editing / published 五個。

### 8.3 AI 長時任務（10–60 秒）

**不要用無盡 spinner**，要用階段進度：

```
┌─ AI 生成中 ────────────────────────────────┐
│                                             │
│  ✓  分析主題方向                 (sage-ink) │
│  ✓  搜尋關鍵字脈絡                          │
│  ◐  正在生成 Pillar…             (ochre 脈動)│
│  ○  配對 Cluster 文章             (ink-4)   │
│                                             │
│  約 20 秒 · [取消]                           │
└─────────────────────────────────────────────┘
```

- 每階段有人讀得懂的文字（不是「Loading…」）
- 估算剩餘時間（mono font）
- 永遠提供「取消」，呼叫 `AbortController`
- 若連 1 秒都不到，**不顯示這個 UI**（避免閃爍）

### 8.4 Skeleton

```tsx
<div className="motion-safe:animate-pulse">
  <div className="h-6 w-2/3 rounded bg-mist mb-3" />
  <div className="h-4 w-full rounded bg-mist mb-2" />
  <div className="h-4 w-5/6 rounded bg-mist" />
</div>
```

超過 300ms 才顯示；尊重 `prefers-reduced-motion`。

### 8.5 空狀態

```tsx
<div className="canvas flex flex-col items-center justify-center py-20 text-center">
  <svg className="w-10 h-10 text-ink-4 mb-4" /* 24-viewbox line-art */ />
  <h3 className="font-serif italic text-[22px] text-ink-2 mb-2">
    尚未規劃任何 Pillar
  </h3>
  <p className="text-[13px] text-ink-3 max-w-[340px] mb-5">
    從輸入想寫的主題開始，AI 會協助發想 3–5 個 Pillar 方向。
  </p>
  <Button variant="primary">開始規劃 →</Button>
</div>
```

空狀態**允許**包 canvas 紙感——這是少數能讓人停下來讀文字的時刻。

### 8.6 錯誤狀態

- **頁級**：同空狀態排版，上方加 `ERROR · {code}` mono uppercase rust
- **行內**：`text-rust text-[11px]` + `⚠`，**不用紅底色塊**

---

## 09 · 圖表（儀表板）

### 9.1 配色規則

| 指標 | Hex | 備註 |
|---|---|---|
| Impressions | `p1 #2B3F36` | 主色 |
| Clicks | `ochre #C28C3C` | |
| CTR | `sage #6A8466` | |
| Position | `p2 #2D4A66` | **反向 Y 軸** |

多指標同圖最多三條線，避免彩虹。

### 9.2 Recharts wrapper

全站圖表走同一個 `<Chart>` wrapper，統一：

```tsx
const chartDefaults = {
  grid: { stroke: '#D9D2BF', strokeDasharray: '2 4' },
  axis: { stroke: '#8A9891', fontSize: 11, fontFamily: 'Geist Mono' },
  tooltip: {
    contentStyle: {
      background: '#FAF7F0',
      border: '1px solid #D9D2BF',
      borderRadius: 8,
      boxShadow: 'var(--sh-2)',
      fontSize: 12,
      fontFamily: 'Geist',
    },
  },
  line: { strokeWidth: 1.75, dot: false, activeDot: { r: 4 } },
}
```

### 9.3 圖表對應表

| 資料型態 | 圖表 | 備用 |
|---|---|---|
| 時間趨勢 | Line（小尺寸用 Area） | Sparkline |
| 類別比較 | Horizontal Bar（pillar 色） | Column |
| 排名變化 | Line 反向 Y | 單獨軸 |
| 關鍵字漏斗 | Funnel（4 階段） | Stacked bar |
| 連結密度 | Heatmap | Matrix |
| 連結關係 | Force graph（沿用 pillar tree SVG） | — |

### 9.4 表格

```tsx
<table className="w-full text-[13px]">
  <thead className="sticky top-0 bg-bg/95 backdrop-blur border-b border-rule">
    <tr className="text-[10px] text-ink-4 uppercase tracking-[0.14em]">
      <th className="text-left font-normal py-2.5 px-3">Query</th>
      <th className="text-right font-normal py-2.5 px-3">Impr.</th>
      <th className="text-right font-normal py-2.5 px-3">Clicks</th>
      <th className="text-right font-normal py-2.5 px-3">Position</th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-rule/60 hover:bg-mist">
      <td className="py-3 px-3 text-ink">{query}</td>
      <td className="py-3 px-3 text-right font-mono tabular-nums">{impr}</td>
      {/* ... */}
    </tr>
  </tbody>
</table>
```

- 數字欄永遠 `font-mono tabular-nums text-right`
- 列高 48，保持呼吸
- 目標關鍵字前綴 `▸ ochre`

---

## 10 · 動效

### 10.1 Duration & easing

| 類型 | 時長 | Easing |
|---|---|---|
| Button hover | 150ms | `ease` |
| Popover / dropdown enter | 160ms | `ease-out` |
| Panel collapse | 280ms | `cubic-bezier(.2,.8,.3,1)` |
| Modal enter | 220ms | `cubic-bezier(.2,.8,.3,1)` |
| Tree node enter（`inkBloom`）| 550ms | `cubic-bezier(.2,.8,.3,1)` |
| Edge draw（`drawStroke`）| 700ms | `ease-out` |
| 脈動（進行中 `◐`） | 1.2s loop | `ease-in-out` |

### 10.2 Rules

- 只動 `transform` `opacity`（不動 `width` `height`，會觸發 layout）
- 無裝飾用途的無限動畫一律禁止
- `prefers-reduced-motion: reduce` 時：動畫時長 0.01ms，直接呈現終態

---

## 11 · 無障礙

### 11.1 對比率審計（已列入 §03）

- `ink-4` `ochre` `sage` `rule` 在**正文 / 長文本中禁用**
- `ochre-ink` `sage-ink` `indigo-ink` 是合規的文字變體
- CI 跑 `axe-core`，違反 AA 的 PR 不過

### 11.2 Focus

- 所有互動元件 `focus-visible:ring-2 ring-ochre ring-offset-2 ring-offset-bg`
- **不使用** `outline: none` 除非有等值替代
- Tab 順序 = 視覺順序
- Modal 進入自動 focus trap，`Esc` 關閉
- Icon-only 按鈕 `aria-label`

### 11.3 快捷鍵（桌面）

| 鍵 | 功能 |
|---|---|
| `⌘ K` | 全站快搜（M2） |
| `⌘ S` | 強制儲存當前草稿 |
| `⌘ /` | 顯示快捷鍵表 |
| `⌘ ⇧ P` | Command palette（M2） |

### 11.4 中文排版細節

- 段落 `line-height: 1.75`，英文 `1.5`
- 中文字距 `letter-spacing: 0.01em`
- 英文詞夾中時不加空白（由字體 metric 處理）
- 日期 / 數字用 `Intl.DateTimeFormat` / `Intl.NumberFormat`，**絕不手刻**

---

## 12 · 技術實作

### 12.1 Tailwind config

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:    { DEFAULT: '#FAF7F0', 2: '#EFEADC', 3: '#F5EFDF' },
        ink:   { DEFAULT: '#12221C', 2: '#2B3F36', 3: '#5A6B62', 4: '#8A9891' },
        rule:  { DEFAULT: '#D9D2BF', strong: '#BFB6A0' },
        mist:  'rgba(18,34,28,0.06)',
        ochre: { DEFAULT: '#C28C3C', ink: '#8A5A1C', tint: '#F7EFD8' },
        rust:  '#9C4A30',
        sage:  { DEFAULT: '#6A8466', ink: '#4A5E47' },
        indigo:{ ink: '#2D4A66' },
        p1: { DEFAULT: '#2B3F36', mid: '#4A6B5C', tint: '#E6EDE6' },
        p2: { DEFAULT: '#2D4A66', mid: '#4C6F91', tint: '#E4EAF0' },
        p3: { DEFAULT: '#6E3A2F', mid: '#9A5D4F', tint: '#EFE2DC' },
      },
      boxShadow: {
        'sh-1': '0 1px 0 rgba(18,34,28,0.05), 0 2px 8px rgba(18,34,28,0.04)',
        'sh-2': '0 2px 0 rgba(18,34,28,0.06), 0 8px 24px rgba(18,34,28,0.08)',
        'sh-3': '0 4px 0 rgba(18,34,28,0.06), 0 16px 48px rgba(18,34,28,0.12)',
      },
      fontFamily: {
        sans:  ['var(--font-sans)',  'Noto Sans TC',  'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Noto Serif TC', 'Georgia',   'serif'],
        mono:  ['var(--font-mono)',  'JetBrains Mono','ui-monospace','monospace'],
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(.2,.8,.3,1)',
      },
    },
  },
  plugins: [],
} satisfies Config
```

### 12.2 next/font

```tsx
// src/app/[locale]/layout.tsx
import { Instrument_Serif, Geist, Geist_Mono, Noto_Serif_TC, Noto_Sans_TC } from 'next/font/google'

const sans      = Geist            ({ subsets: ['latin'],         weight: ['300','400','500','600','700'], variable: '--font-sans'  })
const serif     = Instrument_Serif ({ subsets: ['latin'],         weight: ['400'], style: ['normal','italic'],     variable: '--font-serif' })
const mono      = Geist_Mono       ({ subsets: ['latin'],         weight: ['400','500','600'],             variable: '--font-mono'  })
const notoSans  = Noto_Sans_TC     ({ preload: false,             weight: ['300','400','500','600','700'], variable: '--font-sans-tc' })
const notoSerif = Noto_Serif_TC    ({ preload: false,             weight: ['400','500','700'],             variable: '--font-serif-tc' })
```

`preload: false` 給 CJK，避免首屏載入 1MB+ 中文字形（由 Noto cascade 在 runtime 載）。

### 12.3 Globals

```css
/* src/app/globals.css */
:root {
  --bg: #FAF7F0;
  /* ... 全部 token（同 §03） */
}

html, body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans), 'Noto Sans TC', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* 只在 canvas container 上紙紋 */
.canvas { position: relative; }
.canvas::before {
  content: "";
  position: absolute; inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(rgba(18,34,28,0.035) 1px, transparent 1.2px),
    radial-gradient(rgba(18,34,28,0.025) 1px, transparent 1.2px);
  background-size: 3px 3px, 7px 7px;
  background-position: 0 0, 1px 2px;
  mix-blend-mode: multiply;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

@media (max-width: 768px) {
  .canvas::before { display: none; }
}
```

---

## 13 · Do / Don't 速查

**DO**
- 用 `ochre-ink` 當文字，`ochre` 當填充
- 用 `font-serif italic` 當 h1、AI 內容、大 KPI、brand
- 用 `font-mono tabular-nums` 當表格數字
- 用 `indigo-ink` 當連結、`rust` 當刪除、`ochre` 當 AI，三色語意分工不違反
- 用 `.canvas` 標示寫作情境，其他地方維持扁平

**DON'T**
- 用純 `#000` / `#FFF`
- 用 emoji 當狀態 icon（用 Lucide SVG）
- 把 italic serif 用在 h2 / h3 / 小 label（編輯感會失效）
- 把紙紋 `body::before` 套在整個 viewport
- 用 scale hover（會推擠 layout）
- 用紅綠告訴使用者漲跌（只用 sage / rust + 箭頭）
- 做響應式編輯器（<768px 直接拒絕編輯）
- 在正文長段落用 `ink-4` / `ochre` / `sage`（對比率不足）

---

## 14 · 變更管理

- 視覺 / token 修改 → 改本文件 + 更新 `tailwind.config.ts` + 同步 `globals.css`
- 既有 `docs/plans/design-system.md` 與 `docs/demo.html` 視為**歷史版本**保留，不再更新
- 新元件進 `src/components/ui/` 並 export 統一 index
- PR 需附 before/after 截圖 + axe-core 報告（若影響對比）
- 重大視覺變更（加新色 / 改字體 / 改 spacing scale）需在 issue 中提案討論

---

## 附錄 A · 對應 spec.md 章節的 UI 覆蓋度

| Spec | UI 支援 | 關鍵元件 |
|---|---|---|
| §1 帳號多租戶 | Login、Tenant switcher | Button, Input |
| §2 專案管理 | 專案 CRUD、品牌訪談 wizard | Wizard stepper, AI note |
| §3 Pillar Cluster | 樹狀規劃、AI 兩步 | Pillar tree, AI progress |
| §4 文章生成 | Tiptap、大綱、訪談、SEO | Editor chrome, bubble menu, interview UI |
| §5 Ghost 發布 | Publish panel、狀態 | Status chip, publish target |
| §6 GSC 整合 | 連線、同步、maturity | Maturity chip, OAuth flow |
| §7 追蹤 | KPI、圖表、query 列表 | KPI card, Line chart, Table |
| §8 AI 優化 | 建議卡、diff | AI note, diff viewer |
| §9 報告通知 | Email template、Toast | Toast, in-app banner |
| §10 儀表板 | Project dashboard | Grid, KPI, Sparkline |
| §11 匯出 | Modal + 選項 | Modal, Select |
| §12 UX 要求 | 進度、確認、RWD、i18n | AI progress, Confirm dialog |
