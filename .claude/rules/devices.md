---
paths:
    - "src/app/**"
    - "src/components/**"
---

# Thiết bị mục tiêu: iPhone 14 Pro và iPhone 13

Hai máy chính của chủ dự án (cả hai màn 6,1 inch, độ phân giải @3x). **Mọi màn hình phải được tối ưu và kiểm tra trên cả hai**
trước khi báo xong. Desktop và các điện thoại khác vẫn phải dùng được, nhưng khi có xung đột thì ưu tiên hai máy này.

| | iPhone 13 | iPhone 14 Pro |
|---|---|---|
| Viewport CSS (dọc) | 390 × 844 | 393 × 852 |
| Đầu máy | tai thỏ (notch) | Dynamic Island |
| Vùng an toàn phía trên | 47px | 59px |
| Vùng an toàn phía dưới (thanh home) | 34px | 34px |

Nguồn số liệu: [Use Your Loaf](https://useyourloaf.com/blog/iphone-14-screen-sizes/) và các bảng viewport iPhone. Vùng an toàn chỉ trả giá trị khác 0
khi trang đặt `viewport-fit=cover` (đã có ở `src/app/layout.tsx`). Chiều cao nhìn thấy được trong Safari thấp hơn 844/852 vì thanh địa chỉ
và thanh công cụ, giá trị chính xác tùy phiên bản iOS và vị trí thanh địa chỉ, nên xác nhận trên máy thật.

## Quy tắc

1. **Khổ thiết kế 390 đến 393px.** Hai máy chỉ khác 3px chiều rộng, nên bố cục phải co giãn, không viết cứng 390 hay 393. Kiểm tra cả hai.
2. **Vùng an toàn phía trên khác nhau (47 và 59px):** không viết cứng chiều cao thanh trạng thái. Mọi thứ dính mép trên dùng `env(safe-area-inset-top)`.
   Nếu bật kiểu thanh trạng thái trong suốt cho PWA (`black-translucent`), mọi trang phải chừa `env(safe-area-inset-top)` ở trên cùng.
3. **Vùng an toàn phía dưới 34px:** thanh điều hướng dưới, thanh hành động cố định và Drawer luôn cộng `env(safe-area-inset-bottom)`
   (dùng `max(<khoảng cách mong muốn>, env(safe-area-inset-bottom))` khi cần). Thêm khoảng đệm nhỏ để nút không sát thanh home.
4. **Cao bằng màn hình:** dùng `dvh`, không dùng `vh`. Màn hình vừa khít (đăng nhập, màn nhận diện) phải đo ở 390×844 và 393×852, và thêm một khổ thấp
   (khoảng 390×660) mô phỏng Safari có thanh công cụ, để chắc vẫn không cuộn (xem mục "Màn hình vừa khít" trong `ui.md`).
5. **Vùng với ngón cái:** màn 6,1 inch dùng một tay, hành động chính đặt ở khoảng 40% phía dưới màn hình; không đặt hành động chính ở góc trên.
6. **Cử chỉ của iOS:** vuốt từ mép trái là "quay lại", nên cử chỉ vuốt ngang của app (kéo sơ đồ ghế, vuốt thẻ) không được bắt đầu sát mép trái
   (chừa khoảng 20px). Cử chỉ chạm và kéo chỉ bật `touch-action: none` bên trong khung sơ đồ ghế, không áp lên cả trang.
7. **Ảnh @3x:** ảnh raster nên có kích thước gốc từ 3 lần kích thước hiển thị. Next.js chỉ tạo bản 1x và 2x cho ảnh cố định, nên `Mascot` giới hạn
   kích thước hiển thị ở một nửa chiều rộng ảnh gốc. Ảnh nhân vật mới nên có chiều rộng từ 600px nếu muốn hiển thị ở khoảng 200px.
8. **Chạm:** vùng chạm tối thiểu 44px, khoảng cách giữa hai vùng chạm gần nhau tối thiểu 8px, ô nhập chữ 16px trở lên (đã nêu trong `ui.md`).
9. **PWA cài lên màn hình chính:** `theme-color` và màu nền của manifest phải trùng nền app để không lộ viền trắng ở vùng Dynamic Island và thanh home.
   Hiện dùng thanh trạng thái iOS `black` (nội dung bắt đầu dưới thanh trạng thái); nếu đổi sang `black-translucent` thì mọi trang phải chừa `env(safe-area-inset-top)`. Chi tiết PWA ở `pwa.md`.

## Cách kiểm tra

- Chrome DevTools, chế độ thiết bị, kích thước tùy chọn **390×844** và **393×852**, DPR 3, bật cảm ứng; đo thêm 390×660. Chụp cả sáng và tối.
- Giai đoạn dev local: thử bằng DevTools và điện thoại qua mạng LAN. Thử trên **máy thật** qua HTTPS (cài PWA lên màn hình chính và mở cả trong Safari) làm khi triển khai (Sprint 8).
