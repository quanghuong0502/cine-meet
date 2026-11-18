---
paths:
    - "src/**"
---

# Design token cho điện thoại

Chủ dự án rất nhạy cảm với cỡ chữ và kích thước phần tử. **Mọi kích thước đi qua token**, định nghĩa một lần trong khối `@theme` của `src/app/globals.css`.
Muốn chỉnh cỡ chữ hay kích thước cho cả app thì sửa đúng ở đó, không sửa từng component.

## Căn cứ tham khảo (đã tra cứu)

- **Vùng chạm:** Apple HIG khuyến nghị tối thiểu 44×44pt; Material 48×48dp kèm 8dp giữa các vùng chạm gần nhau; WCAG 2.2 mức AA là 24×24px, mức AAA (khuyến nghị) 44×44px
  ([W3C](https://w3.org/WAI/standards-guidelines/wcag/new-in-22/)). Biểu tượng có thể nhỏ miễn vùng bấm lớn.
- **Cỡ chữ:** web mobile nên từ 16px cho nội dung và ô nhập (dưới 16px Safari iOS tự phóng to khi chạm vào ô nhập). iOS: Body 17, Subheadline 15, Footnote 13, Caption 12
  (tối thiểu 11); Material 3: Body 16/14/12. Mỗi cỡ là một **bậc có tên**; component dùng tên bậc, không dùng số rời rạc.
- **Lưới:** 4px là đơn vị nhỏ, 8px là nhịp chính; ô nhập Material 56dp, hàng danh sách từ 44 đến 56.
- Nguồn thứ cấp (chưa đối chiếu tài liệu gốc): chiều cao thanh tab iOS 49pt, thanh điều hướng Material 80dp. Không dùng làm căn cứ.

## Token

**Cỡ chữ** (class Tailwind, giá trị đã chỉnh cho điện thoại, đơn vị `rem` nên theo cỡ chữ người dùng cài trong hệ điều hành):

| Class | Cỡ / dòng | Vai trò |
|---|---|---|
| `text-xs` | 12 / 16 | nhãn tab dưới, badge |
| `text-footnote` | 13 / 18 | gợi ý dưới ô nhập, ghi chú nhỏ |
| `text-sm` | 15 / 22 | chữ phụ: nhãn ô nhập, mô tả, thông báo lỗi |
| `text-base` | 16 / 24 | nội dung chính, ô nhập, nút, hàng menu |
| `text-xl` | 20 / 28 | tiêu đề nhỏ, trạng thái rỗng, wordmark ở header |
| `text-2xl` | 24 / 32 | tiêu đề màn hình |
| `text-3xl` | 30 / 36 | display: wordmark ở màn đăng nhập |

## Cỡ chữ theo vai trò (bắt buộc, từ 2026-11-18)

Cỡ chữ ở trên là **thang**; mọi chữ trong app chọn **một vai trò** (class `type-*`, định nghĩa một lần trong `globals.css`), không bao giờ viết rời `text-xl font-semibold`. Cùng vai trò thì cùng cỡ, độ đậm và dòng cao ở mọi màn, nên không còn chuyện tiêu đề chỗ to chỗ nhỏ.
Quy ước này theo cách Apple dùng *text style* (Dynamic Type) và Material 3 dùng *type role*: chọn theo chữ đó là gì, không chọn theo số.

| Vai trò | Cỡ / dòng, độ đậm | Dùng cho | Đối chiếu |
|---|---|---|---|
| `type-display` | 30 / 36, đậm, khít | số liệu lớn, wordmark ở màn auth | iOS Large Title (34), M3 headline medium (28) |
| `type-title` | 24 / 32, đậm, khít | tiêu đề của một màn không có thanh quay lại (auth, trang đang phát triển) | iOS Title 2 (22), M3 headline small (24) |
| `type-heading` | 20 / 28, đậm | tên mục và tên nhóm thẻ ("Suất chiếu", tên thương hiệu, tên phim đầu nhóm suất), tiêu đề sheet, tên trên thanh quay lại, trạng thái rỗng, giờ chiếu | iOS Title 3 (20), M3 title large (22) |
| `type-item-title` | 16 / 24, đậm | tên trên một thẻ hoặc dòng danh sách, tiêu đề thẻ cài đặt, tiêu đề hộp thoại xác nhận, số ngày trong ô ngày | iOS Headline (17, đậm), M3 title medium (16, 500) |
| `type-body` | 16 / 24 | nội dung đọc liền, giá trị trong ô nhập, giá trị ở hàng chi tiết | iOS Body (17), M3 body large (16) |
| `type-secondary` | 15 / 22 | dòng phụ, mô tả, thông báo lỗi | iOS Subheadline (15), M3 body medium (14) |
| `type-label` | 15 / 22, medium | tên của một trường hoặc giá trị đặt phía trên, nhãn chip, tab | iOS Subheadline, M3 label large (14, 500) |
| `type-caption` | 13 / 18 | ghi chú nhỏ | iOS Footnote (13) |
| `type-micro` | 12 / 16 | chữ nhỏ nhất được phép (nhãn dưới ô ngày, thời gian trình phát) | iOS Caption 1 (12), M3 label medium (12) |
| `type-tag` | 12 / 16, medium | badge, tag, nhãn tab dưới | iOS Caption 1, M3 label medium (12, 500) |

Nguồn: [Apple HIG, Typography](https://developer.apple.com/design/human-interface-guidelines/typography) (iOS mặc định 17pt, tối thiểu 11pt; Headline 17pt đậm; Large Title 34pt, Caption 2 11pt) và Material 3 type scale (headline small 24, title large 22, title medium 16/500, body large 16/400, label medium 12/500).
**Chưa đối chiếu trang gốc** (lấy từ lần tra cứu trước, ghi ở `ui.md`): Title 2 22, Title 3 20, Subheadline 15, Footnote 13, Caption 1 12 của iOS. Cỡ của app là phép gần đúng cho điện thoại (nội dung 16, chữ phụ 15 cho dấu tiếng Việt), không phải bản sao.

**Cách dùng:**
- Chọn vai trò theo việc chữ đó làm. Hai chỗ cùng làm một việc (hai tên nhóm thẻ) phải cùng vai trò.
- **Màu và `tabular-nums` là class riêng** (`type-secondary text-muted-foreground`); vai trò không chứa màu.
- Vai trò là `!important` để luôn thắng cỡ mặc định của thành phần shadcn (một `DrawerTitle` có `type-heading` là 20px). Ngoại lệ hiếm phải ghi rõ bằng dấu `!` ở class kia (`font-semibold!`, `leading-6!`), kèm lý do ở bình luận hoặc commit.
- **Thành phần shadcn trong `components/ui` giữ nguyên.** Nhưng mọi tiêu đề dùng chúng (`CardTitle`, `DrawerTitle`, `SheetTitle`, `AlertDialogTitle`) và mọi `h1` đến `h4` phải ghi vai trò. `Label`, `CardDescription`, `AlertDialogDescription`, nút và ô nhập đã có cỡ nhất quán sẵn từ `components/ui`.
- Cần vai trò mới = thêm `@utility type-...` vào `globals.css`, ghi vào bảng này, rồi mới dùng. Không thêm cỡ ngoài thang.
- Test `src/design-tokens.test.ts` chặn: `text-xs|sm|base|xl|2xl|3xl|footnote` ngoài `components/ui`, `type-*` không có trong bảng, và heading hoặc tiêu đề thiếu vai trò.

**Kích thước phần tử** (dùng thay cho `h-11`, `h-12`... để mỗi con số có tên và lý do):

| Class | Giá trị | Dùng cho |
|---|---|---|
| `h-target`, `size-target`, `min-h-target` | 44px | vùng chạm nhỏ nhất: nút biểu tượng, hàng menu, nút phụ, hàng công tắc |
| `h-control` | 48px | chiều cao mặc định của ô nhập và nút |
| `h-control-lg` | 56px | điều khiển rộng rãi |
| `min-h-area` | 112px | chiều cao tối thiểu của ô nhiều dòng (textarea): cao hơn ô một dòng để gõ thoải mái |
| `min-h-row` | 64px | hàng danh sách có tiêu đề và dòng phụ |
| `min-h-nav` | 68px | chiều cao viên thuốc điều hướng dưới (mỗi tab lấp đầy); viên thuốc cách hai bên 16px, cách đáy `--nav-bottom` (8px, hoặc trên iPhone có thanh home là vùng an toàn trừ 20px) |
| `size-avatar` | 40px | hình tròn avatar trong nút menu tài khoản (vùng chạm vẫn 44px) |
| `gap-field` (`--spacing-field`) | 24px | khoảng cách giữa hai trường (block) của mọi form; form mới luôn dùng class này, không viết `gap-4`/`gap-6` rời |
| `--spacing-nav-gap` | 12px | khoảng giữ phía trên viên thuốc điều hướng nổi; nội dung chừa `--nav-clearance` = nav + gap + `--nav-bottom` |

Các giá trị mặc định của shadcn (nút cao 32px, ô nhập cao 32px) đã được đổi sang token (`button.tsx`, `input.tsx`), nên nút hoặc ô nhập thêm mới không cần ghi đè kích thước.

**Khoảng cách:** thang Tailwind (đơn vị 4px). Dùng 1, 2, 3, 4, 6, 8, 12, 16 (4, 8, 12, 16, 24, 32, 48, 64px). Hai vùng chạm cạnh nhau cách nhau **ít nhất 8px** (`gap-2`).
**Bo góc:** theo `--radius` (thẻ `rounded-xl`, ô nhập `rounded-lg`, nút chính và chip `rounded-full`). **Biểu tượng:** 16 (`size-4`) trong chữ phụ, 20 (`size-5`) trong nút, 24 (`size-6`) ở thanh tab; vùng bấm vẫn từ 44px.

## Quy tắc

1. **Không viết kích thước rời rạc.** Chữ đi qua vai trò `type-*` (mục trên), không viết `text-xl` hay `text-sm`. Cấm `text-[..]` và cỡ chữ ngoài bảng (`text-lg`, `text-4xl`...). Cấm `h-11`, `h-12`, `size-11`, `min-h-11`, `min-h-14`, `min-h-16` ở ngoài `components/ui`: dùng token. Test `src/design-tokens.test.ts` kiểm tra điều này.
2. **Mọi thứ bấm được cao tối thiểu 44px**, ô nhập và nút chính 48px. **Mọi ô nhập một dòng cao đúng 48px (`h-control`)**: ô chữ, số, ngày, giờ, màu, **ô chọn (select)**, ô tìm kiếm; chỉ ô nhiều dòng (textarea, `min-h-area`) được cao hơn. Mục trong danh sách thả của ô chọn cao từ 44px (`min-h-target`). Công tắc, ô chọn: cả hàng là vùng bấm, cao từ 44px (nhãn `Label htmlFor`).
3. **Thêm vai trò chữ, bậc chữ hoặc kích thước mới** = thêm token vào `globals.css`, ghi vào bảng này, rồi mới dùng. Không dùng giá trị `px` tùy ý cho chữ.
4. **Chịu được cỡ chữ lớn:** bố cục không được vỡ hay cuộn ngang khi người dùng tăng cỡ chữ hệ thống lên 125% và 150%; nhãn dài xuống dòng, không cắt âm thầm.
5. **Chữ dưới 12px là cấm**; chữ đọc liền mạch dùng `text-base` trở lên.

## Cách kiểm tra

- `npm test` chạy `src/design-tokens.test.ts` (không dùng cỡ chữ lẻ, không dùng kích thước rời rạc, token và vai trò tồn tại trong `globals.css`, chữ chỉ đi qua vai trò, heading và tiêu đề có vai trò).
- Đo trên trình duyệt (khổ 393×852) cả ba mức cỡ chữ gốc 16px, 20px (125%) và 24px (150%): liệt kê cỡ chữ đang dùng, vùng chạm nhỏ hơn 44px,
  hai vùng chạm cách nhau dưới 8px, cuộn ngang. Bỏ qua các phần tử nằm phía sau hộp thoại đang mở.
