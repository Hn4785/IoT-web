# Internal change record

Đây là đầu mối duy nhất để ghi cập nhật phiên bản của toàn dự án frontend,
backend và Pi. Mỗi thay đổi phát hành phải được ghi vào đúng mục phiên bản trong
file này trước khi tạo checkpoint hoặc triển khai.

## Quy tắc cập nhật

Với mỗi thay đổi:

1. Ghi ngắn gọn nội dung, lý do và phạm vi ảnh hưởng.
2. Kiểm tra các luồng cũ có liên quan: API contract, quyền truy cập, điều hướng, trạng thái đăng nhập và giao diện dùng chung.
3. Ghi rõ kết quả test; không đánh dấu hoàn thành nếu chưa có bằng chứng kiểm tra.
4. Không ghi secret, mật khẩu, access token, refresh token hoặc API key vào file này.

## F-product local — 2026-10-05 (chưa push GitHub/Pi)

- F7: latest/history/alerts tải độc lập; giữ last-known đúng trạm khi lỗi tạm thời,
  giữ timestamp gốc, phân biệt Stored/Last known/Empty. Chặn dữ liệu route cũ,
  phản hồi trễ và tái hiển thị sau khi quan sát 401/403/404 hoặc response sai trạm.
- F9: scope gắn account/session/role/environment; refresh lại cả Farm/Plot/Station
  dù ID cha không đổi. Chặn pagination/request cũ, sai parent, và giữ lựa chọn
  hợp lệ khi refresh chồng nhau. Không đổi luồng đăng nhập hay quyền backend.
- F8: giữ lịch sử theo đúng trạm và toàn bộ query, kể cả begin/end thực tế;
  tải/retry từng trạm, không làm mất chuỗi thành công khi trạm khác lỗi hoặc mất quyền.
  Phân biệt Upstream/Cache/Stored/Last known và coverage đủ/thiếu/chưa xác nhận;
  giữ thời điểm fetch gốc, khoảng trống biểu đồ và metadata nguồn trong CSV.
- Frontend local: 218/218 tests, lint và TypeScript/production build đạt.
  Browser fixture cách ly xác nhận online/stored/empty/denied, endpoint phụ lỗi,
  đổi trạm với metadata chậm, phiên mới không dùng fallback cũ và refresh bỏ trạm
  bị thu hồi quyền; StrictMode không mắc kẹt loading. Không gọi provider/DB/Pi.
  Analysis giữ chuỗi A khi B lỗi/bị thu hồi; đổi khoảng/metric không giữ kết quả
  query cũ. Report giữ cùng-query khi Apply gặp lỗi tạm thời; rỗng/mất quyền xoá
  fallback. Admin/Super Admin/Farmer/Developer đã kiểm tra trạng thái dữ liệu
  theo trang trong phạm vi F-product; không thay thế E2E đăng nhập/quản lý quyền.
- Backend F10: 89 file/557 tests và `pnpm verify` đạt; commit local `236aa4e`.
  Stored/backfill không đánh giá như live; rule binding được kiểm lại trong lock;
  restart/overlap/correction không nhân đôi lifecycle/notification.
- Bản vá dependency local `6f5a9e2` phải đi cùng đợt push cuối:
  `brace-expansion 5.0.12`, Nest Fastify `12.0.3`, Fastify `5.12.5`.
  Chạy lại `pnpm audit --prod --audit-level=high` không còn advisory.
  CI GitHub còn dùng bản chưa nhận commit này; không bỏ/hạ gate audit để làm xanh.
- F7-F10 và Checkpoint F-product hoàn thành local theo phạm vi trên.
  FE-2/FE-5/FE-6/QA-1/F16 và target production giữ riêng; test fixture không phải
  E2E đăng nhập hay API thật. Nội dung CSV đã test; tải file qua browser thật còn
  thuộc F16, không coi lần thử download không xác nhận được là bằng chứng đạt.
  Chỉ commit local. Không chuyển fixture, database test, seed hay dữ liệu mẫu.

## F-data Pi test — 2026-10-05 (lưu lịch sử 90 ngày)

- Chủ dự án duyệt triển khai riêng logic F-data lên Pi để test: lưu số đo thật
  trong 90 ngày, giữ snapshot cuối và thu thập nền khi không mở trình duyệt.
- Chỉ chuyển code và migration cấu trúc. Giữ database/nguồn/quyền hiện có;
  không seed, không nhập dữ liệu mẫu, không restore database test lên Pi.
- Frontend giữ code `089a116`; F7 chưa triển khai. Các cập nhật D/F/FE còn lại
  sẽ push chung sau khi hoàn tất kiểm thử, với commit và bằng chứng riêng.
  Đây là trạng thái triển khai Pi lúc phát hành, không phủ định kết quả F7 local ở trên.
- Phát hành: BE `de466ea` (`feat: retain 90-day soil history`) đã push vào
  nhánh `BE` và chạy trên Pi. Nhánh GitHub phát hành thử đã xoá theo yêu cầu;
  code được giữ trên `BE`. FE vẫn `089a116`, không thay giao diện lần này.
- Kiểm chứng: logic tương ứng qua 534/534 test (86 file), typecheck/lint/build
  và secret scan; Pi ARM64 healthy/readiness, 13 migration đã áp dụng. Đã backup
  database Pi trước migration; số lượng user/farm/plot/station/source/key không đổi.
- Bộ thu thập nền đã ghi số đo `latest` thật; không nhập database local, seed,
  fixture hay dữ liệu mẫu. Farm demo vẫn bằng 0. Backfill raw history ghi nhận
  `invalid` do cửa sổ cũ trả `data: []`; checkpoint chưa đi tiếp và chưa có coverage
  được xác nhận. Đã note lỗi backfill trong review F-data ngày 2026-10-05; không coi biểu đồ/cache hiện có
  là bằng chứng đã lưu đầy đủ lịch sử 90 ngày.
- Mọi đợt F/FE tiếp theo chỉ phát hành logic đã kiểm thử, không chuyển dữ liệu
  mẫu/test database sang Pi hoặc server. D/F/FE còn lại push chung sau kiểm thử;
  không đánh dấu F7 đã triển khai Pi hoặc gate production đã hoàn tất.

## v2.5.6 — 2026-10-05 (API Sources tự kiểm tra)

- API Sources tự kiểm tra kết nối khi vào trang và khi bấm Refresh, áp dụng cho
  chủ nguồn và Farmer được share. Phân biệt đang kiểm tra, lỗi kết nối và chưa
  xác minh được; không dùng trạng thái Connected cũ khi kiểm tra thất bại.
- Thêm endpoint `GET /data-sources/:sourceId/connection-status`, dùng credential
  đã mã hoá ở backend và quyền xem hiện có. Cache tối đa 30 giây, gộp request
  trùng và giới hạn đồng thời; không nhập lại station hay mở quyền quản lý nguồn.
- Rút gọn mô tả History & Report, bỏ ký tự Z trên mô tả; bộ lọc vẫn dùng UTC.
- Kiểm chứng: frontend 181/181, backend 427/427; lint, typecheck, build và secret
  scan đạt. Browser fixture cách ly xác nhận Refresh, offline/phục hồi, lỗi kiểm
  tra và viewport 520px không tràn ngang. Fixture không ghi dữ liệu giả vào ứng dụng/Pi.
- Format của các file backend đã sửa đạt; `pnpm verify` toàn repo còn bị chặn bởi
  4 file cũ chưa đúng Prettier, đã xác nhận lỗi tồn tại trong HEAD trước thay đổi.
- Đã push GitHub: BE `6262e80`, FE `089a116`; Pi chạy đúng hai image này và
  web/API/readiness healthy, checksum artifact/index/assets khớp. Endpoint mới
  vẫn trả 401 khi chưa đăng nhập. Không có migration/dependency mới.
- Backup database/Compose và image cũ `agrisense-api:d152337`,
  `agrisense-web:e03b23f` được giữ để rollback; PostgreSQL/ngrok không restart.

## v2.5.6 — 2026-10-04 (biểu đồ và Notifications)

- Căn lại Soil Dashboard, Historical Analysis, History & Report và Notifications;
  giữ bố cục chính, bộ lọc, quyền truy cập và luồng xuất CSV hiện có.
- Biểu đồ có trục số/thời gian và đơn vị rõ hơn, tooltip đọc được bằng bàn phím,
  giảm chấm dày và giới hạn chiều cao. Các chuỗi so sánh và NPK dùng chung thang
  đo/thời gian, giữ khoảng trống khi thiếu mẫu và vẫn hiển thị điểm đơn lẻ.
- Phân biệt chất lượng dữ liệu với đánh giá đất; bỏ ngưỡng khuyến nghị cố định và
  cảnh báo suy diễn từ giá trị thấp nhất. Ngưỡng cảnh báo vẫn do Alert Center quản lý.
  Giải thích dữ liệu trung bình giờ/ngày, mốc UTC của bộ lọc và giờ địa phương trên trục.
- Notifications rõ trạng thái đã đọc/chưa đọc, mức độ, rỗng và lỗi tải; không thêm SMS/email.
- Codex review độc lập và chạy 178/178 test, lint, TypeScript/build và diff check đều đạt.
  Browser QA dùng fixture cách ly ở viewport 1440px/520px: kiểm tra so sánh trạm,
  Line/Area, tooltip, đổi chỉ số, điểm đơn lẻ, rỗng/lỗi và không tràn ngang.
  Không ghi dữ liệu giả vào ứng dụng/database; chưa xác nhận tải file CSV trong browser QA.
- Chỉ sửa frontend; không đổi API, authentication, database, tích hợp hay điều khiển thiết bị.
- Đã push nhánh `FE` lên GitHub tại code commit `e03b23f` và triển khai image
  `agrisense-web:e03b23f` trên Pi. Build dùng API cùng origin `/api/v1`, không nạp dotenv.
  Archive SHA-256: `0c3e8e0300630372c1be74fdb23e3838f453336241181f93b24d8a39801b323d`.
- Web healthy, API health qua web proxy healthy; hash `/login` và các entry JS/CSS
  khớp artifact. ID/thời điểm khởi động API và PostgreSQL không đổi sau rollout.
  Giữ image `agrisense-web:be73c29` và Compose trước rollout để rollback.
  Đây là bản Pi test nội bộ, không phải checkpoint production-ready hay role E2E mới.

## Phase B Pi staging deployment — 2026-09-30

- Đã triển khai backend commit `d152337` bằng image
  `agrisense-api:d152337` và frontend commit `be73c29` bằng image
  `agrisense-web:be73c29` trên Pi ARM64. Hai container cùng PostgreSQL đều
  healthy; ngrok tiếp tục hoạt động.
- Đã tạo backup database và Compose trước rollout. Toàn bộ 11 migration local
  khớp 11 migration đã hoàn tất trên Pi nên không có migration mới cần chạy.
- Theo quyết định đã chốt, đã xoá hierarchy `Farm Demo` trên Pi trong một
  transaction: 2 plot demo, 12 station trùng, 1 membership, 1 client grant và
  3 API-key scopes. Hai source đã removed và audit evidence được giữ lại; kiểm
  tra sau xoá cho Farm/Plot demo đều bằng 0.
- Frontend build thành công trước khi đóng image. Sau rollout, LAN và public
  tunnel trả HTTP 200 cho web health, API health và readiness; `/login` trả 200,
  endpoint audit không xác thực trả 401, API chạy bằng non-root user `node`.
- Rollback giữ nguyên image `agrisense-api:v2.5.6`,
  `agrisense-web:v2.5.6` cùng backup trước rollout.

## Quyết định phạm vi — 2026-09-28 (IoT Config và can thiệp thiết bị)

### Quyết định từ bên cung cấp

- Web chỉ quản lý quy tắc/ngưỡng cảnh báo dựa trên dữ liệu thật từ
  CENTER/NODE. Thay đổi ngưỡng thực hiện tại Alert Center và không được mô tả
  như một cấu hình gửi xuống cảm biến.
- Không triển khai gửi cấu hình, hiệu chuẩn, rollback hoặc lệnh điều khiển từ web
  xuống CENTER/NODE trong phạm vi hiện tại. Khi cần hiệu chuẩn hay can thiệp cảm
  biến, kỹ thuật viên xử lý trực tiếp tại hiện trường.
- `IoT Config` và `Config Proposals` không còn là tính năng đang chờ hardware
  contract. Trong bước giao diện tối thiểu, các route cũ chỉ được giải thích
  ranh giới này và điều hướng người dùng sang Alert Center; không có nút ghi
  thiết bị. Có thể ẩn/gỡ chúng khỏi navigation trong lần gom trang sau.

### Xác nhận nguồn dữ liệu thật

- Bên cung cấp xác nhận ngày 2026-09-28 rằng toàn bộ dữ liệu CENTER/NODE trả qua
  `X-API-Key` đã cấp là dữ liệu cảm biến thật và là đầu vào cuối cùng để nghiệm
  thu. Xác nhận này đóng câu hỏi về nguồn dữ liệu, không cần hỏi lại.
- B-device được đánh dấu `live-verified` vì API lấy trực tiếp từ các trạm quan
  trắc đang hoạt động, số liệu cập nhật và bên cung cấp xác nhận dữ liệu là dữ
  liệu cảm biến thật. Trạng thái này chỉ xác nhận nguồn dữ liệu; registry,
  browser role matrix và production vẫn là checkpoint riêng. Bằng chứng không
  được chứa API key.

### Phạm vi thay đổi lần này

- Chỉ cập nhật tài liệu và TODO để thống nhất quyết định sản phẩm; chưa đổi route,
  API, DTO, database hoặc hành vi runtime.
- Backend vẫn trả `NOT_AVAILABLE / DEVICE_CONTRACT_PENDING` cho route capability
  hiện có nhằm giữ tương thích. Mã reason cũ không còn được hiểu là cam kết sẽ
  triển khai remote write.
- Không cần chạy lại test/build vì không có mã nguồn hoặc cấu hình runtime thay
  đổi; đã kiểm tra diff và tính nhất quán giữa tài liệu frontend/backend.

## v2.5.6 — 2026-09-29 (API Source status recovery)

### Đã sửa và cập nhật

- Một nguồn managed từng bị đánh dấu `FAILED` nay tự chuyển lại `CONNECTED` sau
  khi backend đọc latest hoặc history thành công từ đúng upstream. Dữ liệu trả
  từ cache không tự thay đổi trạng thái, nên badge chỉ phục hồi khi có bằng chứng
  kết nối thật.
- API Sources đổi nhãn lỗi thành `Last check failed` và hiển thị thời điểm
  `Last Checked`, tránh diễn đạt một lần probe lỗi như trạng thái ngừng hoạt động
  vĩnh viễn.
- Đồng bộ nhãn health, OpenAPI, frontend và image phát hành thành `2.5.6`.

### Bằng chứng kiểm tra

- Test tích hợp tái hiện nguồn `FAILED`, đọc telemetry thật thành công và xác
  nhận database tự phục hồi thành `CONNECTED`.
- Frontend đạt 87/87 test, production build và lint; backend đạt 405/405 test,
  `pnpm verify`, production audit và secret scan.
- Pi đã áp dụng đủ 11/11 Prisma migration và chạy healthy với
  `agrisense-api:v2.5.6` cùng `agrisense-web:v2.5.6`. `/api/v1/health` trả
  version `2.5.6`, web health trả `ok`, endpoint bảo vệ khi chưa xác thực trả
  `401`.
- Đã giữ image `v2.5.4` làm rollback và xoá image, source snapshot, compose
  snapshot cùng database backup thuộc `v2.5.3` theo quyết định dọn bản lưu.
- Database Pi hiện chỉ có system source sau migration; managed source cần được
  nhập lại trên đúng môi trường Pi để thực hiện browser acceptance với key thật.

### Phase B hoàn tất local — 2026-09-30

- [x] Admin/Super Admin, Farmer và Client Developer dùng hierarchy, latest,
      history, dashboard/report và API Explorer từ contract thật, không fallback dữ
      liệu mẫu.
- [x] API Sources -> Manage Access là giao diện duy nhất để cấp quyền station từ
      nguồn API cho cả `FARMER` và `CLIENT_DEVELOPER`. User Management chỉ sửa role
      và hiển thị Shared access dạng chỉ đọc.
- [x] Admin và Farmer dùng chung Alert Center với canonical soil fields,
      Automatic/Paused rules, lifecycle và in-app notifications. Rule chỉ tạo cảnh
      báo, không ghi hay can thiệp thiết bị từ xa.
- [x] Client giữ ba mục `Dashboard`, `API Access`, `API Tools`; không có sidebar
      Settings riêng. Change Password và Log out vẫn nằm trong menu tài khoản dùng
      chung cho cả ba role, bao gồm luồng bắt buộc đổi mật khẩu.
- [x] Client API key giữ contract tạo/copy/rotate/revoke, station scope và secret
      chỉ hiển thị một lần. API Explorer giữ key trong React memory và không điền sẵn
      station giả.
- [x] Frontend đạt 152/152 test, lint sạch và production build thành công. Sau
      khi Docker được khôi phục, PostgreSQL healthy và health/readiness qua backend
      lẫn frontend proxy đều trả HTTP 200. Product owner đã nghiệm thu luồng local.
- Đây là bằng chứng nghiệm thu local; không xác nhận bản đã được deploy lên Pi.
  Ma trận tự động responsive/accessibility/failure-recovery rộng hơn vẫn là
  release-hardening gate, không phải phần triển khai Phase B còn thiếu.

## v2.5.5-local — 2026-09-28 (Admin API Sources)

### Đã sửa và cập nhật

- Thêm trang Admin `API Sources` theo contract backend: hiển thị chủ sở hữu, số
  trạm, `Visible Accounts`, trạng thái kết nối và thời điểm cập nhật.
- Admin có thể thêm nguồn trực tiếp bằng API URL và `X-API-Key`; Farm và Plot hỗ
  trợ chọn dữ liệu có sẵn hoặc nhập tên mới. Bỏ khối dán chat/curl/JSON để form
  ngắn, rõ và không giữ dữ liệu kết nối trong state phụ.
- Chỉ chủ sở hữu nguồn mới thấy thao tác kiểm tra kết nối, chia sẻ/thu hồi Farmer
  và reveal key. Reveal yêu cầu mật khẩu hiện tại và tự đóng sau thời gian backend
  cho phép; Admin chỉ giám sát nguồn Farmer, không thể thu hồi key Farmer tự nhập.
- Bỏ các tab Admin đã chốt không dùng khỏi sidebar: `Device Health`,
  `Config Proposals` và `IoT Config`. Giữ route cũ để không phá bookmark; phần
  Settings chung vẫn để cuối Phase B. Giao diện mới dùng tiếng Anh và không dùng
  `N/A` cho trạng thái thiếu dữ liệu.

### Bằng chứng kiểm tra

- TDD cho parser, service adapter và ranh giới UI: 6/6 test mục tiêu đạt.
- Production build đạt. Browser pass được bỏ theo yêu cầu người dùng; chưa đánh
  dấu hoàn tất ma trận browser Admin/Farmer/Client.
- Frontend chỉ commit local, không push.

### Bổ sung ổn định Admin

- Áp dụng hai migration registry nguồn dữ liệu vào database local `iot_dev`;
  schema đã đồng bộ nên các API Station, API Sources và Alert không còn truy vấn
  vào bảng/cột chưa tồn tại.
- Đồng bộ content frame 1280px, padding và design token giữa Dashboard,
  Stations & Devices, API Sources và Alert Center; sửa Alert Center dùng đúng
  surface, border, màu trạng thái và khoảng cách chung.
- Thay `N/A` ở Gateway/Sensor bằng `Not supported` để thể hiện đúng việc backend
  chưa có contract thay vì một giá trị dữ liệu mơ hồ.

### Checkpoint Admin soil source — 2026-09-29

- Chỉ nhận station có dữ liệu đo đất; `CENTER` bị loại ở cả nguồn mới và dữ liệu
  nguồn cũ, nên inventory, hierarchy và màn hình share đều còn đúng 6 NODE.
- `Manage Access` giới hạn quyền theo từng station. Chủ nguồn chọn đúng NODE cho
  từng Farmer; người được share chỉ đọc dữ liệu/rule/alert và không được reveal,
  thu hồi hay xóa nguồn.
- Thêm `View Data`, xóa nguồn có xác nhận và bảo toàn audit, cùng hiển thị số tài
  khoản đang nhìn thấy nguồn. Form thêm nguồn không gắn cứng Farm/Plot demo.
- Alert Center lấy field, unit và metadata revision thật theo station để tạo rule.
  Rule `Enabled` được đánh giá tự động và phát thông báo cho chủ nguồn cùng tài
  khoản đang được share station; `Disabled` giữ cấu hình nhưng không phát cảnh báo.
- User Management chỉ sửa role trong drawer hiện có, hiển thị quyền nguồn/station
  ở chế độ đọc và quản lý quyền tại API Sources. Super Admin có nút xóa tài khoản
  riêng; backend khóa tài khoản và thu hồi session/credential nhưng giữ audit.
- Dashboard chỉ còn Farms, Plots, Soil Stations và Users; bỏ Gateway, Sensor và
  Operational Health vì không thuộc phạm vi giám sát đất hiện tại.

### Bằng chứng checkpoint Admin

- Frontend: 87/87 test đạt; production build, lint và `git diff --check` đạt.
- Backend: 67/67 file, 405/405 test đạt; format, typecheck, lint, build và secret
  scan đạt. Test hồi quy xác nhận nguồn cũ không thể liệt kê hoặc share `CENTER`.
- Browser local xác nhận API Sources hiển thị 6 station và Manage Access chỉ còn
  NODE01–NODE06. Không dùng hoặc ghi lại X-API-Key trong bằng chứng.
- FE và BE chỉ commit local, không push. Settings vẫn để cuối Phase B; Farmer và
  Client Developer chưa được đưa vào checkpoint này.

## v2.5.4 — 2026-09-26 (Client Developer integration)

### Đã sửa và cập nhật

- Nối Developer Dashboard với inventory API key, station grant và health thật;
  bỏ toàn bộ request count, quota, latency, log và phần trăm health giả.
- API Permissions chuyển thành màn hình chỉ đọc, hiển thị đúng giao của scope
  trên key và grant hiện tại. Backend chưa có contract sửa scope nên frontend
  không còn toggle hay nút Save giả; thay đổi scope thực hiện qua API Keys.
- API Explorer gửi request trực tiếp theo contract `X-API-Key`, hỗ trợ health,
  station list, latest và history; kiểm tra station/fields/range/aggregate/limit,
  giữ cursor phân trang và hiển thị rate-limit headers. API key chỉ nằm trong bộ
  nhớ của trang, không đưa vào response hoặc local storage.
- API Docs cập nhật kiểu, giới hạn và điều kiện tham số theo backend hiện tại.
  API Metrics chuyển sang trạng thái `N/A` fail-closed cho đến khi backend có
  contract analytics theo tài khoản.
- API Keys phân biệt chính xác Active/Expired/Revoked, có retry khi tải lỗi và
  không mở rộng key rỗng thành toàn bộ station grant.
- Sửa interceptor refresh: xử lý 401 ở response interceptor, dùng single-flight
  cho request đồng thời, không refresh lặp sau lần retry và xóa access token khi
  refresh thất bại.
- Đồng bộ nhãn frontend, package frontend, health/OpenAPI backend và image phát
  hành về cùng phiên bản `2.5.4`.

### Kiểm tra ảnh hưởng cũ

- Không đổi schema database, business endpoint, phân quyền Admin/Farmer hay dữ
  liệu telemetry. Developer vẫn chỉ đọc station được cấp và API key vẫn bị giới
  hạn thêm bởi scope riêng của credential.
- Secret API key chỉ được backend trả một lần khi tạo/rotate; giao diện không ghi
  secret vào changelog, log hoặc storage.
- Public health không cần API key; ba endpoint client còn lại không dùng bearer
  session và luôn gửi `X-API-Key` riêng.

### Bằng chứng kiểm tra

- Frontend: `npm test` đạt 75/75, `npm run lint`, `npm run build` và
  `git diff --check` đạt. Kiểm tra trình duyệt local xác nhận Dashboard, API Keys,
  Permissions, Docs, Explorer và Metrics dùng đúng dữ liệu/trạng thái backend;
  Explorer gọi health thành công và không lưu API key vào storage.
- Backend: `pnpm verify` đạt toàn bộ format, typecheck, lint, Prisma generate và
  production build. Full suite đạt 374/375; test heartbeat lease kéo dài còn đỏ
  đúng với tồn đọng đã ghi, không phát sinh lỗi mới thuộc phạm vi v2.5.4.
- Commit nội bộ: frontend `6a0ee14`, backend `9d9a81a`.
- Trước triển khai Pi đã sao lưu database (113 KB) và compose; hai gói image
  ARM64 được đối chiếu SHA-256 giữa máy build và Pi, kết quả khớp hoàn toàn.
- Pi đang chạy `agrisense-api:v2.5.4` và `agrisense-web:v2.5.4`, cả hai healthy.
  Web health trả `ok`; API health trả version `2.5.4`; endpoint Client Developer
  khi thiếu `X-API-Key` trả 401 đúng ranh giới xác thực.

### Tồn đọng liên quan

- Giao diện giữa một số trang Admin/Farmer vẫn chưa đồng bộ hoàn toàn về mật độ,
  khoảng trống và tỷ lệ card/biểu đồ. Cần kiểm tra cùng viewport, zoom 100% và
  cùng dữ liệu trước khi sửa để tránh kết luận nhầm do ảnh chụp khác điều kiện.
- Backend chưa có contract metrics/log theo Client Developer; trang API Metrics
  phải tiếp tục hiển thị `N/A`, không dựng dữ liệu mẫu.
- Danh sách API key hiện bị chặn ở 100 bản ghi và chưa có contract cursor/count.
  OpenAPI của latest/history còn thiếu response schema đầy đủ ở một số route.
- Heartbeat/fencing evaluator khi upstream call kéo dài vẫn là lỗi backend chưa
  can thiệp trong bản này.

## v2.5.3 — 2026-09-26 (Admin ổn định, Farmer integration)

### Đã sửa và cập nhật

- Thanh tìm kiếm toàn cục đã được nối với danh sách station được backend cho phép
  và điều hướng về đúng trang theo role; không còn là ô nhập chỉ có giao diện.
- Giới hạn chiều rộng cho nhóm trang Admin Device Health, Stations & Devices,
  Config Proposals và IoT Config để giảm tình trạng khối nội dung trải quá rộng.
- Nối các trang Farmer với Farm → Plot → Station, latest soil và history thật;
  ảnh nghiệm thu cho thấy tài khoản Farmer thấy `NODE01`–`NODE06`, chọn `NODE02`
  và đọc được telemetry/chart từ backend.
- Bỏ Depth khi provider không trả dữ liệu; trạng thái history rỗng không còn tạo
  số `0`/`NaN` giả; nối điều khiển history và phân trang notification inbox.
- Sửa local development proxy để request `/api` đi tới backend, tránh lỗi đăng
  nhập 404 khi frontend và backend chạy riêng trên máy phát triển.
- Dropdown notification dùng inbox backend. Backend evaluator cũng đã chuyển
  lifecycle notification sang hàng đợi bền vững và chốt recipient theo job.
- Cập nhật nhãn hiển thị thành `v2.5.3` và triển khai image API/Web tương ứng lên Pi.
- Người dùng đã xác nhận phần Admin hoạt động ổn và nhận đủ dữ liệu 6 station.
- Rút gọn tài liệu vận hành: bỏ trạng thái/checklist trùng, cập nhật đường dẫn và
  gate hiện tại, gom sổ lỗi backend về các mục còn mở cùng bằng chứng rút gọn.
  Thêm quy tắc bắt buộc đọc, hiểu và xác nhận skill trước mọi thay đổi.

### Kiểm tra ảnh hưởng cũ

- Không khôi phục dữ liệu mẫu, Gateway/Sensor giả hoặc thao tác ghi thiết bị khi
  backend chưa có contract phần cứng.
- Phạm vi station tiếp tục lấy từ backend; frontend không tự mở rộng quyền.
- Farmer history vẫn tuân theo cửa sổ tối đa của backend và trạng thái rỗng được
  trình bày là không có dữ liệu, không thay bằng số giả.

### Bằng chứng kiểm tra

- Frontend: 53/53 test, production build và lint đạt trước khi triển khai.
- Backend: `pnpm verify`, 50/50 test evaluator/Weather và 2/2 test notification
  delivery đạt. Full suite đạt 373/374; heartbeat lease kéo dài còn đỏ và không
  được coi là đã sửa trong bản này.
- Pi: migration notification delivery/recipient snapshot up to date; container
  `agrisense-api:v2.5.3` và `agrisense-web:v2.5.3` healthy sau deploy.

### Tồn đọng liên quan

- **Hình ảnh giữa các trang Farmer chưa đồng bộ hoàn toàn.** Dashboard, Soil
  Dashboard, History Report, Alerts và Alert Center còn khác nhau về mật độ nội
  dung, khoảng trống, tỷ lệ khối lọc/card/biểu đồ và cách đặt tên metric.
- Alerts và Alert Center đang có bộ lọc, hai khối trạng thái rỗng và nội dung gần
  giống nhau; cần xác nhận rõ nhiệm vụ riêng của từng trang trước khi chỉnh UI.
- Chưa kết luận tất cả là lỗi CSS vì ảnh History Report được chụp ở zoom 67%,
  không cùng điều kiện với các ảnh còn lại. Khi sửa phải kiểm tra lại ở zoom 100%,
  cùng viewport/role/station/khoảng thời gian và lưu ảnh trước/sau cho 5 trang.
- Health metadata của API vẫn trả `2.5.0` dù image là `v2.5.3`; đây là lệch nhãn
  nội bộ, không làm container mất healthy.
- `package.json` frontend vẫn mang version `2.5.2` trong khi giao diện/image đã
  ghi `v2.5.3`; cần gom phiên bản về một nguồn trước bản tiếp theo.
- Heartbeat/fencing evaluator khi upstream call kéo dài vẫn chưa hoàn tất.

## v2.5.2 — 2026-09-24 (Admin/Super Admin checkpoint)

### Thay đổi

- Nối Audit Log tới `GET /admin/audit-events`, dùng phân trang cursor và bộ lọc kết quả/khoảng ngày; chỉ Super Admin xem được. Bỏ bảng audit, trạng thái service và nút export dữ liệu mẫu.
- Nối Stations & Devices/Station Detail tới Farm → Plot → Station và latest soil thật. Device Health và Config Proposals tiếp tục fail-closed vì chưa có contract phần cứng.
- Bật cấp/thu hồi Farm membership cho Farmer và Station grant cho Client Developer trong User Management; sau ghi đọc lại chi tiết user từ backend.
- IoT Config bỏ các nút tạo/rollback cấu hình chưa có API thật, chuyển người dùng tới Alert Center khi cần sửa ngưỡng cảnh báo. Quyết định ngày 2026-09-28 chốt remote device write nằm ngoài phạm vi thay vì tiếp tục chờ contract. UI Notifications của Admin tạm hoãn đến khi frontend Notifications được push.
- Sửa thống kê Users thành số trên trang hiện tại vì API danh sách phân trang không trả tổng; không hiển thị số scope từ DTO danh sách vốn không chứa assignments.
- Đổi nhãn và package version sang `v2.5.2`.

### Kiểm tra ảnh hưởng cũ

- Không đổi backend endpoint, DTO hay cơ chế đăng nhập. Farmer và Developer vẫn giữ route riêng.
- Audit menu ẩn với Admin thường; trang Audit vẫn chặn quyền ở mức giao diện, backend tiếp tục là ranh giới quyền chính.
- Scope selector chỉ cho phép loại quyền hợp lệ theo role backend: Farmer/Farm hoặc Client Developer/Station. Không sửa quyền bằng dữ liệu tự dựng.
- Các thay đổi frontend chưa được đánh dấu browser-verified cho đến khi chạy role matrix trên Pi.

### Bằng chứng kiểm tra

- Snapshot commit `4d45f16` được xuất sang thư mục sạch; `npm ci --offline` không báo vulnerability, `npm test` đạt 40/40, `npm run lint` và `npm run build` đạt.
- Pi qua LAN chạy `agrisense-web:v2.5.2` (healthy); API và database vẫn healthy. LAN `/__web_health` và `/api/v1/health` trả 200, audit khi chưa xác thực trả 401; đường public `/login` trả 200.
- Chrome hiển thị nhãn `v2.5.2`; Dashboard với phiên Super Admin sẵn có hiển thị 1 Farm, 1 Plot, 6 Station, 3 User từ backend; IoT Config hiển thị `DEVICE_CONTRACT_PENDING` và không có nút ghi cấu hình giả.
- Browser matrix đầy đủ cho Admin và Super Admin (Audit, Users/scope, Alert Center, station detail, lỗi phiên/dependency): **chưa hoàn tất**. Không đánh dấu các luồng này browser-verified.

### Tồn đọng liên quan

- Dashboard dùng các trang đầu tiên của inventory (tối đa 100 mỗi endpoint), gắn nhãn `Loaded` và cảnh báo khi bị giới hạn; backend chưa có count contract cho tổng toàn hệ thống.
- Chưa có contract health thiết bị. Remote write không còn là contract đang chờ;
  các route cấu hình cũ chỉ hiển thị ranh giới không ghi thiết bị và hướng dẫn
  can thiệp trực tiếp tại hiện trường.
- Browser matrix cần kiểm tra phân quyền, hết phiên, cấp/thu hồi scope và cảnh báo khi dependency lỗi trước khi chuyển sang Farmer.
- Chưa mở route Notifications cho Admin ở checkpoint này; sẽ nối sau khi frontend Notifications hoàn tất.

## v2.5.1 — 2026-09-22

### Thay đổi

- Bỏ hoàn toàn bộ lọc `Depth` vì API nhà cung cấp không trả trường độ sâu.
- Giới hạn chiều cao và vị trí popup chọn ngày để nút thao tác luôn nhìn thấy trên màn hình nhỏ.
- Thay số liệu mẫu trên Admin Dashboard bằng Farms, Plots, Stations và Users lấy từ backend.
- Những chỉ số backend chưa có contract như Gateway, Sensor và trạng thái health được hiển thị `N/A`, không tự ước lượng.
- Nút Refresh trên Admin Dashboard tải lại dữ liệu thật.
- Cập nhật nhãn phiên bản hiển thị thành `v2.5.1`.

### Kiểm tra ảnh hưởng cũ

- Farmer Soil Dashboard vẫn dùng cùng contract latest/history; chỉ bỏ trường không được provider hỗ trợ.
- DateRangePicker giữ nguyên cách chọn khoảng ngày và callback `onChange`; chỉ thay bố cục popup.
- Admin và Super Admin vẫn dùng cùng route/role guard; dashboard chỉ thay nguồn dữ liệu và loại bỏ placeholder.
- Không đổi endpoint, DTO, cơ chế đăng nhập, token hoặc dependency.

### Bằng chứng kiểm tra

- `pnpm test`: 32/32 test đạt.
- `pnpm lint`: đạt, không còn cảnh báo.
- `pnpm build`: production build đạt.

### Tồn đọng liên quan

- Backend hiện cấp Farmer theo toàn bộ Farm. Yêu cầu giới hạn Farmer vào đúng một Station phải được thực hiện ở authorization backend; không được chỉ ẩn bằng frontend.
- Gateway, Sensor và station-health cần backend contract thật trước khi khôi phục các biểu đồ vận hành.
