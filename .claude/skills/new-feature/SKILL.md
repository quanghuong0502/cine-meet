---
name: new-feature
description: Quy trình làm một tính năng mới của movie app (đọc thiết kế, model, service, API, UI, kiểm tra). Dùng khi bắt đầu làm một tính năng hoặc màn hình mới theo sprint.
---

# Quy trình làm một tính năng

1. **Xác định phạm vi.** Mở `docs/movie-app-mvp-design.md`, đọc mục liên quan và sprint tương ứng (mục 8).
   Tóm tắt lại tính năng trong vài dòng, nêu rõ phần nào ngoài phạm vi sprint này.
2. **Lập kế hoạch ngắn** gồm: model cần thêm/sửa, service, route API, màn hình, component dùng lại được.
   Gửi kế hoạch cho người dùng và chờ xác nhận trước khi sửa code.
3. **Model & service:** thêm schema Mongoose, logic ở `src/services`, validate input bằng zod.
   Kiểm tra quyền theo role và `userId` từ session.
4. **API:** route handler mỏng, chỉ xác thực, kiểm tra quyền, gọi service.
5. **UI:** mobile-first, chỉ dùng shadcn. Tra component bằng shadcn MCP; cần component mới thì cài bằng CLI.
   Có đủ trạng thái loading, rỗng, lỗi. Văn bản tiếng Việt. Đi qua checklist `.claude/rules/mobile-ux.md` (nút quay lại, bàn phím, mất mạng).
6. **Dữ liệu mẫu:** cập nhật `scripts/seed.ts` nếu tính năng cần dữ liệu để thử.
7. **Kiểm tra:** chạy `npm run lint` và `npm run typecheck`; thêm test cho logic nghiệp vụ quan trọng
   (tính điểm ghế, tính giá, máy trạng thái lịch hẹn). Với thay đổi giao diện, chạy `npm run dev` và dùng
   Next.js DevTools MCP để kiểm tra lỗi runtime.
8. **Tổng kết:** liệt kê file đã đổi, những gì chưa làm, và các quyết định cần người dùng xác nhận.
