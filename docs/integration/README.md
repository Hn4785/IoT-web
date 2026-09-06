# Bàn giao kết nối Frontend - Backend

## Mốc cập nhật

- Nhánh: `FE`
- Backend local: `http://localhost:3000/api/v1`
- Biến môi trường frontend: `VITE_API_BASE_URL`
- Commit hoàn thiện luồng tài khoản: `7f5b42a`

Đợt cập nhật này thay phần mock của tài khoản bằng API thật từ backend Phase A. Các màn hình IoT thuộc Phase B/C vẫn giữ nguyên cho đến khi có contract tương ứng.

## Những phần đã hoạt động với backend

| Chức năng | API đang dùng | Trạng thái |
| --- | --- | --- |
| Đăng nhập | `POST /auth/login` | Đã nối |
| Khôi phục phiên | `POST /auth/refresh`, `GET /auth/me` | Đã nối |
| Đăng xuất | `POST /auth/logout` | Đã nối và có nút trên thanh trên cùng |
| Đổi mật khẩu bắt buộc | `POST /auth/change-password` | Đã nối |
| Danh sách tài khoản | `GET /admin/users` | Đã nối phân trang cursor |
| Tạo tài khoản | `POST /admin/users` | Đã nối |
| Sửa role/trạng thái | `PATCH /admin/users/:id` | Đã nối |
| Reset mật khẩu | `POST /admin/users/:id/reset-password` | Đã nối |
| Danh sách API Key | `GET /developer/api-keys` | Đã nối |
| Tạo API Key | `POST /developer/api-keys` | Đã nối |
| Rotate API Key | `POST /developer/api-keys/:id/rotate` | Đã nối |
| Revoke API Key | `POST /developer/api-keys/:id/revoke` | Đã nối |

## Thay đổi frontend cần chú ý

Access token chỉ được giữ trong bộ nhớ, không lưu vào `localStorage`. Refresh token do backend quản lý bằng cookie `HttpOnly`, vì vậy request phải giữ `withCredentials: true`.

Khi nhiều request cùng gặp lỗi 401, frontend chỉ gửi một request refresh. Những request còn lại chờ kết quả chung, tránh reuse refresh token và làm người dùng bị đăng xuất ngoài ý muốn.

Tài khoản có trạng thái `PENDING_PASSWORD_CHANGE` luôn được chuyển tới `/change-password`. Người dùng không thể mở dashboard trước khi đổi mật khẩu tạm thành công.

Mật khẩu tạm và API Key secret chỉ hiện ngay sau khi tạo hoặc rotate. Không lưu hai giá trị này vào store, trình duyệt hay source code.

Danh sách Admin User dùng `nextCursor`; backend không trả tổng số bản ghi. Giao diện vì vậy chỉ có `Previous` và `Next`, không được tự suy ra tổng số trang.

## Phần chưa được nối

### Quyền Farm và Station của tài khoản

Backend đã có lệnh gán hoặc bỏ quyền nhưng chưa có API đọc quyền hiện tại của một user. Form chọn quyền mock đã được tắt để tránh gửi ID giả hoặc ghi đè nhầm quyền đang có.

Muốn hoàn thiện phần này, backend cần trả danh sách Farm/Station đã gán trong `GET /admin/users/:id`, hoặc bổ sung endpoint đọc riêng. Sau đó frontend mới nên dựng lại phần chọn quyền bằng UUID thật.

### Dữ liệu IoT

Telemetry, cảm biến, cảnh báo, thời tiết, báo cáo và số liệu dashboard vẫn là mock. Không đổi những màn hình này sang API tài khoản và không coi dữ liệu demo là dữ liệu backend thật.

### Phạm vi API Key theo Station

Khi tạo API Key, frontend hiện gửi `stationIds: []`. Việc chọn Station cụ thể sẽ được bổ sung sau khi contract đọc quyền Station hoàn chỉnh.

## Cách chạy và kiểm tra nhanh

```powershell
# Terminal backend
cd D:\IoT-api\.worktrees\integration-core
pnpm start

# Terminal frontend
cd D:\IoT-web
npm install
npm run dev
```

Kiểm tra thủ công theo thứ tự:

1. Đăng nhập bằng từng role và kiểm tra đúng dashboard.
2. Dùng tài khoản có mật khẩu tạm, thử mở dashboard và xác nhận hệ thống chuyển về `/change-password`.
3. Đổi mật khẩu, đăng xuất rồi đăng nhập lại bằng mật khẩu mới.
4. Với Admin: tạo user, đổi role/trạng thái, reset mật khẩu và thử nút phân trang.
5. Với Client Developer: tạo, copy, rotate và revoke API Key.
6. Mở DevTools để chắc chắn không có access token, refresh token, mật khẩu tạm hoặc API Key secret trong `localStorage`.

Trước khi bàn giao tiếp, chạy:

```powershell
npm test
npm run lint
npm run build
npm audit --audit-level=high
```

Không commit `.env`, cookie, access token, mật khẩu tạm hoặc API Key secret lên Git.
