# Active backend context

Updated: 2026-09-23

Đây là điểm vào ngắn cho phiên tiếp theo. Không sao chép lại chi tiết từ spec,
plan đã hoàn thành hoặc checkpoint lịch sử.

## Nguồn sự thật

- Trạng thái và thứ tự làm: [`tasks/todo.md`](todo.md)
- Acceptance criteria dài hạn:
  [`backend completion roadmap`](../docs/roadmaps/2026-09-02-backend-completion-roadmap.md)
- Lỗi và rủi ro còn mở:
  [`backend issue ledger`](../docs/reviews/2026-09-04-backend-follow-up.md)
- Lệnh local: [`LOCAL-RUNBOOK.md`](../docs/operations/LOCAL-RUNBOOK.md)
- Nối frontend/backend: `D:/IoT-web/docs/integration/README.md`

`docs/superpowers/plans/`, `docs/checkpoints/` và báo cáo test theo ngày chỉ là
lịch sử/bằng chứng; chỉ đọc khi cần truy quyết định cũ.

## Trạng thái hiện tại

- Phase A: hoàn thành.
- Phase B: backend core và frontend adapter/page đã hoàn thành; còn browser role
  matrix và xác minh provider CENTER/NODE thật.
- Phase C: backend core và frontend alert/inbox/capability page đã hoàn thành;
  còn browser role matrix và contract ghi xuống thiết bị thật.
- Phase D: local release candidate hoàn thành; production còn phụ thuộc staging,
  TLS/proxy, shared limiter, backup, MFA và metrics tập trung.
- Gate gần nhất: backend 59/59 file, 375/375 test đạt và `pnpm verify` xanh;
  frontend 37/37 test và production build đạt.

## Thứ tự tiếp theo

1. Chạy browser matrix theo từng trang và tạo checkpoint theo role:
   **Admin/Super Admin → Farmer → Client Developer**.
2. Ghi bằng chứng provider CENTER/NODE thật và giữ device writes unavailable cho
   tới khi có contract phần cứng.
3. Chạy QA recovery và chỉ sau đó mới nghiệm thu staging/production.

Không dùng giao diện hiển thị được hoặc dữ liệu mẫu để đóng B-device,
C-device hay D-production.
