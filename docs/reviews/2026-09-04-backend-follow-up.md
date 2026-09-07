# Sổ lỗi Backend

Cập nhật gần nhất: 2026-09-06. Đây là file theo dõi lỗi chính của backend. Lỗi chưa hoàn thành luôn đặt ở trên; lỗi đã sửa được chuyển xuống cuối file sau khi có test hoặc bằng chứng kiểm chứng.

## Chưa sửa

### [Trung bình] Integration tests tranh chấp cùng database

- Hiện tượng: nhiều suite cùng `TRUNCATE` database `iot_test` khi Vitest chạy song song, làm fixture bị xóa hoặc trùng chéo.
- Bằng chứng: chạy tuần tự bằng `vitest run --no-file-parallelism` đạt 31/31 file và 135/135 test trong lần audit.
- Cần sửa: cấu hình nhóm integration chạy tuần tự hoặc cấp database/schema riêng cho từng worker. Không dùng retry để che race.
- Acceptance test: toàn bộ suite ổn định qua nhiều lần chạy bằng lệnh mặc định trong CI.

### [Trung bình] Database unavailable chưa có contract 503

- Hiện tượng: lỗi kết nối/timeout Prisma có thể đi qua filter chung và trả `500 INTERNAL_ERROR`.
- Cần sửa: chỉ ánh xạ các lỗi kết nối Prisma đã xác minh sang HTTP 503 với mã công khai trung tính; lỗi truy vấn/lập trình vẫn là 500.
- Acceptance test: mất kết nối trả 503; response và log không lộ URL, username, password hoặc raw exception.

### [Trung bình] Reset password chưa có rate limit riêng

- Hiện tượng: endpoint reset chỉ dùng giới hạn toàn cục 100 request/phút.
- Cần sửa: áp dụng giới hạn riêng sau khi chốt ngưỡng, đề xuất 10 request/phút tương tự thao tác chuyển Super Admin.
- Acceptance test: các request trong ngưỡng hoạt động; request vượt ngưỡng trả `429 RATE_LIMITED`.

### [Trung bình] Admin chưa đọc được quyền Farm/Station hiện tại của user

- Hiện tượng: backend có lệnh gán/bỏ quyền nhưng User DTO và API chi tiết không trả danh sách membership/grant hiện tại. Frontend không thể đối chiếu trước khi sửa.
- Cần sửa: trả assignment IDs trong `GET /admin/users/:id` hoặc bổ sung endpoint đọc riêng; sau đó frontend mới dùng UUID thật.
- Acceptance test: Admin đọc đúng quyền; Farmer/Client Developer không đọc chéo; resource ngoài phạm vi trả lỗi an toàn.

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
