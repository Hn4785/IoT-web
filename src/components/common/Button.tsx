import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import styles from "./Button.module.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Visual style of the button. Defaults to "primary". */
  variant?: ButtonVariant;
  /** Height/padding scale. Defaults to "md". */
  size?: ButtonSize;
  /** Shows a spinner and disables interaction while true. */
  loading?: boolean;
  /** Icon rendered before the label. */
  icon?: ReactNode;
  /** Icon rendered after the label. */
  iconRight?: ReactNode;
  /** Renders as a square icon-only button (no visible label). Provide an aria-label when using this. */
  iconOnly?: boolean;
  /** Stretches the button to the width of its container. */
  fullWidth?: boolean;
  /** Native button type. Defaults to "button" to avoid accidental form submits. */
  type?: "button" | "submit" | "reset";
  children?: ReactNode;
}

/**
 * Base action button used across the app.
 *
 * @example
 * <Button variant="primary" size="md" icon={<Plus size={16} />}>
 *   Add station
 * </Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      icon,
      iconRight,
      iconOnly = false,
      fullWidth = false,
      type = "button",
      className,
      children,
      ...rest
    },
    ref
  ) => {
    const spinnerSize = size === "sm" ? 14 : size === "lg" ? 20 : 16;

    const classNames = [
      styles.button,
      styles[variant],
      styles[size],
      iconOnly ? styles.iconOnly : "",
      fullWidth ? styles.fullWidth : "",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={type}
        className={classNames}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        <span className={styles.buttonInner}>
          {loading && (
            <span className={styles.loadingOverlay}>
              <Loader2 className={styles.spinner} size={spinnerSize} aria-hidden="true" />
            </span>
          )}
          <span className={`${styles.content} ${loading ? styles.labelHidden : ""}`}>
            {icon && <span className={styles.iconLeft} aria-hidden="true">{icon}</span>}
            {!iconOnly && children}
            {iconRight && <span className={styles.iconRight} aria-hidden="true">{iconRight}</span>}
          </span>
        </span>
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;