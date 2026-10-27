import type { ReactNode } from "react";
import { WifiOff, ServerCrash, FileQuestion, ShieldAlert, AlertCircle } from "lucide-react";
import { Button } from "./Button";
import styles from "./ErrorState.module.css";

export type ErrorStateVariant = "network" | "server" | "404" | "403" | "unknown";

interface ErrorStateDefault {
  icon: ReactNode;
  title: string;
  description: string;
}

const ERROR_DEFAULTS: Record<ErrorStateVariant, ErrorStateDefault> = {
  network: {
    icon: <WifiOff size={24} />,
    title: "No connection",
    description: "Check your internet connection and try again.",
  },
  server: {
    icon: <ServerCrash size={24} />,
    title: "Something went wrong",
    description: "The server ran into a problem. Please try again in a moment.",
  },
  "404": {
    icon: <FileQuestion size={24} />,
    title: "Not found",
    description: "The page or resource you're looking for doesn't exist.",
  },
  "403": {
    icon: <ShieldAlert size={24} />,
    title: "Access denied",
    description: "You don't have permission to view this content.",
  },
  unknown: {
    icon: <AlertCircle size={24} />,
    title: "Unexpected error",
    description: "Something went wrong. Please try again.",
  },
};

export interface ErrorStateProps {
  variant?: ErrorStateVariant;
  /** Overrides the default title for this variant. */
  title?: string;
  /** Overrides the default description for this variant. */
  description?: string;
  /** Overrides the default icon for this variant. */
  icon?: ReactNode;
  /** Called when the retry button is clicked. Omit to hide the retry action. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * Shown when a request/section fails to load.
 *
 * @example
 * <ErrorState variant="network" onRetry={refetch} />
 * <ErrorState variant="403" title="You can't view this farm" />
 */
export function ErrorState({
  variant = "unknown",
  title,
  description,
  icon,
  onRetry,
  retryLabel = "Try again",
  className,
}: ErrorStateProps) {
  const defaults = ERROR_DEFAULTS[variant];

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <span className={styles.iconWrapper} aria-hidden="true">
        {icon ?? defaults.icon}
      </span>
      <p className={styles.title}>{title ?? defaults.title}</p>
      <p className={styles.description}>{description ?? defaults.description}</p>
      {onRetry && (
        <div className={styles.action}>
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;