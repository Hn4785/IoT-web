# AgriSense 3.0.0

Hệ thống theo dõi trạm quan trắc đất, quản lý nguồn API, chia sẻ quyền đọc dữ
liệu và cảnh báo. Backend và frontend được đặt chung trong một repository;
mỗi phần giữ công cụ cài đặt, lockfile và quy trình build riêng.

## Cấu trúc

```text
backend/            NestJS, Fastify, Prisma và PostgreSQL
frontend/           React, Vite và cấu hình Nginx
.github/workflows/  Kiểm tra backend, image amd64/arm64 và frontend
```

## Lấy source

Ví dụ cho PowerShell trên máy mới, khi chưa có thư mục `D:\IoT`:

```powershell
cd D:\
git clone --branch codex/monorepo-final https://github.com/Hn4785/IoT-web.git IoT
cd D:\IoT
git rev-parse HEAD
```

Khi bàn giao hoặc triển khai, ghi lại commit cụ thể; không chỉ ghi tên nhánh.
Lịch sử hai nhánh `BE` và `FE` được giữ nguyên làm mốc đối chiếu.

## Dựng môi trường

Yêu cầu Node.js `>=24.17.0 <25`; backend dùng pnpm `11.19.0`, frontend dùng npm.

- [Backend](backend/README.md): bắt đầu từ
  [10 bước dựng môi trường](backend/docs/project/QUICKSTART.md). Chạy lệnh tại
  `backend/`, tạo cấu hình riêng và chỉ khởi tạo database mới khi đã kiểm tra đích.
- [Frontend](frontend/README.md): chạy `npm ci` rồi `npm run dev` tại `frontend/`;
  backend cần được dựng trước để đăng nhập và sử dụng dữ liệu thật.

Build Docker phải dùng đúng thư mục ứng dụng làm context: `backend/` hoặc
`frontend/`, không dùng thư mục gốc của repository.

## Kiểm tra

```powershell
cd D:\IoT\backend
pnpm verify
pnpm security:secrets
```

```powershell
cd D:\IoT\frontend
npm test
npm run lint
npm run build
```

Backend `pnpm test:coverage` cần database test riêng và có thao tác dọn dữ liệu;
không trỏ vào database đang sử dụng. CI tạo PostgreSQL cô lập và chạy đầy đủ
kiểm thử, audit dependency, build/smoke image và kiểm thử trình duyệt.

## Tài liệu và giới hạn

Bộ tài liệu backend gồm chín file, frontend gồm năm file; README này là điểm
vào chung. Các liên kết trong hai README dẫn đến tài liệu tương ứng.
Lỗi và giới hạn đang mở được giữ tại
[danh mục backend](backend/CAPABILITY-MAP.md) và
[README frontend](frontend/README.md). Việc gộp repository không thay đổi logic
phiên bản 3.0.0, không đồng nghĩa các tồn đọng đã được xử lý.

Đợt tích hợp ngày 27/10/2026 cập nhật bản vá dependency: Zod `4.6.6`, Vite
`8.2.4` và follow-redirects `1.16.2`. Audit frontend không còn advisory; audit
production backend còn năm advisory low và năm moderate, không còn high/critical.
Các advisory mức thấp hơn vẫn cần được rà soát trong lần bảo trì tiếp theo;
kết quả audit chỉ có hiệu lực tại thời điểm kiểm tra.

Không đưa `.env`, API key, database, bản sao lưu hoặc biên bản bàn giao riêng
vào Git. Chuyển thư mục source không phải là lệnh cập nhật Pi hay migration dữ liệu.
