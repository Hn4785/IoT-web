# Tích hợp frontend và backend

Tài liệu này mô tả cách frontend gọi API, quản lý phiên và hiển thị dữ liệu theo hợp đồng đang được triển khai. Controller và bộ kiểm tra input của backend là căn cứ cho route, DTO và quyền truy cập. Khai báo TypeScript ở frontend cần theo đúng hợp đồng đó; tên trang hoặc nút trên giao diện không tạo thêm quyền.

## Địa chỉ API và môi trường

API nghiệp vụ dùng prefix `/api/v1`. Cấu hình frontend nằm trong `.env.example`:

```dotenv
VITE_API_BASE_URL=/api/v1
VITE_API_TIMEOUT=10000
```

`VITE_API_BASE_URL` là base URL dùng chung cho các service; `VITE_API_TIMEOUT` tính bằng mili giây. Vite nạp các giá trị này lúc chạy development hoặc build, nên cần build lại khi đổi cấu hình cho bản triển khai. Không đặt token hay API key vào biến môi trường có prefix `VITE_` vì chúng có thể xuất hiện trong mã gửi xuống trình duyệt.

Khi chạy local, Vite proxy `/api/v1/*` đến `http://127.0.0.1:3000`. Có thể đặt `DEV_API_PROXY_TARGET` trên tiến trình Vite để đổi backend đích. Biến này thuộc cấu hình development server, không phải cấu hình frontend trong trình duyệt. Với cấu hình local mặc định, backend dùng `FRONTEND_ORIGIN=http://localhost:5173`.

Trong triển khai, dùng `/api/v1` qua cùng origin với website và để reverse proxy chuyển request đến API. `FRONTEND_ORIGIN` phía backend phải khớp origin thực tế của website, gồm scheme và port nếu có; không dùng wildcard. Cấu hình Nginx và SPA fallback được mô tả trong [triển khai Nginx](DEPLOYMENT-NGINX.md).

Backend chỉ mở Swagger UI `/docs` và OpenAPI `/docs-json` trong development/test. Hai đường dẫn này không nằm dưới `/api/v1`.

## Lớp gọi API và envelope

Luồng thông thường là `Page/Hook → Service → apiClient → Controller`. Route tập trung ở `src/api/endpoints.ts`; service chuyển query/body, đọc envelope và trả DTO cho trang. `developerExplorerService` dùng `fetch` riêng để giữ nguyên status, body và các header giới hạn request cho API Explorer.

Response nghiệp vụ thành công có dạng:

```json
{
  "success": true,
  "data": {}
}
```

Response lỗi có dạng:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body is invalid"
  },
  "requestId": "<request-id>"
}
```

Service đọc `response.data.data`, hoặc gọi `unwrapApiResponse`. Không dùng kiểu phân trang `totalPages` cho các endpoint cursor. Danh sách hierarchy, user, nguồn và thông báo dùng `data.items` cùng `data.nextCursor`; lịch sử đo dùng `data.series` cùng `data.page.nextCursor`.

`GET /api/v1/health` là hợp đồng health công khai riêng. Nó mô tả tình trạng dịch vụ API, không chứng minh cảm biến đang gửi dữ liệu mới hoặc tất cả dependency đã sẵn sàng.

## Xác thực phiên web

`apiClient` bật `withCredentials: true` và gắn `Authorization: Bearer <access-token>` khi có token. Access token chỉ nằm trong memory tại `authStorage`; không được persist vào localStorage hoặc sessionStorage. Reload trang khôi phục phiên bằng `POST /auth/refresh`, sau đó gọi `GET /auth/me`.

Refresh token nằm trong cookie `HttpOnly`, path `/api/v1/auth`, `SameSite=Strict`; backend bật `Secure` trong production. JavaScript không đọc refresh token. Refresh và logout cần giữ credentials để trình duyệt gửi và nhận cookie đúng cách.

Các nguyên tắc đồng thời đang được thực thi:

- Các request nghiệp vụ gặp `401` dùng chung một refresh đang chạy. Request được thử lại tối đa một lần.
- Nếu token đã được request khác làm mới, request dùng token hiện tại để retry, tránh refresh thêm.
- Mỗi request giữ snapshot của phiên gồm `epoch` và token. Response refresh/restore cũ không được ghi token hoặc user vào phiên mới.
- Retry vẫn `401`, hoặc refresh thất bại, chỉ được vô hiệu hóa phiên khớp snapshot. Response của phiên cũ không được đăng xuất phiên mới.
- Logout tăng thế hệ phiên ngay để chặn restore cũ. Luồng chờ request logout kết thúc trước khi hoàn tất trạng thái đăng xuất; backend có cơ hội xóa refresh cookie.

`/auth/login`, `/auth/refresh` và `/auth/logout` không đi vào retry refresh của interceptor. `POST /data-sources/:id/reveal` có ngoại lệ nghiệp vụ riêng: `401 INVALID_CREDENTIALS` nghĩa là mật khẩu xác nhận sai. Giao diện phải giữ phiên và cho nhập lại mật khẩu; không refresh hoặc chuyển về login vì lỗi này.

## Hai hợp đồng truy cập dữ liệu

| Luồng                       | Xác thực            | Cách chọn trạm                | Endpoint dữ liệu                                                        |
| --------------------------- | ------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| Admin/Farmer trong website  | Bearer access token | UUID `stationId` trong path   | `/stations/:stationId/data/latest`, `/stations/:stationId/data/history` |
| Ứng dụng khách/API Explorer | `X-API-Key`         | `station` là code trong query | `/client/data/latest`, `/client/data/history`                           |

Browser lấy hierarchy qua `GET /farms`, `GET /farms/:farmId/plots`, `GET /plots/:plotId/stations` và đọc chi tiết qua `GET /stations/:stationId`. Latest/history browser yêu cầu tài khoản `ACTIVE`, role `ADMIN` hoặc `FARMER`, cùng scope trạm hợp lệ. Cookie refresh không trực tiếp xác thực endpoint trạm.

API khách lấy danh sách qua `GET /client/stations`. Code trạm có 1–64 ký tự, chỉ gồm chữ, số, `_` hoặc `-`. Backend kiểm tra quyền của API key và scope trạm trước khi đọc dữ liệu từ provider hoặc bản lưu. Bearer token của portal không thay thế API key.

`clientApiClient` không dùng `authStorage` hay cơ chế refresh phiên web. API Explorer chỉ gửi `X-API-Key` khi endpoint cần key; `/health` không cần key. Lỗi API key phải được trình bày trong công cụ API, không tự kết thúc phiên portal. Các header `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` và `Retry-After`, khi có, giúp ứng dụng khách quyết định thời điểm gửi lại.

## Query latest và history

`fields` là danh sách phân cách bằng dấu phẩy, không lặp: `temperature`, `moisture`, `ec`, `ph`, `nitrogen`, `phosphorus`, `potassium`, `light`. Khi bỏ `fields`, backend dùng toàn bộ chỉ số được hỗ trợ. Metadata `unit`, `sensorId`, `depthCm` có thể là `null`; không suy ra vị trí cảm biến hoặc độ sâu từ tên chỉ số.

| Tham số history | Quy định backend                                                                 |
| --------------- | -------------------------------------------------------------------------------- |
| `begin`, `end`  | Bắt buộc, ISO 8601 UTC kết thúc bằng `Z`; `end` không trước `begin`              |
| `interval`      | `raw`, `5m`, `30m`, `1h`, `1d`; mặc định `raw`                                   |
| `aggregate`     | `mean`, `min`, `max`, `first`, `last`; cấm với `raw`, bắt buộc với interval khác |
| `order`         | `asc` hoặc `desc`; mặc định `asc`                                                |
| `limit`         | Số nguyên 1–500; mặc định backend 100                                            |
| `cursor`        | Chuỗi opaque dài tối đa 2048 ký tự                                               |
| `station`       | Chỉ dùng cho `/client/data/history`, là code trạm có quyền                       |

Cửa sổ của một request raw tối đa 7 ngày; request aggregate tối đa 90 ngày. Giới hạn cửa sổ query khác với chính sách lưu raw phía backend, hiện là tối đa 90 ngày. Không kết luận đã có đủ 90 ngày dữ liệu chỉ vì hệ thống cấu hình retention 90 ngày.

Ví dụ route, dùng định danh và thời gian do ứng dụng cung cấp:

```text
GET /api/v1/stations/<station-uuid>/data/latest?fields=temperature,moisture
GET /api/v1/stations/<station-uuid>/data/history?fields=moisture&begin=<UTC-ISO>&end=<UTC-ISO>&interval=1h&aggregate=mean&order=asc&limit=500
GET /api/v1/client/data/history?station=<station-code>&fields=moisture&begin=<UTC-ISO>&end=<UTC-ISO>&interval=raw&limit=100
```

Lấy trang tiếp theo bằng cursor backend trả về và giữ nguyên các tham số query khác. Không tự tạo cursor, suy ra tổng số trang hoặc đổi bộ lọc khi dùng cursor cũ. Danh sách hierarchy có `limit` 1–100, mặc định backend 50; service browser chủ động yêu cầu 100 và tải tiếp nếu còn cursor.

## Nguồn dữ liệu, độ mới và coverage

`dataOrigin` phân biệt `upstream` và `stored`. `isFromCache` cho biết API trả từ cache; `isStale` đánh dấu dữ liệu cũ. `observedAt` là thời điểm đo, `fetchedAt` là thời điểm lấy dữ liệu. Chúng có ý nghĩa khác nhau: phản hồi vừa đến trình duyệt không làm số đo trở thành mới. `upstream` cũng không bảo đảm vừa có một HTTP fetch mới nếu cache được dùng.

History có `coverage.status` là `complete`, `partial` hoặc `unknown`, cùng `fields[].ranges[]` mô tả các khoảng đã được thu thập. Phản hồi thành công và số điểm nhiều không đủ để gọi lịch sử là đầy đủ. Nếu còn `page.nextCursor`, kết quả đang hiển thị chỉ là một phần; helper frontend đánh dấu `partial (truncated)`. Khi request lỗi, coverage không được nâng thành `complete` dựa vào kết quả đã giữ.

Frontend có thể giữ lần tải thành công khi lỗi tạm thời: mất mạng/không có status, `408`, `429` hoặc `5xx`. Kết quả giữ lại phải có nhãn cũ và timestamp gốc. Đây là dữ liệu thật đã tải trong phiên, không phải fallback sang dữ liệu mẫu.

- Latest chỉ được giữ nếu DTO khớp chính xác UUID trạm đang yêu cầu và có fields. Chuyển trạm không mang số đo của trạm trước sang trạm mới.
- History chỉ được giữ cho đúng trạm và toàn bộ query: fields đã sắp xếp, begin/end, interval, aggregate, order, limit và cursor. Đổi một thành phần query phải tải lại kết quả tương ứng.
- Response có station ID sai bị từ chối. `401`, `403`, `404`, thay phiên hoặc mất scope phải xóa dữ liệu không còn được phép xem.
- Khóa phạm vi giữ dữ liệu bao gồm môi trường, identity của phiên, role/status, Super Admin và các farm/plot/station/source được chia sẻ. Response đến muộn bị chặn bằng thế hệ request.
- Lỗi tạm thời của một endpoint không chứng minh endpoint khác hoặc trạm khác đã mất quyền. Kết quả empty thành công phải hiển thị empty, không khôi phục dữ liệu cũ để lấp chỗ trống.

CSV history xuất các điểm đã tải, kèm query, nguồn, coverage, trạng thái giữ lại và thời điểm lấy thành công. File xuất không được trình bày như toàn bộ lịch sử nếu còn cursor hoặc coverage chưa đầy đủ.

## API Sources và chia sẻ quyền

Admin và Farmer dùng `/data-sources` để tạo, xem, kiểm tra kết nối và quản lý nguồn theo quyền backend. DTO có `canReadData`, `canManageAccess`, `canRevealKey`; giao diện phải dùng các cờ này thay vì suy từ role.

Admin thường có thể thấy trạng thái kết nối của nguồn người khác nhưng không mặc nhiên có quyền đọc số đo. Khi `canReadData=false`, backend thay tên bằng `API source`, trả `keyPreview`, `stationCount`, `visibleAccountCount` là `null`; DTO vẫn có owner, base URL, trạng thái và thời điểm kiểm tra kết nối. `null` ở đây là trường bị hạn chế quyền, không phải số lượng bằng 0.

Super Admin được đọc dữ liệu nguồn theo quyền đặc biệt, nhưng quyền Reveal key và quản lý chia sẻ vẫn thuộc chủ nguồn. `GET /data-sources/:id/connection-status` trả kiểm tra khả năng kết nối API có giới hạn, có thể từ cache; nó không xác nhận độ mới của số đo hoặc sức khỏe thiết bị.

Chủ nguồn tìm người nhận qua `GET /data-sources/:id/grant-candidates?email=<query>`. Bộ lọc email là chuỗi con không phân biệt hoa thường, dài 3–254 ký tự khi được gửi. Backend chỉ trả tài khoản `ACTIVE` thuộc role `FARMER` hoặc `CLIENT_DEVELOPER`, loại chính chủ nguồn. Quy tắc này cũng áp dụng khi chủ nguồn là Farmer; không giới hạn người nhận vào Farmer cùng farm.

`PUT /data-sources/:id/grants/:userId/stations` nhận `{ "stationIds": [...] }`, gồm 1–100 UUID không lặp. `DELETE /data-sources/:id/grants/:userId` thu hồi chia sẻ nguồn; route `/grants/:userId/stations/:stationId` thu hồi một trạm. Owner là người quản lý chia sẻ; Super Admin không tự có quyền thao tác grant của nguồn người khác.

Reveal dùng `POST /data-sources/:id/reveal` với `currentPassword`; secret không nằm trong response danh sách nguồn. Key tạo/rotate trong API Keys cũng phải được xử lý như secret chỉ hiện khi thao tác tương ứng trả về. Không ghi password, token hay API key vào log, URL, ảnh hoặc tài liệu.

## Các nhóm route nghiệp vụ khác

Mọi đường dẫn trong bảng dưới đây được nối vào base URL `/api/v1`.

| Nhóm              | Route tiêu biểu                                                                                       | Lưu ý tích hợp                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Tài khoản         | `POST /auth/login`, `POST /auth/change-password`, `GET /auth/me`                                      | User trả về được chuẩn hóa trước khi đưa vào store                       |
| User Management   | `GET/POST /admin/users`, `PATCH /admin/users/:id`, `POST /admin/users/:id/reset-password`             | Scope trên trang user là thông tin đọc; chia sẻ nguồn nằm ở API Sources  |
| Authority         | `POST /admin/super-admin/transfer`                                                                    | Tuân thủ quyền và thay đổi phiên do backend quyết định                   |
| API Keys          | `/developer/api-keys`, `/available-stations`, `/:id/rotate`, `/:id/revoke`                            | Quản lý key dùng phiên web; gọi `/client/*` dùng key                     |
| Alert rules       | `GET/POST /stations/:stationId/alert-rules`, `GET/PATCH /alert-rules/:ruleId`                         | Đọc field metadata và `canManageRules` trước khi chỉnh ngưỡng            |
| Alert lifecycle   | `GET /alerts`, `GET /alerts/:id`, `POST /alerts/:id/acknowledgements`, `POST /alerts/:id/resolutions` | Không dùng `PATCH /alerts/:id` để thay lifecycle                         |
| Notifications     | `GET /notifications`, `PATCH /notifications/:id`                                                      | Tải tiếp bằng cursor; dùng contract mark-read                            |
| Audit             | `GET /admin/audit-events`                                                                             | Chỉ Super Admin được đọc                                                 |
| Device capability | `GET /device-configurations/capability`                                                               | Khi capability chưa cho phép ghi, giữ trạng thái không thao tác thiết bị |

Các tên route hiện có trong `endpoints.ts` không tự chứng minh endpoint đã có backend. Device Health, gateway/sensor metrics và API Metrics chỉ hiển thị phần có contract; thông số chưa được backend cung cấp phải là unavailable/N/A. Ngưỡng cảnh báo không phải lệnh điều khiển hay hiệu chuẩn thiết bị.

## Lỗi và cách trình bày

| HTTP/code                            | Hành vi cần giữ                                                           |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `400 VALIDATION_ERROR`               | Giữ input và chỉ rõ điều kiện sai để sửa                                  |
| `401` của phiên web                  | Refresh một lần theo cơ chế phiên; thất bại thì kết thúc đúng phiên       |
| `401 INVALID_CREDENTIALS` của Reveal | Giữ phiên, báo mật khẩu xác nhận sai                                      |
| `401 INVALID_API_KEY`                | Báo lỗi credential API khách; không đăng xuất portal                      |
| `403 FORBIDDEN`                      | Báo không có quyền và xóa dữ liệu thuộc phạm vi bị từ chối                |
| `404 NOT_FOUND`                      | Resource không tồn tại hoặc không được phép thấy; không tiết lộ khác biệt |
| `409 CONFLICT`                       | Báo trạng thái đã thay đổi, yêu cầu tải lại khi phù hợp                   |
| `429`                                | Chờ theo giới hạn và `Retry-After` nếu có; không retry liên tục           |
| `502/503`                            | Báo dịch vụ/provider tạm lỗi; chỉ giữ dữ liệu khi đúng trạm/query/quyền   |

Giữ `requestId` để đối chiếu log backend. Không hiển thị stack trace, raw exception hoặc nội dung có credential.

## Kiểm tra hợp đồng và giới hạn hiện tại

Các test frontend tập trung vào method/path/query/body và hành vi dữ liệu, gồm `stationBrowserService.test.ts`, `dataSourceService.test.ts`, `phaseCServices.test.ts`, `developerExplorer.test.ts`, `apiClientRefresh.test.ts`, `retainedStationData.test.ts`, `retainedHistoryData.test.ts` và `retainedScope.test.ts` trong `test/`. `e2e/real-backend.spec.ts` kiểm tra HTTP với backend bằng fixture cô lập. Không dùng fixture này trên môi trường đang phục vụ người dùng.

Các lệnh kiểm tra chuẩn ở thư mục frontend:

```powershell
npm test
npm run lint
npm run build
```

Contract test không thay thế kiểm tra trình duyệt cho cookie, điều hướng theo role, request thực tế, responsive và trạng thái mất quyền. Khi đổi tích hợp cần kiểm tra phiên mới/hết hạn/logout, dữ liệu empty/stale, mất mạng và scope bị thu hồi. Hướng dẫn trang và quyền nằm trong [hướng dẫn theo vai trò](ROLE-PAGES-GUIDE.md).

Giới hạn P2 hiện tại nằm ở chuẩn hóa raw history phía backend: provider trả `data: []` không chứa bản ghi của trạm được yêu cầu bị coi là `UPSTREAM_INVALID_RESPONSE`, nên collector không thể xác nhận cửa sổ đó đã được duyệt và tiến watermark qua nó. Trường hợp này khác với một bản ghi đúng trạm có `history.soil: []`: đó là cửa sổ rỗng hợp lệ và được `normalizeRawHistory` chấp nhận. Test backend `raw-history.spec.ts` kiểm tra riêng hai trường hợp. Latest vẫn có thể hoạt động trong khi backfill history thiếu; giao diện phải giữ coverage `partial/unknown` tương ứng, không tuyên bố lịch sử đã đầy đủ.
