# Cài đặt và khôi phục AgriSense

Cập nhật: 08/10/2026. Tài liệu giúp bên nhận tái tạo ứng dụng trên server hoặc Pi.
Chỉ một máy giữ dữ liệu chính tại một thời điểm; không có đồng bộ hai chiều.
Pi nội bộ là môi trường demo, không phải yêu cầu nghiệm thu.
Phạm vi, phiên bản, kết quả kiểm thử và tồn đọng được tổng hợp trong
tài liệu bàn giao gửi riêng (không lưu trong Git).

## 1. Chọn cách chạy

- Phát triển/kiểm tra Windows: dùng [LOCAL-RUNBOOK.md](LOCAL-RUNBOOK.md) và README frontend.
- Website: dùng Compose, ba image bất biến đúng CPU amd64/arm64, database riêng và HTTPS do bên nhận cấu hình.
- Pi dùng cùng Compose và image ARM64. Không sao chép fixture, seed hoặc database thử sang máy chạy thật.

Lệnh dưới đây dùng Bash tại thư mục backend nhánh `BE`, project Compose `iot`.
Giữ nguyên project, database và volume khi cập nhật. Chỉ tiếp tục sau mỗi lệnh
thành công; nếu lỗi thì dừng và xem log, không thử bootstrap/migration/restore
trên dữ liệu thật để sửa theo phỏng đoán.

## 2. Chuẩn bị cấu hình

Yêu cầu Docker từ 25, Compose từ 2.24; Node.js `>=24.17.0 <25`, pnpm `11.19.0`
cho script kiểm tra host. Chạy `pnpm install --frozen-lockfile`. Preflight kiểm
tra tối thiểu 2 GiB trống, không phải cam kết đủ dung lượng lưu 90 ngày.

```bash
cp deploy/.env.example server.env
chmod 600 server.env
```

Mở `server.env`, thay toàn bộ placeholder, không commit file này:

| Nhóm     | Cấu hình cần chuẩn bị                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| Image    | `API_IMAGE`, `API_TOOLS_IMAGE`, `WEB_IMAGE` dạng `registry/name@sha256:...`; đúng CPU, không dùng `latest` trong mẫu |
| Database | PostgreSQL user/password/db và hai URL trỏ database chính/test tách biệt; hostname container `postgres`              |
| Website  | `NODE_ENV=production`, `PORT=3000`, origin HTTPS của bên nhận, `WEB_PORT=8080` mặc định                              |
| Secret   | JWT và pepper khác nhau, đủ ngẫu nhiên, ít nhất 32 ký tự; khóa mã hóa nguồn đúng 32 byte base64                      |
| Nguồn    | Allowed origins HTTPS không có path; Weather API theo template; không gửi key ra frontend                            |
| Thu thập | 120 giây, tối đa 2 trạm đồng thời; raw tối đa 2 triệu/trạm, 10 triệu tổng nếu chưa đo năng lực máy                   |
| Demo     | `ALERT_DEMO_METADATA_ENABLED=false`; không chạy seed demo                                                            |

`TEST_DATABASE_URL` vẫn cần để kiểm tra cấu hình, không phải database nghiệp vụ.
Giữ khóa giải mã nguồn riêng: mất khóa thì credential đã mã hóa không đọc được.

Chuẩn bị `release.json`: `schemaVersion: 1`, commit BE ở `releaseRevision`,
`migrationIds` có thứ tự từ `prisma/migrations`, `existingData` là boolean.
Nếu có dữ liệu, cần `databaseMigrations` thực tế là tiền tố đúng của release và
`backupVerified: true` chỉ sau diễn tập thành công, không khai báo để vượt gate.

```bash
node scripts/operations/deployment-preflight.mjs --profile server --manifest release.json --env-file server.env
```

Mã thoát 0/`valid: true` chỉ xác nhận cấu hình/cú pháp; chưa chứng minh restore,
image hay nghiệm thu server. Profile `pi` cho phép HTTP loopback; production
đăng nhập từ xa vẫn cần HTTPS vì Secure cookie.

## 3. Cài đặt lần đầu

```bash
docker compose -p iot --env-file server.env -f deploy/compose.yaml up -d --wait postgres
docker compose -p iot --env-file server.env -f deploy/compose.yaml --profile maintenance run --rm migration
```

PostgreSQL phải healthy; migration phải kết thúc 0. Nếu database chưa có người
dùng/authority, tạo Super Admin. Gán biến tools bằng đúng digest được cấp:

```bash
TOOLS_IMAGE='registry/name@sha256:DIGEST_DA_DUOC_CAP'
docker run --rm -it --network iot_private --env-file server.env "$TOOLS_IMAGE" pnpm db:bootstrap-super-admin -- --email admin@example.com
docker compose -p iot --env-file server.env -f deploy/compose.yaml --profile maintenance up -d --wait api web
docker compose -p iot --env-file server.env -f deploy/compose.yaml ps
```

Thay email bằng người giữ quyền thực tế; mật khẩu nhập hai lần qua prompt ẩn.
Cài đặt đã có tài khoản bỏ qua bootstrap. Tools image có source/Prisma/tsx;
runtime chỉ có mã đã build và dependency chạy thật, không có test/fixture.

Web chỉ bind `127.0.0.1:8080`. Bên nhận cấu hình reverse proxy HTTPS tới đây.
Nginx trong web image chuyển `/api/v1` vào API; dùng cùng origin cho session/cookie.
Không mở PostgreSQL/API trực tiếp ra Internet.

## 4. Kiểm tra và sử dụng

```bash
curl --fail http://127.0.0.1:8080/healthz
curl --fail http://127.0.0.1:8080/api/v1/health
curl --fail http://127.0.0.1:8080/api/v1/readiness
docker compose -p iot --env-file server.env -f deploy/compose.yaml logs --tail 100 api web
```

Liveness không kiểm tra dependency; readiness chỉ ready khi PostgreSQL đáp ứng.
Hai endpoint không xác nhận provider đang online. Đăng nhập bằng domain HTTPS,
thêm nguồn thật tại API Sources, chia sẻ station rồi kiểm tra đúng vai trò.
Production không mở Swagger; contract đọc ở môi trường dev/test.

Provider nghỉ: đọc bản đã lưu nếu có và còn quyền, giữ timestamp/nguồn và nhãn
cũ/thiếu. Không có bản lưu thì trả empty/lỗi, không dựng số mẫu. Cửa sổ history
cũ rỗng chặn backfill vẫn là lỗi P2 trong [sổ lỗi](../reviews/2026-09-04-backend-follow-up.md#chưa-sửa).
Lưu tối đa 90 ngày không chứng minh đã backfill đủ 90 ngày.

## 5. Sao lưu và khôi phục riêng

Chưa có lịch backup ngoài máy được nghiệm thu. RPO 24 giờ, RTO 4 giờ, giữ 7 bản
ngày/4 bản tuần là mục tiêu, không phải kết quả đo. Dùng tên artifact mới mỗi lần,
thư mục được bảo vệ; không redirect dump nhị phân qua PowerShell:

```bash
set -e
mkdir -p backups
chmod 700 backups
test ! -e backups/handover.dump
docker compose -p iot --env-file server.env -f deploy/compose.yaml exec -T postgres sh -ec 'test ! -e /tmp/handover.dump; umask 077; pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/handover.dump'
docker compose -p iot --env-file server.env -f deploy/compose.yaml cp postgres:/tmp/handover.dump backups/handover.dump
chmod 600 backups/handover.dump
```

Envelope AES-256-GCM xác thực và từ chối output đã tồn tại. Tạo thư mục `/secure`
với quyền hạn chế trước; tạo khóa một lần, không tạo lại khóa đang sử dụng:

```bash
node scripts/operations/backup-envelope.mjs keygen --key-file /secure/backup.key
node scripts/operations/backup-envelope.mjs encrypt --input backups/handover.dump --output backups/handover.iotbkp --key-file /secure/backup.key --manifest backup-manifest.json
node scripts/operations/backup-envelope.mjs decrypt --input backups/handover.iotbkp --output backups/isolated.dump --key-file /secure/backup.key
```

Backup manifest KHÁC release manifest: chỉ `releaseRevision`, `migrationIds`,
tùy chọn `secretNames` (tên, không phải giá trị). Chuyển khóa và secret ứng dụng
qua kênh bảo vệ riêng; nếu xác thực/hash lỗi thì dừng, không dùng dump.

Restore chỉ vào database mới chưa tồn tại. Không chạy `pg_restore` nếu `createdb`
thất bại. Ví dụ không đụng database đang chạy:

```bash
set -e
docker compose -p iot --env-file server.env -f deploy/compose.yaml cp backups/isolated.dump postgres:/tmp/isolated.dump
docker compose -p iot --env-file server.env -f deploy/compose.yaml exec -T postgres sh -ec 'createdb -U "$POSTGRES_USER" iot_restore_handover; pg_restore -U "$POSTGRES_USER" -d iot_restore_handover --exit-on-error /tmp/isolated.dump'
```

Kiểm tra migration, quyền, giải mã nguồn, latest/history và lifecycle trên bản
restore trước cutover; chỉ một collector chạy trên dữ liệu chính sau chuyển máy.
Không restore đè máy nguồn. Windows có [script diễn tập bảo vệ database](../../scripts/operations/backup-restore-rehearsal.ps1).

## 6. Cập nhật và phục hồi

Backup có thể restore; giữ digest cũ, đối chiếu schema/cấu hình và chạy preflight.
Áp dụng migration rồi khởi động như mục 3, không bootstrap lại. Rollback ứng dụng
chỉ khi image cũ tương thích schema hiện tại. `previous-release.env` giữ nguyên
database/project/secret, chỉ chọn image đã được duyệt:

```bash
docker compose -p iot --env-file previous-release.env -f deploy/compose.yaml up -d --no-deps --wait api web
```

Không đảo migration hay restore vào database đang chạy. Người quản trị máy
khôi phục Super Admin bằng tools invocation ở mục 3, thay lệnh thành
`pnpm db:recover-super-admin -- --email ...`. Lệnh đổi mật khẩu đúng người giữ
quyền, mở khóa, thu hồi phiên và ghi audit; không truyền mật khẩu bằng tham số.
Không tự đổi key/pepper nếu chưa đánh giá ciphertext/phiên; không có tự xoay khóa
nguồn trong phạm vi này.

## 7. Xử lý lỗi

| Tình huống                         | Hành động                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Database không ready               | Xem ps/log PostgreSQL, URL và migration; không reset/xóa volume               |
| Cookie đăng nhập từ xa lỗi         | Kiểm tra HTTPS/origin; không tắt Secure cookie                                |
| Provider nghỉ                      | Xem API Sources và timestamp; giữ bản lưu có quyền, không seed                |
| Đạt giới hạn số đo                 | Xem collection health, dừng thu mới theo giới hạn; đo năng lực trước khi tăng |
| Secret nguồn không đọc sau restore | Kiểm tra đúng khóa bằng kênh bảo vệ; không in key/ciphertext                  |

Không dùng `down -v`, reset schema, seed hay thử lỗi trên dữ liệu thật. Domain,
TLS/proxy, backup ngoài máy, người giữ khóa và capacity do bên nhận xác nhận.
Chúng chưa được điền không thay đổi kết quả logic local, cũng không có nghĩa
production đã được nghiệm thu.
