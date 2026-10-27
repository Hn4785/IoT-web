# AgriSense Frontend

Phiên bản ứng dụng: 3.0.0. Cập nhật tài liệu: 12/10/2026.

Ứng dụng web giám sát đất nông nghiệp, sử dụng React, TypeScript và Vite.
Frontend hiển thị trạm, số đo, lịch sử, cảnh báo và thông báo theo quyền tài
khoản. Backend NestJS/PostgreSQL xác thực, phân quyền và lưu dữ liệu; frontend
không kết nối database hoặc gọi trực tiếp nguồn cảm biến bằng khóa của chủ nguồn.

Nhánh tích hợp `codex/monorepo-final` đặt giao diện trong `frontend/` và backend
trong `backend/`. Hai mốc nhập vào là frontend `7592952` và backend `085a4b9`,
kế thừa logic frontend `7650b6f` và backend `abd4080` ngày 11/10/2026.
Việc gộp thư mục không thay đổi chức năng v3.0.

## 1. Phạm vi hiện tại

- Đăng nhập, khôi phục phiên, đổi mật khẩu và đăng xuất; chuyển đúng trang theo
  Admin, Farmer hoặc Client Developer. Super Admin là authority của một Admin.
- Quản lý tài khoản, chuyển authority, audit dành cho Super Admin.
- API Sources cho Admin/Farmer: thêm nguồn, kiểm tra kết nối, tìm người nhận
  theo email, chia sẻ từng trạm, xác nhận mật khẩu để xem khóa và xóa nguồn.
- Dashboard, chi tiết trạm, latest, Historical Analysis, History Report và CSV;
  phân biệt upstream, stored, cache, số đo cũ và lịch sử chưa đủ.
- Alert Center và thông báo in-app theo hợp đồng backend.
- Client Developer quản lý API key và scope; thử client API bằng API Explorer.

Admin thường không được đọc số đo nguồn của người khác chỉ nhờ role quản trị.
Quyền giám sát của Super Admin cũng không cấp quyền sửa/chia sẻ/xem khóa của
nguồn không thuộc mình. Các kiểm tra này nằm ở backend, không chỉ ở sidebar.

Không có chỉnh/calibration thiết bị từ xa, gửi email/SMS, khôi phục mật khẩu qua
email, MFA/SSO hoặc màn hình CRUD Farm/Plot/Station độc lập. Các trang thiết bị
và API Metrics chưa có hợp đồng số liệu tương ứng phải báo không khả dụng,
không sinh số liệu để thay thế.

## 2. Chuẩn bị

Máy phát triển cần Git, Node.js 24.17.x và npm đi kèm. CI hiện dùng Node.js
24.17.0. Dùng `package-lock.json` và `npm ci` để cài đúng dependency; không dùng
pnpm lockfile của backend cho frontend.

Backend phải chạy và có cấu hình/nguồn/quyền hợp lệ trước khi kiểm tra dữ liệu
thật. Frontend không cần Docker để chạy development; Docker dùng cho đóng gói.
Việc tạo database, migration và tài khoản đầu tiên thuộc
[hướng dẫn backend](../backend/docs/project/QUICKSTART.md).

## 3. Khởi chạy nhanh

Tải source tích hợp nếu chưa có checkout. Không clone đè thư mục đang làm việc:

```powershell
cd D:\
git clone --branch codex/monorepo-final https://github.com/Hn4785/IoT-web.git IoT
cd D:\IoT\frontend
npm ci
```

Nếu đã có source tích hợp, mở thư mục `frontend/` và chỉ chạy `npm ci`.
Tạo `.env` khi chưa tồn tại:

```powershell
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
npm run dev
```

Mở `http://localhost:5173`. Vite proxy `/api/v1` đến
`http://127.0.0.1:3000`; backend local cần `FRONTEND_ORIGIN=http://localhost:5173`.
Nếu cổng 5173 đã dùng, dừng tiến trình development của chính dự án hoặc chọn
cổng khác và sửa origin backend cho khớp. Không đăng nhập bằng địa chỉ
`127.0.0.1` trong khi backend chỉ cho phép origin `localhost`.

| Biến                   | Giá trị mặc định        | Khi dùng                                                                    |
| ---------------------- | ----------------------- | --------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`    | `/api/v1`               | Địa chỉ API browser; dùng đường dẫn cùng origin trong bản đóng gói mặc định |
| `VITE_API_TIMEOUT`     | `10000` ms              | Timeout Axios; chọn số dương hợp lệ khi thay mẫu                            |
| `DEV_API_PROXY_TARGET` | `http://127.0.0.1:3000` | Địa chỉ backend cho Vite development, không phải cấu hình Nginx             |

Hai biến `VITE_*` được đưa vào bundle lúc build, không phải secret. Tuyệt đối
không đặt khóa API nguồn, mật khẩu hoặc token trong biến `VITE_*`.
Chi tiết session và kết nối ở [INTEGRATION.md](docs/INTEGRATION.md).

Đăng nhập tài khoản được cấp và đổi mật khẩu khi hệ thống yêu cầu. Thiếu trạm
thì kiểm tra quyền đã được chủ nguồn chia sẻ; không seed dữ liệu để làm đầy UI.

## 4. Lệnh phát triển và kiểm tra

| Lệnh                                                                                         | Mục đích                                                          |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                                                                                | Vite development với proxy API                                    |
| `npm test`                                                                                   | Kiểm thử unit/contract bằng Node test runner                      |
| `npm run lint`                                                                               | Kiểm tra mã bằng Oxlint                                           |
| `npm run build`                                                                              | TypeScript project build và bundle production trong `dist/`       |
| `npm run preview`                                                                            | Xem bundle local; không thay web server production hoặc proxy API |
| `npm run test:e2e -- e2e/smoke.spec.ts e2e/source-access.spec.ts e2e/source-privacy.spec.ts` | Kiểm tra trình duyệt với API giả lập ở desktop/mobile             |
| `npm audit --audit-level=high`                                                               | Kiểm tra dependency theo dữ liệu advisory tại thời điểm chạy      |

Build gồm bước kiểm tra TypeScript; không có script `verify` hay `typecheck`
riêng trong `package.json` frontend.

```powershell
npm test
npm run lint
npm run build
```

Muốn chạy E2E, cài Chromium một lần bằng `npx playwright install chromium`.
Dừng Vite của dự án trên cổng 5173 trước khi chạy; Playwright tự mở server và
không tái sử dụng server đang chạy. Hai viewport là 1440×900 và 390×844.
Các ca trên dùng API giả lập, không xác nhận nguồn cảm biến hoặc server thật.
Không chạy `real-backend.spec.ts` trên database vận hành; bộ đó cần fixture cô lập.

Kiểm tra local ngày 12/10/2026 cho đợt cập nhật tài liệu: 244 test unit/contract,
lint và build TypeScript/Vite đạt. Đây không phải lần nghiệm thu lại nguồn thật
hoặc triển khai trên hạ tầng bên nhận.

## 5. Tổ chức mã và đóng gói

Luồng thường dùng là page → hook/service → API client → backend. `src/routes`
quản lý điều hướng, `src/stores` giữ phiên, `src/components` chứa thành phần
dùng chung, `src/services` nối hợp đồng và `src/utils` xử lý phạm vi/dữ liệu giữ
lại. Kiến trúc chi tiết ở [ARCHITECTURE-FE.md](docs/ARCHITECTURE-FE.md).

Dockerfile build bundle bằng Node rồi phục vụ qua Nginx ở cổng 8080. Nginx trả
SPA cho route giao diện và proxy `/api/v1` tới service `api:3000`. `/healthz`
chỉ kiểm tra web server, không chứng minh backend/database/provider hoạt động.
Triển khai HTTPS, kiểm tra và rollback ở [DEPLOYMENT-NGINX.md](docs/DEPLOYMENT-NGINX.md).

## 6. Tồn đọng và giới hạn kiểm chứng

Backend còn lỗi P2 khi cửa sổ raw history trả `data: []`: bộ chuẩn hóa không
tìm thấy entry trạm, nên checkpoint không đi qua khoảng đó. Latest vẫn có thể
thu/lưu số đo. Không hiểu thời hạn lưu 90 ngày là lịch sử đã được backfill đủ.
Chi tiết ảnh hưởng hiển thị ở [INTEGRATION.md](docs/INTEGRATION.md).

Alert Center còn có thể hiện nút Acknowledge/Resolve cho người chỉ có quyền
đọc; backend vẫn chặn thao tác bằng `403`. Đây là lỗi hiển thị quyền thao tác,
không phải quyền sửa được cấp thêm. Xem [ROLE-PAGES-GUIDE.md](docs/ROLE-PAGES-GUIDE.md).

Kết quả unit/contract và browser giả lập không thay nghiệm thu trên nguồn thật.
Domain HTTPS, proxy, tài khoản nhận, thông báo mới từ mẫu fresh và hạ tầng bên
nhận cần xác nhận riêng. Không đưa các yêu cầu vận hành chưa nghiệm thu thành
lỗi logic đã tái hiện.

## 7. Danh mục tài liệu

| File                                            | Nội dung                                             |
| ----------------------------------------------- | ---------------------------------------------------- |
| [README.md](README.md)                          | Tổng quan, cấu hình và chạy nhanh                    |
| [ARCHITECTURE-FE.md](docs/ARCHITECTURE-FE.md)   | Component, routing, state và ranh giới xử lý dữ liệu |
| [INTEGRATION.md](docs/INTEGRATION.md)           | API, token/session, DTO và xử lý lỗi                 |
| [ROLE-PAGES-GUIDE.md](docs/ROLE-PAGES-GUIDE.md) | Màn hình và thao tác theo quyền tài khoản            |
| [DEPLOYMENT-NGINX.md](docs/DEPLOYMENT-NGINX.md) | Build SPA, Nginx, HTTPS, kiểm tra và cập nhật        |

Phần frontend chỉ lưu năm tài liệu trên cùng source/config/test cần tái tạo ứng dụng.
Báo cáo Word gửi riêng; hồ sơ cũ, backup, `.env`, output build và dữ liệu thử
không thuộc gói tài liệu công khai. Khi báo lỗi, ghi role, route, bước tái hiện,
HTTP status và request ID; xóa credential khỏi log và ảnh trước khi gửi.
