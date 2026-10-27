# Mô hình rủi ro và kiểm soát bảo mật

Phiên bản: 3.0.0. Cập nhật: 12/10/2026.

Phạm vi là toàn bộ backend hiện tại: cấu hình, HTTP, identity/session, API key,
nguồn API, quyền trạm, dữ liệu bền vững, collector, cảnh báo/notification, audit
và công cụ triển khai/khôi phục. Đây là mô tả kiểm soát đã có và rủi ro còn lại,
không phải chứng nhận an toàn production.

## 1. Tài sản cần bảo vệ

- Mật khẩu/hash tài khoản, refresh-token hash, client API-key hash và secret ký/HMAC.
- Credential nguồn SYSTEM và credential nguồn MANAGED được mã hoá.
- Role/status, authority holder, farm membership, station grant và quyền của từng key.
- Số đo thật, snapshot, provenance/revision, coverage và checkpoint thu thập.
- Rule, lifecycle, danh sách người nhận và trạng thái notification.
- Audit liên kết với user ID ổn định, request ID và metadata đã lược bỏ secret.
- Database, file cấu hình, backup, khóa giải mã và tính sẵn sàng của dịch vụ.

Mật khẩu tạm và client API key plaintext chỉ trả trong response tạo/reset/rotate
được phép. Refresh token plaintext ở cookie/memory xử lý request, không lưu nguyên
giá trị trong database. Khóa nguồn MANAGED khác client API key: được mã hoá để
backend gọi provider và có thao tác Reveal owner-only.

## 2. Ranh giới tin cậy

| Ranh giới                 | Dữ liệu không được tin ngay                    | Kiểm soát                                                                           |
| ------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| Environment → tiến trình  | URL, secret, boolean, interval và limit        | Schema Zod, main/test target khác nhau, secret khác nhau, lease nhỏ hơn interval    |
| Browser → API             | Body/query/ID/JWT, Origin/cookie/request ID    | Parse contract, guard, session/user/authority hiện tại, error an toàn               |
| Client integration → API  | X-API-Key và mã trạm                           | HMAC/hash, owner ACTIVE, expiry/revoke, account grant và station scope              |
| Backend → provider        | Status/body/timestamp/field/metadata           | Origin được cấu hình/allowlist, timeout, parse response, giới hạn page/concurrency  |
| Backend → PostgreSQL      | ID, scope, trạng thái nguồn, revision và lease | Prisma/select DTO, transaction, composite source/station, kiểm tra lease/generation |
| Backend → operator/backup | Logs, env, ciphertext, dump và manifest        | Lược bỏ secret, file/quyền truy cập riêng, envelope mã hoá và restore cô lập        |

Ẩn menu hoặc route phía frontend không thay việc kiểm tra quyền trên backend.
Một cursor hoặc một bản ghi đã lưu cũng không mang quyền truy cập.

## 3. Kiểm soát theo nhóm đe doạ

| Nhóm            | Kịch bản                                                    | Kiểm soát hiện tại                                                                                       |
| --------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Giả mạo         | JWT giả, role cũ, session đã revoke                         | Xác minh HS256/issuer/audience/expiry và đọc session/user/authority hiện tại                             |
| Giả mạo         | Đánh cắp/đoán client key để gọi trạm khác                   | Hash HMAC, so sánh an toàn, owner ACTIVE, scope key giao với quyền tài khoản                             |
| Sửa dữ liệu     | Hai refresh/transfer cùng thành công                        | Rotation có điều kiện, transaction authority và singleton invariant                                      |
| Sửa dữ liệu     | Phản hồi chậm ghi đè số đo mới                              | lastFetchedAt/generation, revision và transaction write fence                                            |
| Sửa dữ liệu     | Collector hết lease hoặc source bị remove vẫn ghi           | Khoá source/station, lease kiểm tra theo thời gian database sau lock và trước commit                     |
| Chối bỏ         | Không biết ai đổi quyền hoặc xử lý cảnh báo                 | Audit/lifecycle với actor, request ID, result, timestamp và metadata an toàn                             |
| Lộ thông tin    | Login phân biệt tài khoản tồn tại                           | Lỗi INVALID_CREDENTIALS chung và password verification có giới hạn                                       |
| Lộ thông tin    | Admin đọc nguồn của chủ khác hoặc lộ khóa                   | Ordinary Admin health-only đã redacted; owner-only hành động nhạy cảm; DTO không trả credential          |
| Lộ thông tin    | Grant đã thu hồi vẫn đọc history/notification               | Scope hiện tại dùng chung; dữ liệu retained không vượt quyền; notification lưu nhưng bị ẩn khi mất quyền |
| Lộ thông tin    | Env/dump/log hoặc ảnh diagnostic đi lên Git                 | Bảo vệ file riêng, ignore/exclusion, scan file; không coi scan là bộ dò mọi loại secret                  |
| Từ chối dịch vụ | Flood credential/API, upstream treo, lịch sử không giới hạn | Rate limit, input bound, timeout, cache, page/batch/concurrency/capacity bound                           |
| Nâng quyền      | Admin sửa Admin khác/holder hoặc Client tự cấp grant        | Ma trận authority hiện tại, bảo vệ holder và grant/key scope subset                                      |
| Nâng quyền      | Super Admin Reveal nguồn không sở hữu                       | Quyền giám sát dữ liệu không thay kiểm tra owner                                                         |
| Sai cảnh báo    | Stored/backfill/correction được đánh giá lại như mẫu mới    | Freshness/timestamp/provenance guard, recheck rule/metadata/unit/revision và lease fencing               |
| Trùng xử lý     | Retry tạo lifecycle hoặc notification lặp                   | Idempotency, optimistic revision, unique lifecycle revision và cặp event/recipient                       |

Mô tả chi tiết scope và database tại
[ARCHITECTURE.md](../project/ARCHITECTURE.md).
Không có cơ chế nhận diện đầy đủ mọi dữ liệu provider gian lận; response được
validate hình dạng/ngữ nghĩa theo contract, không xác nhận tính đúng vật lý của cảm biến.

## 4. Authentication và credential

Mật khẩu dùng Argon2id, dài 12–128 ký tự. Năm lần login sai khoá đăng nhập
15 phút; unknown/wrong/disabled/locked dùng cùng lỗi.
Access JWT sống 15 phút; quyền không được tin chỉ từ claim cũ.

Refresh token sống tối đa 7 ngày, random 32 byte, lưu HMAC hash. Rotation single-use;
reuse token đã thay thế thu hồi family. Cookie là HttpOnly, SameSite=Strict,
path theo auth, Secure trong production. Refresh/logout yêu cầu Origin đúng
cấu hình, CORS cho credentials từ đúng origin.

Tài khoản mới phải đổi mật khẩu tạm trước khi vào business route. Thay đổi
password/role/status/authority/reset làm invalid credential/session theo contract.
Bảo vệ authority holder trước disable/demotion; chuyển authority phải qua luồng duyệt.

Client key hết hạn sau 90 ngày theo luồng hiện tại; plaintext chỉ tạo/rotate một lần.
Lưu key metadata/hash, không có endpoint đọc lại client key đã mất.
Kiểm tra owner, expiry, revoke, station scope và grant hiện tại ở mỗi lần dùng.

Credential nguồn MANAGED dùng AES-256-GCM. Chỉ owner xác nhận mật khẩu mới Reveal;
response no-store. Lỗi `401 INVALID_CREDENTIALS` của xác nhận mật khẩu là lỗi
nghiệp vụ, không chứng minh phiên đã hết hạn. Frontend giữ phiên cho lỗi này,
nhưng vẫn phải refresh/logout đúng khi session thực sự hết hạn/revoke.
Giới hạn hiển thị/clear form và fencing phản hồi muộn thuộc frontend, không thay guard.

Không truyền mật khẩu qua CLI/env cho bootstrap/recovery. Recovery chỉ đúng
authority holder, thu hồi phiên cũ và ghi audit; không tạo một holder mới bằng SQL.

## 5. Nguồn API và bảo vệ dữ liệu

Nguồn SYSTEM dùng URL/key cấu hình backend. Nguồn MANAGED phải thuộc HTTPS
allowlist; tham số request không được quyết định host ngoài danh sách được phép.
Provider status/body/timestamp là input không tin cậy; không trả raw lỗi nội bộ
hoặc credential của provider ra frontend.

Ordinary Admin thấy metadata kết nối nguồn khác nhưng không thấy station/counts/
readings/history/alerts của nguồn đó. Super Admin có quyền đọc giám sát; các hành
động owner-only vẫn owner-only. Chia sẻ chỉ cho ACTIVE Farmer/Client Developer,
từng station; không đưa khóa nguồn cho người nhận.

Raw/snapshot/history/alert/notification đều phải resolve quyền hiện tại.
Nguồn đã remove không được mở lại quyền nhờ dữ liệu còn trong database.
CENTER không được suy ra là station đất hợp lệ.

`observedAt` không được thay bằng thời điểm tải khi provider thiếu thời gian.
Unit/sensor/depth chưa xác minh là unknown/null theo DTO/metadata; không tạo
giá trị mẫu hoặc metadata demo để làm rule có vẻ hợp lệ.

## 6. Lưu trữ và lifecycle

Local bind directory và deploy named volume là hai cơ chế khác nhau; vị trí
`E:/IoT-data/postgres` trong mẫu local không bắt buộc trên server bên nhận.

- Raw giữ tối đa 90 ngày theo thời điểm đo; pruning theo batch và clip coverage.
- Snapshot cuối lưu riêng, không bị raw pruning xoá; quyền đọc vẫn kiểm tra hiện tại.
- Retention lifecycle chạy bằng lệnh có xác nhận, không tự chạy lúc app startup:
  session 30 ngày sau hết hạn/revoke, API key 90 ngày sau hết hạn/revoke, yêu cầu
  xoá user 90 ngày, notification 180 ngày, resolved alert 365 ngày có điều kiện.
- Anonymization giữ user ID và liên kết audit; authority holder không bị anonymize
  khi chưa chuyển quyền.
- Audit không bị lệnh retention hiện tại xoá. Chủ trương lưu ít nhất 365 ngày
  không phải job tự xoá đúng ngày 365.
- Notification đã giao được giữ trong storage nhưng bị ẩn khi mất quyền dữ liệu;
  quyền được cấp lại có thể làm notification trước đó hiển thị lại.

Các điều kiện/batch chi tiết ở
[LOCAL-RUNBOOK.md](../operations/LOCAL-RUNBOOK.md).

## 7. Triển khai, backup và secret

Runtime non-root, Swagger tắt production, PostgreSQL/API không có cổng public
trong deploy Compose; web bind loopback và cần reverse proxy HTTPS.
Rate limit trong process không tự trở thành shared limiter nhiều instance.

JWT secret và pepper phải khác nhau. Khóa nguồn phải đúng 32 byte base64;
không tự thay key/pepper sau restore hoặc trong một lần restart.
Lưu env production, dump và khóa ngoài source/build context, có quyền hạn chế.

Backup envelope AES-256-GCM có kiểm tra xác thực/hash và không ghi đè output.
Restore rehearsal chỉ vào database mới; không restore đè dữ liệu đang chạy.
Mã/công cụ đã có không chứng minh backup ngoài máy được vận hành hoặc đủ RPO/RTO.
Xem [DELIVERY-RECOVERY.md](../operations/DELIVERY-RECOVERY.md).

## 8. Rủi ro còn lại và ngoại lệ

| Rủi ro / phần chưa xác nhận              | Tình trạng                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| Mật khẩu Super Admin bị lộ               | Tác động cao; MFA/SSO ngoài phạm vi đã chốt, không phải kiểm soát đã triển khai          |
| Audit bị sửa bởi người có quyền database | Append-only theo ứng dụng, chưa phải chứng cứ chống sửa bởi database administrator       |
| Rate limit/metrics nhiều instance        | Process-local; cần mô hình/proxy/shared limiter được duyệt nếu triển khai nhiều instance |
| Backup ngoài máy và key custody          | Bên nhận còn chốt nơi lưu, người giữ khóa, người restore và diễn tập target              |
| Capacity lịch sử 90 ngày                 | Chưa đo đủ cho mọi máy/số trạm; trần bảo vệ không thay đánh giá năng lực                 |
| Provider và history trống                | Lỗi empty-window P2 chặn backfill còn mở; không được công bố coverage đầy đủ             |
| Notification mới sau phục hồi provider   | Cần bằng chứng nguồn thật, không thay bằng fixture                                       |
| Supply chain                             | Audit chỉ bao phủ advisory đã biết, không phát hiện mọi maintainer compromise            |
| HTTPS/proxy, staging và sign-off         | Do bên nhận xác nhận trên target; demo local không thay nghiệm thu                       |

Không công bố chứng nhận bảo mật/compliance hoặc hết mọi rủi ro.
Lỗi logic còn mở và phạm vi ngoài sản phẩm được ghi tại
[CAPABILITY-MAP.md](../../CAPABILITY-MAP.md).

## 9. Bằng chứng kiểm tra

Ngày 27/10/2026, đợt tích hợp nâng Zod lên `4.6.6` để xử lý advisory high.
Audit production còn năm low và năm moderate ở Fastify, ip-address và fast-uri;
không còn high/critical theo ngưỡng CI. Các phát hiện này chưa được coi là đã sửa.
Hẹn rà soát bản vá và mức ảnh hưởng của chúng trước ngày 03/11/2026; audit không
thay thế việc kiểm tra các đường gọi và khả năng khai thác thực tế.

Mốc logic ngày 11/10/2026 có 93 file/626 test backend, các trường hợp scope âm,
session/key lifecycle, source ownership, fetch/lease fencing, retention,
fresh-only alert và delivery recovery, cùng quality/dependency/secret gates.
Kết quả này là lịch sử tại revision đã nêu, không phải lần kiểm thử lại khi sửa docs.

Trước release tiếp theo phải chạy kiểm tra tương ứng, cập nhật ngày/revision và
phân biệt unit/integration/fixture/live. Không dùng một con số test để kết luận
target production đã an toàn hoặc đã thu đủ dữ liệu provider.
