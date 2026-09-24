# Hướng dẫn nối Frontend - Backend

Tài liệu này là đầu mối triển khai tích hợp giữa nhánh frontend `FE` tại
`D:/IoT-web` và backend `BE` tại
`D:/IoT-api/.worktrees/integration-core`. Không đổi tên route hoặc tự dựng DTO
theo giao diện; contract runtime từ backend là nguồn sự thật.

> Trạng thái công việc nằm ở backend `tasks/todo.md`; lỗi nằm ở backend issue
> ledger. File này chỉ giữ cách nối và acceptance theo trang, không giữ lịch sử
> checkpoint hay sao chép sổ lỗi.

## 1. Nguồn sự thật và nguyên tắc

- API prefix: `/api/v1`.
- Development OpenAPI: `http://localhost:3000/docs-json`.
- Swagger UI chỉ tồn tại ở development: `http://localhost:3000/docs`.
- Success envelope: `{ "success": true, "data": ... }`.
- Error envelope:
  `{ "success": false, "error": { "code": "...", "message": "..." }, "requestId": "..." }`.
- Browser dùng Bearer access token; refresh token chỉ nằm trong cookie
  `HttpOnly` và mọi request refresh/logout phải bật credentials.
- Client Developer gọi `/client/*` bằng `X-API-Key`, không dùng Bearer token của
  portal thay thế API key.
- Frontend không được tự suy ra quyền từ sidebar. Backend quyết định `401`,
  `403` và phạm vi Farm/Station.
- Không fallback sang dữ liệu mẫu khi API lỗi. Hiển thị loading, empty state hoặc
  lỗi có nút thử lại.
- Không ghi access token, refresh cookie, temporary password hoặc API key vào
  source, localStorage, log, ảnh hay tài liệu.

## 2. Cấu hình môi trường

### Local

Backend `.env`:

```dotenv
PORT=3000
FRONTEND_ORIGIN=http://localhost:5173
```

Frontend `.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### Pi/ngrok

Frontend và backend nên đi qua cùng một origin. Trình duyệt gọi `/api/v1`; reverse
proxy chuyển `/api/v1/*` vào container API, còn các route khác trả SPA. Không
nhúng URL ngrok cụ thể vào source vì domain có thể thay đổi.

## 3. Lớp kết nối chuẩn ở frontend

Mỗi chức năng đi qua đúng bốn lớp:

```text
Page/Hook -> Service -> apiClient -> Backend controller
```

1. Khai báo đường dẫn trong `src/api/endpoints.ts`.
2. Khai báo DTO TypeScript theo OpenAPI; không dùng trực tiếp type của dữ liệu
   mẫu.
3. Service gọi `apiClient`, unwrap đúng envelope và trả DTO cho page.
4. Page quản lý loading/error/empty/success, không tự gọi Axios rải rác.
5. Thêm contract test cho URL, method, query/body và envelope trước khi thay mock.

`apiClient` phải giữ các invariant hiện tại:

- Access token chỉ ở memory.
- `withCredentials: true` cho cookie refresh.
- Chỉ một refresh chạy tại một thời điểm; các request 401 còn lại chờ chung.
- Refresh thất bại thì xóa session local và chuyển về `/login`.
- Không retry vô hạn các request state-changing.

## 4. Thứ tự tích hợp theo phase

### Phase A - tài khoản và quyền

| Luồng frontend | Backend contract | Trạng thái |
| --- | --- | --- |
| Login | `POST /auth/login` | Đã nối |
| Khôi phục phiên | `POST /auth/refresh`, `GET /auth/me` | Đã nối |
| Logout | `POST /auth/logout` | Đã nối |
| Đổi mật khẩu | `POST /auth/change-password` | Đã nối |
| Danh sách/tạo/sửa user | `GET/POST /admin/users`, `PATCH /admin/users/:id` | Đã nối |
| Reset mật khẩu | `POST /admin/users/:id/reset-password` | Đã nối |
| Quyền Farm/Station | `PUT/DELETE /admin/users/:id/farm-memberships/:farmId`, `PUT/DELETE /admin/users/:id/station-grants/:stationId` | Đã nối selector và thao tác cấp/thu hồi; cần kiểm thử browser |
| Chuyển Super Admin | `POST /admin/super-admin/transfer` | Đã nối |
| API key | `/developer/api-keys/*` | Đã nối |

Điều kiện nghiệm thu Phase A trên trình duyệt:

- Ba role vào đúng route và không mở được route role khác.
- User mới bị buộc đổi mật khẩu.
- Super Admin hiện tại không thể tự reset credential.
- Chuyển authority thu hồi phiên cũ và buộc đăng nhập lại.
- Create/rotate secret chỉ hiển thị một lần và thao tác Copy báo kết quả rõ ràng.

### Phase B - Station và dữ liệu đất

| Màn hình | Contract | Việc còn lại |
| --- | --- | --- |
| Farm -> Plot -> Station | `GET /farms`, `/farms/:id/plots`, `/plots/:id/stations` | Dùng chung `stationBrowserService` |
| Soil Dashboard | `GET /stations/:id/data/latest`, `/history` | Đã nối; giữ polling hữu hạn |
| Historical Analysis | `GET /stations/:id/data/history` | Đã nối |
| Farmer Dashboard | Cùng hierarchy/latest | Đã nối; không fallback dữ liệu mẫu |
| History Report | Cùng hierarchy/history | Đã nối; có empty/error và CSV từ dữ liệu đã tải |
| Client API Explorer | `/client/stations`, `/client/data/latest`, `/client/data/history` | Đã nối bằng `X-API-Key` |

Quy tắc dữ liệu:

- Thời gian gửi backend phải là ISO 8601 UTC kết thúc bằng `Z`.
- History raw tối đa 7 ngày; aggregate tối đa 90 ngày.
- Theo `nextCursor`; không tự suy ra tổng số trang.
- `unit`, `sensorId`, `depthCm` có thể `null`. UI không dựng dữ liệu không có từ
  provider.
- Phân biệt `isFromCache`, `isStale`, upstream lỗi và danh sách rỗng.

### Phase C - cảnh báo và thông báo trong ứng dụng

Contract hiện có:

- `GET/POST /stations/:stationId/alert-rules`.
- `GET/PATCH /alert-rules/:ruleId`.
- `GET /alerts`, `GET /alerts/:alertId`.
- `POST /alerts/:alertId/acknowledgements`.
- `POST /alerts/:alertId/resolutions`.
- `GET /notifications`, `PATCH /notifications/:notificationId`.
- `GET /device-configurations/capability`.

Trạng thái frontend hiện tại:

1. `alertService` dùng đúng POST acknowledgement/resolution sub-resource; không
   còn gọi route `PATCH /alerts/:id` hoặc comments không tồn tại.
2. Farmer và Admin Alert Center dùng chung lifecycle DTO thật.
3. `notificationService` dùng cursor/unread/mark-read contract thật; UI
   Notifications còn chờ frontend hoàn thiện và chưa nằm trong checkpoint Admin.
4. Các trang cấu hình/thiết bị hiển thị unavailable khi capability trả
   `DEVICE_CONTRACT_PENDING`; không dựng nút publish giả.
5. Còn phải chạy browser matrix cho quyền Admin/Farmer, mất membership và stale
   session trước khi nghiệm thu tích hợp.

### Phase D - audit và vận hành

- Admin Audit dùng `GET /admin/audit-events`; chỉ Super Admin được đọc.
- Readiness dành cho hạ tầng, không dùng thay liveness `/health` trên UI.
- Không expose registry metrics process-local ra giao diện khi chưa có contract
  production.
- Device Health, Gateway/Sensor metrics và API Metrics phải hiển thị `N/A` hoặc
  unavailable cho tới khi backend có contract thật; không giữ số mẫu.

## 5. Ánh xạ lỗi sang giao diện

| HTTP/code | Hành vi frontend |
| --- | --- |
| `400 VALIDATION_ERROR` | Giữ form, chỉ rõ trường/input sai |
| `401 UNAUTHENTICATED` | Thử single-flight refresh một lần; thất bại thì login |
| `403 FORBIDDEN` | Trang không có quyền; không giả thành dữ liệu rỗng |
| `404 NOT_FOUND` | Resource không tồn tại hoặc ngoài scope; không tiết lộ khác biệt |
| `409 CONFLICT` | Thông báo dữ liệu/thao tác đã thay đổi, tải lại trạng thái |
| `429 RATE_LIMITED` | Khóa gửi lại tạm thời, đọc rate-limit header nếu có |
| `502 UPSTREAM_UNAVAILABLE` | Giữ dữ liệu cache hợp lệ nếu response cung cấp; cho thử lại |
| `503 DATABASE_UNAVAILABLE` | Báo dịch vụ tạm thời không sẵn sàng, không xóa session tùy tiện |

Luôn giữ `requestId` để tester đối chiếu log backend, nhưng không hiển thị stack
trace hoặc raw exception.

## 6. Checklist thay một trang mock bằng API thật

1. Xác nhận endpoint trong `/docs-json` và role được phép.
2. Viết DTO input/output và test URL/method/envelope.
3. Viết hoặc sửa service; không gọi backend trực tiếp từ component.
4. Thay nguồn mock, sau đó xóa import `src/data/*` khỏi trang.
5. Kiểm tra loading, empty, error, retry và stale/cache.
6. Kiểm tra `401`, `403`, `404`, `409`, `429`, `502/503` có liên quan.
7. Kiểm tra logout, refresh và chuyển role/status không để state cũ tồn tại.
8. Chạy test/build/lint cả hai phía.
9. Dùng DevTools kiểm tra request thực tế không chứa secret ngoài header/cookie
   đã thiết kế.
10. Cập nhật `docs/internal-release-notes.md`; chỉ đánh dấu hoàn thành khi có
    bằng chứng browser hoặc test tự động.

## 7. Lệnh kiểm tra

```powershell
# Backend
cd D:\IoT-api\.worktrees\integration-core
docker compose up -d postgres
pnpm db:status
pnpm test
pnpm verify

# Frontend
cd D:\IoT-web
pnpm test
pnpm lint
pnpm build
```

Sau gate tĩnh, chạy browser matrix cho Admin, Farmer và Client Developer trên:

- màn hình desktop;
- chiều rộng khoảng 390 px;
- phiên mới, phiên hết hạn và logout;
- upstream/database hoạt động và tạm mất kết nối.

## 8. Thứ tự hoàn thiện hiện tại

### Gate trước khi nối toàn diện

Các adapter và trang Phase B/C có thể hoàn thiện local đã được nối. Gate tiếp
theo là kiểm thử trình duyệt theo role; provider CENTER/NODE và contract ghi
thiết bị là phụ thuộc ngoài, phải để fail-closed thay vì dựng dữ liệu giả.

### Thứ tự nối theo role và từng trang

1. **Admin/Super Admin trước:** Dashboard → Users/phân quyền → Stations & Devices
   → Device Health → Alert Center/rules → Notifications nếu có → Config
   capability/proposals → Audit Log.
2. Chạy đủ happy path, sai quyền, session hết hạn và lỗi dependency cho toàn bộ
   trang Admin/Super Admin; tạo checkpoint riêng trước khi chuyển role.
3. **Farmer tiếp theo:** Dashboard → Soil Dashboard → Historical Analysis →
   History Report → Alerts/Alert Center → Notification Inbox/Settings.
4. Chạy scope Farm/Plot/Station, mất membership, stale/cache và upstream lỗi;
   tạo checkpoint Farmer riêng.
5. **Client Developer cuối cùng:** Dashboard → API Keys → API Permissions → API
   Docs → API Explorer → API Metrics khi đã có contract.
6. Chạy API-key scope, create/copy/rotate/revoke, rate limit và key hết hạn; tạo
   checkpoint Developer riêng.
7. Sau ba checkpoint role mới chạy browser matrix liên role và QA recovery toàn
   hệ thống.
8. Chỉ sau đó mới đóng staging/production: TLS/proxy, shared limiter, backup,
   MFA và metrics tập trung.

### Theo dõi checkpoint Admin/Super Admin v2.5.2

`Đã nối code` chỉ xác nhận frontend gọi API thật và build/test tĩnh đạt; **không**
đồng nghĩa đã nghiệm thu trên browser với tài khoản thật.

| Trang/luồng | Trạng thái code | Browser role matrix |
| --- | --- | --- |
| Dashboard | Đã nối inventory; chỉ số chưa có contract là N/A | Smoke đạt trên Pi với phiên Super Admin; role matrix chưa xong |
| Users và quyền Farm/Station | Đã nối API tài khoản và cấp/thu hồi scope | Chưa chạy |
| Stations & Devices, Station Detail | Đã nối hierarchy, station detail, latest soil | Chưa chạy |
| Device Health | Fail-closed theo capability, chưa có contract health | Chưa chạy |
| Alert Center/rules | Đã nối contract Phase C | Chưa chạy |
| Notifications | Tạm hoãn UI Admin; chờ frontend Notifications được push | Chưa chạy |
| IoT Config, Config Proposals | Không hiển thị thao tác ghi giả; chờ device contract | IoT Config smoke đạt; Config Proposals chưa chạy |
| Audit Log | Đã nối cursor/filter thật; chỉ Super Admin được đọc | Chưa chạy |

Sau khi kiểm tra từng trang bằng cả Admin lẫn Super Admin, cập nhật cột browser
và lỗi phát hiện tại `docs/internal-release-notes.md` trước khi chuyển sang Farmer.
