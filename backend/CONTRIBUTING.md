# Quy ước phát triển backend

Áp dụng cho AgriSense Backend 3.0.0. Cập nhật: 12/10/2026.

Backend sở hữu database, authentication/authorization, API nguồn, dữ liệu trạm,
cảnh báo và cấu hình vận hành. Frontend nằm ở thư mục `frontend/` cùng repository;
không trộn source hoặc dependency frontend vào package `backend/`.

Trước khi thay đổi, đọc [CAPABILITY-MAP.md](CAPABILITY-MAP.md),
[ARCHITECTURE.md](docs/project/ARCHITECTURE.md) và các contract/source/test liên
quan. Lỗi đang mở và giới hạn của phiên bản nằm trong capability map.

## 1. Nguyên tắc thay đổi

- Mỗi thay đổi có mục tiêu, phạm vi file, điều kiện đạt và cách kiểm tra cụ thể.
- Hành vi mới hoặc sửa lỗi bắt đầu bằng một behavioral test thất bại đúng lý do;
  thêm production code tối thiểu, sau đó refactor khi test đã xanh.
- Tái hiện lỗi trước khi sửa. Không sửa production theo phỏng đoán; lỗi không
  tái hiện phải ghi rõ kịch bản đã thử và kết quả.
- Kiểm tra toàn bộ đường đi liên quan: controller/DTO, service, quyền, transaction,
  cleanup, session/key, OpenAPI, giả định frontend và regression.
- Không gộp nâng dependency, refactor và thay đổi chức năng thành một thay đổi lớn.
- Không giảm coverage threshold, xoá assertion, skip test hoặc tắt lint để làm
  kiểm tra đạt. Nếu test hạ tầng xung đột, báo đúng nguyên nhân và chạy lại có cô lập.
- Thay đổi authentication, CORS, rate limit, schema hoặc tích hợp ngoài phải được
  chủ dự án duyệt trước khi triển khai.
- Không xoá migration, hồ sơ bảo mật hay dữ liệu nghiệp vụ vì muốn dọn source.

## 2. Cấu trúc và dependency

Dùng các module hiện có: `config`, `integrations/weather`, `auth`, `identity`,
`authorization`, `api-keys`, `data-sources`, `station-data`, `alert-config`,
`notifications`, `operations`, `security-audit` và `database`.

Controller xử lý HTTP/parse DTO; service điều phối nghiệp vụ; repository xử lý
persistence và transaction. Chính sách scope dùng chung, không sao chép điều kiện
quyền rải rác theo từng endpoint.

Luồng dependency đi từ chức năng phía sau tới nền tảng phía trước; không tạo
vòng import giữa station-data, alert-config và operations. Instrumentation hữu
hạn là hạ tầng riêng, không phải API analytics công khai.

TypeScript dùng ESM; import nội bộ theo quy ước extension `.js` của project.
Prisma client được generate trong `src/generated/prisma` và không commit.

## 3. Contract HTTP và DTO

- Prefix: `/api/v1`; resource dùng danh từ số nhiều.
- Field/query dùng `camelCase`; timestamp trả ISO 8601 UTC, trừ contract có quy
  định riêng.
- Success: `{ "success": true, "data": ... }`.
- Error: `{ "success": false, "error": { "code": "...", "message": "..." }, "requestId": "..." }`.
- Input/environment/response của provider phải được validate ở ranh giới.
- Response có DTO/select rõ ràng; không serialize nguyên database record.
- Không trả internal error, connection string, credential, hash hoặc ciphertext.
- Pagination/cursor phải buộc vào query và scope hiện hành, có giới hạn.
- OpenAPI lấy từ controller/contracts; cập nhật mô tả trong
  `ARCHITECTURE.md` trước khi thay đổi contract đã được duyệt.

Không tự đổi tên route hoặc bỏ field để khớp frontend. Thay đổi tương thích/ngược
tương thích phải được mô tả và kiểm tra các consumer liên quan.

## 4. Các bất biến cần giữ

1. Scope được kiểm tra ở server; menu ẩn không phải kiểm soát quyền.
2. Ordinary Admin không đọc dữ liệu nguồn MANAGED của chủ khác.
3. Super Admin có quyền giám sát, không tự có quyền sở hữu khóa hoặc chia sẻ.
4. API key phải thoả cả account grant và key station scope hiện tại.
5. Reading/snapshot gắn đúng station/source; late response không vượt fetch fence.
6. Removed source hoặc lease hết hạn không được ghi dữ liệu mới sau thời điểm đó.
7. Stored/stale/backfill không phát cảnh báo mới như một mẫu đo mới.
8. Rule write kiểm tra revision, unit, metadata và idempotency trong transaction.
9. Không xoá dữ liệu còn trong 90 ngày để tránh capacity limit.
10. Không giả lập số đo, sensor/depth, coverage hoặc trạng thái kết nối thành dữ
    liệu provider thật.

Lỗi xác nhận mật khẩu Reveal và lỗi phiên đăng nhập phải được phân biệt trong
contract sử dụng frontend. Không nới kiểm tra mật khẩu hoặc session để né logout.

## 5. Database và migration

Schema ở `prisma/schema.prisma`; các migration đã giao ở `prisma/migrations`.
Migration mới phải có phần đánh giá tác động dữ liệu, tương thích rollback,
trình tự rollout và cách xác nhận.

Dùng database test cô lập. Không chạy `migrate:dev`, reset schema, seed, fault
injection hoặc test tích hợp lên database dữ liệu thật. Không sửa trực tiếp các
cột hash/authority hay lịch sử migration bằng SQL để chữa lỗi tạm thời.

Trước bảo trì có tác động dữ liệu, làm theo
[DELIVERY-RECOVERY.md](docs/operations/DELIVERY-RECOVERY.md).

## 6. Kiểm tra và review

Tại backend đã cấu hình đúng target local/test:

```powershell
pnpm verify
pnpm test
pnpm test:coverage
pnpm audit --prod --audit-level=high
pnpm security:secrets
git diff --check
```

`verify` không chạy test. Test database cần `TEST_DATABASE_URL` riêng;
kiểm tra đúng target trước khi chạy. Với thay đổi chỉ tài liệu, kiểm tra thêm
đường dẫn, lệnh được nêu, biến môi trường, trạng thái tồn đọng và scope diff;
không ghi kết quả kiểm thử cũ như một lần chạy mới.

Review ưu tiên đúng chức năng, phân quyền/rò rỉ dữ liệu, transaction/fencing,
khả năng đọc, tương thích API và giới hạn tài nguyên. Mọi kết luận "đã sửa/đã đạt"
phải có bằng chứng phù hợp với phạm vi kết luận.

## 7. Commit và bàn giao

Commit nhỏ, atomic; dùng `feat:`, `fix:`, `refactor:`, `test:`, `docs:` hoặc
`chore:` và ghi rõ lý do/tác động. Kiểm tra diff trước khi commit; không thêm
thay đổi ngoài phạm vi hoặc đẩy remote khi chưa được duyệt.

Giữ lockfile và migration trong Git. Không commit `node_modules`, output build,
`.env`, credential, private key, database dump, ảnh diagnostic chưa lược bỏ secret
hoặc dữ liệu fixture được xuất ra từ database.

Tài liệu backend chỉ có chín file được liệt kê trong README backend. Hồ sơ
lịch sử và bản Word riêng nằm ngoài danh mục đó, không thêm lại vào Git để tiện
dẫn link. Cấu hình production, backup và khóa giải mã trao qua kênh bảo vệ riêng.
