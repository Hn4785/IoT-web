import { Search, Bell, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Breadcrumb from './Breadcrumb';
import styles from './Topbar.module.css';

interface TopbarProps {
  /**
   * Số lượng thông báo chưa đọc, hiển thị badge đỏ trên icon chuông.
   * ⚠️ Nguồn dữ liệu thật (API/context) chưa xác nhận — tạm nhận qua props.
   */
  notificationCount?: number;
  onSearch?: (query: string) => void;
}

/**
 * ⚠️ GIẢ ĐỊNH — CẦN XÁC NHẬN
 * - Ảnh mẫu chưa cho thấy trạng thái mở của dropdown avatar/notification, nên phần này
 *   chỉ dựng UI tĩnh (icon + badge), chưa có dropdown menu (Profile/Settings/Logout).
 *   Cần ảnh Figma của trạng thái "click vào avatar" để code tiếp phần dropdown.
 * - Chưa xác nhận Topbar có khác biệt gì cho role client_developer (ví dụ API status badge).
 * - `types/user.ts` KHÔNG có field `avatarUrl` trên `User`, nên ảnh mẫu (avatar là ảnh
 *   thật) hiện KHÔNG thể render — Topbar tạm luôn dùng chữ cái đầu (initials) như Sidebar.
 *   Nếu hệ thống có avatar ảnh thật, cần bổ sung field này vào `User` hoặc lấy từ nguồn
 *   khác (vd. Gravatar/S3 URL riêng) rồi truyền qua props.
 */
export default function Topbar({ notificationCount = 0, onSearch }: TopbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <Breadcrumb />
      </div>

      <div className={styles.right}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Global search devices, stations..."
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>

        <button type="button" className={styles.iconButton} aria-label="Notifications">
          <Bell size={18} />
          {notificationCount > 0 && (
            <span className={styles.badge}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        <button type="button" className={styles.iconButton} aria-label="Log out" title="Log out" onClick={async () => { await logout(); navigate('/login', { replace: true }); }}>
          <LogOut size={18} />
        </button>

        {user && (
          <button type="button" className={styles.avatarButton} aria-label="User menu">
            <span className={styles.avatarFallback}>
              {user.displayName.charAt(0).toUpperCase()}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
