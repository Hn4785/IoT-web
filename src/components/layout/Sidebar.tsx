import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Settings,
  Monitor,
  History,
  Activity,
  Leaf,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/user';
import styles from './Sidebar.module.css';

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

/**
 * ⚠️ GIẢ ĐỊNH — CẦN XÁC NHẬN VỚI FIGMA
 * - Menu "admin" lấy đúng theo ảnh Admin Dashboard đã gửi (Dashboard, Users, IoT Config,
 *   Devices, Audit Log, System Monitor).
 *   Lưu ý: "System Monitor" xuất hiện trong ảnh nhưng KHÔNG có trong danh sách
 *   `pages/admin/` gốc (AdminDashboard, UserManagement, IoTConfiguration,
 *   DeviceManagement, AuditLogs) — cần xác nhận có thêm trang này không.
 * - Menu của 4 role còn lại (technician, operator, farm_owner, developer) được SUY RA
 *   từ tên file trong `pages/{role}/` ở tài liệu handover, CHƯA có ảnh Figma xác nhận
 *   label/icon/thứ tự thật. Cần thay lại khi có ảnh.
 */
const NAV_CONFIG: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'Users', path: '/admin/users', icon: Users },
    { label: 'IoT Config', path: '/admin/configuration', icon: Settings },
    { label: 'Devices', path: '/admin/devices', icon: Monitor },
    { label: 'Audit Log', path: '/admin/audit-logs', icon: History },
  ],
  farm_owner: [
    { label: 'Dashboard', path: '/farm-owner/dashboard', icon: LayoutDashboard },
    { label: 'History Report', path: '/farm-owner/history-report', icon: History },
    { label: 'Notifications', path: '/farm-owner/notifications', icon: Settings },
    { label: 'Alert Center', path: '/farm-owner/alert-center', icon: Activity },
  ],
  client_developer: [
    { label: 'Dashboard', path: '/developer/dashboard', icon: LayoutDashboard },
    { label: 'API Keys', path: '/developer/api-keys', icon: Settings },
    { label: 'API Permissions', path: '/developer/api-permissions', icon: Users },
    { label: 'API Docs', path: '/developer/api-docs', icon: History },
    { label: 'API Explorer', path: '/developer/api-explorer', icon: Activity },
    { label: 'API Metrics', path: '/developer/api-metrics', icon: Monitor },
  ],
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * ⚠️ GIẢ ĐỊNH — label hiển thị cho từng role, chưa xác nhận với Figma
 * (ảnh mẫu chỉ cho thấy "Admin").
 */
function formatRoleLabel(role: UserRole): string {
  const map: Record<UserRole, string> = {
    admin: 'Admin',

    farm_owner: 'Farm Owner',
    client_developer: 'Developer',
  };
  return map[role] ?? role;
}

export default function Sidebar() {
  const { user } = useAuth();

  if (!user) return null;

  const items = NAV_CONFIG[user.role] ?? [];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}>
          <Leaf size={18} strokeWidth={2.5} />
        </span>
        <span className={styles.brandName}>AgriSense</span>
      </div>

      <nav className={styles.nav} aria-label="Main navigation">
        <ul className={styles.navList}>
          {items.map(({ label, path, icon: Icon }) => (
            <li key={path}>
              <NavLink
                to={path}
                className={({ isActive }) =>
                  isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
                }
              >
                <Icon size={18} strokeWidth={2} className={styles.navIcon} />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.userFooter}>
        <span className={styles.userAvatar}>{getInitials(user.fullName)}</span>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.fullName}</span>
          <span className={styles.userRole}>{formatRoleLabel(user.role)}</span>
        </div>
      </div>
    </aside>
  );
}