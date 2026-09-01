# IoT Soil Monitoring Backend

Backend Role 3 cho hệ thống quan trắc đất IoT. Module hiện tại, `integration-core`,
cung cấp cấu hình runtime đã kiểm tra, public health check, chuẩn hóa lỗi HTTP và
Weather API client riêng tư có timeout, chặn redirect và kiểm tra schema dữ liệu.

## Phạm vi hiện tại

Public API duy nhất là `GET /api/v1/health`. Weather API client chỉ được dùng bên
trong backend; `WEATHER_API_KEY` và header `X-API-Key` không bao giờ được gửi cho
frontend.

Các chức năng đăng nhập/RBAC, phân quyền nông trại-trạm, public station data,
PostgreSQL, cảnh báo và cấu hình IoT đang được hoãn theo thứ tự module trong
[Capability Map](./CAPABILITY-MAP.md). Không thêm public station endpoint trước
khi `identity-access` cung cấp xác thực và phân quyền phía server.

## Chạy local

Yêu cầu Node.js `>=24.19.0 <25` và pnpm `11.19.0`.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Mở `.env`, thay `WEATHER_API_KEY=replace-with-local-secret` bằng credential local
thật. `.env` đã được Git ignore; không commit hoặc gửi credential cho frontend.

```powershell
pnpm dev
```

Server mặc định chạy tại `http://localhost:3000`. Trong `development` và `test`,
Swagger UI ở `http://localhost:3000/docs`, còn OpenAPI JSON ở
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

`time` là thời điểm phản hồi thực tế ở định dạng ISO 8601 UTC; các trường và cấu
trúc envelope còn lại đúng như ví dụ trên.

## Lệnh kiểm tra và vận hành

| Lệnh                  | Mục đích                                 |
| --------------------- | ---------------------------------------- |
| `pnpm dev`            | Chạy server development có watch         |
| `pnpm build`          | Biên dịch bản production vào `dist/`     |
| `pnpm start`          | Chạy bản đã build                        |
| `pnpm test`           | Chạy toàn bộ test                        |
| `pnpm test:coverage`  | Chạy test và xuất coverage               |
| `pnpm typecheck`      | Kiểm tra TypeScript mà không emit        |
| `pnpm lint`           | Kiểm tra ESLint, không chấp nhận warning |
| `pnpm format:check`   | Kiểm tra định dạng Prettier              |
| `pnpm audit`          | Kiểm tra advisory của dependency đã khóa |
| `pnpm ignored-builds` | Kiểm tra package build script bị chặn    |

## Tài liệu kiến trúc và bảo mật

- [Integration-core design spec](./docs/superpowers/specs/2026-08-30-integration-core-design.md)
- [Backend capability map](./CAPABILITY-MAP.md)
- [Integration-core threat model](./docs/security/integration-core-threat-model.md)
