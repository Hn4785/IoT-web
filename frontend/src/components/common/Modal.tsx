import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "./Button";
import type { ButtonVariant } from "./Button";
import styles from "./Modal.module.css";

export type ModalSize = "sm" | "md" | "lg" | "xl";

export interface ModalProps {
  /** Controls whether the modal is rendered. */
  isOpen: boolean;
  /** Called when the modal requests to close (overlay click, ESC, or close button). */
  onClose: () => void;
  /** Heading shown in the modal header. Omit to render a header-less modal. */
  title?: ReactNode;
  /** Optional supporting text under the title. */
  description?: ReactNode;
  size?: ModalSize;
  /** Closes the modal when the overlay (backdrop) is clicked. Defaults to true. */
  closeOnOverlayClick?: boolean;
  /** Closes the modal when the ESC key is pressed. Defaults to true. */
  closeOnEsc?: boolean;
  /** Shows the "X" close button in the header. Defaults to true. */
  showCloseButton?: boolean;
  /** Content rendered in the footer, right-aligned (typically action buttons). */
  footer?: ReactNode;
  children?: ReactNode;
}

/**
 * Base modal dialog, rendered via a portal into document.body.
 *
 * @example
 * <Modal isOpen={isOpen} onClose={close} title="Edit station" size="md">
 *   <StationForm />
 * </Modal>
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = "md",
  closeOnOverlayClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  footer,
  children,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on ESC
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEsc, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!closeOnOverlayClick) return;
    if (event.target === overlayRef.current) {
      onClose();
    }
  };

  const titleId = title ? "modal-title" : undefined;
  const descriptionId = description ? "modal-description" : undefined;

  return createPortal(
    <div
      ref={overlayRef}
      className={styles.overlay}
      onMouseDown={handleOverlayClick}
    >
      <div
        className={`${styles.modal} ${styles[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        {(title || showCloseButton) && (
          <div className={styles.header}>
            <div>
              {title && (
                <h2 id={titleId} className={styles.title}>
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className={styles.description}>
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        <div className={styles.body}>{children}</div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* ============================================================
   ConfirmDialog
   Built on top of Modal for "are you sure?" style confirmations
   with an async-aware confirm action.
   ============================================================ */

export type ConfirmDialogVariant = "danger" | "warning" | "primary";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when the user confirms. Can be async — the confirm button
   *  shows a loading state until the returned promise settles. */
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Controls the icon/accent color and the confirm button's variant. Defaults to "danger". */
  variant?: ConfirmDialogVariant;
}

const CONFIRM_ICON_CLASS: Record<ConfirmDialogVariant, string> = {
  danger: styles.confirmIconDanger,
  warning: styles.confirmIconWarning,
  primary: styles.confirmIconPrimary,
};

const CONFIRM_BUTTON_VARIANT: Record<ConfirmDialogVariant, ButtonVariant> = {
  danger: "danger",
  warning: "primary",
  primary: "primary",
};

/**
 * @example
 * <ConfirmDialog
 *   isOpen={isOpen}
 *   onClose={close}
 *   onConfirm={() => deleteStation(id)}
 *   title="Delete station?"
 *   description="This action cannot be undone."
 *   variant="danger"
 * />
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      await onConfirm();
      onClose();
    } finally {
      setIsConfirming(false);
    }
  };

  const Icon = variant === "primary" ? HelpCircle : AlertTriangle;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isConfirming ? () => {} : onClose}
      size="sm"
      closeOnOverlayClick={!isConfirming}
      closeOnEsc={!isConfirming}
      showCloseButton={!isConfirming}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isConfirming}>
            {cancelText}
          </Button>
          <Button
            variant={CONFIRM_BUTTON_VARIANT[variant]}
            onClick={handleConfirm}
            loading={isConfirming}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className={styles.confirmHeader}>
        <span className={`${styles.confirmIcon} ${CONFIRM_ICON_CLASS[variant]}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
        <div>
          <h3 className={styles.title}>{title}</h3>
          {description && <p className={styles.description}>{description}</p>}
        </div>
      </div>
    </Modal>
  );
}

export default Modal;