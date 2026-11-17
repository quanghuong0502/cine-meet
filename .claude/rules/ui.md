---
paths:
    - "src/app/**"
    - "src/components/**"
---

# Quy tắc UI

- Mobile-first: bố cục cho 390 đến 393px (iPhone 13 và iPhone 14 Pro, xem `devices.md`), sau đó mới mở rộng. Vùng chạm tối thiểu 44px.
- Điều hướng dưới cùng cho user: Tổng quan · Lịch chiếu · Lịch hẹn · Rạp · Chat.
- Chỉ dùng component shadcn (Drawer cho bottom sheet, Sheet, Dialog, Tabs, Calendar, Sonner cho toast).
  Cần component mới thì tra bằng shadcn MCP rồi cài bằng CLI.
- Icon: lucide-react. Animation: Motion, chỉ dùng khi có lý do (chuyển màn, chọn ghế).
- Font: Be Vietnam Pro (next/font/google), subset `vietnamese`.
- Dark mode là mặc định; màu và bo góc đi qua CSS variables của shadcn, không hard-code màu trong component.
- Form dài chia thành nhiều bước. Mọi trạng thái cần có: loading, rỗng, lỗi.
- Sơ đồ ghế là SVG tự viết trong `src/components/seat-map/`, hỗ trợ pinch-zoom và chạm từng ghế.
  Heatmap dùng thang màu cố định, không phụ thuộc theme.
- Văn bản hiển thị đi qua i18n (`vi`, `en`) và theo quy tắc viết chữ ở `.claude/rules/copy.md`; ngày giờ theo múi giờ Asia/Ho_Chi_Minh.

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

**Thanh điều hướng dưới (điện thoại):** component `BottomNav` dùng cho cả khu người dùng (`UserBottomNav`) và khu quản trị (`AdminBottomNav`). Là **viên thuốc nổi, kính mờ** (`rounded-full`, nền `card` 55% + `backdrop-blur`), cách mép 12px (`--spacing-nav-gap`) và cách thanh home iPhone (`env(safe-area-inset-bottom)`); mỗi mục cao tối thiểu 56px, biểu tượng 24px, nhãn `text-xs`.
Mục đang chọn thể hiện bằng **ba dấu hiệu, không chỉ đổi màu chữ**: biểu tượng **tô đặc**, màu nhấn `primary-text`, nhãn đậm (`aria-current="page"`); mục còn lại là biểu tượng viền màu `muted-foreground`.
**Chỉ hiện các trang cần thiết:** trang chưa có tính năng thì chưa hiện (cờ `enabled` trong `src/lib/nav.ts` và `src/lib/admin-nav.ts`), tối đa 5 mục, ít hơn 2 mục thì ẩn thanh.
Việc cấu hình gộp thành một trang (ví dụ mọi master data trong trang Danh mục, chia bằng tab) để menu chỉ cần một liên kết. Trang chủ khu vực tự chuyển tới trang đầu tiên đã sẵn sàng.
Nội dung trang chừa nav + 2 khoảng cách (biến `--bottom-nav-h`), nút hành động cố định đặt phía trên thanh. Header và thanh không cuộn theo trang: chỉ `main` cuộn.

**Avatar** (góc trên bên phải): bấm vào **mở thẳng trang Hồ sơ**, không có menu bật lên: người dùng `/profile`, admin `/admin/profile` (cùng component `ProfileOverview`, hiện là placeholder). Từ Hồ sơ vào Cài đặt và Đăng xuất; Cài đặt quay lại về Hồ sơ. Mọi thiết lập tài khoản (ngôn ngữ, đổi mật khẩu, thông báo...) là một thẻ trong trang Cài đặt, không đặt thành mục riêng ở Hồ sơ.
Admin chỉ có khu quản trị: không có nút "Về ứng dụng" hay liên kết sang trang người dùng.

**Logo app = ảnh `duo-watching` (Bubu và Dudu) kèm wordmark**, dùng component `Logo` (`src/components/logo.tsx`) ở header và thanh bên.
Cùng ảnh này, đặt trên nền hồng `#C61583`, là icon khi thêm app vào màn hình chính (`public/icons/*`, `src/app/apple-icon.png`, favicon).
Không dùng ảnh khác làm logo hay icon; đổi logo thì xuất lại toàn bộ icon PWA.
**Logo luôn căn giữa với chữ trong mọi tình huống:** ảnh logo và nhân vật được cắt sát hình (`npm run mascots:trim`), `Logo` dùng `inline-flex items-center`
và chữ `leading-none`, nên tâm dọc của ảnh trùng tâm dọc của chữ (đã đo: lệch dưới 1px ở các cỡ 32 đến 96px); khi xếp chồng ảnh trên chữ thì căn giữa theo chiều ngang.
Chỗ nào đặt ảnh cạnh chữ cũng dùng `Logo` hoặc `items-center`, không chỉnh lệch bằng `margin` hay `translate`. Khi đổi cỡ hoặc kiểu logo, đo lại độ lệch.

**Tên app: SeatMate.** Luôn hiển thị bằng `<Wordmark />` (`src/components/wordmark.tsx`): "Seat" màu chữ thường, "Mate" màu `primary-text`.
Không viết tay chữ tên app trong giao diện; dùng hằng `APP_NAME` khi cần tên dạng chữ thuần (tiêu đề trang, manifest, thông báo).

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

**Nút (đồng bộ giữa mọi màn, không tự viết lại chuỗi class):** chỉ dùng các cỡ có tên của `Button` (`src/components/ui/button.tsx`):
- `size="cta"`: nút chính duy nhất của form hoặc màn hình (Lưu, Đăng nhập, Thêm), toàn chiều rộng, 48px, bo tròn, chữ semibold. Nút phụ cùng nhóm là `variant="outline"` cùng cỡ (đăng nhập Google).
- `size="cta-sm"` + `variant="ghost"`: hành động nhẹ nằm ngay dưới nút chính (Hủy), toàn chiều rộng, 44px. Thứ tự luôn là nút chính trên, Hủy dưới.
- `size="pill"`: nút chính đứng một mình, giữ chiều rộng riêng (Thử lại, Về trang chủ, mở một trang), 48px, `px-8`.
- Nút biểu tượng: `size="icon"` (44px). **Nút quay lại luôn là `BackButton`** (`src/components/back-button.tsx`): mũi tên tròn ở góc trên bên trái, cùng một chỗ ở mọi màn; `PageHeader` đã gồm nó. Không dùng nút quay lại dạng chữ, không đặt nút "Tiếp" ở góc trên.
- Hành động nguy hiểm: `variant="destructive"` kèm biểu tượng và chữ nêu hậu quả.

**Màn hình vừa khít (đăng nhập và các màn nhận diện khác):** cao đúng một màn hình (`h-dvh`), không cuộn và không hiện thanh cuộn.
Phần minh họa (ảnh nhân vật) co theo chỗ còn trống (`flex-1 min-h-0`, ảnh `h-full w-auto` có `max-h`); mô tả phụ có thể ẩn ở màn rất thấp.
Nếu màn thấp hơn cả phần nội dung bắt buộc thì cho cuộn nhưng ẩn thanh cuộn. Khi sửa màn này phải đo ở 390×844, 375×667, 360×640 và 320×568,
cả hai ngôn ngữ, có và không có khung lỗi.

**Form (mẫu theo màn đăng nhập), quy tắc của chủ dự án (2026-11-17):**
- **Không có gợi ý, mô tả hay chú thích dưới nhãn và dưới ô nhập, và không có mô tả dưới tiêu đề màn nhập.** Form chỉ gồm nhãn, ô, lỗi. Thông tin cần để điền đúng thì đưa vào: nhãn (đơn vị, ví dụ "Giá vé (đồng)"), placeholder (ví dụ giá trị, "vd. 95000") hoặc thông báo lỗi sau khi gửi.
- **Ô bắt buộc: dấu `*` ngay sau nhãn (`RequiredMark`, màu đỏ, ẩn với trình đọc màn hình; ô có `aria-required`). Ô không bắt buộc: không ghi gì** (không có chữ "Không bắt buộc").
- Khung dùng chung `ResourceForm` đã áp dụng sẵn; form tự dựng (đăng nhập, đổi mật khẩu) dùng `RequiredMark` và không thêm gợi ý.
- Khoảng cách nhãn tới ô nhập **12px** (`gap-3`), giữa hai trường 24px (token `gap-field`, chủ dự án chọn cho thoáng, dùng cho mọi form hiện tại và sau này): nhãn luôn gần ô của nó hơn trường phía trên; thông báo lỗi sát dưới ô (8px).
- Không bọc trong thẻ; nhãn phía trên ô nhập (`text-muted-foreground`); ô nhập nền `card`, `h-control rounded-xl text-base`; ô mật khẩu có nút hiện/ẩn (vùng chạm 44px, `aria-pressed`); lỗi hiện trong khung `destructive` nhạt kèm biểu tượng; nút gửi `size="cta"`, đang xử lý thì hiện spinner (`motion-safe:`);
  đăng nhập bằng nhà cung cấp ngoài là nút viền `rounded-full` bên dưới dòng phân cách "hoặc".

**Chữ (thang cỡ cố định, dùng đúng vai trò, không tự chọn cỡ khác). Giá trị nằm ở một chỗ duy nhất là khối `@theme` trong `globals.css`; chi tiết và nguồn tham khảo ở `.claude/rules/design-tokens.md`:**

| Vai trò | Class | Cỡ / dòng | Độ đậm | Tham chiếu |
|---|---|---|---|---|
| Wordmark `SeatMate` ở màn nhận diện, số liệu lớn | `text-3xl` | 30 / 36 | semibold | M3 Headline Large 32; iOS Title 1 28 |
| Tiêu đề màn hình, tiêu đề hero ở màn auth | `text-2xl` | 24 / 32 | semibold | M3 Headline Small 24; iOS Title 2 22 |
| Wordmark ở header app, tiêu đề trạng thái rỗng, tiêu đề thẻ lớn | `text-xl` | 20 / 28 | semibold | M3 Title Large 22; iOS Title 3 20 |
| Tiêu đề mục, tên phim/rạp trong danh sách | `text-base` | 16 / 24 | semibold | iOS Headline 17; M3 Title Medium 16 |
| Nội dung chính, ô nhập, nút chính | `text-base` | 16 / 24 | normal, nút semibold | iOS Body 17; M3 Body Large 16; web mobile tối thiểu 16 |
| Mô tả phụ, nhãn ô nhập, thông báo lỗi | `text-sm` | 15 / 22 | normal hoặc medium | iOS Subheadline 15; M3 Body Medium 14 (nâng lên 15 cho dễ đọc, nhất là dấu tiếng Việt) |
| Ghi chú nhỏ ngoài form (không dùng làm gợi ý dưới ô nhập) | `text-footnote` | 13 / 18 | normal | iOS Footnote 13 |
| Nhãn tab dưới, badge | `text-xs` | 12 / 16 | medium | M3 Label Medium 12; iOS Caption 12 |

- **Thứ bậc phải đúng chiều:** tên thương hiệu và tiêu đề màn hình không được nhỏ hơn thứ nó dẫn dắt. Ở màn auth, wordmark (30) lớn hơn tiêu đề (24).
  Không để tiêu đề trang vượt wordmark hoặc cùng cỡ với nội dung.
- **Giới hạn cứng:** không dùng chữ dưới 12px (iOS tối thiểu 11, M3 tối thiểu 11); ô nhập luôn 16px trở lên để Safari iOS không tự phóng to;
  chữ đọc liền mạch (mô tả dài, đoạn văn) và hàng menu dùng `text-base`, không dùng `text-sm`.
- Tối đa hai độ đậm trên một màn hình. Số tiền, giờ, số ghế dùng `tabular-nums`. Tiêu đề lớn dùng `tracking-tight`.
- Dòng cách: nội dung 1.5, tiêu đề 1.25 đến 1.3 (đã nằm trong cột "Cỡ / dòng" khi dùng class Tailwind mặc định).
- Dùng đơn vị `rem` (class Tailwind) để tôn trọng cỡ chữ người dùng cài trong hệ điều hành; không đặt `px` cố định.

**Sơ đồ ghế (theo mẫu tham khảo):**
- Màn hình là đường cong có quầng sáng `screen-glow` phía trên hàng ghế.
- Ghế là ô vuông bo góc: trống = viền `seat-available`, đã đặt = nền đặc `seat-reserved`, đang chọn = nền `primary` kèm nhãn mã ghế (ví dụ D17).
- Chú thích trạng thái dưới sơ đồ; dòng tóm tắt "Đã chọn N ghế" kèm danh sách mã ghế.

**Thành phần dùng chung** (đặt trong `src/components/`, dùng lại thay vì tự viết lại ở mỗi màn):
`PageHeader`, `EmptyState`, `StatTile`, `StatusBadge`, `PricePill`, `MoneyText`, `DateTimeText`, thẻ phim, chip suất chiếu, nhóm avatar.

**Trạng thái:** loading dùng `LoadingState` (Bubu ngái ngủ đứng yên, hình đại diện loading của app; lần mở đầu là splash toàn màn hình, sau đó chỉ vùng nội dung), có thể kèm skeleton cho phần tiêu đề giữ nguyên hình dạng; rỗng có biểu tượng + nút hành động; lỗi có nút thử lại; nút đang xử lý hiện trạng thái riêng.

**Chuyển động:** 150 đến 250ms, ease-out, tối đa 400ms; chỉ dùng cho chuyển màn, mở bottom sheet, chọn ghế; tôn trọng `prefers-reduced-motion`; không gây xô lệch bố cục.

**Hiển thị dữ liệu:** tiền `Intl.NumberFormat("vi-VN")`; ngày giờ dạng "Hôm nay · 19:30", "Thứ 7, 20/12" theo Asia/Ho_Chi_Minh.

**Trước khi báo xong một màn hình:** chụp ở 390px và 1280px, đối chiếu quy tắc trên; kiểm tra focus, `aria-*`, không cuộn ngang;
màn mới chạy skill `frontend-design` để chốt hướng thẩm mỹ trước khi viết.
