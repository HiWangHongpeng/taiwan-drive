# 新版回歸執行記錄

本頁記錄真實執行結果；舊去程報告不代表新版。機器為雲端 Node24.19.0/npm11.9.0/Python3.12.14、系統Chromium154、SwiftShader；官方computer/browser工具不可用。全程Playwright workers=1。

- npm test：11項通過，2個檔案。凍結前完整執行啟動於2026-10-22 16:24:41 UTC；約1.04s。涵蓋有向雙向路線、模型積分／轉向與隔離、煞停倒車／雙鍵、暫停清鍵、存檔校驗、完成區、林地排除、燈杆不同朝向連接、建築／溪流地形處理、海陸遮罩、候車棚腳距。
- npm run build：TypeScript strict與Vite成功。552.54KB minified JS、146.55KB gzip；大於500KB chunk警告保留，未壓掉。最後正式檔案集合見runtime-hashes.json。
- npx playwright test：7項完整通過；原始測試輸出另行留存；用例在 tests/browser/，可按README重新執行。包括真實鍵盤／鼠標移動、輸入隔離、暫停清鍵、有效／無效匯入與匯出、刷新暫停、終點中鍵與完成按鈕、320菜單、1440/960駕駛舱HUD間距、正式/taiwan-drive/生產包無hook及地圖字節完全一致。
- 額外真實執行 steering.spec.ts：1項重跑通過（30.4s），在駕駛舱下追加輪輻CSS方向與可見畫面。這是重跑同一用例，不湊數為第8項。A/D與鼠標左／右，前方道路屏幕投影向預期的反側偏移；左右輪標旋轉方向一致。測試同時核對屏幕投影、輪輻CSS方向並輸出截圖。
- npx tsc --noEmit：補核對最後測試檔編輯後成功（無錯誤輸出）。沒有在長途期間重建／熱更新src或public。

已保留失敗證據：舊版只用yaw數值測試誤判左右；新增屏幕投影後實際失敗，接著修正車輛與前輪符號、測試端控制公式。早期低採樣地形造成浮置與溪溝開孔，也經逐張查看後改正，沒有把舊圖當本版。

檢查點圖片採有效JSON匯入，方法見scripts/checkpoints.mjs，不是長途證據。正式長途另用全新BrowserContext、真實elapsed和鼠標事件，唯讀snapshot，不匯入／寫Game／傳送。前後hash覆蓋全部src/public與實際driver，另比對dist冻结清單。兩向各自完成UI後才計completed=true。

Git交付前文檔／忽略規則整理後，2026-10-22 17:07:22 UTC再次實跑npm test（11項、1.09s）及npm run build（成功、保留552.54KB警告）。src/public未改，重建dist全部字節仍與runtime-hashes.json一致。沒有重跑或冒用新的整趟／瀏覽器結果。
