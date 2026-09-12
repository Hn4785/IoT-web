# AgriSense IoT Soil Monitoring

Website giám sát đất nông nghiệp, gồm frontend React và backend NestJS. Repository dùng hai nhánh độc lập:

- `FE`: giao diện web.
- `BE`: REST API, PostgreSQL, phân quyền và tích hợp dữ liệu cảm biến.

Tài liệu này là điểm bắt đầu duy nhất dành cho tester. Không cần đọc thư mục tài liệu nội bộ để chạy dự án.

## 1. Trạng thái hiện tại

| Hạng mục | Trạng thái |
| --- | --- |
| Đăng nhập, refresh session, đổi mật khẩu | Hoàn thành |
| Admin quản lý tài khoản và phân quyền | Hoàn thành |
| Chuyển giao quyền Super Admin | Hoàn thành; thao tác sẽ đăng xuất cả hai tài khoản |
| Farm → Plot → Station theo phạm vi Farmer | Hoàn thành |
| Dữ liệu đất latest/history | Hoàn thành ở contract và dữ liệu giả lập |
| Client Developer API và API key | Hoàn thành |
| Responsive desktop/mobile | Hoàn thành vòng kiểm thử hiện tại |
| Thiết bị thật CENTER + NODE01–NODE06 | Chờ hệ thống quan trắc cho phép truy cập API |
| Alert, cấu hình IoT, audit và device-health đầy đủ | Một số màn hình còn dùng dữ liệu mẫu |
| Tạo/sửa/xóa Farm, Plot, Station trên UI | Chưa triển khai |
| Khôi phục mật khẩu bằng email | Chưa triển khai; hiện liên hệ Admin |

Kết quả kiểm tra gần nhất: frontend `20/20` test, backend `251/251` test, lint và production build đều đạt.

## 2. Yêu cầu máy

- Git, Docker Desktop và PowerShell.
- Node.js `>=24.17.0 <25`.
- pnpm `11.19.0` cho backend.
- Ổ `E:` để lưu PostgreSQL theo cấu hình mặc định. Nếu máy không có ổ `E:`, đổi `POSTGRES_DATA_DIR` trong `.env` sang một thư mục tuyệt đối khác.

## 3. Tải hai nhánh

```powershell
cd D:\
git clone --branch FE https://github.com/Hn4785/IoT-web.git IoT-web
git clone --branch BE https://github.com/Hn4785/IoT-web.git IoT-api
```

## 4. Tạo database và chạy backend

```powershell
cd D:\IoT-api
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
Copy-Item .env.example .env
New-Item -ItemType Directory -Force E:\IoT-data\postgres
```

Mở `.env` và thay toàn bộ giá trị `replace-with-...`. Tối thiểu cần cấu hình:

- `POSTGRES_PASSWORD`, đồng thời dùng cùng mật khẩu trong `DATABASE_URL` và `TEST_DATABASE_URL`.
- `JWT_SECRET` và `CREDENTIAL_PEPPER`: hai chuỗi khác nhau, mỗi chuỗi tối thiểu 32 ký tự.
- `WEATHER_API_KEY`: dùng key local; không gửi cho frontend và không commit `.env`.
- `FRONTEND_ORIGIN=http://localhost:5173`.

Khởi động PostgreSQL và kiểm tra trạng thái:

```powershell
docker compose up -d postgres
docker compose ps
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:status
```

Chỉ tiếp tục khi PostgreSQL báo `healthy` và migration không còn pending.

Tạo Super Admin đầu tiên; mật khẩu được nhập bằng prompt ẩn:

```powershell
pnpm db:bootstrap-super-admin -- --email root@example.com
```

Tạo registry demo an toàn:

```powershell
pnpm db:seed-station-demo -- --confirm-demo-seed
```

Seed hiện tạo `Farm Demo`, `Plot Demo`, `NODE01` và `NODE02`. Đây chỉ là dữ liệu cấu trúc local, không đại diện đầy đủ hệ thống thật dự kiến có `CENTER` và `NODE01`–`NODE06`.

Chạy backend:

```powershell
pnpm dev
```

Giữ terminal này mở. Kiểm tra:

- Health: <http://localhost:3000/api/v1/health>
- Swagger: <http://localhost:3000/docs>
- OpenAPI JSON: <http://localhost:3000/docs-json>

## 5. Chạy frontend

Mở terminal PowerShell mới:

```powershell
cd D:\IoT-web
npm ci
Copy-Item .env.example .env
npm run dev
```

Mở <http://localhost:5173>. Frontend phải dùng `VITE_API_BASE_URL=http://localhost:3000/api/v1`.

## 6. Trình tự test khuyến nghị

1. Mở health và Swagger, xác nhận backend trả `200`.
2. Đăng nhập Super Admin vừa tạo.
3. Tạo một Admin, một Farmer và một Client Developer; lưu lại temporary password lúc backend trả về vì plaintext chỉ hiển thị một lần.
4. Đăng nhập tài khoản mới, xác nhận hệ thống bắt đổi mật khẩu trước khi vào trang nghiệp vụ.
5. Gán Farm/Station cho Farmer rồi kiểm tra Farmer chỉ xem được phạm vi đã cấp.
6. Mở Soil Dashboard, chọn Farm → Plot → Station và kiểm tra latest/history, loading, empty state và nút thử lại khi API lỗi.
7. Với Client Developer, tạo API key, lưu key lúc hiển thị một lần, sau đó thử `/client/stations`, `/client/data/latest` và `/client/data/history` trong API Explorer.
8. Kiểm tra `401`, `403`, `404`, `429` và `503` không làm vỡ trang hoặc lộ stack trace.
9. Kiểm tra desktop và màn hình rộng `390px`; bảng phải cuộn hợp lý và cột Actions vẫn nhìn thấy.
10. Chỉ test chuyển giao Super Admin trên database dùng thử. Sau chuyển giao, người giữ quyền cũ mất quyền và cả hai phiên bị đăng xuất.

Không reset credential của Super Admin hiện tại. Nếu quên mật khẩu Super Admin ở local:

```powershell
cd D:\IoT-api
pnpm db:recover-super-admin -- --email root@example.com
```

## 7. Kiểm tra tự động

Frontend:

```powershell
cd D:\IoT-web
npm run lint
npm test
npm run build
```

Backend, khi Docker/PostgreSQL đang chạy:

```powershell
cd D:\IoT-api
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Log `400`, `401`, `403`, `413`, `415`, `429` hoặc `503` có thể xuất hiện trong các test đối kháng; chỉ coi là lỗi khi lệnh kết thúc khác mã `0` hoặc có test fail.

## 8. Quy tắc an toàn

- Không commit `.env`, mật khẩu, access token, refresh cookie hoặc API key.
- Không dùng `docker compose down -v` vì có thể xóa dữ liệu PostgreSQL.
- Không sửa migration history hoặc các cột hash trực tiếp bằng DBeaver.
- Không dùng dữ liệu production cho bài test reset credential, chuyển Super Admin hoặc retention.
- API cảm biến thật hiện chưa truy cập được; tester dùng dữ liệu demo/fixture cho đến khi đội thiết bị bàn giao endpoint hoạt động.

## 9. Báo lỗi

Mỗi lỗi cần ghi: role, URL, bước tái hiện, kết quả mong đợi, kết quả thực tế, HTTP status/request ID, ảnh chụp và log console đã loại bỏ credential. Phân biệt rõ lỗi giao diện, lỗi API nội bộ và lỗi upstream thiết bị.
