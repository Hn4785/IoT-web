# Sổ lỗi Backend

Cập nhật gần nhất: 2026-10-06. Đây là file theo dõi lỗi chính của backend. Lỗi chưa hoàn thành luôn đặt ở trên; lỗi đã sửa được chuyển xuống cuối file sau khi có test hoặc bằng chứng kiểm chứng.

## Gate hiện tại

- Lượt cuối local 2026-10-06: backend 93 file/621 tests, `pnpm verify`, dependency
  audit và secret scan đạt; coverage 85.78% statements / 77.27% branches /
  91.82% functions / 88.52% lines. Frontend 242 tests, lint/build và audit đạt.
  Browser HTTP thật dùng fixture cô lập; kết quả phát hành cuối ghi duy nhất ở
  FE `docs/internal-release-notes.md`. Không chuyển fixture/database thử sang Pi.
- Owner đã duyệt publish BE/FE và Pi ngày 2026-10-06, thay thế lệnh giữ local trước
  đó. Chỉ chuẩn bị kế hoạch viết tài liệu bàn giao tại `tasks/plan.md` mục H;
  chưa tạo bộ tài liệu bàn giao mới. Các gate target/live còn mở không bị tích thay.

- Gate D local lịch sử ngày 2026-10-05: 85/85 file, 510/510 test đạt; `pnpm verify`
  đạt format/typecheck/lint/Prisma generate/build; coverage 88.69% statements,
  78.52% branches, 93.99% functions, 91.27% lines. Production audit không còn
  advisory sau bản vá đã được duyệt; `iot_test` có đủ 12 migrations.
  Frontend không đổi source: 181/181 tests, lint/build và production audit đạt.
- Restore cô lập giữ dữ liệu/quyền/ciphertext/lifecycle và app đọc đúng scope;
  kiểm tra image mới được ghi riêng tại
  [D revalidation](../checkpoints/2026-10-05-d-local.md).
- Các gate tháng 9 là bằng chứng lịch sử, không phải số liệu hiện tại. D-production
  vẫn cần bên nhận dự án nghiệm thu trên hạ tầng của họ; không đổi DB Pi đợt này.
- Baseline trước F-product ngày 2026-10-05: 88/88 file, 550/550 backend tests và
  `pnpm verify` đạt; frontend 181/181 tests đạt. Đây là baseline, không chứng minh
  các lỗi mới dưới đây đã được sửa hoặc đã qua browser acceptance.
- Gate F-product local mới nhất: 89/89 file, 557/557 backend tests và `pnpm verify`
  đạt; frontend 218/218 tests, lint và TypeScript/build đạt. Không chạy lại coverage
  cho F-product; không dùng số liệu coverage D cũ như số liệu mới.
  Sheet 40–47 đã có regression, review và bằng chứng phù hợp, chuyển xuống Đã sửa;
  [bằng chứng F-product](../checkpoints/2026-10-05-f-product-progress.md).
- Lệnh giữ local của đợt F-product 2026-10-05 đã được thay thế bởi duyệt phát hành
  2026-10-06. Lỗi F-product đã ghi riêng vào tab Trung,
  STT 40–47; không đưa lỗi hạ tầng/DB Pi vào các dòng mới.
- B-device được đánh dấu `live-verified` ngày 2026-09-28: API lấy trực tiếp từ
  các trạm quan trắc đang hoạt động, số liệu cập nhật và bên cung cấp xác nhận
  toàn bộ dữ liệu CENTER/NODE là dữ liệu cảm biến thật, đầu vào cuối cùng để
  nghiệm thu. Trạng thái này xác nhận nguồn dữ liệu; registry, browser role
  matrix và production vẫn là checkpoint riêng.

## Checkpoint cũ — đã bị thay thế, không chạy lại seed/demo

Các chỉ dẫn dưới đây ghi lại tình trạng 2026-09-25, không còn là lệnh thực thi.
B/C đã được chủ dự án chấp nhận ngày 2026-09-30; Farm/Plot Demo đã được xoá theo
thoả thuận. Nguồn và station thật được thêm qua API Sources, chia sẻ theo station.
Không seed lại hoặc gán Farm Demo để thoả văn bản cũ. Browser QA mở rộng vẫn được
theo dõi ở FE-2/FE-5/FE-6/QA-1 và F16, không mở lại B/C hoặc giả nhận đã chạy E2E.

Nội dung lịch sử (chỉ để đối chiếu):

1. Đồng bộ registry local/triển khai để database có đủ `NODE01` đến `NODE06`,
   sau đó xác nhận Admin và Super Admin nhận đủ sáu trạm qua API và trên browser.
   Bằng chứng ngày 2026-09-25 cho thấy code seed đã khai báo sáu trạm nhưng
   database `iot_dev` hiện mới có `NODE01` và `NODE02`; đây là lỗi dữ liệu seed
   chưa được chạy lại, không phải giới hạn quyền Admin. Khi kiểm tra lại, đồng
   thời đối chiếu mã trạm, timestamp đang tăng, trường đo và đơn vị với API thật;
   không ghi `X-API-Key` vào log, ảnh hoặc tài liệu.
2. Đóng bằng bằng chứng browser ba lỗi đã theo dõi từ ngày 2026-09-24: tìm kiếm
   toàn cục theo role, bố cục 4–5 trang chưa cân đối, và tính đúng đắn của tập
   người nhận notification khi quyền thay đổi giữa các lô. Phần notification đã
   có sửa đổi snapshot và regression test; lần chạy sau phải kiểm tra lại thay vì
   triển khai lại theo phỏng đoán.
3. Gán Farm Demo cho tài khoản Farmer và chọn `NODE02` hoặc `NODE03` làm trạm
   kiểm thử ổn định. Chạy đủ Dashboard, Soil Dashboard, Historical Analysis,
   History Report, Notifications, Alerts và Alert Center trước khi chuyển sang
   phần tiếp theo. Quyền Farmer đang ở cấp Farm, vì vậy việc gán Farm Demo sẽ cho
   phép thấy toàn bộ trạm thuộc farm; `NODE02`/`NODE03` chỉ là trạm chuẩn dùng để
   kiểm thử, không phải station grant riêng.

Quy tắc bằng chứng vẫn áp dụng cho QA còn mở: test/build xanh không thay thế
kiểm chứng browser/nguồn thật theo phạm vi nghiệm thu hiện tại.

## Chưa sửa

### [ ] [F16/FE acceptance] Kiểm chứng browser/API thật còn lại

- Historical Analysis đã sửa điều khiển, dữ liệu rỗng và F8; Notifications đã có
  tải thêm; tìm kiếm chung đã nối station đúng role. Các lỗi implementation này
  được tích riêng ở phần Đã sửa, không tiếp tục ghi là chưa có code.
- Browser HTTP thực tế với backend/DB fixture cô lập đã đạt 14/14: đăng nhập,
  đổi mật khẩu/logout/reload, user/transfer, Audit role/filter/cursor,
  notification 101 mục, API key và CSV native. Mock desktop/mobile đạt 14/14;
  provider thật phục hồi và kiểm tra toàn diện accessibility/target vẫn tách riêng.
- Checkpoint F-product-local lịch sử chỉ đóng các trạng thái dữ liệu đã kiểm tra.
  Lượt 2026-10-06 đóng FE/QA local riêng trong todo; F16-live và nghiệm thu target
  vẫn mở. Pi đã có observedAt tiến và rule hiện hành tiếp tục BREACH không tạo
  notification trùng; chưa có lifecycle mới tự nhiên sau rollout để xác nhận delivery mới.

### [Thấp, Frontend/UI] Bố cục khoảng 4–5 trang chưa cân đối

- Bằng chứng ngày 2026-09-24: ảnh xác nhận Device Health và Stations & Devices;
  tên của khoảng 2–3 trang còn lại chưa được xác định. Trên màn hình lớn, khối
  nội dung/trạng thái chưa khả dụng trải quá rộng và tạo nhiều khoảng trống.
- Phạm vi ảnh hưởng: khả năng đọc và sự nhất quán giữa các trang; không liên quan
  đến dữ liệu hay contract backend. Con số 4–5 là ước lượng của người dùng,
  chưa phải kết quả kiểm tra toàn bộ giao diện.
- Hướng xử lý: rà soát nhóm trang bị ảnh hưởng, giới hạn chiều rộng và căn chỉnh
  khoảng cách theo layout chung. Kiểm tra hồi quy ở desktop và màn hình nhỏ,
  đối chiếu trước/sau bằng ảnh browser rồi mới đánh dấu hoàn thành.
- Mã FE local ngày 2026-09-25 đã giới hạn chiều rộng của nhóm Device Health,
  Config Proposals, IoT Config và Stations & Devices. Build/lint đạt; chưa có
  ảnh browser trước/sau cho toàn bộ nhóm, nên chưa đóng lỗi và chưa khẳng định
  đủ 4–5 trang. Bản xem trước component local đã xác nhận Device Health và
  Stations & Devices không còn khối nội dung tràn rộng ở viewport 1280px;
  chưa có dữ liệu backend/auth để kiểm tra trang thật theo role.

### [Vận hành] Các hardening trước production còn thiếu

- Rate limit hiện là process-local; bên nhận dự án cần duyệt policy theo proxy của
  server đơn instance. Shared limiter chỉ cần nếu mở rộng nhiều instance sau này.
- Chưa tự thêm Redis hoặc bật `trustProxy`: cần chốt kiến trúc triển khai
  (gateway hay shared store và số proxy hop) để không tạo lỗ hổng giả mạo IP.
- Chủ dự án/team đã loại MFA/SSO khỏi đợt bàn giao ngày 2026-10-05, có thể tự thêm
  sau. Không coi miễn trừ này là control đã triển khai; rủi ro lộ mật khẩu Super
  Admin vẫn còn. Đăng nhập/phân quyền/audit/recovery hiện tại phải được giữ nguyên.
- Audit append-only mới được bảo vệ theo convention ứng dụng, chưa có database role chặn update/delete.
- Metrics mới là registry trong process và chưa có endpoint public. Cần chốt
  ingress/TLS và scraper network trước khi expose; aggregation nhiều instance là
  mở rộng có điều kiện, không phải yêu cầu đã triển khai trong bản bàn giao này.
- Restore local và recovery regression đã đạt. RPO 24h/RTO 4h, 7 bản ngày/4 bản tuần
  đã được duyệt; destination mã hoá ngoài máy, người giữ key, người restore và
  rotation/restore evidence trên target vẫn do bên nhận dự án hoàn thiện.
- Dependency audit chỉ phát hiện advisory đã biết, không loại trừ supply-chain compromise.
- GitHub Actions hiện đã pin commit SHA chính thức; CI backend và image gates
  amd64/arm64 ngày 2026-10-06 đã đạt. Lịch cập nhật pin/advisory vẫn cần duy trì.

## Đã kiểm chứng không phải lỗi

### Cursor user không tái hiện lỗi P2025

- Cursor UUID hợp lệ nhưng không tồn tại đã được thử trực tiếp với PostgreSQL/Prisma hiện tại: API trả HTTP 200 và trang rỗng.
- Không sửa repository khi chưa tái hiện được. Nếu xảy ra ở môi trường khác, phải giữ Prisma error code và query cụ thể.

### Origin, cookie path và refresh single-flight

- Kiểm tra `Origin` ở refresh/logout và cookie path `/api/v1/auth` là ràng buộc bảo mật có chủ ý.
- Frontend phải dùng hàng đợi/single-flight để không gọi song song cùng refresh token.

### Mở lại frontend khi chưa Logout vẫn giữ phiên

- Restart frontend không kết thúc refresh session trên backend. Nếu cookie
  `HttpOnly` còn hạn, frontend refresh và khôi phục đúng tài khoản là hành vi dự kiến.
- Phiên refresh hiện có TTL 7 ngày; access token có TTL 15 phút và chỉ được giữ
  trong bộ nhớ. Việc Pi hoặc web restart nhưng trình duyệt vẫn đăng nhập vào hôm
  sau là đúng contract, không phải lưu access token vĩnh viễn.
- Logout đã được kiểm chứng thu hồi session, xóa cookie và luôn xóa access token
  trong bộ nhớ frontend, kể cả request logout thất bại.

## Đã sửa

### [x] Lỗi xác nhận 2026-10-06 — form Trung giữ tại local

Đúng 15 cột A–O theo form đã gửi. STT 48–65 là số tiếp nối **trong sổ local** sau
40–47; chưa xác nhận/ghi các dòng này trên Google Sheet. Khi đồng bộ phải đọc STT
cuối của tab Trung, đối chiếu mô tả và cập nhật dòng đã có, không tạo trùng hoặc
ghi đè tab khác. Đây là lỗi code/đóng gói ứng dụng, không phải lỗi mạng/DB của Pi.

| STT | Ngày yêu cầu | Người yêu cầu | Sprint  | Chức năng            | Phân loại     | Mô tả bug                                                                     | Kết quả mong muốn                                                   | Phân loại | Mức độ ưu tiên            | Trạng thái xử lý | Ngày test lại | Chịu trách nhiệm xử lý | Ghi chú của test                                                              | Ghi chú của dev                                                              |
| --- | ------------ | ------------- | ------- | -------------------- | ------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------- | ------------------------- | ---------------- | ------------- | ---------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 48  | 06/10/2026   | Tester        | Phase F | Refresh session      | Lỗi logic     | Refresh thất bại xoá token nhưng còn user Zustand.                            | Xoá cả token/user; không lặp refresh.                               | Frontend  | Ưu tiên mức độ cao        | [x] Đã xử lý     | 06/10/2026    | Ngân                   | Concurrent refresh RED/GREEN; browser revoked-session đạt.                    | Session invalidator dùng chung.                                              |
| 49  | 06/10/2026   | Tester        | Phase F | Phiên bị thu hồi     | Phân quyền    | Retry vẫn 401 nhưng giữ phiên đăng nhập.                                      | Purge đúng phiên; không refresh lần hai.                            | Frontend  | Ưu tiên mức độ cao        | [x] Đã xử lý     | 06/10/2026    | Ngân                   | `apiClientRefresh.test.ts` RED/GREEN.                                         | Invalidate theo request snapshot.                                            |
| 50  | 06/10/2026   | Tester        | Phase F | Khôi phục phiên      | Lỗi đồng thời | Restore cũ ghi đè user/token hoặc xoá phiên mới.                              | Phản hồi cũ không tác động phiên thay thế.                          | Frontend  | Ưu tiên mức độ cao        | [x] Đã xử lý     | 06/10/2026    | Ngân                   | Success/failure restore races RED/GREEN.                                      | Epoch fence cả success và cleanup.                                           |
| 51  | 06/10/2026   | Tester        | Phase F | Đăng xuất            | Lỗi đồng thời | Logout cũ xoá phiên mới; chuyển login sớm trước khi cookie bị xoá.            | Bảo vệ phiên mới và chờ server logout trước điều hướng.             | Frontend  | Ưu tiên mức độ cao        | [x] Đã xử lý     | 06/10/2026    | Ngân                   | Hai unit RED/GREEN; HTTP logout/reload desktop/mobile 2/2.                    | Fence ngay khi logout, loading đến khi cookie kết thúc.                      |
| 52  | 06/10/2026   | Tester        | Phase F | Refresh đồng thời    | Lỗi logic     | 401 gốc về muộn sau refresh bị từ chối dù cùng user.                          | Replay token hiện tại một lần, không refresh thừa.                  | Frontend  | Ưu tiên mức độ trung bình | [x] Đã xử lý     | 06/10/2026    | Ngân                   | Delayed-original 401 RED/GREEN; 13/13 session tests.                          | Epoch chỉ đổi ở boundary phiên, không đổi khi refresh token.                 |
| 53  | 06/10/2026   | Tester        | Phase F | API key modal        | Giao diện     | Shift+Tab từ dialog làm focus thoát trước xác nhận lưu secret.                | Focus nằm trong dialog; Escape/backdrop không đóng sớm.             | Frontend  | Ưu tiên mức độ trung bình | [x] Đã xử lý     | 06/10/2026    | Ngân                   | Browser RED/GREEN desktop/mobile; 14/14 mock smoke.                           | Acknowledgement gate và focus trap.                                          |
| 54  | 06/10/2026   | Tester        | Phase F | Notifications        | Xử lý lỗi     | 403 khi load-more purge dữ liệu nhưng spinner không kết thúc.                 | Xoá rows/cursor/unread và hiển thị lỗi; 5xx giữ dữ liệu hợp lệ.     | Frontend  | Ưu tiên mức độ cao        | [x] Đã xử lý     | 06/10/2026    | Ngân                   | Browser 100→101/5xx/403 RED/GREEN; unit pagination.                           | Reset loading/loadingMore/updatingId khi access mất.                         |
| 55  | 06/10/2026   | Tester        | Phase F | Đổi mật khẩu         | Lỗi logic     | Đổi user status remount page làm mất màn hình thành công.                     | Account Secured xuất hiện trước vào dashboard.                      | Frontend  | Ưu tiên mức độ trung bình | [x] Đã xử lý     | 06/10/2026    | Ngân                   | HTTP tạo user/invalid input/password/reload/logout desktop/mobile đạt.        | Publish user ACTIVE cùng điều hướng, không đổi auth policy.                  |
| 56  | 06/10/2026   | Tester        | Phase F | Tools image          | Đóng gói      | User node không truy cập Corepack cache; tools phụ thuộc tải mạng.            | Prisma/tsx/pnpm chạy non-root offline.                              | Backend   | Ưu tiên mức độ cao        | [x] Đã xử lý     | 06/10/2026    | Trung                  | Docker `--network none` RED/GREEN, UID 1000.                                  | Copy cache vào COREPACK_HOME thuộc node.                                     |
| 57  | 06/10/2026   | Tester        | Phase F | Deployment preflight | Cấu hình      | Chấp nhận non-loopback HTTP nhưng cookie production Secure không hoạt động.   | Yêu cầu HTTPS ngoài loopback, không hạ bảo mật.                     | Backend   | Ưu tiên mức độ cao        | [x] Đã xử lý     | 06/10/2026    | Trung                  | Reject LAN HTTP regressions đạt.                                              | Giữ auth/cookie policy; validate origin.                                     |
| 58  | 06/10/2026   | Tester        | Phase F | Deployment preflight | Lỗi logic     | Node `process.version` có tiền tố v bị báo sai version.                       | Node v24.17.0 qua đúng floor.                                       | Backend   | Ưu tiên mức độ trung bình | [x] Đã xử lý     | 06/10/2026    | Trung                  | RED/GREEN; 23/23 preflight; CLI valid:true.                                   | Parse version chặt và hỗ trợ v prefix.                                       |
| 59  | 06/10/2026   | Tester        | Phase F | Compose ingress      | Đóng gói      | Web chỉ gắn internal network; healthy nhưng host port không nhận kết nối.     | Host ingress và same-origin proxy hoạt động; DB vẫn private.        | Backend   | Ưu tiên mức độ cao        | [x] Đã xử lý     | 06/10/2026    | Trung                  | Connection-refused RED; host health/readiness/deep-link 200 GREEN.            | Web thêm egress, DB không có host port.                                      |
| 60  | 06/10/2026   | Tester        | Phase F | Linux build          | Lỗi cấu hình  | Pageheader.module.css khác case import PageHeader.module.css.                 | Host CI/Docker Linux build cùng tên file chuẩn.                     | Frontend  | Ưu tiên mức độ cao        | [x] Đã xử lý     | 06/10/2026    | Ngân                   | Exact directory-entry RED/GREEN; Linux Docker build đạt.                      | Rename chuẩn, bỏ lệnh copy workaround.                                       |
| 61  | 06/10/2026   | Tester        | Phase F | Dependency audit     | Bảo mật       | source-map-js advisory mới làm audit fail.                                    | Bản vá tương thích và giữ audit gate.                               | Cả hai    | Ưu tiên mức độ cao        | [x] Đã xử lý     | 06/10/2026    | Trung                  | Fresh BE/FE audit: zero advisories.                                           | Pin override 1.2.2; Nest/Fastify/brace-expansion patches vẫn giữ.            |
| 62  | 06/10/2026   | Tester        | Phase F | Giao diện Soil       | Giao diện     | Bộ lọc và grid giữ min-width làm nội dung bị cắt trên mobile.                 | Bộ lọc co theo 390px, không che overflow để giấu lỗi.               | Frontend  | Ưu tiên mức độ thấp       | [x] Đã xử lý     | 06/10/2026    | Ngân                   | Regression layout; browser ba role 1440/390px không có control bị cắt.        | minmax(0,1fr), min-width 0 và select rộng theo ô.                            |
| 63  | 06/10/2026   | Tester        | Phase F | Đăng xuất            | Lỗi đồng thời | Request xếp hàng trước logout có thể refresh token và treo loading.           | Phiên đang kết thúc không refresh; phiên login mới vẫn được bảo vệ. | Frontend  | Ưu tiên mức độ cao        | [x] Đã xử lý     | 06/10/2026    | Ngân                   | Unit RED/GREEN 14/14; full 241/241 và review độc lập đạt.                     | Guard ending-session; cleanup theo epoch thay vì token cũ.                   |
| 64  | 06/10/2026   | Tester        | Phase F | Menu mobile          | Accessibility | Menu thu gọn ẩn chữ, link chỉ còn icon không có tên đọc.                      | Link giữ tên cho bàn phím/screen reader ở cả hai viewport.          | Frontend  | Ưu tiên mức độ thấp       | [x] Đã xử lý     | 06/10/2026    | Ngân                   | Browser RED/GREEN Users/Soil Dashboard/API Access; full 242 và E2E 14/14 đạt. | aria-label/title theo label hiện có; icon decorative, không đổi route/quyền. |
| 65  | 06/10/2026   | Tester        | Phase F | CI image readiness   | Lỗi đồng thời | Probe socket nhận PostgreSQL tạm lúc init; createdb gặp server shutting down. | Chờ PostgreSQL cuối qua TCP trước tạo DB test và chạy migration.    | Backend   | Ưu tiên mức độ trung bình | [x] Đã xử lý     | 06/10/2026    | Trung                  | Regression RED/GREEN 6/6; Docker tái hiện socket ready nhưng TCP chưa ready.  | pg_isready -h127.0.0.1; giữ 30 lần chờ và exit lỗi, không đổi runtime/Pi.    |

Nguồn đối chiếu nguyên nhân CI: [PostgreSQL Docker entrypoint chính thức](https://github.com/docker-library/postgres/blob/master/docker-entrypoint.sh)
khởi tạo bằng server socket-only rồi mới chạy server cuối. Không bỏ gate migration
hay tăng thời gian chờ để che lỗi; bản sửa chỉ thuộc workflow kiểm tra image.

### [x] [Cao, F7/Frontend, 2026-10-05] Lỗi endpoint phụ làm mất latest hợp lệ — Sheet 40

- Latest/history/alerts tải độc lập; lỗi tạm thời chỉ giữ bản hợp lệ đúng trạm,
  giữ timestamp gốc và nhãn Last known/Stale. Rỗng/mất quyền không dùng fallback.
- Regression và browser local xác nhận cả hai chiều endpoint lỗi; FE `d405a64`.
  Full frontend 218/218, lint/build đạt; chưa push GitHub/Pi.

### [x] [Cao, F7/Frontend, 2026-10-05] Chi tiết trạm giữ số đo của route cũ — Sheet 41

- State gắn station ID và generation; phản hồi trễ/metadata chậm không đặt số đo
  A dưới B. Latest denial hiển thị độc lập và xoá bản giữ lại khi 401/403/404.
- Regression và browser Admin/Super Admin local xác nhận đổi trạm, stored,
  empty/denied; FE `d405a64`, gate như Sheet 40.

### [x] [Trung bình, F8/Frontend, 2026-10-05] Một trạm lỗi xoá mọi chuỗi lịch sử — Sheet 42

- Tải/retry từng trạm; A thành công còn nguyên khi B lỗi. B bị thu hồi bị loại;
  A lỗi tạm thời vẫn giữ đúng-query với nhãn cũ và coverage chưa xác nhận.
- RED/GREEN và browser Analysis local xác nhận hai trạm và scope shrink;
  FE `3959bb5`, 13 test history mới, full frontend 218/218 đạt.

### [x] [Trung bình, F8/Frontend, 2026-10-05] Khóa lịch sử thiếu khoảng thời gian thật — Sheet 43

- Key chứa actual begin/end, station, fields, interval/aggregate/order/limit/cursor;
  fencing chặn phản hồi cũ. Query mới không tái dùng kết quả query trước.
- Test định danh/reorder và browser đổi ngày/metric, Report Apply cùng-query đạt;
  CSV giữ metadata query/nguồn thật, không thêm hàng biểu đồ giả; FE `3959bb5`.

### [x] [Cao, F9/Frontend, 2026-10-05] Refresh không tải lại quyền trạm khi ID cha giữ nguyên — Sheet 44

- Reload toàn hierarchy và gắn scope account/session/role/environment; chặn page
  cũ/sai parent, xoá trạm mất quyền, không đổi authentication flow.
- Regression và browser refresh cùng Farm/Plot ID, thu hồi B và đổi phiên đạt;
  StrictMode không kẹt loading; FE `d405a64`, full gate như Sheet 40.

### [x] [Trung bình, F7-F8/Frontend, 2026-10-05] Bỏ provenance và coverage từ DTO — Sheet 45

- DTO/adapter dùng trường đã duyệt; UI phân biệt upstream/cache/stored/last-known,
  complete/partial/unknown và truncated. Stored không có nghĩa là Connected.
- Test và browser Soil/Analysis/Report local xác nhận Stale, thời điểm fetch gốc,
  coverage thiếu/chưa xác nhận và trạng thái rỗng; FE `d405a64`/`3959bb5`.
  [Bằng chứng chung](../checkpoints/2026-10-05-f-product-progress.md).

### [x] [Frontend implementation] Historical Analysis không còn điều khiển giả

- Đã có chọn 7/30/90 ngày, Line/Area và thông tin biểu đồ; unit/browser local
  xác nhận hành động. Không còn Depth khi metadata không có depth; empty dùng
  N/A/thông báo không có số đo, vẫn giữ giá trị 0 thật.
- Full frontend 218/218 đạt. Provider thật và native CSV download thuộc F16,
  không coi implementation hoàn tất là đã nghiệm thu toàn bộ Farmer E2E.

### [x] [Frontend implementation] Notifications đã dùng cursor tải tiếp

- Nút tải thêm sử dụng nextCursor, ghép trang không trùng, bỏ phản hồi cũ khi đổi
  filter/refresh. Regression đỏ trước sửa, xanh sau sửa đã có trong suite hiện tại.
- Full frontend 218/218 đạt; browser/API thật hơn 100 thông báo và quyền đổi giữa
  các lô vẫn là acceptance F16, không phải lỗi thiếu implementation.

### [x] [Frontend implementation] Thanh tìm kiếm đã nối station theo role

- Tìm trong hierarchy được cấp quyền, điều hướng đúng role và ẩn ô với Developer;
  ba regression đã có trong full suite 218/218 đạt.
- Browser tìm kiếm toàn role/empty/denied giữ ở F16; không mở quyền backend.

### [x] [Cao, F10/Backend, 2026-10-05] Snapshot backfill bị đánh giá như latest mới — Sheet 46

- Test PostgreSQL tái hiện upstream latest 00:03/canonical rawHistory 00:04:
  trước sửa bị gắn upstream/fresh; sau sửa giữ giá trị/thời gian canonical nhưng
  trả stored/stale. Chỉ mẫu khớp field/value/observedAt của latest đã xác nhận
  mới được coi là upstream. Không đổi schema hoặc contract công khai.
- Evaluator bỏ qua stored kể cả DTO có quality good/isStale false. Regression
  kiểm tra breach/recovery không tăng, không mở/đóng alert từ bản lưu; correction
  cùng timestamp, evaluator restart và recovery chỉ tạo lifecycle một lần.
- Nhóm F10/C1/delivery đạt 24/24; full backend 89/89 file, 557/557 tests,
  `pnpm verify` đạt. Chưa push GitHub/Pi hoặc xác nhận provider/target thật.

### [x] [Cao, F10/Backend, 2026-10-05] Thiếu fencing binding ở nhánh đánh giá thành công — Sheet 47

- Bốn test RED xác nhận rule đổi revision, unit, metadataRevision hoặc chuyển
  BLOCKED_METADATA trong lúc latest đang chờ vẫn ghi breach theo binding cũ.
- Scheduled evaluator mang binding đã kiểm tra vào transaction; sau row lock,
  recheck enabled/READY/state và revision/unit/metadataRevision trước ghi.
  GREEN xác nhận không tăng counter/observedAt hoặc tạo alert với binding cũ.
- Review độc lập không còn finding trong phạm vi bản sửa. Full gate và giới hạn
  triển khai như Sheet 46; browser acceptance vẫn là checkpoint riêng.

### [Vận hành, 2026-10-05] Backup/restore bỏ qua lỗi native và race tạo target

- Đã tái hiện việc `createdb` lỗi nhưng script vẫn chạy restore; các lỗi dump/copy/
  lookup/restore cũng chưa được chặn ngay. Bản sửa kiểm tra exit code và kết quả
  lookup/count, dùng dump name GUID và không để cleanup warning che lỗi chính.
- 14 regressions PowerShell đạt; restore thật vào database cô lập mới giữ nguyên
  ciphertext, số đo, grants/key scope, thông báo và audit; app đọc stored data đúng
  timestamp và từ chối outsider. Backup/database được giữ lại để review, không
  overwrite/delete DB người dùng. Xem [bằng chứng D](../checkpoints/2026-10-05-d-local.md).

### [Dependency, 2026-10-05] Bản vá tương thích và hồi quy recovery

- Nest 12.0.3/Fastify 5.12.5 cùng overrides transitive có phạm vi thay kết quả audit
  14 advisories trước sửa bằng 0 advisory sau sửa; không thêm package chức năng,
  không đổi authentication flow và không hạ supply-chain policy.
- Recovery regressions xác nhận chỉ revoke session holder đang active, không sửa
  evidence revoke cũ/session tài khoản khác và không đưa password/hash vào audit.
- Full gate 510/510 tests và `pnpm verify` đạt; production target vẫn chưa nghiệm thu.

### [Trung bình, Phase C] Chốt người nhận ở lô phát đầu tiên

- Kiểm thử tích hợp ngày 2026-09-25 tái hiện lỗi cũ: Farmer mất quyền giữa các
  lô bị bỏ sót, Farmer mới được cấp quyền giữa các lô lại được nhận. Test đỏ
  trước thay đổi và xanh sau thay đổi.
- Worker nay ghi tập người nhận đủ điều kiện một lần trong transaction lô đầu,
  rồi chỉ phân trang bảng snapshot. Migration thêm bảng recipient và dấu thời
  điểm snapshot; job cũ đang dở cũng giữ các notification đã phát trước đó.
- Đã áp dụng migration trên `iot_test`, kiểm thử 374/374 và `pnpm verify` đạt.
  Chưa triển khai hoặc tái hiện trên Pi; hành vi xóa hẳn User vẫn theo FK cascade.

### [Phase C] Notification phát trong transaction và DTO thay đổi theo dữ liệu hiện tại

- Lifecycle transaction nay chỉ tạo delivery job cùng snapshot hiển thị. Worker
  phát theo lô tối đa 100 recipient/giao dịch, dùng row lock để nhiều instance
  không xử lý trùng; unique constraint giữ idempotency khi chạy lại.
- Inbox dùng snapshot tại thời điểm lifecycle event; dữ liệu lịch sử trước
  migration được backfill theo giá trị còn có thể đọc, không khôi phục được tên
  station/severity cũ nếu chúng từng đổi trước migration.
- Retention giữ alert còn job chưa hoàn tất. Cursor/schema dùng chung được chuyển
  sang module trung lập nên `notifications` không còn import `alert-config`.
- Test tích hợp kiểm chứng 205 recipient qua nhiều lô, chạy lại không trùng,
  snapshot không đổi sau khi sửa station/rule, và retention giữ job pending.
  Ngày 2026-09-23: 59/59 file, 373/373 test; `pnpm verify`,
  `pnpm audit --prod` và migration trên `iot_test`/`iot_dev` đều đạt.
- Delivery là eventual: recipient active/scope được chốt ở lô worker đầu tiên.
  Nếu worker lỗi, job còn pending và sẽ thử lại ở lần poll sau.

### [Trung bình, dependency] Advisory `mysql2` từ Prisma tooling

- Override gián tiếp của Prisma đã được nâng từ `mysql2 3.22.0` lên bản vá
  `3.23.1`; không dùng `audit fix --force` và không đổi database provider.
- Verification ngày 2026-09-23: `pnpm why mysql2` chỉ ra `3.23.1`,
  `pnpm audit --prod` không còn advisory và `pnpm verify` đạt toàn bộ quality gate.

### [Trung bình, Phase C] Lease evaluator chưa được gia hạn giữa batch

- Evaluator nay gia hạn lease định kỳ trong lúc batch chạy và dừng ghi tiếp nếu
  heartbeat mất quyền sở hữu hoặc lỗi. Gia hạn chỉ thành công khi holder hiện tại
  vẫn còn lease chưa hết hạn, nên worker cũ không thể tự giành lại lease đã mất.
- Regression ngày 2026-09-23 xác minh heartbeat vẫn chạy khi upstream bị chặn;
  toàn bộ Checkpoint C1 đạt 11/11 test, full suite đạt 58/58 file và 372/372
  test, `pnpm verify` đạt.

### [Trung bình, Phase C] Lease evaluator chưa có fencing tại thời điểm ghi

- Mỗi ghi của scheduled evaluator nay khóa hàng `EvaluatorLease` và kiểm tra
  holder/expiry ngay trong cùng transaction trước khi sửa rule, evaluation state,
  alert hoặc continuation cursor. Contender phải chờ transaction hiện tại kết
  thúc; worker đã mất lease không thể tiếp tục ghi dựa trên cờ bộ nhớ cũ.
- Không đổi schema hoặc API công khai. Các lời gọi `evaluateRule` trực tiếp vẫn
  dùng được cho kiểm thử/nội bộ mà không giả làm scheduled lease holder.
- Regression ngày 2026-09-27 tái hiện lease hết hạn trong lúc PostgreSQL giữ
  transaction ghi: đỏ trước sửa, xanh sau sửa. Checkpoint C1 đạt 12/12, nhóm
  Phase C đạt 101/101, toàn backend đạt 59/59 file và 375/375 test; `pnpm verify`
  đạt format, typecheck, lint, Prisma generate và production build.

### [Thấp, quality gate] Weather contract không đạt ESLint

- Các capture group của timestamp Weather đã được chuẩn hóa bằng giá trị mặc
  định an toàn, bỏ toàn bộ non-null assertion bị ESLint chặn.
- Verification ngày 2026-09-23: focused Weather test đạt 28/28, toàn bộ backend
  đạt 58/58 file và 371/371 test; `pnpm verify` đạt format, typecheck, lint,
  Prisma generate và production build.

### [Triển khai Pi] API không gọi được upstream do mạng Docker bị cô lập

- Container API trước đây chỉ tham gia network `internal: true`, vì vậy không thể
  phân giải DNS hoặc kết nối API đo đất bên ngoài và có thể trả `502` dù request
  nội bộ vẫn khỏe.
- API hiện tham gia thêm network `edge`; PostgreSQL vẫn chỉ nằm trong network nội
  bộ. Xác minh ngày 2026-09-22: container API phân giải được
  `quantracgialai.metrostic.com`, health LAN và public ngrok đều trả `200`.
- API key upstream hợp lệ vẫn là điều kiện riêng để nhận dữ liệu thật; không lưu
  key hoặc response nhạy cảm vào tài liệu.

### [Frontend] Sidebar và thời gian Audit hiển thị sai

- Sidebar chỉ tô xanh route cụ thể nhất, không còn sáng đồng thời Dashboard và
  trang con. Timestamp Audit hiển thị theo `Asia/Ho_Chi_Minh` ở dạng
  `HH:mm DD/MM/YYYY`, vẫn giữ ISO gốc trong thuộc tính `dateTime`.
- Swagger chỉ hiện trong development vì backend cố ý không cung cấp `/docs` ở
  production; bản public không còn dẫn tester tới trang `404`.
- Verification ngày 2026-09-22: frontend đạt 27/27 test, build và lint.

### [Cao, production] Image build được nhưng backend không khởi động

- Smoke test phát hiện `dist/main.js` import `dotenv` nhưng package này từng nằm
  trong `devDependencies`, nên `pnpm prune --prod` làm container lỗi
  `ERR_MODULE_NOT_FOUND` ngay khi start.
- `dotenv` đã được chuyển sang runtime dependency; image cài OpenSSL/CA cho Prisma,
  chạy bằng user `node` và pass health/readiness trên cả `iot_dev` lẫn database
  restore cô lập.
- Verification ngày 2026-09-20: image Node 24 build thành công, runtime contract
  và OpenAPI frontend contract đều pass.

### [Cao, Phase C] Evaluator có race metadata, starvation và lỗi scheduler bị bỏ rơi

- Metadata mismatch giờ chỉ block đúng revision/unit/metadataRevision đã kiểm tra;
  transaction khóa rule và bỏ qua kết quả cũ nếu rule vừa được rebind.
- Khi hết lease budget giữa batch, cursor vẫn tiến tới cuối batch đã lấy để lượt sau
  quay vòng, tránh một nhóm station chậm giữ các rule phía sau vô thời hạn.
- Scheduled run bắt rejection tại biên timer và chỉ log loại lỗi an toàn, không tạo
  unhandled rejection hoặc đưa message nhạy cảm vào log.
- Regression ngày 2026-09-19: 2 test file, 11/11 test qua. Toàn backend đạt
  53/53 test file, 354/354 test; typecheck, lint, format và build đều đạt.

### [Phase C] Notification chưa được phát và chưa có inbox theo scope hiện tại

- Mỗi lifecycle event `OPENED`, `ACKNOWLEDGED`, `RESOLVED` tạo tối đa một
  notification cho từng Admin active và Farmer active đang thuộc farm tại thời
  điểm phát; Client Developer không nhận notification.
- `GET /api/v1/notifications` có filter `isRead`, cursor gắn filter, unread count
  và DTO an toàn. `PATCH /api/v1/notifications/:id` chỉ nhận `isRead`, giữ nguyên
  `readAt` khi retry cùng trạng thái và trả 404 cho recipient/scope khác.
- Farmer mất farm membership sẽ lập tức không còn đọc hoặc sửa notification cũ.
  Lifecycle event và recipient delivery được ghi trong cùng transaction.

### [Phase C] Retention chưa xử lý alert, notification và idempotency claim

- Lệnh retention hiện xóa theo batch notification quá 180 ngày, resolved alert
  quá 365 ngày và idempotency claim hết hạn. Unresolved alert cùng lifecycle
  evidence không bị age-purge; alert xóa sẽ cascade evidence theo schema.
- Integration test xác minh cả dữ liệu cũ bị xóa và dữ liệu ngay trong cửa sổ
  retention vẫn được giữ.

### [Phase C] Đã chốt ranh giới không ghi cấu hình xuống thiết bị

- `GET /api/v1/device-configurations/capability` cho Admin/Farmer trả cố định
  `NOT_AVAILABLE / DEVICE_CONTRACT_PENDING`; Client Developer bị từ chối.
- Quyết định bên cung cấp ngày 2026-09-28: web chỉ quản lý quy tắc/ngưỡng cảnh
  báo; hiệu chuẩn hoặc can thiệp cảm biến được thực hiện trực tiếp tại hiện
  trường. Không tạo bảng, payload, publish route hoặc giả lập acknowledgement
  thiết bị.
- `DEVICE_CONTRACT_PENDING` được giữ để tương thích với frontend hiện tại, không
  còn được hiểu là một hạng mục remote write đang chờ triển khai. IoT Config và
  Config Proposals chỉ được giải thích ranh giới này hoặc điều hướng sang Alert
  Center, không được cung cấp nút ghi thiết bị.

### [Test contract] OpenAPI allowlist thiếu route Phase C mới

- Full suite lần đầu phát hiện allowlist thiếu notification và device capability,
  dù route runtime đã hoạt động. Danh sách contract đã được cập nhật và suite
  toàn dự án chạy lại từ đầu.
- Verification ngày 2026-09-19: 52/52 test file, 351/351 test; typecheck, lint,
  format, build, migration status và diff check đều đạt. Coverage toàn backend:
  88.08% statements, 77.13% branches, 92.64% functions, 90.12% lines.
- Lượt này chỉ kiểm tra code/logic; không kiểm thử browser, tải, multi-instance,
  API thiết bị thật hoặc hạ tầng production. Các mục đó chưa được coi là đã xác
  minh và không được ghi nhận là bug nếu chưa có bằng chứng tái hiện.

### [Cao, Phase C] Evaluator và alert lifecycle chưa an toàn khi chạy đồng thời

- Evaluator dùng lease độc quyền, chặn hai lượt chạy trong cùng instance, không
  bỏ qua cursor khi hết deadline và chỉ đọc latest một lần cho mỗi station/batch.
- Rule bị đổi metadata sẽ chuyển sang `BLOCKED_METADATA`, đóng alert đang mở bằng
  lý do an toàn và không dùng mẫu dữ liệu không còn đúng revision/unit.
- Patch rule, evaluator và acknowledge/resolve khóa hoặc cập nhật có điều kiện;
  request đồng thời không còn tạo hai lifecycle event hoặc trả lỗi 500.
- Create idempotency replay giữ nguyên response kể cả khi metadata upstream sau
  đó tạm unavailable. Alert list có cursor opaque gắn với filter và DTO/OpenAPI
  đầy đủ station, condition, actor, unit và metadata revision.
- Verification ngày 2026-09-17: Phase C 8/8 file, 83/83 test; toàn backend 50/50
  file, 340/340 test; typecheck, lint, format, build và migration status đều đạt.
  Coverage toàn backend: 87.91% statements, 76.93% branches, 92.25% functions,
  89.82% lines.

### [Cao, API key] Key vừa tạo bị API Explorer từ chối

- Frontend trim `X-API-Key`, hiển thị rõ Copy thành công/thất bại và yêu cầu chọn
  ít nhất một Station đã được cấp; scope rỗng hiển thị `No access`.
- Backend cung cấp `GET /api/v1/developer/api-keys/available-stations` và giữ
  nguyên secret chỉ hiển thị một lần.
- Regression ngày 2026-09-14 tạo key qua HTTP rồi dùng chính secret đó gọi
  `GET /api/v1/client/stations`: HTTP 200 và chỉ trả station đúng scope (7/7 test).
- Frontend đạt 24/24 test, build và lint. Không ghi plaintext key vào tài liệu,
  log hoặc ảnh kiểm thử.

### [Trung bình] Bộ lọc history chấp nhận timestamp UTC không hợp lệ

- Browser và Weather contract dùng chung validator UTC nghiêm ngặt: yêu cầu đủ
  date-time kết thúc bằng `Z`, kiểm lại từng thành phần lịch và tối đa millisecond.
- Date-only, timezone offset và ngày không tồn tại bị từ chối; leap day hợp lệ
  vẫn được chấp nhận.
- Verification ngày 2026-09-11: focused gate 102/102 test; full suite và shuffle
  seed `20260911` cùng đạt 42/42 file, 251/251 test.

### [Trung bình, hardening] Weather response chưa giới hạn kích thước

- Weather client giới hạn response stream sau giải nén ở 1 MiB, kiểm cả
  `Content-Length` và số byte thực đọc; reader bị hủy ngay khi vượt ngưỡng.
- Response hợp lệ về schema nhưng quá lớn trả safe `502 UPSTREAM_UNAVAILABLE`,
  không đưa body hoặc credential vào response.
- Verification ngày 2026-09-11: focused gate 102/102 test; coverage Weather client
  94.38% statements, 93.33% branches và 97.18% lines.

### [Thấp, contract] Lỗi HTTP trước controller chưa đồng nhất

- `400`, `413` và `415` từ framework được ánh xạ về `VALIDATION_ERROR` với thông
  báo trung tính riêng; payload, stack và đường dẫn nội bộ không bị phản chiếu.
- Verification ngày 2026-09-11: production-facing focused gate đạt; full suite
  42/42 file, 251/251 test.

### [Cao, production] Liveness bị global rate limit chặn khi burst

- `GET /api/v1/health` được miễn limiter ứng dụng để load balancer không đánh dấu
  sai instance khỏe trong lúc traffic tăng. Các route người dùng vẫn chịu global
  limiter; regression chuyển kiểm tra `429` sang `POST /api/v1/auth/login`.
- Burst 120 request health đồng thời hiện trả 120 lần `200`.
- Verification ngày 2026-09-11: production-resilience và security-headers 15/15;
  full suite 42/42 file, 242/242 test.
- Shared limiter/proxy boundary cho triển khai nhiều instance vẫn là hạng mục vận
  hành riêng, không được coi là đã giải quyết bởi thay đổi này.

### [Trung bình] Reset password đồng thời phát nhiều mật khẩu hoặc trả 500

- Reset cùng một user dùng PostgreSQL transaction advisory lock và cửa sổ chống
  cấp lặp 30 giây. Một request thắng trả `201`; request chồng lấn hoặc vừa hoàn
  tất trả `409`, không phát hai mật khẩu tạm cùng lúc.
- Sau cửa sổ chống lặp, Admin vẫn có thể cấp lại mật khẩu tạm khi người dùng làm
  mất mật khẩu trước; không cần đọc lại secret cũ và không đổi schema.
- Regression chạy ba lượt liên tiếp cùng scope tests: mỗi lượt 18/18 test; full
  suite 42/42 file, 242/242 test ngày 2026-09-11.

### [Trung bình] Gán Farm/Station scope đồng thời trả 500

- Các transaction idempotent cấp/gỡ quyền retry hữu hạn tối đa 5 lần, chỉ với
  `P2002` (tranh khóa duy nhất) và `P2034` (serialization conflict). Lỗi khác vẫn
  fail closed, không bị retry che khuất.
- Bốn request đồng thời cho cùng farm membership hoặc station grant đều trả
  `200`; database chỉ có một bản ghi quyền.
- Regression chạy ba lượt liên tiếp cùng reset tests: mỗi lượt 18/18 test; full
  suite 42/42 file, 242/242 test ngày 2026-09-11.

### [Test infrastructure] API-key authentication test phụ thuộc thứ tự

- Shuffle seed `20260910` từng làm case API key hợp lệ fail vì case trước đó đã
  disable owner/xóa grant dùng chung.
- Đã khôi phục trạng thái key, owner và grant trong `beforeEach`; cùng seed hiện
  đạt 5/5. Thay đổi chỉ nằm ở test, không đổi behavior production.
- Seed `424242` tiếp tục phát hiện `identity/users` dựa vào user do case khác tạo
  và `station-data/client` dựa vào thứ tự fixture latest/history. Các case user
  đã tự tạo prerequisite; upstream helper đã hỗ trợ fixture chọn theo request
  path. Cùng seed hiện đạt toàn bộ 42 file và 234 test.

### [Regression] Các production-facing boundary mới

- Thêm kiểm tra malformed/oversized body, CORS, bearer dị dạng, duplicate
  `X-API-Key`, HEAD auth bypass, concurrent burst và database unavailable thực.
- Thêm kiểm tra hai request rotate cùng API key chỉ có một request tạo credential;
  kết quả xác minh là `201` và `409`.

### [Trung bình] Integration tests tranh chấp cùng database

- Vitest chạy các test file tuần tự bằng `fileParallelism: false`; không dùng retry
  để che race và vẫn giữ database test riêng `/iot_test`.
- Verification ngày 2026-09-08: lệnh mặc định `pnpm test` đạt ba lần liên tiếp,
  mỗi lần 33/33 file và 150/150 test.

### [Trung bình] Reset password chưa có rate limit riêng

- Route reset password có giới hạn riêng 10 request/phút/IP; request thứ 11 trả
  `429 RATE_LIMITED`.
- Regression test: `test/integration/identity/users.spec.ts`.

### [Trung bình] Admin chưa đọc được quyền Farm/Station hiện tại của user

- `GET /api/v1/admin/users/:userId` trả thêm `assignments.farmIds` và
  `assignments.stationIds`, sắp xếp ổn định và chỉ lấy từ quyền hiện tại.
- User list và `/auth/me` vẫn dùng DTO gọn cũ; response không lộ upstream code,
  hash hoặc database record.
- Regression test: `test/integration/identity/users.spec.ts`.

### [Trung bình] Database unavailable chưa có contract 503

- `HttpErrorFilter` ánh xạ riêng các mã kết nối/timeout Prisma đã xác minh
  (`P1001`, `P1002`, `P1008`, `P1017`, `ECONNREFUSED`) sang HTTP 503
  `DATABASE_UNAVAILABLE` với thông báo công khai trung tính.
- Lỗi Prisma không thuộc nhóm kết nối vẫn trả 500 `INTERNAL_ERROR`; raw exception
  không được đưa vào response.
- Regression test: `src/common/errors/http-error.filter.spec.ts`.

### [Cao] Mật khẩu tạm có thể bị mất khi tạo hoặc reset tài khoản

- Frontend đã thay thông báo dễ bỏ qua bằng modal một lần cho cả create và reset: hiển thị đúng email, có Copy, không đóng khi click ra ngoài và chỉ bật Done sau khi xác nhận đã lưu.
- Credential vẫn chỉ nằm trong state tạm thời, không được lưu vào localStorage, URL hoặc log; backend tiếp tục chỉ lưu password hash.
- Người nhận vẫn phải đổi mật khẩu ngay lần đăng nhập đầu. Link kích hoạt qua email là cải tiến tương lai, không phải API đọc lại mật khẩu.
- Verification tự động: frontend 9/9 test, build và lint không có lỗi ngày 2026-09-07. Cần spot-check bằng trình duyệt với tài khoản test trước khi merge.

### [Cao] Super Admin có thể tự reset và tự khóa tài khoản

- Backend từ chối authority holder tự reset qua HTTP bằng `409 CONFLICT`; việc khôi phục khẩn cấp dùng CLI riêng.
- Frontend khóa nút reset trên chính tài khoản đang đăng nhập và giải thích phải dùng recovery command.
- Verification: integration users 9/9 pass; backend typecheck/lint/build và frontend test/build/lint đạt ngày 2026-09-07.

### [Cao] Update role/status không đổi vẫn thu hồi credential

- Đã sửa `src/identity/identity.service.ts`: chỉ thu hồi session/API key khi role hoặc status thực sự thay đổi.
- Regression test: `test/integration/identity/users.spec.ts` bảo vệ trường hợp update no-op.

### [Trung bình] Login/change-password dùng snapshot account cũ khi có cập nhật đồng thời

- Đã dùng conditional write gắn thao tác với password hash và trạng thái account hiện tại.
- Authentication integration tests đã kiểm chứng.

### [Trung bình] Transfer Super Admin kiểm tra mật khẩu ngoài transaction

- Authority holder và password được đọc/kiểm tra lại trong serializable transaction.
- Concurrent-transfer tests đã kiểm chứng.

### [Trung bình] Audit metadata có thể chứa credential

- Đã thêm sanitizer trung tâm: redact key nhạy cảm, giới hạn độ sâu và số phần tử mảng.
- Có test riêng cho `sanitizeAuditMetadata`.

### [Thấp] Refresh race bị báo nhầm token replay

- Luồng thua race đọc lại session và chỉ báo replay khi rotation thực sự thắng.
- Có deterministic race test.

### [Thấp] Disabled principal có thể đi vào station-scope service

- `ScopeService` đã fail closed trước khi lookup role/scope.
- Scope integration test đã kiểm chứng.

### [Thấp] OpenAPI đánh dấu sai temporary password

- Schema đã đổi sang `readOnly` và có contract test.

### [Khôi phục] Chưa có công cụ lấy lại Super Admin khi mất mật khẩu tạm

- Đã thêm CLI `pnpm db:recover-super-admin -- --email <email-super-admin>`.
- CLI chỉ chấp nhận authority holder, nhập mật khẩu hai lần qua prompt ẩn, mở khóa account, thu hồi session và ghi audit `SUPER_ADMIN_EMERGENCY_RECOVERY`.
- Verification: 2/2 recovery integration tests, typecheck, lint và build đều đạt ngày 2026-09-06.

### [Trung bình, Frontend] Nút Copy credential và response thất bại im lặng

- Đã gom thao tác clipboard vào helper dùng chung, chờ Promise và bắt trường hợp
  trình duyệt từ chối quyền.
- API key secret, mật khẩu tạm, API Explorer và API Docs đều báo `Copied` khi
  thành công; khi thất bại sẽ hướng dẫn chọn/copy thủ công. Credential vẫn chỉ
  ở state tạm, không lưu localStorage/sessionStorage và không gửi telemetry.
- Verification ngày 2026-09-14: frontend 24/24 test, build và lint đạt.
