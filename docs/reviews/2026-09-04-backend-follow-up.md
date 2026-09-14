# Sổ lỗi Backend

Cập nhật gần nhất: 2026-09-14. Đây là file theo dõi lỗi chính của backend. Lỗi chưa hoàn thành luôn đặt ở trên; lỗi đã sửa được chuyển xuống cuối file sau khi có test hoặc bằng chứng kiểm chứng.

## Chưa sửa

### [Vận hành] Các hardening trước production còn thiếu

- Rate limit hiện là process-local; triển khai nhiều instance cần shared store hoặc limiter tầng hạ tầng.
- Chưa tự thêm Redis hoặc bật `trustProxy`: cần chốt kiến trúc triển khai
  (gateway hay shared store và số proxy hop) để không tạo lỗ hổng giả mạo IP.
- Chưa có MFA/SSO; Super Admin cần MFA trước khi public Internet.
- Audit append-only mới được bảo vệ theo convention ứng dụng, chưa có database role chặn update/delete.
- Cần diễn tập backup/restore, mã hóa backup, rotation secret và audit monitoring.
- Dependency audit chỉ phát hiện advisory đã biết, không loại trừ supply-chain compromise.

### [Trung bình, chưa reachable] Advisory `mysql2` từ Prisma tooling

- `pnpm audit --prod` kiểm tra lại ngày 2026-09-11 vẫn báo
  `GHSA-rgwj-5xj2-c3m3` với `mysql2 <=3.23.0`, được kéo gián tiếp qua Prisma.
- Backend chỉ cấu hình PostgreSQL và không gọi MySQL protocol, nên chưa tìm thấy đường khai thác trong runtime hiện tại; high/critical audit vẫn đạt.
- Cần xử lý trong đợt cập nhật dependency có kiểm soát: chờ Prisma dùng bản vá, xem diff lockfile, chạy migration/test đầy đủ. Không dùng `audit fix --force`.

## Đã kiểm chứng không phải lỗi

### Cursor user không tái hiện lỗi P2025

- Cursor UUID hợp lệ nhưng không tồn tại đã được thử trực tiếp với PostgreSQL/Prisma hiện tại: API trả HTTP 200 và trang rỗng.
- Không sửa repository khi chưa tái hiện được. Nếu xảy ra ở môi trường khác, phải giữ Prisma error code và query cụ thể.

### Origin, cookie path và refresh single-flight

- Kiểm tra `Origin` ở refresh/logout và cookie path `/api/v1/auth` là ràng buộc bảo mật có chủ ý.
- Frontend phải dùng hàng đợi/single-flight để không gọi song song cùng refresh token.

### Mở lại frontend khi chưa Logout vẫn giữ phiên

- Restart frontend không kết thúc refresh session trên backend. Nếu cookie
  `HttpOnly` còn hạn, frontend refresh và khôi phục đúng tài khoản là hành vi dự kiến.
- Logout đã được kiểm chứng thu hồi session, xóa cookie và luôn xóa access token
  trong bộ nhớ frontend, kể cả request logout thất bại.

## Đã sửa

### [Cao, API key] Key vừa tạo bị API Explorer từ chối

- Frontend trim `X-API-Key`, hiển thị rõ Copy thành công/thất bại và yêu cầu chọn
  ít nhất một Station đã được cấp; scope rỗng hiển thị `No access`.
- Backend cung cấp `GET /api/v1/developer/api-keys/available-stations` và giữ
  nguyên secret chỉ hiển thị một lần.
- Regression ngày 2026-09-14 tạo key qua HTTP rồi dùng chính secret đó gọi
  `GET /api/v1/client/stations`: HTTP 200 và chỉ trả station đúng scope (7/7 test).
- Frontend đạt 24/24 test, build và lint. Không ghi plaintext key vào tài liệu,
  log hoặc ảnh kiểm thử.

### [Trung bình] Bộ lọc history chấp nhận timestamp UTC không hợp lệ

- Browser và Weather contract dùng chung validator UTC nghiêm ngặt: yêu cầu đủ
  date-time kết thúc bằng `Z`, kiểm lại từng thành phần lịch và tối đa millisecond.
- Date-only, timezone offset và ngày không tồn tại bị từ chối; leap day hợp lệ
  vẫn được chấp nhận.
- Verification ngày 2026-09-11: focused gate 102/102 test; full suite và shuffle
  seed `20260911` cùng đạt 42/42 file, 251/251 test.

### [Trung bình, hardening] Weather response chưa giới hạn kích thước

- Weather client giới hạn response stream sau giải nén ở 1 MiB, kiểm cả
  `Content-Length` và số byte thực đọc; reader bị hủy ngay khi vượt ngưỡng.
- Response hợp lệ về schema nhưng quá lớn trả safe `502 UPSTREAM_UNAVAILABLE`,
  không đưa body hoặc credential vào response.
- Verification ngày 2026-09-11: focused gate 102/102 test; coverage Weather client
  94.38% statements, 93.33% branches và 97.18% lines.

### [Thấp, contract] Lỗi HTTP trước controller chưa đồng nhất

- `400`, `413` và `415` từ framework được ánh xạ về `VALIDATION_ERROR` với thông
  báo trung tính riêng; payload, stack và đường dẫn nội bộ không bị phản chiếu.
- Verification ngày 2026-09-11: production-facing focused gate đạt; full suite
  42/42 file, 251/251 test.

### [Cao, production] Liveness bị global rate limit chặn khi burst

- `GET /api/v1/health` được miễn limiter ứng dụng để load balancer không đánh dấu
  sai instance khỏe trong lúc traffic tăng. Các route người dùng vẫn chịu global
  limiter; regression chuyển kiểm tra `429` sang `POST /api/v1/auth/login`.
- Burst 120 request health đồng thời hiện trả 120 lần `200`.
- Verification ngày 2026-09-11: production-resilience và security-headers 15/15;
  full suite 42/42 file, 242/242 test.
- Shared limiter/proxy boundary cho triển khai nhiều instance vẫn là hạng mục vận
  hành riêng, không được coi là đã giải quyết bởi thay đổi này.

### [Trung bình] Reset password đồng thời phát nhiều mật khẩu hoặc trả 500

- Reset cùng một user dùng PostgreSQL transaction advisory lock và cửa sổ chống
  cấp lặp 30 giây. Một request thắng trả `201`; request chồng lấn hoặc vừa hoàn
  tất trả `409`, không phát hai mật khẩu tạm cùng lúc.
- Sau cửa sổ chống lặp, Admin vẫn có thể cấp lại mật khẩu tạm khi người dùng làm
  mất mật khẩu trước; không cần đọc lại secret cũ và không đổi schema.
- Regression chạy ba lượt liên tiếp cùng scope tests: mỗi lượt 18/18 test; full
  suite 42/42 file, 242/242 test ngày 2026-09-11.

### [Trung bình] Gán Farm/Station scope đồng thời trả 500

- Các transaction idempotent cấp/gỡ quyền retry hữu hạn tối đa 5 lần, chỉ với
  `P2002` (tranh khóa duy nhất) và `P2034` (serialization conflict). Lỗi khác vẫn
  fail closed, không bị retry che khuất.
- Bốn request đồng thời cho cùng farm membership hoặc station grant đều trả
  `200`; database chỉ có một bản ghi quyền.
- Regression chạy ba lượt liên tiếp cùng reset tests: mỗi lượt 18/18 test; full
  suite 42/42 file, 242/242 test ngày 2026-09-11.

### [Test infrastructure] API-key authentication test phụ thuộc thứ tự

- Shuffle seed `20260910` từng làm case API key hợp lệ fail vì case trước đó đã
  disable owner/xóa grant dùng chung.
- Đã khôi phục trạng thái key, owner và grant trong `beforeEach`; cùng seed hiện
  đạt 5/5. Thay đổi chỉ nằm ở test, không đổi behavior production.
- Seed `424242` tiếp tục phát hiện `identity/users` dựa vào user do case khác tạo
  và `station-data/client` dựa vào thứ tự fixture latest/history. Các case user
  đã tự tạo prerequisite; upstream helper đã hỗ trợ fixture chọn theo request
  path. Cùng seed hiện đạt toàn bộ 42 file và 234 test.

### [Regression] Các production-facing boundary mới

- Thêm kiểm tra malformed/oversized body, CORS, bearer dị dạng, duplicate
  `X-API-Key`, HEAD auth bypass, concurrent burst và database unavailable thực.
- Thêm kiểm tra hai request rotate cùng API key chỉ có một request tạo credential;
  kết quả xác minh là `201` và `409`.

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

### [Trung bình, Frontend] Nút Copy credential và response thất bại im lặng

- Đã gom thao tác clipboard vào helper dùng chung, chờ Promise và bắt trường hợp
  trình duyệt từ chối quyền.
- API key secret, mật khẩu tạm, API Explorer và API Docs đều báo `Copied` khi
  thành công; khi thất bại sẽ hướng dẫn chọn/copy thủ công. Credential vẫn chỉ
  ở state tạm, không lưu localStorage/sessionStorage và không gửi telemetry.
- Verification ngày 2026-09-14: frontend 24/24 test, build và lint đạt.
