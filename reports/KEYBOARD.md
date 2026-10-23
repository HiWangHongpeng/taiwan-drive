# 鍵盤駕駛版本驗收

本輪只移除鼠標駕駛，保留普通菜單點擊。W/S 加速與煞停後倒車、W/S 同按只煞停、A/D 漸進打輪／鬆鍵回正、Esc 暫停和失焦／隱藏頁面清鍵暫停仍保留。視角按鈕切換第三人稱與駕駛舱；移除相對鼠標轉向、左右鍵踏板、中鍵暫停／環顧、Pointer Lock／fallback、模式選擇與死代碼。地圖與物理參數未改。

存檔保持原 v1 schema 和嚴格校驗。舊版只存 version/direction/car，未存 controls.mode；有效舊存檔不需遷移，無效 raw 的自動覆寫隔離仍保留。

## 真實執行的回歸

- `npm test`：11項、2個檔案通過（約0.959s）。包含漸進鍵盤打輪、相反方向同按、可調回正與清鍵，以及既有物理／存檔／地圖測試。
- `npm run build`：TypeScript strict、Vite通過；JS 550.64kB／gzip145.86kB。保留大於500kB chunk警告，未調整畫質或模擬參數。
- `npx playwright test`：單worker，10項全部通過，158.253s，無跳過／flaky。包括真實W/S加速刹停倒車、W+S同按刹停、A/D道路屏幕投影和輪輻左右方向、鬆鍵回正、Esc清鍵、菜單／視角／返程／終點點擊、舊v1保存與刷新、有效匯出／無效匯入、無效raw跨自動保存週期與刷新仍保留、畫布鼠標左右／中鍵與移動不供給任何駕駛輸入，以及320px和1440×900／960×600 HUD。
- 正式 `/taiwan-drive/` 包實際載入，地圖字節與public一致，沒有debug hook／腳本或資源錯誤。
- 實際打開查看目前桌面菜單、1440×900及960×600駕駛舱、左右轉向、320×568展開說明菜單；未見模式殘留、HUD遮擋或水平溢出。窄屏菜單可滾動，不宣稱手機駕駛。

瀏覽器為系統Chromium154／SwiftShader。失焦與hidden測試先真實切新標籤／CDP lifecycle，該headless環境均未觸發安全暫停；測試隨後以明確DOM blur事件／document.hidden測試替身觸發visibilitychange，驗證按住W/A或S/D時事件處理器會清鍵並暫停。結果見keyboard-focus.json。這是事件處理回歸，不能冒稱本版所有OS原生焦點已驗證；歷史版父對話代理的前台Chrome短程觀察只屬歷史版。

物理積分、spawn、finish、validate部分與78b66d6逐字節一致；public/source-data、geography/facilities亦未改。移除的只是駕駛輸入分支、原環顧數值與其相機項、模式UI和相關CSS。設置保留打輪／回正／音量。

## 凍結與整趟

去程（白沙灣→石門洞）已完成。全新存檔連續實際行駛 **5392.569m**，沿線進度 5388.070／5410.712m，真實 elapsed **561.456s**；停穩後 Esc 開菜單並點擊完成，UI與readonly completed均確認。終速0.000000m/s，距終點沿線約22.642m。道路軟邊界碰撞計數0、記錄錯誤0；不代表完整場景剛體碰撞驗證。

完整原始JSON見 [driving-keyboard-outbound.json](driving-keyboard-outbound.json)，包括2732個原始幀（全部保留）與全部文件前後hash。幀間隔中位199.900ms、p95（nearest rank）399.900ms、最大4616.482ms。活動牆鐘561.161s、固定模擬468.433s、丟棄模擬時間92.726s；不能稱流暢或當玩家FPS。真實500m、900m與完成畫面已保存並實際查看。

全部src/public/dist、實際driver與配置前後hash均一致，與runtime-keyboard-hashes.json逐文件核對。另一向本輪**沒有重跑完整旅程**；只有返程選單／起步瀏覽器回歸與雙向路線單元。舊版純鼠標兩向整趟不算本版結果。

凍結清單見runtime-keyboard-hashes.json；每趟driver還記錄全部src/public/dist、入口／鎖檔／Vite配置及實際driver的前後哈希。使用全新BrowserContext（cookies/origins為空）、真實elapsed time、page.keyboard W/S/A/D及Esc、普通鼠標菜單點擊、唯讀snapshot。沒有匯入、傳送、寫Game或生產自動駕駛。控制器只在測試端追路，不代表人類手感。

測試端經真實range鍵盤操作把打輪／回正設為0.4（遊戲默認仍為1.4／1.8），巡航目標12m/s；這是軟體渲染測試控制條件。完成需先停穩、Esc暫停、點完成，再同時核對UI與唯讀completed=true，否則不計成功。全部原始幀保留，不過濾慢幀、不換算玩家FPS。

歷史雙模式／純鼠標證據另列於ACCEPTANCE.md、TESTING.md、PERFORMANCE.md和driving-outbound/return.json；綁定78b66d6，不計作本版整趟。

## 尚待驗證

桌面硬體GPU、默認鍵盤速度設定下的人類手感／音質，以及更多OS的原生失焦／隱藏和按住輸入組合。本版返程未重跑整趟，不以歷史純鼠標整趟補數。

## 首次鍵盤去程的環境中斷

首趟在執行器連線失效後中斷；恢復時原driver、Chromium和服務器進程均不存在，原exec session無法恢復。最後已落盤記錄為211.231s、實際行駛1726.608m、零碰撞計數，沒有完成，不能補算全程。進程丟失前未flush的內存原始幀無法恢復，沒有重造；保留的逐15s進度與原因見keyboard-outbound-interrupted.json。恢復後全部凍結運行／driver哈希仍一致；後續另起全新Context，同版重試，不修改src/public/dist/driver。

完成報告時間：2026-10-23T11:20:15.808504+08:00。
