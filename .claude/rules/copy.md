---
paths:
    - "src/app/**"
    - "src/components/**"
    - "src/messages/**"
---

# Quy tắc viết chữ trong giao diện (microcopy)

Áp dụng cho mọi chữ ngắn: tiêu đề, nhãn, gợi ý, nút, placeholder, thông báo lỗi, toast, trạng thái rỗng. Áp dụng cho cả tiếng Việt và tiếng Anh.

**Giọng điệu: thân thiện, kiểu GenZ và dễ thương (chủ dự án chọn, 2026-11-18).** App làm cho nhóm bạn bè của chủ dự án nên không cần trang trọng.
Mọi chữ mới (thông báo lỗi, toast, trạng thái rỗng, nhãn nhắc, thông báo đẩy, câu trả lời chatbot) viết như bạn bè nhắn nhau: gần gũi, vui, nhẹ nhàng, cả tiếng Việt và tiếng Anh.
- Ví dụ: "Chọn Thích hoặc Tránh để lưu." thành "Ghế này bạn thích hay tránh nè?"; "Chưa có lịch hẹn." thành "Chưa có kèo nào hết, rủ bạn đi xem phim thôi!". Đây chỉ là ví dụ về giọng, mỗi chỗ tự viết cho hợp ngữ cảnh.
- Dùng câu hỏi, từ đệm nhẹ ("nè", "nha", "thôi") và từ quen miệng của người trẻ ở mức vừa phải; không lạm dụng tiếng lóng, không viết tắt khó hiểu, không dùng từ có thể bị hiểu sai nghĩa.
- **Vẫn phải rõ ràng trước, dễ thương sau:** người đọc vẫn biết chuyện gì xảy ra và làm gì tiếp theo. Lỗi vẫn nói cách sửa, không đổ lỗi, không đùa cợt khi có hậu quả (mất tiền, xóa dữ liệu, hủy lịch hẹn): hành động nguy hiểm vẫn nêu thẳng hậu quả, giọng nhẹ nhưng không mơ hồ.
- Vẫn giữ các quy tắc dưới đây về độ ngắn, một khái niệm một tên, không nối chuỗi, không viết hoa toàn bộ, không dấu chấm than liên tiếp, không emoji thay cho chữ.
- Chữ cũ chưa đổi giọng thì chuyển dần khi chạm vào màn đó; không cần sửa hàng loạt một lúc, trừ khi chủ dự án yêu cầu.
- Các ví dụ trong bảng bên dưới minh họa **cấu trúc** (ngắn, đủ ngữ cảnh), chưa phải giọng điệu; viết theo giọng ở trên.

**Nguyên tắc chung: ngắn gọn nhưng đủ ngữ cảnh.** Người đọc phải biết *cái gì*, *với đối tượng nào* và *bước kế tiếp* mà không cần nhìn chỗ khác.
Mỗi chuỗi phải tự đủ nghĩa khi tách khỏi màn hình (đọc bằng trình đọc màn hình, hiện trong toast, trong thông báo đẩy).
- Cắt chữ thừa ("Vui lòng", "Hãy", "Xin", "Bạn có thể"), nhưng không cắt đối tượng: "Chọn ghế" tốt hơn "Chọn"; "Chốt người tham gia" tốt hơn "Xác nhận".
- Dùng từ người dùng quen (lịch hẹn, suất chiếu, ghế, bắp rang), không dùng thuật ngữ kỹ thuật hay mã lỗi.
- Câu chủ động. Không đổ lỗi cho người dùng. **Cách xưng hô tiếng Việt do admin cấu hình** (Cài đặt, Cách xưng hô; mặc định bạn và tôi): **không viết "bạn", "tôi", "mình" (khi là ngôi xưng) trần trong `vi.json`**, dùng token `[you]` (gọi người dùng) và `[me]` (app tự xưng); đầu câu viết `[You]` và `[Me]` để tự viết hoa. Token được thay khi tải chuỗi (`src/i18n/request.ts`, `src/lib/pronouns.ts`), cũng dùng cho thông báo đẩy và chatbot sau này (gọi `applyPronounsToText` với cặp lấy từ `getPronounsCached()`). "Bạn bè" (danh từ) viết bình thường. Nhãn nói từ phía người dùng về chính họ ("Đánh dấu của mình") dùng "mình" cố định. Tiếng Anh luôn "you" và "I", không dùng token. `messages.test.ts` báo đỏ nếu còn "bạn" hoặc "tôi" trần.
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
