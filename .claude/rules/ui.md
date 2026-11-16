---
paths:
    - "src/app/**"
    - "src/components/**"
---

# Quy tắc UI

- Mobile-first: bố cục cho 390px, sau đó mới mở rộng. Vùng chạm tối thiểu 44px.
- Điều hướng dưới cùng cho user: Tổng quan · Lịch chiếu · Lịch hẹn · Rạp · Chat.
- Chỉ dùng component shadcn (Drawer cho bottom sheet, Sheet, Dialog, Tabs, Calendar, Sonner cho toast).
  Cần component mới thì tra bằng shadcn MCP rồi cài bằng CLI.
- Icon: lucide-react. Animation: Motion, chỉ dùng khi có lý do (chuyển màn, chọn ghế).
- Font: Be Vietnam Pro (next/font/google), subset `vietnamese`.
- Dark mode là mặc định; màu và bo góc đi qua CSS variables của shadcn, không hard-code màu trong component.
- Form dài chia thành nhiều bước. Mọi trạng thái cần có: loading, rỗng, lỗi.
- Sơ đồ ghế là SVG tự viết trong `src/components/seat-map/`, hỗ trợ pinch-zoom và chạm từng ghế.
  Heatmap dùng thang màu cố định, không phụ thuộc theme.
- Văn bản hiển thị bằng tiếng Việt; ngày giờ theo múi giờ Asia/Ho_Chi_Minh.

- Không phụ thuộc hover: mọi tương tác phải dùng được bằng chạm.
- Chiều cao toàn màn hình dùng `dvh` (không dùng `vh`) để không bị thanh địa chỉ của trình duyệt mobile che.
- Chừa vùng an toàn (`env(safe-area-inset-*)`) cho thanh điều hướng dưới cùng và Drawer, vì iPhone có thanh home.
- Ô nhập liệu cỡ chữ tối thiểu 16px để Safari iOS không tự phóng to khi focus.
- Không để trang cuộn ngang. Chỉ riêng sơ đồ ghế và bảng dữ liệu rộng được cuộn trong khung riêng.
- Bảng admin trên mobile chuyển thành dạng thẻ (card) hoặc cho cuộn ngang trong khung, không để vỡ bố cục.
- Ảnh poster dùng `next/image` với kích thước phù hợp mobile để tiết kiệm dữ liệu.

## Nhận diện & chất lượng giao diện

Hướng thị giác tham khảo: app đặt vé/chọn chỗ hiện đại, sạch, thẻ bo góc lớn, một màu nhấn hồng-magenta (hue 350), nút chính toàn chiều rộng.

**Phát triển song song light và dark.** Dark là mặc định, light là chế độ ngang hàng, không phải bản làm sau:
- Mỗi token màu mới phải có giá trị cho cả `:root` (light) và `.dark`, cùng sắc độ (hue) và cùng vai trò.
- Mỗi màn hình hay component mới phải kiểm tra ở cả hai theme (390px và 1280px) trước khi báo xong.
- Cặp màu mới phải đạt tương phản WCAG ở cả hai theme.
- Không viết class màu theo kiểu `dark:` để vá từng chỗ; để token tự đổi theo theme.
- Poster và heatmap giữ nguyên màu ở cả hai theme (heatmap dùng thang cố định).

**Màu (token trong `src/app/globals.css`, không hard-code):**
- Nền ba tầng: `background` < `card` < `elevated` (popover, bottom sheet). Phân tầng bằng độ sáng và viền mảnh, tối đa một mức đổ bóng.
- Màu nhấn duy nhất là `primary` (raspberry `#C61583`, giống nhau ở cả hai theme), chỉ dùng cho hành động chính, mục đang chọn. Không tô màu nhấn lên mảng lớn.
- Chữ hoặc liên kết màu hồng dùng `text-primary-text`, không dùng `text-primary`: ở dark, `primary` chỉ đạt 3.3:1 trên thẻ nên chỉ hợp cho nút, biểu tượng và nền.
- Nhãn, chip, giá dạng "viên thuốc": nền `accent` (hồng nhạt ở light, mận đậm ở dark), chữ `accent-foreground`.
- Chữ phụ dùng `muted-foreground`. Trạng thái dùng `success`, `warning`, `info`, `destructive`; không tự chế màu mới.
- Đánh dấu ghế dùng token `seat-*`: `seat-favorite` (⭐), `seat-avoid` (🚫), `seat-available`, `seat-reserved`, `seat-selected`.
- Màu không được là cách duy nhất truyền đạt trạng thái: luôn kèm biểu tượng, nhãn hoặc hình dạng (ghế trống = viền, ghế đã đặt = nền đặc mờ).
- Heatmap điểm ghế dùng thang tuần tự cố định (xanh lam sẫm → xanh ngọc → vàng), tránh đỏ, hồng và xanh lục để không trùng `primary`/`destructive`.
- Hồng (`primary`) và đỏ (`destructive`) khá gần nhau: hành động nguy hiểm (xóa, hủy) luôn kèm biểu tượng và chữ, không chỉ dựa vào màu.
- Cặp màu mới phải đạt tương phản WCAG: chữ thường 4.5:1, chữ lớn và thành phần giao diện 3:1.

**Bố cục & hình khối:**
- Lưới 4px; lề trang 16px; khoảng cách giữa các khối 24px; padding thẻ 16px.
- Bo góc theo `--radius` của theme (thẻ `rounded-xl`, ô nhập `rounded-lg`, chip `rounded-full`). Không trộn kiểu bo khác.
- Mỗi trang có tiêu đề trang thống nhất: nút quay lại tròn, tiêu đề ở giữa hoặc trái, hành động phụ bên phải.
- Hành động chính của màn hình là nút toàn chiều rộng, cao tối thiểu 48px, bo tròn hết cỡ, đặt ở dưới cùng
  (cố định, chừa safe-area). Mỗi màn hình tối đa một nút chính.
- Poster là nhân vật chính: tỉ lệ 2:3, bo góc, lớp phủ gradient khi có chữ đè lên.

**Form (mẫu theo màn đăng nhập):** không bọc trong thẻ; nhãn phía trên ô nhập (`text-muted-foreground`); ô nhập nền `card`,
`h-12 rounded-xl text-base`; ô mật khẩu có nút hiện/ẩn (vùng chạm 44px, `aria-pressed`); lỗi hiện trong khung `destructive`
nhạt kèm biểu tượng; nút gửi `h-14 rounded-full` toàn chiều rộng, đang xử lý thì hiện spinner (`motion-safe:`);
đăng nhập bằng nhà cung cấp ngoài là nút viền `rounded-full` bên dưới dòng phân cách "hoặc".

**Chữ:**
- Màn hình nhận diện (đăng nhập) được dùng tiêu đề lớn `text-3xl font-semibold`; mọi màn khác theo thang bên dưới.
- Thang cỡ cố định: tiêu đề trang `text-xl font-semibold`, tiêu đề mục `text-base font-semibold`, nội dung `text-sm`, chú thích `text-xs text-muted-foreground`.
- Tối đa hai độ đậm trên một màn hình. Số tiền, giờ, số ghế dùng `tabular-nums`.

**Sơ đồ ghế (theo mẫu tham khảo):**
- Màn hình là đường cong có quầng sáng `screen-glow` phía trên hàng ghế.
- Ghế là ô vuông bo góc: trống = viền `seat-available`, đã đặt = nền đặc `seat-reserved`, đang chọn = nền `primary` kèm nhãn mã ghế (ví dụ D17).
- Chú thích trạng thái dưới sơ đồ; dòng tóm tắt "Đã chọn N ghế" kèm danh sách mã ghế.

**Thành phần dùng chung** (đặt trong `src/components/`, dùng lại thay vì tự viết lại ở mỗi màn):
`PageHeader`, `EmptyState`, `StatTile`, `StatusBadge`, `PricePill`, `MoneyText`, `DateTimeText`, thẻ phim, chip suất chiếu, nhóm avatar.

**Trạng thái:** loading dùng skeleton đúng hình khối nội dung; rỗng có biểu tượng + nút hành động; lỗi có nút thử lại; nút đang xử lý hiện trạng thái riêng.

**Chuyển động:** 150 đến 250ms, ease-out, tối đa 400ms; chỉ dùng cho chuyển màn, mở bottom sheet, chọn ghế; tôn trọng `prefers-reduced-motion`; không gây xô lệch bố cục.

**Hiển thị dữ liệu:** tiền `Intl.NumberFormat("vi-VN")`; ngày giờ dạng "Hôm nay · 19:30", "Thứ 7, 20/12" theo Asia/Ho_Chi_Minh.

**Trước khi báo xong một màn hình:** chụp ở 390px và 1280px, đối chiếu quy tắc trên; kiểm tra focus, `aria-*`, không cuộn ngang;
màn mới chạy skill `frontend-design` để chốt hướng thẩm mỹ trước khi viết.
