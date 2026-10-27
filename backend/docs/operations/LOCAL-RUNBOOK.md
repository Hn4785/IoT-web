# Vận hành backend trên máy local

Phiên bản: 3.0.0. Cập nhật: 12/10/2026.

Chạy tại `D:/IoT/backend` hoặc thư mục `backend/` trong source đã nhận. Máy mới làm theo
[QUICKSTART.md](../project/QUICKSTART.md) trước; file này dùng để chạy hằng ngày,
kiểm tra database, tài khoản và bảo trì.

Các ví dụ dùng Compose project `iot-local`. Nếu máy đang dùng tên project khác,
giữ nguyên tên và chỗ lưu dữ liệu đó trong mọi lệnh. Không khởi động thêm một
PostgreSQL trên cùng bind directory.

## 1. Kiểm tra trước khi chạy

Yêu cầu Node.js `>=24.17.0 <25`, pnpm `11.19.0` và Docker đang hoạt động.
`.env` phải tồn tại và đã thay placeholder; xem
[ENV-REFERENCE.md](../project/ENV-REFERENCE.md).

```powershell
cd D:\IoT\backend
node --version
pnpm --version
docker compose -p iot-local ps
```

`DATABASE_URL` trỏ tới database nghiệp vụ; `TEST_DATABASE_URL` phải tách biệt.
Local mặc định dùng `iot_dev` và `iot_test`. Dữ liệu nằm ở
`POSTGRES_DATA_DIR` bên ngoài source, không nằm trong thư mục tạm của checkout.

## 2. Database và migration

Khởi động database:

```powershell
docker compose -p iot-local up -d postgres
docker compose -p iot-local ps
```

Chờ `healthy`. Khi dựng máy mới hoặc cập nhật một revision có migration:

```powershell
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:status
```

Không chạy `migrate:dev` để áp release; lệnh đó phục vụ tạo migration khi phát triển.
Không reset schema hoặc sửa `_prisma_migrations` để vượt qua lỗi status.

Dừng mà không xoá dữ liệu:

```powershell
docker compose -p iot-local stop postgres
```

Khởi động lại container đã có:

```powershell
docker compose -p iot-local start postgres
```

Không dùng `down -v` khi muốn giữ volume/database. Thay thư mục bind hoặc project
name không chuyển dữ liệu tự động và có thể làm xuất hiện database trống khác.

## 3. Chạy ứng dụng

Phát triển:

```powershell
pnpm dev
```

Chạy output đã build:

```powershell
pnpm build
pnpm start
```

`start` không tự build và không tự đổi `NODE_ENV` sang production.
Dừng server bằng `Ctrl+C`. Các địa chỉ local:

| Địa chỉ                                  | Mục đích                            |
| ---------------------------------------- | ----------------------------------- |
| `http://localhost:3000/api/v1/health`    | Tiến trình API còn đáp ứng          |
| `http://localhost:3000/api/v1/readiness` | Database đáp ứng                    |
| `http://localhost:3000/docs`             | Swagger trong development/test      |
| `http://localhost:3000/docs-json`        | OpenAPI JSON trong development/test |

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health
Invoke-RestMethod http://localhost:3000/api/v1/readiness
```

Hai kiểm tra này không chứng minh provider đang có dữ liệu mới.

## 4. Tài khoản và khóa

Bootstrap chỉ khi database chưa có user và authority:

```powershell
pnpm db:bootstrap-super-admin -- --email admin@example.com
```

Nhập mật khẩu hai lần qua prompt ẩn; đổi email theo người giữ quyền thực tế.
Không bootstrap lại một database đang hoạt động.

Nếu mất quyền đăng nhập của đúng authority holder, thực hiện recovery có chủ đích:

```powershell
pnpm db:recover-super-admin -- --email holder@example.com
```

Lệnh chỉ xử lý người đang giữ authority, đặt mật khẩu qua prompt ẩn, mở khóa,
chuyển trạng thái ACTIVE, thu hồi phiên cũ và ghi audit. Không truyền mật khẩu
bằng `--password`, environment hoặc sửa `passwordHash` bằng SQL.

Không đổi `DATA_SOURCE_ENCRYPTION_KEY` sau khi có nguồn mã hoá nếu chưa có kế hoạch
chuyển ciphertext. Giữ cùng key khi restore; pepper/JWT secret cũng phải được
quản lý, không thay tất cả để xử lý một lỗi đăng nhập.

## 5. Nguồn thật và chia sẻ

Thêm nguồn qua API Sources bằng Admin/Farmer sở hữu nguồn. URL và credential do
nhà cung cấp giao; host phải nằm trong allowlist. Chủ nguồn tìm email tài khoản
ACTIVE Farmer/Client Developer, chọn station rồi Save Access.

Người nhận chỉ có quyền trạm được chia sẻ. Không có khóa nguồn, quyền Reveal,
Test, Remove hay quản lý grant chỉ nhờ quyền đọc. Ordinary Admin nhìn thấy health
nguồn khác không có nghĩa đọc được số đo nguồn đó.

`Connected` ở kiểm tra kết nối không phải `observedAt` mới. Khi nguồn nghỉ, chỉ
dùng phần đã lưu có quyền và đúng nhãn stored/stale/partial. Không seed để làm
đẹp biểu đồ hoặc thay thế số đo provider.

## 6. Kiểm tra trên máy phát triển

Các kiểm tra không dùng database tích hợp:

```powershell
pnpm verify
pnpm exec vitest run src
pnpm security:secrets
git diff --check
```

Toàn bộ test tạo/dọn dữ liệu fixture trong database test. Kiểm tra target rồi mới chạy:

```powershell
pnpm test
pnpm test:coverage
pnpm audit --prod --audit-level=high
```

Không chạy test tích hợp hoặc fault injection trên database dữ liệu thật.
Không ghi kết quả test cũ thành bằng chứng của lần chạy hiện tại.

DBeaver local: host `localhost`, port `5432`, database/user theo `.env`; nhập
mật khẩu qua UI của DBeaver, không đưa vào báo cáo hoặc commit.

## 7. Retention và diễn tập restore

Bảo trì lifecycle là lệnh riêng, không tự chạy khi app khởi động:

```powershell
pnpm retention:run -- --confirm-retention
```

| Dữ liệu           | Điều kiện xử lý                                                             |
| ----------------- | --------------------------------------------------------------------------- |
| Session           | Hết hạn hoặc revoke quá 30 ngày                                             |
| API key           | Hết hạn hoặc revoke quá 90 ngày                                             |
| User              | Yêu cầu xoá quá 90 ngày; anonymize, giữ ID audit; loại trừ authority holder |
| Notification      | Tạo quá 180 ngày                                                            |
| Alert             | RESOLVED quá 365 ngày, không còn delivery job đang chờ                      |
| Idempotency claim | Hết hạn                                                                     |

Lệnh có batch và audit; cần backup dữ liệu quan trọng trước khi chạy.
Retention raw là cơ chế riêng trong collector: giữ 90 ngày theo `observedAt`,
cắt coverage quá hạn và giữ snapshot cuối.

Diễn tập restore local bằng script có kiểm tra target mới:

```powershell
$postgresContainerId = docker compose -p iot-local ps -q postgres
pwsh -File ./scripts/operations/backup-restore-rehearsal.ps1 -Container $postgresContainerId -SourceDatabase iot_dev -RestoreDatabase iot_restore_handover -DatabaseUser iot_app
```

Dừng nếu container ID rỗng hoặc lệnh trước báo lỗi. Thay database/user theo cấu
hình thực tế. Target phải chưa tồn tại, có prefix `iot_restore_`, không phải
database nguồn/test/postgres. Script giữ dump và database diễn tập cho review;
nó không xác nhận đầy đủ ứng dụng đã phục hồi hoặc đạt RPO/RTO.

## 8. Seed chỉ dành cho fixture đã được duyệt

Không seed trong các bước dựng hệ thống dùng nguồn thật hoặc khi bàn giao runtime.
Nếu chủ động dựng fixture local, dùng một PostgreSQL riêng đã được duyệt, không
chứa dữ liệu thật, với database đặt tên `iot_dev` và `NODE_ENV` là development/test.
Kiểm tra host, port và tên database trong `DATABASE_URL` trước khi chạy; không trỏ
vào database `iot_dev` đang dùng cho ứng dụng có dữ liệu thật:

```powershell
pnpm db:seed-station-demo -- --confirm-demo-seed
```

Lệnh chỉ chấp nhận tên database `iot_dev` ngoài production cùng cờ xác nhận;
không chấp nhận `iot_test` hoặc tên khác. Kiểm tra tên không chứng minh môi trường
đã được cô lập, nên vẫn phải xác nhận đúng PostgreSQL và dữ liệu trước khi chạy.
Không chuyển dữ liệu tạo bởi lệnh này sang Pi/server hoặc export để commit.

## 9. Xử lý sự cố

| Tình huống                       | Kiểm tra / xử lý                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| API không lên                    | Version Node/pnpm, cấu hình bắt buộc, port và log đã lược bỏ secret                   |
| Database không ready             | Compose ps/log, URL, user và migration; không reset database                          |
| Login được, refresh/logout 403   | Origin của frontend và HTTPS; sửa cấu hình rồi restart API, không tắt kiểm tra Origin |
| Reveal báo sai mật khẩu          | Giữ phiên và hiện lỗi xác nhận; lỗi business này khác lỗi session hết hạn             |
| Nguồn mất kết nối                | Status/timestamp và dữ liệu đã lưu; không sinh số mẫu                                 |
| History chưa đủ                  | Coverage/checkpoint; lỗi window rỗng đang mở trong CAPABILITY-MAP                     |
| Collector báo storage limit      | Dừng thu mới theo giới hạn; đánh giá capacity, không xoá raw còn trong hạn            |
| Khóa nguồn không đọc sau restore | Xác nhận đúng key giải mã qua kênh bảo vệ; không in key hoặc ciphertext               |

Xem [CAPABILITY-MAP.md](../../CAPABILITY-MAP.md) cho tồn đọng;
[DELIVERY-RECOVERY.md](DELIVERY-RECOVERY.md) cho triển khai/cutover.

## 10. Chạy hằng ngày

```powershell
cd D:\IoT\backend
docker compose -p iot-local up -d postgres
docker compose -p iot-local ps
pnpm dev
```

Sau khi dùng, `Ctrl+C` dừng backend. Có thể giữ database chạy hoặc dùng `stop postgres`.
