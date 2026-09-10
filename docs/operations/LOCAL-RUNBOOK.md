# Lệnh chạy backend trên máy local

File này là hướng dẫn thao tác nhanh cho backend `iot-api`. Chạy các lệnh trong PowerShell tại thư mục:

```powershell
cd D:\IoT-api\.worktrees\integration-core
```

## 1. Chuẩn bị lần đầu

Yêu cầu: Node.js `>=24.17.0 <25`, pnpm `11.19.0` và Docker Desktop đang hoạt động.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
New-Item -ItemType Directory -Force E:\IoT-data\postgres
```

Sau khi copy, mở `.env` và thay các giá trị mẫu. Cần đặt mật khẩu PostgreSQL, Weather API key, `JWT_SECRET` và `CREDENTIAL_PEPPER`. Hai secret phải khác nhau và dài tối thiểu 32 ký tự. Không gửi hoặc commit file `.env`.

## 2. Khởi động database

```powershell
docker compose up -d postgres
docker compose ps
```

Chỉ tiếp tục khi container PostgreSQL hiện trạng thái `healthy`.

```powershell
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:status
```

Nếu cần dừng database mà vẫn giữ dữ liệu:

```powershell
docker compose stop postgres
```

Khởi động lại database đã dừng:

```powershell
docker compose start postgres
```

Không dùng `docker compose down -v`: tùy chọn `-v` có thể xóa dữ liệu database.

## 3. Tạo dữ liệu ban đầu

Tạo Super Admin lần đầu. Mật khẩu được nhập bằng prompt ẩn:

```powershell
pnpm db:bootstrap-super-admin -- --email root@example.com
```

Tạo Farm, Plot và Station demo trong database `iot_dev`:

```powershell
pnpm db:seed-station-demo -- --confirm-demo-seed
```

Seed demo có thể chạy lại; không tạo user, membership, station grant hoặc API key.

## 4. Chạy backend khi phát triển

```powershell
pnpm dev
```

Các địa chỉ thường dùng:

- Health: `http://localhost:3000/api/v1/health`
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`

Kiểm tra nhanh bằng PowerShell:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health
```

Swagger chỉ được bật trong môi trường `development` và `test`.

## 5. Chạy bản production đã build

```powershell
pnpm build
pnpm start
```

`pnpm start` không tự build. Nếu source vừa thay đổi, luôn chạy `pnpm build` trước.

## 6. Kiểm tra trước khi commit

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm audit
```

Nếu test tích hợp database thất bại, kiểm tra theo thứ tự:

```powershell
docker compose ps
pnpm db:status
```

Sau đó xác nhận `DATABASE_URL` và `TEST_DATABASE_URL` trong `.env` trỏ tới đúng `iot_dev` và `iot_test`. Không in giá trị secret ra terminal hoặc báo cáo lỗi.

## 7. DBeaver

Dùng các thông tin sau để tạo kết nối PostgreSQL:

- Host: `localhost`
- Port: `5432`
- Database: `iot_dev`
- Username: giá trị `POSTGRES_USER` trong `.env`
- Password: giá trị `POSTGRES_PASSWORD` trong `.env`

Database test là `iot_test`. Không chỉnh trực tiếp migration history hoặc các cột hash bằng DBeaver.

## 8. Lệnh bảo trì

Nếu mất mật khẩu của tài khoản đang giữ quyền Super Admin:

```powershell
pnpm db:recover-super-admin -- --email <email-super-admin>
```

Lệnh yêu cầu nhập mật khẩu mới hai lần qua prompt ẩn, chỉ cập nhật đúng authority holder, mở khóa tài khoản, thu hồi phiên cũ và ghi audit. Không truyền mật khẩu trên command line.

Chỉ chạy retention khi chủ động thực hiện bảo trì:

```powershell
pnpm retention:run -- --confirm-retention
```

Không chạy lệnh này để sửa lỗi phát triển thông thường. Hãy sao lưu database trước khi thực hiện trên dữ liệu quan trọng.

## Trình tự chạy hằng ngày

```powershell
cd D:\IoT-api\.worktrees\integration-core
docker compose up -d postgres
docker compose ps
pnpm dev
```

Khi kết thúc, nhấn `Ctrl+C` để dừng backend. Có thể để PostgreSQL chạy hoặc dùng `docker compose stop postgres` nếu muốn giải phóng tài nguyên.
