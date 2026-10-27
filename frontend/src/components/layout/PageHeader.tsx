import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  description?: string;
  /**
   * Khu vực bên phải title — có thể là 1 Button đơn ("Add Station"), hoặc 1 nhóm
   * filter dropdowns như trong ảnh Admin Dashboard ("Farm: All Farms", "Station: All"...).
   * Để ReactNode tự do vì ảnh mẫu cho thấy 2 kiểu dùng khác nhau tuỳ trang.
   */
  actions?: ReactNode;
}

/**
 * ⚠️ GHI CHÚ
 * Breadcrumb KHÔNG được tích hợp trong PageHeader — theo ảnh mẫu, breadcrumb nằm
 * trong Topbar (phía trên PageHeader), 2 component tách biệt hoàn toàn.
 */
export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.titleGroup}>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>

      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}