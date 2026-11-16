---
paths:
  - "src/ai/**"
---

# Quy tắc tầng AI

- Chỉ `src/ai/providers/*` được import SDK của nhà cung cấp (`@anthropic-ai/sdk`, `@google/genai`, ...).
  Mọi nơi khác dùng interface `LLMProvider` và kiểu trung lập trong `src/ai/core/types.ts`.
- Tool định nghĩa một lần trong `src/ai/tools/`, dùng cho mọi provider. Tham số dùng JSON Schema đơn giản
  (object, string, number, enum, array); tránh `oneOf` và `$ref` vì Gemini chỉ hỗ trợ tập con.
- `userId` truyền vào `execute(args, ctx)` từ session server. Tham số tool KHÔNG được chứa `userId`.
- Lịch sử chat lưu ở định dạng trung lập trong `chatMessages` để đổi provider giữa chừng vẫn chạy.
- Vòng lặp gọi tool tối đa 5 lượt cho mỗi câu hỏi. Tool trả JSON gọn (top ghế, mô tả phòng), không trả cả ma trận ghế.
- Bọc provider bằng decorator retry, usage-tracking và fallback; cấu hình provider/model lấy từ `systemSettings`.
- API key chỉ đọc từ biến môi trường. Tên model là tham số cấu hình, không viết cứng trong code.
