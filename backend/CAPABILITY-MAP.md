# Chức năng và trạng thái bàn giao

Phiên bản: 3.0.0. Cập nhật: 27/10/2026.

Tài liệu ghi phạm vi backend đã triển khai, bằng chứng kiểm tra và phần còn mở.
"Đã có" nói về mã và luồng xử lý trong phiên bản này; không thay thế nghiệm thu
nguồn thật hoặc server của bên nhận.

## 1. Danh mục chức năng

| Nhóm             | Chức năng đã có                                                                                            | Phạm vi / giới hạn                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Cấu hình và HTTP | Zod kiểm tra cấu hình, request ID, error envelope, timeout, CORS, health/readiness                         | Swagger chỉ development/test; readiness không đo freshness provider                     |
| Tài khoản        | Tạo/reset/khóa tài khoản, đổi mật khẩu bắt buộc, ba role, authority Super Admin                            | Không có đăng ký công khai, MFA hoặc SSO                                                |
| Phiên đăng nhập  | Access JWT, refresh cookie rotate, logout, revoke phiên khi thay đổi quyền/credential                      | Kiểm tra user/session/authority hiện tại tại backend                                    |
| API key          | Tạo/xem metadata/rotate/revoke, hạn dùng và station scope                                                  | Plaintext chỉ xuất hiện khi tạo/rotate; quyền tài khoản và key phải cùng cho phép       |
| Nguồn API        | Nguồn SYSTEM cấu hình môi trường, nguồn MANAGED thuộc Admin/Farmer, mã hoá khóa                            | HTTPS allowlist; owner-only Reveal/Test/Remove/quản lý chia sẻ                          |
| Chia sẻ trạm     | Tìm tài khoản theo email và chọn station trước khi lưu                                                     | Người nhận ACTIVE Farmer/Client Developer; không chia sẻ cho Admin hoặc chính chủ nguồn |
| Hierarchy        | Farm → Plot → Station; mọi đọc theo station scope hiện tại                                                 | CENTER không được công bố như trạm số đo đất                                            |
| Latest/history   | Browser Bearer và client API key; cache, cursor, aggregate và metadata                                     | Không đoán unit/sensor/depth; không dựng số đo khi thiếu nguồn                          |
| Lưu trữ bền vững | Raw 90 ngày, snapshot cuối riêng, fetch generation/revision, coverage và checkpoint                        | Chưa cam kết backfill đủ; lỗi cửa sổ history rỗng còn mở                                |
| Collector        | Latest và catch-up raw có giới hạn, backoff, lease fencing, capacity stop                                  | 120 giây; tối đa 2 trạm đồng thời, 20 trạm/lượt, 10 trang/window theo mặc định          |
| Cảnh báo         | Rule theo metadata, mẫu mới, breach/recovery, acknowledge/resolve, optimistic revision và idempotency      | Không phát cảnh báo mới từ stored/stale/backfill; không điều khiển thiết bị             |
| Notification     | Job theo lifecycle, snapshot người nhận, giao theo batch và tránh trùng                                    | Kiểm tra lại quyền khi đọc; không gửi email/SMS                                         |
| Audit/vận hành   | Audit an toàn, chỉ số nội bộ hữu hạn, image runtime/tools, preflight, backup envelope và restore rehearsal | Rate limit/metrics process-local; server/backup ngoài máy cần bên nhận xác nhận         |

Chủ nguồn có thể dùng Test để phát hiện mã node đất chưa đăng ký, sau đó xác nhận những mã muốn thêm. Test không tự thêm node; node được thêm không kế thừa quyền chia sẻ của node cũ hoặc scope API key. Yêu cầu thêm lặp không tạo bản ghi trùng. Nguồn phải có một plot xác định từ các trạm hiện có; trường hợp thiếu hoặc nhiều plot bị từ chối để tránh ghi sai vị trí.

## 2. Ranh giới phân quyền

Ba giá trị role là `ADMIN`, `FARMER` và `CLIENT_DEVELOPER`. Super Admin là
authority được gán cho một Admin, không phải role thứ tư.

| Tài khoản        | Đọc trạm/số đo bằng phiên browser                             | Nguồn của người khác                                        | Quản lý chia sẻ/khóa nguồn                    |
| ---------------- | ------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| Admin thường     | SYSTEM và nguồn sở hữu                                        | Chỉ metadata kết nối đã lược bỏ, không đọc dữ liệu nguồn đó | Chỉ nguồn sở hữu                              |
| Super Admin      | Giám sát trạm của các nguồn còn hoạt động                     | Được đọc dữ liệu theo phạm vi giám sát                      | Không có quyền chủ nguồn chỉ nhờ authority    |
| Farmer           | Nguồn sở hữu, trạm được chia sẻ, SYSTEM thuộc farm membership | Chỉ trạm được chia sẻ cụ thể                                | Chỉ nguồn sở hữu                              |
| Client Developer | Không dùng business route browser; gọi client API bằng key    | Theo grant hiện tại và station scope của key                | Không Reveal/Test/Remove hoặc quản lý chia sẻ |

Đọc được dữ liệu không đồng nghĩa sửa được rule hoặc quyền. Farmer quản lý rule
cho nguồn sở hữu; Admin quản lý rule của SYSTEM/nguồn sở hữu. Grant đọc không biến
người nhận thành chủ nguồn. Quyền và nguồn còn hoạt động được kiểm tra lại cả khi
đọc snapshot, history, alert và notification.

## 3. Những ranh giới dữ liệu cần giữ

- Raw lưu 90 ngày theo `observedAt`; raw request tối đa 7 ngày, aggregate request
  tối đa 90 ngày. Không đánh đồng thời hạn lưu, khoảng truy vấn và coverage.
- `SoilLatestReading` không bị xoá cùng raw quá hạn; đọc nó vẫn phải có quyền hiện tại.
- `fetchedAt` ghi thời điểm nhận của revision giá trị; `lastFetchedAt` chặn phản hồi
  cũ ghi đè phản hồi mới. Thời điểm đo không được thay bằng thời điểm tải.
- `origin=latest/rawHistory` là provenance lúc ghi; `dataOrigin=upstream/stored`
  là nguồn trả response. Hai trường không đồng nghĩa.
- Source connection status chỉ cho biết reachability. Dữ liệu thiếu/cũ/partial
  phải giữ đúng nhãn; không gọi snapshot là dữ liệu mới.
- Giới hạn raw mặc định là 2 triệu field reading/trạm, 10 triệu toàn hệ thống.
  Đạt trần không cho phép âm thầm xoá lịch sử đang trong hạn.
- Coverage complete chỉ áp dụng các khoảng/trường được xác nhận; không suy ra
  từ số dòng, giá trị đầu/cuối hoặc việc endpoint trả HTTP 200.

## 4. Lỗi logic còn mở

### P2: cửa sổ raw history rỗng chặn backfill

Response `{ "success": true, "data": [] }` không có entry khớp trạm yêu cầu nên
bộ chuẩn hoá từ chối. Checkpoint ghi invalid; watermark không đi qua cửa sổ đó.
Không được nhầm với đúng entry trạm có `history.soil: []`, vốn là trường hợp khác.

Ảnh hưởng là catch-up lịch sử cũ có thể dừng và thử lại theo giới hạn. Latest vẫn
thu/lưu số đo thật. Đây là lỗi phân biệt dữ liệu rỗng/thiếu trạm trong backend,
không phải lỗi vận hành riêng của một thiết bị triển khai.

Chưa sửa trong phiên bản hiện tại. Khi xử lý, phải phân biệt cửa sổ thật sự rỗng
với response sai/thiếu trạm; kiểm tra pagination, backoff, restart, scope, coverage
và không phát cảnh báo từ backfill. Không tạo giá trị hoặc đánh dấu đủ dữ liệu
để tránh lỗi.

## 5. Phần còn cần xác nhận

Các mục sau chưa đóng nhưng không được ghi thành lỗi logic đã tái hiện:

1. Thời điểm đo của provider tiếp tục tăng và một lifecycle/notification tự động
   mới sau phục hồi nguồn thật. Kết quả với fixture không thay bằng chứng này.
2. Domain HTTPS/proxy, năng lực lưu trữ, rate limit cho mô hình nhiều instance,
   staging và quyền truy cập trên server bên nhận.
3. Nơi backup ngoài máy, người giữ khóa, người restore và diễn tập trên target
   được chọn. RPO 24 giờ/RTO 4 giờ, giữ 7 bản ngày/4 bản tuần là mục tiêu đã chốt,
   chưa phải thời gian khôi phục được đo trên server bên nhận.
4. Người giao/nhận, revision bàn giao, ngày tiếp nhận, ngoại lệ và chữ ký xác nhận.

## 6. Ngoài phạm vi

Không có điều khiển/calibration thiết bị từ xa, đồng bộ hai chiều database,
email/SMS, MFA/SSO, chẩn đoán nông học hoặc chứng nhận an toàn production.
Không chuyển seed/fixture/`iot_test` vào hệ thống dữ liệu thật. Dữ liệu trạm thật
không phải tài nguyên mẫu để commit trong source.

## 7. Bằng chứng và phiên bản

Bản sửa ngày 11/10/2026, logic backend `abd4080` / frontend `7650b6f`:

- Backend: 93 file / 626 test, cùng format/typecheck/lint/build và production audit.
- Frontend: 244 test; 44 ca trình duyệt desktop/mobile dùng API giả lập.
- Đã ghi nhận rollout demo, health/readiness và kiểm tra asset; không chạy seed,
  đổi schema hoặc sao chép database test trong rollout đó.

Đây là kết quả của mốc kiểm tra nêu trên, không phải kiểm thử lại toàn bộ khi sửa
tài liệu. Ca browser giả lập không xác nhận dữ liệu live từ provider.
Bộ docs được viết lại không thay runtime, quyền, schema hoặc database.

Kiểm tra ngày 12/10/2026 cho đợt cập nhật tài liệu: `pnpm verify` đạt
format/typecheck/lint/build; 36 file với 345 test unit và công cụ triển khai đạt;
`pnpm security:secrets` đạt. Không chạy bộ integration cần database, không triển
khai lại hoặc kiểm tra nguồn thật trong đợt này.

Chi tiết kỹ thuật: [ARCHITECTURE.md](docs/project/ARCHITECTURE.md).
Triển khai/khôi phục: [DELIVERY-RECOVERY.md](docs/operations/DELIVERY-RECOVERY.md).
Rủi ro bảo mật: [integration-core-threat-model.md](docs/security/integration-core-threat-model.md).
