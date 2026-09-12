import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Settings,
  History,
  Activity,
  Leaf,
  ShieldCheck,
  Radio,
  BellRing,
  GitPullRequest,
  Droplets,
  BarChart3,
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

const NAV_CONFIG: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: "Device Health", path: "/admin/device-health", icon: ShieldCheck},
    { label: "Stations & Devices", path: "/admin/devices", icon: Radio},
    { label: "Alert Center", path: "/admin/alert-center", icon: BellRing},
    { label: "Config Proposals", path: "/admin/config-proposals", icon: GitPullRequest},
    { label: 'Users', path: '/admin/users', icon: Users },
    { label: 'IoT Config', path: '/admin/configuration', icon: Settings },
    { label: 'Audit Log', path: '/admin/audit-logs', icon: History },
  ],
  FARMER: [
    { label: 'Dashboard', path: '/farm-owner/dashboard', icon: LayoutDashboard },
    { label: 'Soil Dashboard', path: '/farm-owner/soil-dashboard', icon: Droplets},
    { label: 'Historical Analysis', path: '/farm-owner/historical-analysis', icon: BarChart3 },
    { label: 'History Report', path: '/farm-owner/history-reports', icon: History },
    { label: 'Notifications', path: '/farm-owner/notifications', icon: Settings },
    { label: 'Alerts', path: '/farm-owner/alerts', icon: Activity},
    { label: 'Alert Center', path: '/farm-owner/alert-center', icon: Activity },
  ],
  CLIENT_DEVELOPER: [
    { label: 'Dashboard', path: '/developer/dashboard', icon: LayoutDashboard },
    { label: 'API Keys', path: '/developer/api-keys', icon: Settings },
    { label: 'API Permissions', path: '/developer/api-permissions', icon: Users },
    { label: 'API Docs', path: '/developer/api-docs', icon: History },
    { label: 'API Explorer', path: '/developer/api-explorer', icon: Activity },
    { label: 'API Metrics', path: '/developer/api-metrics', icon: Activity },
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
    ADMIN: 'Admin',
    FARMER: 'Farm Owner',
    CLIENT_DEVELOPER: 'Developer',
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
        <span className={styles.userAvatar}>{getInitials(user.displayName)}</span>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.displayName}</span>
          <span className={styles.userRole}>{formatRoleLabel(user.role)}</span>
        </div>
      </div>
    </aside>
  );
}
