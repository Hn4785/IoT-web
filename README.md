# AgriSense IoT Soil Monitoring

Website giám sát đất nông nghiệp, gồm frontend React và backend NestJS. Repository dùng hai nhánh độc lập:

- `FE`: giao diện web.
- `BE`: REST API, PostgreSQL, phân quyền và tích hợp dữ liệu cảm biến.

Tài liệu này là điểm bắt đầu để chạy và sử dụng ứng dụng. Phạm vi, phiên bản,
bằng chứng kiểm thử, tám nhóm tài sản và tồn đọng được tổng hợp tại
[báo cáo bàn giao](docs/handover/README.md). Hướng dẫn vận hành chi tiết là tài liệu
tham khảo để bên nhận tái tạo, không phải yêu cầu triển khai hạ tầng do nhóm giao tự quyết.

## 1. Trạng thái hiện tại

| Hạng mục                                  | Trạng thái                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| Đăng nhập, refresh session, đổi mật khẩu  | Hoàn thành                                                                       |
| Admin quản lý tài khoản và phân quyền     | Hoàn thành                                                                       |
| Chuyển giao quyền Super Admin             | Hoàn thành; thao tác sẽ đăng xuất cả hai tài khoản                               |
| Farm → Plot → Station theo phạm vi Farmer | Hoàn thành                                                                       |
| Dữ liệu đất latest/history                | Lưu raw 90 ngày và snapshot cuối; phân biệt upstream/stored, cũ và lịch sử thiếu |
| Client Developer API và API key           | Hoàn thành                                                                       |
| Responsive desktop/mobile                 | Có kiểm thử desktop/390px; xem checkpoint mới nhất để biết phạm vi               |
| Thiết bị thật CENTER + NODE01–NODE06      | Provider xác nhận nguồn thật; recovery/live backfill cần bằng chứng riêng        |
| Alert và thông báo in-app                 | Đã nối backend; chỉ dữ liệu fresh hợp lệ được phát cảnh báo tự động              |
| Cấu hình/health thiết bị                  | Remote write ngoài phạm vi; health unavailable khi chưa có contract thật         |
| Tạo/sửa/xóa Farm, Plot, Station trên UI   | Chưa triển khai                                                                  |
| Khôi phục mật khẩu bằng email             | Chưa triển khai; hiện liên hệ Admin                                              |

Trạng thái và bằng chứng mới nhất ở [release notes](docs/internal-release-notes.md).
Các số test/checkpoint cũ là lịch sử, không phải kết quả hiện tại. Pi là môi
trường team test; bên nhận tự triển khai website và nghiệm thu hạ tầng của họ.

## 2. Yêu cầu máy

- Git, Docker Desktop và PowerShell.
- Node.js `>=24.17.0 <25`.
- pnpm `11.19.0` cho backend.
- pnpm cần được cài sẵn; không giả định Node 24 có Corepack đi kèm.
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
pnpm install --frozen-lockfile
Copy-Item .env.example .env
New-Item -ItemType Directory -Force E:\IoT-data\postgres
```

Mở `.env` và thay toàn bộ giá trị `replace-with-...`. Tối thiểu cần cấu hình:

- `POSTGRES_PASSWORD`, đồng thời dùng cùng mật khẩu trong `DATABASE_URL` và `TEST_DATABASE_URL`.
- `JWT_SECRET` và `CREDENTIAL_PEPPER`: hai chuỗi khác nhau, mỗi chuỗi tối thiểu 32 ký tự.
- `WEATHER_API_KEY`: dùng key local; không gửi cho frontend và không commit `.env`.
- `FRONTEND_ORIGIN=http://localhost:5173`.
- `DATA_SOURCE_ENCRYPTION_KEY`: khóa 32 byte dạng base64; giữ riêng khỏi backup.
- `DATA_SOURCE_ALLOWED_ORIGINS`: origin HTTPS được phép của nguồn thật, không có path.

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

Không seed Farm Demo hoặc nhập database thử nghiệm. Admin thêm nguồn thật và cấp
quyền station tại API Sources; User Management quản lý tài khoản, không phải
màn hình sửa registry/nguồn. Pi/server chỉ nhận bản chạy và dữ liệu thật đã có.

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

Mở <http://localhost:5173>. Giữ `VITE_API_BASE_URL=/api/v1`; Vite proxy mặc định
chuyển request tới backend `http://127.0.0.1:3000`. Chỉ đặt
`DEV_API_PROXY_TARGET` khi backend local chạy ở địa chỉ khác.

## 6. Trình tự test khuyến nghị

1. Mở health và Swagger, xác nhận backend trả `200`.
2. Đăng nhập Super Admin vừa tạo.
3. Tạo một Admin, một Farmer và một Client Developer; lưu lại temporary password lúc backend trả về vì plaintext chỉ hiển thị một lần.
4. Đăng nhập tài khoản mới, xác nhận hệ thống bắt đổi mật khẩu trước khi vào trang nghiệp vụ.
5. Chia sẻ nguồn/station tại API Sources rồi kiểm tra Farmer chỉ xem được phạm vi đã cấp.
6. Mở Soil Dashboard, chọn Farm → Plot → Station và kiểm tra latest/history, loading, empty state và nút thử lại khi API lỗi.
7. Với Client Developer, tạo API key, lưu key lúc hiển thị một lần, sau đó thử `/client/stations`, `/client/data/latest` và `/client/data/history` trong API Explorer.
8. Kiểm tra `401`, `403`, `404`, `429` và `503` không làm vỡ trang hoặc lộ stack trace.
9. Kiểm tra desktop và mobile khoảng `390px`; bảng phải cuộn hợp lý và cột Actions vẫn nhìn thấy.
10. Chỉ test chuyển giao Super Admin trên database dùng thử. Sau chuyển giao, người giữ quyền cũ mất quyền và cả hai phiên bị đăng xuất.

Không reset credential của Super Admin hiện tại. Nếu quên mật khẩu Super Admin ở local:

```powershell
cd D:\IoT-api
pnpm db:recover-super-admin -- --email root@example.com
```

## 7. Kiểm tra tự động

Frontend:

Dừng Vite đang chạy trước lệnh E2E; Playwright tự mở server riêng trên cổng 5173.
Cài Chromium một lần trên máy test bằng `npx playwright install chromium`.
`smoke.spec.ts` kiểm tra UI với mock cô lập, không chứng minh provider/Pi hoạt động.

```powershell
cd D:\IoT-web
npm run lint
npm test
npm run build
npm run test:e2e -- e2e/smoke.spec.ts
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
- Không ghi provider API key vào ảnh/tài liệu. `live-verified` đã ghi nhận xác
  nhận nguồn cảm biến thật ngày 2026-09-28; không cần xác nhận lại nguồn là mẫu
  hay thật. Backfill, phục hồi và notification tự động mới cần bằng chứng riêng,
  không được coi là đạt chỉ từ nhãn nguồn hoặc mock test.

## 9. Báo lỗi

Mỗi lỗi cần ghi: role, URL, bước tái hiện, kết quả mong đợi, kết quả thực tế, HTTP status/request ID, ảnh chụp và log console đã loại bỏ credential. Phân biệt rõ lỗi giao diện, lỗi API nội bộ và lỗi upstream thiết bị.

## 10. Tài liệu liên quan

- [Hướng dẫn nối frontend–backend](./docs/integration/README.md)
- [Ghi nhận cập nhật duy nhất](./docs/internal-release-notes.md)
- [Báo cáo và danh mục bàn giao](./docs/handover/README.md)

## 11. Hướng dẫn theo vai trò

Áp dụng code FE `5dbeea53` và BE `ec02462`. Chi tiết kỹ thuật ở hướng dẫn tích hợp;
môi trường/giới hạn kiểm chứng ở release record. Kiểm thử reset/transfer/quyền
phải dùng database riêng, không dùng dữ liệu đang vận hành.

### Đăng nhập và tài khoản

Đăng nhập bằng tài khoản được cấp. Đổi mật khẩu bắt buộc trước trang nghiệp vụ
nếu được yêu cầu. Nếu refresh thất bại, giao diện về Login, không giữ dữ liệu
người dùng trước. Quên mật khẩu thì liên hệ Admin; chưa có email recovery.
Temporary password chuyển qua kênh bảo vệ và đổi ngay, không ghi vào ảnh/báo lỗi.

### Admin và Super Admin

1. User Management quản lý tài khoản/role/trạng thái/reset. Chia sẻ nguồn/station
   tại API Sources, không dùng User Management để sửa quyền nguồn hiện hành.
2. API Sources: Add API Source, nhập URL thuộc allowed origins, key thật và
   Farm/Plot, rồi Connect Source. Thành công có nguồn và station; lỗi thì sửa
   thông tin hoặc thử lại, không thêm nguồn giả để trang có dữ liệu.
3. Vào trang/Refresh kiểm tra kết nối. Kết quả có cache 30 giây; xem Last Checked,
   không coi Connected cũ là xác nhận nguồn đang chạy.
4. Manage Access chọn tài khoản/trạm và lưu. Bên được share làm mới scope để xem
   quyền mới; thu hồi thì dữ liệu ngoài quyền phải biến mất. Bên chỉ được share
   không reveal key/sửa quyền/xóa nguồn; vẫn xem connection status được cấp và
   dùng View Data.
5. Chủ nguồn Reveal Key sau xác thực mật khẩu, tự ẩn theo response hiện tại là
   30 giây. Key nguồn có thể reveal lại, khác client API key chỉ hiển thị một lần.
   Không chụp key. Remove Source phải xác nhận; xóa mềm nguồn, không hard-delete
   số đo/audit. Nguồn đã xóa không còn khả dụng cho người dùng.
6. Chỉ Super Admin vào Audit, lọc và tải theo cursor. Transfer là thao tác riêng
   thu hồi các phiên liên quan; recovery CLI chỉ đổi mật khẩu/mở khóa tài khoản
   đang giữ authority, không tự chuyển quyền.

### Farmer

1. Soil Dashboard: chọn Farm → Plot → Station. Xem giá trị, đơn vị, thời điểm đo
   và lấy dữ liệu. Card chưa có số đo hiện `—`; Stored/Cache/Last known/Stale không
   có nghĩa đang đo trực tiếp. Endpoint phụ lỗi không xóa kết quả endpoint khác.
   Retry khi lỗi tạm thời; đổi trạm/mất quyền không giữ số đo trạm cũ.
2. Historical Analysis: chọn trạm/chỉ số/khoảng 7–30–90 ngày, độ sâu nếu có.
   Trạm lỗi có Retry riêng; trạm thành công giữ kết quả. Last known chỉ cho đúng
   query/phiên/quyền. Xem coverage; biểu đồ không chứng minh đầy đủ lịch sử hoặc
   tương quan thống kê. Export CSV xuất phần đã tải.
3. History Report: chọn Metric/From/To, Apply, kiểm tra series và nguồn/coverage,
   rồi Export CSV. Series là hourly mean; CSV không tự tải lịch sử còn thiếu.
   Đổi query không dùng kết quả giữ lại của query trước.
4. Alert Center: xem rule và OPEN/ACKNOWLEDGED/RESOLVED. Người có quyền tạo/sửa
   rule theo trường/đơn vị được xác nhận; Acknowledge/Resolve cần backend thành
   công. Lỗi 400 thì sửa form; conflict thì tải trạng thái mới; lỗi quyền thì
   dừng thao tác. Ngưỡng cảnh báo không điều khiển thiết bị.
5. Notifications: All/Unread, đánh dấu đọc/chưa đọc, Refresh, Load more khi còn
   cursor. Đây là inbox in-app, chưa có email/SMS. Mất quyền thì xóa danh sách
   khỏi phiên hiển thị, không giữ inbox của tài khoản trước.

Ngày From/To trong History Report dùng ranh giới UTC; trục biểu đồ theo múi giờ
trình duyệt. Một số Last fetch/Last Checked dùng UTC+7 qua formatter riêng.
Không coi toàn UI chỉ dùng một múi giờ. DTO unit/metadata có thể null; card đất
dùng cấu hình canonical hiện hành, metadata không có vẫn phải ghi thiếu.

### Client Developer

1. API Access → Keys: tạo key từ station được cấp; lưu qua kênh bảo vệ, tích xác
   nhận rồi đóng hộp thoại. Create/rotate chỉ hiển thị plaintext lần đó, không
   đọc lại từ danh sách. Rotate thay key; revoke vô hiệu hóa key.
2. API Access → Access Scope xem trạm có quyền. Thiếu trạm thì nhờ chủ nguồn
   chia sẻ; không sửa UUID/code hoặc dùng key người khác để vượt scope.
3. API Tools → Documentation/Explorer: nhập key tạm trong memory, chọn client
   endpoint, mã station và begin/end UTC, interval/aggregate/limit. Send Request
   hiện envelope/status/time/rate-limit header; tải Next page theo cursor.
   Raw tối đa 7 ngày, aggregate tối đa 90 ngày mỗi request.
4. Key sai/revoke thì sửa key; 429 thì chờ; nguồn nghỉ thì xem Stored/timestamp.
   Không lưu key vào localStorage, screenshot, log hoặc báo cáo.
