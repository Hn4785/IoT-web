# IoT Soil Monitoring Backend

Backend Role 3 cho hệ thống quan trắc đất IoT. Nền tảng hiện tại cung cấp health
check, Weather API client riêng tư và Phase A `identity-access`: tài khoản lưu ở
PostgreSQL, ba role, một Super Admin, browser session xoay vòng, phân quyền theo
nông trại/trạm và API key có scope cho Client Developer.

## Phạm vi hiện tại

`GET /api/v1/health` là endpoint public. Browser dùng `/api/v1/auth/*`; Admin quản
lý tài khoản, authority, farm membership và station grant; Client Developer quản
lý key qua `/api/v1/developer/api-keys`. Client Developer không có business UI.

Phase A chưa cung cấp latest/history của cảm biến. Endpoint dữ liệu trạm chỉ được
thêm trong Phase B và bắt buộc gọi policy scope hoặc API-key guard hiện có.
Weather credential luôn ở backend và không được gửi cho frontend.

## Chạy local

Yêu cầu Node.js `>=24.19.0 <25`, pnpm `11.19.0`, Docker Desktop và PostgreSQL
container được cấu hình trong `compose.yaml`.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Trong `.env`, đặt Weather key, mật khẩu PostgreSQL và hai secret khác nhau dài tối
thiểu 32 ký tự cho JWT/credential hashing. `.env` đã được Git ignore; không commit
hoặc gửi các giá trị này cho frontend.

Tạo thư mục dữ liệu đúng ổ E, khởi động PostgreSQL và áp migration:

```powershell
New-Item -ItemType Directory -Force E:\IoT-data\postgres
docker compose up -d postgres
pnpm db:generate
pnpm db:migrate:deploy
```

Bootstrap Super Admin lần đầu. Mật khẩu được nhập hai lần bằng prompt ẩn, không
đặt trong argument hoặc environment:

```powershell
pnpm db:bootstrap-super-admin -- --email root@example.com
```

```powershell
pnpm dev
```

Server mặc định chạy tại `http://localhost:3000`. Trong `development` và `test`,
Swagger UI ở `http://localhost:3000/docs`, OpenAPI JSON ở
`http://localhost:3000/docs-json`. Hai route này không tồn tại trong production.

## Health contract

```powershell
curl.exe http://localhost:3000/api/v1/health
```

```json
{
  "success": true,
  "data": {
    "service": "iot-api",
    "version": "0.1.0",
    "status": "healthy",
    "environment": "development",
    "time": "2026-09-01T00:00:00.000Z"
  }
}
```

`time` là thời điểm phản hồi thực tế ở định dạng ISO 8601 UTC.

## Identity và session contract

- Access JWT sống 15 phút; role/status/Super Admin luôn được đọc lại từ database.
- Refresh token sống tối đa 7 ngày, chỉ nằm trong cookie `HttpOnly`, được rotate
  một lần và lưu ở PostgreSQL dưới dạng HMAC hash.
- Năm lần login sai khóa đăng nhập 15 phút. Unknown/disabled/locked/wrong password
  dùng chung lỗi `INVALID_CREDENTIALS`.
- Tài khoản mới phải đổi temporary password trước khi vào business route.
- Chỉ Super Admin được quản lý Admin khác hoặc chuyển authority.
- Farmer đọc trạm thông qua farm membership. Client Developer chỉ dùng API key
  trên station grant do Admin cấp; plaintext key chỉ xuất hiện ở create/rotate.

Frontend gửi access token bằng `Authorization: Bearer ...` và gọi refresh/logout
với `credentials: 'include'` từ đúng `FRONTEND_ORIGIN`.

## DBeaver và retention

Kết nối DBeaver tới `localhost:5432`, database `iot_dev`, user lấy từ
`POSTGRES_USER`. Chỉ nhập mật khẩu local trong DBeaver; không lưu vào Git. Các cột
`passwordHash`, `tokenHash`, `keyHash` phải chứa hash, không chứa plaintext.

Retention không chạy lúc app khởi động. Operator phải xác nhận rõ:

```powershell
pnpm retention:run -- --confirm-retention
```

Lệnh xử lý theo batch: session hết hạn/đã revoke quá 30 ngày, account yêu cầu xóa
quá 90 ngày và API key hết hạn/đã revoke quá 90 ngày. Super Admin đang giữ
authority không bị anonymize; audit linkage bằng user ID được giữ lại.

## Lệnh kiểm tra và vận hành

| Lệnh                                        | Mục đích                                 |
| ------------------------------------------- | ---------------------------------------- |
| `pnpm dev`                                  | Chạy development server                  |
| `pnpm build`                                | Biên dịch production                     |
| `pnpm start`                                | Chạy bản đã build                        |
| `pnpm test`                                 | Chạy toàn bộ test                        |
| `pnpm test:coverage`                        | Chạy test và xuất coverage               |
| `pnpm typecheck`                            | Kiểm tra TypeScript                      |
| `pnpm lint`                                 | Kiểm tra ESLint, không chấp nhận warning |
| `pnpm format:check`                         | Kiểm tra Prettier                        |
| `pnpm audit`                                | Kiểm tra dependency advisory             |
| `pnpm ignored-builds`                       | Kiểm tra package build script bị chặn    |
| `pnpm db:status`                            | Kiểm tra migration database hiện tại     |
| `pnpm retention:run -- --confirm-retention` | Chạy retention có xác nhận               |

## Tài liệu kiến trúc và bảo mật

- [Integration-core design spec](./docs/superpowers/specs/2026-08-30-integration-core-design.md)
- [Identity-access design spec](./docs/superpowers/specs/2026-09-02-identity-access-design.md)
- [Backend capability map](./CAPABILITY-MAP.md)
- [Threat model](./docs/security/integration-core-threat-model.md)
- [Project status report](./docs/project/2026-09-02-project-status-report.md)
- [Backend completion roadmap](./docs/roadmaps/2026-09-02-backend-completion-roadmap.md)
