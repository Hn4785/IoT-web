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
- Swagger UI chỉ tồn tại ở development/test: `http://localhost:3000/docs`.
- Success envelope: `{ "success": true, "data": ... }`.
- Error envelope:
  `{ "success": false, "error": { "code": "...", "message": "..." }, "requestId": "..." }`.
- Browser dùng Bearer access token; refresh token chỉ nằm trong cookie
  `HttpOnly` và mọi request refresh/logout phải bật credentials.
- Client Developer gọi `/client/*` bằng `X-API-Key`, không dùng Bearer token của
  portal thay thế API key.
- Frontend không được tự suy ra quyền từ sidebar. Backend quyết định `401`,
  `403` và phạm vi Farm/Station.
- Không fallback sang dữ liệu mẫu khi API lỗi. Chỉ giữ dữ liệu thật đã lưu theo
  đúng trạm/query và quyền hiện tại, cùng timestamp/nhãn cũ; nếu không có thì
  hiển thị loading, empty state hoặc lỗi có nút thử lại. Mất quyền phải purge.
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

### Website và Pi demo

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
- Retry vẫn 401 phải kết thúc đúng phiên; phản hồi restore/logout cũ không được
  ghi đè hoặc xóa phiên mới. Logout chờ server kết thúc trước khi điều hướng.
- Không retry vô hạn các request state-changing.

## 4. Thứ tự tích hợp theo phase

### Phase A - tài khoản và quyền

| Luồng frontend         | Backend contract                                                                                                | Trạng thái                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Login                  | `POST /auth/login`                                                                                              | Đã nối                                                                                          |
| Khôi phục phiên        | `POST /auth/refresh`, `GET /auth/me`                                                                            | Đã nối                                                                                          |
| Logout                 | `POST /auth/logout`                                                                                             | Đã nối                                                                                          |
| Đổi mật khẩu           | `POST /auth/change-password`                                                                                    | Đã nối                                                                                          |
| Danh sách/tạo/sửa user | `GET/POST /admin/users`, `PATCH /admin/users/:id`                                                               | Đã nối                                                                                          |
| Reset mật khẩu         | `POST /admin/users/:id/reset-password`                                                                          | Đã nối                                                                                          |
| Quyền Farm/Station     | `PUT/DELETE /admin/users/:id/farm-memberships/:farmId`, `PUT/DELETE /admin/users/:id/station-grants/:stationId` | Contract backend còn giữ; UI cấp/thu hồi hiện hành ở API Sources, User Management chỉ đọc scope |
| Chuyển Super Admin     | `POST /admin/super-admin/transfer`                                                                              | Đã nối                                                                                          |
| API key                | `/developer/api-keys/*`                                                                                         | Đã nối                                                                                          |

Điều kiện nghiệm thu Phase A trên trình duyệt:

- Ba role vào đúng route và không mở được route role khác.
- User mới bị buộc đổi mật khẩu.
- Super Admin hiện tại không thể tự reset credential.
- Chuyển authority thu hồi phiên cũ và buộc đăng nhập lại.
- Create/rotate secret chỉ hiển thị một lần và thao tác Copy báo kết quả rõ ràng.

### Phase B - Station và dữ liệu đất

| Màn hình                | Contract                                                          | Trạng thái                                      |
| ----------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| Farm -> Plot -> Station | `GET /farms`, `/farms/:id/plots`, `/plots/:id/stations`           | Dùng chung `stationBrowserService`              |
| Soil Dashboard          | `GET /stations/:id/data/latest`, `/history`                       | Đã nối; giữ polling hữu hạn                     |
| Historical Analysis     | `GET /stations/:id/data/history`                                  | Đã nối                                          |
| Farmer Dashboard        | Cùng hierarchy/latest                                             | Đã nối; không fallback dữ liệu mẫu              |
| History Report          | Cùng hierarchy/history                                            | Đã nối; có empty/error và CSV từ dữ liệu đã tải |
| Client API Explorer     | `/client/stations`, `/client/data/latest`, `/client/data/history` | Đã nối bằng `X-API-Key`                         |

Quy tắc dữ liệu:

- Thời gian gửi backend phải là ISO 8601 UTC kết thúc bằng `Z`.
- History raw tối đa 7 ngày; aggregate tối đa 90 ngày.
- Theo `nextCursor`; không tự suy ra tổng số trang.
- `unit`, `sensorId`, `depthCm` có thể `null`. UI không dựng dữ liệu không có từ
  provider.
- Phân biệt `isFromCache`, `isStale`, upstream lỗi và danh sách rỗng.

Trạng thái nghiệm thu dữ liệu thật:

- Bên cung cấp xác nhận ngày 2026-09-28 rằng toàn bộ dữ liệu CENTER/NODE trả qua
  `X-API-Key` đã cấp là dữ liệu cảm biến thật và là đầu vào cuối cùng để nghiệm
  thu. Không lưu API key trong tài liệu, ảnh hoặc log kiểm thử.
- B-device được đánh dấu `live-verified`: API lấy trực tiếp từ các trạm quan trắc
  đang hoạt động, số liệu cập nhật và bên cung cấp xác nhận dữ liệu là dữ liệu
  cảm biến thật. Không cần hỏi lại về dữ liệu thật hay dữ liệu mẫu.
- `live-verified` ở đây xác nhận nguồn dữ liệu. Registry, browser role matrix,
  phân quyền và trạng thái lỗi vẫn phải được kiểm thử theo checklist riêng.

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
4. Các route IoT Config/Config Proposals giữ trạng thái không ghi khi capability
   trả `DEVICE_CONTRACT_PENDING`; không dựng nút publish giả. Theo quyết định bên
   cung cấp ngày 2026-09-28, web chỉ quản lý ngưỡng cảnh báo tại Alert Center,
   còn hiệu chuẩn/can thiệp cảm biến được thực hiện trực tiếp tại hiện trường.
   Reason code hiện tại được giữ để tương thích, không phải cam kết sẽ bổ sung
   remote write.
5. Product owner đã nghiệm thu luồng local Admin/Farmer ngày 2026-09-30. Ma trận
   fixture về mất quyền, stale session/recovery và HTTP/browser local đã được
   kiểm chứng trong release 2026-10-06; provider/receiving-target vẫn là gate riêng.

### Phase D - audit và vận hành

- Admin Audit dùng `GET /admin/audit-events`; chỉ Super Admin được đọc.
- Readiness dành cho hạ tầng, không dùng thay liveness `/health` trên UI.
- Không expose registry metrics process-local ra giao diện khi chưa có contract
  production.
- Device Health, Gateway/Sensor metrics và API Metrics phải hiển thị `N/A` hoặc
  unavailable cho tới khi backend có contract thật; không giữ số mẫu.

## 5. Ánh xạ lỗi sang giao diện

| HTTP/code                  | Hành vi frontend                                                 |
| -------------------------- | ---------------------------------------------------------------- |
| `400 VALIDATION_ERROR`     | Giữ form, chỉ rõ trường/input sai                                |
| `401 UNAUTHENTICATED`      | Thử single-flight refresh một lần; thất bại thì login            |
| `403 FORBIDDEN`            | Trang không có quyền; không giả thành dữ liệu rỗng               |
| `404 NOT_FOUND`            | Resource không tồn tại hoặc ngoài scope; không tiết lộ khác biệt |
| `409 CONFLICT`             | Thông báo dữ liệu/thao tác đã thay đổi, tải lại trạng thái       |
| `429 RATE_LIMITED`         | Khóa gửi lại tạm thời, đọc rate-limit header nếu có              |
| `502 UPSTREAM_UNAVAILABLE` | Giữ dữ liệu cache hợp lệ nếu response cung cấp; cho thử lại      |
| `503 DATABASE_UNAVAILABLE` | Báo dịch vụ tạm thời không sẵn sàng, không xóa session tùy tiện  |

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

## 8. Trạng thái tích hợp hiện tại

Đối chiếu release 2026-10-06 và follow-up CI/docs tại
[release record](../internal-release-notes.md): FE docs `5dbeea53`, web runtime
`aea78f5-arm64`, API runtime `26df9dd`. Các chỉnh docs chuẩn bị bàn giao không đổi
runtime. Nhãn phiên bản docs không phải phiên bản image đang triển khai.

F-data/F-product: `dataOrigin` phân biệt `upstream` và `stored`; `isStale` cùng
timestamp gốc cho biết độ mới. Coverage không đủ phải ghi lịch sử thiếu, không
gọi là đầy đủ chỉ vì request thành công. Latest chỉ được giữ cho đúng station;
history giữ theo đúng station/metric/begin/end/aggregation. 401/403/404 hoặc mất
scope phải xoá phần không còn quyền; lỗi tạm thời không xoá kết quả hợp lệ của
endpoint/trạm khác. API key chỉ hiện secret một lần, phải xác nhận đã lưu trước
khi đóng; không ghi secret vào ảnh/tài liệu. Xem `e2e/real-backend.spec.ts` cho
ma trận HTTP thật với fixture cô lập, không dùng fixture này trên Pi.

Phase B được đánh dấu hoàn tất local ngày 2026-09-30. Điều hướng hiện hành:

- Admin/Super Admin quản lý nguồn và quyền station tại **API Sources**; User
  Management chỉ sửa role và đọc phạm vi đã chia sẻ.
- Farmer dùng Dashboard, Soil Dashboard, Historical Analysis/Report,
  Notifications và Alert Center theo scope backend.
- Client Developer dùng **Dashboard**, **API Access** và **API Tools**. Không có
  sidebar Settings riêng; Change Password và Log out ở menu tài khoản dùng chung.
- Ngưỡng cảnh báo thuộc Alert Center và không điều khiển thiết bị. Các màn hình
  không có contract thật tiếp tục fail-closed, không dựng số liệu hay toggle giả.

Lịch sử phiên bản chỉ ghi tại
[`docs/internal-release-notes.md`](../internal-release-notes.md); checklist backend
chỉ ghi tại [task index nhánh BE](https://github.com/Hn4785/IoT-web/blob/BE/tasks/todo.md).
Raw-history backfill vẫn có giới hạn cửa sổ rỗng; notification mới từ provider,
target/TLS/proxy/backup custody và measured capacity còn chờ bằng chứng bên nhận.
Pi rollout đã được ghi nhận, không còn là công việc chưa triển khai toàn bộ.

## 9. Kiến trúc dữ liệu bền vững để bàn giao

Áp dụng BE `ec02462` và FE `5dbeea53`. Antigravity đối chiếu module/schema/page;
Codex review và rút gọn tại đây. Nội dung này giải thích code hiện hành, không
thay thế controller/contracts/OpenAPI hoặc module specification đã được duyệt.

### API và ranh giới quyền

Browser gọi `/stations/:stationId/data/latest|history` với header Bearer và UUID
station. Cookie refresh không trực tiếp xác thực endpoint station. Client gọi
`/client/stations`, `/client/data/latest|history` bằng `X-API-Key`, chọn `station`
theo code có quyền. Client limiter là cửa sổ phút cố định, process-local theo
key; không phải sliding window/shared limiter. Backend kiểm tra quyền trước cả
đọc bản lưu, không chỉ trước gọi provider.

Tham chiếu source BE đã chốt:
[browser controller](https://github.com/Hn4785/IoT-web/blob/ec02462bdb0050e05778e32c1cd03bfec8d86b29/src/station-data/browser.controller.ts),
[client controller](https://github.com/Hn4785/IoT-web/blob/ec02462bdb0050e05778e32c1cd03bfec8d86b29/src/station-data/client.controller.ts),
[guard](https://github.com/Hn4785/IoT-web/blob/ec02462bdb0050e05778e32c1cd03bfec8d86b29/src/authorization/access-token.guard.ts),
[limiter](https://github.com/Hn4785/IoT-web/blob/ec02462bdb0050e05778e32c1cd03bfec8d86b29/src/station-data/client-rate-limit.guard.ts).

### Database và ERD rút gọn

| Bảng                       | Vai trò và khóa                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `SoilReading`              | Raw; PK `(dataSourceId, stationId, field, observedAt)`                               |
| `SoilLatestReading`        | Snapshot cuối mỗi chỉ số; PK `(dataSourceId, stationId, field)`                      |
| `SoilHistoryCoverage`      | Dải đã thu thập theo chỉ số; PK `(dataSourceId, stationId, field, begin)`            |
| `SoilCollectionCheckpoint` | Watermark/retry/result theo trạm; PK `stationId`, unique `(stationId, dataSourceId)` |

```mermaid
erDiagram
    DataSource ||--o{ Station : cung_cap
    Station ||--o{ SoilReading : raw
    Station ||--o{ SoilLatestReading : snapshot
    Station ||--o{ SoilHistoryCoverage : coverage
    Station ||--o| SoilCollectionCheckpoint : checkpoint
```

Bốn bảng có FK ghép `(stationId, dataSourceId)` tới `Station`. Schema định nghĩa
cascade khi hard-delete station; thao tác Remove Source hiện hành là xóa mềm,
không xóa toàn bộ số đo. Danh sách 13 migration và quan hệ identity/source/alert
đọc từ [schema](https://github.com/Hn4785/IoT-web/blob/ec02462bdb0050e05778e32c1cd03bfec8d86b29/prisma/schema.prisma)
và [migration có thứ tự](https://github.com/Hn4785/IoT-web/tree/ec02462bdb0050e05778e32c1cd03bfec8d86b29/prisma/migrations).
Không tự sửa migration đã phát hành hay nhập DB fixture.

### Thu thập và cách đọc trạng thái

Collector mỗi 120 giây, tối đa 2 trạm đồng thời, batch 20, budget 10 trang;
retry/backoff và lease fencing chặn job cũ ghi sau khi mất lease. Raw giữ tối đa
90 ngày; prune theo lô, snapshot cuối giữ riêng. Trần 2 triệu raw/trạm và 10 triệu
tổng dừng nạp mới khi đạt giới hạn, không xóa sớm dữ liệu còn trong retention.

Dedup dựa khóa nguồn/trạm/chỉ số/thời điểm đo. `lastFetchedAt` chặn thế hệ fetch
cũ ghi đè mới; `fetchedAt` ban đầu giữ khi giá trị không đổi, correction tăng
revision. [Repository](https://github.com/Hn4785/IoT-web/blob/ec02462bdb0050e05778e32c1cd03bfec8d86b29/src/station-data/soil-reading.repository.ts)
và [collector](https://github.com/Hn4785/IoT-web/blob/ec02462bdb0050e05778e32c1cd03bfec8d86b29/src/station-data/soil-collection.service.ts)
là nguồn mô tả thực thi; test tương ứng nằm trong `test/integration/station-data/`.

`dataOrigin` upstream/stored mô tả xuất xứ; `isFromCache` và `isStale` bổ sung
cache/độ cũ. Không hiểu upstream là chắc chắn vừa có HTTP fetch mới. History
coverage có status complete/partial/unknown và `fields[].ranges[]`; chưa có
bằng chứng coverage thì ghi unknown/partial, không dựng đầy đủ từ số điểm.

Mapper latest/history hiện trả `unit: null` khi provider không cung cấp metadata.
Alert metadata có canonical units; card FE có cấu hình đơn vị đã chốt. Hai thứ
này không chứng minh DTO đã có metadata cảm biến/depth/sensor. Thời điểm UTC ở
API; chart theo browser timezone, một số Last fetch/Last Checked theo UTC+7.

Evaluator bỏ qua stored/stale; kiểm tra lại READY, revision/unit/metadata trong
lock trước ghi lifecycle. Backfill không biến thành fresh latest để mở thêm
cảnh báo. [Fresh-binding regression](https://github.com/Hn4785/IoT-web/blob/ec02462bdb0050e05778e32c1cd03bfec8d86b29/test/integration/alert-config/fresh-binding.spec.ts)
và [notification delivery](https://github.com/Hn4785/IoT-web/blob/ec02462bdb0050e05778e32c1cd03bfec8d86b29/test/integration/alert-config/notification-delivery.spec.ts)
không thay bằng chứng notification mới trên provider thật.

P2 còn mở: upstream `data: []` không có station khớp bị `normalizeRawHistory`
từ chối; watermark không tiến qua cửa sổ cũ rỗng. Latest vẫn lưu được nhưng không
thể kết luận raw history đủ 90 ngày. Xem [sổ lỗi](https://github.com/Hn4785/IoT-web/blob/BE/docs/reviews/2026-09-04-backend-follow-up.md)
và [báo cáo bàn giao](../handover/README.md#6-tồn-đọng-và-ghi-chú-bảo-mật).
