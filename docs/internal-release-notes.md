# Internal change record

Đây là đầu mối duy nhất để ghi thay đổi nội bộ của frontend. Mỗi thay đổi phải được ghi vào file này trước khi tạo checkpoint hoặc phát hành.

## Quy tắc cập nhật

Với mỗi thay đổi:

1. Ghi ngắn gọn nội dung, lý do và phạm vi ảnh hưởng.
2. Kiểm tra các luồng cũ có liên quan: API contract, quyền truy cập, điều hướng, trạng thái đăng nhập và giao diện dùng chung.
3. Ghi rõ kết quả test; không đánh dấu hoàn thành nếu chưa có bằng chứng kiểm tra.
4. Không ghi secret, mật khẩu, access token, refresh token hoặc API key vào file này.

## v2.5.2 — 2026-09-24 (Admin/Super Admin checkpoint)

### Thay đổi

- Nối Audit Log tới `GET /admin/audit-events`, dùng phân trang cursor và bộ lọc kết quả/khoảng ngày; chỉ Super Admin xem được. Bỏ bảng audit, trạng thái service và nút export dữ liệu mẫu.
- Nối Stations & Devices/Station Detail tới Farm → Plot → Station và latest soil thật. Device Health và Config Proposals tiếp tục fail-closed vì chưa có contract phần cứng.
- Bật cấp/thu hồi Farm membership cho Farmer và Station grant cho Client Developer trong User Management; sau ghi đọc lại chi tiết user từ backend.
- IoT Config bỏ các nút tạo/rollback cấu hình chưa có API thật, chuyển người dùng tới Alert Center khi cần sửa ngưỡng cảnh báo. UI Notifications của Admin tạm hoãn đến khi frontend Notifications được push.
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
- Chưa có contract health/ghi cấu hình thiết bị; các trang tương ứng chỉ hiển thị trạng thái chưa khả dụng.
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
