---
paths:
    - "src/app/**"
    - "src/components/**"
    - "src/messages/**"
---

# Quy tắc viết chữ trong giao diện (microcopy)

Áp dụng cho mọi chữ ngắn: tiêu đề, nhãn, gợi ý, nút, placeholder, thông báo lỗi, toast, trạng thái rỗng. Áp dụng cho cả tiếng Việt và tiếng Anh.

**Nguyên tắc chung: ngắn gọn nhưng đủ ngữ cảnh.** Người đọc phải biết *cái gì*, *với đối tượng nào* và *bước kế tiếp* mà không cần nhìn chỗ khác.
Mỗi chuỗi phải tự đủ nghĩa khi tách khỏi màn hình (đọc bằng trình đọc màn hình, hiện trong toast, trong thông báo đẩy).
- Cắt chữ thừa ("Vui lòng", "Hãy", "Xin", "Bạn có thể"), nhưng không cắt đối tượng: "Chọn ghế" tốt hơn "Chọn"; "Chốt người tham gia" tốt hơn "Xác nhận".
- Dùng từ người dùng quen (lịch hẹn, suất chiếu, ghế, bắp rang), không dùng thuật ngữ kỹ thuật hay mã lỗi.
- Câu chủ động, xưng "bạn" (tiếng Việt) và "you" (tiếng Anh). Không đổ lỗi cho người dùng.
- Một khái niệm chỉ có một tên trong toàn app (xem từ điển trong `.claude/rules/i18n.md`); không lúc "lịch hẹn" lúc "cuộc hẹn".

**Theo từng loại chữ:**

| Loại | Quy tắc | Ví dụ tốt | Ví dụ chưa tốt |
|---|---|---|---|
| Tiêu đề màn hình | Danh từ hoặc cụm ngắn nêu đối tượng; tối đa khoảng 28 ký tự; không dấu chấm | "Chọn ghế", "Lịch hẹn của tôi" | "Màn hình chọn ghế cho suất chiếu" |
| Nút | Động từ + đối tượng; tối đa khoảng 20 ký tự; nút nguy hiểm nêu hậu quả | "Chốt người tham gia", "Hủy lịch hẹn" | "OK", "Gửi", "Tiếp tục" |
| Nhãn ô nhập | Danh từ ngắn đặt phía trên ô; không dấu hai chấm hay dấu chấm; không dùng placeholder thay nhãn; **ô bắt buộc có dấu `*` sau nhãn, ô không bắt buộc không ghi gì** | "Số điện thoại" | "Nhập số điện thoại của bạn:" |
| Gợi ý, mô tả dưới ô nhập (hint, helper) | **Không dùng trong form.** Cần chỉ cách điền thì đưa vào nhãn (đơn vị: "Giá vé (đồng)"), vào placeholder (ví dụ giá trị) hoặc vào thông báo lỗi sau khi gửi | "Giá vé (đồng)", placeholder "vd. 95000" | dòng chữ nhỏ dưới ô: "Đơn vị đồng, vd. 95000" |
| Placeholder | Ví dụ giá trị, không phải chỉ dẫn | "vd. 0912 345 678" | "Nhập số điện thoại" |
| Lỗi | Nói chuyện gì xảy ra + cách sửa; không mã lỗi; riêng đăng nhập không tiết lộ tài khoản có tồn tại hay không | "Mật khẩu hiện tại không đúng. Thử lại hoặc nhờ quản trị viên đặt lại." | "Lỗi 401" |
| Trạng thái rỗng | Vì sao trống + việc làm tiếp theo | "Chưa có lịch hẹn. Mời bạn bè đi xem phim." | "Không có dữ liệu" |
| Toast xác nhận | Nói sự việc đã xảy ra, kèm số liệu nếu có | "Đã chốt 4 người tham gia" | "Thành công" |
| Số, tiền, ngày giờ | Luôn đủ đơn vị và ngữ cảnh, theo ngôn ngữ đang chọn | "250.000 ₫", "19:30 Thứ 7, 20/12", "Còn 3 ghế" | "250000", "19:30" |

**Giới hạn độ dài và bố cục:**
- Thiết kế cho bản dài nhất của hai ngôn ngữ; bố cục không được vỡ hay cắt chữ âm thầm khi đổi ngôn ngữ. Cho phép xuống dòng, hạn chế `truncate`; nếu phải cắt thì phải xem được đầy đủ (chạm để mở, `title`, hoặc xuống dòng).
- Nút và nhãn tab ngắn hơn tiêu đề; nhãn tab dưới tối đa khoảng 10 ký tự.
- Không ghép chuỗi bằng cách nối (`"Đã chọn " + n + " ghế"`): dùng tham số và dạng số nhiều của tầng i18n.
- Không dùng chữ viết hoa toàn bộ, dấu chấm than liên tiếp hay emoji thay cho chữ. Biểu tượng đi kèm chữ, không thay chữ.
