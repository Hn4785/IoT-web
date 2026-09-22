# Internal change record

Đây là đầu mối duy nhất để ghi thay đổi nội bộ của frontend. Mỗi thay đổi phải được ghi vào file này trước khi tạo checkpoint hoặc phát hành.

## Quy tắc cập nhật

Với mỗi thay đổi:

1. Ghi ngắn gọn nội dung, lý do và phạm vi ảnh hưởng.
2. Kiểm tra các luồng cũ có liên quan: API contract, quyền truy cập, điều hướng, trạng thái đăng nhập và giao diện dùng chung.
3. Ghi rõ kết quả test; không đánh dấu hoàn thành nếu chưa có bằng chứng kiểm tra.
4. Không ghi secret, mật khẩu, access token, refresh token hoặc API key vào file này.

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
