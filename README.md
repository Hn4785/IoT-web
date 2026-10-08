# IoT Soil Monitoring Backend

Backend Role 3 cho hệ thống quan trắc đất IoT: tài khoản/session, phân quyền,
API key, nguồn dữ liệu thật, số đo và snapshot bền vững trong PostgreSQL,
cảnh báo tự động, thông báo trong ứng dụng và công cụ vận hành. Weather API
client và credential luôn nằm phía backend.

Trạng thái hiện hành nằm tại [task index](./tasks/todo.md), kế hoạch còn lại tại
[kế hoạch hoàn thiện và bàn giao](./tasks/plan.md); phiên bản và kết quả nằm trong
tài liệu bàn giao gửi riêng (không lưu trong Git).
Các checkpoint có ngày là bằng chứng của đợt đó, không thay thế task index.

## Phạm vi hiện tại

`GET /api/v1/health` là endpoint public. Browser dùng `/api/v1/auth/*`; Admin quản
lý tài khoản, authority, farm membership và station grant; Client Developer quản
lý key qua `/api/v1/developer/api-keys`. Client Developer có portal quản lý key
và API Tools riêng, không có quyền trang quản trị/nông trại.

Phase A cung cấp identity/access; Phase B đã bổ sung latest/history của cảm biến
và bắt buộc gọi policy scope hoặc API-key guard hiện có.
Weather credential luôn ở backend và không được gửi cho frontend.

Phase B1 đã cung cấp hierarchy có phân quyền cho browser:

- `GET /api/v1/farms`
- `GET /api/v1/farms/:farmId/plots`
- `GET /api/v1/plots/:plotId/stations`
- `GET /api/v1/stations/:stationId`

Admin đọc registry theo policy hiện hành; Farmer đọc phạm vi được sở hữu/chia sẻ. Các tài
nguyên không tồn tại và ngoài phạm vi đều trả cùng `404 NOT_FOUND`. Client
Developer không dùng các route browser này và nhận `403 FORBIDDEN`.

Phase B backend còn cung cấp dữ liệu đất đã chuẩn hóa:

- Browser Bearer: `GET /api/v1/stations/:stationId/data/latest` và
  `GET /api/v1/stations/:stationId/data/history`.
- Client Developer API key: `GET /api/v1/client/stations`,
  `GET /api/v1/client/data/latest?station=NODE01` và
  `GET /api/v1/client/data/history?station=NODE01`.

Frontend nên poll latest mỗi 30 giây. History raw tối đa 7 ngày; history tổng hợp
(`interval=5m|30m|1h|1d` kèm `aggregate=mean|min|max|first|last`) tối đa 90
ngày, phân trang bằng `nextCursor`. Client gửi `X-API-Key` và đọc các header
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

`unit`, `sensorId` và `depthCm` có thể là `null` nếu nguồn không cung cấp metadata.
Backend lưu số đo raw đã xác thực trong PostgreSQL tối đa 90 ngày, giữ snapshot
cuối riêng và thu thập nền mỗi 120 giây, tối đa hai trạm đồng thời. API mất kết nối
vẫn đọc được dữ liệu đã lưu theo quyền hiện tại; `dataOrigin`, `isStale` và coverage
phân biệt dữ liệu mới, dữ liệu cũ và lịch sử chưa đủ. Không sinh số liệu khi mất nguồn.
Snapshot/backfill cũ không được phát cảnh báo tự động như số đo mới.
Nguồn CENTER/NODE đã được bên cung cấp xác nhận là dữ liệu cảm biến thật ngày
2026-09-28; Phase B được đánh dấu `live-verified` và hoàn tất local ngày
2026-09-30. Bản D/F/FE đã triển khai Git/Pi ngày 2026-10-06 theo tài liệu bàn giao.
Giới hạn 90 ngày là thời gian giữ dữ liệu, không chứng minh đã backfill đủ 90 ngày:
cửa sổ history rỗng còn chặn backfill. Notification tự động mới từ provider sau
phục hồi và nghiệm thu server bên nhận vẫn là gate riêng.

## Chạy local

Yêu cầu Node.js `>=24.17.0 <25`, pnpm `11.19.0`, Docker Desktop và PostgreSQL
container được cấu hình trong `compose.yaml`.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Trong `.env`, đặt Weather key, mật khẩu PostgreSQL và hai secret khác nhau dài tối
thiểu 32 ký tự cho JWT/credential hashing. Cấu hình khóa mã hóa 32 byte base64
`DATA_SOURCE_ENCRYPTION_KEY` và danh sách HTTPS origin `DATA_SOURCE_ALLOWED_ORIGINS`
theo [local runbook](./docs/operations/LOCAL-RUNBOOK.md). `.env` đã được Git ignore;
không commit hoặc gửi các giá trị này cho frontend.

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

Không chạy seed demo trong quy trình triển khai. Thêm nguồn thật qua API Sources
và chia sẻ quyền theo tài khoản. Không chuyển fixture/dump database test lên Pi/server.

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
    "version": "2.5.6",
    "status": "healthy",
    "environment": "development",
    "time": "2026-09-01T00:00:00.000Z"
  }
}
```

`time` là thời điểm phản hồi thực tế ở định dạng ISO 8601 UTC.

Ví dụ kiểm tra Phase B local (thay ID/token/key bằng giá trị local, không lưu
credential vào Git):

```powershell
curl.exe -H "Authorization: Bearer <access-token>" "http://localhost:3000/api/v1/stations/<station-id>/data/latest?fields=moisture,ph"
curl.exe -H "Authorization: Bearer <access-token>" "http://localhost:3000/api/v1/stations/<station-id>/data/history?begin=2026-09-01T00:00:00Z&end=2026-09-02T00:00:00Z&fields=moisture"
curl.exe -H "X-API-Key: <api-key>" "http://localhost:3000/api/v1/client/data/latest?station=NODE01&fields=moisture,ph"
```

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

Retention tài khoản/session/lifecycle không chạy lúc app khởi động. Operator phải xác nhận rõ:

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
| `pnpm verify`                               | Format, typecheck, lint và build         |
| `pnpm audit --prod --audit-level=high`      | Chặn advisory high/critical              |
| `pnpm security:secrets`                     | Quét credential trong file đang track    |
| `pnpm release:check`                        | Kiểm tra runtime và OpenAPI nối frontend |
| `pnpm ignored-builds`                       | Kiểm tra package build script bị chặn    |
| `pnpm db:status`                            | Kiểm tra migration database hiện tại     |
| `pnpm retention:run -- --confirm-retention` | Chạy retention có xác nhận               |

## Tài liệu kiến trúc và bảo mật

- [Integration-core design spec](./docs/design/specs/2026-08-30-integration-core-design.md)
- [Identity-access design spec](./docs/design/specs/2026-09-02-identity-access-design.md)
- [Station-data design và hợp đồng F-data, mục 16](./docs/design/specs/2026-09-02-station-data-design.md)
- [Alert/notification design](./docs/design/specs/2026-09-02-alert-config-design.md)
- [Backend capability map](./CAPABILITY-MAP.md)
- [Threat model](./docs/security/integration-core-threat-model.md)
- [Backend completion roadmap — lịch sử](./docs/roadmaps/2026-09-02-backend-completion-roadmap.md)
- [Delivery, recovery and frontend release gate](./docs/operations/DELIVERY-RECOVERY.md)
- [Local runbook](./docs/operations/LOCAL-RUNBOOK.md)
