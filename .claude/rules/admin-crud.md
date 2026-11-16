---
paths:
    - "src/app/admin/**"
    - "src/components/admin/**"
    - "src/services/master-data/**"
    - "src/lib/admin/**"
---

# Khung CRUD cho master data (admin)

Mọi loại master data (thương hiệu, chi nhánh, thể loại...) dùng cùng một khung. **Thêm loại mới = làm theo đúng các bước này, không viết lại khung.**

1. **Model** `src/models/<ten>.ts` (Mongoose). Tên duy nhất thì đặt index `unique` kèm `collation: { locale: "vi", strength: 1 }` (không phân biệt hoa thường và dấu).
2. **Dịch vụ** `src/services/master-data/<ten>.service.ts`: khai báo schema zod (dùng các trường có sẵn ở `src/lib/validation/fields.ts`) và gọi
   `createMasterDataService({ entity, model, searchFields, sort, editableFields, dependents })`. Khung lo sẵn: liệt kê và tìm kiếm, tạo, sửa (ô để trống thì xóa
   trường), xóa, báo trùng tên (`duplicate`), chặn xóa khi còn bản ghi khác trỏ tới (`in_use`, khai báo ở `dependents`), và ghi nhật ký thay đổi (`AuditLog`).
3. **Server actions** `src/app/admin/master-data/<ten>/actions.ts`: `requireAdmin()` lấy admin từ session (không nhận từ form), `parseForm(schema, formData)`,
   gọi dịch vụ, `errorState(formData, ...)` khi lỗi (để form giữ lại những gì người dùng đã nhập), `revalidatePath`. Tham khảo `brands/actions.ts`.
4. **Trang** `src/app/admin/master-data/<ten>/page.tsx`: trang server dịch sẵn mọi chữ rồi đưa vào `ResourceManager` (danh sách thẻ, tìm kiếm trong URL `?q=`,
   form dạng bottom sheet, xác nhận xóa, nút thêm ghim ở cuối màn hình). Có `PageHeader` với `backHref` (PWA không có nút Back). Tham khảo `brands/page.tsx`.
5. **Mục trong trang Danh mục:** thêm vào `src/lib/master-data-sections.ts` và khóa `admin.masterData.sections.<ten>` ở cả `vi.json` và `en.json`.
6. **Chuỗi:** khóa `admin.<ten>.*` ở cả hai ngôn ngữ; lỗi dùng chung nằm ở `admin.common.errors.*` và `admin.validation.*`. Lỗi từ server luôn là mã, không phải câu.
7. **Test:** thêm test dịch vụ (tạo, trùng tên, sửa, xóa, tìm kiếm, `in_use`) như `brand.service.test.ts`.

Lưu ý đã gặp:
- Form dùng `noValidate`: lỗi luôn là câu đã dịch của app, không dùng câu của trình duyệt.
- React xóa sạch form chưa kiểm soát sau mỗi action; vì vậy trạng thái lỗi mang theo `values` và `ResourceForm` dùng lại làm giá trị khởi đầu.
- Khi sửa giao diện admin, thử luồng đầy đủ (tạo, báo lỗi, trùng tên, sửa, tìm, xóa) ở 393×852, 390×844 và 375×667, cả hai ngôn ngữ, kiểm tra không cuộn ngang
  và nút thêm ở cuối màn hình.
