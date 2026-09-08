# Sổ lỗi Backend

Cập nhật gần nhất: 2026-09-08. Đây là file theo dõi lỗi chính của backend. Lỗi chưa hoàn thành luôn đặt ở trên; lỗi đã sửa được chuyển xuống cuối file sau khi có test hoặc bằng chứng kiểm chứng.

## Chưa sửa

### [Vận hành] Các hardening trước production còn thiếu

- Rate limit hiện là process-local; triển khai nhiều instance cần shared store hoặc limiter tầng hạ tầng.
- Chưa có MFA/SSO; Super Admin cần MFA trước khi public Internet.
- Audit append-only mới được bảo vệ theo convention ứng dụng, chưa có database role chặn update/delete.
- Cần diễn tập backup/restore, mã hóa backup, rotation secret và audit monitoring.
- Dependency audit chỉ phát hiện advisory đã biết, không loại trừ supply-chain compromise.

### [Trung bình, chưa reachable] Advisory `mysql2` từ Prisma tooling

- `pnpm audit` ngày 2026-09-07 báo `GHSA-rgwj-5xj2-c3m3` với `mysql2 <=3.23.0`, được kéo gián tiếp qua Prisma.
- Backend chỉ cấu hình PostgreSQL và không gọi MySQL protocol, nên chưa tìm thấy đường khai thác trong runtime hiện tại; high/critical audit vẫn đạt.
- Cần xử lý trong đợt cập nhật dependency có kiểm soát: chờ Prisma dùng bản vá, xem diff lockfile, chạy migration/test đầy đủ. Không dùng `audit fix --force`.

## Đã kiểm chứng không phải lỗi

### Cursor user không tái hiện lỗi P2025

- Cursor UUID hợp lệ nhưng không tồn tại đã được thử trực tiếp với PostgreSQL/Prisma hiện tại: API trả HTTP 200 và trang rỗng.
- Không sửa repository khi chưa tái hiện được. Nếu xảy ra ở môi trường khác, phải giữ Prisma error code và query cụ thể.

### Origin, cookie path và refresh single-flight

- Kiểm tra `Origin` ở refresh/logout và cookie path `/api/v1/auth` là ràng buộc bảo mật có chủ ý.
- Frontend phải dùng hàng đợi/single-flight để không gọi song song cùng refresh token.

## Đã sửa

### [Trung bình] Integration tests tranh chấp cùng database

- Vitest chạy các test file tuần tự bằng `fileParallelism: false`; không dùng retry
  để che race và vẫn giữ database test riêng `/iot_test`.
- Verification ngày 2026-09-08: lệnh mặc định `pnpm test` đạt ba lần liên tiếp,
  mỗi lần 33/33 file và 150/150 test.

### [Trung bình] Reset password chưa có rate limit riêng

- Route reset password có giới hạn riêng 10 request/phút/IP; request thứ 11 trả
  `429 RATE_LIMITED`.
- Regression test: `test/integration/identity/users.spec.ts`.

### [Trung bình] Admin chưa đọc được quyền Farm/Station hiện tại của user

- `GET /api/v1/admin/users/:userId` trả thêm `assignments.farmIds` và
  `assignments.stationIds`, sắp xếp ổn định và chỉ lấy từ quyền hiện tại.
- User list và `/auth/me` vẫn dùng DTO gọn cũ; response không lộ upstream code,
  hash hoặc database record.
- Regression test: `test/integration/identity/users.spec.ts`.

### [Trung bình] Database unavailable chưa có contract 503

- `HttpErrorFilter` ánh xạ riêng các mã kết nối/timeout Prisma đã xác minh
  (`P1001`, `P1002`, `P1008`, `P1017`, `ECONNREFUSED`) sang HTTP 503
  `DATABASE_UNAVAILABLE` với thông báo công khai trung tính.
- Lỗi Prisma không thuộc nhóm kết nối vẫn trả 500 `INTERNAL_ERROR`; raw exception
  không được đưa vào response.
- Regression test: `src/common/errors/http-error.filter.spec.ts`.

### [Cao] Mật khẩu tạm có thể bị mất khi tạo hoặc reset tài khoản

- Frontend đã thay thông báo dễ bỏ qua bằng modal một lần cho cả create và reset: hiển thị đúng email, có Copy, không đóng khi click ra ngoài và chỉ bật Done sau khi xác nhận đã lưu.
- Credential vẫn chỉ nằm trong state tạm thời, không được lưu vào localStorage, URL hoặc log; backend tiếp tục chỉ lưu password hash.
- Người nhận vẫn phải đổi mật khẩu ngay lần đăng nhập đầu. Link kích hoạt qua email là cải tiến tương lai, không phải API đọc lại mật khẩu.
- Verification tự động: frontend 9/9 test, build và lint không có lỗi ngày 2026-09-07. Cần spot-check bằng trình duyệt với tài khoản test trước khi merge.

### [Cao] Super Admin có thể tự reset và tự khóa tài khoản

- Backend từ chối authority holder tự reset qua HTTP bằng `409 CONFLICT`; việc khôi phục khẩn cấp dùng CLI riêng.
- Frontend khóa nút reset trên chính tài khoản đang đăng nhập và giải thích phải dùng recovery command.
- Verification: integration users 9/9 pass; backend typecheck/lint/build và frontend test/build/lint đạt ngày 2026-09-07.

### [Cao] Update role/status không đổi vẫn thu hồi credential

- Đã sửa `src/identity/identity.service.ts`: chỉ thu hồi session/API key khi role hoặc status thực sự thay đổi.
- Regression test: `test/integration/identity/users.spec.ts` bảo vệ trường hợp update no-op.

### [Trung bình] Login/change-password dùng snapshot account cũ khi có cập nhật đồng thời

- Đã dùng conditional write gắn thao tác với password hash và trạng thái account hiện tại.
- Authentication integration tests đã kiểm chứng.

### [Trung bình] Transfer Super Admin kiểm tra mật khẩu ngoài transaction

- Authority holder và password được đọc/kiểm tra lại trong serializable transaction.
- Concurrent-transfer tests đã kiểm chứng.

### [Trung bình] Audit metadata có thể chứa credential

- Đã thêm sanitizer trung tâm: redact key nhạy cảm, giới hạn độ sâu và số phần tử mảng.
- Có test riêng cho `sanitizeAuditMetadata`.

### [Thấp] Refresh race bị báo nhầm token replay

- Luồng thua race đọc lại session và chỉ báo replay khi rotation thực sự thắng.
- Có deterministic race test.

### [Thấp] Disabled principal có thể đi vào station-scope service

- `ScopeService` đã fail closed trước khi lookup role/scope.
- Scope integration test đã kiểm chứng.

### [Thấp] OpenAPI đánh dấu sai temporary password

- Schema đã đổi sang `readOnly` và có contract test.

### [Khôi phục] Chưa có công cụ lấy lại Super Admin khi mất mật khẩu tạm

- Đã thêm CLI `pnpm db:recover-super-admin -- --email <email-super-admin>`.
- CLI chỉ chấp nhận authority holder, nhập mật khẩu hai lần qua prompt ẩn, mở khóa account, thu hồi session và ghi audit `SUPER_ADMIN_EMERGENCY_RECOVERY`.
- Verification: 2/2 recovery integration tests, typecheck, lint và build đều đạt ngày 2026-09-06.
