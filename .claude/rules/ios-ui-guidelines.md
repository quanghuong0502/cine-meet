---
paths:
    - "src/app/**"
    - "src/components/**"
---

# Quy tắc UI/UX iOS có nguồn (Apple HIG)

Ghi lại ngày **2026-11-17**, theo yêu cầu của chủ dự án: mọi quyết định về nút, form, hộp thoại xác nhận phải có căn cứ, không dựa vào cảm tính.
Bổ sung cho `mobile-ux.md` (checklist), `design-tokens.md` (kích thước), `ui.md` (hình thức). **Khi một quy tắc ở đây mâu thuẫn với quyết định của chủ dự án, làm theo chủ dự án và ghi rõ chỗ lệch** (xem mục "Chỗ ứng dụng đang lệch").

Phân loại nguồn: **[HIG]** = đọc trực tiếp trang chính thức của Apple (developer.apple.com/design/human-interface-guidelines), **[phụ]** = blog hoặc tổng hợp bên thứ ba, chưa đối chiếu nguồn gốc, chỉ dùng để tham khảo.

## 1. Nút

- **[HIG, Buttons]** Vùng chạm tối thiểu **44×44 pt**. Luôn có trạng thái nhấn (press state) cho nút tự dựng.
- **[HIG]** Dùng kiểu nút **nổi bật (prominent) cho hành động có khả năng được chọn nhất** của màn; chỉ **một hoặc hai** nút nổi bật mỗi màn (nhiều hơn tăng gánh nặng suy nghĩ).
- **[HIG]** **Dùng kiểu (màu, độ nổi), không dùng kích thước, để phân biệt lựa chọn ưu tiên.** Các nút cùng cỡ báo hiệu một bộ lựa chọn ngang nhau; hai nút khác cỡ đặt cạnh nhau làm giao diện rối và thiếu nhất quán.
- **[HIG]** **Không bao giờ gán vai trò chính (primary) cho nút phá hủy dữ liệu**, kể cả khi đó là lựa chọn có khả năng cao nhất, vì người ta hay bấm nút nổi bật mà không đọc. Nút phá hủy dùng **màu đỏ hệ thống**.
- **[HIG]** Nhãn nút: vài chữ, **bắt đầu bằng động từ** ("Thêm vào giỏ"), nói rõ việc nút làm.
- **[HIG]** Hành động chưa xong ngay thì hiện **chỉ báo tiến trình trong nút** và đổi nhãn ("Đang lưu...").

## 2. Hộp thoại xác nhận (alert) và hành động phá hủy

- **[HIG, Alerts]** **Dùng hộp thoại có chừng mực.** Không hiện hộp thoại cho hành động **thường gặp và hoàn tác được**, kể cả phá hủy (xóa thư, xóa tệp) vì người dùng chủ ý bỏ chúng và có thể hoàn tác. **Hành động phá hủy hiếm gặp và không hoàn tác được thì phải hỏi**, phòng bấm nhầm.
- **[HIG]** Nút của hộp thoại: **một hoặc hai chữ, động từ cụ thể** ("Xóa", "Chuyển đổi"). **Tránh "OK"** làm nút mặc định (không rõ là "đồng ý xóa" hay "đã hiểu hậu quả"), tránh "Có/Không".
- **[HIG]** Có hành động phá hủy thì **luôn có nút "Hủy"** (tên đúng là "Hủy"). Nút Hủy **không** nên là nút mặc định.
- **[HIG]** Vị trí: nút người dùng hay chọn nhất ở **bên phải (trailing) của một hàng hoặc trên cùng của một chồng**; nút Hủy ở **bên trái (leading) hoặc dưới cùng**.
- **[HIG]** Kiểu phá hủy (đỏ) dành cho nút làm việc phá hủy mà người dùng **chưa chủ ý chọn**. Khi họ vừa chủ ý bấm "Xóa", nút xác nhận có thể không cần đỏ.
- **[HIG]** Tiêu đề hộp thoại: nói rõ chuyện gì, ngắn, **không quá hai dòng**, không viết "Lỗi" suông. Chỉ thêm nội dung phụ khi có giá trị. Không giải thích các nút.
- **[HIG, iOS]** Cần **nhiều lựa chọn** cho một hành động chủ ý (xóa bản nháp, lưu, hoặc quay lại sửa) thì dùng **action sheet**, không dùng alert. Hộp thoại **không nên cuộn**: giữ chữ ngắn (chịu cỡ chữ lớn).
- **[phụ]** Giữ khoảng đệm rõ giữa nút phá hủy và các điều khiển khác trên mobile; chọn giữa hoàn tác (undo) và xác nhận theo mức hậu quả: hoàn tác cho việc nhẹ, hay lặp, khôi phục được; xác nhận cho việc nặng, không khôi phục được.

## 3. Nhập liệu và form

- **[HIG, Entering data]** Lấy thông tin từ hệ thống khi có thể; **điền sẵn giá trị mặc định hợp lý** để giảm quyết định.
- **[HIG]** **Cho chọn thay vì bắt gõ** khi có thể (picker, menu): chọn từ danh sách dễ hơn gõ. Cho dán và kéo thả.
- **[HIG]** **Kiểm tra giá trị ngay khi nhập** và báo lỗi ngay khi phát hiện, để người dùng sửa luôn, thay vì sau khi điền cả form dài mới biết sai. Với số, dùng bộ định dạng chỉ nhận số.
- **[HIG]** Nói rõ trường nào bắt buộc trước khi họ đi tiếp; nút Tiếp/Tiếp tục chỉ bật khi đủ dữ liệu bắt buộc.
- **[HIG]** Ô nhạy cảm dùng ô che chữ (mật khẩu); **không bao giờ điền sẵn mật khẩu**. Nhãn rõ ("Email") hoặc ví dụ trong ô.
- **[HIG, Text fields]** Hiện **bàn phím đúng loại nội dung** (số, email, URL); văn bản nhiều dòng dùng ô nhiều dòng.

## 4. Bố cục

- **[HIG, Layout]** Tôn trọng **vùng an toàn** (Dynamic Island, thanh home); không để điều khiển bị che bởi thanh hệ thống.
- **[HIG]** **Dynamic Type:** khi chữ to lên, **các phần tử xếp ngang có thể phải xếp dọc**, hàng bảng phải cao thêm, không cắt chữ. **Xem trước ở cỡ lớn nhất và nhỏ nhất.**
- **[HIG]** Sắp xếp theo mức quan trọng (quan trọng ở trên, đầu dòng); căn thẳng; nhóm các mục liên quan bằng khoảng trắng hoặc khung; **hiện dần chi tiết (progressive disclosure)** để bố cục gọn.
- **[HIG]** Giữ **chức năng** như nhau ở mọi cỡ màn, chỉ đổi lượng nội dung hiện ra.
- **Không tìm được nguồn cho:** "vùng với ngón cái" (thumb reach). Các tìm kiếm chỉ ra blog, không có trang Apple nào nói. Coi quy tắc "hành động chính ở nửa dưới" trong `mobile-ux.md` là **hướng dẫn kinh nghiệm**, không phải chuẩn Apple.

## 5. Bàn phím và thanh hành động cố định (nguồn phụ, phải thử máy thật)

- **[phụ]** Mẫu phổ biến: form cuộn được, thanh hành động chính dính ở đáy và **nằm trên bàn phím** khi bàn phím mở; chốt từ lúc thiết kế nút nào phải nổi khi bàn phím mở và khi đóng.
- **[phụ]** Nút gửi chỉ ở đầu form gây khó dùng; nên đặt dưới các ô hoặc thành nút dính đáy.
- **[phụ]** Giải pháp kỹ thuật (`position: sticky`, `visualViewport`, `scrollIntoView`) phụ thuộc bản iOS và trình duyệt; phải thử trên iPhone thật ở chế độ PWA. Số đo riêng của dự án ở `mobile-ux.md` mục 3 có trọng số cao hơn các blog này.

## Chỗ ứng dụng đang lệch (ghi để biết, không tự sửa khi chưa được yêu cầu)

| Quy tắc | Hiện trạng | Ghi chú |
|---|---|---|
| Dùng kiểu, không dùng cỡ, để phân biệt ưu tiên (HIG) | Thanh dưới màn sửa: **Xóa** (khoảng 98px) cạnh **Lưu** (phần còn lại), cùng cao 48px, khác rộng | Bố cục do chủ dự án chọn (xóa cùng hàng với Lưu). Nút Lưu nổi bật bằng màu đã đúng; chênh rộng là hệ quả của chiều rộng theo nội dung, không có tỉ lệ cố ý |
| Giữ khoảng đệm giữa nút phá hủy và điều khiển khác ([phụ]) | Xóa cách Lưu 8px | 8px đạt mức tối thiểu của HIG/Material cho vùng chạm, nhưng ít cho nút phá hủy; bù bằng hộp thoại xác nhận |
| Kiểm tra giá trị ngay khi nhập (HIG) | Form chỉ kiểm tra khi bấm Lưu (máy chủ trả lỗi theo mã), có cuộn tới ô lỗi đầu tiên | Có thể thêm kiểm tra khi rời ô cho các luật đơn giản (bắt buộc, định dạng email, số) |
| Hàng nút xếp ngang chịu được chữ lớn (HIG Dynamic Type) | Hàng Xóa + Lưu **chưa đo** ở cỡ chữ 125% và 150% | Cần đo; có thể phải xếp dọc ở cỡ lớn |
| Trạng thái nhấn cho nút (HIG) | Chưa kiểm tra các nút của `components/ui/button.tsx` | Kiểm tra khi rà soát |
| Nút xác nhận xóa đỏ (HIG: đỏ dành cho việc chưa chủ ý) | Hộp thoại xóa dùng nút "Xóa" đỏ | Giữ đỏ: xóa không hoàn tác (chưa có xóa mềm), nên nhấn mạnh hậu quả là hợp lý |
| Chỉ hỏi xác nhận khi hành động hiếm và không hoàn tác (HIG) | Mọi lần xóa master data đều hỏi; xóa người dùng không có (chỉ khóa) | Hợp lý vì chưa có hoàn tác. Nếu sau này làm xóa mềm, cân nhắc thay hộp thoại bằng thông báo có nút "Hoàn tác" |

## Cách dùng khi làm màn mới

1. Trước khi thiết kế nút, form hoặc hộp thoại xác nhận, đọc mục tương ứng ở đây.
2. Mỗi quyết định bố cục đáng chú ý ghi lý do ngắn (nguồn nào, hay là lựa chọn của chủ dự án).
3. Không nêu tỉ lệ, kích thước hay thứ tự nút nếu không có căn cứ; nếu chỉ là phán đoán thì nói rõ là phán đoán.

## Nguồn

- Apple HIG, [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts), [Entering data](https://developer.apple.com/design/human-interface-guidelines/entering-data), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields) (đọc 2026-11-17; riêng Text fields chỉ qua tóm tắt tìm kiếm, chưa mở trang).
- Nguồn phụ chưa đối chiếu: [UX Movement, destructive actions](https://uxmovement.com/buttons/how-to-design-destructive-actions-to-prevent-data-loss/), [Baymard, accidental taps](https://baymard.com/research-articles/handling-accidental-taps-on-touch-devices), [UX Movement, form buttons in the action bar](https://uxmovement.com/mobile/why-users-miss-form-buttons-placed-in-the-action-bar/), [NN/g, 4 iOS rules to break](https://hn.jakechampion.name/reader/http://www.nngroup.com/articles/4-ios-rules-break).
