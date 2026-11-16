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

**Kích thước phần tử** (dùng thay cho `h-11`, `h-12`... để mỗi con số có tên và lý do):

| Class | Giá trị | Dùng cho |
|---|---|---|
| `h-target`, `size-target`, `min-h-target` | 44px | vùng chạm nhỏ nhất: nút biểu tượng, hàng menu, nút phụ, hàng công tắc |
| `h-control` | 48px | chiều cao mặc định của ô nhập và nút |
| `h-control-lg` | 56px | điều khiển rộng rãi |
| `min-h-row` | 64px | hàng danh sách có tiêu đề và dòng phụ |
| `min-h-nav` | 56px | một tab của thanh điều hướng dưới (thanh tự cộng vùng an toàn) |

Các giá trị mặc định của shadcn (nút cao 32px, ô nhập cao 32px) đã được đổi sang token (`button.tsx`, `input.tsx`), nên nút hoặc ô nhập thêm mới không cần ghi đè kích thước.

**Khoảng cách:** thang Tailwind (đơn vị 4px). Dùng 1, 2, 3, 4, 6, 8, 12, 16 (4, 8, 12, 16, 24, 32, 48, 64px). Hai vùng chạm cạnh nhau cách nhau **ít nhất 8px** (`gap-2`).
**Bo góc:** theo `--radius` (thẻ `rounded-xl`, ô nhập `rounded-lg`, nút chính và chip `rounded-full`). **Biểu tượng:** 16 (`size-4`) trong chữ phụ, 20 (`size-5`) trong nút, 24 (`size-6`) ở thanh tab; vùng bấm vẫn từ 44px.

## Quy tắc

1. **Không viết kích thước rời rạc.** Cấm `text-[..]` và cỡ chữ ngoài bảng (`text-lg`, `text-4xl`...). Cấm `h-11`, `h-12`, `size-11`, `min-h-11`, `min-h-14`, `min-h-16` ở ngoài `components/ui`: dùng token. Test `src/design-tokens.test.ts` kiểm tra điều này.
2. **Mọi thứ bấm được cao tối thiểu 44px**, ô nhập và nút chính 48px. Công tắc, ô chọn: cả hàng là vùng bấm, cao từ 44px (nhãn `Label htmlFor`).
3. **Thêm bậc chữ hoặc kích thước mới** = thêm token vào `globals.css`, ghi vào bảng này, rồi mới dùng. Không dùng giá trị `px` tùy ý cho chữ.
4. **Chịu được cỡ chữ lớn:** bố cục không được vỡ hay cuộn ngang khi người dùng tăng cỡ chữ hệ thống lên 125% và 150%; nhãn dài xuống dòng, không cắt âm thầm.
5. **Chữ dưới 12px là cấm**; chữ đọc liền mạch dùng `text-base` trở lên.

## Cách kiểm tra

- `npm test` chạy `src/design-tokens.test.ts` (không dùng cỡ chữ lẻ, không dùng kích thước rời rạc, token tồn tại trong `globals.css`).
- Đo trên trình duyệt (khổ 393×852) cả ba mức cỡ chữ gốc 16px, 20px (125%) và 24px (150%): liệt kê cỡ chữ đang dùng, vùng chạm nhỏ hơn 44px,
  hai vùng chạm cách nhau dưới 8px, cuộn ngang. Bỏ qua các phần tử nằm phía sau hộp thoại đang mở.
