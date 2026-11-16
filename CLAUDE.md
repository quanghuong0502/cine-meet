## Nền tảng

- Đây là **web app responsive** (Next.js), không phải app native. Cài lên màn hình chính được qua PWA.
- Thiết bị chính là **điện thoại** (Safari iOS, Chrome Android). Thiết kế và kiểm tra trước hết trên **iPhone 13 (390×844) và iPhone 14 Pro (393×852)**; quy tắc riêng ở `.claude/rules/devices.md`.
- Desktop vẫn được hỗ trợ: user dùng cùng giao diện mobile, canh giữa với chiều rộng tối đa hợp lý;
  admin có bố cục rộng hơn (sidebar, bảng) nhưng mọi chức năng admin vẫn phải dùng được trên điện thoại.
- Tailwind mobile-first: viết class cho mobile trước, mở rộng bằng `md:` và `lg:`.

# SeatMate MVP

App lập kế hoạch & quản lý xem phim (sơ đồ ghế, chi tiêu, lịch hẹn nhóm). **Không bán vé.**
Thiết kế đầy đủ: `docs/movie-app-mvp-design.md`. Trước khi làm một tính năng, đọc đúng mục liên quan
(ví dụ lịch hẹn → mục 3.4, thông báo → mục 4, chatbot → mục 7) thay vì đọc cả file.

## Stack

Next.js (App Router, `src/`) · TypeScript strict · MongoDB Atlas + Mongoose · Auth.js (Google + Credentials)
· shadcn/ui + Tailwind · Cloudinary · Web Push (chuẩn W3C + VAPID, thư viện `web-push`) · AI qua `src/ai` (Claude hoặc Gemini, đổi được)

## Lệnh

- `npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run seed`
- Thêm component UI: dùng shadcn MCP/skill, cài bằng `npx shadcn@latest add <tên>`

## Cấu trúc thư mục

- `src/app/(user)/*`, `src/app/admin/*`, `src/app/api/*`: route theo role
- `src/components/ui`: component shadcn (không sửa tay trừ khi cần); `src/components/*`: component nghiệp vụ
- `src/models`: Mongoose schema · `src/services`: logic nghiệp vụ · `src/lib`: tiện ích dùng chung
- `src/ai`: tầng LLM (provider, tool, orchestrator) · `src/notifications`: outbox, Web Push, scheduler
- `scripts/`: seed, tiện ích chạy tay

## Quy tắc luôn áp dụng

- Mobile-first: thiết kế cho iPhone 13 và iPhone 14 Pro (390 đến 393px) trước. UI hai ngôn ngữ: tiếng Việt (mặc định) và tiếng Anh; mọi chuỗi đi qua tầng i18n, không viết cứng (xem `.claude/rules/i18n.md`). Chữ ngắn gọn nhưng đủ ngữ cảnh (xem `.claude/rules/copy.md`). Tiền VND (`Intl.NumberFormat`).
- Chỉ dùng shadcn/ui + Tailwind cho giao diện. Không thêm thư viện UI khác khi chưa hỏi.
- `userId` và role luôn lấy từ session ở server. Không bao giờ nhận từ body, query hay từ AI.
- Không dùng Redis. Job hẹn giờ dùng collection `scheduledNotifications` (xem thiết kế mục 4.3).
- Không gọi SDK AI trực tiếp; luôn đi qua interface `LLMProvider` trong `src/ai`.
- **Admin chỉ có giao diện admin** (`/admin/*`); không có lối nào sang app người dùng, và admin mở trang của người dùng sẽ bị đưa về khu quản trị. **Mọi thiết lập tài khoản (ngôn ngữ, đổi mật khẩu, thông báo...) nằm trong Cài đặt**; avatar của người dùng mở thẳng trang Hồ sơ (từ đó vào Cài đặt và Đăng xuất); avatar của admin mở menu Cài đặt và Đăng xuất.
- Middleware chỉ là lớp đầu: mọi trang/API server dùng `requireUser()` / `requireAdmin()` (`src/lib/auth/guards.ts`), đọc lại status/role từ DB.
- Chi tiêu của user = `expenses` của chính họ (phần của mình), công nợ ở `expenseShares`; không tính chi tiêu bằng số tiền họ đã ứng (thiết kế 3.4).
- Worker (Web Push, nhắc lịch) chạy cùng tiến trình web qua `instrumentation.ts`, bật bằng `ENABLE_WORKER=true`; không Agenda, không Redis.
- Sửa layout phòng chiếu = tạo phiên bản mới, không ghi đè.
- API key và connection string chỉ ở biến môi trường (`.env.local`), không đưa vào code hay file docs.
- Trước khi báo hoàn thành: chạy `npm run lint` và `npm run typecheck`, sửa hết lỗi.
- Việc lớn hoặc đụng nhiều file: nêu kế hoạch ngắn trước, chờ xác nhận rồi mới sửa.
- **Design token cho điện thoại:** mọi cỡ chữ và kích thước phần tử đi qua token trong `globals.css` (vùng chạm từ 44px, ô nhập và nút 48px, chữ nội dung 16px); không viết `text-[..]` hay `h-11`/`h-12` rời rạc. Bảng token ở `.claude/rules/design-tokens.md`.
- **Tối ưu PWA ở mọi bước:** mỗi màn hình và tính năng phải chạy đúng khi cài ra màn hình chính (nút quay lại trong app, không phụ thuộc thanh trình duyệt, lỗi mạng hiện rõ); quy tắc ở `.claude/rules/pwa.md`.
- **UX điện thoại ở mọi bước:** mỗi màn hình mới và khi sửa màn cũ phải qua checklist `.claude/rules/mobile-ux.md` (điều hướng và nút quay lại, ngón cái, bố cục cố định và bàn phím trên PWA iOS, loading và mất mạng). Người dùng chỉ test trên PWA điện thoại.
- Hai nhân vật Bubu & Dudu: dùng `Mascot`/`EmptyState`, được chủ động đặt và tạo biến thể ảnh theo `.claude/rules/mascots.md`. Màn hình nào cần tư thế chưa có thì báo người dùng ngay lúc nêu kế hoạch sprint để họ chuẩn bị ảnh.
- Làm xong một đơn vị việc chạy được thì commit theo quy ước ở `.claude/rules/git.md` (không push nếu chưa được yêu cầu).

## Phạm vi MVP

Thứ tự sprint ở mục 8 của file thiết kế. Không làm trước tính năng của sprint sau.
