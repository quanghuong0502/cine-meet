# Kế hoạch sprint

Nguồn chi tiết: `docs/movie-app-mvp-design.md` (số mục ghi ở từng sprint). File này là nguồn sự thật về
**phạm vi, ranh giới và trạng thái** từng sprint.

## Cách dùng
- Chỉ làm sprint có trạng thái **Đang làm**. Không làm trước việc của sprint sau, kể cả khi thấy tiện.
- Việc nằm ở "Ngoài phạm vi" thì không làm; nếu cần thiết thì hỏi người dùng trước.
- Một sprint chỉ xong khi mọi mục trong "Tiêu chí hoàn thành" được tích, và người dùng đã tự thử bằng tay.
- Cuối sprint: đổi trạng thái, ghi vào "Nhật ký tiến độ" ở cuối file, và nếu có quyết định kiến trúc mới thì
  thêm vài dòng vào `CLAUDE.md` hoặc `.claude/rules/`.

## Quy ước chung (áp dụng mọi sprint)
- [ ] `npm run lint`, `npm run typecheck`, `npm test` đều pass.
- [ ] **PWA:** chạy đúng khi cài ra màn hình chính trên iPhone 13 và iPhone 14 Pro (`.claude/rules/pwa.md`): có nút quay lại trong app, không phụ thuộc thanh trình duyệt, lỗi mạng hiện rõ, mỗi màn có URL riêng.
- [ ] Giao diện mobile-first, kiểm tra ở iPhone 13 (390×844) và iPhone 14 Pro (393×852), theo `.claude/rules/devices.md`; có trạng thái loading, rỗng, lỗi.
- [ ] Quyền truy cập đúng: mọi trang/API server dùng `requireUser()` / `requireAdmin()` (không chỉ dựa vào middleware); dữ liệu cá nhân lọc theo `userId` từ session.
- [ ] `scripts/seed.ts` cập nhật đủ dữ liệu mẫu để thử tính năng của sprint.
- [ ] Không có lỗi build/runtime (kiểm tra bằng Next.js DevTools MCP khi `npm run dev` đang chạy).
- [ ] Thử trên local: Chrome DevTools khổ iPhone 13 và iPhone 14 Pro, hoặc điện thoại qua mạng LAN (không dùng được Google OAuth). Thử trên máy thật qua HTTPS làm ở giai đoạn triển khai (Sprint 8).
- [ ] Tính năng chia thành các commit nhỏ, mỗi commit chạy được.
- [ ] Mọi chuỗi giao diện đi qua i18n, có đủ `vi` và `en`; test kiểm tra hai bộ khóa khớp nhau. Chữ theo `.claude/rules/copy.md`.
- [ ] Thời gian lưu UTC, hiển thị và tính ngày/tuần/tháng theo `Asia/Ho_Chi_Minh`; số điện thoại lưu dạng `84xxxxxxxxx`.
- [ ] **Cache và loading** theo `.claude/rules/caching.md`: dữ liệu cá nhân không cache qua request; dữ liệu dùng chung có tag và được `updateTag` khi ghi; không `router.refresh()` thừa sau server action; mỗi màn mới có skeleton đúng vùng chờ (không thay cả trang) và menu/tab sáng ngay khi bấm; đo chuyển tab bằng bản production (`npm run build && npm start`), không bằng `npm run dev`.
- [ ] Có trang 404/500 thân thiện; mỗi API dữ liệu cá nhân có test thử truy cập dữ liệu của người khác (phải bị từ chối).

## Tổng quan

| Sprint | Nội dung chính | Phụ thuộc | Trạng thái |
|---|---|---|---|
| 0 | Khung nền: scaffold, auth, layout, theme, i18n (vi, en) | — | Xong |
| 1 | Master data, quản lý người dùng, cài đặt hệ thống, hồ sơ cơ bản | 0 | Xong |
| 2 | Editor phòng chiếu, sơ đồ ghế, điểm ghế, versioning | 1 | Xong |
| 3 | Phim (trailer), suất chiếu, trang rạp & lịch chiếu cho user, đánh dấu ghế cá nhân | 2 | Xong |
| 4 | Lịch hẹn giai đoạn 1 (mời, vote, chốt người), bạn bè, thông báo in-app, worker, Web Push | 3 | Chờ kiểm tra |
| 5A | Lịch hẹn giai đoạn 2: chọn suất, xếp ghế, đồ ăn, chi phí, công nợ, xác nhận | 4 | Chưa bắt đầu |
| 5B | Nhắc lịch và các thông báo theo giờ (#3, #8), tự hoàn thành | 5A | Chưa bắt đầu |
| 6 | Dashboard, ngân sách, ghi lại buổi đã xem, đánh giá cá nhân | 5B | Chưa bắt đầu |
| 7 | Chatbot AI (tầng provider, tool, lưu context) | 6 | Chưa bắt đầu |
| 8 | Production & hardening: môi trường production, sao lưu, rà soát cuối | 7 | Chưa bắt đầu |
| 9 | Công tắc tính năng theo môi trường: bật/tắt nút debug, hướng dẫn trong Cài đặt và mọi thứ thêm sau này | 8 | Chưa bắt đầu |

Trạng thái: Chưa bắt đầu · Đang làm · Chờ kiểm tra · Xong

---

## Sprint 0: Khung nền
**Mục tiêu:** dự án chạy được, có đăng nhập và phân quyền, sẵn layout cho user và admin.
**Tham chiếu:** thiết kế mục 1, 5 (model `users`), 6, 6.1 (xác thực).

**Phạm vi**
- Dependencies, scripts (`typecheck`, `seed`, `test`), cấu trúc thư mục theo `CLAUDE.md`. Test dùng Vitest và `mongodb-memory-server` chạy replica set (để test transaction ở Sprint 5A).
- Kết nối MongoDB (cache kết nối), model `User`.
- Auth.js: Google + username/password, session JWT chứa `userId` và `role`, chặn tài khoản bị khóa.
- Luồng xác thực theo mục 6.1: không đăng ký công khai; Google chỉ cho email đã có trong `users`;
  `mustChangePassword` + trang đổi mật khẩu; giới hạn đăng nhập sai (`loginAttempts`); nút đăng xuất; `callbackUrl`.
- Middleware chặn `/admin/*` với người không phải admin (lớp đầu); `src/lib/auth/guards.ts` với `requireUser()` / `requireAdmin()`
  đọc lại `status` và `role` từ DB, dùng ở mọi trang và API server (thiết kế mục 6).
- Model `User`: ít nhất một trong `username`/`email`, unique sparse index cho `username`, `email`, `phone`.
- Layout user và admin; header có menu avatar (Hồ sơ, Đăng xuất); thanh dưới cùng cấu hình được danh sách tab, chỉ hiện tab đã có
  tính năng, `/` chuyển tới tab đầu tiên khả dụng; font, dark mode; PWA: manifest, icon PNG 192/512/maskable, apple-touch-icon, `theme-color`, thẻ Apple, loại `sw.js` khỏi chặn đăng nhập.
- **Hạ tầng i18n (vi, en):** thư viện i18n, file chuỗi `vi` và `en`, chọn ngôn ngữ (`users.locale`, rồi cookie, rồi `Accept-Language`, mặc định `vi`), `<html lang>`, trang Cài đặt (`/settings`, `/admin/settings`) là nơi duy nhất cấu hình ngôn ngữ, chuyển toàn bộ chuỗi đang viết cứng, test đồng bộ khóa (`.claude/rules/i18n.md`).
- **Tách database** dev/staging/production; `npm run seed` từ chối chạy ở production trừ khi có cờ rõ ràng (chỉ seed admin).
- **Staging HTTPS: hoãn sang Sprint 8.** Giai đoạn này dev trên local trước (quyết định của chủ dự án); deploy, Google OAuth redirect cho staging và thử máy thật làm khi triển khai.
- Khung `src/ai/core/types.ts`; luật ESLint cấm import SDK AI ngoài `src/ai/providers`.
- `.env.example`, seed tài khoản admin đầu tiên.

**Ngoài phạm vi:** master data, màn hình admin tạo/reset tài khoản (làm ở Sprint 1), bất kỳ màn hình nghiệp vụ nào, adapter AI, Web Push.

**Tiêu chí hoàn thành**
- [x] Đăng nhập được bằng Google (email đã seed) và bằng username/password; email Google lạ bị từ chối.
- [x] Đăng xuất xóa session và về `/login`; sai 5 lần thì khóa 15 phút, các đợt sau gấp đôi (tối đa 24 giờ); đăng nhập đúng hoặc admin reset thì xóa bộ đếm; có test cho hàm tính thời gian khóa.
- [x] `/admin` bị chặn khi chưa đăng nhập hoặc là role user; admin bị hạ quyền hoặc khóa thì request kế tiếp bị chặn dù JWT chưa hết hạn.
- [ ] ~~Đăng nhập (Google và mật khẩu) hoạt động trên staging, thử bằng điện thoại thật.~~ Hoãn sang Sprint 8.
- [ ] ~~Cài lên màn hình chính iPhone và Android (icon, toàn màn hình, thanh trạng thái).~~ Hoãn sang Sprint 8.
- [x] Đổi ngôn ngữ trong Cài đặt thì toàn bộ chữ (kể cả lỗi) đổi theo, không còn chuỗi viết cứng; đăng xuất rồi đăng nhập lại vẫn giữ ngôn ngữ đã chọn.
- [x] `npm run seed` tạo admin, chạy lại không tạo trùng.
- [x] `/login` hiển thị đúng và không cuộn ở iPhone 13 (390×844) và iPhone 14 Pro (393×852).

---

## Sprint 1: Master data & quản lý
**Mục tiêu:** admin nhập được toàn bộ dữ liệu nền; user có hồ sơ cơ bản.
**Tham chiếu:** thiết kế mục 2.1, 2.5, 2.7, 3.5 (phần hồ sơ cơ bản), 6.1.

**Phạm vi**
- Khung CRUD dùng chung (danh sách dạng thẻ, **form là màn nhập riêng, không dùng bottom sheet**: lưu xong quay về đúng danh sách gốc rồi làm mới; xác nhận xóa, audit log), rồi dựng từng loại bên dưới trên khung này.
- **Mọi cấu hình master data gom vào một trang Danh mục, mỗi loại là một tab**; menu điện thoại là thanh điều hướng dưới chỉ hiện các trang cần thiết (xem `.claude/rules/ui.md`).
- CRUD: thương hiệu, chi nhánh (kèm thông tin gửi xe, một link Google Maps, ảnh chi nhánh), thể loại, định dạng chiếu, phân loại tuổi,
  loại ghế, ngày lễ, đồ ăn và combo (có `validFrom/validTo`).
- Bảng giá vé (`validFrom/validTo`) và hàm tính giá theo quy tắc ở thiết kế mục 2.1: độ cụ thể, loại ngày (lễ > ưu đãi > cuối tuần > thường), `priority`, rule tạo sau; có test.
- Quản lý người dùng: danh sách, tìm kiếm, **tạo tài khoản (mật khẩu tạm)**, khóa/mở khóa (thu hồi phiên), đổi role, reset mật khẩu, không hạ admin cuối cùng.
- Cài đặt hệ thống: `reminderMinutesBefore`, hạn phản hồi mặc định, thời gian quảng cáo (lưu `systemSettings`).
- Hồ sơ cơ bản: tên, avatar (Cloudinary), số điện thoại (chuẩn hóa `84xxxxxxxxx`, unique, không bắt buộc), ngôn ngữ giao diện (`users.locale`), sở thích ngồi, nút đăng xuất. Đổi mật khẩu và ngôn ngữ nằm trong trang Cài đặt, không đặt rải rác ở menu hay Hồ sơ.
- Audit log đơn giản cho thay đổi master data.
- Quyết định tên tiếng Anh cho master data hiển thị cho người dùng (thể loại, định dạng chiếu, loại ghế): thêm trường tên tiếng Anh tùy chọn, rơi về tiếng Việt khi trống.

**Ngoài phạm vi:** phòng chiếu, phim, suất chiếu, tùy chọn thông báo chi tiết.

**Tiêu chí hoàn thành**
- [x] Admin tạo được đủ master data và dùng thử trên điện thoại (chủ dự án đã thử và duyệt, 2026-11-17).
- [x] Test cho hàm tính giá: ngày thường, cuối tuần, lễ, ưu đãi, chi nhánh thắng thương hiệu, rule hết hiệu lực, `priority` phá hòa, `priceOverride`.
- [x] Khóa một user thì phiên của họ bị vô hiệu ở request kế tiếp và họ không đăng nhập lại được.
- [x] Không thể hạ quyền admin cuối cùng.
- [x] Admin tạo user mới và reset mật khẩu; user đăng nhập lần đầu bị buộc đổi mật khẩu.

---

## Sprint 2: Editor phòng chiếu
**Mục tiêu:** admin cấu hình phòng chiếu và thấy sơ đồ trực quan cùng điểm ghế. Đây là phần khó và quan trọng nhất.
**Tham chiếu:** thiết kế mục 2.2, 2.3, 5 (`auditoriums`, `auditoriumLayouts`).

**Phạm vi**
- Model `auditoriums`, `auditoriumLayouts` (version).
- Form cấu hình: số hàng/cột, thứ tự nhãn hàng, cách đánh số cột, **thanh trượt vị trí màn hình 0–100% (50 là giữa)**,
  độ rộng màn hình, khoảng cách, bậc thang, lối đi dọc/ngang, cửa vào.
- Ghi đè từng ô ghế: đổi loại, không có ghế, ghế hỏng.
- Component `SeatMap` (SVG): render từ layout, pinch-zoom, chạm ghế, xem trước theo thời gian thực.
- Hàm tính điểm ghế (`src/services/seat-score.ts`) có test; lưu điểm từng ghế khi lưu layout; heatmap.
- Versioning: lưu = tạo version mới, `currentLayoutId` trỏ tới bản mới.
- Sinh `summary` (mô tả ngắn của layout) khi lưu, để chatbot dùng ở Sprint 7.

**Ngoài phạm vi:** đánh dấu ghế của user, xếp ghế theo lịch hẹn, điểm cộng đồng.

**Tiêu chí hoàn thành**
- [x] Tạo một phòng mới, kéo thanh trượt màn hình thì sơ đồ và heatmap đổi theo (chủ dự án đã thử trên điện thoại và duyệt, 2026-11-17).
- [x] Sửa phòng tạo ra version mới, version cũ vẫn được giữ nguyên (test service `auditorium.service.test.ts`). **Giao diện không hiển thị phiên bản** (chủ dự án bỏ tab Phiên bản, 2026-11-17); dữ liệu vẫn tạo phiên bản mới mỗi lần lưu để suất chiếu và lịch hẹn sau này trỏ đúng sơ đồ cũ.
- [x] Test điểm ghế: ghế gần tâm lý tưởng điểm cao hơn ghế lệch; ghế hỏng bị phạt (`src/lib/seat-layout/generate.test.ts`).
- [x] Dùng được trên điện thoại (cấu hình và xem sơ đồ), chủ dự án đã duyệt 2026-11-17.

---

## Sprint 3: Phim, suất chiếu, trang cho user
**Mục tiêu:** user xem được rạp, lịch chiếu, trailer và tự đánh dấu ghế đẹp.
**Tham chiếu:** thiết kế mục 2.4, 3.2, 3.3.

**Phạm vi**
- Admin: CRUD phim (poster Cloudinary, trailer URL), tạo suất chiếu hàng loạt, import CSV, tự tính giờ kết thúc (thời lượng + quảng cáo).
- Trạng thái phim `upcoming` / `showing` / `ended` tự cập nhật theo ngày khởi chiếu và kết thúc.
- User: trang chi tiết phim (thông tin, trailer, các suất chiếu).
- Trailer lite embed: thumbnail, chạm mới tải iframe `youtube-nocookie` với `playsinline`, nút dự phòng.
- User: danh sách chi nhánh (bản đồ, link chỉ đường, thông tin gửi xe); xem sơ đồ phòng chỉ đọc.
- Đánh dấu ghế cá nhân (⭐ thích / 🚫 tránh, tag, ghi chú); lớp bật/tắt: điểm ghế và đánh dấu của tôi.
  `seatMarks` lưu `auditoriumId` + `layoutId` + `seatCode`; xem layout mới vẫn thấy đánh dấu cũ nếu ghế không đổi vị trí,
  phần còn lại vào mục "Đánh dấu cũ" (thiết kế mục 2.2).
- Bật tab Lịch chiếu và Rạp trên thanh dưới cùng.
- Trang lịch chiếu: lọc theo ngày, phim, chi nhánh, thể loại, định dạng, khung giờ; giá ước tính.

**Ngoài phạm vi:** đánh dấu công khai/cộng đồng (hoãn), đánh giá phòng, nút tạo lịch hẹn (có thể để nút vô hiệu).

**Tiêu chí hoàn thành**
- [x] Tạo suất hàng loạt và import CSV thành công, báo lỗi rõ khi dòng CSV sai (test `showtime.service.test.ts`, `csv.test.ts`; màn hình chưa thử trên điện thoại).
- [x] Trailer phát được ngay trong trang trên điện thoại (chủ dự án duyệt, 2026-11-18).
- [x] Đánh dấu ghế ở một phòng rồi mở lại vẫn thấy (test service `seat-mark.service.test.ts`; màn hình chưa thử trên điện thoại); sau khi phòng có version mới (không đổi ghế đó), đánh dấu vẫn hiện; ghế bị dời hoặc xóa thì vào "Đánh dấu cũ".
- [x] Bộ lọc lịch chiếu hoạt động và nhanh trên dữ liệu mẫu (chủ dự án duyệt, 2026-11-18).

---

## Sprint 4: Lịch hẹn giai đoạn 1
**Mục tiêu:** mời bạn, vote giờ, chốt người tham gia; có thông báo in-app.
**Tham chiếu:** thiết kế mục 3.4 (giai đoạn 1), 4.1, 4.3 (outbox, worker), 4.4 (Web Push), 5 (`appointments`, `friendships`, `notifications`, `pushSubscriptions`), 6.
**Đã chốt:** không mời người chưa có tài khoản (không có đăng ký công khai); không dùng OTP, giảm thiểu bằng số điện thoại unique,
giới hạn tra cứu, kết bạn cần chấp nhận (thiết kế mục 6 và 9).

**Phạm vi**
- Bạn bè: thêm qua số điện thoại hoặc link mời (chỉ với người đã có tài khoản); lời mời kết bạn cần người kia chấp nhận; tra cứu theo số
  chỉ khớp chính xác, có giới hạn tần suất; nhóm bạn cố định.
- Bật nút "Tạo lịch hẹn từ suất này" ở trang lịch chiếu (Sprint 3 để vô hiệu); tạo từ suất thì điền sẵn phim và phương án giờ đầu tiên.
- Lịch hẹn: DRAFT → INVITING → PARTICIPANTS_LOCKED, nhiều phương án giờ (có thể gắn `showtimeId`), hạn phản hồi.
- Người được mời: từ chối cả lời mời (có lý do), hoặc vote Có/Không từng phương án; đề xuất giờ khác (thêm phương án, tự vote Có);
  bảng tổng hợp vote.
- Chốt: người tạo chọn một phương án, danh sách mặc định là người vote Có (bỏ bớt/thêm người chưa từ chối trước khi chốt), rồi khóa
  danh sách (người tạo không thêm/bớt nữa). Hủy lịch hẹn. Không mời được tài khoản đang bị khóa.
- Rút lui: người tham gia tự rút trước giờ chiếu; người tạo nhận thông báo #13. (Trả ghế và tính lại tiền làm ở Sprint 5A.)
- Quá hạn phản hồi: lịch hẹn không tự hủy; người chưa trả lời hiện nhãn "Quá hạn", người tạo vẫn chốt được. **Sau hạn khóa cứng** (chủ dự án chốt 2026-11-18): người được mời không vote, đề xuất giờ hay từ chối được nữa, người tạo không mời thêm được. Hạn trả lời phải trước giờ sớm nhất đang bình chọn, và giờ đề xuất thêm không được sớm hơn hạn.
- Máy trạng thái trong service, có test các chuyển trạng thái hợp lệ và không hợp lệ.
- Thông báo cho sự kiện #1, #2, #4, #7, #13 (không có #3 vì cần tác vụ chạy theo giờ, làm ở Sprint 5B):
  - **In-app:** chuông trên header, badge; ghi trực tiếp vào `notifications`/`notificationDeliveries`.
  - **Worker:** `instrumentation.ts` khởi động vòng lặp khi `ENABLE_WORKER=true`; `findOneAndUpdate` để claim bản ghi, chống gửi trùng; retry tối đa 3 lần.
  - **Service worker và offline:** `public/sw.js` (không cache dữ liệu cá nhân, ưu tiên mạng), trang `/offline`, hướng dẫn cài app trong Cài đặt (quy tắc `.claude/rules/pwa.md`).
  - **Web Push** (thiết kế mục 4.4): service worker `public/sw.js`, cặp khóa VAPID trong env, thư viện `web-push`; nút "Bật thông báo trên thiết bị này" và
    "Gửi thử" trong Hồ sơ (kèm hướng dẫn cài app cho iPhone); `pushSubscriptions`; xóa subscription khi gặp 404/410; chạm thông báo mở đúng trang.
- Tùy chọn bật/tắt từng loại thông báo và từng thiết bị nhận push trong hồ sơ. Bật tab Lịch hẹn.

**Ngoài phạm vi:** chọn suất/phòng/ghế/đồ ăn, tính tiền, Zalo, mọi thông báo theo giờ (kể cả #3).

**Tiêu chí hoàn thành**
- [ ] Đi hết luồng với 3 tài khoản: mời → đề xuất giờ khác → vote → chốt người.
- [x] Sau khi chốt, người tạo không thêm/bớt được người; người tham gia tự rút được và người tạo nhận thông báo (test `appointment.service.test.ts`; màn hình chưa thử trên điện thoại).
- [x] Người vote Có phương án khác phương án được chọn không nằm trong danh sách và không hiện ở bước chốt: màn chốt chỉ liệt kê người đã vote Có giờ được chọn (đổi ngày 2026-11-18 so với bản đầu "người tạo phải thêm tay"; service vẫn nhận người được mời chưa từ chối, giao diện không đưa ra).
- [ ] Thông báo in-app đến đúng người, đúng thời điểm.
- [ ] Web Push: bật trên Android và trên iPhone (đã cài PWA), "Gửi thử" (admin gửi từ Cài đặt quản trị tới người dùng chọn) nhận được kể cả khi đã đóng app; sự kiện mời/chốt/hủy đến đúng người.
- [x] Không gửi trùng khi chạy hai worker; một thiết bị lỗi 410 thì subscription bị xóa, các thiết bị khác vẫn nhận (test `src/notifications/deliver.test.ts` với bộ gửi giả).
- [x] Test máy trạng thái pass; test tra cứu số điện thoại bị giới hạn tần suất (`state.test.ts`, `friend.service.test.ts`).

---

## Sprint 5A: Lịch hẹn giai đoạn 2
**Mục tiêu:** hoàn thiện lịch hẹn: chọn suất, xếp ghế, đồ ăn, chi phí, công nợ.
**Tham chiếu:** thiết kế mục 3.4 (giai đoạn 2, sau buổi xem), 3.1 (nguyên tắc số liệu), 4.1, 5.
**Đã chốt:** chỉ theo dõi đã trả/chưa trả, chưa làm VietQR (thiết kế mục 9, câu 6).

**Phạm vi**
- PLANNING → CONFIRMED → COMPLETED: chọn suất (điền sẵn nếu phương án đã chốt có `showtimeId`), xếp ghế từng người (kéo thả, ghế đôi gán
  2 người, gợi ý dãy ghế liền nhau điểm cao), đồ ăn từng người hoặc combo chung, cách trả tiền, tính tiền từng người
  (giá ước tính được lưu lại lúc tính).
- Chống trùng ghế: chốt/đổi ghế trong transaction MongoDB, từ chối ghế đã có người, ghế hỏng hoặc không tồn tại.
- Rút lui: trả ghế và tính lại tiền (phần còn lại của luồng rút lui từ Sprint 4).
- Sửa sau khi CONFIRMED (đổi ghế/giờ): chỉ người tạo sửa được, gửi #6 (in-app + Web Push) cho người bị ảnh hưởng.
- COMPLETED: người tạo bấm "Đã xem xong" sau giờ chiếu (tự động chuyển ở Sprint 5B).
- Nhập chi phí thực tế: người tạo nhập phần của từng người và người trả; mỗi người thấy và chỉnh được phần của mình.
  Ghi `expenses` cho từng người (phần của chính họ); một người trả hết thì tạo `expenseShares`, người nợ bấm "Tôi đã trả", người được nợ xác nhận.
- Thông báo #5 và các sự kiện còn lại của giai đoạn này (in-app + Web Push, dùng hạ tầng của Sprint 4).

**Ngoài phạm vi:** Zalo, nhắc theo giờ (#3, #8), tự chuyển COMPLETED, nhắc trả tiền (#10), phim yêu thích sắp chiếu (#12), dashboard.

**Tiêu chí hoàn thành**
- [ ] Đi trọn vòng đời một lịch hẹn: xếp ghế, đồ ăn, xác nhận, hoàn thành, nhập chi phí.
- [ ] Hai người cùng chọn một ghế thì chỉ một người thành công (có test với transaction).
- [ ] Một người trả hết: tổng `expenses` của cả nhóm đúng bằng hóa đơn, công nợ đúng, luồng "Tôi đã trả" → "Đã nhận" chạy được (có test).
- [ ] Người rút lui thì ghế được trả lại và tiền chia lại đúng.

---

## Sprint 5B: Nhắc lịch & thông báo theo giờ
**Mục tiêu:** nhắc trước giờ chiếu và các thông báo theo giờ, gửi qua in-app và Web Push (hạ tầng đã có từ Sprint 4).
**Tham chiếu:** thiết kế mục 4.1, 4.3, 4.4, 5.

**Phạm vi**
- `scheduledNotifications` với `sendAt = giờ chiếu − reminderMinutesBefore`; tác vụ chạy mỗi phút trong worker, claim bằng `findOneAndUpdate` chống gửi trùng.
- Tính lại hoặc hủy khi đổi giờ, hủy lịch hẹn, người tham gia rút lui, hoặc admin đổi `reminderMinutesBefore`.
- Thông báo #3 (sắp hết hạn phản hồi, 12 giờ trước hạn, gửi người chưa trả lời) và #8 (nhắc trước giờ chiếu: phim, giờ, rạp + phòng, ghế của người nhận, chỉ đường, gửi xe).
- Tự chuyển COMPLETED sau giờ kết thúc suất chiếu nếu người tạo chưa bấm.

**Ngoài phạm vi:** Zalo ZNS (giai đoạn sau), nhắc trả tiền (#10), phim yêu thích sắp chiếu (#12), dashboard.

**Tiêu chí hoàn thành**
- [ ] Nhắc lịch (#8) đến thiết bị (Android và iPhone đã cài PWA) đúng thời điểm theo `reminderMinutesBefore`; đổi số phút thì lịch đã tạo được tính lại.
- [ ] Không gửi trùng khi tác vụ chạy chồng nhau (chạy hai worker thử).
- [ ] Thông báo #3 gửi đúng 12 giờ trước hạn phản hồi cho người chưa trả lời.
- [ ] Hủy lịch hẹn hoặc rút lui thì nhắc tương ứng bị hủy/tính lại.
- [ ] Lịch hẹn tự chuyển COMPLETED sau giờ kết thúc suất; khởi động lại server không làm mất hoặc gửi trùng.

---

## Sprint 6: Dashboard & ngân sách
**Mục tiêu:** user thấy chi tiêu và thống kê; hoàn thiện các tính năng bổ sung.
**Tham chiếu:** thiết kế mục 3.1, 3.2 (đánh giá, lịch sử ngồi), 2.7, 4.1 (#9, #11).
**Đã chốt:** lớp cộng đồng (đánh dấu công khai, điểm cộng đồng, duyệt) hoãn sang giai đoạn sau vì nhóm nhỏ.

**Phạm vi**
- Dashboard: chi tiêu theo ngày/tuần/tháng/năm (vé và đồ ăn) lấy từ `expenses` của chính user, thống kê thể loại/rạp/khung giờ,
  người hay đi cùng, công nợ (từ `expenseShares`). Bật tab Tổng quan.
- Ngân sách tháng (vé, đồ ăn), cảnh báo 80% và 100%.
- Ghi lại buổi đã xem (xem một mình hoặc đặt ngoài app), ghi vào `expenses`.
- Đánh giá phim, đánh giá ghế và phòng sau buổi xem (lưu cá nhân).
- Lịch sử ngồi ở trang phòng ("bạn đã ngồi phòng này 3 lần: F7, F8, G9").
- **Nhóm "Thường tới" ở đầu danh sách rạp** (`/cinemas`, thêm 2026-11-18 theo yêu cầu của chủ dự án): các chi nhánh user hay đến nhất, xếp nhiều buổi nhất trước, bằng nhau thì buổi gần nhất trước. **Chỉ tính buổi đã hoàn thành** (lịch hẹn COMPLETED, cộng buổi ghi lại thủ công ở mục trên), không tính lượt mở trang hay ghim tay. Chưa có buổi nào thì không hiện nhóm. Dữ liệu cá nhân nên không cache qua request (`caching.md` quy tắc 1). Dùng chung nguồn đếm với thống kê rạp hay đi và lịch sử ngồi.
- Báo cáo sai thông tin phòng (user gửi, admin xem).
- Thông báo #9 (nhắc nhập chi phí/đánh giá) và #11 (ngân sách).

**Ngoài phạm vi:** chatbot, nhắc trả tiền, gợi ý phim, lớp cộng đồng.

**Tiêu chí hoàn thành**
- [ ] Số liệu dashboard khớp với dữ liệu chi phí đã nhập, không đếm trùng khi một người trả hộ cả nhóm (có test cho các hàm tổng hợp).
- [ ] Cảnh báo ngân sách hiện đúng ở 80% và 100%.
- [ ] Đánh giá ghế sau buổi xem hiện ở lịch sử ngồi của chính user.
- [ ] Nhóm "Thường tới" ở `/cinemas` chỉ gồm rạp user đã xem xong, đúng thứ tự (nhiều buổi trước, bằng nhau thì gần nhất trước), mỗi người chỉ thấy của mình; chưa có buổi nào thì không hiện nhóm.

---

## Sprint 7: Chatbot AI
**Mục tiêu:** hỏi đáp về dữ liệu app bằng tool calling, đổi được provider.
**Tham chiếu:** thiết kế mục 7 (7.1 đến 7.5), 5 (`chatSessions`, `chatMessages`, `aiUsage`).
**Cần có:** API key của provider đã chọn (credit từ gói Claude Team hoặc Gemini).

**Phạm vi**
- Adapter cho Claude và Gemini, registry/factory, decorator retry + usage-tracking + fallback.
- Tool (chỉ đọc): `search_branches`, `get_auditorium_seats`, `suggest_seats`, `search_showtimes`,
  `get_spending_summary`, `get_my_appointments`; `userId` luôn lấy từ session.
- Orchestrator: vòng lặp tool tối đa 5 lượt, lưu lịch sử ở định dạng trung lập, tóm tắt hội thoại dài,
  lưu entity đang nhắc tới trong `chatSessions.state`.
- Hạn mức theo user mỗi ngày (tin nhắn và token); nội dung do người dùng nhập đưa vào tool được đóng khung là dữ liệu (thiết kế mục 7.5).
- Màn Chat (mobile), bật tab Chat, cài đặt AI cho admin (provider, model, dự phòng, hạn mức, thống kê token).

**Ngoài phạm vi:** RAG/vector search cho ghi chú và review, MCP server riêng, tool ghi/xóa dữ liệu.

**Tiêu chí hoàn thành**
- [ ] Trả lời đúng các câu như "phòng này ghế nào đẹp?", "tháng này tôi tiêu bao nhiêu?", "tối thứ 7 có phim kinh dị nào?".
- [ ] Đổi provider trong cài đặt thì chat vẫn chạy, hội thoại cũ vẫn tiếp tục được.
- [ ] Thử xem dữ liệu người khác bằng cách ép AI truyền `userId` đều thất bại.
- [ ] Provider chính lỗi thì tự chuyển sang provider dự phòng.
- [ ] Vượt hạn mức ngày thì chatbot từ chối lịch sự và không gọi provider.

---

## Sprint 8: Production & hardening
**Mục tiêu:** môi trường production ổn định, có sao lưu, đã rà soát cuối. (Hosting và staging đã làm từ Sprint 0.)
**Tham chiếu:** thiết kế mục 1 (Triển khai), 4.3.

**Phạm vi**
- **Staging HTTPS** (hoãn từ Sprint 0): deploy lên dịch vụ Node chạy liên tục (Railway, Render hoặc VPS), Google OAuth redirect cho staging, DB staging riêng; thử đăng nhập Google và mật khẩu trên điện thoại thật; cài PWA lên iPhone 13, iPhone 14 Pro và Android; đo lại các màn vừa khít và vùng an toàn trên máy thật.
- Môi trường production tách khỏi staging: database riêng, biến môi trường (Atlas, Google OAuth redirect, Cloudinary, AI, khóa VAPID riêng cho Web Push), domain; không commit secret.
- MongoDB Atlas: giới hạn IP/tài khoản, index cần thiết, sao lưu định kỳ và thử khôi phục.
- Seed admin production bằng cờ rõ ràng; kiểm tra PWA cài được trên iOS và Android.
- Rà soát cuối: lint, typecheck, test, phân quyền (thử truy cập dữ liệu người khác), thử toàn bộ luồng trên điện thoại thật.

**Ngoài phạm vi:** tính năng mới.

**Tiêu chí hoàn thành**
- [ ] Production chạy qua HTTPS, đăng nhập Google và mật khẩu hoạt động.
- [ ] Nhắc lịch chạy đúng giờ trên production; khởi động lại server không làm mất hoặc gửi trùng.
- [ ] Có bản sao lưu và đã thử khôi phục một lần.
- [ ] Cài PWA lên màn hình chính trên iOS và Android, và nhận được Web Push thật trên production.

---

## Sprint 9: Công tắc tính năng theo môi trường
**Mục tiêu:** một chỗ duy nhất quyết định thứ nào hiện ở môi trường nào (dev, staging, production), thay cho các điều kiện `NODE_ENV` rải rác; admin bật/tắt được mà không cần sửa code.
**Tham chiếu:** `src/app/layout.tsx` (nút ghi DOM `DomRecorder`), `src/app/api/dev/dom/route.ts`, `src/components/install-guide.tsx` (hướng dẫn cài app trong Cài đặt người dùng), thiết kế mục 2.7 (cài đặt hệ thống).
**Bối cảnh:** hiện nút debug chỉ tắt bằng `NODE_ENV !== "production"` viết cứng ở vài nơi, còn các thứ như hướng dẫn cài app, thẻ "Cài app" hay các màn thử nghiệm luôn hiện. Sau này sẽ còn thêm nữa (màn debug, nút thử, hướng dẫn, tính năng chưa hoàn thiện), nên cần một cơ chế chung thay vì mỗi chỗ tự xử lý.

**Phạm vi**
- **Danh mục công tắc ở một file** (`src/lib/feature-flags.ts`): mỗi công tắc có khóa, mô tả, nhóm (debug, hướng dẫn, thử nghiệm), mặc định cho từng môi trường (dev, staging, production) và nơi dùng (máy chủ, giao diện, hoặc cả hai). Thêm công tắc mới = thêm một dòng vào danh mục.
- **Biết đang ở môi trường nào:** biến `APP_ENV` (`dev` | `staging` | `production`), tách khỏi `NODE_ENV` (staging vẫn chạy `NODE_ENV=production`); thiếu biến thì coi là `production` (an toàn: không lộ nút debug).
- **Bật/tắt theo giá trị mặc định của môi trường, có thể ghi đè từ Admin** (Cài đặt > Tính năng): admin thấy danh sách theo nhóm, mỗi công tắc ghi giá trị đang áp dụng, mặc định của môi trường, và công tắc Bật/Tắt/Theo mặc định. Lưu ở `systemSettings`, có audit log, cache theo tag và `updateTag` khi ghi (đúng `caching.md`).
- **Đọc ở cả hai phía:** hàm `isFeatureEnabled(key)` cho máy chủ; giao diện nhận giá trị qua một provider ở layout (chuỗi/số thuần, không cache dữ liệu cá nhân); route API dev trả 404 khi công tắc tắt.
- **Chuyển các thứ đang có sang công tắc:** nút ghi DOM (`DomRecorder` và `/api/dev/dom`), thẻ hướng dẫn cài app (`InstallGuide`) và thẻ gửi thử push trong Admin, và mọi điều kiện `NODE_ENV` còn lại trong mã nguồn.
- **Quy tắc cho việc làm sau này:** thêm vào `CLAUDE.md` và `.claude/rules/`: mọi nút debug, hướng dẫn, màn thử nghiệm hay tính năng chưa hoàn thiện đều phải đăng ký công tắc, không viết `NODE_ENV` rời. Có test quét mã nguồn: báo đỏ nếu còn `NODE_ENV` ngoài file danh mục, hoặc có công tắc nào dùng mà chưa đăng ký.
- Mặc định đề xuất: nút debug bật ở dev, tắt ở staging và production; hướng dẫn cài app bật ở mọi môi trường; thẻ thử push của admin bật ở dev và staging, tắt ở production.

**Ngoài phạm vi:** công tắc theo từng người dùng hoặc phần trăm người dùng (A/B), phân quyền theo công tắc, dịch vụ công tắc bên ngoài.

**Tiêu chí hoàn thành**
- [ ] Đặt `APP_ENV=production`: nút debug không hiện và `/api/dev/dom` trả 404; đặt `APP_ENV=dev`: nút hiện lại; thiếu biến thì hành xử như production.
- [ ] Admin tắt hướng dẫn cài app ở Cài đặt > Tính năng thì thẻ đó biến mất khỏi Cài đặt người dùng ở lần tải kế tiếp, không cần deploy lại; bật lại thì hiện lại.
- [ ] Không còn `process.env.NODE_ENV` rải rác trong `src` (test kiểm tra).
- [ ] Thêm một công tắc mới chỉ cần sửa file danh mục và có test báo đỏ nếu thiếu mô tả hoặc thiếu mặc định cho một môi trường.
- [ ] Mỗi lần đổi công tắc có dòng trong nhật ký thay đổi.

---

## Nhật ký tiến độ
Mỗi sprint xong thêm 3 đến 6 dòng: đã làm gì, còn dở gì, quyết định đã chốt, file chính nằm ở đâu.

### Sprint 0 (2026-11-16)
- Xong: scaffold Next.js, đăng nhập mật khẩu và Google (chỉ email được cấp), khóa đăng nhập tăng dần, `requireUser`/`requireAdmin` đọc DB mỗi request,
  đổi mật khẩu bắt buộc, layout user và admin, i18n vi/en (cấu hình ở Cài đặt), PWA cơ bản (icon, manifest, thẻ Apple), logo và nhân vật, seed admin, test với MongoDB replica set.
- Quyết định: tên app SeatMate; logo là ảnh `duo-watching`; màu nhấn hồng-magenta `#C61583`; không có đăng ký công khai; Web Push thay Zalo trong MVP; dev trên local trước.
- Còn dở (hoãn sang Sprint 8): staging HTTPS, thử máy thật, cài PWA, service worker và trang offline làm ở Sprint 4.
- File chính: `src/auth.ts`, `src/lib/auth/guards.ts`, `src/services/user.service.ts`, `src/i18n/`, `src/messages/`, `.claude/rules/`.

### Sprint 1 (2026-11-17)
- Xong: khung CRUD master data (form là màn riêng, quay về đúng tab và tìm kiếm); 9 loại trong trang Danh mục: thương hiệu, chi nhánh, thể loại, định dạng, độ tuổi, loại ghế, ngày lễ, đồ ăn, combo, cộng bảng giá vé;
  hàm tính giá thuần `resolveTicketPrice` (17 test); quản lý người dùng (tạo bằng mật khẩu tạm, khóa/mở, đổi vai trò, đặt lại mật khẩu, không hạ hay khóa admin cuối, không tự khóa mình);
  cài đặt hệ thống (mốc nhắc, hạn phản hồi, quảng cáo); hồ sơ (ảnh Cloudinary, số điện thoại, sở thích ngồi); `npm run seed:catalog` nạp dữ liệu mẫu (tên có "(mẫu)").
- Quyết định: ngày lưu dạng `YYYY-MM-DD` giờ Việt Nam; combo gồm các món (cùng thương hiệu, có số lượng) và chiết khấu (đồng hoặc %), **giá không lưu mà tính** từ giá món hiện tại (`src/services/pricing/combo-price.ts`); chi nhánh dùng một link Google Maps (không lưu lat/lng) và có ảnh; `priceRules` phẳng (`brandId` hoặc `branchId`), ngày ưu đãi gắn một thứ trong tuần (`weekday`), khung giờ tính theo giờ BẮT ĐẦU suất, rule loại ngày "thường" là nền cho cả ngày lễ và cuối tuần;
  hạn phản hồi là số giờ trước giờ chiếu; "thu hồi phiên" nhờ guard đọc lại DB mỗi request (không cần số phiên bản); ảnh tải thẳng lên Cloudinary bằng chữ ký dùng một lần, cắt vuông 256px, mỗi người một ảnh ghi đè.
- Làm thêm trong sprint: **màu thương hiệu cấu hình được** (Cài đặt admin > Màu thương hiệu, mọi token tính từ `--brand-h/c/l`, có nút đặt lại; icon và splash PWA vẫn là ảnh tĩnh); **chiến lược cache và giảm loading** (`.claude/rules/caching.md`: `staleTimes`, dedupe người dùng theo request, cache danh sách thương hiệu có tag, giữ khung tiêu đề/tab/menu khi chuyển màn, bỏ `router.refresh()` thừa); `PageHeader` màn con dạng thanh điều hướng dính đầu màn; token `gap-field`.
- Còn dở: tiêu chí "dùng thử trên điện thoại" cần chủ dự án kiểm tra; tải ảnh Cloudinary thật chưa thử (cần khóa trong `.env.local`); chưa thử trên iPhone thật (bàn phím, thanh Lưu cố định).
- File chính: `src/services/master-data/`, `src/services/pricing/ticket-price.ts`, `src/services/admin-user.service.ts`, `src/services/settings.service.ts`, `src/services/profile.service.ts`,
  `src/app/admin/master-data/_sections/` (mỗi loại một thư mục, dựng bằng `createSection`), `src/components/admin/resource-*.tsx`, `src/lib/cloudinary.ts`, `scripts/seed-catalog.ts`, `.claude/rules/admin-crud.md`.

### Sprint 2 (2026-11-17)
- Xong (code, test, build): model `Auditorium` và `AuditoriumLayout` (version bất biến); hàm thuần sinh lưới ghế và tính điểm (`src/lib/seat-layout/`, `src/services/seat-score.ts`, có test); `auditorium.service.ts`
  (lưu layout đổi thì tạo version mới trong transaction, giữ nguyên thì chỉ đổi tên; điểm ghế và `summary` tính lúc lưu); component `SeatMap` dùng chung (SVG, pinch-zoom, chạm ghế, heatmap);
  màn admin `/admin/auditoriums` (danh sách, thêm, sửa với hai tab Thông số và Ghế; không có màn xem phiên bản); ba phòng mẫu trong `npm run seed:catalog`.
- Quyết định: **mô tả cho chatbot (`summary`) tự tổng hợp từ thông số phòng mỗi lần lưu** (`buildLayoutSummary`), admin không nhập và giao diện không hiển thị; **không có màn hình phiên bản** (chủ dự án bỏ), dữ liệu vẫn giữ phiên bản (`listLayoutVersions` và `getLayout(id, layoutId)` ở service sẵn cho Sprint 3 trở đi); **điểm ghế tính theo mét và góc nhìn thật** (`src/services/seat-score.ts`): góc nhìn ngang tới màn hình (THX tối thiểu 36°, lý tưởng khoảng 40°), góc ngửa cổ tới mép trên màn hình (SMPTE không quá 35°), lệch khỏi trục màn hình, đầu người phía trước che đáy màn hình (tính theo bậc thang, mỗi bậc 0,2 m; phòng không đặt bậc thang coi là phẳng), cân bằng âm thanh theo tâm phòng và độ sâu tham chiếu 65%, cửa, ghế hỏng. Các con số vật lý (ghế rộng 0,55 m, hàng sâu 1,0 m, mắt cao 1,1 m, màn tỉ lệ 2:1 cách sàn 1,0 m) là **giả định** vì layout không có kích thước thật; hệ số và dạng đường cong là phán đoán; nguồn chỉ là bài viết thứ cấp, chưa đọc tài liệu gốc SMPTE/THX. Mọi hằng số gom ở đầu file để chỉnh. Đổi công thức thì chạy `npm run rescore` để tính lại phòng đã lưu. Tâm ngang lý tưởng = tâm màn hình **đã vẽ** (bị kẹt trong phòng nên thanh trượt ở 0% hoặc 100% không đẩy tâm ra tận mép như công thức gốc ở thiết kế 2.3);
  ghế đôi là một ghế chiếm hai ô liền nhau (không ghép qua lối đi hay ô trống); lối đi ngang tính theo thứ tự nhãn hàng, bậc thang tính từ hàng gần màn hình; heatmap tính theo điểm thấp nhất và cao nhất của chính layout đó (không tính ghế hỏng/che tầm nhìn, nếu không một ghế hỏng điểm 0 làm phẳng cả thang)
  (một dải theo màu chủ đạo qua ba mốc: tông tối, `--primary`, tông nhạt; chủ dự án chọn thay cho thang xanh-vàng ban đầu, rồi yêu cầu tăng tương phản nên mở rộng dải; chữ mã ghế đổi sang tối ở đầu nhạt); ghi đè ghế lưu theo ô và gộp về dạng ngắn nhất; loại ghế đang được layout dùng thì không xóa được; phóng sơ đồ bằng cách đổi `viewBox` của SVG (không dùng CSS `transform`/`will-change`, vì bản đó để lộ bóng ma của sơ đồ 1x dưới sơ đồ đã phóng và làm mờ nét); chọn ô trên điện thoại bằng chạm (có chạm nhãn hàng/cột để chọn cả hàng/cột), chưa làm kéo vùng chọn.
- Còn dở (chuyển sang sprint sau): **chạy `npm run rescore`** để tính lại điểm ghế của phòng đã lưu theo công thức mới (lệnh chưa chạy trên DB dev); chưa đo ở cỡ chữ 125% và 150%; chữ nhãn hàng/cột và "MÀN HÌNH" trong sơ đồ nhỏ hơn 12px ở mức 1× và ghế 16px ở mức 1× (phải phóng to để chọn); chưa hỗ trợ ghế giường nằm riêng trong heatmap; chưa cảnh báo khi dãy ghế đôi có ô lẻ; xóa phòng chưa chặn khi có suất chiếu (Sprint 3 thêm). Chủ dự án đã thử và duyệt Sprint 2 ngày 2026-11-17.
- File chính: `src/lib/seat-layout/`, `src/services/auditorium.service.ts`, `src/services/seat-score.ts`, `src/components/seat-map/`, `src/components/admin/auditorium-editor/`, `src/app/admin/auditoriums/`.

### Sprint 3 (2026-11-17)
- Xong (code, test, build; **chưa thử trên điện thoại**): model `Movie`, `Showtime`, `SeatMark`; `movie.service` (trạng thái phim **tính theo ngày**, không lưu, nên không cần job cập nhật), `showtime.service` (tạo hàng loạt, nhập CSV, tìm suất kèm giá ước tính), `seat-mark.service` (đánh dấu theo phiên bản layout), `cinema.service`;
  admin `/admin/movies` (danh sách và form phim có poster Cloudinary, trailer YouTube, thể loại, định dạng; tab Suất chiếu; tạo hàng loạt; nhập CSV; mục Phim bật ở thanh dưới admin);
  user: `/showtimes` (dải ngày 15 ngày, lọc phim, rạp, thể loại, định dạng, khung giờ trên URL; hàng phim ở đầu trang), `/movies/[id]` (thông tin, trailer lite embed, các suất), `/cinemas`, `/cinemas/[branchId]`, `/cinemas/[branchId]/[auditoriumId]` (sơ đồ chỉ đọc, hai lớp Điểm ghế và Đánh dấu của tôi, ⭐ thích / tránh, tag nhanh, ghi chú, mục "Đánh dấu cũ"); hai tab Lịch chiếu và Rạp đã bật; `npm run seed:movies` nạp 4 phim mẫu và 84 suất (chạy sau `seed:catalog`).
- Quyết định: **tạo hàng loạt theo khoảng ngày (từ, đến) × nhiều giờ × nhiều phòng**, mỗi lần tối đa 500 suất, suất trùng giờ với suất khác cùng phòng bị bỏ qua và báo số lượng; **CSV chạy tất cả hoặc không**: cột `movie,branch,auditorium,start,format,price` (giờ `YYYY-MM-DD HH:mm` giờ Việt Nam, giá để trống thì theo bảng giá, khớp tên không phân biệt dấu và hoa thường, dòng đầu tiêu đề có hay không đều được, ngăn cách `,` `;` hoặc tab), một dòng sai hoặc trùng giờ thì không tạo suất nào và liệt kê từng dòng lỗi; giờ kết thúc = bắt đầu + thời lượng + phút quảng cáo (cài đặt hệ thống); suất gắn `layoutId` hiện tại của phòng;
  **giá ước tính** = giá ghế mặc định của layout theo bảng giá (`resolveTicketPrice`), có `priceOverride` thì dùng giá đó; **một ghế một đánh dấu cho mỗi người trong một phòng**, đánh dấu còn hiệu lực ở layout mới khi ghế giữ nguyên mã, hàng, cột và độ rộng, không thì vào "Đánh dấu cũ" (`src/lib/seat-layout/marks.ts`); **bản đồ chi nhánh**: nút "Chỉ đường" mở link Google Maps ngoài app (không thêm thư viện bản đồ); khung sửa đánh dấu là phần của trang dưới sơ đồ, **không dùng bottom sheet** vì ô ghi chú trong sheet gây lỗi bàn phím trên PWA iOS; nút "Tạo lịch hẹn" hiện nhưng tắt (Sprint 4 bật); xóa phòng bị chặn khi còn suất chiếu; thể loại, định dạng, phân loại tuổi đang được phim dùng thì không xóa được.
- Làm thêm theo yêu cầu (2026-11-17): **công tắc Bật/Tắt** (`active`, mặc định bật, bản ghi cũ chưa có giá trị tính là bật) cho thương hiệu, chi nhánh, thể loại, định dạng: mục tắt không hiện ở bộ lọc, danh sách rạp, suất chiếu của user (suất của chi nhánh, thương hiệu hay định dạng đang tắt bị ẩn) và không được gợi ý khi admin tạo mới, mục đang được dùng thì vẫn hiện; **lọc phim theo khoảng thời gian**: cài đặt hệ thống `movieUpcomingDays` (mặc định 30), bộ lọc phim và hàng poster chỉ gồm phim đang chiếu và phim khởi chiếu trong N ngày tới (`isOfferedInFilter`); **khung giờ chiếu do admin cấu hình** (cài đặt hệ thống `timeSlots`: tên, tên tiếng Anh, từ, đến, tối đa 8, không chồng lấn; mặc định 4 khung cũ; `00:00` ở ô Đến là hết ngày; xóa hết khung thì ẩn bộ lọc Khung giờ; đổi khung giờ chỉ đổi cách lọc, không đụng suất đã tạo). Bảng giá và các lựa chọn khác trong Danh mục chưa lọc theo công tắc.
- **Chốt 2026-11-18: chủ dự án xác nhận Sprint 3 xong.** (Mục dưới là ghi chú lúc đó.) Còn dở cũ: **thử trên điện thoại** (trailer phát tại chỗ trên iPhone, tốc độ bộ lọc, khung đánh dấu ghế, nhập CSV bằng file); trailer mẫu chưa có (thêm link YouTube thật ở Admin > Phim); chưa có đánh giá phòng và lịch sử ngồi (thiết kế 3.2, để Sprint 6); chưa đo ở cỡ chữ 125% và 150%.
- File chính: `src/services/{movie,showtime,seat-mark,cinema}.service.ts`, `src/lib/showtime/`, `src/lib/movie/`, `src/lib/seat-layout/marks.ts`, `src/app/admin/movies/`, `src/components/admin/showtime-*.tsx`, `src/app/(user)/{showtimes,movies,cinemas}/`, `src/components/movie/`, `src/components/seat-map/room-seat-view.tsx`, `scripts/seed-movies.ts`.

### Sprint 4 (2026-11-18)
- Xong (code, test, build; **chưa thử trên điện thoại**; đã chạy thử bản dev với DB tạm, đăng nhập thật và mở mọi trang mới đều trả 200, không lỗi server; chưa bấm thao tác bằng trình duyệt vì extension Chrome không kết nối):
  **Bạn bè** (`friendships`, `friendGroups`, `friendLookups`, `users.inviteCode`; kết bạn bằng số điện thoại hoặc link mời `/friends/invite/[code]`, lời mời cần chấp nhận, hai bên cùng gửi thì thành bạn, nhóm bạn; tra cứu số trả lời giống nhau dù số có tài khoản hay không, 10 lần mỗi giờ).
  **Lịch hẹn giai đoạn 1** (`appointments`; `src/lib/appointment/state.ts` là máy trạng thái thuần có test; `appointment.service.ts`: tạo, gửi, vote, đề xuất giờ, từ chối, chốt, rút lui, hủy; lưu bằng optimistic concurrency và thử lại); màn `/appointments`, `/appointments/new`, `/appointments/[id]`; tab Lịch hẹn bật; nút "Tạo lịch hẹn từ suất này" trên thẻ suất chiếu.
  **Thông báo** (`notifications`, `notificationDeliveries`, `pushSubscriptions`; sự kiện #1, #2, #4, #7, #13; chuông và badge ở header, `/notifications`).
  **Web Push** (`web-push`, VAPID, `public/sw.js`, `/offline`, worker `src/notifications/worker.ts` qua `src/instrumentation.ts`; Cài đặt người dùng: bật theo thiết bị, tắt từng thiết bị, bật/tắt từng loại, hướng dẫn cài app; **nút Gửi thử nằm ở Admin > Cài đặt > Thử thông báo đẩy, admin chọn người nhận**).
- Quyết định: **thông báo trong app luôn ghi** (khớp thiết kế 4.1), công tắc từng loại trong Cài đặt chỉ điều khiển **push**; nội dung thông báo không lưu câu chữ mà lưu id và dữ kiện, dựng chữ khi hiển thị hoặc khi đẩy theo ngôn ngữ người nhận (có thay cặp xưng hô); ghi thông báo lỗi chỉ log, không làm hỏng thao tác lịch hẹn;
  trạng thái người tham gia thêm `excluded` (người tạo không xếp vào danh sách khi chốt) ngoài bốn giá trị trong thiết kế; vote Có ở bất kỳ phương án nào là đồng ý, bỏ hết vote Có thì về "chưa trả lời"; người tạo chỉ nhận thông báo "đồng ý" lần đầu một người chuyển sang đồng ý, không nhận mỗi lần đổi vote;
  worker nhận việc bằng `findOneAndUpdate` (lấy lại việc kẹt quá 2 phút), thử tối đa 3 lần cách 1 và 5 phút; một thiết bị lỗi tạm thời mà thiết bị khác nhận được thì tính là đã gửi; **người tạo lịch hẹn không sửa được lịch hẹn nháp** (service có `send: false`, `sendInvitations`, nhưng giao diện chỉ có "Gửi lời mời"); đề xuất giờ khác chỉ nhập giờ tay (service cũng nhận `showtimeId`).
- Cần làm để chạy: thêm vào `.env.local` (và staging) `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (tạo bằng `npx web-push generate-vapid-keys`), `VAPID_SUBJECT` (dạng `mailto:địa-chỉ-liên-hệ` hoặc một địa chỉ https), `ENABLE_WORKER=true`. Thiếu khóa thì Cài đặt báo chưa bật thông báo đẩy, thông báo trong app vẫn chạy.
- Thêm theo yêu cầu: **admin chỉnh được thời gian giữ push khi máy offline** (cài đặt hệ thống `pushTtlHours`, mặc định 24 giờ, từ 1 giờ đến 4 tuần = 672 giờ; ở Admin > Cài đặt > Cài đặt hệ thống); worker đọc một lần mỗi vòng gửi. Thông báo trong app không bao giờ hết hạn.
- Thêm theo yêu cầu: **mời thêm bạn** vào lịch hẹn đang mời hoặc bản nháp (`inviteMore`; chỉ người tạo, chỉ bạn bè đang hoạt động chưa có trong lịch hẹn, kể cả người đã từ chối thì không mời lại, tối đa 20 người; chỉ người mới nhận thông báo #1, bản nháp thì gửi cho tất cả khi gửi đi).
- Thêm theo yêu cầu: **thông báo kết bạn** (ngoài danh sách #1 đến #13 của thiết kế): `friend_request` gửi cho người được mời kết bạn, `friend_accepted` gửi cho người đã gửi lời mời khi được đồng ý (kể cả khi hai bên cùng gửi cho nhau); từ chối **không** báo; bấm thông báo mở `/friends`; có công tắc push riêng cho từng loại; `npm run seed:users` tạo 3 tài khoản mẫu (an, binh, chi; mật khẩu mẫu ghi trong `scripts/seed-users.ts`, **xóa trước khi lên production**) rồi kết bạn chéo mọi tài khoản người dùng; `npm run seed:friends` chỉ kết bạn chéo.
- Còn dở: **chủ dự án cần thử trên điện thoại** (luồng 3 tài khoản; push trên Android và iPhone đã cài PWA, cần HTTPS; trang offline); chưa đo ở cỡ chữ 125% và 150%; chưa có huy hiệu số trên icon (Badging API); thông báo #3 (sắp hết hạn trả lời) để Sprint 5B.
- File chính: `src/services/{friend,appointment,notification,push}.service.ts`, `src/lib/appointment/`, `src/notifications/`, `src/models/{friendship,friend-group,friend-lookup,appointment,notification,notification-delivery,push-subscription}.ts`, `src/actions/{friends,appointments,notifications,push}.ts`, `src/components/{friends,appointment}/`, `src/components/notification-*.tsx`, `src/app/(user)/{friends,appointments,notifications}/`, `public/sw.js`.

<!-- Ví dụ:
### Sprint 2 (2026-12-01)
- Xong: editor phòng chiếu, SeatMap, điểm ghế.
- Quyết định: điểm ghế tính ở `src/services/seat-score.ts`, lưu vào từng ghế khi lưu layout.
- Còn dở: chưa hỗ trợ ghế giường nằm trong heatmap.
-->
