# Dựng môi trường backend trong 10 bước

Phiên bản: 3.0.0. Cập nhật: 12/10/2026.

Hướng dẫn dành cho máy phát triển mới, dùng PowerShell. Không chạy tuần tự các
lệnh khởi tạo trên database đang phục vụ người dùng. Với một máy đã có dữ liệu,
giữ nguyên Compose project và thư mục dữ liệu hiện tại.

## 1. Chọn đúng source và kiểm tra công cụ

Dùng source tích hợp theo revision ghi trong biên bản giao nhận. Nếu đã nhận source:

```powershell
cd D:\IoT\backend
git rev-parse --short HEAD
node --version
pnpm --version
docker --version
docker compose version
```

Node.js phải là `>=24.17.0 <25`; pnpm phải là `11.19.0`. Docker cần đang chạy.
Ví dụ đường dẫn ở đây không bắt buộc người nhận đặt source trên ổ D.

Nếu chưa có source, clone nhánh tích hợp vào thư mục mới:

```powershell
git clone --branch codex/monorepo-final https://github.com/Hn4785/IoT-web.git IoT
cd IoT
git switch --detach <revision-tich-hop-da-duoc-giao>
cd backend
```

Thay placeholder bằng commit được giao trước khi chạy `git switch`. Không chọn
revision bằng tên hoặc ngày của một thư mục tạm.

## 2. Cài dependency theo lockfile

```powershell
pnpm install --frozen-lockfile
```

Không xoá lockfile hoặc đổi version để bỏ qua lỗi cài đặt. Native package được
phép build được khai báo trong `pnpm-workspace.yaml`.

## 3. Tạo file cấu hình local

Chỉ chạy lệnh sau nếu chưa có `.env`:

```powershell
Copy-Item .env.example .env
```

Mở file bằng trình soạn thảo, không gửi nội dung file vào báo cáo hay Git.
Mẫu `.env.example` chứa placeholder, không phải bộ credential có thể sử dụng.

## 4. Điền cấu hình và chuẩn bị chỗ lưu dữ liệu

Điền khóa Weather/source do bên cung cấp giao, mật khẩu PostgreSQL và hai secret
ngẫu nhiên khác nhau cho `JWT_SECRET` và `CREDENTIAL_PEPPER`.
Mỗi secret đăng nhập dài 32–4096 ký tự; có thể tạo từng secret bằng lệnh sau,
chạy riêng cho từng giá trị rồi lưu vào `.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

`DATA_SOURCE_ENCRYPTION_KEY` phải giải mã thành đúng 32 byte; lệnh trên cũng tạo
đúng dạng base64 cho khóa này. Không dùng cùng một giá trị cho cả ba mục.

Đặt `FRONTEND_ORIGIN=http://localhost:5173` nếu frontend mở ở origin đó.
`DATA_SOURCE_ALLOWED_ORIGINS` chứa HTTPS origin của nhà cung cấp, không kèm
`/api/v1`. `WEATHER_API_BASE_URL` là URL gốc API, có thể kèm đường dẫn API.

Ví dụ dùng thư mục dữ liệu tách khỏi source:

```powershell
New-Item -ItemType Directory -Force D:\IoT-data\postgres
```

Trong `.env` đặt `POSTGRES_DATA_DIR=D:/IoT-data/postgres`. Mật khẩu trong
`DATABASE_URL` và `TEST_DATABASE_URL` phải khớp `POSTGRES_PASSWORD`; nếu có ký tự
đặc biệt thì URL-encode phần mật khẩu. Hai URL phải trỏ tới `iot_dev` và `iot_test`
khác nhau. Tra toàn bộ cấu hình tại [ENV-REFERENCE.md](ENV-REFERENCE.md).

## 5. Khởi động PostgreSQL local

```powershell
docker compose -p iot-local up -d postgres
docker compose -p iot-local ps
```

Chờ trạng thái `healthy`. Root `compose.yaml` chỉ chạy PostgreSQL, bind cổng
`127.0.0.1:5432`; không chạy backend/frontend.

`iot-local` là tên project dùng nhất quán cho máy mới trong hướng dẫn.
Nếu máy có project khác đang giữ cùng dữ liệu, dùng tên project đó và không
khởi động thêm một container PostgreSQL trên cùng thư mục dữ liệu.

## 6. Generate và áp migration

```powershell
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:status
```

Source hiện có 13 migration. Chỉ tiếp tục khi status cho biết database đã cập nhật.
`migrate:deploy` dùng các file migration đã giao; không tạo migration mới.

## 7. Khởi tạo Super Admin lần đầu

Chỉ áp dụng khi database chưa có người dùng và authority:

```powershell
pnpm db:bootstrap-super-admin -- --email admin@example.com
```

Thay email bằng người giữ quyền thực tế. Nhập mật khẩu hai lần qua prompt ẩn,
12–128 ký tự. Không đặt mật khẩu trong argument, biến môi trường hoặc tài liệu.
Database đã có tài khoản phải bỏ qua bước bootstrap.

## 8. Chạy backend

```powershell
pnpm dev
```

Giữ cửa sổ này mở. Backend mặc định dùng port `3000`.
Dùng `Ctrl+C` để dừng server.

## 9. Kiểm tra kết nối và thêm nguồn thật

Trong cửa sổ PowerShell khác:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health
Invoke-RestMethod http://localhost:3000/api/v1/readiness
```

Health phải trả `healthy`; readiness phải trả `ready` khi database sẵn sàng.
Trong development, mở `http://localhost:3000/docs` để xem OpenAPI.

[Frontend](../../../frontend/README.md) ở `frontend/` cùng repository được dựng riêng. Đăng nhập, hoàn tất đổi mật khẩu nếu hệ
thống yêu cầu, thêm nguồn thật tại API Sources. Chủ nguồn nhập email người nhận,
chọn các trạm rồi lưu quyền. Việc tìm email chưa tự cấp quyền.

Nếu chưa có credential/metadata từ nhà cung cấp, chưa thể kết luận luồng dữ liệu
đã chạy đủ. Không chạy seed hoặc đưa database test vào môi trường dữ liệu thật.

## 10. Chạy kiểm tra trước khi phát triển tiếp

Kiểm tra không dùng database tích hợp:

```powershell
pnpm verify
pnpm exec vitest run src
pnpm security:secrets
```

Toàn bộ test cần `TEST_DATABASE_URL` trỏ tới database test riêng. Chạy lệnh sau
chỉ sau khi đã kiểm tra đúng target; test có thể tạo và dọn dữ liệu trong database đó:

```powershell
pnpm test
pnpm test:coverage
```

Hướng dẫn chạy hằng ngày và xử lý lỗi nằm tại
[LOCAL-RUNBOOK.md](../operations/LOCAL-RUNBOOK.md).
