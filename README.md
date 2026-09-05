# 🍱 智慧團購 SmartGroup — 辦公室團購合購平台

> **專為辦公室、系所、機關團隊打造的一站式團購合購系統。**  
> 整合便當餐點、下午茶手搖飲料、生活團購商品、AI 菜單辨識、自動逾期停止收單、LINE (CE Notify) 即時推播與 Upstash Redis 雲端永續儲存！

---

## 🌟 核心特色與亮點

### 1. 🛍️ 直覺流暢的點餐體驗
- **同仁免登入快速點餐**：同仁打開網址即可直接點選便當與飲料，自訂甜度、冰塊、加料與規格，一鍵加入購物車。
- **個人專屬 LINE 推播**：訂購同仁可選填個人 CE Notify Token，送出訂單後立即在個人 LINE 收到詳細點餐明細與應付金額。
- **智慧個人標籤與訂單置頂**：表格即時顯示「我」的點餐項目，支援單人累計金額統計，同仁可自由修改或取消自己的訂單。

### 2. ⏰ 嚴格的截止時間與逾期防護機制
- **雙重逾期鎖定（前端 + 後端）**：
  - **前端即時變更**：一旦超過團購設定的最後截止時間（如 `10:30`），購物車確認按鈕立即變灰並顯示 `🚫 已過截止時間停止收單`，頂部狀態標籤自動由綠燈切換為紅色 `● 已截止收單`。
  - **後端安全攔截**：伺服器在接收訂單時再次精準比對台北時間，逾期請求立即回傳拒絕並終止寫入，**杜絕逾期偷下單的情況**！
- **承辦人彈性控制**：承辦人可於後台隨時點擊「提前結單」停止收單，或在需要追加時點擊「恢復上架」並設定新的截止時間。

### 3. ☁️ Upstash Redis 雲端永續資料庫 + 雙向防護
- **主機休眠資料永不遺失**：即使部署在 Render 免費方案容器定時休眠或重開機，所有自訂店家、菜單、負責人名單與歷史訂單均透過 Upstash Redis 雲端完整持久保存。
- **防空覆蓋保護鎖 (Zero-Data Overwrite Guard)**：開機時若雲端已有資料，嚴禁空種子覆蓋雲端，並採用智慧無損合併（Smart Merge）。
- **即時狀態燈號與手動同步**：在「承辦人設定」面板隨時可見 🟢 雲端連線狀態，並提供一鍵「⚡ 同步至雲端」與 JSON 備份/還原。

### 4. 🤖 AI 智慧菜單辨識與商品匯入
- **Gemini 多模態視覺辨識**：拍照或上傳店家菜單圖片，AI 自動識別品項、分類、大中小規格與價格。
- **文字快速貼上解析**：支援複製貼上多行品項，智慧抽取店家電話、地址與價目表。

---

## 🚀 快速開始與本地開發

### 系統環境需求
- **Node.js**: v18+ 或 v20+
- **套件管理工具**: npm, yarn 或 bun

### 1. 複製專案與安裝依賴
```bash
git clone ***.git
cd SmartGroup
npm install
```

### 2. 環境變數設定 (`.env`)
請在專案根目錄建立 `.env` 檔案（或參考 `.env.example`）：
```ini
PORT=3000

# Upstash Redis 雲端資料庫（確保包含 https://，不可帶雙引號）
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
UPSTASH_REDIS_KEY=smartgroup_db

# Gemini AI 圖片辨識金鑰（選填）
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. 啟動開發伺服器
```bash
npm run dev
```
瀏覽器開啟 `http://localhost:3000` 即可開始體驗！

---

## ☁️ Render 雲端部署指南（支援 group1～group5 多組別獨立運行）

如果您有多個組別或部門（例如 `group1`、`group2`、`group3`、`group4`、`group5`），可以將同一份程式碼部署多個 Render 實例，各組享有完全獨立的資料庫！

### 步驟 1：在 Render 建立 Web Service
1. 登入 [Render Dashboard](https://dashboard.render.com/)。
2. 點擊 **New +** ➜ **Web Service**。
3. 連結您的 GitHub 儲存庫（例如 `arsandbox0101-smart/group`）。
4. 設定基本參數：
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`

### 步驟 2：設定各組專屬的環境變數 (Environment Variables)
在 Render 服務頁面點選左側 **Environment**，新增以下鍵值：

| 環境變數名稱 | 範例值 | 說明 |
| :--- | :--- | :--- |
| `UPSTASH_REDIS_REST_URL` | `https://unique-werewolf-112481.upstash.io` | Upstash Redis REST 網址（務必包含 `https://`） |
| `UPSTASH_REDIS_REST_TOKEN` | `gQAAAAAAAbdhAAIgc...` | Upstash Redis REST Token |
| `UPSTASH_REDIS_KEY` | `smartgroup_db_g1` | **多組別關鍵！** 第 1 組填 `smartgroup_db_g1`、第 2 組填 `smartgroup_db_g2`，依此類推，資料各自獨立不互串！ |
| `GEMINI_API_KEY` | `AIzaSy...` | Google Gemini API Key（選填，用於 AI 圖片辨識菜單） |

---

## 🔄 雙 GitHub 儲存庫同步設定指南

本專案支援同時同步推送到以下兩個 GitHub 倉庫：
1. **倉庫 A**: `https://github.com/------`
2. **倉庫 B**: `https://github.com/------`

### 方法一：使用專案內建的一鍵雙推送腳本 (推薦)
在本地終端機執行：
```bash
bash scripts/push-both.sh
```
即可自動依序將最新版本推送至兩個儲存庫！

### 方法二：透過 GitHub Actions 自動鏡像同步
專案已內建 `.github/workflows/sync-repos.yml`。當您推送更新至主倉庫時，GitHub Actions 會自動在背景鏡像同步至第二個儲存庫，確保 Render 隨時抓到最新建置！

---

## 🛠️ 常見問題與排查 (FAQ)

### Q1：畫面右上角出現「⚠️ Upstash 連線失敗 (密鑰或網址異常)」？
1. **檢查網址是否缺少 `https://`**：正確格式必須為 ``。
2. **檢查是否不小心貼入引號**：請移除變數值前後的雙引號 `"`。
3. **檢查 DNS 是否過期**：若更換過 Upstash 資料庫，請至 Upstash 控制台確認最新網址。

### Q2：為什麼截止時間已過同仁卻還能下單？
在本次更新中，已全面實裝**「前端即時攔截 + 後端時間戳二次校驗」**：
- 前端購物車在時間超過截止時間時，按鈕會自動變灰並鎖定；
- 後端 `/api/submit-order` 接收時，若發現目前台北時間已超過截止時間，將立刻拒絕並回傳 400 逾期錯誤。

### Q3：Render 免費版定時休眠，資料會不見嗎？
不會！系統具備**「Upstash 雲端 Redis + 瀏覽器快照救援」雙保險**：
- 每次異動均即時儲存至雲端 Redis。
- 當容器被喚醒時，系統自動自雲端還原所有店家、負責人與訂單，請安心使用！

---

## 📄 開源授權
本專案採用 [MIT License](LICENSE) 不開源授權，僅個人使用。
