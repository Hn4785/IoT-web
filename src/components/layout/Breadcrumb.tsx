import { Link, useLocation } from 'react-router-dom';
import styles from './Breadcrumb.module.css';

interface BreadcrumbItem {
  label: string;
  path: string;
}

/**
 * ⚠️ GIẢ ĐỊNH — CẦN XÁC NHẬN
 * `routeConfig.ts` gốc chưa có nội dung xác định, nên bảng nhãn dưới đây là suy đoán
 * dựa trên tên file trong `pages/{role}/` + ảnh mẫu Admin ("System / Dashboard").
 * Khi có `routeConfig.ts` thật, nên chuyển bảng này ra dùng chung ở đó thay vì để cứng
 * (hardcode) trong component.
 */
const SEGMENT_LABELS: Record<string, string> = {
  // Lưu ý: đây là nhãn cho SEGMENT TRÊN URL (vd. "/developer/..."), không phải giá trị
  // của UserRole trong types/user.ts (role thật là "client_developer"). Sidebar.tsx dùng
  // path '/developer/...' cho role client_developer — nếu URL thực tế khác, sửa key ở đây.
  admin: 'System',
  technician: 'Technical',
  operator: 'Field Operations',
  'farm-owner': 'Farm',
  developer: 'Developer',

  dashboard: 'Dashboard',
  users: 'Users',
  'iot-configuration': 'IoT Config',
  devices: 'Devices',
  'audit-logs': 'Audit Log',
  'system-monitor': 'System Monitor',
  'device-health': 'Device Health',
  stations: 'Stations',
  sensors: 'Sensors',
  alerts: 'Alerts',
  'config-proposals': 'Config Proposals',
  'soil-history': 'Soil History',
  'soil-comparison': 'Soil Comparison',
  'history-report': 'History Report',
  notifications: 'Notifications',
  'alert-center': 'Alert Center',
  'api-keys': 'API Keys',
  'api-permissions': 'API Permissions',
  'api-docs': 'API Docs',
  'api-explorer': 'API Explorer',
  'api-metrics': 'API Metrics',
};

function humanize(segment: string): string {
  return SEGMENT_LABELS[segment] ?? segment.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export default function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  const items: BreadcrumbItem[] = segments.map((segment, index) => ({
    label: humanize(segment),
    path: '/' + segments.slice(0, index + 1).join('/'),
  }));

  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.path} className={styles.item}>
              {isLast ? (
                <span className={styles.current} aria-current="page">
                  {item.label}
                </span>
              ) : (
                <>
                  <Link to={item.path} className={styles.link}>
                    {item.label}
                  </Link>
                  <span className={styles.separator}>/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}