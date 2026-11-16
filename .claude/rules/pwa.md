---
paths:
    - "src/**"
    - "public/**"
---

# Quy tắc PWA (tối ưu ở mọi bước)

Chủ dự án yêu cầu: **mọi tính năng và mọi màn hình phải tối ưu cho PWA** (cài ra màn hình chính iPhone và Android), không để PWA là việc làm sau.
Viết code đúng quy tắc ngay từ đầu. Thử bản cài trên iPhone 13 và iPhone 14 Pro (xem `devices.md`) làm khi có HTTPS (staging, Sprint 8); trong lúc dev local kiểm tra bằng DevTools.

## Hiện trạng (cập nhật khi thay đổi)

- Có: manifest (`src/app/manifest.ts`: standalone, dọc, màu nền, icon PNG 192, 512 và maskable, là logo app: ảnh `duo-watching` trên nền hồng thương hiệu; xuất lại bằng `sharp` khi đổi logo), `apple-icon.png` (iPhone), favicon PNG,
  `theme-color`, thẻ Apple (`appleWebApp`, thanh trạng thái đen), `viewport-fit=cover`, vùng an toàn và `dvh`.
- Chưa có (làm ở Sprint 4 cùng Web Push): service worker `public/sw.js`, trang `/offline`, hướng dẫn cài app. `proxy.ts` đã loại `sw.js` và `offline`
  khỏi yêu cầu đăng nhập để trình duyệt đăng ký và tải được khi chưa đăng nhập.

## Quy tắc cho mọi màn hình

1. **Chạy đúng ở chế độ standalone, không có thanh địa chỉ hay nút Back của trình duyệt.** Mọi màn không phải màn gốc có nút quay lại trong app;
   liên kết nội bộ dùng `<Link>`, không dùng `target="_blank"` cho trang trong app. Liên kết ra ngoài (bản đồ, trailer, Google) mở ngoài app và người dùng quay lại được.
2. **Mỗi màn có URL riêng** (mở thẳng được, dùng cho thông báo đẩy và chia sẻ). Thông báo đẩy mở đúng trang đích.
3. **Không có kéo-để-làm-mới trên iPhone:** màn hiển thị dữ liệu thay đổi phải có cách làm mới và tự cập nhật khi app quay lại (sự kiện `visibilitychange`).
4. **Mạng yếu hoặc mất mạng:** thao tác ghi bị lỗi mạng phải hiện thông báo rõ (không im lặng) và cho thử lại; không làm mất nội dung form đang nhập.
5. **Khởi động nhanh:** trang đầu hiển thị khung (skeleton) ngay, ảnh dùng `next/image`, không kéo JS nặng vào màn đầu; font `display: swap`.
6. **Nền và màu:** `theme-color` và `background_color` của manifest luôn trùng nền app (`#13080d`); đổi màu nền thì đổi cả hai.
7. **Phiên đăng nhập:** trên iPhone, Safari và PWA đã cài **không dùng chung phiên**, nên đăng nhập lại trong PWA là bình thường. Đăng nhập Google trong PWA phải thử trên máy thật.
8. **Cài đặt và quyền:** có hướng dẫn cài (iPhone: Chia sẻ, rồi Thêm vào Màn hình chính; Android: nút cài). Chỉ xin quyền thông báo đẩy khi người dùng bấm,
   và trên iPhone chỉ khi app đã cài (iOS 16.4 trở lên).

## Service worker (từ Sprint 4)

- File `public/sw.js`, phạm vi `/`, được `proxy.ts` loại trừ khỏi đăng nhập (đã làm).
- **Không cache trang hay API chứa dữ liệu cá nhân** (liên quan `userId`, lịch hẹn, chi tiêu). Chỉ cache tài nguyên tĩnh và trang `/offline`.
- Điều hướng: ưu tiên mạng, thất bại thì hiện `/offline`. Có số phiên bản để cập nhật service worker an toàn, không để người dùng kẹt bản cũ.

## Cách kiểm tra

- Manifest hợp lệ và icon tải được khi chưa đăng nhập (`/manifest.webmanifest`, `/icons/*.png`).
- Lighthouse (mục PWA/Installability) trên staging HTTPS; cài thử lên iPhone 13 và iPhone 14 Pro, mở ở chế độ standalone, đi hết luồng chính, kiểm tra nút quay lại,
  vùng an toàn, đăng nhập, tắt mạng thử lỗi.
