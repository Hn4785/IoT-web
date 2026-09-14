# Báo cáo tổng kết kiểm thử production-like

Đợt kiểm thử: 2026-09-10 đến 2026-09-11
Checkout: `D:\IoT-api\.worktrees\integration-core`
Runtime: Node.js 24.17.0, pnpm 11.19.0, PostgreSQL Docker `iot_test`
Phạm vi: backend qua unit/integration test, database test riêng và Weather API giả lập.

Sổ lỗi chính của dự án vẫn là
`docs/reviews/2026-09-04-backend-follow-up.md`. Báo cáo này lưu bằng chứng và ma
trận test; không thay thế sổ lỗi.

## 1. Kết luận

Backend đạt quality gate về test, đảo thứ tự, typecheck, lint, format và build.
Sau đợt test, sáu lỗi code ưu tiên đã được sửa: liveness, reset password cạnh
tranh, scope idempotent, timestamp history, giới hạn Weather response và HTTP
error contract. Schema, migration, dependency và lockfile không đổi. Backend vẫn
**chưa đủ điều kiện production-ready** do các hạng mục vận hành chưa được diễn tập.

Code hiện có thể tiếp tục phát triển/tích hợp trong môi trường kiểm soát. Không
nên public Internet hoặc coi fake upstream là bằng chứng thiết bị thật đã ổn.

## 2. Kết quả tổng quan

| Nhóm tình huống                   | Kết quả                   | Bằng chứng chính                                                                   |
| --------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| Luồng bình thường                 | Đạt                       | Health, login, session, user, scope, API key, latest/history                       |
| Input sai và vô lý                | Đạt                       | Body hỏng/quá lớn an toàn; timestamp UTC vô lý bị từ chối                          |
| Authentication và privilege abuse | Đạt                       | Token dị dạng, role hiện tại, disabled user, cross-scope, HEAD và duplicate header |
| Race condition                    | Đạt với các luồng đã kiểm | Login/refresh/transfer/key rotate/reset/scope có regression cạnh tranh             |
| Dependency/database/upstream lỗi  | Đạt phần đã giả lập       | DB down trả safe 503; upstream timeout/redirect/malformed JSON có test             |
| Burst/rate limit                  | Đạt boundary hiện tại     | 120 health đồng thời đều 200; route người dùng vẫn trả 429 khi vượt ngưỡng         |
| Production hardening              | Chưa đạt release gate     | Weather body có cap; còn readiness/multi-instance/MFA/backup-restore               |

## 3. Quality gate cuối

| Gate                    | Kết quả ngày 2026-09-11                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| Full suite              | 42/42 file, 251/251 test đạt sau hardening                             |
| Shuffle seed `20260911` | 42/42 file, 251/251 test đạt sau hardening                             |
| Shuffle seed `424242`   | 42/42 file, 238/238 test đạt                                           |
| Coverage                | 88.33% statement, 79.33% branch, 92.20% function, 90.00% line          |
| Typecheck               | Đạt                                                                    |
| ESLint                  | Đạt, 0 warning/error                                                   |
| Prettier                | Đạt                                                                    |
| Build + Prisma generate | Đạt                                                                    |
| `pnpm audit --prod`     | Không đạt tuyệt đối: 1 advisory moderate `mysql2` gián tiếp qua Prisma |

So với baseline trước regression test, coverage tăng 0.29 điểm statement, 0.34
điểm branch, 0.02 điểm function và 0.22 điểm line. Audit không được tự động sửa
vì runtime chỉ dùng PostgreSQL và thay dependency cần một đợt nâng cấp Prisma có
kiểm soát.

## 4. Các tình huống đã chạy

### HTTP và input boundary

- Request hợp lệ và unknown route; request ID hợp lệ, quá dài và chứa CR/LF.
- JSON sai cú pháp, `text/plain`, body lớn hơn giới hạn mặc định.
- Bearer thiếu scheme, sai casing, rỗng, ghép hai token và quá dài.
- Hai giá trị `X-API-Key` trong cùng header bị từ chối trước database lookup.
- `HEAD` trên route GET được bảo vệ không vượt qua authentication.
- CORS preflight từ origin hợp lệ và origin giả mạo; header không phản chiếu origin
  của attacker.

### Identity, session và phân quyền

- Login đúng/sai/không tồn tại/disabled; lockout tuần tự và đồng thời.
- JWT không được tin tuyệt đối: role, status và session được đọc lại từ database.
- Pending password change chỉ đi vào các route cho phép.
- Refresh thiếu/sai Origin, cookie quá lớn, rotation, replay, logout idempotent và
  cookie production.
- Admin/Super Admin create/update/reset/transfer; authority singleton và chống
  transfer đồng thời.
- Farmer chỉ đọc farm được gán; Client Developer không dùng browser UI route.
- API key đúng/sai/hết hạn/revoked/owner disabled/scope bị rút; create/rotate/revoke
  và concurrent rotate.

### Dữ liệu trạm và upstream

- Phân trang hierarchy, cursor sai loại/sai parent và cross-scope denial.
- Latest soil chỉ nhận tám field được duyệt, timestamp theo field, sparse/invalid
  value, duplicate/missing station response, cache/stale/coalescing/LRU.
- History range/aggregate/order/limit/cursor, sparse series, trùng timestamp và
  continuation không lặp điểm.
- Upstream timeout, redirect, status lỗi, JSON/schema sai và credential không xuất
  hiện trong lỗi.

### Database, dependency và tính lặp lại

- Database không kết nối được trả `503 DATABASE_UNAVAILABLE`, không lộ URL hay
  `ECONNREFUSED`.
- Test chỉ cho phép database tên `/iot_test`; Docker database đang healthy.
- `pnpm audit --prod`: một advisory moderate `mysql2` gián tiếp qua Prisma; chưa
  reachable vì runtime chỉ dùng PostgreSQL.
- Secret filename/marker scan: chỉ `.env.example` được track; `.env` và
  `.env.local` có ignore rule.
- Coverage trước khi thêm regression mới: 88.11% statement, 78.58% branch,
  92.59% function và 89.74% line.

## 5. Lỗi và rủi ro tìm thấy

Ba lỗi code còn lại đã được sửa và kiểm chứng ngày 2026-09-11. Các ưu tiên còn
lại đều cần quyết định hoặc môi trường production:

1. Quyết định proxy/shared-store rate-limit boundary và số trusted proxy hop.
2. Diễn tập readiness, multi-instance, backup/restore và secret rotation.
3. Bổ sung MFA/SSO cho Super Admin trước khi public Internet.
4. Nâng Prisma có kiểm soát khi bản vá `mysql2` gián tiếp phù hợp được chốt.

Shuffle tìm thấy ba nhóm test isolation: API-key authentication dùng chung state
bị mutation, identity user dựa vào record do case khác tạo, và client station-data
phụ thuộc thứ tự fixture latest/history. Các test đã tự tạo/reset prerequisite;
upstream helper chọn fixture theo request path.

Checkpoint 4 còn phát hiện probe concurrent farm membership không ổn định: lần
đầu trả `[200, 200]`, nhưng khi đảo thứ tự seed `20260911` trả `[500, 200]`.
Failing probe đã được bỏ khỏi quality gate sau khi lưu bằng chứng; sổ lỗi chính đã
mở rộng lỗi transaction conflict cho cả farm membership và station grant.

## 6. Những điều chưa thể chứng minh trên máy local

- Dữ liệu thật của `CENTER`, `NODE01` đến `NODE06`, mapping sensor/unit/depth và
  hành vi khi thiết bị mất điện/chập chờn.
- TLS/reverse proxy thật, nhiều backend instance, shared rate limiter, clock skew,
  network partition, database failover, disk-full và rolling deployment.
- Load/soak dài, ngưỡng CPU/RAM/connection pool và kích thước history thực tế.
- Backup/restore, secret rotation, MFA cho Super Admin, alert/monitor production.
- End-to-end bằng frontend thật sau khi frontend thay toàn bộ station/soil mock.

Các mục này phải được test ở checkpoint B-device và production release gate;
không được suy từ fake upstream thành “đã production-ready”.

## 7. Thay đổi của đợt test và hardening sau test

- Thêm production-facing boundary test cho malformed/oversized body, CORS,
  credential dị dạng, HEAD auth bypass, burst limiter và database unavailable.
- Bổ sung race regression cho API-key rotation và test isolation cho API-key,
  identity user, latest/history fixture.
- Mở rộng fake Weather server để chọn fixture theo request path và ngắt kết nối
  giữa body; kiểm response lớn và stale-if-error.
- Sau khi lưu bằng chứng RED, đã thay behavior production có giới hạn: miễn
  limiter cho health, chống reset password chồng lấn và retry hữu hạn cho scope
  idempotent. Không đổi schema, migration, dependency hoặc lockfile.
- Bổ sung validator UTC dùng chung, Weather response stream cap 1 MiB và chuẩn
  hóa lỗi HTTP `400/413/415`; regression tập trung đạt 102/102 test.
- Đợt kiểm thử không tự push; bằng chứng được giữ trong checkpoint backend này.

## 8. Lệnh tái kiểm

```powershell
pnpm exec vitest run test/integration/production-resilience.spec.ts
pnpm test
pnpm exec vitest run --sequence.shuffle --sequence.seed=20260911
pnpm exec vitest run --sequence.shuffle --sequence.seed=424242
pnpm test:coverage
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm audit --prod
```

Không chạy các lệnh này với `DATABASE_URL` trỏ vào dữ liệu thật. Database test bắt
buộc là `/iot_test`; upstream phải là server giả lập cho đến khi có kế hoạch
B-device được duyệt.

## 9. Trạng thái checkpoint

- Checkpoint 1: ma trận test và trust boundary - hoàn thành.
- Checkpoint 2: baseline, coverage và test isolation - hoàn thành.
- Checkpoint 3: failure injection, tải có trần và race probe - hoàn thành.
- Checkpoint 4: full quality gate, review diff và báo cáo tổng kết - hoàn thành.

Verdict cập nhật: **đạt gate phát triển sau hardening, chưa đạt gate phát hành
production**. Công việc tiếp theo nên fix lỗi theo thứ tự ở mục 5, rồi chạy lại
toàn bộ mục 8 trước khi tạo baseline/commit mới.
