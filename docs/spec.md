# SEO 規劃工具 — Functional Requirements

## 概述

一個多租戶的 SEO 內容規劃與生產工具，協助使用者從關鍵字研究、Pillar Cluster 規劃、AI 輔助內容生成，到發布與成效追蹤的完整閉環。目標使用者為經營內容網站的 SME 與內容行銷團隊。

## 階段規劃

- **Phase 1 MVP**：完整的內容生產閉環（規劃 → 生成 → 發布 → 追蹤 → 優化），發布支援 Ghost
- **Phase 2**：擴展發布通路（WordPress、Shopify）、批次規劃、內部連結
- **Phase 3**：進階功能（待規劃）

---

# Phase 1 MVP

## 1. 帳號與多租戶

### 1.1 註冊與登入
- 使用者可用 Email + 密碼註冊
- 使用者可用 Google 登入
- 新註冊用戶自動建立一個預設 Tenant（個人組織）

### 1.2 租戶管理
- 每個使用者至少屬於一個 Tenant
- Tenant 擁有者可以建立多個 Project
- Phase 1 先支援單人 Tenant（多人協作留到之後）

### 1.3 資料隔離
- 不同 Tenant 的資料完全隔離
- 同一 Tenant 下的 Project 資料彼此獨立

---

## 2. 專案管理

### 2.1 建立專案
使用者可在 Tenant 下建立新專案，需填寫：
- 專案名稱
- 網站網域
- 目標受眾描述
- 網站主題 / 定位描述

### 2.2 品牌素材設定
建立專案後引導使用者完成品牌訪談（可跳過之後再填），收集：
- 作者 / 團隊背景（寫文章的人是誰、有什麼專業背景）
- 目標讀者畫像（受眾痛點、知識水平）
- 品牌語氣（例如：專業 / 親切 / 技術導向）
- 常用專有名詞
- 禁用詞或禁用表達方式
- 代表性案例或經驗素材（E-E-A-T 來源）

品牌素材可隨時編輯更新。

### 2.3 專案列表與切換
- 使用者可看到所屬 Tenant 下的所有專案
- 可切換當前工作的專案
- 可編輯或刪除專案（刪除需確認）

---

## 3. Pillar Cluster 規劃

### 3.1 主題分析（Step 1）
- 使用者輸入：想規劃的主題、目標受眾補充（可選）
- 系統產出：
  - 該主題的核心面向（3-5 個）
  - 建議的 content hub 策略概述
- 使用者可以：
  - 接受並進入 Step 2
  - 調整方向後重新產出

### 3.2 Pillar & Cluster 產出（Step 2）
系統根據確認的方向產出：
- 3-5 個 Pillar 主題，每個包含：標題、描述、目標關鍵字、搜尋意圖
- 每個 Pillar 下 5-10 篇 Cluster 文章，每篇包含：
  - 標題
  - 目標關鍵字（主關鍵字 1 個）
  - LSI 關鍵字（2-3 個）
  - 搜尋意圖（資訊型 / 商業型 / 導購型）
  - 建議字數
  - 在 Cluster 中的角色（hub / supporting / comparison 等）

### 3.3 規劃結果管理
使用者可以：
- 編輯任一 Pillar 或 Article 的內容（標題、關鍵字等）
- 刪除不需要的 Pillar 或 Article
- 手動新增 Pillar 或 Article
- 針對單一 Pillar 重新生成其 Cluster Articles

規劃結果以樹狀結構顯示（Pillar → Articles）。

---

## 4. 文章生成流程

### 4.1 大綱生成
使用者從 Cluster 列表選一篇文章觸發大綱生成。系統產出文章大綱包含：
- 多個 Section（標題 + 目的說明）
- 每個 Section 標記是否需要訪談（needs_interview）

使用者可以：
- 編輯 section 順序、標題、目的
- 新增或刪除 section
- 手動調整 needs_interview 標記
- 重新生成大綱

### 4.2 AI 訪談
系統針對需要訪談的 section 產出問題：
- 每個 section 最多 2 題
- 整篇文章最多 8 題
- 問題必須具體、可驗證（不是「你有什麼經驗」這種空泛問題）

使用者在訪談介面可以:
- 逐題回答
- 跳過單題
- 一次「全部跳過」（文章將改用通用知識生成）
- 在回答過程中隨時儲存進度
- 看到每題對應的文章段落

### 4.3 草稿生成
所有訪談完成（或跳過）後觸發完整草稿生成。系統產出 Markdown 格式草稿，規則：
- 有訪談答案的段落必須基於答案撰寫，不得虛構
- 被跳過的段落以通用知識撰寫
- 全文遵循專案的品牌語氣與禁用詞規則

使用者可以：
- 在 Markdown 編輯器中直接編輯
- 針對選取段落請 AI 改寫（更簡潔 / 更詳細 / 改語氣等）
- 單一當前草稿，編輯直接覆蓋

### 4.4 圖片管理
- 使用者可上傳 Feature Image（文章封面）
- 使用者可在編輯器內插入內文圖片
- 每張圖片可編輯：
  - Alt text（SEO 重要）
  - Caption
- 圖片儲存在系統內，發布時一併上傳至目標平台

### 4.5 SEO Metadata
每篇文章可編輯以下 SEO 欄位：
- Meta Title
- Meta Description
- URL Slug
- Tags
- Excerpt（摘要）
- Canonical URL（可選）
- Focus Keyword（用於之後比對 GSC 表現，以及 Phase 2 WordPress Yoast/Rank Math 整合）

系統可根據文章內容自動建議 Meta Title 和 Meta Description，使用者可採用或修改。

### 4.6 文章資料結構（多平台預留）
文章資料結構預留以下欄位以支援 Phase 2 的 WordPress 與 Shopify 發布，Phase 1 暫不使用：
- **Categories**：階層式分類（WordPress 用）
- **Author ID**：作者識別（WordPress、Shopify 都有 author 概念）
- **Post Format**：文章格式（WordPress 的 standard / aside / gallery 等）
- **Handle**：Shopify 的 URL handle（與 slug 獨立儲存，因為 Shopify 有自己的格式限制）
- **Template Suffix**：Shopify 的自訂模板（例如 article.custom.liquid）
- **Published Scope**：Shopify 的發布範圍（web / global）
- **Blog ID**：Shopify 的 blog 歸屬（一個 Shopify store 可有多個 blog）
- **Custom Fields / Metafields**：平台特定的自訂欄位（JSON 格式儲存，供未來擴展）

---

## 5. 網站發布（Ghost）

### 5.1 Ghost 連線設定
- 使用者可在專案設定內新增 Ghost 連線
- 需填寫：Ghost Admin API URL、Admin API Key
- 系統提供測試連線功能
- 連線資訊需加密儲存

### 5.2 發布文章
使用者在文章編輯頁可以：
- 選擇發布（Publish）或存為草稿（Draft）到 Ghost
- 設定發布時間（立即 / 排程）
- 預覽發布後的樣式

發布內容包含：
- Markdown 內文（轉換為 Ghost 支援的格式）
- Feature Image
- 內文圖片（上傳到 Ghost）
- Meta Title / Description
- Tags
- Slug
- Excerpt
- Canonical URL

### 5.3 發布狀態管理
每篇文章顯示目前狀態：未發布 / 草稿於網站 / 已發布。

已發布文章顯示：發布時間、目標網址（可點擊開啟）。

使用者可以：
- 重新發布（覆蓋網站上的版本）
- 取消發布（從網站移除）

每次發布動作都有記錄（時間、狀態、錯誤訊息）。

### 5.4 多平台發布架構預留
- 一個專案可連線多個網站（架構層面已支援，UI 層面 Phase 1 僅開放 Ghost）
- 一篇文章可發布到多個已連線的網站（架構預留，Phase 1 單一 Ghost）
- 每個發布目標獨立追蹤狀態
- 發布紀錄顯示每個目標的狀態與網址

---

## 6. Google Search Console 整合

### 6.1 GSC 連線設定
- 專案設定內可透過 OAuth 2.0 授權 Google Search Console
- 使用者從自己擁有權限的 GSC properties 列表中選擇對應此專案的 property
- 一個專案對應一個 GSC property
- 可隨時取消授權或切換 property
- 顯示授權狀態與最後同步時間

### 6.2 資料同步策略
- 系統每日自動同步 GSC 資料
- 每次同步抓取「過去 7 天」的資料（T-1 到 T-7），以 upsert 方式覆蓋既有資料
- 抓取維度：`date`、`page（URL）`、`query`，聚合掉 country 與 device
- 資料欄位：impressions、clicks、CTR、average position

### 6.3 資料成熟度標記
每筆同步資料標記成熟度：
- `preliminary`：T-1 到 T-2，資料可能仍在更新
- `stabilizing`：T-3 到 T-4，可能微幅調整
- `stable`：T-5 以前，基本不變

### 6.4 手動同步
- 使用者可手動觸發即時同步
- 顯示同步進度與完成時間
- 同步失敗時顯示錯誤原因並提供重試

### 6.5 資料保留
- 保留過去 16 個月的歷史資料（對齊 GSC API 上限）
- 超過 16 個月的舊資料自動清理

---

## 7. 文章表現追蹤

### 7.1 單篇文章 Dashboard
每篇已發布文章顯示：
- 總覽指標：曝光數、點擊數、CTR、平均排名
- 可切換時間範圍：7 天 / 28 天 / 3 個月 / 自訂
- 時間序列圖表：上述四個指標的每日趨勢
- Query 列表：該文章獲得曝光的所有 queries，每項顯示：
  - Query 文字
  - 曝光數、點擊數、CTR、平均排名
  - 是否為目標關鍵字（系統自動比對 4.5 的 Focus Keyword 與規劃階段的 LSI keywords）
- 目標關鍵字達成狀況：規劃時設定的關鍵字目前排名與趨勢

### 7.2 資料顯示規則
- `stable` 資料正常顯示
- `preliminary` 與 `stabilizing` 資料顯示時標註「資料仍在更新中」
- 使用者可在設定中選擇是否顯示未穩定資料（預設顯示，但標註）

### 7.3 專案總覽 Dashboard
- 專案所有已發布文章的總曝光、總點擊、平均 CTR、平均排名
- 表現最好的前 10 篇文章
- 表現最差或退步最快的前 10 篇文章
- Pillar 層級聚合表現（整個 Pillar 底下所有文章加總）
- 時間序列：整個專案的流量趨勢

### 7.4 關鍵字機會
- 「意外獲得流量的 Query」：使用者未設為目標、但文章已獲得曝光或排名的關鍵字
- 「接近首頁的 Query」：平均排名 11-20 名的關鍵字
- 「CTR 偏低的 Query」：曝光足夠但 CTR 明顯低於該排名平均的關鍵字
- 每個機會可一鍵轉為「改寫建議」（連到第 8 節）

---

## 8. AI 優化建議

### 8.1 改寫建議觸發條件
系統基於 `stable` 資料自動分析並標記以下文章：
- 發布後 90 天（可設定）仍無曝光或點擊
- 排名原本在首頁、後來掉出的文章
- CTR 明顯低於同排名平均的文章
- 使用者手動標記為 `needs_update` 的文章

所有觸發條件的判斷只使用 `stable` 資料，避免因初步資料誤觸發。

### 8.2 建議內容類型

**Title / Meta 優化**
- 適用：CTR 偏低
- 提供 2-3 個候選 Title 與 Meta Description 版本
- 說明每個版本的優化方向

**內容補強**
- 適用：排名 11-20 名
- 建議擴充的內容段落
- 建議整合「意外獲得流量的 Query」作為新 section 或 H2

**結構調整**
- 建議補強內部連結
- 建議新增 FAQ section
- 建議調整 H 標籤結構

**關鍵字擴展**
- 將意外獲得流量的 Query 整合進現有段落
- 針對新 Query 建議新文章（可能開成新的 Cluster Article）

每個建議說明：
- 觸發原因（基於哪些 GSC 數據）
- 建議具體改什麼
- 預期效果

### 8.3 建議採用流程
- 使用者可接受或忽略每個建議
- 接受後進入編輯模式，系統預先套用變更
- Title / Meta 改寫可直接選擇候選版本
- 內容改寫開啟 AI 改寫介面，使用者可微調後儲存
- 儲存後重新發布（透過第 5 節的發布功能）

### 8.4 建議追蹤
- 系統記錄每個被採用建議的：採用時間、採用前內容快照、採用後內容
- 採用 30 天後自動比對表現變化：
  - 採用前 30 天（`stable` 資料）
  - 採用後 30 天（`stable` 資料）
  - 比較指標：曝光數、點擊數、CTR、平均排名
- 在建議追蹤頁顯示每個採用建議的成效
- 若成效顯著下降，系統提醒使用者考慮還原

---

## 9. 報告與通知

### 9.1 Email 週報 / 月報
使用者可訂閱週報或月報，內容包含：
- 本週 / 本月總體表現變化（基於 stable 資料）
- 表現最好的文章 Top 5
- 需要關注的文章 Top 5
- AI 建議的優化項目清單

可設定發送時間與關閉訂閱。

### 9.2 警示通知
使用者可設定自動通知觸發條件（所有判斷基於 stable 資料）：
- 某篇文章排名大幅下滑（一週內下降超過 N 名，N 可設定）
- 某篇文章流量異常下降（超過 X% 下降，X 可設定）
- 某個目標關鍵字首次進入首頁

通知方式：
- 站內通知
- Email（可選）

---

## 10. 儀表板與列表

### 10.1 專案儀表板
進入專案後顯示：
- Pillar / Cluster 數量統計
- 文章狀態分佈（規劃中 / 草稿 / 已發布）
- 最近編輯的文章
- 最近發布的文章
- GSC 整體表現摘要（若已連線）

### 10.2 文章列表
- 可依狀態、Pillar、建立時間、更新時間篩選與排序
- 顯示每篇文章：標題、目標關鍵字、狀態、最後更新時間、發布狀態、GSC 表現摘要（曝光、點擊、排名）
- 支援批次操作（例如批次刪除、批次標記 needs_update）

---

## 11. 資料匯出

使用者可匯出專案資料：
- Pillar Cluster 規劃（CSV / JSON）
- 文章列表與 metadata（CSV）
- GSC 表現資料（CSV，可選時間範圍，可選只匯出 stable 資料）
- 所有文章原始檔備份（Markdown zip）

---

## 12. 使用者體驗要求

- 所有 AI 生成動作需顯示進度狀態（避免以為卡住）
- 所有重要動作（刪除、發布）需二次確認
- 編輯內容時自動儲存草稿
- 支援繁體中文介面（主要）與英文介面
- RWD：桌面優先，平板可用，手機僅查看不編輯

---

# Phase 2

## 13. WordPress 發布支援

### 13.1 WordPress 連線設定
- 專案設定內可新增 WordPress 連線
- 支援驗證方式：
  - Application Password（推薦，WordPress 5.6+ 內建）
  - REST API + JWT（需網站安裝對應 plugin）
- 需填寫：WordPress Site URL、使用者名稱、Application Password
- 提供測試連線功能
- 一個專案可同時連線多個網站平台（例如同時有 Ghost 和 WordPress）

### 13.2 發布對應
發布至 WordPress 時對應以下欄位：
- 文章內文（Markdown 轉為 WordPress 支援的 HTML 或 Gutenberg blocks）
- Featured Image
- 內文圖片（上傳至 WordPress Media Library）
- Title、Slug、Excerpt
- Meta Title / Description（透過 Yoast SEO 或 Rank Math 欄位，使用者設定時選擇使用哪個 SEO plugin）
- Focus Keyword（對應 Yoast / Rank Math 的 focus keyword 欄位）
- Categories（對應）
- Tags
- Post Format
- Author
- 發布狀態（Draft / Publish / Schedule）

---

## 14. Shopify 發布支援

### 14.1 Shopify 連線設定
- 專案設定內可新增 Shopify 連線
- 使用 Shopify Admin API（需建立 custom app 取得 access token）
- 需填寫：Shopify Store URL、Admin API Access Token
- 提供測試連線功能
- 連線後列出 store 內所有 blogs 供使用者選擇預設 blog

### 14.2 發布對應
發布至 Shopify Blog 時對應以下欄位：
- 文章內文（Markdown 轉為 HTML）
- Featured Image
- 內文圖片（上傳至 Shopify Files）
- Title、Handle、Excerpt（summary_html）
- Meta Title / Description（透過 Shopify SEO 欄位）
- Author
- Tags
- Published Scope
- Blog ID
- Template Suffix
- 發布狀態（published / hidden）

---

## 15. 多平台發布

- 一篇文章可選擇發布到多個已連線的網站
- 每個發布目標獨立追蹤狀態
- 發布紀錄顯示每個目標的狀態與網址
- 文章編輯時可切換預覽不同平台的呈現

---

## 16. 批次規劃與生成

### 16.1 批次大綱生成
- 使用者可在 Pillar 層級選擇「為此 Pillar 底下所有文章生成大綱」
- 系統依序為每篇 Cluster Article 生成大綱
- 顯示批次進度（X / Y 完成）
- 中途可暫停、繼續、取消
- 失敗的文章標記錯誤，可單獨重試

### 16.2 批次訪談
- 系統彙整同一個 Pillar 底下所有文章的訪談問題
- 相似問題自動合併（例如多篇文章都需要「作者相關經驗」時只問一次）
- 使用者一次回答所有問題，答案自動分配回對應文章
- 適合使用者一次準備完一個 Pillar 的素材後批次回答

### 16.3 批次草稿生成
- 訪談完成後可選「批次生成所有草稿」
- 系統依序為每篇文章產出草稿
- 完成後使用者可逐篇進入編輯

---

## 17. 內部連結建議

### 17.1 自動建議
文章編輯時，系統分析當前文章內容並建議可連結到的其他文章（同 Pillar 優先，其次跨 Pillar 相關文章）。每個建議包含：
- 建議錨點文字
- 目標文章
- 建議在哪個段落插入
- 建議理由

### 17.2 一鍵採用
- 使用者可接受或忽略每個建議
- 接受後自動插入 Markdown 連結
- 已採用的連結在後續編輯時不重複建議

### 17.3 Pillar Cluster 連結檢查
- Pillar 層級檢視：顯示 Pillar 與其 Cluster Articles 之間的連結狀態
- 標示尚未互相連結的文章對
- 提醒使用者補強 Pillar ↔ Cluster 之間的 hub-and-spoke 結構

---

## 18. 文章狀態擴展

### 18.1 擴展的狀態流
```
planned → outlined → interviewing → drafted → editing → published → needs_update
```
- `needs_update`：手動標記，表示需要更新
- 每個狀態有對應顏色與圖示

### 18.2 狀態篩選與批次動作
- 文章列表可依狀態批次篩選
- 支援批次狀態變更
