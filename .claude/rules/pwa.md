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
- Đã có: nút quay lại trong app (`PageHeader`), báo mất/có mạng và tự làm mới khi quay lại app (`NetworkWatcher`), ẩn phần tử cố định đáy khi bàn phím mở (`KeyboardWatcher`). Checklist đầy đủ ở `mobile-ux.md`.
- Chưa có (làm ở Sprint 4 cùng Web Push): service worker `public/sw.js`, trang `/offline`, hướng dẫn cài app. `proxy.ts` đã loại `sw.js` và `offline`
  khỏi yêu cầu đăng nhập để trình duyệt đăng ký và tải được khi chưa đăng nhập.

## Quy tắc cho mọi màn hình

1. **Chạy đúng ở chế độ standalone, không có thanh địa chỉ hay nút Back của trình duyệt.** Mọi màn không phải màn gốc có nút quay lại trong app;
   liên kết nội bộ dùng `<Link>`, không dùng `target="_blank"` cho trang trong app. Liên kết ra ngoài (bản đồ, trailer, Google) mở ngoài app và người dùng quay lại được.
2. **Mỗi màn có URL riêng** (mở thẳng được, dùng cho thông báo đẩy và chia sẻ). Thông báo đẩy mở đúng trang đích.
3. **Không có kéo-để-làm-mới trên iPhone:** màn hiển thị dữ liệu thay đổi phải có cách làm mới và tự cập nhật khi app quay lại (sự kiện `visibilitychange`).
4. **Mạng yếu hoặc mất mạng:** thao tác ghi bị lỗi mạng phải hiện thông báo rõ (không im lặng) và cho thử lại; không làm mất nội dung form đang nhập.
5. **Khởi động nhanh:** trang đầu hiển thị khung (skeleton) ngay, ảnh dùng `next/image`, không kéo JS nặng vào màn đầu; font `display: swap`.
6. **Nền và màu:** `theme-color` và `background_color` của manifest luôn trùng nền app; nền tối suy ra từ màu thương hiệu (mặc định `#13080d`, đọc bằng `getBrandTheme()`, xem `ui.md`), nên hai giá trị này tự đổi theo màu admin chọn. Icon và ảnh splash là ảnh tĩnh, không đổi theo (cập nhật thì chạy lại script xuất).
7. **Phiên đăng nhập:** bộ nhớ của Safari và PWA đã cài **tách nhau**, nhưng theo firt.dev cookie đăng nhập được **sao chép một lần lúc cài** từ iOS 17.2 (chưa kiểm tra trên máy thật; xem mục "Kỹ thuật tối ưu cho iOS"). Đăng nhập lại trong PWA vẫn có thể xảy ra, đừng coi là lỗi. Đăng nhập Google trong PWA phải thử trên máy thật.
8. **Cài đặt và quyền:** có hướng dẫn cài (iPhone: Chia sẻ, rồi Thêm vào Màn hình chính; Android: nút cài). Chỉ xin quyền thông báo đẩy khi người dùng bấm,
   và trên iPhone chỉ khi app đã cài (iOS 16.4 trở lên).

## Kỹ thuật tối ưu cho iOS (tra cứu ngày 2026-11-17, đọc trước mỗi sprint có giao diện hoặc thông báo)

Nguồn chính: [firt.dev, iOS PWA compatibility](https://firt.dev/notes/pwa-ios/) (tổng hợp của chuyên gia, đáng tin nhất), [WebKit, Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), báo cáo WebKit Bugzilla. Nguồn thứ cấp (blog, diễn đàn) ghi rõ bên dưới là "chưa chắc". **Khi một việc trong danh sách này thay đổi theo bản iOS, kiểm tra lại trên máy thật.**

### Việc nên làm (có căn cứ)

| # | Việc | Căn cứ | Trạng thái | Sprint |
|---|---|---|---|---|
| 1 | **Màn hình khởi động `apple-touch-startup-image`** cho từng cỡ máy (ảnh phải đúng từng pixel, nền `#13080d`, kèm `apple-mobile-web-app-capable`). iOS **bỏ qua** `background_color` của manifest, thiếu thì thấy nền trắng lúc mở app | firt.dev | **Đã làm** (9 cỡ iPhone, `npm run splash:generate`, danh sách ở `src/lib/splash-screens.json`; thêm máy mới thì thêm vào danh sách rồi chạy lại; chưa kiểm tra trên máy thật) | xong |
| 2 | **CSS cảm giác như app:** `-webkit-tap-highlight-color: transparent` (Tailwind preflight đã có sẵn), `-webkit-touch-callout: none` và `user-select: none` cho nút, thanh điều hướng, header, ảnh (không áp lên nội dung chữ và ô nhập) | blog (netguru, MagicBell), chưa chắc | **Đã làm** (`globals.css`) | xong |
| 3 | **`orientation` trong manifest bị iOS bỏ qua:** app vẫn xoay ngang. Bố cục phải chịu được hoặc hiện lời nhắc xoay dọc | firt.dev | Chưa xử lý | 8 |
| 4 | **Thông báo đẩy chỉ chạy khi đã cài app.** Từ **iOS 18.4 có Declarative Web Push** (không cần service worker); có thêm **Badging API** (số trên icon) từ 16.4. Cân nhắc cả hai khi thiết kế thông báo | firt.dev, WebKit | Chưa làm | **4** |
| 5 | **Hướng dẫn cài app** (Chia sẻ, rồi Thêm vào Màn hình chính): iOS không có `beforeinstallprompt` và `appinstalled` | firt.dev | Chưa làm | 4 hoặc 8 |
| 6 | **Dùng `@media (display-mode: standalone)`** để chỉnh riêng cho app đã cài; không dùng `navigator.standalone` (đã deprecated từ 11.3) | firt.dev | Chưa dùng | khi cần |
| 7 | **Ngoại tuyến:** service worker, Cache Storage, Navigation Preload (iOS 15.4). Chỉ cache tài nguyên tĩnh, không cache dữ liệu cá nhân | firt.dev | Chưa làm | 4 |
| 8 | **Icon:** `apple-touch-icon` được ưu tiên hơn icon trong manifest; icon maskable và monochrome bị bỏ qua; SVG chỉ chạy từ iOS 26 và phải khai trong manifest | firt.dev | Đã có `apple-icon.png` | đã đủ |

### Có thể làm nhưng phải thử trên máy thật trước

- **Chuyển trang mượt bằng View Transitions:** cross-document từ Safari 18.2, hoạt ảnh theo hướng cần Safari 26.2 ([WebKit](https://webkit.org/blog/16967/), [Chrome docs](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)). **Chưa có nguồn nói nó chạy ra sao trong PWA đã cài**, và với Next.js App Router cần cấu hình riêng. Chỉ làm khi đã thử.
- **Rung phản hồi:** `navigator.vibrate` **không có** trên iOS. Có mẹo `<input type="checkbox" switch>` (17.4 trở lên) nhưng nguồn thứ cấp nói có thể bị chặn từ iOS 26.5 ([ios-haptics](https://unpkg.com/ios-haptics@3.1.1/README.md)). Chỉ dùng như tính năng thêm, không dựa vào.
- **Screen Wake Lock** (giữ màn hình sáng) cho app đã cài từ iOS 18.4: chỉ cần khi có màn hình dài (ví dụ vé, sơ đồ ghế).
- **Tắt tự chạm hai lần:** đã có `touch-action: pan-x pan-y`; có báo cáo trễ chạm ở PWA đã cài với `apple-mobile-web-app-capable` (WebKit bug 156232), nhưng chưa thấy trên máy của chủ dự án.

### Không cố làm (iOS không cho, hoặc không đáng tin)

- **Cử chỉ vuốt từ mép trái để quay lại** và **kéo-để-làm-mới** của iOS: không tắt được bằng CSS hay JavaScript; có báo cáo `overscroll-behavior` không có tác dụng trên iOS 18 ([WebKit 222654](https://www2.webkit.org/show_bug.cgi?id=222654)). Không tự dựng cử chỉ quay lại; luôn có nút quay lại trong app; cử chỉ của app không bắt đầu sát mép trái.
- **Bàn phím:** không chỉnh khung app bằng JavaScript khi bàn phím mở (đã đo trên iPhone: Safari cuộn trước một khung hình rồi mới báo, mọi chỉnh sửa đều giật). `interactive-widget`, `virtualKeyboard.overlaysContent` không chạy trên iOS. Chi tiết ở `mobile-ux.md` mục 3.
- **Không có trên iOS PWA:** Background Sync, Periodic Background Sync, Background Fetch, rung, Virtual Keyboard API, Window Controls Overlay, manifest `shortcuts`, `display_override`, `share_target`, `protocol_handlers`.
- **Thanh trạng thái:** `theme-color` thay cho `apple-mobile-web-app-status-bar-style` (deprecated từ iOS 15). Hiện dùng `black` (opaque); nếu đổi sang `black-translucent` thì mọi trang phải chừa `env(safe-area-inset-top)` (xem `devices.md`).

### Đặc thù iOS 26 (cần để ý khi kiểm tra)

- Mọi trang thêm vào màn hình chính **mở như web app theo mặc định**; người dùng có thể tắt "Open as Web App" ([iDownloadBlog](https://www.idownloadblog.com/?p=1042117)). Code không được giả định chắc chắn đang ở chế độ standalone.
- Có nhiều báo cáo lỗi khung nhìn, khoảng trống đáy khi có phần tử `fixed` cao bằng màn hình, và phần tử `fixed` ở đáy khi bàn phím mở (WebKit [218983](https://bugs.webkit.org/show_bug.cgi?id=218983), [301994](https://bugs.webkit.org/show_bug.cgi?id=301994)). Mọi thay đổi bố cục cố định phải thử trên iPhone thật ở chế độ PWA.
- Chưa tìm được nguồn chính thức về `viewport-fit` và thanh trạng thái riêng cho iOS 26: kiểm tra trên máy thật.

### Công cụ kiểm tra có sẵn

Khi chạy dev, nút sóng phát ở mép phải trang (`src/components/dev/dom-recorder.tsx`) ghi cấu trúc DOM, kết quả đo chuẩn mobile (vùng chạm, khoảng cách, chữ nhỏ, cuộn ngang), vùng an toàn, chế độ standalone và từng khung hình khi bàn phím mở hoặc đóng vào `.next/dev-dom.json`. Bật nút trên iPhone, dùng app, rồi đọc file. Tắt nút thì dữ liệu bị xóa.

## Service worker (từ Sprint 4)

- File `public/sw.js`, phạm vi `/`, được `proxy.ts` loại trừ khỏi đăng nhập (đã làm).
- **Không cache trang hay API chứa dữ liệu cá nhân** (liên quan `userId`, lịch hẹn, chi tiêu). Chỉ cache tài nguyên tĩnh và trang `/offline`.
- Điều hướng: ưu tiên mạng, thất bại thì hiện `/offline`. Có số phiên bản để cập nhật service worker an toàn, không để người dùng kẹt bản cũ.

## Cách kiểm tra

- Manifest hợp lệ và icon tải được khi chưa đăng nhập (`/manifest.webmanifest`, `/icons/*.png`).
- Lighthouse (mục PWA/Installability) trên staging HTTPS; cài thử lên iPhone 13 và iPhone 14 Pro, mở ở chế độ standalone, đi hết luồng chính, kiểm tra nút quay lại,
  vùng an toàn, đăng nhập, tắt mạng thử lỗi.
