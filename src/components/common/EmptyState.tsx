import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Button } from "./Button";
import type { ButtonVariant } from "./Button";
import styles from "./EmptyState.module.css";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
}

export interface EmptyStateProps {
  /** Icon rendered inside the circular badge. Defaults to a generic inbox icon. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Convenience prop for a single action button. Ignored if `action` (custom node) is provided. */
  action?: EmptyStateAction;
  /** Fully custom action content, overrides `action`. */
  customAction?: ReactNode;
  className?: string;
}

/**
 * Shown when a list/table/section has no data yet.
 *
 * @example
 * <EmptyState
 *   title="No stations yet"
 *   description="Add your first station to start collecting sensor data."
 *   action={{ label: "Add station", onClick: openCreateStationModal }}
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  customAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <span className={styles.iconWrapper} aria-hidden="true">
        {icon ?? <Inbox size={24} />}
      </span>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {customAction ? (
        <div className={styles.action}>{customAction}</div>
      ) : action ? (
        <div className={styles.action}>
          <Button variant={action.variant ?? "primary"} size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default EmptyState;