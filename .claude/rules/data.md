---
paths:
  - "src/models/**"
  - "src/services/**"
  - "src/app/api/**"
---

# Quy tắc dữ liệu & API

- Schema nằm ở `src/models`, bám theo mục 5 của `docs/movie-app-mvp-design.md`.
  Nhúng (embed) dữ liệu nhỏ gắn chặt với document cha; tham chiếu (reference) thực thể dùng chung.
- Logic nghiệp vụ ở `src/services`; route handler chỉ xác thực, kiểm tra quyền, validate input (zod), gọi service.
- Mọi truy vấn dữ liệu cá nhân phải lọc theo `userId` lấy từ session. Route `/admin/*` và `/api/admin/*` kiểm tra role.
- Transaction cho thao tác nhiều document cần nhất quán (chốt người tham gia, xác nhận lịch hẹn, chia tiền).
- Thời gian lưu dạng UTC (`Date`), hiển thị theo Asia/Ho_Chi_Minh. Tiền lưu số nguyên VND.
- `auditoriumLayouts`: sửa phòng = tạo bản ghi version mới, `auditoriums.currentLayoutId` trỏ tới bản mới;
  `showtimes`, `seatMarks`, `appointments` luôn giữ `layoutId` của bản đã dùng.
- Máy trạng thái lịch hẹn: DRAFT → INVITING → PARTICIPANTS_LOCKED → PLANNING → CONFIRMED → COMPLETED
  (CANCELLED ở mọi bước trước COMPLETED). Chuyển trạng thái chỉ qua service, kiểm tra điều kiện trước khi chuyển.
- Không log dữ liệu cá nhân (số điện thoại, nội dung chat) ra console.
