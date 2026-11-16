# Quy tắc git & commit

- Làm xong một đơn vị việc chạy được (lint, typecheck, test đều pass) thì commit ngay, không dồn cả sprint vào một commit.
  Không push, trừ khi người dùng yêu cầu.
- Mỗi commit một ý: một bước của sprint, một bản sửa lỗi, hoặc một thay đổi tài liệu. Không trộn tính năng với refactor không liên quan.
- Không commit `.env*` (trừ `.env.example`), khóa API, connection string, `.claude/settings.local.json`.
- Không dùng `--no-verify`, không rewrite lịch sử đã push.

## Định dạng message (Conventional Commits, mô tả bằng tiếng Việt)

```
<type>(<scope>): <mô tả ngắn, thể mệnh lệnh, tối đa 72 ký tự, không dấu chấm cuối>

<thân (tùy chọn): vì sao đổi, đổi gì, lưu ý khi chạy thử. Xuống dòng ở khoảng 72 ký tự>

Sprint: <số sprint, ví dụ 0, 5A>
```

**type:** `feat` (tính năng) · `fix` (sửa lỗi) · `refactor` · `test` · `docs` · `chore` (cấu hình, dependency) · `build` · `style`

**scope** (một trong): `auth`, `admin`, `user`, `models`, `services`, `ui`, `ai`, `notifications`, `seat-map`, `db`, `seed`, `deps`, `docs`

Ví dụ:
```
feat(auth): khóa đăng nhập tăng dần sau 5 lần nhập sai

Khóa 15 phút, gấp đôi sau mỗi đợt, tối đa 24 giờ. Đăng nhập đúng hoặc
admin reset mật khẩu thì xóa bộ đếm.

Sprint: 0
```
