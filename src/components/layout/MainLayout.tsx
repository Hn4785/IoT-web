import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import styles from './MainLayout.module.css';

interface MainLayoutProps {
  children: ReactNode;
}

/**
 * ⚠️ GIẢ ĐỊNH — CẦN XÁC NHẬN
 * - Chưa xác nhận layout có cần responsive (mobile/tablet) hay chỉ target desktop 1440px
 *   như Figma gốc. Hiện tại KHÔNG có breakpoint/hamburger menu — Sidebar luôn hiển thị.
 * - Chưa có thiết kế Sidebar collapsed, nên MainLayout hiện chưa hỗ trợ toggle thu gọn.
 *   Nếu cần, bổ sung sau khi có ảnh Figma trạng thái collapsed.
 * - `<Outlet />` của react-router có thể dùng thay cho `children` nếu bạn muốn nest route
 *   qua `<Route element={<MainLayout />}>`; ở đây dùng `children` cho đơn giản, tuỳ chỉnh
 *   theo cách bạn tổ chức `AppRoutes.tsx`.
 */
export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className={styles.layout}>
      <Sidebar />

      <div className={styles.main}>
        <Topbar />

        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}