# 啟動故障修復

使用者回報頂部停在「正在載入北海岸…」、點開始無反應，隨後在本修復發布前再次回報「能打開了」。這段載入文字只證明導航尚未更新；未取得該瀏覽器的中央狀態文字與錯誤，不能斷言原根因，也不能將恢復歸功於尚未發布的修改。

## 已核實

- 原部署 `c6dafa6` 的 Actions 已成功。實際下載其 Pages artifact，比對 index.html、JS、CSS 和 world.json，均與本地正式包逐位元一致；地圖未漏包。world.json 為1871008位元組，SHA256 `bb67e6cf975d0a29ca6856d6ac23c474b793747e7db4bea676b40ea8774a884d`。
- 原正式包在本地 Chromium 正常情況約6–7秒就緒；點開始後真實W鍵能加速。以瀏覽器測試替身移除 AudioContext 時，確實出現「AudioContext is not a constructor」、菜單仍開、車速0。這是獨立復現的缺陷，不代表已確認使用者也遇到同一根因。
- 雲端VM的網路政策不允許直接訪問遊戲的github.io網域；沒有擴大權限或繞過代理。線上驗證由本倉庫的GitHub Actions部署工作流執行，與VM本地正式包測試分開記錄。

## 修改

- 音效建立或resume失敗時提示無聲駕駛，不再阻擋開始；靜音設定不必建立音頻裝置。
- 地圖下載連同回應本體使用20秒截止，檢查HTTP狀態、JSON和必要結構；錯誤不再只停留在泛稱載入。
- 顯示下載／建立場景階段，留一幀讓場景建立提示可先繪出；場景首次實際渲染成功才啟用開始。導航就緒時立即更新。
- 載入失敗顯示原因；WebGL啟用失敗另給WebGL 2與硬體加速提示，提供重新載入。重試不清除存檔，無效raw保護維持。
- 正式包瀏覽器測試增加菜單確實關閉、導航就緒、真實W鍵使速度增加的斷言。部署後以同樣測試檢查實際線上站點；CI使用Playwright配套Chromium，本地維持系統Chromium154／SwiftShader、單worker。

## 驗證範圍

啟動針對性瀏覽器測試5項已通過：正常子目錄正式包、音效constructor失敗、音效resume失敗、HTTP503後重載且保留raw、無WebGL的明確提示。故障場景使用明確標記的瀏覽器替身／請求攔截，正常路徑使用實際地圖與渲染。

完整回歸：`npm test` 14項通過；`npm run build`（strict TypeScript + Vite）通過；`npx playwright test` 單worker14項通過，184.729秒，無失敗、跳過或flaky。實際查看正式第三人稱起步、1440×900駕駛舱和320×568選單截圖，未見新的遮擋或溢出。保留JS大於500kB的構建警告。發布後的線上5項檢查由 [Pages workflow](https://github.com/HiWangHongpeng/taiwan-drive/actions/workflows/pages.yml) 提供獨立執行結果。

本次未重新執行整趟；歷史鍵盤旅程仍綁定26cccad。地圖、車輛物理、鍵盤處理、來源資料、美術與場景生成算法未改。真實桌面GPU效能與使用者瀏覽器的原始故障原因仍待核實。
