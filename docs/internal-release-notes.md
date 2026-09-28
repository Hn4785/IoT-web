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
- Chưa gắn `live-verified` chỉ dựa trên xác nhận bằng lời. Việc còn lại là đối
  chiếu danh sách/mã trạm, timestamp đang tăng, trường đo và đơn vị giữa API
  provider, backend và giao diện; bằng chứng không được chứa API key.

### Phạm vi thay đổi lần này

- Chỉ cập nhật tài liệu và TODO để thống nhất quyết định sản phẩm; chưa đổi route,
  API, DTO, database hoặc hành vi runtime.
- Backend vẫn trả `NOT_AVAILABLE / DEVICE_CONTRACT_PENDING` cho route capability
  hiện có nhằm giữ tương thích. Mã reason cũ không còn được hiểu là cam kết sẽ
  triển khai remote write.
- Không cần chạy lại test/build vì không có mã nguồn hoặc cấu hình runtime thay
  đổi; đã kiểm tra diff và tính nhất quán giữa tài liệu frontend/backend.

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
