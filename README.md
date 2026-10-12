# AgriSense Backend

Backend quản lý tài khoản, phiên đăng nhập, nguồn API quan trắc đất, quyền truy cập
trạm, lịch sử số đo, cảnh báo và thông báo trong ứng dụng. Frontend nằm riêng tại
`D:/IoT-web`; backend nằm tại `D:/IoT-api`. PostgreSQL lưu dữ liệu nghiệp vụ và
số đo; ứng dụng không điều khiển thiết bị từ xa.

## 1. Phạm vi và trạng thái

Mã nguồn hiện tại kế thừa bản sửa logic `abd4080` ngày 11/10/2026; revision
checkout `a90bb5e` bổ sung tài liệu. Phiên bản frontend tương ứng có bản sửa
`7650b6f`. Revision bàn giao chính thức phải được ghi lại sau khi duyệt bộ tài liệu.

Đã có luồng đăng nhập/đổi mật khẩu/refresh/logout, quản lý tài khoản và authority,
API key theo trạm, thêm nguồn thật, chia sẻ trạm cho tài khoản nhận, latest/history,
thu thập bền vững và lưu raw tối đa 90 ngày, snapshot cuối, cảnh báo tự động,
notification và audit. Các quyền được kiểm tra tại backend, kể cả khi đọc dữ liệu
đã lưu hoặc sau khi quyền đã bị thu hồi.

Lỗi còn mở: một cửa sổ raw history có `data: []` bị bộ chuẩn hoá từ chối, làm
watermark không vượt qua cửa sổ đó. Latest vẫn thu và lưu số đo thật. Thời hạn lưu
90 ngày không đồng nghĩa đã backfill đủ 90 ngày.

Kiểm chứng notification tự động mới sau phục hồi nguồn thật và nghiệm thu trên
server bên nhận còn riêng. Việc demo chạy được không thay thế hai nội dung này.
Danh mục chức năng và giới hạn nằm tại [CAPABILITY-MAP.md](CAPABILITY-MAP.md).

## 2. Kiến trúc tóm tắt

```text
Frontend / tích hợp sử dụng API
            |
    NestJS + Fastify /api/v1
      |       |          |
  tài khoản  dữ liệu   cảnh báo / audit
      |       |          |
       PostgreSQL + Prisma
              |
       Nguồn API được phép
```

Browser sử dụng Bearer access token và refresh cookie. Client Developer gọi
station API bằng `X-API-Key`. Khóa nguồn API được mã hoá ở backend; API số đo
không trả khóa. Chỉ chủ nguồn được Reveal sau khi xác nhận mật khẩu.

Admin thường chỉ đọc nguồn sở hữu và trạm SYSTEM; với nguồn của người khác,
chỉ được xem thông tin kết nối đã lược bỏ chi tiết dữ liệu. Super Admin có quyền
đọc giám sát rộng hơn nhưng không được Reveal, chia sẻ, Test hoặc Remove nguồn
của người khác. Farmer đọc nguồn sở hữu, trạm được chia sẻ cụ thể và trạm SYSTEM
trong nông trại có membership. Client Developer phải đồng thời có quyền tài khoản
và scope API key cho trạm.

Thiết kế database, ERD và các luồng xử lý được mô tả tại
[ARCHITECTURE.md](docs/project/ARCHITECTURE.md).

## 3. Chạy trên máy phát triển

Yêu cầu Node.js `>=24.17.0 <25`, pnpm `11.19.0` và Docker có Compose.
Dùng đúng revision backend được giao; không lấy nhầm nhánh frontend của repository.

Tại thư mục backend, cài dependency bằng lockfile:

```powershell
cd D:\IoT-api
node --version
pnpm --version
pnpm install --frozen-lockfile
```

Chỉ copy mẫu nếu chưa có `.env`. Đặt mật khẩu PostgreSQL, khóa nguồn thật,
`JWT_SECRET`, `CREDENTIAL_PEPPER` và khóa mã hoá trước khi chạy.

```powershell
Copy-Item .env.example .env
```

Làm theo [QUICKSTART.md](docs/project/QUICKSTART.md) để thực hiện đủ 10 bước:
cấu hình, tạo thư mục dữ liệu, PostgreSQL, migration, Super Admin và chạy ứng dụng.
Không chạy seed trong quy trình dựng máy sử dụng dữ liệu thật.

Cổng local mặc định là `3000`. `/docs` và `/docs-json` chỉ có trong development/test.

```powershell
pnpm dev
```

Trong một cửa sổ PowerShell khác:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health
Invoke-RestMethod http://localhost:3000/api/v1/readiness
```

Health kiểm tra tiến trình; readiness kiểm tra database. Hai phản hồi này không
xác nhận nguồn API đang có số đo mới.

## 4. Các lệnh thường dùng

| Lệnh                                                         | Mục đích                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `pnpm dev`                                                   | Chạy development server                                        |
| `pnpm build`                                                 | Generate Prisma client và biên dịch                            |
| `pnpm start`                                                 | Chạy `dist/main.js` đã build                                   |
| `pnpm db:migrate:deploy`                                     | Áp các migration đã lưu trong source                           |
| `pnpm db:status`                                             | Đối chiếu migration với database đang chọn                     |
| `pnpm verify`                                                | Format, typecheck, lint và build; không bao gồm test           |
| `pnpm test`                                                  | Toàn bộ test; cần database test cô lập                         |
| `pnpm exec vitest run src`                                   | Các test trong `src`, không dựng database tích hợp             |
| `pnpm test:coverage`                                         | Test cùng báo cáo coverage                                     |
| `pnpm audit --prod --audit-level=high`                       | Kiểm tra advisory dependency production                        |
| `pnpm security:secrets`                                      | Kiểm tra file có nguy cơ lộ credential                         |
| `pnpm release:check`                                         | Kiểm tra health/readiness và OpenAPI của app đang chạy         |
| `pnpm db:bootstrap-super-admin -- --email admin@example.com` | Khởi tạo authority holder lần đầu; nhập mật khẩu qua prompt ẩn |
| `pnpm db:recover-super-admin -- --email holder@example.com`  | Khôi phục đúng authority holder; thu hồi phiên cũ              |
| `pnpm retention:run -- --confirm-retention`                  | Bảo trì lifecycle có xác nhận                                  |

`pnpm start` không tự build. `release:check` mặc định kiểm tra app local có OpenAPI;
với production dùng `--skip-openapi` như hướng dẫn vận hành.

## 5. Đọc và lưu dữ liệu

Collector mặc định chạy mỗi 120 giây, tối đa hai trạm đồng thời. Khuyến nghị poll
latest từ frontend mỗi 30 giây là một lịch riêng, không thay lịch collector.

Raw được giữ tối đa 90 ngày theo thời điểm đo; snapshot cuối được giữ riêng.
Một request history raw tối đa 7 ngày; request tổng hợp tối đa 90 ngày.
`dataOrigin`, `isStale` và coverage cho biết dữ liệu trả từ đâu và khoảng nào đã
thu được. Mất nguồn không làm xuất hiện số đo giả hoặc tự cấp thêm quyền.

Chỉ số thu thập và giới hạn dung lượng là biện pháp bảo vệ, không phải cam kết máy
bất kỳ lưu đủ 90 ngày với mọi số lượng trạm. Các giới hạn hiện tại và lỗi đang mở
được ghi tại [CAPABILITY-MAP.md](CAPABILITY-MAP.md).

## 6. Bộ tài liệu bàn giao

| Tài liệu                                                                           | Nội dung                                                             |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `README.md`                                                                        | Tổng quan, trạng thái và cách bắt đầu                                |
| [QUICKSTART.md](docs/project/QUICKSTART.md)                                        | 10 bước dựng môi trường cho lập trình viên mới                       |
| [ARCHITECTURE.md](docs/project/ARCHITECTURE.md)                                    | Kiến trúc, API, database/ERD, phân quyền và luồng dữ liệu            |
| [ENV-REFERENCE.md](docs/project/ENV-REFERENCE.md)                                  | Biến cấu hình, giá trị mặc định, điều kiện kiểm tra và bảo vệ secret |
| [LOCAL-RUNBOOK.md](docs/operations/LOCAL-RUNBOOK.md)                               | Database local, tài khoản, kiểm tra và bảo trì                       |
| [DELIVERY-RECOVERY.md](docs/operations/DELIVERY-RECOVERY.md)                       | Image, triển khai, backup/restore, cập nhật và rollback              |
| [integration-core-threat-model.md](docs/security/integration-core-threat-model.md) | Ranh giới tin cậy, kiểm soát và rủi ro bảo mật                       |
| [CAPABILITY-MAP.md](CAPABILITY-MAP.md)                                             | Chức năng, mức hoàn thành, bằng chứng và tồn đọng                    |
| [CONTRIBUTING.md](CONTRIBUTING.md)                                                 | Quy ước phát triển, API/DTO, review và commit                        |

Bộ tài liệu trong repository chỉ gồm chín file trên. Hồ sơ kiểm tra lịch sử,
bản Word bàn giao riêng, bản sao database và file cấu hình có secret không thuộc
bộ tài liệu đưa lên Git. Không chuyển dữ liệu fixture hoặc `iot_test` sang máy chạy thật.
