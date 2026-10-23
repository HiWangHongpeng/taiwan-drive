# 島行 · Taiwan Drive

桌面瀏覽器北海岸自駕原型：白沙灣 ↔ 石門洞，真實 OSM 台 2 雙向有向路線，約 5.41／5.43 km。TypeScript strict、Three.js、Vite、DOM UI、Web Audio，無後端。本專案最初從 README 獨立編寫，未繼承此前封存任務代碼／測試；後續在同一雲端倉庫持續修改，未使用工作電腦。

[▶ 線上遊玩 島行 Taiwan Drive](https://hiwanghongpeng.github.io/taiwan-drive/)

當前道路修整：可視轉角有界平滑、原創瀝青骨料與微凹凸、連續路緣回饋、標準檔移動陰影刷新，以及林地內植被增密並保留原有遠景。原始地圖／DEM不變；外部樹木與建築模型仍未接入。25項單元、22項單worker瀏覽器及構建通過；全新存檔實際鍵盤片段1175.24m／621.48s、零邊界碰撞／零記錄錯誤、哈希不變。軟體渲染對照更慢，不能說FPS改善；本輪未重跑兩向整趟。實際驗證、估算與性能限制見 [道路修整報告](reports/ROAD-REFINEMENT.md)。

上一輪`7ca50f1`改善車輪接地、固定步長之間的畫面插值，以及山坡、樹冠、瀝青和波形護欄。地圖、原地形網格與核心物理保留。21項單元、20項完整瀏覽器及3項末次針對回歸、5項線上檢查通過；全新存檔連續片段1177.87m／398.44s、0次邊界碰撞／0錯誤、哈希不變。軟體渲染對照沒有證明FPS改善，不能說卡頓已解決。畫面對照、效能限制和驗證見 [接地與環境報告](reports/COMFORT.md)。

上一輪`e06ac44`新增 **高精度概念車試裝**：菜單「車輛外觀」可切換概念車與原創轎車；概念車含可動四輪、真實3D內飾、方向盤及即時速度／擋位儀表。它是免費CC BY 4.0素材的遊戲適配，並非臺灣實際車款。試裝畫面、性能與本輪驗證見 [資產試裝報告](reports/ASSET-TRIAL.md)。樹木／建築外部模型尚未接入。 該輪17項單元、19項本地瀏覽器和5項線上檢查通過；凍結版全新存檔鍵盤片段行駛1175.49m／394.47s，0次邊界碰撞／0錯誤，煞停及刷新暫停通過。該輪資產試裝未重跑兩向整趟，普通筆電性能待實玩。

上一輪 `0ea9546` 已在純色低多邊形原型上加入材質、天空反射、植被細節和陰影。選單新增「省電／標準（一般筆電）／精細（獨立顯卡）」；預設標準，若畫面不順可選省電。歐卡是長期質感方向，目前仍有很大差距，尤其真實感資產、完整3D內飾、道路細節與桌面GPU效能。實際前後畫面與本輪驗證見 [畫質改進報告](reports/VISUALS.md)。上一輪新增畫質版已通過16項單元、17項單worker瀏覽器及5項公開站點檢查；凍結鍵盤去程行駛5388.221m／1136.266s，0次邊界碰撞／0記錄錯誤，源碼資料與構建哈希不變。返程本輪未重跑整趟。普通筆電使用者回報標準檔「基本順暢」，與雲端SwiftShader慢幀資料分開記錄，並非量測FPS。

推送 `main` 後，GitHub Actions 會自動測試、構建並更新網站；等待 [部署流程](https://github.com/HiWangHongpeng/taiwan-drive/actions/workflows/pages.yml) 成功後刷新遊戲即可。駕駛使用 W/S、A/D，Esc 暫停。

啟動時會分別顯示地圖下載與場景建立；地圖下載超過20秒會提示重試。若無法啟用 WebGL 2，請依畫面提示檢查桌面瀏覽器與硬體加速；音效無法啟用時仍可無聲駕駛。載入失敗可點「重新載入」，不會清除存檔。啟動修復與當前驗證範圍見 [啟動報告](reports/STARTUP.md)。

## 執行

需要 Node 22.12+（本輪 Node 24.19.0）。

```sh
npm ci
npm run dev
npm test
npm run build
```

處理後的概念車GLB已隨倉庫提供，啟動不需向第三方下載模型。若要重建該資產，執行 `npm run assets:car`；需要curl以及固定上游來源的公開下載權限，會核對原始SHA256，使用忽略的`work/`快取。來源、改作、模型與貼圖許可見 [SOURCES.md](SOURCES.md) 和 [licenses/carconcept](licenses/carconcept)。

正式包在 `dist/`，預設子目錄 `/taiwan-drive/`。要用其他相對前綴，可執行 `npx vite build --base=./`；不要直接以 file:// 打開。`npm run preview` 提供本地檢視；線上版本由 GitHub Pages 發布。

Playwright 使用本環境 `/usr/bin/chromium`、單 worker、SwiftShader。其他設備請改 playwright.config.ts 的 executablePath，或安裝受支援 Chromium。生產測試需另起本地伺服器，把 dist 掛到 `/taiwan-drive/`：

```sh
mkdir -p work/production
ln -s ../../dist work/production/taiwan-drive
python3 -m http.server 5174 --bind 127.0.0.1 --directory work/production
```

保留上述伺服器運行，在另一個終端執行 `npx playwright test`。測試配置會啟動開發伺服器；先完成 `npm run build` 才能驗證正式包。

雲端命令層需要允許網路執行才能 listen localhost；環境 sidecar 代理與 TLS 驗證仍需保留。npm 快取可用 `--cache ./work/npm-cache`，避免寫入不可寫的家目錄。未擴大網域白名單。

## GitHub Pages 網頁託管

部署流程在 `.github/workflows/pages.yml`：推送 `main` 後以 Node 24、`npm ci`、單元測試和正式構建產生靜態站點，只發布 `dist/` 與來源帳本／依賴許可，不發布原始 OSM／HGT 快取、報告、存檔或私有交付記錄。發布後再以 Chromium 實際打開線上頁面，驗證點擊開始、W鍵加速與啟動故障處理。GitHub Pages 成功啟用和部署後，預期遊玩網址為 https://hiwanghongpeng.github.io/taiwan-drive/ ，不需要本地安裝。Pages 已啟用且首次部署成功；目前部署與線上驗證狀態以 GitHub Actions 為準。

本專案選擇公開倉庫與公開遊戲網頁，可使用 GitHub Free。首次啟用時先在倉庫 Settings → General → Danger Zone 將可見性設為 Public，再到 Settings → Pages → Build and deployment 選擇 **GitHub Actions**；若首次 workflow 已因尚未啟用 Pages 而失敗，啟用後重跑即可。後續 `main` 推送自動更新。網頁、瀏覽器端 JS 與地圖可由訪客下載；不自動購買或變更帳號方案。

## 操作

W 加速，S 煞停後持續按住倒車；A/D 漸進轉向，放開平順回正。W/S 同按只煞停。選單可調轉向與回正速度。Esc 或畫面上的暫停按鈕開啟選單。視窗失焦、頁面隱藏會清除按住狀態並安全暫停，返回後須明確繼續。駕駛只使用鍵盤；滑鼠可點擊選單、設定及視角按鈕，不能轉向、給油、煞車或環顧，不請求 Pointer Lock。

第三人稱／駕駛艙可切換。概念車為3D內飾，原創轎車保留簡化DOM駕駛艙。距終點 35m 內停穩後，在暫停選單點擊完成；可切換返程、重開、調音量及匯入／匯出 JSON。localStorage 使用獨立鍵 `island-drive:save:v1`，刷新恢復時暫停。無效舊存檔會停止自動覆寫，原始字串可備份；明確重新開始或成功匯入才恢復自動儲存。320×568 只驗證選單，不宣稱手機駕駛。

車速、位置、車身朝向分開以固定 1/60s 積分，包含軸距、速度限制轉角、抓地限制偏航、坡度、阻力、煞車與倒車。單幀累積上限 0.2s 防失控；超慢 headless 會丟棄模擬時間，報告保留真實 elapsed 和原始 frame times，不當玩家 FPS。遊戲沒有生產自動駕駛。`scripts/drive.mjs` 是測試端僅用真實 page.keyboard 和唯讀 snapshot、搭配普通滑鼠選單點擊的路線追蹤器，不能代表人類手感評價。

## 資料、驗收與交付

- [來源及估算](SOURCES.md)：授權、端點、處理方法與地圖物件來源。
- `source-data/` 保存限定區域 OSM gzip、HGT gzip 與上游高程授權文件。`python3 scripts/map.py` 可離線重建 world.json；`python3 scripts/audit.py` 驗證有向道路與統計。
- `reports/` 跟蹤緊湊驗收文檔、兩向完整原始駕駛 JSON、性能／地圖／高程／擺放記錄。少量JPEG畫面留作審查；大量中間截圖、伺服器日誌與打包產物不進 Git。檢查點匯入截圖不算連續駕駛。
- 開發模式有不可直接寫入的 `window.__drive.snapshot()`，回傳深拷貝；正式 build 完全不暴露該掛鉤。
- 概念車／內飾採用CC BY 4.0 CarConcept，保留署名與許可；其餘環境資產及聲音為原創程序生成。所有模型／貼圖均隨靜態包提供，玩家無第三方資產請求。OSM 與高程均隨靜態包載入。字型使用裝置系統字型。
- 本倉庫保存可復現的源碼、依賴鎖檔與限定區域資料快取；`dist/` 由 `npm run build` 生成，依 `.gitignore` 不跟蹤。網站透過 GitHub Pages 發布；未建立 PR。

這是可執行的早期原型，首 500m 尚未達精做樣板或 Slow Roads 成熟度。詳見驗收報告的已完成與缺口，不能把單元測試或 headless 截圖視作完整遊戲手感驗收。

## 鍵盤初版驗收（歷史）

目前車輛試裝狀態見 [資產試裝報告](reports/ASSET-TRIAL.md)，原創轎車畫質升級見 [畫質改進報告](reports/VISUALS.md)。以下是 `26cccad` 鍵盤初版的歷史證據，並非新增畫質後的整趟驗證：[鍵盤版報告](reports/KEYBOARD.md)。該版鍵盤去程全新存檔實際行駛5392.569m／561.456s，停穩點擊完成，0次道路邊界碰撞計數／0記錄錯誤，全部src/public/dist前後hash一致；11單元、10瀏覽器通過。返程本輪未重跑整趟，歷史純鼠標證據不算本版。 原存檔仍只有 `version/direction/car`，沒有保存操作方式；維持原有 schema 與無效 raw 保護，不新增版本或遷移分支。地圖、車輛物理參數、美術與來源資料未改。

長途復現：另起 `npm run dev`，執行 `node scripts/drive.mjs`（去程）或 `node scripts/drive-return.mjs`（返程）。每趟新建 BrowserContext，以真實鍵盤事件、唯讀 snapshot 及普通菜單完成；記錄全部 src/public/dist 和實際 driver 的前後哈希。測試控制器透過真實 range 鍵盤操作將打輪／回正設為 0.4，巡航目標 12m/s；這是軟體渲染測試控制條件，不代表默認設定的人類手感驗收。

`reports/ACCEPTANCE.md`、`TESTING.md`、`PERFORMANCE.md`、`driving-outbound.json`、`driving-return.json` 和 `runtime-hashes.json` 屬於歷史提交 `78b66d6` 的雙模式版本。其純鼠標整趟不能作為目前鍵盤版整趟證據；原腳本可在該歷史提交取得。

源碼可從本倉庫取得；靜態版本以 `npm ci`、`npm run build` 重建。完整許可文本在 `licenses/`，來源帳本在 `SOURCES.md`。

高程統計須區分估算中點與實際車道：1.661m／低坡0.450m是中點剖面的最大修整，不代表全車道。去程／返程對各自平滑DEM最大3.274／2.172m（p95 2.132／1.725m），詳見 [完整高程審計](reports/elevation-full-audit.json) 和 [來源帳本](SOURCES.md)。父對話代理先前的隔離靜態包短程UI核驗綁定歷史版本，不是使用者本人試玩。
