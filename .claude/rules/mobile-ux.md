---
paths:
    - "src/app/**"
    - "src/components/**"
---

# Quy tắc UX trên điện thoại

Checklist cho **mọi màn hình và component** (mới và cũ). Bổ sung cho `devices.md` (khổ máy, vùng an toàn), `design-tokens.md` (kích thước), `pwa.md` (chạy khi đã cài) và `ui.md` (hình thức).
Người dùng chỉ test trên PWA điện thoại, nên mọi quyết định lấy iPhone ở chế độ standalone làm chuẩn, không phải desktop.
Kỹ thuật và giới hạn riêng của iOS PWA (splash, thông báo đẩy, chuyển trang, rung, những thứ iOS không cho làm) nằm ở mục "Kỹ thuật tối ưu cho iOS" trong `pwa.md`: đọc trước mỗi sprint có giao diện hoặc thông báo.
Căn cứ: [Apple HIG, tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars.md), báo cáo WebKit về PWA iOS
([218983](https://bugs.webkit.org/show_bug.cgi?id=218983)), và tổng hợp UX mobile thứ cấp (NN/g qua Toptal, Parachute); chỗ nào chưa đối chiếu nguồn gốc thì ghi rõ bên dưới.

## 1. Điều hướng

1. **Mọi màn không phải tab đều có nút quay lại trong app** (`PageHeader` với `backHref`): PWA không có nút Back của trình duyệt, và có thể không có bottom nav (chưa tab nào bật).
   Không để người dùng kẹt ở một màn.
2. **Thanh tab dưới chỉ để chuyển mục, không chứa hành động** (Apple HIG); tối đa 5 mục. Điều hướng luôn hiện sẵn, không giấu sau menu hamburger
   (NN/g, qua nguồn thứ cấp: điều hướng ẩn làm khả năng được tìm thấy giảm gần một nửa).
3. **Giữ trạng thái khi chuyển tab** (vị trí cuộn, bộ lọc, ô tìm kiếm) khi màn đó có; không bắt người dùng làm lại.
4. **Mỗi màn có URL riêng** và mở thẳng được (thông báo đẩy, chia sẻ). Bộ lọc, tab trong trang nằm trên URL (`?tab=`).

## 2. Vùng chạm và ngón cái

1. Vùng chạm tối thiểu 44px (`size-target`), nút chính 48px, hai vùng chạm cách nhau tối thiểu 8px. Hình có thể nhỏ hơn vùng bấm (avatar 40px trong vùng 44px).
   Ngoại lệ có chủ ý: các tab của một thanh tab và các đoạn của một nút chọn (công tắc ngôn ngữ VI/EN) nằm sát nhau (mẫu iOS), vì chúng lớn (từ 44px) và được gom rõ trong cùng một khối.
2. Hành động chính của màn đặt ở nửa dưới, trong tầm ngón cái, phía trên viên thuốc điều hướng; không đặt hành động chính ở góc trên.
   Đây là hướng dẫn, không phải luật cứng: "vùng ngón cái" cổ điển chỉ là một cách ước lượng.
3. Không phụ thuộc hover. Cử chỉ vuốt ngang không bắt đầu sát mép trái (cử chỉ quay lại của iOS).
4. Hành động nguy hiểm (xóa, hủy) luôn hỏi xác nhận và nêu hậu quả; không đặt sát nút hành động thường.

## 3. Bố cục cố định và bàn phím (PWA iOS)

1. **Header và thanh dưới không bao giờ cuộn theo trang:** khung app cao đúng một màn hình (`h-dvh`), chỉ vùng `main` (có `data-app-scroll`) cuộn.
2. **Thanh Lưu của màn nhập (`data-save-bar`) KHÔNG ẩn khi bàn phím mở**: trên app đã cài bàn phím co cả trang (đã đo iPhone 14 Pro, iOS 26), nên thanh nằm ngay trên bàn phím và người dùng luôn bấm được Lưu khi đang gõ (chủ dự án báo lỗi khi nó bị ẩn). **Hành động Xóa của màn nhập đặt ở góc trên phải của header**, không cạnh nút Lưu.
   **Phần tử cố định ở đáy còn lại (menu, nút Thêm của danh sách) có `data-bottom-fixed`:** chúng ẩn khi bàn phím mở (`KeyboardWatcher`), vì trên app đã cài bàn phím che đáy trang thay vì thu nhỏ trang,
   và chúng sẽ nổi lơ lửng giữa màn hình. Nút hành động chính cố định đặt phía trên menu bằng `--bottom-nav-h`, và danh sách có đệm cuối để mục cuối không bị che.
   **Ngoài việc ẩn này, không can thiệp vào bố cục khi bàn phím mở** (không đổi chiều cao hay vị trí khung app, không khóa cuộn): đã thử và đo trên iPhone, Safari tự cuộn trang tới ô đang gõ và vẽ trước một khung hình rồi mới báo cho trang,
   nên mọi chỉnh sửa từ JavaScript đều đến chậm một nhịp và gây giật. Hành vi mặc định mượt hơn.
3. Ô nhập: cỡ chữ 16px, đúng `type`, `inputMode`, `autoComplete`, `autoCapitalize`, `enterKeyHint` (mật khẩu, email, số điện thoại, URL, số).
4. Chiều cao toàn màn hình dùng `dvh`; mọi thứ dính mép dưới cộng `env(safe-area-inset-bottom)`. Không đặt `position: fixed` bên trong vùng đã `overflow: hidden` cho form.
5. **Toast** nằm trên menu dưới và nút cố định (`--toast-offset`), không đè lên chúng.
6. **Form nhập master data (admin) không dùng bottom sheet** mà là màn riêng có nút quay lại và nút Lưu cố định ở đáy (bàn phím trong sheet là nguồn lỗi chính trên iOS PWA). Bottom sheet (Drawer) chỉ cho menu và lựa chọn ngắn; form dài chia bước. Sheet có `max-h` bằng `dvh` và cuộn bên trong. **Khi bàn phím mở, chiều cao tối đa của sheet là `--vv-height`** (phần màn hình bàn phím để lại, do `KeyboardWatcher` đặt, rule trong `globals.css`): đã đo trên iPhone 14 Pro (iOS 26, PWA) bàn phím làm co cả `innerHeight` nên `dvh` và cách phát hiện bàn phím của vaul (`innerHeight` trừ `visualViewport`) đều không thấy bàn phím, sheet cao thì đỉnh (tiêu đề, ô đầu) bị đẩy khỏi màn hình. **Đặt `repositionInputs={false}` cho sheet có ô nhập:** nếu để mặc định, vaul nâng sheet lên bằng chiều cao bàn phím (`bottom`) khoảng 15ms trước khi iOS tự co trang và cuộn cùng lượng đó, sheet bị bù hai lần và nằm khỏi màn hình (đã đo). Phần tử cần ẩn khi gõ (ví dụ nút Hủy của form) gắn `data-hide-on-keyboard`.

## 4. Loading, rỗng, lỗi, mạng

1. **Lần mở app đầu:** một splash toàn màn hình duy nhất (`BootSplash`) cho tới khi khung và trang đầu sẵn sàng. **Chuyển trang sau đó:** giữ header và menu, chỉ loader ở vùng nội dung, căn giữa hai chiều.
2. Trang nhiều nội dung, bố cục đoán trước được (danh sách, thẻ): ưu tiên skeleton đúng hình dạng; hành động ngắn (nút gửi, lưu): spinner ngay trong nút; việc dưới khoảng 200ms thì không hiện loader.
   (Bằng chứng về skeleton không một chiều, xem thử nghiệm của Viget; đừng coi skeleton là luôn thắng.)
3. Mọi danh sách có đủ ba trạng thái: loading, rỗng (nói vì sao trống + việc làm tiếp theo, có nút), lỗi (có nút thử lại).
4. **Mất mạng không được im lặng:** `NetworkWatcher` báo khi mất và khi có lại mạng; thao tác ghi lỗi mạng phải báo rõ, cho thử lại, không mất nội dung form đang nhập.
5. Khi app quay lại sau khi rời hơn 60 giây, dữ liệu trên màn được làm mới (`router.refresh()`); iPhone không có kéo-để-làm-mới.
6. Thao tác của người dùng phản hồi tức thì (trạng thái nút "đang xử lý", không để nút bấm mà không thấy gì); thao tác không đảo ngược được thì hỏi trước.

## 5. Nội dung và cảm giác như app

1. Chữ theo `copy.md` và `design-tokens.md`: nội dung 16px, tối thiểu 12px, chịu được cỡ chữ hệ thống 125% và 150%, không cuộn ngang.
2. Chuyển động 150 đến 250ms, tôn trọng `prefers-reduced-motion`, không gây xô lệch bố cục; không tự chạy animation lặp ở màn loading.
3. Không thu phóng trang (xem `devices.md`); không kéo giãn ở đầu và cuối trang (`overscroll-behavior: none`).
4. Tương phản đạt WCAG ở cả light và dark; màu không phải cách duy nhất truyền đạt trạng thái.

## Trước khi báo xong một màn hình

Đi qua mục 1 đến 5 ở trên trên **iPhone 13 và iPhone 14 Pro ở chế độ PWA** (hoặc ít nhất DevTools 390×844 và 393×852 + điện thoại qua mạng LAN): quay lại được từ mọi màn, mở bàn phím ở từng ô nhập,
tắt mạng thử một thao tác ghi, chuyển tab xem loader, cuộn đến cuối xem hành động cố định không che nội dung. Điều không kiểm tra được trên máy thật thì nói rõ khi tổng kết.
