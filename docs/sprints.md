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
- [ ] Có trang 404/500 thân thiện; mỗi API dữ liệu cá nhân có test thử truy cập dữ liệu của người khác (phải bị từ chối).

## Tổng quan

| Sprint | Nội dung chính | Phụ thuộc | Trạng thái |
|---|---|---|---|
| 0 | Khung nền: scaffold, auth, layout, theme, i18n (vi, en) | — | Xong |
| 1 | Master data, quản lý người dùng, cài đặt hệ thống, hồ sơ cơ bản | 0 | Đang làm |
| 2 | Editor phòng chiếu, sơ đồ ghế, điểm ghế, versioning | 1 | Chưa bắt đầu |
| 3 | Phim (trailer), suất chiếu, trang rạp & lịch chiếu cho user, đánh dấu ghế cá nhân | 2 | Chưa bắt đầu |
| 4 | Lịch hẹn giai đoạn 1 (mời, vote, chốt người), bạn bè, thông báo in-app, worker, Web Push | 3 | Chưa bắt đầu |
| 5A | Lịch hẹn giai đoạn 2: chọn suất, xếp ghế, đồ ăn, chi phí, công nợ, xác nhận | 4 | Chưa bắt đầu |
| 5B | Nhắc lịch và các thông báo theo giờ (#3, #8), tự hoàn thành | 5A | Chưa bắt đầu |
| 6 | Dashboard, ngân sách, ghi lại buổi đã xem, đánh giá cá nhân | 5B | Chưa bắt đầu |
| 7 | Chatbot AI (tầng provider, tool, lưu context) | 6 | Chưa bắt đầu |
| 8 | Production & hardening: môi trường production, sao lưu, rà soát cuối | 7 | Chưa bắt đầu |

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
- Khung CRUD dùng chung (danh sách dạng thẻ trên mobile và bảng trên desktop, form, xác nhận xóa, audit log), rồi dựng từng loại bên dưới trên khung này.
- **Mọi cấu hình master data gom vào một trang Danh mục, mỗi loại là một tab**; menu điện thoại là thanh điều hướng dưới chỉ hiện các trang cần thiết (xem `.claude/rules/ui.md`).
- CRUD: thương hiệu, chi nhánh (kèm thông tin gửi xe, lat/lng), thể loại, định dạng chiếu, phân loại tuổi,
  loại ghế, ngày lễ, đồ ăn và combo (có `validFrom/validTo`).
- Bảng giá vé (`validFrom/validTo`) và hàm tính giá theo quy tắc ở thiết kế mục 2.1: độ cụ thể, loại ngày (lễ > ưu đãi > cuối tuần > thường), `priority`, rule tạo sau; có test.
- Quản lý người dùng: danh sách, tìm kiếm, **tạo tài khoản (mật khẩu tạm)**, khóa/mở khóa (thu hồi phiên), đổi role, reset mật khẩu, không hạ admin cuối cùng.
- Cài đặt hệ thống: `reminderMinutesBefore`, hạn phản hồi mặc định, thời gian quảng cáo (lưu `systemSettings`).
- Hồ sơ cơ bản: tên, avatar (Cloudinary), số điện thoại (chuẩn hóa `84xxxxxxxxx`, unique, không bắt buộc), ngôn ngữ giao diện (`users.locale`), sở thích ngồi, nút đăng xuất. Đổi mật khẩu và ngôn ngữ nằm trong trang Cài đặt, không đặt rải rác ở menu hay Hồ sơ.
- Audit log đơn giản cho thay đổi master data.
- Quyết định tên tiếng Anh cho master data hiển thị cho người dùng (thể loại, định dạng chiếu, loại ghế): thêm trường tên tiếng Anh tùy chọn, rơi về tiếng Việt khi trống.

**Ngoài phạm vi:** phòng chiếu, phim, suất chiếu, tùy chọn thông báo chi tiết.

**Tiêu chí hoàn thành**
- [ ] Admin tạo được đủ master data và dùng thử trên điện thoại.
- [ ] Test cho hàm tính giá: ngày thường, cuối tuần, lễ, ưu đãi, chi nhánh thắng thương hiệu, rule hết hiệu lực, `priority` phá hòa, `priceOverride`.
- [ ] Khóa một user thì phiên của họ bị vô hiệu ở request kế tiếp và họ không đăng nhập lại được.
- [ ] Không thể hạ quyền admin cuối cùng.
- [ ] Admin tạo user mới và reset mật khẩu; user đăng nhập lần đầu bị buộc đổi mật khẩu.

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
- [ ] Tạo một phòng mới, kéo thanh trượt màn hình thì sơ đồ và heatmap đổi theo.
- [ ] Sửa phòng tạo ra version mới, version cũ vẫn xem được.
- [ ] Test điểm ghế: ghế gần tâm lý tưởng điểm cao hơn ghế lệch; ghế hỏng bị phạt.
- [ ] Dùng được trên điện thoại (cấu hình và xem sơ đồ).

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
- [ ] Tạo suất hàng loạt và import CSV thành công, báo lỗi rõ khi dòng CSV sai.
- [ ] Trailer phát được ngay trong trang trên điện thoại.
- [ ] Đánh dấu ghế ở một phòng rồi mở lại vẫn thấy; sau khi phòng có version mới (không đổi ghế đó), đánh dấu vẫn hiện; ghế bị dời hoặc xóa thì vào "Đánh dấu cũ".
- [ ] Bộ lọc lịch chiếu hoạt động và nhanh trên dữ liệu mẫu.

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
- Quá hạn phản hồi: lịch hẹn không tự hủy; người chưa trả lời hiện nhãn "Quá hạn", người tạo vẫn chốt được.
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
- [ ] Sau khi chốt, người tạo không thêm/bớt được người; người tham gia tự rút được và người tạo nhận thông báo.
- [ ] Người vote Có phương án khác phương án được chọn không tự động nằm trong danh sách (người tạo phải thêm tay).
- [ ] Thông báo in-app đến đúng người, đúng thời điểm.
- [ ] Web Push: bật trên Android và trên iPhone (đã cài PWA), "Gửi thử" nhận được kể cả khi đã đóng app; sự kiện mời/chốt/hủy đến đúng người.
- [ ] Không gửi trùng khi chạy hai worker; một thiết bị lỗi 410 thì subscription bị xóa, các thiết bị khác vẫn nhận.
- [ ] Test máy trạng thái pass; test tra cứu số điện thoại bị giới hạn tần suất.

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
- Báo cáo sai thông tin phòng (user gửi, admin xem).
- Thông báo #9 (nhắc nhập chi phí/đánh giá) và #11 (ngân sách).

**Ngoài phạm vi:** chatbot, nhắc trả tiền, gợi ý phim, lớp cộng đồng.

**Tiêu chí hoàn thành**
- [ ] Số liệu dashboard khớp với dữ liệu chi phí đã nhập, không đếm trùng khi một người trả hộ cả nhóm (có test cho các hàm tổng hợp).
- [ ] Cảnh báo ngân sách hiện đúng ở 80% và 100%.
- [ ] Đánh giá ghế sau buổi xem hiện ở lịch sử ngồi của chính user.

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

## Nhật ký tiến độ
Mỗi sprint xong thêm 3 đến 6 dòng: đã làm gì, còn dở gì, quyết định đã chốt, file chính nằm ở đâu.

### Sprint 0 (2026-11-16)
- Xong: scaffold Next.js, đăng nhập mật khẩu và Google (chỉ email được cấp), khóa đăng nhập tăng dần, `requireUser`/`requireAdmin` đọc DB mỗi request,
  đổi mật khẩu bắt buộc, layout user và admin, i18n vi/en (cấu hình ở Cài đặt), PWA cơ bản (icon, manifest, thẻ Apple), logo và nhân vật, seed admin, test với MongoDB replica set.
- Quyết định: tên app SeatMate; logo là ảnh `duo-watching`; màu nhấn hồng-magenta `#C61583`; không có đăng ký công khai; Web Push thay Zalo trong MVP; dev trên local trước.
- Còn dở (hoãn sang Sprint 8): staging HTTPS, thử máy thật, cài PWA, service worker và trang offline làm ở Sprint 4.
- File chính: `src/auth.ts`, `src/lib/auth/guards.ts`, `src/services/user.service.ts`, `src/i18n/`, `src/messages/`, `.claude/rules/`.

<!-- Ví dụ:
### Sprint 2 (2026-12-01)
- Xong: editor phòng chiếu, SeatMap, điểm ghế.
- Quyết định: điểm ghế tính ở `src/services/seat-score.ts`, lưu vào từng ghế khi lưu layout.
- Còn dở: chưa hỗ trợ ghế giường nằm trong heatmap.
-->
