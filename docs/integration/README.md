# Hướng dẫn nối Frontend - Backend

Tài liệu này là đầu mối triển khai tích hợp giữa frontend tại `D:/IoT-web` và
backend checkout đang dùng tại `D:/IoT-api`. Không đổi tên route hoặc tự dựng DTO
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
VITE_API_BASE_URL=/api/v1
```

Trong chế độ Vite local, `/api/v1/*` được proxy tới
`http://127.0.0.1:3000`; không cần tạo `.env` nếu dùng mặc định. Backend cần
đang chạy ở cổng 3000. Chỉ đặt `DEV_API_PROXY_TARGET` trên tiến trình Vite khi
backend local chạy tại địa chỉ khác.

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
3. `notificationService` và UI Notifications dùng cursor/unread/mark-read
   contract thật; inbox Farmer đã có tải trang tiếp theo bằng `nextCursor`.
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
cd D:\IoT-api
docker compose up -d postgres
pnpm db:status
pnpm test
pnpm verify

# Frontend
cd D:\IoT-web
npm test
npm run lint
npm run build
```

Sau gate tĩnh, chạy browser matrix cho Admin, Farmer và Client Developer trên:

- màn hình desktop;
- chiều rộng khoảng 390 px;
- phiên mới, phiên hết hạn và logout;
- upstream/database hoạt động và tạm mất kết nối.

## 8. Thứ tự hoàn thiện hiện tại

1. Admin/Super Admin đã được người dùng chấp nhận với đủ 6 station; các chức
   năng không có device contract tiếp tục fail-closed.
2. Hoàn tất Farmer theo thứ tự Dashboard → Soil Dashboard → Historical Analysis
   → History Report → Notifications → Alerts/Alert Center. Việc còn lại là chuẩn
   hóa giao diện và browser matrix cho scope, mất quyền, stale/cache và lỗi upstream.
3. Chỉ sau khi người dùng kiểm tra Farmer mới chuyển sang Client Developer: API
   Keys → Permissions → Docs → Explorer → Metrics khi có contract.
4. Sau ba role, chạy browser matrix liên role và QA recovery; production vẫn cần
   TLS/proxy, shared limiter, backup ngoài máy, MFA và live-device evidence.

Trạng thái phiên bản và lỗi còn mở chỉ ghi tại
[`docs/internal-release-notes.md`](../internal-release-notes.md); checklist backend
chỉ ghi tại `D:/IoT-api/tasks/todo.md`.

## 9. Kế hoạch rút gọn trang và Settings

Không thêm route cấp cao mới trước khi xử lý các trang đang trùng nhiệm vụ. Việc
gộp trang phải giữ nguyên API contract, role guard và redirect từ URL cũ trong ít
nhất một phiên bản để không làm hỏng bookmark.

| Role      | Trang hiện tại                                                          | Đích đề xuất                                                                                              |
| --------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Farmer    | `Alerts`, `Alert Center`                                                | Một trang **Cảnh báo** với tab `Đang hoạt động`, `Lịch sử`, `Quy tắc`; action vẫn phụ thuộc quyền backend |
| Farmer    | `Historical Analysis`, `History Report`                                 | Một trang **Lịch sử & Báo cáo** gồm biểu đồ, bảng, bộ lọc và xuất CSV                                     |
| Farmer    | `Dashboard`, `Soil Dashboard`                                           | Giữ riêng nhưng đổi nhãn rõ thành **Tổng quan** và **Theo dõi đất**                                       |
| Farmer    | `Notifications`                                                         | Giữ thành **Hộp thông báo**; đây không phải trang Settings                                                |
| Admin     | `Stations & Devices`, `Device Health`, `IoT Config`, `Config Proposals` | Một khu vực **Trạm & Thiết bị** dùng tab; tab chưa có device contract phải ẩn hoặc fail-closed            |
| Developer | `API Keys`, `API Permissions`                                           | Một trang **API Access** với tab `Keys` và `Phạm vi truy cập`                                             |
| Developer | `API Docs`, `API Explorer`                                              | Một trang **API Tools** với tab `Tài liệu` và `Thử API`                                                   |
| Developer | `API Metrics`                                                           | Ẩn khỏi navigation tới khi backend có usage/latency/quota contract thật                                   |

Trang `/settings` dùng chung chỉ được chứa chức năng có nguồn dữ liệu rõ ràng:

- Có thể làm với contract hiện tại: xem thông tin tài khoản, đổi mật khẩu và
  đăng xuất. Ngôn ngữ, múi giờ hoặc theme chỉ được lưu local nếu sản phẩm thực sự
  cần và phải ghi rõ đây là tùy chọn trên thiết bị hiện tại.
- Chưa được dựng toggle giả: Email/SMS/Push, thời gian lưu thông báo, quản lý
  phiên trên thiết bị khác, usage quota và cấu hình ghi xuống thiết bị.
- Ngưỡng, số mẫu vi phạm/phục hồi và tần suất nhắc lại thuộc **Quy tắc cảnh
  báo**, không thuộc Settings chung. `cooldown`/`repeatInterval` hiện chưa có
  contract; phải cập nhật spec và backend trước khi thêm control frontend.
- User/Farm/Station assignment tiếp tục thuộc **Người dùng & Phân quyền**; audit
  tiếp tục chỉ hiện cho Super Admin, không chuyển vào Settings.

Thứ tự thực hiện UI: chốt route map → gộp hai cặp Farmer → gom khu vực Admin →
gom Developer → bổ sung Settings tối thiểu → chạy lại browser matrix ba role ở
desktop và mobile. Không chỉnh visual sâu trước khi navigation mới được duyệt.
