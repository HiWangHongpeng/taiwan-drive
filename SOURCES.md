# 地圖與資產來源帳本

畫面升級：`src/surfaces.ts` 的瀝青／地表／混凝土／牆面顆粒、天空雲層、海面法線、樹葉卡片與接觸陰影均為本專案以固定種子的 Canvas 原創生成；這些環境材質仍無外部照片紋理；下述 CarConcept 車輛是本次新增的外部資產。`src/vehicle.ts` 為重新編寫的原創小轎車，窗框、輪圈、車燈、尺寸與材質均為視覺估算。普通檔以彩色貼圖、選擇性環境反射、緩存近景靜態陰影及近遠樹冠細節控制成本；精細檔增加凹凸貼圖和逐幀車影。原始 OSM、world.json、地形高度及植被位置／排除條件未更改。歐卡僅作質感目標，未複製其模型、貼圖或代碼；這些原創程序資產不等同照片實測素材或歐卡級資產。

取得日期：2026-10-22 UTC（檔案來源日期）。本輪從僅有 README 的乾淨倉庫獨立實作，未繼承舊任務源碼或測試；未讀取工作電腦。

| 項目 | 原始來源 | 授權／處理 |
|---|---|---|
| 道路、海岸、建築、林地、沙灘、步道、停車場、溪流、站點 | https://api.openstreetmap.org/api/0.6/map?bbox=121.505,25.265,121.615,25.312 | © OpenStreetMap contributors，ODbL 1.0；https://www.openstreetmap.org/copyright 。僅快取這一有限區域，玩家不連線請求地圖。原始 XML 以 gzip 保存在 source-data/osm.xml.gz；原資料時間戳保留在 XML。派生資料庫 public/data/world.json 遵循 ODbL 1.0，並保留所有 feature 的 type、id、tags、點列及路線 nodeIds、wayIds。物件 URL 模板為 https://www.openstreetmap.org/{type}/{id} 。 |
| 地形 | https://elevation-tiles-prod.s3.amazonaws.com/skadi/N25/N25E121.hgt.gz | Mapzen/Joerd Skadi 聚合高程。大端有號 16 bit，3601² 點，非現場量測。SRTM/GMTED2010 terrain data courtesy of the U.S. Geological Survey；global ETOPO1 terrain data U.S. NOAA。上游 attribution 將這些資料列為 public domain；不得將 Joerd 的程式 MIT 授權誤當所有高程來源授權。已保存上游 attribution、data-sources 文件。單一 HGT 沒有逐像素來源遮罩，不能證實每個點只來自 SRTM。 |
| 高程授權依據 | https://raw.githubusercontent.com/tilezen/joerd/master/docs/attribution.md 、https://raw.githubusercontent.com/tilezen/joerd/master/docs/data-sources.md | 本輪真實 GET 成功；離線副本在 source-data/。來源文件談及境外版權文字，完整保留上游說明；本遊戲採上述 USGS/NOAA 署名，不以高程作真實導航。 |
| 視覺照片參考 | https://commons.wikimedia.org/wiki/File:Baisha_Bay,_New_Taipei_20230525.jpg | 本輪 GET HTML 核實 HC Lin、2023-05-25、CC BY 2.0（https://creativecommons.org/licenses/by/2.0/）。只作描述層次參考，沒有下載圖片或做紋理，不代表最新現場。Python 首次請求 403，curl 明確 User-Agent 後 200，並非 CONNECT 被拒。 |
| 車、方向盤、簡化儀表台、路牌、燈杆、電線杆、護欄、樹木、站牌候車棚 | src/scene.ts、DOM/CSS | 原創轎車、DOM備用駕駛艙與環境設施為本專案程序模型；概念車及3D內飾改用下列CC BY資產。未下載 Kenney。建築輪廓來自 OSM。所有設施的外觀是簡化，非現場復刻。 |
| 引擎與路噪 | src/main.ts Web Audio | 本輪原創連續合成聲；使用者點擊開始後啟用，可調音量至 0。無付費音樂或 API。 |
| 程式依賴 | package-lock.json | Three.js、Vite、TypeScript、Vitest、Playwright 等；保留套件版本與授權，見 THIRD_PARTY.json。 |
| 參考方向 | Slow Roads | 只參考慢速自駕與低多邊形方向；未存取或複製其源碼、模型或紋理。未使用 Google／Apple 圖像或 3D Tiles。 |

## 道路取點與真實長度

選取 OSM `ref=2`、`highway=primary`，依 node ID 建有向圖。`oneway=yes` 只走原節點順序，其他道路可雙向。以白沙灣東側道路位置 (121.5219, 25.2846) 與石門洞站附近 (121.5684, 25.29495) 為取點參考，候選近鄰中選可連通且接近兩點的有向路徑。不是沙灘／停車場內起步，也不開放裝飾支路。

| 方向 | 起點經緯度與節點 | 終點經緯度與節點 | 平面長度 |
|---|---|---|---|
| 白沙灣 → 石門洞 | 121.5220193, 25.2847834；node 1143800095 | 121.5685338, 25.2949431；node 8778586293 | 5410.712 m |
| 石門洞 → 白沙灣 | 121.5684601, 25.2949527；node 8778586292 | 121.5217926, 25.2847084；node 8042448457 | 5431.172 m |

完整道路 ID、149／164 個有向邊與連通性驗證見 reports/route-audit.json。兩條 OSM 分隔車道分別使用真實有向點列；沒有把同一路徑倒放假裝符合一行道。沒有為最初估計的 5.8 km 拉伸或繞路。投影為這個小區域的局部公尺近似（經度比例 100650 m/degree，緯度 111320 m/degree），不是測繪級距離。

## 明確估算與限制

- 每條 OSM 分隔車道半寬 3.8m、路肩、標線均為估算，並非逐段實測。路燈、電線杆、護欄的規則配置為原創場景估算，不是 OSM 實際設施清冊；護欄在來源步道／停車地塊相交處跳過，沒有把缺口當已可駕駛入口。
- 高程為雙線中點估算共用剖面、約 250m DEM 平均，再只作局部約束；沒有全局振幅縮放（係數 1）。估算中點剖面的局部修整相對平滑 DEM 最大 1.661m、p95 0.851m；該中點剖面相對原始 DEM 最大 9.532m、p95 5.205m（包含平滑）。中點剖面原先低於 2% 的段落變更最大 0.450m、p95 0.000048m。兩向實際最大縱坡約 6.173%／6.050%；6% 是軟修整目標，並非實測或用戶硬性上限。道路地形在 9m 內共用剖面，過渡至 48m，估算整平，不是實測道路。
- 海陸以連接的原始 OSM 海岸線建立遮罩，區域外南側封閉；不再用只覆蓋 400m 的海面修整。沙灘約 1.2–3.6m；溪流保留來源中心線，四周估算寬 9m、深 0.55m 淺溝；樣板溪溝鄰近地形加密為 1m 網格，水面寬約 0.96m、貼合實際提交地形三角面，路下隱藏，不是水文或潮汐模擬。
- 建築保留 OSM 平面輪廓，height 或 building:levels 缺值估 6m；地形較陡的輪廓按原多邊形裁成 12m 地基台階，並向下延至渲染地形，避免漂浮。屋頂、窗戶、基座均為原創估算，無現場樣式依據；分塊不會改寫來源輪廓。
- 樹只在 OSM wood／forest／scrub 內，中心離林緣至少 5m，對建築／停車場／沙灘邊緣至少 6m、步道／溪流 8m、站點 10m、道路中心 12m 排除。樹冠尺寸約 3–5m；未知地塊保留簡化底色，不隨機添建築或菜畦。
- 首 500m 路線及周邊 250m（以地物頂點近鄰作統計）實際取得：14 條步道／台階、4 站點、1 停車地塊、3 建築、2 林地、2 溪流、1 沙灘；這個統計框不等同提示中的樣板範圍。另一處白沙灣停車場也保存在完整地圖，未為湊數虛構物件。
- 僅有簡化軟邊界接觸；沒有完整建築／設施剛體碰撞。未取得現場路寬、設施位置或坡度量測。

## 新版處理與核驗

新增 service／residential 等來源道路只作地圖場景，不開放駕駛。1590 個地物平面輪廓已對照原始 OSM，最大投影舍入誤差 0.000705m。1154／1173 個路線點的 XY 與去程凍結版逐點完全相同；新高程不改路線長度或一行道。見 reports/geometry-regression.json、route-audit.json、elevation-revised.json。

台2與真實目的地文字路牌為原創 Canvas 牌面；位置估算。燈杆、橫臂、燈頭使用同一局部座標系。護欄依有來源的 path/access/parking/bus 排除，沒有新增可駕駛入口。植被含實際林地內抖動樹群及低灌層，灌木偏移後重新檢查所有排除條件。靜態幾何及樹木按 512m 空間塊合併／實例化，只有完全落於霧外的塊額外剔除，不改解析度或模擬速度。

德茂站點 3437585110、3437585111 原標籤均為 public_transport=platform，後者 shelter=yes，並非 stop_position。模型因估算路面／棚體原點重疊而向外退讓 1.8m／3.4m；棚體長軸改為沿路，腿距中心線約6.073m（距估算路緣約2.27m），原始 OSM 點／座標不變，詳細對照在 stop-placement.json。其他站點同樣保留來源點並逐項記錄視覺擺放。沒有現場棚體位置測量。

高程統計取樣範圍澄清：上列相對平滑剖面1.661m／0.851m與低坡0.450m／0.000048m是估算中點剖面，不代表每條實際車道。完整逐點只讀審計（elevation-full-audit.json）顯示：去程／返程對原始雙線DEM+0.2m最大9.532／9.176m、p95 5.102／5.293m；對各自約250m平滑DEM最大3.274／2.172m、p95 2.132／1.725m。各自原低於2%坡段變更最大2.264／2.172m、p95 1.726／1.664m，包含共用橫向剖面和局部修整差異，不能說所有低坡車道都幾乎未變。沒有全局振幅縮放。這份後續審計沒有修改遊戲或數據。

## 2026-10-23 高精度車輛試裝

- 資產：CarConcept，模型與貼圖 Eric Chadwick / Darmstadt Graphics Group GmbH（2024）；上游由 Unity Fan 的 public-domain 概念車改編。模型與紋理為 **CC BY 4.0**，Khronos 標識另有條款。已移除帶標識的車牌貼圖與方向盤徽標，保留完整署名／改作說明／許可全文，見 `licenses/carconcept/` 和靜態包 `credits/carconcept.txt`。遊戲幫助內亦有署名、來源、許可與本地全文連結。
- 固定來源：https://github.com/KhronosGroup/glTF-Sample-Assets/tree/15cd02d304e54cb42a4db4eefe719f76190f4b68/Models/CarConcept 。實際GET核對該revision的GLB，11,778,688 bytes、SHA256 `c272098089d78c5cd9fd9f24ff50ee8acf8d932c55f2d55fc10adb6c8998966b`。不是下載站預覽圖、抽取遊戲資產或Google／Apple地圖模型。
- 用 `npm run assets:car` 從固定來源重建，保留原GLB SHA；原始大檔只在忽略的雲端快取，處理後GLB及完整清單入庫。`curl`沿用環境代理和TLS驗證。精確面數、檔案大小、貼圖尺寸、前軸示範轉角、方向盤中性角、座艙估算眼點和前後SHA在 `source-data/carconcept.json`。
- 轉為Y-up／+Z朝前，按實際頂點接地並居中；四輪各分打輪／滾動／固定卡鉗，校正上游前輪及方向盤展示姿態。網格合併並以鎖邊、ratio0.5、error0.001簡化；貼圖最高1024 WebP quality90。保留真實3D內飾，新增本專案原創即時速度／擋位Canvas儀表和方向盤標記，沒有保留裝飾固定0速度貼圖。
- 標準檔使用普通PBR材質，精細檔保留車漆clearcoat；玻璃改透明混合，停用額外整景透射pass。此為估算的遊戲渲染適配，不是原材質的完整物理再現。座艙眼點／75度視角及視覺車高為估算，未改核心車速、軸距或路線物理。
- 此車為虛構概念跑車試裝，不能宣稱臺灣小轎車或現場車款重建。菜單可切回原創轎車，v1駕駛存檔不保存車款。GLB或貼圖載入失敗會回退原車；所有運行資產都從靜態站點本地相對路徑取得。
- Poly Haven 海岸樹、岩石、建築與設施仍只是候選；下載網域不在目前雲端白名單，未擴權或聲稱取得。現有OSM、地形、樹位、排除條件和設施位置均未改，沒有為此次美術試裝新增地塊或裝飾建築。
