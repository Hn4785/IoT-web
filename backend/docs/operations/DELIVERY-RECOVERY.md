# Triển khai và khôi phục AgriSense

Phiên bản: 3.0.0. Cập nhật: 12/10/2026.

Tài liệu để bên nhận tái tạo hệ thống từ source/image đã được giao. Pi nội bộ là
môi trường demo, không phải điều kiện chứng nhận production. Một bộ dữ liệu chính
được sử dụng tại một thời điểm; không có đồng bộ hai chiều giữa các máy.

Các lệnh triển khai dưới đây dùng Bash. Không chạy chúng trong đợt sửa tài liệu
hoặc chạy thử trên database đang hoạt động mà chưa có kế hoạch/backup được duyệt.

## 1. Cách chạy và điều kiện

Local development dùng [QUICKSTART.md](../project/QUICKSTART.md).
Website dùng `deploy/compose.yaml` với PostgreSQL, API runtime, API tools và web.

Docker tối thiểu 25, Compose tối thiểu 2.24. Script host cần Node.js
`>=24.17.0 <25`, pnpm `11.19.0`. Preflight kiểm tra ít nhất 2 GiB trống;
đây không phải cam kết đủ dung lượng giữ lịch sử 90 ngày.

Image phải đúng CPU target amd64/arm64 và revision được giao, dùng digest bất biến.
Không chuyển fixture, database test, seed hay artifact của máy phát triển vào runtime.

## 2. Build image

Tại thư mục `backend/` của source tích hợp, cài bằng lockfile và kiểm tra trước:

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm security:secrets
docker build --target runtime -t iot-api:local .
docker build --target tools -t iot-api-tools:local .
```

Tag local chỉ là ví dụ build trên CPU của máy hiện tại. Khi triển khai, sử dụng
digest đã được kiểm tra từ bộ release/registry, không coi tag này là image cho mọi CPU.

Runtime chạy bằng user `node`, chứa output build và production dependencies;
không chứa source/test, công cụ migration hay fixture. Tools image có source,
Prisma/tsx và script vận hành để chạy migration/bootstrap/recovery.
Web image được build với context `frontend/` cùng repository; xem
[hướng dẫn frontend](../../../frontend/docs/DEPLOYMENT-NGINX.md).

Không đặt file cấu hình production hoặc backup trong source/build context.
Dockerfile có COPY chọn lọc vẫn không phải lý do để gửi secret vào build context.

## 3. Chuẩn bị cấu hình ngoài source

Người quản trị máy chuẩn bị thư mục được bảo vệ, ví dụ `/secure/iot`.
Từ thư mục backend:

```bash
cp deploy/.env.example /secure/iot/server.env
chmod 600 /secure/iot/server.env
```

Thay toàn bộ placeholder. Danh mục đầy đủ ở
[ENV-REFERENCE.md](../project/ENV-REFERENCE.md).

| Mục       | Yêu cầu                                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| Image     | `API_IMAGE`, `API_TOOLS_IMAGE`, `WEB_IMAGE` là `registry/name@sha256:...`, đúng CPU |
| Database  | Host container `postgres`, DB/user/password nhất quán; main/test target tách biệt   |
| Website   | Origin HTTPS thật của bên nhận, không phải port/container nội bộ                    |
| Secret    | JWT và pepper khác nhau, khóa nguồn đúng 32 byte base64; lưu/trao riêng             |
| Collector | Interval/lease hợp lệ; giới hạn raw theo capacity đã đánh giá                       |
| Demo      | `ALERT_DEMO_METADATA_ENABLED=false`; không chạy seed                                |

Không dùng mẫu HTTP/`latest` chưa thay của template để tuyên bố đã đủ cấu hình
server. Ứng dụng không phụ thuộc một link tunnel demo cụ thể.

## 4. Release manifest và preflight

Manifest ghi revision và toàn bộ migration của source. Ví dụ dưới đây tương ứng
baseline `a90bb5e` và máy chưa có dữ liệu; thay revision theo bản thực sự được giao:

```json
{
  "schemaVersion": 1,
  "releaseRevision": "a90bb5ea135e1ba3269c7bf053f0915ee6416293",
  "migrationIds": [
    "20260902075712_identity_foundation",
    "20260914135003_alert_config_foundation",
    "20260914135500_alert_config_constraints",
    "20260914140000_alert_config_constraint_hardening",
    "20260923190000_notification_delivery_job",
    "20260925090000_notification_recipient_snapshot",
    "20260928143000_data_source_registry",
    "20260928143500_system_source_default",
    "20260929090000_source_hierarchy_names",
    "20260929100000_station_scoped_source_grants",
    "20260929110000_recoverable_source_removal",
    "20261005043000_durable_soil_readings",
    "20261005135000_soil_fetch_generation"
  ],
  "existingData": false
}
```

Lưu manifest đã chuẩn bị ở `/secure/iot/release.json`. Nếu đã có dữ liệu, đặt
`existingData: true`, khai báo `databaseMigrations` thực tế đúng tiền tố của release,
và `backupVerified: true` chỉ khi backup đã được diễn tập restore thành công.

```bash
node scripts/operations/deployment-preflight.mjs --profile server --manifest /secure/iot/release.json --env-file /secure/iot/server.env
```

Preflight thành công xác nhận cú pháp/cấu hình và bằng chứng được khai báo;
không tự kiểm chứng nội dung image, restore thật hoặc nghiệm thu hệ thống.
Profile `pi` cho phép HTTP loopback trong cấu hình; đăng nhập production từ xa
vẫn cần HTTPS do Secure cookie.

## 5. Cài đặt mới

Giữ tên project `iot` cố định. Tên này quyết định network và named volume.
Với hệ thống đang hoạt động, giữ project cũ thay vì tạo project/volume mới.

```bash
docker compose -p iot --env-file /secure/iot/server.env -f deploy/compose.yaml up -d --wait postgres
docker compose -p iot --env-file /secure/iot/server.env -f deploy/compose.yaml --profile maintenance run --rm migration
```

Chỉ tiếp tục khi PostgreSQL healthy và migration kết thúc mã 0.
Bootstrap chỉ khi database chưa có user/authority:

```bash
TOOLS_IMAGE='registry/name@sha256:DIGEST_TOOLS_DA_DUOC_GIAO'
docker run --rm -it --network iot_private --env-file /secure/iot/server.env "$TOOLS_IMAGE" pnpm db:bootstrap-super-admin -- --email admin@example.com
```

Thay digest/email trước khi chạy. Mật khẩu nhập hai lần bằng prompt ẩn,
không đặt trong file cấu hình hoặc command line.

```bash
docker compose -p iot --env-file /secure/iot/server.env -f deploy/compose.yaml --profile maintenance up -d --wait api web
docker compose -p iot --env-file /secure/iot/server.env -f deploy/compose.yaml ps
```

Web bind loopback `127.0.0.1:8080` theo mặc định. Bên nhận cấu hình reverse proxy
HTTPS tới đó. Web chuyển `/api/v1` vào API; sử dụng cùng origin cho browser session.
PostgreSQL và API không được mở trực tiếp ra Internet.

## 6. Kiểm tra sau khởi động

```bash
curl --fail http://127.0.0.1:8080/healthz
curl --fail http://127.0.0.1:8080/api/v1/health
curl --fail http://127.0.0.1:8080/api/v1/readiness
docker compose -p iot --env-file /secure/iot/server.env -f deploy/compose.yaml logs --tail 100 api web
```

Health/readiness không xác nhận provider có số đo mới. Production không có
`/docs` và `/docs-json`. Nếu dùng release checker qua web:

```bash
RELEASE_BASE_URL=http://127.0.0.1:8080 pnpm release:check -- --skip-openapi
```

Tiếp theo kiểm tra đăng nhập/refresh/logout từ đúng HTTPS origin, đổi mật khẩu,
nguồn thật, chia sẻ đúng station, các vai trò được phép/bị từ chối, latest/history,
stored/empty/partial và cảnh báo. Không tự tạo cảnh báo thật để thay bằng chứng
provider phục hồi; nội dung đó vẫn là mục nghiệm thu riêng.

## 7. Backup

RPO 24 giờ, RTO 4 giờ, giữ 7 bản ngày/4 bản tuần là mục tiêu đã thống nhất.
Chưa có chứng nhận lịch backup ngoài máy hoặc thời gian restore trên target bên nhận.
Chốt nơi lưu, người giữ khóa, người thực hiện và cách xác nhận trước vận hành chính thức.

Ví dụ dump PostgreSQL ra file, không redirect nhị phân qua PowerShell.
Chọn tên file mới mỗi lần; các lệnh dùng Bash và dừng khi có lỗi:

```bash
set -e
mkdir -p /secure/iot/backups
chmod 700 /secure/iot/backups
test ! -e /secure/iot/backups/handover.dump
docker compose -p iot --env-file /secure/iot/server.env -f deploy/compose.yaml exec -T postgres sh -ec 'test ! -e /tmp/handover.dump; umask 077; pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/handover.dump'
docker compose -p iot --env-file /secure/iot/server.env -f deploy/compose.yaml cp postgres:/tmp/handover.dump /secure/iot/backups/handover.dump
chmod 600 /secure/iot/backups/handover.dump
```

Không đưa dump vào Git. Bảo vệ cả file tạm trong container; sau khi kiểm tra bản
sao an toàn, người quản trị xử lý đúng file tạm vừa tạo theo quy trình bảo trì.

## 8. Mã hoá backup và restore cô lập

Envelope dùng AES-256-GCM, xác thực manifest/hash và từ chối output đã tồn tại.
Tạo khóa một lần ở nơi bảo vệ, không tạo đè hoặc đổi khóa đang dùng:

```bash
node scripts/operations/backup-envelope.mjs keygen --key-file /secure/iot/backup.key
```

Backup manifest khác release manifest. Nó chỉ chứa revision, danh sách migration
và tùy chọn tên secret cần phục hồi, không chứa giá trị secret. Ví dụ:

```json
{
  "releaseRevision": "a90bb5ea135e1ba3269c7bf053f0915ee6416293",
  "migrationIds": [
    "20260902075712_identity_foundation",
    "20260914135003_alert_config_foundation",
    "20260914135500_alert_config_constraints",
    "20260914140000_alert_config_constraint_hardening",
    "20260923190000_notification_delivery_job",
    "20260925090000_notification_recipient_snapshot",
    "20260928143000_data_source_registry",
    "20260928143500_system_source_default",
    "20260929090000_source_hierarchy_names",
    "20260929100000_station_scoped_source_grants",
    "20260929110000_recoverable_source_removal",
    "20261005043000_durable_soil_readings",
    "20261005135000_soil_fetch_generation"
  ],
  "secretNames": ["JWT_SECRET", "CREDENTIAL_PEPPER", "DATA_SOURCE_ENCRYPTION_KEY"]
}
```

Đối chiếu revision và toàn bộ migration của database thực tế được dump; danh sách
minh hoạ trên khớp baseline hiện tại, không thay việc đối chiếu. Lưu ở
`/secure/iot/backup-manifest.json`.

```bash
node scripts/operations/backup-envelope.mjs encrypt --input /secure/iot/backups/handover.dump --output /secure/iot/backups/handover.iotbkp --key-file /secure/iot/backup.key --manifest /secure/iot/backup-manifest.json
node scripts/operations/backup-envelope.mjs decrypt --input /secure/iot/backups/handover.iotbkp --output /secure/iot/backups/isolated.dump --key-file /secure/iot/backup.key
```

Chuyển khóa và secret ứng dụng qua kênh bảo vệ riêng với backup. Nếu xác thực
envelope/hash lỗi, dừng; không bỏ kiểm tra hoặc dùng output lỗi.

Restore chỉ vào database mới chưa tồn tại. Chọn tên target chưa dùng;
`set -e` và `sh -ec` bảo đảm createdb lỗi thì không chạy pg_restore:

```bash
set -e
docker compose -p iot --env-file /secure/iot/server.env -f deploy/compose.yaml cp /secure/iot/backups/isolated.dump postgres:/tmp/isolated.dump
docker compose -p iot --env-file /secure/iot/server.env -f deploy/compose.yaml exec -T postgres sh -ec 'createdb -U "$POSTGRES_USER" iot_restore_handover; pg_restore -U "$POSTGRES_USER" -d iot_restore_handover --exit-on-error /tmp/isolated.dump'
```

Kiểm tra migration, tài khoản/authority, grant, giải mã nguồn, số đo/snapshot,
coverage, alert/lifecycle/notification và audit trên database restore trước cutover.
Giữ cấu hình/secret phù hợp; snapshot không cấp quyền cho user bị thu hồi.
Không để bản diễn tập tự chạy collector vào dữ liệu nguồn trong khi chưa được duyệt.

Windows có script diễn tập target mới trong
[LOCAL-RUNBOOK.md](LOCAL-RUNBOOK.md). Script xác nhận migration tồn tại, không
thay các kiểm tra nghiệp vụ hoặc đo RPO/RTO.

## 9. Cập nhật, rollback và chuyển máy

Trước cập nhật: backup có thể restore, giữ digest cũ, so migration/cấu hình và chạy
preflight. Áp migration rồi khởi động như mục 5, bỏ qua bootstrap khi đã có tài khoản.

Rollback ứng dụng chỉ khi image cũ tương thích schema hiện tại. File
`/secure/iot/previous-release.env` giữ nguyên database/project/secret, đổi image
theo release được duyệt:

```bash
docker compose -p iot --env-file /secure/iot/previous-release.env -f deploy/compose.yaml up -d --no-deps --wait api web
```

Không đảo migration hoặc restore đè database đang chạy. Khi chuyển máy, backup/
restore vào target cô lập, kiểm chứng rồi mới cutover; chỉ một bộ dữ liệu chính.
Không có cơ chế tự gộp hai database đã chạy song song.

Khôi phục Super Admin dùng invocation tools ở mục 5 với lệnh
`pnpm db:recover-super-admin -- --email holder@example.com`. Không tự đổi key/pepper
hoặc sửa hash/authority bằng SQL.

## 10. Tồn đọng và điều kiện tiếp nhận

Lỗi raw history rỗng chặn backfill vẫn mở; lưu raw 90 ngày không chứng minh đã
thu đủ 90 ngày. Notification mới sau phục hồi nguồn thật cần bằng chứng riêng.

Bên nhận còn chốt HTTPS/proxy, capacity, nhiều instance/rate limit nếu có,
backup ngoài máy/key custody, staging và người giao/nhận/ngoại lệ.
Xem [CAPABILITY-MAP.md](../../CAPABILITY-MAP.md) và
[threat model](../security/integration-core-threat-model.md).

Không dùng `down -v`, reset schema, seed hoặc thử lỗi trên dữ liệu thật để chữa
sự cố theo phỏng đoán. Cấu hình vận hành chưa được chốt không làm thay đổi kết
quả logic local, cũng không có nghĩa production đã được nghiệm thu.
