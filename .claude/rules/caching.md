# Quy tắc cache và giảm loading (2026-11-17)

Mục tiêu: chuyển tab/màn gần như tức thì, loader chỉ hiện ở vùng thật sự đang chờ, mà `requireUser()`/`requireAdmin()` vẫn đọc DB ở mỗi request.
Bản Next là 16.4 (đọc `node_modules/next/dist/docs/` trước khi dùng API cache). **Chưa bật `cacheComponents`** (buộc bọc `auth()`, next-intl, `searchParams` trong Suspense toàn app; xem lại sau).

## Đang dùng

| Lớp | Cách làm | Ghi chú |
|---|---|---|
| Router Cache phía client | `experimental.staleTimes` trong `next.config.ts`: `dynamic: 30`, `static: 180` | Trang vừa xem trong 30 giây mở lại ngay. Server action gọi `revalidatePath`/`updateTag` thì xóa cả cache này. Prefetch chỉ chạy ở bản production: đo bằng `npm run build && npm start`, không đo ở `npm run dev` |
| Dedupe trong một request | `React.cache` quanh `findActiveUserById` (`src/lib/auth/guards.ts`, `loadActiveUser`); `src/i18n/request.ts` lấy ngôn ngữ từ cùng lần đọc | Chỉ sống trong một lần render, không qua request, nên khóa tài khoản và đổi role có hiệu lực ngay lần sau. Ngoài lần render (server action) không cache, nên action luôn đọc mới |
| Cache dữ liệu dùng chung | `getBrandOptions` (`src/services/master-data/brand-options.ts`): `unstable_cache`, tag `master-data:brand-options`, 5 phút | `saveEntity`/`removeEntity` gọi `updateTag` sau mọi thay đổi master data |
| Giữ khung khi chuyển | Danh mục: `MasterDataTabs` + `<Suspense key={tab}>` quanh danh sách; menu: `useOptimisticPath` tô sáng mục vừa bấm | Tiêu đề và tab không biến mất; loader chỉ ở vùng danh sách |
| Màn con (thêm/sửa) | `master-data/[section]/loading.tsx` dùng `EntryLoading`: vẽ lại khung trang Danh mục bằng thành phần thật (tiêu đề, `MasterDataTabs`), chỉ vùng nội dung là loader; `entry-loading-store` giữ menu dưới trong lúc chờ (`useShowsAdminBar`) | Bấm một mục không làm tiêu đề, tab, menu nhấp nháy. Màn con mới nên làm tương tự, không dùng khung giả (skeleton) của màn cha |
| Màu thương hiệu | `getBrandTheme` (`src/services/brand-theme-cache.ts`): `unstable_cache`, tag `settings:brand-color`, 1 giờ; lỗi DB thì dùng màu mặc định; `saveBrandColorAction` gọi `updateTag` và `revalidatePath("/", "layout")` | Dùng ở root layout, `generateViewport`, manifest. Chỉ chuỗi/số thuần |
| Cách xưng hô | `getPronounsCached` (`src/services/pronouns-cache.ts`): `unstable_cache`, tag `settings:pronouns`, 1 giờ; lỗi DB thì dùng cặp mặc định (bạn, tôi); `savePronounsAction` gọi `updateTag` và `revalidatePath("/", "layout")` | Dùng ở `src/i18n/request.ts` để thay token xưng hô trong chuỗi tiếng Việt. Chỉ hai chuỗi thuần; kết quả thay token còn được nhớ theo từng cặp trong bộ nhớ tiến trình |
| Loader hiện trễ | `RouteLoading` hiện sau 150ms (`motion-safe`) | Trang tới trong 150ms không chớp loader (`mobile-ux.md` mục 4) |

## Quy tắc

1. **Không cache dữ liệu cá nhân** (hồ sơ, lịch hẹn, chi tiêu, trạng thái tài khoản) qua nhiều request: không `unstable_cache`, không `use cache`, không service worker (`pwa.md`).
2. Trạng thái tài khoản (khóa, role) chỉ được dedupe trong **một** request bằng `React.cache`; không bao giờ cache qua request.
3. Dữ liệu qua `unstable_cache` phải là **chuỗi/số thuần** (không `ObjectId`, `Date`): cache đi qua JSON. Hàm trong `src/services` không dùng `unstable_cache` trực tiếp (test chạy ngoài Next); đặt lớp cache ở file riêng cạnh service (như `brand-options.ts`).
4. Mọi chỗ ghi dữ liệu đã cache phải expire tag bằng `updateTag(tag)` (chỉ trong Server Action, đọc được ngay bản vừa ghi) hoặc `revalidateTag(tag, { expire: 0 })` (Route Handler; Next 16 bắt buộc tham số thứ hai), và `revalidatePath` cho trang liên quan.
5. Sau server action đã `revalidatePath` thì **không gọi thêm `router.refresh()`**: Next đã xóa Router Cache và làm mới trang hiện tại; gọi thêm chỉ thêm một vòng server.
6. Thêm loại cache mới: ghi vào bảng trên, đặt tên tag `<khu vực>:<đối tượng>`, và nói rõ khi nào hết hạn.

## Chưa làm (cân nhắc sau)

- Cache danh sách đầy đủ của từng loại master data (cần chuyển `Date`/`ObjectId` qua JSON).
- `cacheComponents` / `'use cache'` / `partialPrefetching`.
- Thu hẹp `revalidatePath("/", "layout")` ở `actions/profile.ts` và `i18n/actions.ts`.
