# Đóng gói và triển khai frontend bằng Nginx

Phiên bản ứng dụng: 3.0.0. Cập nhật: 12/10/2026.

Hướng dẫn mô tả Dockerfile và cấu hình Nginx đang có trong repository. Các lệnh
triển khai là mẫu để bên nhận tái tạo, không phải xác nhận đã chạy trên server
của họ. Không yêu cầu tunnel hoặc địa chỉ demo cụ thể.

## 1. Điều kiện trước khi triển khai

1. Chọn revision tích hợp đã được giao; lưu lại commit chung cùng digest riêng
   của image backend/frontend. Không chỉ ghi `latest` hoặc tên phiên bản.
2. Chuẩn bị Node.js 24.17.x/npm để build ngoài container, hoặc Docker để build
   bằng Dockerfile. Với image từ nơi khác, chọn đúng kiến trúc CPU x64/ARM64.
3. Backend/database đã triển khai theo tài liệu backend; không nhập database
   test, seed hoặc khóa nguồn vào frontend.
4. Xác định domain HTTPS, proxy kết thúc TLS và origin browser. Backend phải
   dùng đúng origin này trong `FRONTEND_ORIGIN`.

## 2. Cấu hình lúc build và lúc chạy

| Cấu hình                  | Thời điểm đọc    | Ý nghĩa                                                      |
| ------------------------- | ---------------- | ------------------------------------------------------------ |
| `VITE_API_BASE_URL`       | Vite build       | Mặc định `/api/v1`; endpoint browser cùng origin             |
| `VITE_API_TIMEOUT`        | Vite build       | Timeout Axios, mặc định 10000 ms                             |
| `DEV_API_PROXY_TARGET`    | Vite development | Chỉ proxy server development; không đổi upstream Nginx       |
| `api:3000` trong Nginx    | Web server       | Tên backend trong Docker network; không phải địa chỉ browser |
| `FRONTEND_ORIGIN` phía BE | Backend startup  | Origin frontend cho CORS và refresh/logout                   |

Dockerfile hiện không có build argument cho `VITE_*` và không copy `.env`.
Image được build nguyên trạng sử dụng mặc định `/api/v1` và timeout 10000 ms.
Truyền `-e VITE_API_BASE_URL=...` khi `docker run` không thay được bundle đã build.
Muốn thay hợp đồng cấu hình image, phải sửa và kiểm tra quy trình build trước,
không coi biến runtime là cơ chế cấu hình đã có.

Với build ngoài container, `.env.production` hoặc biến môi trường của tiến
trình build có thể cung cấp giá trị `VITE_*`; file môi trường phải được giữ
ngoài Git. Mọi giá trị `VITE_*` là công khai trong JavaScript browser, không
được chứa secret.

## 3. Build bằng Docker

Nếu có Node/npm trên máy phát triển, kiểm tra checkout frontend đã chọn trước:

```powershell
cd D:\IoT\frontend
npm ci --ignore-scripts
npm test
npm run lint
npm run build
```

Máy chỉ có Docker có thể build image trực tiếp từ checkout; Dockerfile tự cài
dependencies và build bên trong. Lệnh này không tự chạy bộ unit/lint ở trên:

```powershell
cd D:\IoT\frontend
docker build -t agrisense-web:3.0.0 .
```

Dockerfile có hai giai đoạn:

- Build: Node.js 24.17.0, `npm ci --ignore-scripts`, TypeScript và Vite.
- Runtime: Nginx 1.28.0, chỉ `dist/` và cấu hình server, chạy với user `nginx`
  trên cổng 8080. Dependency phát triển và source không nằm trong image runtime.

Các base image được ghim digest trong [Dockerfile](../Dockerfile). Image build
local mang kiến trúc của máy build; không mặc định dùng được trên CPU khác.
Image đã kiểm chứng để bàn giao nên được phân phối theo digest hoặc kèm checksum.

## 4. Chạy cùng backend

Ưu tiên dùng service `web` trong [Compose backend](../../backend/deploy/compose.yaml).
Thay `WEB_IMAGE` bằng image frontend đã kiểm chứng rồi chạy
[deployment/preflight](../../backend/docs/operations/DELIVERY-RECOVERY.md).
Compose kết nối web và API qua network riêng và chỉ publish web trên loopback.

Nếu triển khai container web riêng, xác nhận network và backend đang có alias
`api` trước khi chạy. Ví dụ deployment BE dùng project `iot`, network `iot_private`:

```powershell
docker network inspect iot_private
docker run -d --name agrisense-web --network iot_private -p 127.0.0.1:8080:8080 --restart unless-stopped agrisense-web:3.0.0
docker logs --tail 50 agrisense-web
```

Không chạy ví dụ này nếu Compose đã publish cổng 8080, đã có container cùng tên
hoặc network/project dùng tên khác. Không tạo một API/database thứ hai chỉ để
khớp tên ví dụ. Tên network thực tế phụ thuộc tên project Compose đã chọn.

Nginx dùng Docker DNS `127.0.0.11` và hostname `api`; cấu hình này không chạy
nguyên trạng như Nginx cài trực tiếp trên host. Nếu bên nhận chọn web server
trên host, cần thay DNS/upstream, thư mục static và quyền file, kiểm tra
`nginx -t` trước khi reload.

## 5. Các route Nginx hiện có

Nguồn: [deploy/nginx.conf](../deploy/nginx.conf).

| Route                   | Xử lý                         | Lưu ý kiểm tra                                |
| ----------------------- | ----------------------------- | --------------------------------------------- |
| `/healthz`              | Trả `200 OK` bằng Nginx       | Chỉ liveness web, không gọi backend           |
| `/api/v1`, `/api/v1/…`  | Proxy đến `http://api:3000`   | Giữ URI/query; không trả `index.html` cho API |
| `/assets/…`             | File build                    | Cache một năm, `immutable`; filename có hash  |
| Route giao diện còn lại | `try_files` rồi `/index.html` | Deep link phải mở được khi tải lại trang      |

HTML/route SPA có `no-cache, must-revalidate`; không áp dụng cache một năm cho
`index.html`. Nginx hiện có `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY` và `Referrer-Policy: strict-origin-when-cross-origin`.
Những header này không thay xác thực, phân quyền hoặc TLS của backend/proxy ngoài.

## 6. HTTPS, cookie và domain

Nginx trong image lắng nghe HTTP nội bộ. Proxy ngoài kết thúc HTTPS, chuyển web
vào `127.0.0.1:8080` và giữ request path/query, `Origin`, cookie cùng
`Set-Cookie`. Không publish PostgreSQL hoặc cổng API riêng ra Internet để phục vụ UI.

Backend production đặt refresh cookie `Secure`, `HttpOnly`, `SameSite=Strict`.
Trình duyệt phải mở HTTPS để dùng phiên production; không tắt `Secure` hoặc
kiểm tra Origin nhằm làm cho link HTTP công khai hoạt động.

Domain mới chỉ cần cấu hình DNS/TLS/proxy và cập nhật `FRONTEND_ORIGIN`, sau đó
khởi động lại backend. Với `/api/v1` cùng origin, không cần hardcode domain vào
source FE. Nếu chủ động dùng API khác origin, phải xét lại CORS, cookie và
chính sách browser; đây không phải cấu hình bàn giao mặc định.

## 7. Kiểm tra trước khi tiếp nhận

Kiểm tra container nội bộ từ máy triển khai:

```powershell
curl.exe -f http://127.0.0.1:8080/healthz
curl.exe -f http://127.0.0.1:8080/api/v1/health
curl.exe -f http://127.0.0.1:8080/api/v1/readiness
```

`/readiness` kiểm tra database; không chứng minh nguồn cảm biến đang có số đo
mới. Với môi trường production, kiểm tra tiếp trên domain HTTPS thực:

1. Mở `/login` và tải lại deep link role hợp lệ; asset không lỗi 404.
2. Đăng nhập Admin/Farmer/Client bằng tài khoản được phép kiểm thử.
3. Tải lại trang để kiểm tra restore; kiểm tra refresh, đổi mật khẩu và logout.
4. Chọn trạm/nguồn theo scope, thu hồi quyền và xác nhận dữ liệu không còn quyền
   bị gỡ. Admin không sở hữu nguồn chỉ thấy metadata giám sát được phép.
5. Owner Reveal nhập sai mật khẩu phải hiện lỗi nhưng giữ phiên hợp lệ; nhập
   đúng mới trả key và tự ẩn. Không ghi lại key trong bằng chứng kiểm thử.
6. Kiểm tra lỗi mạng, history thiếu, retry từng trạm/endpoint và responsive
   desktop/mobile. Không dùng số liệu mẫu để làm đầy màn hình.

Ghi revision tích hợp, digest của từng image, ngày kiểm tra, môi trường và kết quả. Lệnh
build hay health thành công không thay bộ nghiệm thu quyền/session trên browser.

## 8. Cập nhật và quay lại bản trước

Trước cập nhật, lưu revision/digest image web hiện tại và cấu hình deployment.
Kiểm tra bundle mới với backend tương ứng trước khi đổi image.

Với Compose của BE, giữ nguyên project và file môi trường đang dùng, xác nhận
API hiện tại đang healthy. Sau khi đổi `WEB_IMAGE` trong file deployment được
bảo vệ, chỉ cập nhật service web, không khởi động dependencies hoặc migration:

```powershell
cd D:\IoT\backend
docker compose -p iot --env-file C:\IoT-config\server.env -f deploy/compose.yaml up -d --no-deps --wait web
```

Đường dẫn chỉ là ví dụ ngoài repository; thay bằng file thực của bên nhận.
Rollback là đổi về digest web đã xác nhận tương thích rồi chạy lại cùng lệnh.
Nếu phát hành đồng thời contract API mới, xác nhận backend hỗ trợ bundle cũ
trước khi rollback. Không dùng `down -v`, không reset database và không thay
credential cho một lần cập nhật frontend.

## 9. Xử lý sự cố thường gặp

| Hiện tượng                               | Kiểm tra                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `/healthz` đạt nhưng API 502             | Network, alias `api`, backend readiness và log đã lược bỏ secret              |
| Deep link trả 404                        | Route SPA fallback và document root của Nginx/proxy ngoài                     |
| API trả HTML                             | Proxy `/api/v1` bị thiếu/ghi đè bởi SPA fallback                              |
| Đăng nhập được nhưng refresh/logout lỗi  | HTTPS, Origin backend, cookie path và proxy cookie; không bỏ kiểm tra bảo mật |
| Thay `VITE_*` khi chạy mà không tác dụng | Biến được đóng vào bundle; build lại theo quy trình đã duyệt                  |
| Browser vẫn dùng HTML cũ                 | Cache của proxy/browser; giữ HTML revalidate, asset hash đúng release         |
| Nguồn Connected nhưng thiếu số đo        | Reachability khác freshness/coverage; xem timestamp và trạng thái trả từ API  |

Hồ sơ kiểm thử và backup chỉ giữ ở vùng được bảo vệ. Bản Word bàn giao, ảnh
chứa dữ liệu nhạy cảm và file môi trường không thuộc năm docs công khai.
