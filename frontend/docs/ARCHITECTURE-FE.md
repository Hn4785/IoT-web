# Kiến trúc frontend AgriSense

Phiên bản frontend: `3.0.0`. Mốc mã chức năng: FE `7650b6f` ngày 11/10/2026; hợp đồng backend đối chiếu: BE `abd4080`.

Tài liệu này mô tả cấu trúc ứng dụng, vòng đời phiên và cách xử lý dữ liệu trong mã nguồn hiện tại. Các endpoint, quy tắc tích hợp và triển khai được trình bày riêng trong [tích hợp API](INTEGRATION.md) và [triển khai Nginx](DEPLOYMENT-NGINX.md). Danh sách màn hình nằm trong [hướng dẫn vai trò và trang](ROLE-PAGES-GUIDE.md).

## Nền tảng và phạm vi

Frontend là ứng dụng SPA dùng React 19, TypeScript 6 và Vite 8. React Router quản lý URL; Zustand lưu trạng thái đăng nhập; Axios xử lý các nhóm API chính. CSS dùng biến dùng chung và CSS Modules theo component hoặc trang. Biểu đồ được xây dựng trong `src/components/charts`, không có thư viện biểu đồ trong dependencies hiện tại.

Các trang nghiệp vụ gọi backend để lấy dữ liệu và thực hiện thao tác. Backend chịu trách nhiệm kiểm tra quyền, phạm vi tài nguyên và kết nối nguồn dữ liệu. Frontend không kết nối trực tiếp thiết bị IoT hoặc lấy thông tin đăng nhập nguồn để tự thu thập dữ liệu.

Tên màn hình `Realtime Soil Monitoring` chỉ mô tả việc xem số đo mới nhất. Luồng dữ liệu đất hiện tải khi mở trang, đổi lựa chọn hoặc bấm làm mới; không có WebSocket hay SSE trong luồng này.

## Cấu trúc mã nguồn

| Khu vực                                                        | Trách nhiệm                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/main.tsx`, `src/App.tsx`                                  | Khởi tạo React, nạp CSS, phục hồi phiên trước khi hiển thị router.                                      |
| `src/routes/`                                                  | Khai báo đường dẫn, tải trang theo nhu cầu, chặn truy cập và điều hướng theo vai trò.                   |
| `src/pages/auth/`                                              | Đăng nhập, quên mật khẩu, đổi mật khẩu.                                                                 |
| `src/pages/admin/`                                             | Quản lý người dùng, nguồn dữ liệu, thiết bị, cấu hình, cảnh báo và audit.                               |
| `src/pages/farm-owner/`                                        | Theo dõi số đo, phân tích lịch sử, báo cáo, thông báo, cảnh báo và nguồn dữ liệu của farmer.            |
| `src/pages/developer/`                                         | Tổng quan, API key, phạm vi truy cập, tài liệu và API Explorer.                                         |
| `src/components/layout/`                                       | Khung trang, sidebar, topbar, breadcrumb, tiêu đề và tìm trạm.                                          |
| `src/components/common/`, `soil/`, `charts/`, `notifications/` | Thành phần giao diện và trình bày dữ liệu dùng chung.                                                   |
| `src/hooks/`                                                   | Kết nối trạng thái với React; điều phối cây farm → plot → station, nguồn API và các tiện ích nhập liệu. |
| `src/stores/`, `src/auth/`                                     | Phiên đăng nhập, phục hồi phiên, đổi mật khẩu bắt buộc và điều hướng sau đăng nhập.                     |
| `src/services/`, `src/api/`                                    | Hợp đồng gọi API, endpoint và HTTP client.                                                              |
| `src/types/`, `src/utils/`                                     | DTO, mô hình hiển thị, chuẩn hóa lỗi, khóa truy vấn và các hàm xử lý thuần.                             |
| `src/styles/`                                                  | Biến thiết kế và quy tắc CSS toàn cục.                                                                  |
| `test/`, `e2e/`                                                | Test chạy bằng Node và test trình duyệt Playwright.                                                     |

Alias `@` trỏ tới `src` trong cấu hình Vite và TypeScript. `src/data/` vẫn có các tệp dữ liệu từ giao diện trước đây; sự hiện diện của tệp không chứng minh một trang đang dùng dữ liệu thật. Khi sửa trang, cần kiểm tra service được gọi và nguồn dữ liệu thực tế.

## Luồng từ màn hình đến API

```text
Trang / component
    ↓ lựa chọn và thao tác
Hook / bộ điều phối / trạng thái tại trang
    ↓ yêu cầu có trạm, bộ lọc và khóa phạm vi
Service → HTTP client → Backend
    ↑ DTO hoặc lỗi
Chuẩn hóa / kiểm tra phản hồi còn hợp lệ → cập nhật trạng thái → hiển thị
```

Trang giữ trạng thái liên quan tới thao tác hiện tại: bộ lọc, hộp thoại, trạng thái chờ và kết quả. Hook dùng chung cho luồng lặp lại ở nhiều trang. Một số trang gọi service trực tiếp; kiến trúc không yêu cầu mọi request đều phải đi qua hook.

Service định nghĩa tham số và kiểu kết quả theo hợp đồng backend, lấy dữ liệu bên trong envelope `{ success: true, data }`. Các factory như `createStationBrowserService(client)` cho phép test service bằng HTTP client thay thế mà không gọi mạng. Service không tự suy diễn quyền từ sidebar hoặc role route.

[HTTP client dashboard](../src/api/apiClient.ts) gắn Bearer token và xử lý refresh. [HTTP client developer](../src/api/clientApiClient.ts) nhận `X-API-Key` rõ ràng từ request, không lấy Bearer token của dashboard. API Explorer dùng `fetch` trong service riêng để hiển thị status, body và các header rate limit được chọn; không đi qua interceptor refresh của Axios.

`VITE_API_BASE_URL` mặc định là `/api/v1`; timeout Axios mặc định là `10000` ms. Đây là cấu hình build frontend trong `src/config/env.ts`. Proxy phát triển và reverse proxy triển khai là hai lớp khác nhau; xem tài liệu triển khai để cấu hình đúng môi trường.

## Định tuyến và quyền truy cập

[Khai báo route](../src/routes/routeConfig.tsx) là nguồn đối chiếu đường dẫn. Trang được import bằng `React.lazy` và bọc trong `Suspense` để tải mã khi cần.

`ProtectedRoute` kiểm tra phiên, chuyển người chưa đăng nhập về `/login`, lưu đường dẫn yêu cầu trong router state và ép tài khoản `PENDING_PASSWORD_CHANGE` vào `/change-password`. `RoleRoute` kiểm tra ba vai trò `ADMIN`, `FARMER`, `CLIENT_DEVELOPER`; người sai vai trò được chuyển tới `/unauthorized`.

Sau đăng nhập, đường dẫn quay lại chỉ được chấp nhận trong nhóm URL của vai trò tương ứng. Đường dẫn có thành phần không hợp lệ bị thay bằng trang mặc định của vai trò. Các URL developer cũ được giữ dưới dạng redirect tới nhóm `/developer/api-access/*` và `/developer/api-tools/*`.

Route và menu quyết định cách điều hướng trong giao diện. Quyền gọi API vẫn do backend xác nhận, kể cả khi người dùng tự nhập URL, mã trạm hoặc sửa request. `isSuperAdmin` là thuộc tính quyền của người dùng, không phải vai trò route thứ tư. Trang hoặc nút được hiển thị cũng không bảo đảm thao tác sẽ được backend cho phép.

## Vòng đời đăng nhập

[Auth store](../src/stores/authStore.ts) là store Zustand chính, giữ `user`, `isAuthenticated` và `isLoading`. Access token nằm trong biến bộ nhớ của `authStorage`; frontend hiện không lưu token vào `localStorage` hay `sessionStorage`.

1. Khi khởi động, `App` gọi `restoreSession`. Giao diện router chờ quá trình này kết thúc.
2. Phục hồi phiên gọi `/auth/refresh`, sau đó `/auth/me`; người dùng từ backend được chuẩn hóa trước khi đưa vào store. Request dashboard gửi cookie qua `withCredentials: true`; backend quản lý refresh cookie.
3. Các lần phục hồi đồng thời dùng chung một Promise. Interceptor có một cơ chế dùng chung request refresh riêng để nhiều request bị `401` không tạo nhiều lần refresh đồng thời.
4. Request nghiệp vụ được gửi lại tối đa một lần sau `401`. Nếu token đã được thay mới trong cùng phiên, request dùng token hiện tại. Nếu refresh thất bại hoặc lần gửi lại vẫn bị `401`, phiên bị vô hiệu hóa theo snapshot phù hợp.
5. Khi logout, store đánh dấu phiên đang kết thúc ngay, chờ request logout xóa cookie phía server rồi mới hoàn tất việc xóa trạng thái phiên.

[Session snapshot](../src/auth/sessionInvalidation.ts) gồm số thế hệ phiên (`epoch`) và token tại thời điểm gửi request. Refresh hoặc phục hồi từ phiên cũ không được ghi đè token mới, cũng không được xóa phiên của lần đăng nhập sau. Đây là điều kiện quan trọng khi logout, đăng nhập lại hoặc nhiều request hoàn tất khác thứ tự.

Các request `/auth/login`, `/auth/refresh`, `/auth/logout` không đi qua nhánh tự refresh khi bị `401`. Riêng lỗi `INVALID_CREDENTIALS` từ `/data-sources/:id/reveal` là lỗi xác nhận mật khẩu; interceptor trả lỗi để trang xử lý và giữ phiên đang hợp lệ.

## Phạm vi màn hình và kết quả bất đồng bộ

[MainLayout](../src/components/layout/MainLayout.tsx) gắn khóa cho phần nội dung bằng `retainedViewKey`. Khóa gồm môi trường API, danh tính đối tượng user trong bộ nhớ, ID, role, status, `isSuperAdmin`, assignment và nguồn được chia sẻ. Khi khóa đổi, phần nội dung được tạo lại để trạng thái và dữ liệu giữ tại trang không đi sang phiên hoặc phạm vi mới. Sidebar và topbar nằm ngoài phần nội dung có khóa này.

`useStationHierarchy` tải cây farm → plot → station từ backend. Khóa cây dùng ID người dùng, role, assignment và API base URL. Bộ điều phối trong `stationHierarchyState.ts`:

- Xóa lựa chọn con ngay khi đổi farm hoặc plot; chỉ chọn ID có trong danh sách hiện tại.
- Kiểm tra plot thuộc farm và station thuộc farm/plot đang yêu cầu.
- Loại kết quả của request cũ theo số request, khóa phạm vi và trạng thái đã dispose.
- Đọc cursor tới hết với giới hạn mặc định 10 trang cho mỗi lần tải danh sách; báo lỗi nếu cursor lặp hoặc vượt giới hạn.

Các trang dữ liệu đất không gộp tất cả request thành một kết quả thành công/thất bại duy nhất. Ví dụ dashboard tải số đo mới nhất và cảnh báo độc lập; chi tiết trạm tải metadata và số đo độc lập. Mỗi phần có trạng thái chờ, lỗi và kết quả riêng, nên số đo thành công có thể hiển thị trong khi request còn lại vẫn chờ.

Kết quả được áp dụng khi trạm và số lần làm mới còn khớp. Đổi trạm, đổi bộ lọc, rời trang hoặc đổi phạm vi sẽ làm kết quả cũ không còn hợp lệ. Chi tiết trạm còn kiểm tra ID trong metadata và DTO số đo trước khi hiển thị.

## Dữ liệu giữ lại và nguồn gốc

[Xử lý số đo giữ lại](../src/utils/retainedStationData.ts) chỉ giữ bản đọc có dữ liệu của đúng trạm khi làm mới hoặc gặp lỗi tạm thời: lỗi mạng không có HTTP status, `408`, `429` hoặc lỗi server. Giao diện đánh dấu `Last known`/`Stale` và giữ thời điểm lấy dữ liệu cũ; dữ liệu này không trở thành một lần lấy mới thành công.

`401`, `403`, `404` ở luồng trạm làm mất hiệu lực dữ liệu số đo và phần liên quan. ID trạm trong phản hồi không khớp cũng làm dữ liệu bị loại. Kết quả thành công nhưng `fields` rỗng được hiển thị là rỗng và xóa bản dự phòng, không phục hồi số đo cũ để lấp chỗ trống.

[Xử lý lịch sử](../src/utils/retainedHistoryData.ts) dùng khóa gồm `stationId`, các field đã sắp xếp, `begin`, `end`, `interval`, `aggregate`, `order`, `limit`, `cursor`. Bản lịch sử chỉ được giữ lại khi đúng trạm và khớp toàn bộ khóa của lần thành công trước. Đổi khoảng thời gian hoặc cách tổng hợp không được mượn kết quả của truy vấn khác.

Trong phân tích nhiều trạm, mỗi trạm có số request riêng và cùng chịu một thế hệ truy vấn. Có thể thử lại từng trạm; lỗi một trạm không xóa kết quả hợp lệ của trạm khác. Dữ liệu giữ lại nằm trong trạng thái màn hình, không phải kho lưu trữ ngoại tuyến.

Frontend giữ ý nghĩa của metadata backend:

| Thông tin                     | Ý nghĩa khi trình bày                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `observedAt`                  | Thời điểm đo; dùng cho điểm biểu đồ và tuổi số đo.                                                                       |
| `fetchedAt`                   | Thời điểm lấy dữ liệu; không thay cho thời điểm đo.                                                                      |
| `isFromCache`, `isStale`      | Trạng thái cache và độ mới do backend trả về.                                                                            |
| `dataOrigin`                  | Nguồn `upstream` hoặc dữ liệu `stored` khi trường này có mặt.                                                            |
| Dữ liệu giữ ở màn hình        | Ghi riêng là `browser retained`/`Last known`; không gán là dữ liệu upstream mới.                                         |
| `coverage`, `page.nextCursor` | Độ bao phủ lịch sử; còn cursor thì kết quả đang hiển thị là một phần. Khi lấy lỗi, độ bao phủ hiện tại là chưa xác định. |

Biểu đồ lịch sử chèn khoảng trống giữa các bucket bị thiếu để tránh nối thành đường liên tục. CSV xuất dữ liệu đang có và kèm thông tin truy vấn, nguồn, độ bao phủ, trạng thái giữ lại; xuất CSV không đồng nghĩa đã tải toàn bộ lịch sử backend.

## DTO và mô hình hiển thị

Các kiểu TypeScript giúp kiểm tra khi build, nhưng không thay thế kiểm tra dữ liệu tại runtime hoặc hợp đồng backend. Không bổ sung trường DTO chỉ để một màn hình có dữ liệu hiển thị.

[Chuẩn hóa người dùng](../src/services/normalizeBackendUser.ts) chuyển `assignments.farmIds` và `assignments.stationIds` thành các mảng UI, đặt `assignedPlotIds` thành mảng rỗng và giữ `sharedSources` từ backend. Mảng rỗng ở lớp chuẩn hóa không có nghĩa tài khoản được quyền truy cập toàn bộ tài nguyên.

DTO số đo trong `src/types/soil.ts` giữ giá trị, đơn vị, chất lượng, sensor, độ sâu và thời gian quan sát. `adaptLatestSoilData` tạo mô hình hiển thị theo field, giữ metadata và đánh dấu stale khi dùng bản giữ lại. Field không có trong DTO không được thay bằng `0`, dữ liệu mẫu hoặc số đo của trạm khác. Adapter theo field dùng giá trị cuối nếu DTO có nhiều bản ghi cùng field; màn hình cần phân biệt sensor/độ sâu phải dùng cấu trúc DTO phù hợp.

`normalizeApiError` đọc thông điệp và mã từ envelope lỗi backend, giữ HTTP status để các luồng phân biệt lỗi tạm thời với mất quyền. Không có hợp đồng cho một chức năng thì trang thể hiện trạng thái chưa có dữ liệu; ví dụ API Metrics hiện không có số liệu sử dụng theo tài khoản.

## Kiểm chứng và giới hạn

Các lệnh từ [package.json](../package.json):

| Lệnh               | Phạm vi                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`         | Chạy `test/*.test.ts` bằng Node với `--experimental-strip-types`. Gồm test hàm thuần, service/client thay thế và kiểm tra cấu trúc mã nguồn. |
| `npm run lint`     | Chạy Oxlint.                                                                                                                                 |
| `npm run build`    | Chạy `tsc -b` rồi Vite build; tạo tài nguyên tĩnh trong `dist/`.                                                                             |
| `npm run test:e2e` | Chạy Playwright theo cấu hình repository; cần chuẩn bị trình duyệt và môi trường test.                                                       |

Test phiên bao phủ refresh đồng thời, request gửi lại, logout/phục hồi và phản hồi muộn từ phiên cũ. Test phạm vi và dữ liệu giữ lại bao phủ khớp trạm, khớp truy vấn, mất quyền và kết quả rỗng. Một số test giao diện chỉ đọc nội dung tệp hoặc kiểm tra hàm trình bày; chúng không chứng minh bố cục hay tương tác trong trình duyệt.

Playwright cấu hình Chromium với viewport desktop `1440×900` và mobile `390×844`. Các suite smoke/source access/source privacy dùng API giả lập. Suite `real-backend.spec.ts` chỉ chạy khi có `QA_REAL_API=true` và mật khẩu fixture đã chuẩn bị; chạy suite đó có thể thực hiện thao tác trên dữ liệu fixture, nên cần môi trường kiểm thử riêng.

CI chạy unit test, lint, build, các suite E2E giả lập và audit dependencies. Cấu hình CI hoặc một lần build thành công không xác nhận bản đang triển khai, kết nối thiết bị thật hay quyền truy cập production. Kết luận về trình duyệt, API thật và triển khai phải có bằng chứng tương ứng.
