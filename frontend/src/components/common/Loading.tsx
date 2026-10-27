import { Loader2 } from "lucide-react";
import styles from "./Loading.module.css";

/* ============================================================
   Spinner — small inline loading indicator
   ============================================================ */

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps {
  size?: SpinnerSize;
  /** Optional text shown next to the spinner (e.g. "Loading stations..."). */
  label?: string;
  className?: string;
}

const SPINNER_PX: Record<SpinnerSize, number> = { sm: 16, md: 24, lg: 32 };

export function Spinner({ size = "md", label, className }: SpinnerProps) {
  return (
    <span className={`${styles.spinnerWrapper} ${className ?? ""}`} role="status" aria-live="polite">
      <Loader2 className={styles.spinner} size={SPINNER_PX[size]} aria-hidden="true" />
      {label && <span className={styles.spinnerLabel}>{label}</span>}
      {!label && <span className="sr-only">Loading</span>}
    </span>
  );
}

/* ============================================================
   Skeleton — placeholder block shown while content loads
   ============================================================ */

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  /** Renders a circular skeleton (e.g. for avatars). */
  circle?: boolean;
  className?: string;
}

/**
 * @example
 * <Skeleton width="60%" height={16} />
 * <Skeleton width={40} height={40} circle />
 */
export function Skeleton({ width = "100%", height = 16, circle = false, className }: SkeletonProps) {
  return (
    <span
      className={`${styles.skeleton} ${circle ? styles.skeletonCircle : ""} ${className ?? ""}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/* ============================================================
   Loading — full-page or inline loading state wrapper
   ============================================================ */

export interface LoadingProps {
  /** Renders as a fixed overlay covering the viewport. Defaults to false (renders inline within its container). */
  fullPage?: boolean;
  size?: SpinnerSize;
  label?: string;
}

/**
 * @example
 * // Inline, inside a card or table while data loads
 * <Loading label="Loading sensors..." />
 *
 * // Full-page, e.g. during initial app/auth bootstrap
 * <Loading fullPage label="Loading dashboard..." />
 */
export function Loading({ fullPage = false, size = "lg", label }: LoadingProps) {
  return (
    <div className={fullPage ? styles.fullPage : styles.inline} role="status" aria-live="polite">
      <Loader2 className={styles.spinner} size={SPINNER_PX[size]} aria-hidden="true" />
      {label && <span className={fullPage ? styles.fullPageLabel : styles.spinnerLabel}>{label}</span>}
    </div>
  );
}

export default Loading;