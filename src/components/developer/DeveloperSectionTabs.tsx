import { Link, useLocation } from "react-router-dom";
import styles from "./DeveloperSectionTabs.module.css";

interface Tab {
  label: string;
  path: string;
}

const TABS: Record<"access" | "tools", Tab[]> = {
  access: [
    { label: "Keys", path: "/developer/api-access/keys" },
    { label: "Access Scope", path: "/developer/api-access/scope" },
  ],
  tools: [
    { label: "Documentation", path: "/developer/api-tools/docs" },
    { label: "API Explorer", path: "/developer/api-tools/explorer" },
  ],
};

interface DeveloperSectionTabsProps {
  section: "access" | "tools";
}

export default function DeveloperSectionTabs({ section }: DeveloperSectionTabsProps) {
  const { pathname } = useLocation();
  const tabs = TABS[section];
  const sectionLabel = section === "access" ? "API Access" : "API Tools";

  return (
    <nav className={styles.tabs} aria-label={`${sectionLabel} navigation`}>
      {tabs.map(({ label, path }) => (
        <Link
          key={path}
          to={path}
          className={pathname === path ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          aria-current={pathname === path ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
