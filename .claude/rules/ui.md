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
