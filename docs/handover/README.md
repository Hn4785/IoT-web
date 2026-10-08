# Báo cáo bàn giao AgriSense

## Thông tin tài liệu

| Trường                   | Nội dung                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| Mã tài liệu              | AGR-HO-001                                                                                |
| Phiên bản                | 1.0 ngày 08/10/2026                                                                       |
| Mục đích                 | Bàn giao logic ứng dụng, mã nguồn, cấu hình mẫu, hướng dẫn tái tạo và bằng chứng kiểm thử |
| Người chuẩn bị           | Nhóm phát triển; Codex tổng hợp và review, Antigravity hỗ trợ đối chiếu kỹ thuật          |
| Người giao và người nhận | Chưa điền tên/xác nhận; bên giao và bên nhận bổ sung khi tiếp nhận                        |
| Trạng thái               | Bản tài liệu bàn giao; chưa phải biên bản nghiệm thu có chữ ký                            |
| Lịch sử                  | 1.0 tổng hợp bản code đã phát hành 06/10/2026 và cập nhật docs 07–08/10/2026              |

## 1 Phạm vi và kết luận

AgriSense là ứng dụng theo dõi đất nông nghiệp. Phần bàn giao tập trung vào tính
đúng của logic: đăng nhập và quyền truy cập; kết nối/chia sẻ nguồn; đọc và lưu
số đo; hiển thị lịch sử; cảnh báo và thông báo trong ứng dụng. Một ứng dụng có
thể chạy trên Pi/local hoặc server. Khi chuyển máy, dữ liệu được chuyển bằng
backup/restore có kiểm soát; không có đồng bộ Pi và server chạy song song.

Các luồng chính đã qua kiểm thử local và browser dùng dữ liệu thử cô lập.
Người dùng đã phản hồi website chạy ổn trên server ngày 06/10/2026. Tuy nhiên,
một lỗi P2 về cửa sổ lịch sử rỗng còn mở, và chưa có bằng chứng đầy đủ về thông
báo mới tự nhiên sau phục hồi provider. Không kết luận mọi tình huống đều đạt
hoặc lịch sử đã đủ 90 ngày. Các vấn đề này được nêu tại mục 6 để bên nhận theo dõi.

### Phiên bản áp dụng

- Repository: [Hn4785/IoT-web](https://github.com/Hn4785/IoT-web), nhánh `BE` và `FE` độc lập.
- Code BE đã kiểm chứng: `ec02462bdb0050e05778e32c1cd03bfec8d86b29`.
- Code FE đã kiểm chứng: `5dbeea53d40bc8b007fff53c58a7623b7fdd8626`.
- Runtime đã ghi nhận 06/10/2026: API `26df9ddc20c41aee250d7be3ef4815908ed4ebf4`, web tag `aea78f5-arm64`.
- Các commit tài liệu sau đó không đồng nghĩa thay image đang chạy. Không ghi tag web là digest; bên nhận cần digest bất biến đúng CPU trước triển khai.
- [Release record](../internal-release-notes.md) là nơi duy nhất ghi kết quả và cập nhật phiên bản. Kết quả cũ được giữ theo ngày, không đổi thành kết quả test mới.

### Chức năng và vai trò

| Chức năng          | Phạm vi bàn giao                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Tài khoản và phiên | Đăng nhập, đổi mật khẩu bắt buộc, refresh, logout; tạo/sửa/khóa và reset tài khoản theo quyền                                   |
| Super Admin        | Chuyển authority, xem audit; recovery tại CLI bởi người quản trị máy                                                            |
| API Sources        | Thêm nguồn, kiểm tra kết nối, quản lý quyền xem station; tài khoản được share chỉ thao tác trong quyền được cấp                 |
| Farmer             | Farm → Plot → Station; dashboard, số đo cuối, phân tích/history/report, CSV, cảnh báo và notifications trong scope              |
| Client Developer   | Tạo/copy/rotate/revoke API key; API Explorer và client endpoints theo station được cấp                                          |
| Dữ liệu bền vững   | Thu thập nền không cần mở browser; raw tối đa 90 ngày, snapshot cuối riêng; phân biệt upstream/stored/cache và dữ liệu cũ/thiếu |
| Cảnh báo           | Rule theo metadata/đơn vị hợp lệ; fresh-only evaluation, acknowledge/resolve và notification không nhân đôi do retry            |

Admin không được xem audit chỉ dành cho Super Admin. Menu bị ẩn không thay thế
quyền backend. Quyền nguồn/station quản lý tại API Sources; User Management
quản lý tài khoản và hiển thị scope, không phải nơi sửa chia sẻ nguồn hiện hành.

Ngoài phạm vi: điều khiển/hiệu chuẩn thiết bị từ xa, SMS/email, tự phục hồi mật
khẩu qua email, dự đoán/khuyến nghị nông học, UI CRUD Farm/Plot/Station, đồng bộ
hai chiều và tự triển khai lên server chưa xác định. MFA/SSO được bên yêu cầu
loại khỏi đợt giao này; không mô tả là đã triển khai. Pi chỉ là môi trường demo,
không đưa vấn đề Wi-Fi/tunnel nội bộ vào danh sách lỗi logic của sản phẩm.

## 2 Tài liệu kỹ thuật

### Kiến trúc và điểm tra cứu

Browser React gọi REST API NestJS/Fastify. Backend kiểm tra phiên/API key và
station scope trước khi đọc PostgreSQL hoặc gọi provider. Collector nền lấy dữ
liệu thật và lưu vào PostgreSQL; giao diện đọc DTO, không đọc trực tiếp database.
Luồng dữ liệu chính là provider → backend → PostgreSQL → backend → frontend.
Không cần browser để collector hoạt động.

| Thành phần                   | Nguồn tra cứu                                                                                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend và trạng thái trang | [Hướng dẫn tích hợp](../integration/README.md), `src/api`, `src/services`, `src/hooks`, `src/pages`                                                                                                                               |
| API và lỗi                   | [BE capability map](https://github.com/Hn4785/IoT-web/blob/BE/CAPABILITY-MAP.md), controller và contracts của từng module; OpenAPI ở dev/test                                                                                     |
| Database và migration        | [Schema](https://github.com/Hn4785/IoT-web/blob/ec02462bdb0050e05778e32c1cd03bfec8d86b29/prisma/schema.prisma), [13 migration](https://github.com/Hn4785/IoT-web/tree/ec02462bdb0050e05778e32c1cd03bfec8d86b29/prisma/migrations) |
| Hợp đồng lưu/thu thập        | [Station data spec](https://github.com/Hn4785/IoT-web/blob/BE/docs/superpowers/specs/2026-09-02-station-data-design.md) và mục dữ liệu bền vững trong hướng dẫn tích hợp                                                          |

REST dùng prefix `/api/v1`. Thành công là `{ success: true, data: ... }`; lỗi là
`{ success: false, error: { code, message }, requestId }`. Các thời điểm lưu UTC
và trả ISO 8601. Chi tiết endpoint/DTO lấy từ controller/contracts/OpenAPI, không
tạo hợp đồng thứ hai trong báo cáo.

### Dữ liệu và sự cố nguồn

| Bảng dữ liệu đất           | Nội dung                                           |
| -------------------------- | -------------------------------------------------- |
| `SoilReading`              | Số đo raw theo nguồn/trạm/chỉ số/thời điểm đo      |
| `SoilLatestReading`        | Snapshot cuối từng chỉ số của trạm                 |
| `SoilHistoryCoverage`      | Dải lịch sử đã thu thập theo chỉ số                |
| `SoilCollectionCheckpoint` | Watermark và trạng thái retry/collection theo trạm |

Bốn bảng liên kết station của nguồn. ERD và khóa chính/FK nằm trong hướng dẫn
tích hợp và schema được dẫn ở mục Kiến trúc và điểm tra cứu; không xuất bản ghi database vào báo cáo.

Raw history giữ tối đa 90 ngày, snapshot cuối lưu riêng. Dữ liệu đã lưu có thể
được đọc sau khi upstream nghỉ hoặc backend restart, nhưng vẫn phải qua quyền
truy cập. Response cũ bị chặn ghi đè thế hệ fetch mới; dedup tránh thêm trùng số
đo. Retention/capacity không xóa sớm raw còn trong thời hạn chỉ để vượt giới hạn.

Giữ `observedAt` (thời điểm đo) và `fetchedAt` (thời điểm lấy), provenance và
coverage. `Stored` là dữ liệu bền vững; `Cache` là cache; `Last known` là kết quả
trang giữ lại cho đúng query khi lỗi tạm thời. Những nhãn này không có nghĩa đang
đo trực tiếp. Mất quyền hoặc đổi phiên/nguồn phải bỏ dữ liệu giữ lại.

History raw mỗi request tối đa 7 ngày; aggregate tối đa 90 ngày. Đây là giới
hạn truy vấn, khác thời hạn lưu raw. Collector mặc định 120 giây, tối đa 2 trạm
đồng thời. Giới hạn bảo vệ là 2 triệu số đo/trạm và 10 triệu tổng; không thay thế
đo tải thực tế trên server của bên nhận.

Chỉ mẫu upstream fresh và binding/rule hợp lệ được đánh giá cảnh báo tự động.
Backfill, snapshot/stored không được coi như một lần đo mới để tạo cảnh báo.
Lịch sử thiếu/rỗng phải được mô tả trung thực, không lấp bằng số liệu mẫu.

## 3 Cài đặt và tái tạo

### Chạy local thông thường

Chuẩn bị Git, Docker Desktop, Node.js `>=24.17.0 <25`, pnpm `11.19.0`. Nhánh BE
dùng `pnpm-lock.yaml`; FE dùng `package-lock.json`. Không đổi package manager
hoặc bỏ lockfile để xử lý lỗi cài đặt. Lệnh dưới đây dùng PowerShell; đường dẫn
chỉ là ví dụ, có thể chọn ổ khác.

```powershell
git clone --branch BE https://github.com/Hn4785/IoT-web.git IoT-api
git clone --branch FE https://github.com/Hn4785/IoT-web.git IoT-web
git -C IoT-api checkout --detach ec02462bdb0050e05778e32c1cd03bfec8d86b29
git -C IoT-web checkout --detach 5dbeea53d40bc8b007fff53c58a7623b7fdd8626
cd IoT-api
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Mở `.env`, thay secret và cấu hình database theo mẫu. Tạo thư mục riêng cho
`POSTGRES_DATA_DIR`; không trỏ vào source hoặc dữ liệu hệ thống khác. Cài đặt mới:

```powershell
docker compose up -d postgres
docker compose ps
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:status
pnpm db:bootstrap-super-admin -- --email admin@example.com
pnpm dev
```

Chỉ chạy migration khi PostgreSQL healthy; bootstrap chỉ khi chưa có tài khoản/
authority. Nhập mật khẩu bằng prompt ẩn. Mở terminal mới tại thư mục FE:

```powershell
npm ci
npm run dev
```

Mở `http://localhost:5173`; mặc định `/api/v1` proxy tới API cổng 3000. Kiểm tra
`http://localhost:3000/api/v1/health`, rồi đăng nhập và thêm nguồn thật. Không seed
demo hoặc nhập DB test để làm dữ liệu onboarding. Các thao tác làm thay đổi
authority/reset/retention để kiểm thử phải dùng môi trường cô lập.

### Chạy website và chuyển dữ liệu

Hướng dẫn server dùng Compose, tools image chạy migration/bootstrap, runtime
non-root, same-origin và HTTPS nằm tại
[Cài đặt và khôi phục](https://github.com/Hn4785/IoT-web/blob/BE/docs/operations/DELIVERY-RECOVERY.md).
[Local runbook](https://github.com/Hn4785/IoT-web/blob/BE/docs/operations/LOCAL-RUNBOOK.md)
giữ các lệnh Windows thông thường. Không đưa công cụ AI/worktree vào quy trình bên nhận.

Giữ dữ liệu khi cập nhật; không dùng `down -v`, reset schema hay restore đè máy
nguồn. Khi chuyển máy, backup phải được mã hóa, khóa đi kênh riêng, restore vào
database mới và kiểm tra quyền/ciphertext/latest/history trước cutover. RPO 24h,
RTO 4h, giữ 7 ngày/4 tuần là mục tiêu đã chấp nhận; chưa có số đo trên hạ tầng bên nhận.

Domain/TLS/proxy, digest image, nơi lưu backup, người giữ khóa và capacity do bên
nhận xác định. Không phải tất cả là yêu cầu logic đã giao cho nhóm thực tập;
báo cáo giữ chúng để bên nhận tái tạo an toàn, không gọi là đã nghiệm thu.

## 4 Hướng dẫn sử dụng

Hướng dẫn theo vai trò và kết quả mong đợi nằm tại
[README frontend](../../README.md#11-hướng-dẫn-theo-vai-trò). Người dùng đăng nhập,
chọn đúng nguồn/trạm và kiểm tra thời điểm dữ liệu trước khi đánh giá số đo.

Soil Dashboard hiển thị số đo cuối và xu hướng ngắn. Historical Analysis so sánh
lịch sử theo trạm/chỉ số/khoảng thời gian; không phải khẳng định tương quan thống
kê nếu chỉ có biểu đồ. History Report lọc lịch sử và xuất CSV từ phần đã tải.
Ngày lọc dùng ranh giới UTC; trục biểu đồ dùng múi giờ máy người xem. Một số nhãn
Last fetch/Last Checked dùng UTC+7. Đơn vị dùng DTO hoặc cấu hình canonical đã
chốt; DTO unit/sensor/depth có thể null, không tự dựng metadata chưa được cấp.

API Sources kiểm tra kết nối khi vào/làm mới trang trong quyền được cấp; người
được share không được đọc key của chủ nguồn. Alert Center quản lý rule và lifecycle;
Notifications là inbox trong ứng dụng, không phải email/SMS. Client API key khi
create/rotate và mật khẩu tạm chỉ trả một lần; key nguồn chỉ chủ nguồn được
reveal sau xác thực lại. Lưu secret qua kênh được phép; không đưa vào báo cáo.

Không đính kèm ảnh phiên đăng nhập hay dữ liệu thật chưa được che thông tin. Bản
1.0 dùng các bước thao tác và nguồn code; không dùng ảnh fixture để nhận là ảnh
provider thật. Nếu bên nhận cần hình minh họa, chụp đúng phiên bản và ghi rõ môi trường.

## 5 Kiểm thử và bằng chứng

### Kết quả đã ghi nhận

Các số dưới đây thuộc release ngày 06/10/2026, không phải toàn bộ suite được chạy
lại khi viết báo cáo ngày 08/10. Tham chiếu chi tiết tại release record và các test
trong Git; dữ liệu fixture dùng khi kiểm thử không phải tài sản dữ liệu bàn giao.

| Nhóm                        | Kết quả và giới hạn                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Backend local               | 93 file, 621 tests; verify và secret scan đạt                                                                             |
| Coverage backend            | Statements 85.78%, branches 77.27%, functions 91.82%, lines 88.52%                                                        |
| Frontend                    | 242 tests; lint/typecheck/build đạt                                                                                       |
| Browser mock                | 14/14, desktop 1440 và mobile 390; không gọi provider thật                                                                |
| Browser HTTP với backend/DB | 14/14 trên fixture cô lập; login/quyền/audit/notification/API key/native CSV                                              |
| CI và image                 | Linux và Windows-specific được ghi riêng; native amd64/arm64 và smoke trong release record                                |
| Dependency                  | Bản vá Fastify/Nest/brace-expansion đã giao; audit ngày release không có advisory đã biết, không phải penetration test    |
| Dữ liệu thật                | Provider xác nhận nguồn 28/09; readings/observedAt đã tiến sau rollout; chưa chứng minh đủ backfill hoặc notification mới |

### Truy vết yêu cầu và kiểm thử

Các đường dẫn sau tương đối với nhánh BE/FE đã chốt ở mục Phiên bản áp dụng.

| Yêu cầu                            | Test hoặc bằng chứng cần tra cứu                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Phiên và tài khoản                 | BE `test/integration/auth/`, `test/integration/identity/`; FE `test/apiClientRefresh.test.ts` và `e2e/real-backend.spec.ts` |
| Quyền nguồn và station             | BE `test/integration/data-sources/access-management.spec.ts`, `test/integration/station-data/stored-scope.spec.ts`          |
| Lưu số đo và snapshot              | BE `reading-ingest.spec.ts`, `reading-storage.spec.ts`, `durable-latest.spec.ts` trong station-data tests                   |
| History, giới hạn và retention     | BE `durable-history.spec.ts`, `reading-retention.spec.ts`, `reading-capacity.spec.ts`, `raw-history-storage.spec.ts`        |
| Chặn phản hồi cũ, retry/restart    | BE `collection-fence.spec.ts`, `collection-boundaries.spec.ts`, `soil-collection.spec.ts`, `write-recovery.spec.ts`         |
| Fresh-only alert và race binding   | BE `test/integration/alert-config/fresh-binding.spec.ts`, `checkpoint-c1.spec.ts`                                           |
| Delivery không trùng               | BE `notification-delivery.spec.ts`, `notifications.spec.ts` trong alert-config tests                                        |
| UI online/stored/empty/denied, CSV | FE `test/`, `e2e/smoke.spec.ts`, bộ browser backend acceptance                                                              |
| Kiểm tra cấu hình và backup        | BE `test/deployment-preflight.spec.ts`, `test/backup-envelope.spec.ts`, checkpoint F deployment/restore                     |

Trên máy QA riêng: BE dùng `pnpm verify`, `pnpm test:coverage`,
`pnpm audit --prod --audit-level=high`, `pnpm security:secrets`; FE dùng `npm ci`,
`npm test`, `npm run lint`, `npm run build`. Browser dùng `npm run test:e2e` theo
hướng dẫn tích hợp. Bộ backend acceptance cần flag và DB fixture riêng; nếu skip
do thiếu điều kiện thì phải ghi chưa chạy, không tính đạt. Không chạy bài test
xóa/reset/transfer hay fault injection trên database đang vận hành.

## 6 Tồn đọng và ghi chú bảo mật

### Tồn đọng có ảnh hưởng

| Mục                            | Tình trạng và tác động                                                                                                    | Xử lý tiếp theo                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| P2 cửa sổ history cũ rỗng      | Response schema hợp lệ `data: []` bị normalizer từ chối, watermark không tiến; latest vẫn lưu nhưng backfill có thể thiếu | Chốt xử lý cửa sổ rỗng không giả coverage/readings; regression traversal/scope/retry/restart và cửa sổ có dữ liệu |
| Notification thật sau phục hồi | Chưa quan sát lifecycle mới tự nhiên; fixture đã đạt không thay thế bằng chứng này                                        | Kiểm tra khi provider hoạt động và có mẫu fresh vượt/thoát ngưỡng thật, không kích giả trên Pi                    |
| UI bố cục cũ                   | Một nhóm trang có ghi nhận lịch sử; chưa đủ ảnh trước/sau toàn bộ nhóm để đóng bằng chứng                                 | Đối chiếu phạm vi cụ thể nếu bên nhận yêu cầu; không ghi là lỗi logic database                                    |
| Tài nguyên và giấy phép        | Chưa có LICENSE/NOTICE hoặc chủ sở hữu được ghi rõ cho mọi asset                                                          | Bên giao xác nhận quyền sử dụng trước phân phối thương mại                                                        |
| Server của bên nhận            | Target/TLS/proxy, backup custody và capacity chưa được nghiệm thu                                                         | Bên nhận lựa chọn và xác nhận; không đoán cấu hình và không thay bằng demo Pi                                     |

Sổ lỗi chính: [Backend follow-up](https://github.com/Hn4785/IoT-web/blob/BE/docs/reviews/2026-09-04-backend-follow-up.md).
Những lỗi đã sửa giữ số thứ tự và bằng chứng retest trong sổ 15 cột; không xóa
lịch sử hoặc đổi số để trông như không còn lỗi. Tab Trung chỉ chứa những mục
đã được chọn/đối chiếu, không mặc định mọi dòng local đã đồng bộ.

### Bảo mật đã có và giới hạn

Mật khẩu dùng hash; access token phía browser ở memory, refresh qua cookie.
Backend kiểm tra quyền resource và API key theo scope. Key nguồn mã hóa trong
database và có reveal với xác thực lại cho người có quyền. Client API key chỉ
trả plaintext khi create/rotate, không đọc lại từ danh sách. Public response dùng DTO,
không trả database record, upstream secret hay stack trace. Audit dành riêng
Super Admin và không chứa secret.

Recovery chỉ đổi mật khẩu/mở khóa tài khoản đang giữ Super Admin, thu hồi phiên
và ghi audit; không chuyển người giữ authority. Chuyển authority là thao tác riêng.
MFA/SSO bị loại khỏi scope, không có email/SMS recovery. Rate limiter hiện
process-local phù hợp kiến trúc một instance; multi-instance/shared limiter là
mở rộng khác. Audit append-only là convention ứng dụng, chưa phải quyền database
cấm sửa tuyệt đối. Không nhận diện dependency audit là chứng nhận an toàn công khai.

Không bàn giao `.env`, token/key thật, private key hoặc dump qua Git/Word.
Secret và dữ liệu thật chỉ chuyển khi có người nhận và kênh bảo vệ được chấp nhận.
Backup encrypted không thay thế trách nhiệm giữ khóa và kiểm tra restore.

## 7 Danh mục bàn giao và xác nhận

### Tám nhóm tài sản

| Nhóm                    | Đường dẫn chính                                                                                               | Trạng thái                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Source code             | Nhánh BE/FE, `src/`, controller/contracts/services/hooks/pages; commit mục Phiên bản áp dụng                  | Có code và test tái tạo; runtime image không chứa fixture                 |
| Database                | BE `prisma/schema.prisma`, `prisma/migrations/`                                                               | Có schema và 13 migration; không tự xuất dữ liệu thật                     |
| Hình ảnh và tài nguyên  | FE `public/favicon.svg`, `public/icons.svg`, `src/assets/hero.png`, `react.svg`, `vite.svg`                   | Có file; ownership/license cần xác nhận                                   |
| Cấu hình môi trường     | BE/FE `.env.example`; BE `deploy/.env.example`, `compose.yaml`, `deploy/compose.yaml`; FE `deploy/nginx.conf` | Mẫu không dùng nguyên trạng cho production; secret chuyển riêng           |
| Dependencies            | BE `package.json`, `pnpm-lock.yaml`; FE `package.json`, `package-lock.json`                                   | Giữ đúng lockfile và phiên bản runtime                                    |
| Cài đặt và triển khai   | README FE; BE hai runbook tại `docs/operations/`                                                              | Hướng dẫn local trước; server/backup là thủ tục riêng                     |
| Test case và kết quả    | BE `src/**/*.spec.ts`, `test/`; FE `test/`, `e2e/`; release record/checkpoints                                | Bàn giao mã test, không bàn giao database/dữ liệu fixture đã sinh         |
| Lỗi và chức năng còn mở | Sổ lỗi BE, `tasks/todo.md`, mục 6 và release record                                                           | Có phân biệt defect, thiếu bằng chứng, ngoài scope và bên nhận quyết định |

### Đầu mối tài liệu

1. [README frontend và hướng dẫn sử dụng](../../README.md).
2. [Hướng dẫn tích hợp kỹ thuật](../integration/README.md).
3. [Cài đặt server và khôi phục](https://github.com/Hn4785/IoT-web/blob/BE/docs/operations/DELIVERY-RECOVERY.md).
4. [Lệnh local Windows](https://github.com/Hn4785/IoT-web/blob/BE/docs/operations/LOCAL-RUNBOOK.md).
5. [Release record](../internal-release-notes.md) và sổ lỗi được dẫn ở mục 6.

Bản Word `AgriSense-Ban-giao-v1.0.docx` là bản xuất từ báo cáo này, không phải
một nguồn hướng dẫn kỹ thuật cập nhật độc lập. Khi code/contract đổi, cập nhật
nguồn Markdown và revision rồi xuất lại Word. Không giữ nhiều bản backup không
được kiểm soát trong thư mục bàn giao. Không xóa spec/checkpoint lịch sử còn được dẫn.

### Xác nhận tiếp nhận

| Nội dung                                             | Người phụ trách                             | Xác nhận                             |
| ---------------------------------------------------- | ------------------------------------------- | ------------------------------------ |
| Nhận source/docs đúng BE/FE revisions                | Bên giao và bên nhận điền tên               | Chờ xác nhận                         |
| Đọc phạm vi và các tồn đọng mục 6                    | Bên nhận                                    | Chờ xác nhận                         |
| Tái tạo local, đăng nhập và quyền                    | Bên nhận thực hiện theo runbook             | Chờ kết quả                          |
| Cấu hình server và secret nếu triển khai             | Quản trị viên bên nhận                      | Chưa xác định target                 |
| Dữ liệu thật, backup, khóa và cutover nếu chuyển máy | Người giữ dữ liệu/khóa do bên nhận chỉ định | Chưa chuyển trong đợt viết tài liệu  |
| Quyền sử dụng tài nguyên                             | Bên giao xác minh với chủ sở hữu            | Chờ xác nhận                         |
| Biên bản giao nhận, ngày và chữ ký                   | Người giao / người nhận                     | Để trống đến khi có xác nhận thực tế |
