# Thiết kế MVP: SeatMate, app lập kế hoạch & quản lý xem phim

> Tài liệu thiết kế tổng hợp. Dùng làm context cho Claude Project khi phát triển.
> Phiên bản: 1.0 · Ngày: 2026-11-11

---

## 0. Bối cảnh & phạm vi

### Vấn đề cần giải quyết
1. Đi nhiều cụm rạp nhưng không nhớ ghế nào đẹp ở từng phòng chiếu: lối đi bên nào, có lối đi ngang không, màn hình lệch bao nhiêu so với tâm phòng.
2. Không quản lý được chi tiêu cho xem phim (vé, bắp nước).
3. Khó thống nhất lịch với bạn bè. Không theo dõi được chi phí từng buổi, rạp/phòng đã ngồi, phòng đó có đẹp không, đường đi thế nào.

### Phạm vi
- **App không bán vé.** Người dùng vẫn đặt vé trên app của rạp (CGV, BHD, Beta…). App chỉ lo lập kế hoạch, ghi nhớ ghế, chia tiền và thống kê.
- Dữ liệu phim và suất chiếu do admin nhập tay hoặc import CSV.
- Quy mô: vài người dùng (nhóm bạn), không cần tối ưu cho tải lớn.
- 2 role: `admin`, `user`.
- **Hai ngôn ngữ giao diện: tiếng Việt (mặc định) và tiếng Anh.** Ngôn ngữ lưu theo người dùng (`users.locale`); thông báo gửi theo ngôn ngữ của người nhận (xem `.claude/rules/i18n.md`).

---

## 1. Kiến trúc & công nghệ

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Frontend | Next.js, **mobile-first**, PWA | Một app duy nhất, phân quyền theo route `/admin/*` và nhóm route người dùng `(user)` (không có tiền tố URL) |
| Sơ đồ ghế | SVG + React | Pinch-zoom, kéo, tô màu heatmap, chạm vào từng ghế |
| Backend | Next.js API routes hoặc NestJS | |
| Database | **MongoDB** (Atlas) | Atlas chạy replica set nên có transaction (dùng khi chốt ghế, chia tiền) |
| Cache / Queue | **Không dùng Redis** | Job nhắc lịch lưu trên MongoDB (xem mục 4.3) |
| Lưu ảnh/video | **Cloudinary** | Poster, có thể thêm video trailer; resize/nén qua URL transform |
| Đăng nhập | Auth.js (NextAuth): **Google** + **username/password** | Hash mật khẩu bằng argon2/bcrypt; giới hạn số lần đăng nhập sai (lưu trong MongoDB) |
| Thông báo | In-app + **Web Push** (chuẩn W3C + VAPID, thư viện `web-push`) | Miễn phí, không phụ thuộc bên thứ ba, xem mục 4.4. Zalo ZNS để giai đoạn sau (mục 4.2) |
| AI | Tầng trừu tượng, đổi được provider: **Claude** hoặc **Gemini (Google AI Studio)** | Xem mục 7 |

### Nguyên tắc UI mobile-first
- Thanh điều hướng dưới cùng (user): Tổng quan · Lịch chiếu · Lịch hẹn · Rạp · Chat. Chỉ hiện các tab đã có tính năng
  (thêm dần theo sprint); trang `/` chuyển tới tab đầu tiên khả dụng.
- Header: menu avatar (Hồ sơ, tùy chọn thông báo, Đăng xuất) và chuông thông báo (từ Sprint 4).
- Sơ đồ ghế: pinch-zoom và kéo; chạm vào ghế mở bottom sheet (điểm ghế, đánh dấu, ghi chú).
- Vùng chạm tối thiểu khoảng 44px; form dài chia thành nhiều bước.
- Editor phòng chiếu của admin vẫn dùng được trên điện thoại: form thông số ở trên, sơ đồ xem trước ở dưới.

### Quy ước dữ liệu
- **Múi giờ:** lưu thời gian dạng UTC; hiển thị và tính ngày/tuần/tháng, khung giờ giá vé, ngày lễ, nhắc lịch theo `Asia/Ho_Chi_Minh`.
- **Số điện thoại:** luôn lưu dạng chuẩn hóa `84xxxxxxxxx` (dùng để tìm bạn bè theo số điện thoại; Zalo ZNS ở giai đoạn sau cũng cần).
- **Tiền:** lưu số nguyên VND, hiển thị bằng `Intl.NumberFormat`.

### Triển khai
**Đã chốt:** dịch vụ Node chạy liên tục (Railway, Render hoặc VPS), không dùng serverless.
- **Có staging HTTPS từ Sprint 0.** Google OAuth không nhận địa chỉ LAN làm redirect và PWA trên iOS cần HTTPS, nên nếu chỉ
  chạy local thì không thử được đăng nhập Google hay cài PWA trên điện thoại thật.
- **Worker** (gửi Web Push, nhắc theo giờ, tự chuyển COMPLETED) chạy cùng tiến trình web: `instrumentation.ts` khởi động vòng lặp
  mỗi phút khi `ENABLE_WORKER=true`. Nhiều instance vẫn an toàn nhờ `findOneAndUpdate` (mục 4.3). Tự viết, không dùng Agenda.
- **Tách database** theo môi trường (dev, staging, production) bằng `MONGODB_URI` khác nhau.

---

## 2. Admin

### 2.1 Master data

| Nhóm | Trường chính | Ghi chú |
|---|---|---|
| Thương hiệu (`brands`) | tên, logo, màu, link website/app | CGV, BHD, Beta, Lotte, Galaxy… |
| Chi nhánh (`branches`) | thương hiệu, tên, địa chỉ, lat/lng, link Google Maps, **thông tin gửi xe** (giá, tầng, lối vào), tầng của rạp, giờ mở cửa | Giải quyết pain point "đường đi thế nào" |
| Thể loại (`genres`) | tên | Kinh dị, hành động, hoạt hình… |
| Định dạng (`formats`) | 2D, 3D, IMAX, 4DX, ScreenX… | Ảnh hưởng giá vé |
| Phân loại tuổi | P, K, T13, T16, T18 | |
| Loại ghế (`seatTypes`) | tên, số người ngồi (1 hoặc 2), màu hiển thị | Thường, VIP, đôi (Sweetbox), giường nằm, ghế cho người khuyết tật |
| Bảng giá vé (`priceRules`) | chi nhánh/thương hiệu × định dạng × loại ghế × loại ngày × khung giờ, độ ưu tiên, `validFrom`/`validTo` | Loại ngày: thường, cuối tuần, lễ, ngày ưu đãi. Quy tắc chọn rule ở ngay dưới bảng |
| Ngày lễ (`holidays`) | ngày, tên | Để xác định giá ngày lễ |
| Đồ ăn (`fnbItems`, `fnbCombos`) | tên, size, giá theo thương hiệu, `validFrom`/`validTo` | Giá thay đổi theo thời gian |

**Quy tắc chọn rule giá** (khi nhiều rule cùng khớp một suất, xét lần lượt, bước nào phân thắng bại thì dừng):
1. **Độ cụ thể:** rule theo chi nhánh thắng rule theo thương hiệu; rồi rule chỉ định nhiều điều kiện (định dạng, loại ghế,
   loại ngày, khung giờ) hơn thì thắng.
2. **Loại ngày:** lễ > ưu đãi > cuối tuần > thường (một ngày có thể thuộc nhiều loại).
3. **`priority`** (số lớn thắng): chỉ để admin phá hòa thủ công.
4. Rule tạo sau thắng.

`validFrom`/`validTo` để giá vé đổi theo thời gian; chỉ rule còn hiệu lực tại ngày chiếu mới được xét. Suất có `priceOverride`
thì dùng giá đó, bỏ qua mọi rule. Giá ước tính của lịch hẹn được **lưu lại** lúc tính, nên đổi bảng giá sau đó không làm
đổi số liệu cũ.

### 2.2 Cấu hình phòng chiếu

**Thông số cơ bản**
- Số hàng, số cột.
- Thứ tự nhãn hàng (A→Z tính từ màn hình ra, hoặc ngược lại); cách đánh số cột (trái→phải hoặc phải→trái).
- **Vị trí màn hình**: thanh trượt 0–100%. **50% là chính giữa**, kéo sang trái nhỏ hơn 50, kéo sang phải lớn hơn 50. Sơ đồ xem trước cập nhật theo thời gian thực.
- Chiều rộng màn hình so với chiều rộng dãy ghế (%).
- Khoảng cách từ màn hình tới hàng đầu: gần / vừa / xa.
- Bậc thang (stadium): bắt đầu dốc lên từ hàng nào.

**Lối đi & vị trí đặc biệt**
- Lối đi dọc: nằm sau cột nào (có thể nhiều lối).
- Lối đi ngang: nằm sau hàng nào.
- Cửa vào/ra: trái/phải/giữa × phía trước/phía sau.

**Ghi đè từng ô ghế** (chạm trên sơ đồ): đổi loại ghế; đánh dấu "không có ghế" (ô trống, cột chịu lực); ghế hỏng hoặc bị che tầm nhìn.

**Versioning**: sửa layout sẽ tạo phiên bản mới (`auditoriumLayouts`) thay vì ghi đè. Lịch hẹn cũ vẫn trỏ đúng phiên bản layout của chúng.
- **Đánh dấu ghế đi theo phòng, không mất khi có version mới:** `seatMarks` lưu cả `auditoriumId`, `layoutId` (version lúc đánh dấu)
  và `seatCode`. Khi xem layout hiện tại, hiển thị đánh dấu từ mọi version cũ của phòng đó nếu ghế còn tồn tại và **không đổi vị trí**
  (cùng `row`/`col`). Đánh dấu của ghế đã bị xóa hoặc dời chỗ hiện trong mục "Đánh dấu cũ (layout đã đổi)".

Ví dụ dữ liệu layout:

```json
{
  "rows": 10,
  "cols": 16,
  "rowLabelOrder": "front_to_back",
  "colNumbering": "left_to_right",
  "screen": { "positionPct": 58, "widthPct": 85, "distance": "medium" },
  "stadiumFromRow": 3,
  "aisles": { "verticalAfterCols": [3, 13], "horizontalAfterRows": [4] },
  "entrances": [{ "side": "right", "position": "back" }],
  "overrides": [
    { "row": "J", "cols": [5, 6, 7, 8, 9, 10, 11, 12], "type": "couple" },
    { "row": "A", "cols": [1], "type": "none" }
  ]
}
```

Minh họa sơ đồ render ra:

```
              [=========== MÀN HÌNH ===========]      ← vị trí 58% (lệch phải)
 A   · ▢ ▢ ┊ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ┊ ▢ ▢ ▢
 ...
 E   ▢ ▢ ▢ ┊ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ┊ ▢ ▢ ▢
 ─────────────── lối đi ngang ───────────────
 F   ▢ ▢ ▢ ┊ ▣ ▣ ▣ ★ ★ ★ ★ ▣ ▣ ▣ ┊ ▢ ▢ ▢
 ...
 J   ▢ ▢ ▢ ┊ ♥♥ ♥♥ ♥♥ ♥♥ ┊ ▢ ▢ ▢           🚪 cửa phải-sau
```

### 2.3 Điểm ghế tự động (seat score)

Hệ thống tính khi lưu layout và lưu kèm từng ghế. Dùng cho heatmap, gợi ý ghế và chatbot.

- Tâm ngang lý tưởng = tâm phòng + `(positionPct − 50) / 50 × nửa chiều rộng phòng`.
- Chiều sâu lý tưởng: khoảng 60–70% tính từ màn hình, điều chỉnh theo độ rộng màn hình và khoảng cách tới hàng đầu.
- Công thức:
  ```
  score = 100
        − a × |lệch ngang chuẩn hóa|
        − b × |lệch dọc chuẩn hóa|
        − phạt(hàng phẳng trước bậc thang)
        − phạt(sát cửa vào)
        − phạt(ghế hỏng / bị che)
  ```
- Khi lưu layout cũng sinh `summary` (mô tả ngắn: số ghế, vị trí màn hình, lối đi, vùng ghế điểm cao) cho chatbot.
- Giai đoạn sau: cộng thêm điểm cộng đồng (người dùng đánh giá ghế sau buổi xem).

### 2.4 Phim & suất chiếu

**Phim (`movies`)**: tên Việt, tên gốc, poster (Cloudinary), **trailer URL**, thời lượng, thể loại, phân loại tuổi, đạo diễn, diễn viên, ngôn ngữ (phụ đề/lồng tiếng), định dạng có sẵn, ngày khởi chiếu, ngày kết thúc dự kiến, trạng thái (`upcoming` / `showing` / `ended`).

**Trailer xem ngay trong app**
- Chấp nhận mọi dạng link YouTube (`watch?v=`, `youtu.be/`, `shorts/`, `embed/`), tách video ID và lưu lại.
- Hiển thị dạng **lite embed**: ban đầu chỉ có thumbnail `https://img.youtube.com/vi/{id}/hqdefault.jpg` và nút ▶. Khi chạm mới tải iframe `https://www.youtube-nocookie.com/embed/{id}?autoplay=1&playsinline=1`. `playsinline` giúp phát ngay trong trang trên iPhone.
- Một số video bị chủ kênh tắt chế độ nhúng; khi đó hiện nút dự phòng "Xem trên YouTube".
- Tùy chọn: admin upload video trailer lên Cloudinary và phát bằng thẻ `<video>`.

**Suất chiếu (`showtimes`)**: phim, phòng chiếu (kèm phiên bản layout), giờ bắt đầu, giờ kết thúc (tự tính từ thời lượng + thời gian quảng cáo), định dạng, giá override (nếu có).
- Tạo hàng loạt: một phim × nhiều ngày × nhiều khung giờ.
- Import CSV.

### 2.5 Quản lý người dùng
- Danh sách, tìm theo tên/email/số điện thoại; xem phương thức đăng nhập (Google / mật khẩu).
- **Khóa/mở khóa**: tài khoản bị khóa không đăng nhập được, các phiên đang mở bị thu hồi, không nhận lời mời mới.
- **Đổi role** user ↔ admin. Không cho hạ quyền admin cuối cùng.
- **Tạo tài khoản mới** (không có đăng ký công khai, xem mục 6.1): tên, email/username, role, mật khẩu tạm.
- Reset mật khẩu (cho tài khoản dùng mật khẩu): đặt mật khẩu tạm, buộc đổi ở lần đăng nhập sau.
- Tài khoản admin đầu tiên tạo bằng script seed.

### 2.6 Quản lý template thông báo Zalo (giai đoạn sau, không làm trong MVP)

| Trường | Ý nghĩa |
|---|---|
| Tên, loại sự kiện | Ví dụ "Nhắc trước giờ chiếu" gắn với sự kiện `appointment.reminder` |
| ZNS template ID | ID của template đã được Zalo duyệt |
| Ánh xạ tham số | Ví dụ `ten_phim` ← tên phim, `ghe` ← ghế của người nhận, `rap` ← chi nhánh + phòng |
| Trạng thái | Bật / tắt |
| Xem trước & gửi thử | Điền dữ liệu mẫu, gửi tới một số điện thoại test |
| Nhật ký gửi | Thời gian, người nhận, thành công/lỗi, mã lỗi Zalo |

Nội dung template nằm ở phía Zalo và phải được Zalo duyệt. App chỉ lưu ID và cách điền tham số. Muốn sửa câu chữ thì phải tạo template mới và gửi Zalo duyệt lại.

### 2.7 Cài đặt hệ thống
- `reminderMinutesBefore`: số phút nhắc trước giờ chiếu (mặc định 20). Có thể để dạng danh sách, ví dụ `[1440, 20]`.
- Hạn phản hồi lời mời mặc định.
- Thời gian quảng cáo (phút) cộng vào giờ kết thúc suất chiếu.
- Cài đặt AI: provider chính, model, provider dự phòng, temperature, số token tối đa (xem mục 7).
- Mục khác: báo cáo sai thông tin phòng (do user gửi), audit log cho master data. (Duyệt đánh dấu công khai hoãn cùng lớp cộng đồng.)

---

## 3. User

### 3.1 Dashboard

| Khối | Nội dung |
|---|---|
| Chi tiêu | Tổng theo ngày/tuần/tháng/năm, tách **vé và đồ ăn**, biểu đồ theo thời gian |
| Ngân sách | Ngân sách tháng (vé, đồ ăn), thanh tiến độ, cảnh báo ở mức 80% và 100% |
| Thống kê xem phim | Số phim đã xem, chi phí trung bình mỗi buổi, thể loại/rạp/khung giờ hay đi |
| Bạn bè | Người hay đi cùng nhất, **công nợ** (ai nợ mình, mình nợ ai) |
| Lịch hẹn | Sắp tới, lời mời đang chờ phản hồi, lịch hẹn đang ở bước chọn ghế |
| Gợi ý | Phim sắp chiếu thuộc thể loại hay xem |

**Nguyên tắc số liệu:** chi tiêu của user = tổng `expenses` của chính họ (phần của mình, không phải số tiền đã ứng), nên không
bị đếm trùng khi một người trả hộ cả nhóm. Công nợ lấy từ `expenseShares` (mục 3.4).

### 3.2 Trang rạp chiếu
- Danh sách thương hiệu và chi nhánh, bản đồ, link chỉ đường, thông tin gửi xe.
- Xem sơ đồ phòng ở chế độ chỉ đọc, có 3 lớp bật/tắt:
  1. Heatmap điểm ghế của hệ thống.
  2. Đánh dấu cá nhân: ⭐ thích / 🚫 tránh, kèm ghi chú.
  3. ~~Đánh dấu cộng đồng~~ **hoãn sang giai đoạn sau**: nhóm chỉ có vài người nên chưa đủ dữ liệu. MVP chỉ có lớp 1 và 2.
- Tag nhanh cho ghế: gần lối đi, sát cửa, bị che, ghế lỏng, gần loa.
- Đánh giá phòng: âm thanh, điều hòa, độ sạch.
- Lịch sử ngồi: "Bạn đã ngồi phòng này 3 lần: F7, F8, G9".

### 3.3 Trang lịch chiếu
- Lọc theo ngày, phim, chi nhánh, thể loại, định dạng, khung giờ.
- Mỗi suất hiển thị giá ước tính; nút **"Tạo lịch hẹn từ suất này"**.
- Trang chi tiết phim có trailer xem ngay (mục 2.4).

### 3.4 Lịch hẹn: luồng 2 giai đoạn

```
DRAFT → INVITING → PARTICIPANTS_LOCKED → PLANNING → CONFIRMED → COMPLETED
          (CANCELLED có thể xảy ra ở mọi bước trước COMPLETED)
```

**Giai đoạn 1: Mời & chốt người**
- Người tạo chọn phim và **một hoặc nhiều phương án thời gian** (poll), kèm hạn phản hồi. Mỗi phương án là một giờ, có thể
  gắn với một suất chiếu cụ thể (`showtimeId`). Tạo từ một suất thì phương án đầu tiên chính là suất đó.
- Người được mời trả lời một trong hai cách: **Từ chối cả lời mời** (lý do tùy chọn), hoặc **vote Có/Không cho từng phương án**.
  Vote Có ít nhất một phương án nghĩa là đồng ý tham gia.
- **Đề xuất giờ khác:** thêm một phương án mới vào poll (có thể gắn suất chiếu của cùng phim); người đề xuất tự động vote Có,
  những người khác vote tiếp.
- Người tạo xem bảng tổng hợp, chọn một phương án rồi bấm **Chốt**. Danh sách tham gia mặc định là những người vote Có phương án
  đó; trước khi chốt, người tạo có thể bỏ bớt hoặc thêm bất kỳ người được mời chưa từ chối. Sau khi chốt, **người tạo không thêm
  hay bớt người** nữa.
- **Rút lui:** người tham gia tự rút được từ PARTICIPANTS_LOCKED đến CONFIRMED, trước giờ chiếu. Ghế được trả lại, tiền tính lại,
  người tạo nhận thông báo (#13). Người tạo muốn thôi thì hủy lịch hẹn.
- **Quá hạn phản hồi:** lịch hẹn không tự hủy; người chưa trả lời hiện nhãn "Quá hạn", người tạo vẫn chốt được.

**Giai đoạn 2: Chi tiết** (chỉ mở sau khi đã chốt người)
- Chọn suất chiếu cụ thể (từ đó biết phòng chiếu). Nếu phương án đã chốt có `showtimeId` thì điền sẵn; nếu không, chọn trong các suất của phim gần giờ đã chốt, và giờ lịch hẹn cập nhật theo suất đó.
- **Xếp ghế cho từng người**: kéo thả avatar vào ghế. Ghế đôi gán được 2 người. Hệ thống gợi ý dãy ghế liền nhau có tổng điểm cao nhất.
- Chọn đồ ăn cho từng người hoặc combo chung.
- Tính tiền từng người; chọn cách trả: một người trả hết rồi chia, hoặc mỗi người tự trả.
- Bấm **Xác nhận** để chuyển sang CONFIRMED, gửi thông báo cho cả nhóm và lên lịch nhắc.
- **Chống trùng ghế:** chốt hoặc đổi ghế chạy trong transaction MongoDB; từ chối ghế đã có người, ghế hỏng hoặc không tồn tại.
- **Sửa sau khi xác nhận:** chỉ người tạo đổi ghế/giờ; gửi #6 cho người bị ảnh hưởng và tính lại nhắc.

**Sau buổi xem (COMPLETED)**
- **Hoàn thành:** người tạo bấm "Đã xem xong" sau giờ chiếu; nếu không bấm, hệ thống tự chuyển sau giờ kết thúc suất.
- **Nhập chi phí thực tế** (người tạo): tiền vé và đồ ăn **của từng người** (mặc định bằng ước tính, sửa được) và ai là người
  trả. Mỗi người tham gia thấy phần của mình và được chỉnh số tiền phần của mình (kèm lý do).
- Phần của mỗi người ghi thành `expenses` của chính người đó. Đây là nguồn duy nhất cho dashboard.
- **Một người trả hết:** tạo `expenseShares` cho từng người còn lại, nợ người trả. Người nợ bấm "Tôi đã trả", người được nợ
  bấm "Đã nhận" để xác nhận (người được nợ cũng đánh dấu đã nhận thẳng được). **Mỗi người tự trả:** không có công nợ.
- MVP chỉ theo dõi đã trả/chưa trả, chưa tạo mã VietQR.
- Đánh giá phim và đánh giá ghế đã ngồi (lưu cá nhân, hiện ở lịch sử ngồi; điểm cộng đồng để giai đoạn sau).

**Bổ sung**
- Ghi lại buổi đã xem (xem một mình hoặc đặt ngoài app) để dashboard đầy đủ dữ liệu.
- Nhóm bạn cố định để mời nhanh; thêm bạn qua số điện thoại hoặc link mời.

### 3.5 Hồ sơ người dùng
- Tên, avatar, email, **số điện thoại** (dùng để bạn bè tìm thấy bạn; không bắt buộc).
- Bật/tắt từng loại thông báo; bật/tắt thông báo đẩy theo từng thiết bị.
- Ngôn ngữ giao diện: Tiếng Việt hoặc English, **chỉ cấu hình ở trang Cài đặt** (không đặt công tắc ở các trang khác). Mặc định theo ngôn ngữ trình duyệt, không có thì Tiếng Việt.
- Sở thích ngồi (gần lối đi, giữa, phía sau…), dùng cho gợi ý ghế và chatbot.
- Ngân sách tháng.

---

## 4. Thông báo

### 4.1 Danh sách sự kiện

| # | Sự kiện | Người nhận | Kênh | MVP |
|---|---|---|---|---|
| 1 | Được mời xem phim | Người được mời | Web Push + in-app | ✅ |
| 2 | Có người đồng ý / từ chối / đề xuất giờ khác | Người tạo | Web Push + in-app | ✅ |
| 3 | Sắp hết hạn phản hồi (trước 12h) | Người chưa phản hồi | Web Push + in-app | ✅ |
| 4 | Đã chốt người tham gia | Cả nhóm | Web Push + in-app | ✅ |
| 5 | Lịch hẹn đã xác nhận (phim, giờ, rạp, phòng, ghế của người nhận, chỉ đường) | Cả nhóm | Web Push + in-app | ✅ |
| 6 | Thay đổi sau khi xác nhận (đổi ghế/giờ) | Người bị ảnh hưởng | Web Push + in-app | ✅ |
| 7 | Hủy lịch hẹn | Cả nhóm | Web Push + in-app | ✅ |
| 8 | **Nhắc trước giờ chiếu N phút** (admin cấu hình, mặc định 15–20) | Cả nhóm | Web Push + in-app | ✅ |
| 9 | Nhắc nhập chi phí và đánh giá ghế (sau suất chiếu khoảng 3h) | Người tạo / cả nhóm | Web Push + in-app | ✅ |
| 10 | Nhắc trả tiền | Người còn nợ | Web Push + in-app | Giai đoạn 2 |
| 11 | Chi tiêu chạm 80% / 100% ngân sách | Chính user | Web Push + in-app | ✅ |
| 12 | Phim thể loại yêu thích sắp khởi chiếu | User | Web Push + in-app | Giai đoạn 2 |
| 13 | Người tham gia rút lui | Người tạo | Web Push + in-app | ✅ |

**Ngôn ngữ:** nội dung thông báo viết theo `locale` của người nhận.

**Quy tắc kênh:** mọi sự kiện luôn ghi in-app, và gửi thêm Web Push tới mọi thiết bị user đã bật. Kênh lỗi không chặn kênh khác. Zalo ZNS là kênh bổ sung ở giai đoạn sau (mục 4.2).

Nội dung nhắc (#8) gồm: tên phim, giờ chiếu, chi nhánh + phòng, **ghế của người nhận**, link chỉ đường, thông tin gửi xe.

### 4.2 Zalo ZNS (giai đoạn sau, không làm trong MVP)
Tạm gác vì cần Zalo OA và ZNS có phí. Kiến trúc kênh đã tách (`notificationDeliveries.channel`) nên thêm Zalo sau không phải sửa lõi.
- Dùng ZNS qua một **Zalo Official Account đã xác thực**. ZNS gửi theo số điện thoại. Mỗi template phải được Zalo duyệt; chỉ dùng cho nội dung giao dịch/chăm sóc; có tính phí theo tin. Chính sách và giá thay đổi thường xuyên, kiểm tra lại trên Zalo for Developers.
- **Zalo cá nhân không có API chính thức để app tự gửi tin.** Không dùng thư viện không chính thức đăng nhập vào Zalo cá nhân: vi phạm điều khoản và có nguy cơ bị khóa tài khoản.
- Khi làm: thêm adapter Zalo vào worker, màn quản lý template (mục 2.6), `zaloTemplates`, tùy chọn bật Zalo trong hồ sơ, xác minh số điện thoại (câu hỏi mở số 2).
- Trong lúc chờ, người tạo lịch hẹn có thể dùng Web Share API (nút "Chia sẻ" của điện thoại) để tự gửi nội dung nhắc vào nhóm Zalo thủ công.

### 4.3 Cơ chế gửi (không dùng Redis)
1. **Outbox**: mỗi sự kiện ghi vào `notifications`. Một worker đọc và gửi, kết quả lưu vào `notificationDeliveries` (`channel`: inapp / webpush, sau này thêm zalo; sent / failed / retry, tối đa 3 lần).
2. **Nhắc theo giờ**: khi lịch hẹn chuyển CONFIRMED, tạo bản ghi `scheduledNotifications` với `sendAt = giờ chiếu − reminderMinutesBefore`, `status = pending`.
3. Tác vụ chạy **mỗi phút** tìm bản ghi `pending` có `sendAt <= now`. Dùng `findOneAndUpdate` để chuyển sang `processing` trước khi gửi, tránh gửi trùng.
4. Khi admin đổi số phút, hoặc lịch hẹn đổi giờ / bị hủy: tính lại `sendAt` hoặc hủy các bản ghi còn `pending`.
5. **Đã chốt: tự viết, không dùng Agenda.** Worker chạy cùng tiến trình web (mục 1, Triển khai). In-app được ghi trực tiếp khi tạo `notifications` (không cần worker); worker cần cho gửi Web Push (có retry), nhắc theo giờ và tự chuyển COMPLETED.

### 4.4 Web Push (thông báo đẩy qua PWA)

**Công nghệ đã chọn: Web Push chuẩn W3C + giao thức VAPID, gửi bằng thư viện `web-push` (Node) phía server, service worker viết tay.**
- Lý do: miễn phí, không bên thứ ba giữ dữ liệu người dùng, ít phụ thuộc, và đủ cho quy mô nhóm nhỏ. Chạy được trên Android, Chrome/Edge/Firefox desktop
  và iPhone (iOS 16.4 trở lên, chỉ khi app đã cài ra màn hình chính).
- Đã cân nhắc và không chọn: **Firebase Cloud Messaging** (thêm SDK và phụ thuộc Google cho việc mà chuẩn Web Push đã làm được);
  **OneSignal/Novu** (dịch vụ ngoài, dữ liệu thiết bị nằm ở bên thứ ba, thêm chi phí khi mở rộng); các gói PWA tự sinh service worker
  (như next-pwa/Serwist) vì mình chỉ cần một service worker nhỏ cho push, không cần cache offline phức tạp.

**Cách hoạt động**
- Trình duyệt đăng ký qua `PushManager.subscribe` với khóa công khai VAPID; server lưu subscription vào `pushSubscriptions`.
  Cặp khóa VAPID tạo một lần, để trong biến môi trường (staging và production dùng cặp riêng).
- Worker (mục 4.3) lấy `notifications` chưa gửi, gọi `web-push` tới từng subscription của người nhận. `web-push` lo việc mã hóa payload.
- **Service worker** `public/sw.js`: sự kiện `push` hiện thông báo; `notificationclick` mở đúng trang (deep link, ví dụ chi tiết lịch hẹn).
  Nội dung push ngắn (tiêu đề, một dòng, link); chi tiết xem trong app.
- **Đăng ký:** user bấm "Bật thông báo trên thiết bị này" trong Hồ sơ (xin quyền khi người dùng chủ động bấm, không xin lúc vừa mở app).
  Mỗi thiết bị một bản ghi; tắt được từng thiết bị. Nút "Gửi thử thông báo" để kiểm tra.
- **iPhone:** chỉ nhận khi đã cài PWA ra màn hình chính; Hồ sơ hiển thị hướng dẫn cài khi phát hiện iPhone chưa cài.
- **Dọn dẹp và retry:** gặp 404/410 thì xóa subscription; lỗi tạm thời thì retry tối đa 3 lần (mục 4.3).
- Cần HTTPS (hoặc localhost): đã có staging HTTPS từ Sprint 0.

---

## 5. Mô hình dữ liệu (MongoDB collections)

Nguyên tắc: **nhúng** (embed) dữ liệu nhỏ và gắn chặt với document cha (người tham gia, ghế, đồ ăn trong lịch hẹn); **tham chiếu** (reference) các thực thể dùng chung (phim, phòng, user).

```
users                    { name, username?, email?, phone, avatar, role, status, authProviders[],
                           passwordHash?, mustChangePassword, locale (vi|en), preferences{seat, notifications}, monthlyBudget }
                         // ít nhất một trong username/email; unique sparse index cho username, email, phone
loginAttempts            { key (username), failCount, lockLevel, lockedUntil?, expiresAt (TTL) }
friendships              { userA, userB, status }
friendGroups             { ownerId, name, memberIds[] }

brands, branches, genres, formats, seatTypes, holidays
priceRules               { scope{brandId|branchId}, formatId, seatTypeId, dayType,
                           timeSlot, price, priority, validFrom?, validTo? }
fnbItems, fnbCombos      { brandId, name, size, price, validFrom, validTo }

auditoriums              { branchId, name, currentLayoutId }
auditoriumLayouts        { auditoriumId, version, config{...},
                           seats[{ code, row, col, type, x, y, score, flags[] }],
                           summary }       // mô tả ngắn, dùng cho chatbot
movies                   { title, originalTitle, posterUrl, trailer{provider, videoId},
                           durationMin, genreIds[], ageRating, releaseDate, endDate, status }
showtimes                { movieId, auditoriumId, layoutId, startAt, endAt, formatId,
                           priceOverride? }

seatMarks                { userId, auditoriumId, layoutId, seatCode, kind: favorite|avoid, tags[], note }
auditoriumReviews        { userId, auditoriumId, sound, ac, cleanliness, comment }
seatRatings              { userId, layoutId, seatCode, rating, appointmentId }

appointments             { creatorId, movieId, status, responseDeadline,
                           timeOptions[{ id, startAt, showtimeId?, proposedBy,
                                         votes[{ userId, vote: yes|no }] }],
                           chosenOptionId?,
                           participants[{ userId, status: invited|accepted|declined|dropped,
                                          declineReason? }],
                           showtimeId?, seats[{ userId, seatCode }],
                           fnb[{ userId?, itemId, qty, price }],
                           payment{ mode, payerId? }, estimatedCost, actualCost }
expenses                 { userId, appointmentId?, category: ticket|fnb, amount, date }
                         // chi tiêu CÁ NHÂN (phần của chính userId); nguồn duy nhất cho dashboard
expenseShares            { appointmentId, debtorId, creditorId (người đã trả), amount,
                           status: unpaid|claimed|paid }   // chỉ khi một người trả hết

notifications            { type, recipientId, payload, createdAt }
notificationDeliveries   { notificationId, channel: inapp|webpush (zalo: giai đoạn sau), status, attempts, error? }
pushSubscriptions        { userId, endpoint (unique), keys{p256dh, auth}, userAgent, createdAt, lastUsedAt }
scheduledNotifications   { appointmentId, type, sendAt, status }
zaloTemplates            { name, eventType, znsTemplateId, paramMapping{}, active }   // giai đoạn sau
systemSettings           { key, value }

chatSessions             { userId, state{ currentBranchId?, currentAuditoriumId?, ... },
                           summary }
chatMessages             { sessionId, role, content, toolCalls?, toolCallId? }  // định dạng trung lập
aiUsage                  { date, userId, provider, model, inputTokens, outputTokens }
```

---

## 6. Phân quyền & bảo mật
- Middleware kiểm tra role cho `/admin/*`.
- Mọi truy vấn dữ liệu cá nhân (chi tiêu, lịch hẹn, đánh dấu ghế) lọc theo `userId` lấy từ session, không lấy từ client.
- Lịch hẹn: chỉ người tạo được chốt người và chốt chi tiết; người tham gia chỉ sửa phần của mình (phản hồi, đồ ăn nếu được phép).
- API key AI và cặp khóa VAPID (Web Push) để trong biến môi trường, không lưu trong database (Zalo cũng vậy khi làm giai đoạn sau).
- **Admin chỉ dùng khu quản trị:** tài khoản `admin` chỉ có giao diện `/admin/*`, không có liên kết sang app người dùng, và mở trang người dùng sẽ được đưa về khu quản trị (muốn xem app người dùng thì dùng một tài khoản `user`). **Mọi thiết lập tài khoản** (ngôn ngữ, đổi mật khẩu, thông báo) nằm trong trang Cài đặt.
- **Middleware chỉ là lớp đầu.** Nó chạy ở edge, chỉ đọc được JWT, không truy cập MongoDB. Mọi trang và API server gọi
  `requireUser()` / `requireAdmin()` (`src/lib/auth/guards.ts`) để đọc lại `status` và `role` từ DB, nên khóa hoặc hạ quyền
  có hiệu lực ngay ở request kế tiếp.
- **Số điện thoại:** unique; tìm bạn theo số chỉ khớp chính xác, có giới hạn tần suất tra cứu và phản hồi chung chung (không
  tiết lộ số có tài khoản hay không); lời mời kết bạn cần người kia chấp nhận. MVP không dùng OTP (mục 9, câu 2).
- `username` và `email` không được cùng trống; mỗi trường có unique sparse index.

### 6.1 Xác thực (đăng nhập, đăng xuất, tài khoản)
- **Không có đăng ký công khai.** Chỉ admin tạo tài khoản (mục 2.5). Trang `/login` không có nút đăng ký.
- **Tạo tài khoản:** admin nhập tên, email và/hoặc username, role. Với tài khoản mật khẩu, admin đặt mật khẩu tạm
  và tài khoản bị đánh dấu `mustChangePassword`: lần đăng nhập đầu buộc đổi mật khẩu.
- **Google:** chỉ đăng nhập được khi email đã có trong `users` (do admin tạo). Email lạ bị từ chối với thông báo
  "Tài khoản chưa được cấp quyền, liên hệ quản trị viên". Lần đăng nhập Google đầu tiên tự thêm `google` vào `authProviders[]`.
- **Một email = một tài khoản.** Cùng một người có thể có cả Google và mật khẩu, không tạo bản ghi thứ hai.
- **Đăng nhập:** session JWT chứa `userId` và `role`. Mỗi lần kiểm tra session đọc lại `status` để chặn tài khoản bị khóa
  (cơ chế thu hồi phiên ở mục 2.5).
- **Giới hạn đăng nhập sai (đã chốt, thời gian khóa tăng dần):** cứ 5 lần sai liên tiếp là một đợt khóa; thời gian khóa
  gấp đôi sau mỗi đợt: 15 phút, 30 phút, 1 giờ, 2 giờ, ... tối đa 24 giờ. Đăng nhập đúng thì xóa bộ đếm. Bộ đếm cũng
  tự xóa nếu 24 giờ không có lần sai nào. Đếm theo username, lưu trong `loginAttempts` (TTL index). Trong lúc bị khóa,
  mật khẩu đúng cũng bị từ chối. Thông báo lỗi không tiết lộ username có tồn tại hay không. Admin reset mật khẩu
  thì xóa luôn bộ đếm và trạng thái khóa.
- **Đăng xuất:** nút "Đăng xuất" ở trang Hồ sơ (user) và menu tài khoản (admin); xóa session rồi chuyển về `/login`.
- **Đổi mật khẩu:** user tự đổi trong Hồ sơ (nhập mật khẩu cũ). **Quên mật khẩu:** chỉ admin reset (đặt mật khẩu tạm,
  bật lại `mustChangePassword`); MVP không gửi email đặt lại.
- **Điều hướng:** chưa đăng nhập vào trang bảo vệ thì chuyển về `/login` kèm `callbackUrl`; đã đăng nhập vào `/login` thì
  chuyển về trang chủ theo role.

---

## 7. Chatbot AI

### 7.1 Hướng tiếp cận
Dữ liệu của app chủ yếu là dữ liệu có cấu trúc, nên chatbot dùng **tool calling**, không dùng RAG. AI không truy cập database trực tiếp; AI gọi các hàm do backend định nghĩa.

| Tool | Trả về |
|---|---|
| `search_branches(query)` | Danh sách chi nhánh khớp |
| `get_auditorium_seats(auditoriumId)` | Layout rút gọn: top ghế đẹp, ghế cần tránh, mô tả phòng, đánh dấu của user |
| `suggest_seats(showtimeId, groupSize)` | Các dãy ghế liền nhau tốt nhất |
| `search_showtimes(movie?, date?, branch?)` | Suất chiếu |
| `get_spending_summary(period)` | Chi tiêu theo kỳ |
| `get_my_appointments(status?)` | Lịch hẹn của user |

### 7.2 Giữ context, không phải đọc lại
- `userId` lấy từ session ở server và truyền ngầm vào tool. AI không bao giờ tự truyền `userId`.
- Điểm ghế và mô tả phòng **tính sẵn** khi lưu layout; tool trả về JSON gọn thay vì toàn bộ ma trận ghế.
- Lịch sử chat lưu trong MongoDB ở **định dạng trung lập**.
- `chatSessions.state` lưu entity đang được nhắc tới (rạp, phòng, phim) để câu hỏi nối tiếp không cần tra lại.
- Hội thoại dài: tóm tắt các lượt cũ vào `chatSessions.summary`.
- Dùng cache của provider (nếu có) cho phần cố định: system prompt, định nghĩa tool, hồ sơ user rút gọn.
- Giới hạn tối đa 5 vòng gọi tool cho mỗi câu hỏi.
- Giai đoạn sau: RAG (vector search) cho dữ liệu dạng chữ như ghi chú và review.

### 7.3 Tầng provider đổi được

| Pattern | Vai trò |
|---|---|
| **Adapter** | Mỗi provider một adapter, chuyển giữa định dạng chung và định dạng riêng của API |
| **Strategy** | Orchestrator chỉ làm việc với interface `LLMProvider` |
| **Factory + Registry** | Tạo provider theo cấu hình; thêm provider mới chỉ cần đăng ký adapter |
| **Decorator** | Bọc thêm retry, log, đếm token mà adapter không phải tự làm |
| **Fallback** | Provider chính lỗi hoặc hết quota thì chuyển sang provider dự phòng |

Cấu trúc thư mục:

```
src/ai/
  core/types.ts              # Message, ToolDef, ChatResult trung lập
  core/llm-provider.ts       # interface LLMProvider
  providers/anthropic.adapter.ts
  providers/gemini.adapter.ts
  providers/registry.ts
  decorators/                # retry, logging, usage-tracking, fallback
  tools/                     # định nghĩa tool 1 lần, dùng cho mọi provider
  orchestrator.ts            # vòng lặp tool calling, lưu lịch sử
```

Interface chung:

```ts
type Role = "user" | "assistant" | "tool";

interface Message {
  role: Role;
  content: string;
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  toolCallId?: string; // khi role = "tool"
}

interface ToolDef {
  name: string;
  description: string;
  parameters: JSONSchema; // schema đơn giản
  execute: (args: any, ctx: { userId: string }) => Promise<unknown>;
}

interface LLMProvider {
  readonly name: string;
  readonly capabilities: { promptCaching: boolean; streaming: boolean };
  chat(req: { system: string; messages: Message[]; tools: ToolDef[] }): Promise<{
    message: Message;
    usage: { inputTokens: number; outputTokens: number };
  }>;
}
```

Orchestrator:

```ts
async function runChat(sessionId: string, userText: string, userId: string) {
  const provider = providerRegistry.get(await settings.get("ai.provider"));
  const history = await chatRepo.load(sessionId);
  history.push({ role: "user", content: userText });

  for (let i = 0; i < 5; i++) {
    const { message } = await provider.chat({ system, messages: history, tools });
    history.push(message);
    if (!message.toolCalls?.length) break;
    for (const call of message.toolCalls) {
      const result = await toolMap[call.name].execute(call.args, { userId });
      history.push({ role: "tool", toolCallId: call.id, content: JSON.stringify(result) });
    }
  }
  await chatRepo.save(sessionId, history);
  return history.at(-1);
}
```

Ghép provider:

```ts
const provider = withFallback(
  withRetry(withUsageTracking(registry.create("gemini", geminiConfig))),
  withRetry(registry.create("anthropic", anthropicConfig)),
);
```

Khác biệt adapter phải xử lý:

| Khác biệt | Claude | Gemini | Adapter làm gì |
|---|---|---|---|
| System prompt | tham số `system` | `systemInstruction` | Map từ `req.system` |
| Tên role | `assistant` | `model` | Đổi tên hai chiều |
| Gọi tool | block `tool_use` / `tool_result` | part `functionCall` / `functionResponse` | Chuyển về `toolCalls` / role `tool` |
| ID tool call | provider cấp | có thể không có | Tự sinh nếu thiếu |
| Schema tham số | JSON Schema | tập con OpenAPI schema | Chỉ dùng object, string, number, enum, array; tránh `oneOf`, `$ref` |
| Cache | prompt caching | context caching | Khai báo qua `capabilities` |

Có thể dùng **Vercel AI SDK** làm phần ruột bên trong adapter (đã chuẩn hóa tool calling cho Anthropic và Google), nhưng vẫn giữ interface `LLMProvider` riêng để app không phụ thuộc trực tiếp vào thư viện.

### 7.4 Lựa chọn provider
- **Claude**: gói Claude Team có kèm credit API hằng tháng (gộp chung, có mức trần), nhận bằng cách Owner liên kết một tổ chức Claude Console trong Organization settings > Billing. Credit không cộng dồn sang tháng sau; hết credit thì request API dừng tới chu kỳ sau. Model gợi ý: `claude-haiku-5-5` (nhanh, rẻ), `claude-sonnet-5-5` khi cần suy luận tốt hơn.
- **Gemini (Google AI Studio)**: có gói miễn phí tiện cho MVP. Kiểm tra điều khoản về việc dữ liệu gửi lên có được dùng để cải thiện sản phẩm hay không (khác nhau giữa gói free và trả phí), vì app có dữ liệu cá nhân.
- Tên model để trong cấu hình, không viết cứng trong code.

### 7.5 Giới hạn và an toàn
- **Hạn mức theo user:** số tin nhắn và token mỗi ngày cho từng người (cấu hình trong cài đặt AI), để một người không dùng hết
  credit chung của cả nhóm. `aiUsage` ghi kèm `userId`.
- **Nội dung do người dùng nhập** (ghi chú ghế, review) khi đưa vào tool được đóng khung là dữ liệu, không phải chỉ dẫn. Tool
  chỉ đọc, không có tool ghi hay xóa dữ liệu.

---

## 8. Lộ trình

Chi tiết phạm vi, ranh giới và tiêu chí hoàn thành từng sprint nằm ở `docs/sprints.md` (nguồn sự thật).

| Sprint | Nội dung |
|---|---|
| 0 | Khung dự án, auth (Google + mật khẩu), phân quyền, layout, theme, staging HTTPS |
| 1 | Master data, quản lý người dùng, cài đặt hệ thống, hồ sơ cơ bản |
| 2 | Editor phòng chiếu, render sơ đồ, điểm ghế, versioning layout |
| 3 | Phim (trailer nhúng), suất chiếu (tạo hàng loạt, CSV), trang rạp & lịch chiếu phía user, đánh dấu ghế |
| 4 | Lịch hẹn giai đoạn 1 (mời, vote, chốt người), bạn bè, thông báo in-app, worker, Web Push |
| 5A | Lịch hẹn giai đoạn 2: chọn suất, xếp ghế, đồ ăn, chi phí, công nợ, xác nhận |
| 5B | Nhắc lịch và các thông báo theo giờ, tự hoàn thành |
| 6 | Dashboard, ngân sách, ghi lại buổi đã xem, đánh giá cá nhân |
| 7 | Chatbot: tầng provider, tools, lưu context |
| 8 | Production & hardening: môi trường production, sao lưu, rà soát cuối |

## 9. Câu hỏi còn mở

1. **Zalo OA & ZNS**: đã có Official Account đã xác thực chưa? Ai chịu chi phí tin nhắn? Nếu chưa có, MVP có chạy trước chỉ với in-app không? **Hoãn:** Zalo không làm trong MVP (Zalo cá nhân không gửi tự động được, chỉ OA + ZNS có phí). MVP dùng Web Push + in-app; xem lại khi bạn muốn thêm Zalo.
2. **Xác minh số điện thoại**: có cần OTP để xác minh số trước khi gửi Zalo (hoặc kết bạn theo số) không, hay chỉ cần người dùng tự nhập? **Đã chốt (mặc định MVP):** không dùng OTP; giảm thiểu bằng số điện thoại unique, giới hạn tra cứu, kết bạn cần chấp nhận (mục 6). Xét lại nếu mở rộng người dùng.
3. **Hosting**: chọn VPS/Railway/Render (tiến trình chạy liên tục) hay serverless kèm cron bên ngoài? **Đã chốt:** dịch vụ Node chạy liên tục, không serverless; có staging từ Sprint 0 (mục 1).
4. **Đánh dấu ghế công khai**: có cần admin duyệt trước khi hiển thị cho người khác không? **Hoãn:** lớp cộng đồng không làm trong MVP (nhóm nhỏ).
5. **Lời mời người chưa có tài khoản**: có hỗ trợ mời qua link để người đó đăng ký rồi tham gia không? **Đã chốt:** không hỗ trợ (không có đăng ký công khai, xem 6.1). Link mời chỉ dùng để kết bạn với người đã có tài khoản; người chưa có tài khoản phải nhờ admin tạo.
6. **Chia tiền**: chỉ theo dõi đã trả/chưa trả, hay muốn tạo mã QR chuyển khoản (VietQR) cho từng người? **Đã chốt (mặc định):** chỉ theo dõi đã trả/chưa trả; VietQR để giai đoạn sau.
7. **Dữ liệu suất chiếu**: nhập tay/CSV là đủ cho MVP, hay cần cân nhắc lấy tự động từ website rạp ở giai đoạn sau? Mặc định cho MVP: nhập tay hoặc CSV.
