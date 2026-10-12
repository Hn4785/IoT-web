# Tham chiếu cấu hình backend

Phiên bản: 3.0.0. Cập nhật: 12/10/2026.

Nguồn kiểm tra cấu hình: `src/config/runtime-config.ts`.
`.env.example` có 28 biến: 24 biến của ứng dụng và bốn biến phục vụ PostgreSQL
local. Runtime thực tế nhận 32 biến ứng dụng; tám biến collector còn lại dùng
mặc định nếu chưa khai báo. Các bảng dưới đây mô tả đủ runtime, Compose và lệnh
vận hành, không giới hạn danh mục theo số dòng của mẫu cấu hình.

## 1. Cách đọc

"Bắt buộc" nghĩa là parser runtime không cung cấp mặc định. Giá trị trong mẫu
không tự trở thành giá trị mặc định của code. Nếu thiếu hoặc sai kiểu, ứng dụng
dừng khi khởi động thay vì chạy với cấu hình đoán.

Các biến runtime được đọc khi app khởi động. Sau khi đổi cấu hình, khởi động lại
backend; không sửa database để thay giá trị môi trường.

## 2. Tiến trình, nguồn hệ thống và database

| Biến                     | Yêu cầu / mặc định                  | Kiểm tra và mục đích                                                                 |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------ |
| `NODE_ENV`               | Bắt buộc                            | `development`, `test` hoặc `production`; production tắt Swagger và bật Secure cookie |
| `PORT`                   | Bắt buộc; mẫu `3000`                | Số nguyên 1–65535; deploy Compose cố định `3000` trong container                     |
| `LOG_LEVEL`              | Bắt buộc; mẫu `info`                | `fatal`, `error`, `warn`, `info`, `debug`, `trace`                                   |
| `WEATHER_API_BASE_URL`   | Bắt buộc                            | URL API nguồn SYSTEM; production phải HTTPS; có thể chứa đường dẫn API               |
| `WEATHER_API_KEY`        | Bắt buộc, không rỗng                | Credential nguồn SYSTEM; không đưa vào browser hoặc Git                              |
| `WEATHER_API_TIMEOUT_MS` | Bắt buộc; mẫu `5000`                | Số nguyên 100–30000 ms; timeout cho mỗi gọi nguồn                                    |
| `DATABASE_URL`           | Bắt buộc                            | URL `postgres:` hoặc `postgresql:` của database nghiệp vụ                            |
| `TEST_DATABASE_URL`      | Bắt buộc cả khi cấu hình production | Database test riêng; host/database/schema target phải khác `DATABASE_URL`            |

Local dùng host `localhost:5432`; container ứng dụng trong deploy dùng
`postgres:5432`. Không dùng `localhost` của container API để trỏ tới container
PostgreSQL khác. Mật khẩu có ký tự đặc biệt cần URL-encode trong connection URL.

## 3. Session và bảo vệ khóa nguồn

| Biến                          | Yêu cầu / mặc định                    | Kiểm tra và mục đích                                                                           |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `FRONTEND_ORIGIN`             | Bắt buộc; mẫu `http://localhost:5173` | Chỉ scheme/host/port HTTP(S), không credentials/path/query/hash; parser chuẩn hoá thành origin |
| `JWT_SECRET`                  | Bắt buộc                              | Chuỗi ngẫu nhiên 32–4096 ký tự để ký access JWT                                                |
| `CREDENTIAL_PEPPER`           | Bắt buộc                              | Chuỗi ngẫu nhiên 32–4096 ký tự, khác JWT secret; HMAC credential                               |
| `DATA_SOURCE_ENCRYPTION_KEY`  | Bắt buộc                              | Base64 giải mã thành đúng 32 byte, dùng mã hoá credential của nguồn MANAGED                    |
| `DATA_SOURCE_ALLOWED_ORIGINS` | Bắt buộc                              | 1–100 HTTPS origin, phân cách dấu phẩy; không credentials/path/query/hash                      |

CORS cho phép credentials từ đúng `FRONTEND_ORIGIN`. Refresh/logout còn kiểm tra
`Origin` của request. Origin phải là địa chỉ người dùng mở frontend, không phải
địa chỉ bind nội bộ của container. Khác giao thức, hostname hoặc port là khác origin.

Development thông thường dùng `http://localhost:5173`. Website dùng origin HTTPS
của bên nhận. Link tunnel dùng cho demo không phải phụ thuộc bắt buộc của sản phẩm.
Nếu đổi domain, sửa cấu hình origin và khởi động lại API; không chuyển sang wildcard
hoặc tắt Secure cookie để né lỗi đăng nhập.

Khóa mã hoá do preflight deployment kiểm tra ở dạng base64 chuẩn 44 ký tự kết
thúc `=`. Tạo từng secret riêng trên máy được phép quản lý khóa:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Không dán kết quả vào báo cáo, issue, source hoặc chat. Duy trì cùng khóa mã hoá
khi restore dữ liệu nguồn. Đổi khóa mà không có kế hoạch migration ciphertext làm
credential cũ không đọc được. Đổi pepper ảnh hưởng việc xác thực credential đã hash;
không thay nó như một thao tác restart thông thường.

## 4. Cache và dữ liệu cũ

| Biến                        | Yêu cầu / giá trị mẫu | Giới hạn                                           |
| --------------------------- | --------------------- | -------------------------------------------------- |
| `SOIL_LATEST_CACHE_TTL_MS`  | Bắt buộc; `30000`     | 1–3600000 ms                                       |
| `SOIL_HISTORY_CACHE_TTL_MS` | Bắt buộc; `300000`    | 1–3600000 ms                                       |
| `SOIL_STALE_AFTER_MS`       | Bắt buộc; `900000`    | 1–3600000 ms; ngưỡng tuổi số đo                    |
| `SOIL_STALE_IF_ERROR_MS`    | Bắt buộc; `300000`    | 1–3600000 ms; cửa sổ fallback cache bộ nhớ khi lỗi |
| `SOIL_CACHE_MAX_ENTRIES`    | Bắt buộc; `500`       | 1–10000 entry                                      |

Cache bộ nhớ và snapshot PostgreSQL khác nhau. Snapshot bền vững có thể đọc sau
restart theo quyền hiện tại; không được gọi là số đo mới chỉ vì vừa đọc database.
Thời hạn giữ raw 90 ngày là quy tắc lưu trữ trong code, không do TTL cache quyết định.

## 5. Collector

Tất cả biến trong bảng này có mặc định trong code:

| Biến                          | Mặc định   | Giới hạn / điều kiện                                 |
| ----------------------------- | ---------- | ---------------------------------------------------- |
| `SOIL_COLLECTION_ENABLED`     | `true`     | Chuỗi chính xác `true` hoặc `false`                  |
| `SOIL_COLLECTION_INTERVAL_MS` | `120000`   | 120000–3600000 ms                                    |
| `SOIL_COLLECTION_CONCURRENCY` | `2`        | Số nguyên 1–2                                        |
| `SOIL_COLLECTION_BATCH_SIZE`  | `20`       | Số nguyên 1–20 trạm mỗi lượt                         |
| `SOIL_COLLECTION_PAGE_LIMIT`  | `10`       | Số nguyên 1–10 trang mỗi window/trạm                 |
| `SOIL_COLLECTION_LEASE_MS`    | `115000`   | 1000–3599999 ms và phải nhỏ hơn interval             |
| `SOIL_RAW_STATION_LIMIT`      | `2000000`  | Số nguyên 1–2000000 raw field reading/trạm           |
| `SOIL_RAW_GLOBAL_LIMIT`       | `10000000` | Số nguyên 1–10000000 raw field reading toàn hệ thống |

Một field reading là một giá trị của một trường tại một thời điểm, không phải một
response gồm nhiều trường. Giới hạn là hàng rào bảo vệ, không phải kết quả đo năng
lực máy. Không tăng vượt schema cấu hình hoặc xoá dữ liệu đang trong hạn để né trần.
Khi đầy, phải xử lý capacity có kế hoạch.

Có thể tắt collector trên một instance đọc hoặc khi diễn tập restore. Không để
hai bản ứng dụng cùng ghi vào hai bản dữ liệu "chính" rồi kỳ vọng tự đồng bộ.

## 6. Cảnh báo

| Biến                                | Yêu cầu / mặc định | Giới hạn / mục đích                             |
| ----------------------------------- | ------------------ | ----------------------------------------------- |
| `ALERT_EVALUATION_INTERVAL_MS`      | `60000`            | 10000–3600000 ms                                |
| `ALERT_EVALUATION_BATCH_SIZE`       | `50`               | Số nguyên 1–500                                 |
| `ALERT_EVALUATOR_LEASE_MS`          | `55000`            | 1000–3599999 ms, nhỏ hơn interval               |
| `ALERT_IDEMPOTENCY_RETENTION_HOURS` | `168`              | Số nguyên 1–720 giờ                             |
| `ALERT_DEMO_METADATA_ENABLED`       | `false`            | `true`/`false`; production từ chối `true`       |
| `ALERT_DEMO_STATION_CODES`          | Danh sách rỗng     | Tối đa 100 mã, mỗi mã 1–80 ký tự chữ/số/`_`/`-` |

Metadata demo không phải bằng chứng provider. Vận hành nguồn thật để demo metadata
ở `false`. Backend không suy ra unit/sensor/depth chưa được xác nhận.

## 7. Biến của Compose

| Biến                | Nơi dùng                | Ý nghĩa                                                                          |
| ------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `POSTGRES_DATA_DIR` | Root `compose.yaml`     | Thư mục bind mount local; tách khỏi source, không dùng trong deploy named volume |
| `POSTGRES_DB`       | Local/deploy PostgreSQL | Tên database nghiệp vụ; cần nhất quán với `DATABASE_URL`                         |
| `POSTGRES_USER`     | Local/deploy PostgreSQL | User database                                                                    |
| `POSTGRES_PASSWORD` | Local/deploy PostgreSQL | Mật khẩu; thống nhất với phần credential của URL                                 |
| `COMPOSE_PROFILES`  | Mẫu deploy              | `maintenance` bật service migration; có thể bật bằng `--profile maintenance`     |
| `API_IMAGE`         | `deploy/compose.yaml`   | Image runtime API theo digest được giao                                          |
| `API_TOOLS_IMAGE`   | `deploy/compose.yaml`   | Image tools/migration cùng revision API                                          |
| `WEB_IMAGE`         | `deploy/compose.yaml`   | Image frontend đã được giao, đúng CPU                                            |
| `WEB_PORT`          | `deploy/compose.yaml`   | Port web loopback; mặc định `8080`                                               |

Các image trong mẫu deploy dùng placeholder/tag. Bên nhận phải thay bằng
`registry/name@sha256:...` đã được kiểm chứng; preflight không chấp nhận dùng
`latest` để chứng minh một release cố định.

Cấu hình production nằm ở đường dẫn được bảo vệ ngoài source/build context, ví dụ
`/secure/iot/server.env`. Quyền file trên Linux là `600`; phân phối secret qua kênh
riêng. Không lưu thành `server.env` ngay trong repository.

## 8. Biến chỉ dùng bởi lệnh kiểm tra

`scripts/verify-release.mjs` nhận `RELEASE_BASE_URL`, mặc định
`http://127.0.0.1:3000`, và `RELEASE_CHECK_TIMEOUT_MS`, mặc định `5000` ms.
Đây không phải biến cấu hình runtime NestJS.

```powershell
$env:RELEASE_BASE_URL = 'http://127.0.0.1:8080'
pnpm release:check -- --skip-openapi
```

Lệnh kiểm tra production bỏ OpenAPI vì hai route tài liệu bị tắt. Nó không chứng
nhận nguồn API đang có dữ liệu mới hoặc backup có thể restore.

Bootstrap/recovery dùng argument `--email` và prompt mật khẩu ẩn; không có bộ biến
`BOOTSTRAP_*` hay `RECOVERY_PASSWORD` để truyền mật khẩu.

## 9. Kiểm tra trước khi chạy

1. Database chính và test tách biệt; credential URL khớp PostgreSQL.
2. JWT/pepper khác nhau; khóa mã hoá đúng định dạng và được giữ riêng.
3. Frontend origin đúng địa chỉ trình duyệt; nguồn MANAGED nằm trong allowlist.
4. Lease nhỏ hơn interval; mọi giới hạn số và boolean đúng schema.
5. Production dùng HTTPS, tắt metadata demo và không mở Swagger.
6. Chưa chạy seed, restore hoặc test tích hợp trên database dữ liệu thật.

Xem [QUICKSTART.md](QUICKSTART.md) cho máy mới,
[LOCAL-RUNBOOK.md](../operations/LOCAL-RUNBOOK.md) cho bảo trì local và
[DELIVERY-RECOVERY.md](../operations/DELIVERY-RECOVERY.md) cho triển khai.
