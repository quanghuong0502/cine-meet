---
paths:
    - "src/app/**"
    - "src/components/**"
    - "src/images/**"
---

# Quy tắc nhân vật (Bubu & Dudu)

Hai nhân vật là "linh hồn" của app. Chủ dự án (người dùng) đã **cho phép** Claude chủ động:
- đặt hai nhân vật ở những vị trí hợp lý trong app;
- tạo thêm biến thể ảnh của hai nhân vật cho các trang làm sau, miễn hợp ngữ cảnh.
Dùng cá nhân; không đưa ra công khai khi chưa có ảnh gốc hoặc giấy phép của tác giả.

## Vai trò

- **Bubu** (gấu trúc ngái ngủ ôm bắp rang): chờ, đang tải, vắng vẻ, không tìm thấy, lỗi nhẹ.
- **Dudu** (gấu nâu vui vẻ ôm bắp rang): chào mừng, thành công, hoàn tất, nhắc nhở thân thiện.
- Cả hai cùng xuất hiện chỉ ở nơi mang tính nhận diện (màn hình đăng nhập, giới thiệu).

## Cách dùng

- Luôn dùng `<Mascot name="bubu" | "dudu" />` (`src/components/mascot.tsx`) và `EmptyState` (`src/components/empty-state.tsx`); không viết `<Image>` rời cho nhân vật.
- Nơi đang dùng: đăng nhập (cả hai), đổi mật khẩu (Dudu), trang chào mừng (Dudu), trang đang phát triển và loading (Bubu),
  404 và lỗi (Bubu). Màn hình mới có trạng thái rỗng, thành công, lỗi hay loading thì dùng `EmptyState` kèm nhân vật phù hợp.
- Tối đa **một** nhân vật (hoặc cặp ở màn nhận diện) trên một màn hình; không đặt lên màn hình dày dữ liệu
  (sơ đồ ghế, bảng, form dài) trừ khi là trạng thái rỗng, thành công hay lỗi. Không che nội dung hay vùng chạm.
- Kích thước hiển thị tối đa 180px (ảnh gốc chỉ 240 đến 360px). Nhân vật chỉ để trang trí: `decorative` khi đã có chữ giải thích,
  còn lại giữ `alt` tiếng Việt. Hoạt ảnh nhẹ, bọc `motion-safe:`; không bắt buộc người dùng tương tác với nhân vật.
- `priority` chỉ cho nhân vật nằm ở màn hình đầu tiên khi tải trang.

## Ảnh và biến thể

- Ảnh nguồn nằm ở `src/images/characters/`, tên `<nhân-vật>-<biến-thể>.png`, PNG nền trong suốt (RGBA).
  Ảnh gốc có nền hoặc có chữ ký/watermark không dùng trực tiếp trong code.
- Claude **tự tạo được** biến thể từ ảnh sẵn có bằng `sharp` (có sẵn trong dự án): lật ngang, đổi kích thước,
  viền sticker, ghép hai nhân vật, ghép với khung hoặc đạo cụ vẽ bằng SVG, tách nền. Tạo xong phải xem thử trên nền dark, light
  và màu thương hiệu (`#C61583`) để chắc không có quầng sáng hay vạch, rồi mới dùng.
- Claude **không** vẽ hay sinh được tư thế, biểu cảm hoặc nhân vật mới. Trang nào cần tư thế mới
  (ví dụ buồn, đang chọn ghế, ăn mừng), phải nói rõ với người dùng và xin ảnh nguồn hoặc đề xuất công cụ,
  không dựng hình giả hay vẽ lại sai phong cách.
- Không xóa watermark của tác giả. Nếu ảnh nguồn có watermark thì nhắc người dùng thay bằng bản gốc trước khi công khai.
