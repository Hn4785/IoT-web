# Lỗi còn tồn đọng

Cập nhật ngày 08/10/2026. File này chỉ theo dõi lỗi đang mở và các phần cần xác nhận.
Lỗi đã xử lý được lưu trong lịch sử Git và bằng chứng kiểm thử của từng phiên bản.

## Chưa sửa

### P2 — Cửa sổ raw history rỗng chặn backfill

**Hiện tượng:** response `{ success: true, data: [] }` hợp lệ theo schema nhưng
bộ chuẩn hoá từ chối vì không tìm thấy bản ghi của trạm yêu cầu. Checkpoint bị đánh
dấu invalid và watermark không đi qua cửa sổ đó.

**Ảnh hưởng:** quá trình thu lịch sử cũ có thể dừng tại cửa sổ rỗng và thử lại có
giới hạn. Luồng latest vẫn lưu số đo thật. Cơ chế giữ raw tối đa 90 ngày đã có,
nhưng không thể kết luận đã lấy đủ 90 ngày lịch sử.

**Phạm vi:** backend station-data, bộ chuẩn hoá raw history và checkpoint thu thập.
Đây là lỗi xử lý dữ liệu đầu vào, không phải lỗi kết nối hay database của thiết bị
triển khai.

**Trạng thái:** đã tái hiện; chưa sửa trong bản bàn giao. Cần phân biệt cửa sổ thật
sự rỗng với response thiếu/sai trạm trước khi cho watermark tiến. Không tạo số đo
hoặc đánh dấu coverage đầy đủ khi chưa có bằng chứng.

**Kiểm tra khi sửa:** cửa sổ rỗng, sai trạm, cửa sổ có dữ liệu, phân trang, giới hạn
thử lại, restart, quyền truy cập và không sinh cảnh báo từ backfill.

Chi tiết tái hiện được giữ tại
[F-data follow-up](2026-10-05-pi-f-data.md#open-p2-empty-old-history-window-blocks-backfill).

## Cần xác nhận khi tiếp nhận

Các mục dưới đây không được tính là lỗi logic đã tái hiện:

- Một lifecycle cảnh báo mới và notification tự động mới từ nguồn thật sau phục hồi.
- Ảnh đối chiếu trước/sau cho toàn bộ nhóm trang đã chỉnh bố cục.
- Quyền sử dụng hình ảnh và tài nguyên trong source.
- Cấu hình TLS/proxy, người giữ khoá backup, nơi lưu backup ngoài máy và năng lực
  hệ thống trên server do bên nhận lựa chọn.
- Người giao/nhận, ngày tiếp nhận và các ngoại lệ được chấp thuận.

MFA/SSO nằm ngoài phạm vi đã thống nhất. Bản bàn giao không có điều khiển thiết bị
từ xa, đồng bộ hai chiều, email/SMS hoặc chứng nhận bảo mật production.

## Phiên bản đã kiểm tra

Baseline ngày 06/10/2026: backend 93 file/621 tests; frontend 242 tests; kiểm tra
HTTP/browser cô lập 14/14 và browser mock desktop/mobile 14/14. Đây là kết quả
của lượt phát hành đó, không phải kiểm thử lại toàn bộ trong đợt sửa tài liệu.
Đợt tài liệu ngày 08/10/2026 không đổi runtime, schema hay dữ liệu.
