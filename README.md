# 島行 · Taiwan Drive

桌面瀏覽器北海岸自駕原型：白沙灣 ↔ 石門洞，真實 OSM 台 2 雙向有向路線，約 5.41／5.43 km。TypeScript strict、Three.js、Vite、DOM UI、Web Audio，無後端。由本輪從 README 獨立編寫，未繼承舊任務代碼／測試，未使用工作電腦。

## 執行

需要 Node 22.12+（本輪 Node 24.19.0）。

```sh
npm ci
npm run dev
npm test
npm run build
```

正式包在 `dist/`，預設子目錄 `/taiwan-drive/`。要用其他相對前綴，可執行 `npx vite build --base=./`；不要直接以 file:// 打開。`npm run preview` 提供本地檢視，沒有公開部署。

Playwright 使用本環境 `/usr/bin/chromium`、單 worker、SwiftShader。其他設備請改 playwright.config.ts 的 executablePath，或安裝受支援 Chromium。生產測試需另起本地伺服器，把 dist 掛到 `/taiwan-drive/`：

```sh
mkdir -p work/production
ln -s ../../dist work/production/taiwan-drive
python3 -m http.server 5174 --bind 127.0.0.1 --directory work/production
```

保留上述伺服器運行，在另一個終端執行 `npx playwright test`。測試配置會啟動開發伺服器；先完成 `npm run build` 才能驗證正式包。

雲端命令層需要允許網路執行才能 listen localhost；環境 sidecar 代理與 TLS 驗證仍需保留。npm 快取可用 `--cache ./work/npm-cache`，避免寫入不可寫的家目錄。未擴大網域白名單。

## 操作

W 加速，S 煞停後持續按住倒車；A/D 漸進轉向，放開平順回正。W/S 同按只煞停。選單可調轉向與回正速度。Esc 或畫面上的暫停按鈕開啟選單。視窗失焦、頁面隱藏會清除按住狀態並安全暫停，返回後須明確繼續。駕駛只使用鍵盤；滑鼠可點擊選單、設定及視角按鈕，不能轉向、給油、煞車或環顧，不請求 Pointer Lock。

第三人稱／原創簡化駕駛艙可切換。距終點 35m 內停穩後，在暫停選單點擊完成；可切換返程、重開、調音量及匯入／匯出 JSON。localStorage 使用獨立鍵 `island-drive:save:v1`，刷新恢復時暫停。無效舊存檔會停止自動覆寫，原始字串可備份；明確重新開始或成功匯入才恢復自動儲存。320×568 只驗證選單，不宣稱手機駕駛。

車速、位置、車身朝向分開以固定 1/60s 積分，包含軸距、速度限制轉角、抓地限制偏航、坡度、阻力、煞車與倒車。單幀累積上限 0.2s 防失控；超慢 headless 會丟棄模擬時間，報告保留真實 elapsed 和原始 frame times，不當玩家 FPS。遊戲沒有生產自動駕駛。`scripts/drive.mjs` 是測試端僅用真實 page.keyboard 和唯讀 snapshot、搭配普通滑鼠選單點擊的路線追蹤器，不能代表人類手感評價。

## 資料、驗收與交付

- [來源及估算](SOURCES.md)：授權、端點、處理方法與地圖物件來源。
- `source-data/` 保存限定區域 OSM gzip、HGT gzip 與上游高程授權文件。`python3 scripts/map.py` 可離線重建 world.json；`python3 scripts/audit.py` 驗證有向道路與統計。
- `reports/` 跟蹤緊湊驗收文檔、兩向完整原始駕駛 JSON、性能／地圖／高程／擺放記錄。截圖、伺服器日誌與打包產物不進 Git。檢查點匯入截圖不算連續駕駛。
- 開發模式有不可直接寫入的 `window.__drive.snapshot()`，回傳深拷貝；正式 build 完全不暴露該掛鉤。
- 所有視覺資產與聲音為原創程序生成，無外部模型／紋理請求。OSM 與高程均隨靜態包載入。字型使用裝置系統字型。
- 本倉庫保存可復現的源碼、依賴鎖檔與限定區域資料快取；`dist/` 由 `npm run build` 生成，依 `.gitignore` 不跟蹤。未公開部署或建立 PR。

這是可執行的早期原型，首 500m 尚未達精做樣板或 Slow Roads 成熟度。詳見驗收報告的已完成與缺口，不能把單元測試或 headless 截圖視作完整遊戲手感驗收。

## 目前鍵盤版驗收

目前操作與驗證結果見 [鍵盤版報告](reports/KEYBOARD.md)。本版鍵盤去程全新存檔實際行駛5392.569m／561.456s，停穩點擊完成，0次道路邊界碰撞計數／0記錄錯誤，全部src/public/dist前後hash一致；11單元、10瀏覽器通過。返程本輪未重跑整趟，歷史純鼠標證據不算本版。 原存檔仍只有 `version/direction/car`，沒有保存操作方式；維持原有 schema 與無效 raw 保護，不新增版本或遷移分支。地圖、車輛物理參數、美術與來源資料未改。

長途復現：另起 `npm run dev`，執行 `node scripts/drive.mjs`（去程）或 `node scripts/drive-return.mjs`（返程）。每趟新建 BrowserContext，以真實鍵盤事件、唯讀 snapshot 及普通菜單完成；記錄全部 src/public/dist 和實際 driver 的前後哈希。測試控制器透過真實 range 鍵盤操作將打輪／回正設為 0.4，巡航目標 12m/s；這是軟體渲染測試控制條件，不代表默認設定的人類手感驗收。

`reports/ACCEPTANCE.md`、`TESTING.md`、`PERFORMANCE.md`、`driving-outbound.json`、`driving-return.json` 和 `runtime-hashes.json` 屬於歷史提交 `78b66d6` 的雙模式版本。其純鼠標整趟不能作為目前鍵盤版整趟證據；原腳本可在該歷史提交取得。

源碼可從本倉庫取得；靜態版本以 `npm ci`、`npm run build` 重建。完整許可文本在 `licenses/`，來源帳本在 `SOURCES.md`。

高程統計須區分估算中點與實際車道：1.661m／低坡0.450m是中點剖面的最大修整，不代表全車道。去程／返程對各自平滑DEM最大3.274／2.172m（p95 2.132／1.725m），詳見 [完整高程審計](reports/elevation-full-audit.json) 和 [來源帳本](SOURCES.md)。父對話代理先前的隔離靜態包短程UI核驗綁定歷史版本，不是使用者本人試玩。
