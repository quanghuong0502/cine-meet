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
3. **Server actions** `src/app/admin/master-data/_sections/<ten>/actions.ts` (file `"use server"`, hai hàm mỏng): `saveXxx` gọi `saveEntity(service, schema, formData)` và `removeXxx` gọi `removeEntity(service, id)` ở `src/lib/admin/save-entity.ts`
   (lo sẵn `requireAdmin()` lấy admin từ session, `parseForm`, `errorState` để form giữ lại chữ đã nhập, `revalidatePath`). Tham khảo `brands/actions.ts`.
4. **Tab trong trang Danh mục:** mọi cấu hình master data nằm trên **một trang duy nhất** `/admin/master-data`, mỗi loại là một tab (`?tab=<ten>`), nên menu chỉ cần một liên kết "Danh mục".
   Viết `src/app/admin/master-data/_sections/<ten>/section.tsx` bằng `createSection({...})` (`_sections/create-section.tsx`: khai báo `key`, `service`, `fields`, `item` (dạng thẻ), `values`, `needsBrand`, `loadExtra`), nó xuất một `SectionDefinition` (`_sections/types.ts`) gồm hai phần:
   - `List({ q })`: component server dịch sẵn mọi chữ rồi đưa vào `ResourceManager` (danh sách thẻ, tìm kiếm trong URL `?q=`, xác nhận xóa, nút thêm ghim ở cuối màn hình).
   - `loadForm(id | null)`: trả `SectionFormData` (tiêu đề, danh sách trường, giá trị ban đầu, `saveAction`, `removeAction`), hoặc `null` khi không có bản ghi (404).
   **Form không dùng bottom sheet.** Thêm và sửa là màn nhập riêng `/admin/master-data/<ten>/new` và `/admin/master-data/<ten>/<id>` (dựng bằng `ResourceForm`, nút Lưu cố định ở đáy và vẫn hiện khi gõ, thanh menu ẩn).
   Nút **Xóa** (đỏ, kèm chữ; `DeleteRecordButton`, hỏi xác nhận) nằm cùng hàng với nút Lưu trong thanh dưới của màn sửa. Trường `kind: "comboItems"` là bộ chọn món kèm số lượng và chiết khấu của Combo (`ComboItemsField`, phụ thuộc ô thương hiệu qua `combo.brandField`; gửi `items` dạng JSON, `discountType`, `discountValue`; kiểm tra phụ thuộc DB nằm ở `fnbComboService`). Trường ảnh (`kind: "image"`, ví dụ logo) tải thẳng lên Cloudinary qua `ImageUpload` và một server action ký vé (`uploadTicket`, xem `src/actions/uploads.ts`).
   Danh sách gắn `?back=<url danh sách hiện tại>` (tab và tìm kiếm); sau khi lưu hay xóa, form `router.replace(back)` rồi `router.refresh()`; server action cũng `revalidatePath`.
   `back` chỉ nhận đường dẫn bắt đầu bằng `/admin/master-data` (`src/lib/admin/back-href.ts`). Tham khảo `_sections/brands/section.tsx`. Không tạo route riêng cho từng loại ngoài hai route động trên.
5. **Đăng ký tab:** thêm vào `src/lib/master-data-sections.ts` (kèm `slug` cho URL và biểu tượng), vào `SECTIONS` ở `_sections/index.ts` và khóa `admin.masterData.sections.<ten>` ở cả `vi.json` và `en.json`.
6. **Chuỗi:** khóa `admin.<ten>.*` ở cả hai ngôn ngữ (trường chỉ có `label` và `placeholder`; **không có hint**, đơn vị đưa vào nhãn); lỗi dùng chung nằm ở `admin.common.errors.*` và `admin.validation.*`. Lỗi từ server luôn là mã, không phải câu.
7. **Test:** thêm test dịch vụ (tạo, trùng tên, sửa, xóa, tìm kiếm, `in_use`) như `brand.service.test.ts`.

Lưu ý đã gặp:
- Form dùng `noValidate`: lỗi luôn là câu đã dịch của app, không dùng câu của trình duyệt.
- React xóa sạch form chưa kiểm soát sau mỗi action; vì vậy trạng thái lỗi mang theo `values` và `ResourceForm` dùng lại làm giá trị khởi đầu.
- Khi sửa giao diện admin, thử luồng đầy đủ (tạo, báo lỗi, trùng tên, sửa, tìm, xóa, quay về đúng tab và tìm kiếm) ở 393×852, 390×844 và 375×667, cả hai ngôn ngữ, kiểm tra không cuộn ngang
  và nút thêm ở cuối màn hình.
