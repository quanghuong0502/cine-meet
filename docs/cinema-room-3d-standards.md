# Tiêu chuẩn Phòng Chiếu Thực Tế, Chấm Điểm Ghế & Mô Hình 3D (Seatmate)

Tài liệu tổng hợp toàn bộ kết quả nghiên cứu tiêu chuẩn rạp chiếu phim Việt Nam & quốc tế, các case thực tế tại rạp Việt Nam, kiến trúc đồng nhất giữa 2D / Chấm điểm (Heatmap) / 3D, các ràng buộc kỹ thuật iPhone Standalone PWA và các quyết định sản phẩm đã chốt.

---

## 1. Các case thực tế tại rạp chiếu phim Việt Nam

Tổng hợp các trường hợp thường gặp ở CGV, Lotte Cinema, Galaxy, BHD Star, Beta, Cinestar, Trung tâm Chiếu phim Quốc gia (NCC):

1. **Bỏ chữ `I` và `O` khi đánh nhãn hàng (`skipRowLetters`)**: Tránh nhầm với số `1` và `0` trên vé/sơ đồ (A..H, J..N, P..Z).
2. **Đánh thứ tự ngược**:
   - Đánh chữ hàng từ sau ra trước (`rowLabelOrder: "back_to_front"`).
   - Đánh số cột từ phải sang trái (`colNumbering: "right_to_left"`).
3. **Lối đi dọc sát tường (`sideAisles: ("left" | "right")[]`)**:
   - Phổ biến ở phòng nhỏ/vừa: chỉ có **1 lối đi dọc sát tường phải hoặc trái**, hoặc **2 lối đi dọc ở hai bên tường** (không có lối đi giữa).
   - **Tác động vật lý**: Lối đi sát tường nằm **trong** bề rộng tổng phòng chiếu (`[0 .. widthM]`). Khi phòng chỉ bật 1 bên (vd. chỉ tường phải), màn hình vẫn căn giữa toàn phòng (50%) còn khối ghế bị đẩy lệch về phía tường kín bên trái → điểm số ghế, Heatmap và góc nhìn 3D đều phản ánh chính xác độ lệch này.
4. **Hàng chạy liền qua lối đi dọc (`aisleFills`)**:
   - Điển hình là **hàng cuối Sweetbox** ở CGV/Lotte/BHD chạy kín ngang cả lối đi dọc của các hàng phía trước (A..I có lối đi dọc, riêng hàng J kê 1–3 ghế xuyên qua lối đi).
   - Trong 2D: ẩn nét đứt lối đi dọc đi qua hàng đã lấp; lưu `partialVerticalAisles` trong `LayoutGeometry`.
   - Trong 3D & chấm điểm: lối đi vẫn giữ bề rộng tối thiểu `max(aisleWidthM, fillSeats * seatPitchM)`; bậc thang trung gian và đèn LED lối đi **chỉ vẽ ở các hàng trống (A..I)**, tự ẩn ở hàng đã kê ghế (J).
5. **Lối đi ngang giữa phòng (`horizontalAfterRows`)**:
   - Chia khu vực phía trước và khu vực bậc cao/VIP phía sau (vd. sau hàng D hoặc E).
   - **Quyết định UI**: Không dựng thanh chắn/lan can sau lối đi ngang trong 3D.
6. **Phòng ghế đặc thù tại Việt Nam**:
   - **Sweetbox (ghế đôi, `span: 2`)**: Băng ghế liền không tay vịn giữa, có vách ngăn riêng tư cao 2 bên (`1.12 m`), thường ở hàng cuối.
   - **Gold Class / Cine de Chef / Recliner**: Ghế ngả sâu (`seatRecline: "deep"`), khoảng cách hàng rộng (`rowPitch: "vip"` = `1.45 m`), lưng cao có gác chân, thường đi kèm **màn treo cao (`screenMount: "high"` = `2.25 m`) + úp nghiêng về phía khán giả (`screenTilt: "tilted"` = `10°`)** để ngả lưng vẫn xem trọn khung hình mà không mỏi cổ.
   - **L'Amour (giường nằm)**: Giường đôi rộng ~`1.6 m`, khoảng cách hàng `rowPitch: "bed"` = `1.70 m`, màn treo cao & úp nghiêng `10°`.
   - **IMAX / PLF**: Ví dụ CGV Landmark 81 IMAX kích thước thực `22.06 m × 12.415 m` (~`1.78–1.90:1`, dùng preset `standard: 1.85`), IMAX GT dùng `square: 1.43`, đa số phòng thương mại VN dùng màn `scope: 2.39` (mặc định).
7. **Xếp ghế so le (`seatStagger: "staggered"`)**: Hàng chẵn/lẻ lệch nửa bề rộng ghế (`±0.25 × seatPitchM`) để nhìn lọt khe giữa 2 đầu người phía trước (TCVN 5577 giảm C-value từ `0.12 m` xuống `~0.06 m`, hệ số giảm mất điểm tầm nhìn `0.35`).
8. **Độ cao treo màn ở rạp TTTM Việt Nam (BHD Star Discovery, CGV Vincom, Lotte, Beta)**: Mép dưới màn thường cao `1.70–2.25 m` (gần hoặc vượt đỉnh cửa thoát hiểm `2.10 m`), đảm bảo đáy tia chiếu cách sàn `≥ 1.9 m` (TCVN 5577) và tránh đầu hàng A che phụ đề. Hàng ghế đầu **A luôn nằm sát mặt sàn trước (`0.00 m`)** để cao độ treo màn phản ánh đúng thực tế.

---

## 2. Bảng kích thước vật lý chuẩn hóa từ tiêu chuẩn thực tế

Mọi hằng số mặc định trong [`src/lib/seat-layout/dimensions.ts`](../src/lib/seat-layout/dimensions.ts) và [`src/lib/seat-layout/physical.ts`](../src/lib/seat-layout/physical.ts) đều suy trực tiếp từ tiêu chuẩn xây dựng & thiết kế rạp:

| Thông số | Mặc định | Giới hạn | Nguồn tiêu chuẩn |
| --- | --- | --- | --- |
| **Bề rộng ghế (tâm–tâm)** `seatPitchM` | `0.55 m` | `0.40–1.20 m` | Ferco / Figueras / Neufert (`0.53–0.58 m`) |
| **Chiều cao mỗi bậc thang** `stepHeightM` | `0.15 m` | `0.05–0.40 m` | QCVN 06 (`≤ 0.22 m`), IBC (`≤ 0.178 m`), Neufert (`≤ 0.16 m`) |
| **Bề rộng lối đi dọc / sát tường** `aisleWidthM` | `1.20 m` | `0.50–3.00 m` | **QCVN 06:2022/BXD** (`≥ 1.20 m` khi > 50 người), Neufert & IBC (`1.20 m`) |
| **Bề rộng lối đi ngang** `horizontalAisleWidthM` | `1.20 m` (bản chiếu nghỉ; `~1.40 m` thông thủy từ lưng ghế trước) | `0.60–3.50 m` | Neufert & IBC (`1.20–1.50 m`), QCVN 06 (`≥ 1.20 m`) |
| **Khoảng cách giữa các hàng** `rowPitch` | `tight: 0.95 m` · `standard: 1.10 m` · `vip: 1.45 m` · `bed: 1.70 m` | `0.75–2.50 m` | **TCVN 5577:2012** (`0.90–1.05 m`), multiplex (`1.05–1.15 m`), recliner (`1.40–1.60 m`), bed (`1.60–1.80 m`) |
| **Độ cao treo màn hình (mép dưới → sàn)** `screenMount` | `low: 1.20 m` · `mid: 1.70 m` · `high: 2.25 m` | `0.20–4.00 m` | **UNIC Handbook / SMPTE EG 18 / TCVN 5577** (`1.20 m` tối thiểu/IMAX, `1.50–1.80 m` multiplex chuẩn, `1.80–2.40 m` rạp TTTM VN như BHD/CGV/Lotte) |
| **Độ nghiêng màn hình (mép trên úp về phía ghế)** `screenTilt` | `flat: 0°` · `slight: 5°` · `tilted: 10°` | — | **Harkness / UNIC** (`2°–5°` rạp thường/treo cao, `8°–10°` phòng ghế ngả/giường nằm trong giới hạn lens-shift DCI) |
| **Tỉ lệ màn hình** `screenAspect` | `scope: 2.39` · `standard: 1.85` · `square: 1.43` | `1.10–3.50` | SMPTE Scope (`2.39:1`), Flat (`1.85:1`), IMAX GT (`1.43:1`) |
| **Khoảng cách màn → hàng đầu** `screenDistance` | `near: max(2.5 m, 0.50×W)` · `medium: max(3.8 m, 0.68×W)` · `far: max(5.2 m, 0.88×W)` | ratio `0.25–2.0`, min `1.0–20.0 m` | SMPTE / THX (`0.50–0.88 × W`) |
| **Khoảng hở tường hông (tiêu âm)** | `0.25 m` (có sideAisle bên đó) · `0.35 m` (tường kín bên đối diện) · `0.45 m` (phòng có lối đi giữa) · `aisleWidthM + 0.15` (phòng không khai báo lối đi) | — | Neufert / Dolby (`~0.45 m` / 1.5 ft cho vách tiêu âm & loa) |
| **Hành lang sau hàng cuối** `rearMarginM` | `max(aisleWidthM, 1.20 m)` nếu có cửa sau · `0.55 m` nếu không có cửa sau | — | QCVN 06 (`≥ 1.20 m` lối thoát sau), Neufert (`0.45–0.50 m` đệm sau lưng hàng cuối) |
| **Chiều cao trần** `ceilingY` | `max(maxFloorY + 3.0 m, screenBottom + screenHeight + 1.0 m)` | — | **TCVN 5577:2012** (`C1 ≥ 3.0 m` thông thủy trên hàng cuối) |
| **Cửa thoát hiểm (EXIT)** | Rộng `1.30 m` × Cao `2.10 m` | — | **QCVN 06:2022/BXD** (`≥ 1.20 m × 1.90 m`), TCVN 5577 (`≥ 2.0 m`) |
| **Ô kính phòng chiếu (projection port)** | Cao `max(maxFloorY + 2.25 m, min(ceilingY - 0.65 m, tâm màn))` | — | TCVN 5577 (`X ≥ 1.9 m` từ sàn tới đáy tia chiếu), SMPTE |
| **Tầm mắt người ngồi** | Chuẩn `170 cm` đứng → `1.10 m` ngồi thư giãn (`+0.44 × Δheight`, ISO 7250 đệm lún `~41–42 cm` + chùng người rạp), đỉnh đầu `+0.12 m` trên mắt (`1.22 m` dựng thẳng, `1.19 m` ngả nhẹ, `1.14 m` ngả sâu), đầu `15.4 × 21.4 × 18.6 cm`, dịch về sau `+0.04 m` | — | **ISO 7250-1**, **TCVN 5577:2012** (`C = 0.12 m`), **Neufert** (`1.12 m`) |
| **Độ ngả lưng ghế** `seatRecline` | `upright: 8°` (`+0°` cổ, `-0.00 m` mắt) · `slight: 16°` (`+4°` cổ, `-0.03 m` mắt) · `deep: 28°` (`+14°` cổ, `-0.08 m` mắt) | — | Động học cột sống ngả + ergonomics ghế rạp |
| **Bán kính nhiễu cửa ra vào** `ENTRANCE_REACH` | `3.0 m` (đo theo mét thực) | — | Nhiễu ánh sáng & lưu lượng người ra vào cửa |
| **Kích thước ghế 3D** | Đệm ngồi `0.44–0.46 m`, lưng ghế high-back hiện đại: Thường `~1.02 m`, VIP `~1.06 m`, Recliner `~1.08–1.10 m`, Bed `~0.83 m`, vách Sweetbox `1.12 m`, bề rộng `0.98 × seatPitchM` (tay vịn chung sát nhau) | — | **Ferco / Figueras** high-back (`1000–1100 mm`) & CGV Sweetbox / L'Amour |

### Cấu hình 2 tầng (System Defaults + Overrides)
- **Tầng 1 (`CinemaDimensionDefaults`)**: Lưu trong `SystemSetting` với key `"cinemaDimensions"` (service: `src/services/cinema-dimensions.service.ts`), chỉnh tại trang Admin `/admin/settings/cinema-dimensions`. Khi lưu tự động ghi audit log và chạy `rescoreAllLayouts()` tính lại điểm & Heatmap toàn bộ phòng đã lưu.
- **Tương thích ngược**: Mọi trường mới thêm vào `cinemaDimensionDefaultsSchema` (như `horizontalAisleWidthM`) **bắt buộc có `.default(...)`** để dữ liệu JSON cũ lưu trong MongoDB không bị lỗi parse.
- **Tầng 2 (`RoomDimensionOverrides`)**: Hỗ trợ trong schema & `resolveRoomDimensions` nhưng **ẩn khỏi form Admin** theo quyết định người dùng.

---

## 3. Kiến trúc nguồn chân lý duy nhất (0 lệch giữa 2D / Chấm điểm / 3D)

```
LayoutConfig ──▶ generateGrid() (đơn vị 2D gọn cho SVG mobile, AISLE_SIZE = 0.8)
                       │
                       ▼ LayoutGeometry (+ sideAisles, partialVerticalAisles, rowSlots)
                       │
              buildPhysicalRoom()  [src/lib/seat-layout/physical.ts]
              (Piecewise-linear X/Z → mét thực chuẩn QCVN/TCVN/Neufert)
                  ┌────┴────┐
                  ▼         ▼
        seat-score.ts     scene.ts ──▶ room-3d-scene.ts (Three.js)
        (Điểm & Heatmap)  (Pure 3D)    (WebGL Renderer)
```

### Nguyên tắc bắt buộc khi sửa tọa độ hoặc kích thước:
1. **KHÔNG bao giờ tự nhân `seat.x * seatPitchM` hay `seat.y * rowPitchM` rời rạc** trong `seat-score.ts` hoặc `scene.ts`. Mọi chuyển đổi tọa độ, kích thước màn hình, khoảng cách hàng đầu, độ nghiêng màn hình, lối đi dọc/ngang/sát tường, lề tường và vị trí cửa **phải đi qua `buildPhysicalRoom()`** trong [`src/lib/seat-layout/physical.ts`](../src/lib/seat-layout/physical.ts).
2. **Mốc sàn hàng A (`floorHeight`)**: Hàng đầu **A (`rowIndex = 0`) luôn đứng sát mặt sàn trước (`0.00 m`)** ngay cả khi `stadiumFromRow = 1` (bậc nâng bắt đầu từ hàng B trở về sau; các phòng cũ `stadiumFromRow >= 2` giữ phẳng đến trước hàng `stadiumFromRow`). Nhờ đó `screenMount` và cửa thoát hiểm trước (`floorY = 0`) khớp đúng cao độ thực tế so với hàng ghế đầu.
3. **Hình học màn hình nghiêng (`screen.tilt`)**: Xoay quanh tâm quang học `centerZ = 0` (`bottomY = screenBottom`, `bottomZ = -(H/2)·sin θ`, `topY = screenBottom + H·cos θ`, `topZ = +(H/2)·sin θ`, `frontWallZ = min(-0.20, bottomZ - 0.20)`) để giữ nguyên khoảng cách hàng đầu (`screenDistance`) và cao độ mép dưới (`screenMount`). Cả `seat-score.ts` và `scene.ts` cùng áp dụng `screenTiltComfortDeg(tiltDeg, verticalCenterDeg)` khi người xem ngước lên màn nghiêng úp, và 3D dựng thêm khối hộp gắn tường vát nghiêng (`buildScreenHousingGeometry`) nối kín về `frontWallZ`.
4. `seat-score.ts` và `scene.ts` luôn khớp nhau tuyệt đối về `screen.*`, `seat.x`, `seat.z`, `floorY` (riêng `eyeOf` trong 3D dịch `z + 0.04 m` để camera nằm tự nhiên ở vị trí mắt người ngồi tựa lưng).
5. Sàn 3D dùng `floorSlabs` liên tục: mỗi hàng kéo dài tới sát mặt đứng hàng kế tiếp (bắc cầu liền mạch qua `horizontalAisles`), hàng cuối kéo sát `backWallZ` để cửa sau mở trên mặt sàn đúng cao độ `maxFloorY`.
6. Khi `stepsPerRow >= 2` (chênh `30–60 cm`), `scene.ts` tự sinh bậc thang trung gian (`aisleSteps`, cao `~0.15 m`, mặt bậc `~0.26–0.28 m`) và đèn LED bậc (`aisleLights`) chỉ trên các hàng trống của lối đi dọc/sát tường.
7. **Người ngồi trước giải phẫu (`buildAudienceGeometry`)**: Hông/đùi cố định trên đệm lún (`0.42 m`), cột sống + cổ (`~7.5 cm`) + đầu chạy đồng trục theo `reclineDeg`, đỉnh đầu khớp chính xác `1.22 m - eyeDropM` (KHÔNG trừ trùng `eyeDropM` trong `updateAudience()`). Ghế đôi (`span === 2`) đặt **2 bóng người** tại `seat.x ± seatPitchM / 2`; ghế giường (`style === "bed"`) hạ thêm `-0.16 m`.

---

## 4. Kiến trúc 3D & Ràng buộc bắt buộc cho iPhone Standalone PWA (WebGL / Three.js)

Mọi thay đổi ở `room-3d-scene.ts`, `room-3d-view.tsx` và `perspective-seat-picker.tsx` phải tuân thủ tuyệt đối:
- **Lazy-load & WebGLRenderer**: Vanilla `three` (`0.187.0` pinned), lazy-load 2 lớp (`next/dynamic({ ssr: false })` + `import()` trong `useEffect`); `antialias: false`, `powerPreference: "default"`, `dpr <= 2`, `ACESFilmicToneMapping`, `SRGBColorSpace`, `touch-action: none`, `EDGE_GUARD_PX = 20` (giữ vuốt back cạnh trái iOS).
- **Render theo nhu cầu (on-demand rendering)**: KHÔNG chạy vòng lặp `requestAnimationFrame` liên tục; rAF chỉ chạy khi người dùng đang kéo/orbit/pinch, trong camera flight parabolic `CubicBezierCurve3` (`480 ms`) hoặc dimmer đèn rạp (`340 ms`), xong là dừng ngay.
- **Vòng đời GPU**: Xử lý đầy đủ `webglcontextlost`, `webglcontextrestored`, `document.hidden`, giải phóng toàn bộ geometry/material/texture và gọi `forceContextLoss()` khi `dispose()`. Chuyển đổi nội tuyến ↔ toàn màn hình (`100dvh`) phải dùng `createPortal(..., document.body)` + `mountTo()` reparent canvas trực tiếp để không mất GPU context và không bị ảnh hưởng bởi `transform-gpu` của khung sticky.
- **Tối ưu draw calls & chất liệu**: Gom lưới bằng `InstancedMesh` (ghế đa vật liệu tách `fabricMesh` bo tròn có baked vertical AO + `frameMesh` chân/tay vịn tối, `floorSlabs`, `aisleSteps`, `aisleLights`, đèn trần, đèn hắt tường + glow, bóng người, chấm đánh dấu). Texture sinh procedural bằng `<canvas>` (thảm, vách tiêu âm, trần ô cờ, biển EXIT, khung phim 1024×512 + phụ đề mẫu), tia chiếu Fresnel `ShaderMaterial`, không dùng SSAO/Bloom/video texture. `cssToHex` hỗ trợ đầy đủ `oklch`/`oklab`/`color(srgb ...)` cho Heatmap.
- **Camera & UX mobile PWA**:
  - Tâm xoay overview đặt ở giữa khối ghế (`midSeatingZ`), bật `enablePan = true`, `minDistance = 1.15`, ray-box clamp trong tường/trần/sàn (`minCamZ = max(0.55, screen.topZ + 0.35)`), cho phép **zoom 2 ngón tay ở mọi góc xoay** (kể cả quay 180° nhìn về phía ghế) và **pinch-zoom quang học (`1.0–2.5×`)** trong chế độ góc ngồi ghế; `adaptiveFov` tự nới FOV dọc trên màn hình dọc iPhone.
  - Chế độ toàn màn hình PWA luôn có **2 nút thoát dễ với tới** (`✕ Thu gọn` góc trên trái + nút thu gọn ngay trên thanh dock dưới) kèm đệm đầy đủ `env(safe-area-inset-*)`, bộ chọn ghế phối cảnh 3D (`PerspectiveSeatPicker`), chuyển đổi đèn rạp (`lightsUp`) và nút nhảy nhanh `Ghế đẹp nhất` (`bestSeatCode`).

---

## 5. Các quyết định sản phẩm & UI đã chốt (KHÔNG tự ý đảo ngược)

- **KHÔNG thêm lại** các mục đã bỏ khỏi form sửa phòng chiếu (`settings-panel.tsx`):
  - `screenCurved` (Độ cong màn hình)
  - `rowCurve` (Độ cong hàng ghế)
  - `stadiumFromRow` (Bậc bắt đầu từ hàng — luôn mặc định `1`, `DEFAULT_STEPS_PER_ROW = 1`)
  - `dimensions` override chi tiết từng phòng trong form editor (chỉ cấu hình chung ở `/admin/settings/cinema-dimensions`)
- **Giữ nguyên** các mục đã duyệt trong mục Màn hình của `settings-panel.tsx`: `screenPosition`, `screenWidth`, `screenDistance`, `screenShape`, `screenMount` (mặc định `1.20 / 1.70 / 2.25 m`, chỉnh tự do `0.20–4.00 m` ở `/admin/settings/cinema-dimensions`), và **`screenTilt`** (`Thẳng (0°)` · `Úp nhẹ (5°)` · `Úp vừa (10°)`).
- **KHÔNG vẽ** thanh chắn/lan can sau lối đi ngang trong 3D.
- **KHÔNG dùng** từ `"Scope"` hay `"IMAX"` trong nhãn `screenShape` (`Rộng`, `Chuẩn`, `Vuông`).
- **KHÔNG hiển thị** bộ chọn chiều cao người xem / người ngồi trước (`showHeightControls`) trong Admin editor — chỉ hiển thị ở giao diện người dùng (và lưu chiều cao vào `localStorage`).
- `sideAisles` là 2 chip toggle (mặc định tắt); khi bật, **luôn tự động** tính vào tổng bề rộng phòng (không tách thêm toggle phụ).
- Mặc định `screen.shape` là `"scope"` (`2.39:1`), `screen.tilt` là `"flat"` (`0°`).
- Không đụng tới hoặc commit 2 file untracked của user: `docs/agy-web-bridge-guideline.md` và `scripts/bridge-server.js`.

---

## 6. Bản đồ file chính & lệnh kiểm tra

### File cốt lõi
- [`src/lib/seat-layout/dimensions.ts`](../src/lib/seat-layout/dimensions.ts) — Thông số chuẩn hệ thống (`CinemaDimensionDefaults`), schema & `resolveRoomDimensions`.
- [`src/lib/seat-layout/types.ts`](../src/lib/seat-layout/types.ts) & [`src/lib/seat-layout/config.ts`](../src/lib/seat-layout/config.ts) — Kiểu dữ liệu (`ScreenTilt`, `ScreenMount`, ...), schema `LayoutConfig`, nhãn hàng bỏ `I`/`O`.
- [`src/lib/seat-layout/generate.ts`](../src/lib/seat-layout/generate.ts) & [`src/lib/seat-layout/overrides.ts`](../src/lib/seat-layout/overrides.ts) — Sinh lưới 2D, `sideAisles`, `aisleFills`, `partialVerticalAisles`.
- [`src/lib/seat-layout/physical.ts`](../src/lib/seat-layout/physical.ts) — **Nguồn chân lý vật lý (mét)** dùng chung cho chấm điểm và 3D (gồm hình học màn nghiêng `SCREEN_TILT_DEG`).
- [`src/services/seat-score.ts`](../src/services/seat-score.ts) — Công thức chấm điểm ghế, `floorHeight`, `RECLINE_EYE_DROP_M`, `screenTiltComfortDeg` & Heatmap.
- [`src/lib/seat-layout/scene.ts`](../src/lib/seat-layout/scene.ts) — Mô hình 3D thuần TypeScript (không phụ thuộc WebGL): ghế, `floorSlabs`, `aisleSteps`, `aisleLights`, `projectionPort`, `bestSeatCode`, `eyeOf`, `viewMetricsOf`, `neighbourOf`.
- [`src/components/seat-map/room-3d-scene.ts`](../src/components/seat-map/room-3d-scene.ts), [`src/components/seat-map/room-3d-view.tsx`](../src/components/seat-map/room-3d-view.tsx) & [`src/components/seat-map/perspective-seat-picker.tsx`](../src/components/seat-map/perspective-seat-picker.tsx) — Renderer Three.js, UI 3D CinemaView/Codrops và bộ chọn ghế phối cảnh cho iPhone PWA.
- [`src/services/cinema-dimensions.service.ts`](../src/services/cinema-dimensions.service.ts) & [`src/components/admin/cinema-dimensions-form.tsx`](../src/components/admin/cinema-dimensions-form.tsx) — Trang cài đặt Admin `/admin/settings/cinema-dimensions`.
- [`src/lib/seat-layout/scene.test.ts`](../src/lib/seat-layout/scene.test.ts) & [`src/lib/seat-layout/generate.test.ts`](../src/lib/seat-layout/generate.test.ts) — Bộ unit test đối chiếu 2D, chấm điểm và 3D.

### Lệnh kiểm tra nhanh
- Typecheck + Lint (`src/`) + Unit tests (kèm design tokens):
  ```bash
  npm run typecheck && npx eslint src/ && npx vitest run src/lib/seat-layout/ src/components/seat-map/seat-map.test.ts src/design-tokens.test.ts
  ```
- Lưu ý môi trường:
  - Dùng `npx eslint src/` (vì `scripts/bridge-server.js` bên ngoài `src/` là file untracked có lỗi lint riêng).
  - `npm run build` (Next.js 16 Turbopack) cần chạy ngoài sandbox (`BypassSandbox: true`) nếu chạy trong sandbox bị treo ở bước `Creating an optimized production build`.
