---
paths:
    - "src/app/**"
    - "src/components/**"
    - "src/images/**"
---

# Quy tắc nhân vật (Bubu & Dudu)

Danh mục tư thế và ngữ cảnh dùng nằm ở `MASCOT_POSES` trong `src/components/mascot.tsx` (nguồn sự thật). Chọn tư thế theo ngữ cảnh ở đó, không theo cảm tính.

Hai nhân vật là "linh hồn" của app. Chủ dự án (người dùng) đã **cho phép** Claude chủ động:
- đặt hai nhân vật ở những vị trí hợp lý trong app;
- tạo thêm biến thể ảnh của hai nhân vật cho các trang làm sau, miễn hợp ngữ cảnh.
Dùng cá nhân; không đưa ra công khai khi chưa có ảnh gốc hoặc giấy phép của tác giả.

## Vai trò

- **Bubu** (gấu trúc ngái ngủ ôm bắp rang): chờ, **đang tải (hình đại diện loading của cả app)**, vắng vẻ, không tìm thấy, lỗi nhẹ.
- **Dudu** (gấu nâu vui vẻ ôm bắp rang): chào mừng, thành công, hoàn tất, nhắc nhở thân thiện.
- Cả hai cùng xuất hiện (`duo-watching`) ở nơi mang tính nhận diện: các màn auth (đăng nhập, đổi mật khẩu), giới thiệu. Không tự ghép hai ảnh đơn.

## Cách dùng

- **Mọi trạng thái loading của app dùng `LoadingState`** (`src/components/loading-state.tsx`): Bubu `bubu-sleepy` đứng yên, không animation, kèm chữ "Đang tải...".
  Dùng cho mọi `loading.tsx` ở cấp route và vùng chờ dữ liệu; nút đang xử lý vẫn dùng spinner nhỏ. Không tự dựng màn loading khác, không dùng nhân vật khác cho loading.
- Luôn dùng `<Mascot pose="..." />` (`src/components/mascot.tsx`) và `EmptyState` (`src/components/empty-state.tsx`); không viết `<Image>` rời cho nhân vật.
- Nơi đang dùng: các màn auth (đăng nhập, đổi mật khẩu) dùng `duo-watching`, trang chào mừng (`dudu-happy`), trang đang phát triển,
  loading, 404 và lỗi (`bubu-sleepy`). Màn hình mới có trạng thái rỗng, thành công, lỗi hay loading thì dùng `EmptyState` kèm nhân vật phù hợp.
- Tối đa **một** nhân vật (hoặc cặp ở màn nhận diện) trên một màn hình; không đặt lên màn hình dày dữ liệu
  (sơ đồ ghế, bảng, form dài) trừ khi là trạng thái rỗng, thành công hay lỗi. Không che nội dung hay vùng chạm.
- Kích thước hiển thị tự bị giới hạn ở một nửa chiều rộng ảnh gốc để nét trên màn hình Retina (ảnh gốc chỉ 189 đến 498px). Nhân vật chỉ để trang trí: `decorative` khi đã có chữ giải thích,
  còn lại giữ `alt` tiếng Việt. Hoạt ảnh nhẹ, bọc `motion-safe:`; không bắt buộc người dùng tương tác với nhân vật.
- `priority` chỉ cho nhân vật nằm ở màn hình đầu tiên khi tải trang.

## Ảnh và biến thể

- Ảnh dùng trong code nằm ở `src/images/characters/`, tên `<nhân-vật>-<tư-thế>.png` (tiếng Anh không dấu, viết thường, nối bằng dấu gạch),
  PNG nền trong suốt (RGBA). `<nhân-vật>` là `bubu`, `dudu`, `duo` (cả hai) hoặc không có tiền tố cho đạo cụ (ví dụ `popcorn.png`).
- Ảnh gốc (có nền, có chữ hoặc watermark) giữ trong `src/images/characters/_source/` (đã `.gitignore`, chỉ ở máy), không đưa lên repo, không import vào code.
- **Ảnh luôn được cắt sát hình (không còn viền trong suốt thừa)** để căn giữa chính xác với chữ trong mọi tình huống. Sau khi thêm hoặc sửa ảnh,
  chạy `npm run mascots:trim` (script `scripts/trim-mascots.mjs`, chỉ cắt ảnh trong `src/images/characters/`, không đụng `_source/`).
  Ảnh tạo thêm bằng `sharp` cũng phải cắt sát trước khi dùng.
- Thêm ảnh mới: tách nền, cắt sát, đặt tên đúng quy ước, thêm một mục vào `MASCOT_POSES` (kèm `alt` tiếng Việt và `usage`), rồi cập nhật bảng trong file này nếu cần.
- Claude **tự tạo được** biến thể từ ảnh sẵn có bằng `sharp` (có sẵn trong dự án): lật ngang, đổi kích thước,
  viền sticker, ghép hai nhân vật, ghép với khung hoặc đạo cụ vẽ bằng SVG, tách nền. Tạo xong phải xem thử trên nền dark, light
  và màu thương hiệu (`#C61583`) để chắc không có quầng sáng hay vạch, rồi mới dùng.
- Claude **không** vẽ hay sinh được tư thế, biểu cảm hoặc nhân vật mới. Trang nào cần tư thế mới
  (ví dụ buồn, đang chọn ghế, ăn mừng), phải nói rõ với người dùng và xin ảnh nguồn hoặc đề xuất công cụ,
  không dựng hình giả hay vẽ lại sai phong cách.
- `_source/duo-cinema-scene-watermarked.png` (cảnh hai nhân vật ngồi ghế rạp) có nền phức tạp và watermark nên chưa dùng được; cần bản gốc sạch.
- Không xóa watermark của tác giả. Nếu ảnh nguồn có watermark thì nhắc người dùng thay bằng bản gốc trước khi công khai.

## Danh mục tư thế hiện có

| Pose | Nội dung | Dùng cho |
|---|---|---|
| `bubu-sleepy` | Bubu ngái ngủ ôm bắp rang | chờ, đang tải, vắng vẻ, không tìm thấy, lỗi nhẹ |
| `bubu-happy` | Bubu cười, ăn bắp rang | thành công, hoàn tất, thông báo tốt |
| `bubu-going-out` | Bubu đội mũ vàng, đeo ba lô, đang đi | sắp đến giờ chiếu, nhắc lịch, "đi thôi", chỉ đường |
| `dudu-happy` | Dudu vui vẻ ôm bắp rang | chào mừng, nhắc nhở thân thiện, bạn bè |
| `duo-watching` | Hai nhân vật xem laptop, ăn snack | **logo và icon app (PWA)**, màn auth (đăng nhập, đổi mật khẩu), lịch hẹn xem cùng nhau, mời bạn, chưa có lịch hẹn |
| `popcorn` | Hộp bắp rang (đạo cụ, nét vẽ khác) | phần đồ ăn/combo, trang trí nhỏ |

Chưa có: tư thế buồn, ngạc nhiên, ăn mừng, đang chọn ghế, đang tính tiền.

## Khi thiếu ảnh: báo người dùng để họ chuẩn bị

Claude **luôn báo trước** khi một màn hình cần tư thế chưa có trong `MASCOT_POSES`, để người dùng kịp chuẩn bị ảnh. Không dùng tạm ảnh không hợp ngữ cảnh.
- **Khi nào báo:** ngay lúc nêu kế hoạch cho sprint (trước khi làm), không đợi tới cuối sprint. Mỗi kế hoạch sprint có một mục
  "Ảnh nhân vật cần chuẩn bị" (ghi "không cần thêm" nếu đủ). Nếu giữa chừng mới phát hiện thiếu thì báo ngay trong lúc làm.
- **Báo những gì**, mỗi ảnh một dòng: tên file đề xuất (`<nhân-vật>-<tư-thế>.png`), nhân vật, tư thế/biểu cảm cần có,
  màn hình và ngữ cảnh dùng, độ ưu tiên (bắt buộc hay có cũng được), kích thước đề xuất (từ 512px; nền phẳng một màu để dễ tách nền).
- **Trong lúc chờ ảnh:** màn hình vẫn hoàn thành với `EmptyState` dùng tư thế gần nhất đang có, ghi chú trong báo cáo sprint
  là "đang dùng tạm", và đổi sang ảnh đúng ngay khi người dùng gửi (chỉ cần thêm một mục vào `MASCOT_POSES`).
