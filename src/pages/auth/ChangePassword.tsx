import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import Button from "@/components/common/Button";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";
import { normalizeApiError } from "@/utils/apiError";
import { getDefaultRouteByRole } from "@/auth/defaultRoute";

import styles from "./ChangePassword.module.css";

type PasswordField = "current" | "new" | "confirm";

interface FieldErrors {
  current: string;
  new: string;
  confirm: string;
}

const INITIAL_FIELD_ERRORS: FieldErrors = {
  current: "",
  new: "",
  confirm: "",
};

export default function ChangePassword() {
  const navigate = useNavigate();

  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generalError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(
    INITIAL_FIELD_ERRORS,
  );

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  /*
   * Sau khi đổi password thành công:
   * - hiển thị Account Secured
   * - cho phép người dùng bấm Enter Dashboard
   * - đồng thời tự chuyển dashboard sau một khoảng ngắn
   */
  useEffect(() => {
    if (!success || !user) return;

    const timer = window.setTimeout(() => {
      navigate(getDefaultRouteByRole(user.role), {
        replace: true,
      });
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [success, user, navigate]);

  const clearFieldError = (field: PasswordField) => {
    setFieldErrors((previous) => ({
      ...previous,
      [field]: "",
    }));
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {
      current: "",
      new: "",
      confirm: "",
    };

    let valid = true;

    if (!currentPassword.trim()) {
      errors.current = "Current password is required.";
      valid = false;
    }

    if (
      newPassword.length < 12 ||
      newPassword.length > 128
    ) {
      errors.new =
        "Password must be between 12 and 128 characters.";
      valid = false;
    }

    if (newPassword !== confirmPassword) {
      errors.confirm = "Passwords do not match.";
      valid = false;
    }

    setFieldErrors(errors);

    return valid;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) return;

    const isValid = validate();

    if (!isValid) return;

    setSubmitting(true);

    try {
      const updatedUser = await authService.changePassword({
        currentPassword,
        newPassword,
      });

      setUser(updatedUser);
      setFieldErrors(INITIAL_FIELD_ERRORS);
      setSuccess(true);
    } catch (reason) {
      const apiError = normalizeApiError(reason);

      /*
       * Backend có thể trả message khác nhau.
       * Với lỗi xác thực current password, hiển thị đúng UI Figma.
       */
      const normalizedMessage = apiError.message.toLowerCase();

      if (
        normalizedMessage.includes("current password") ||
        normalizedMessage.includes("old password") ||
        normalizedMessage.includes("incorrect password") ||
        normalizedMessage.includes("invalid password")
      ) {
        setFieldErrors((previous) => ({
          ...previous,
          current: "Current password is incorrect.",
        }));
      } else {
        /*
         * Nếu backend trả lỗi khác mà chưa có mapping cụ thể,
         * vẫn hiển thị message ở current field để không làm mất
         * thông tin lỗi từ backend.
         */
        setFieldErrors((previous) => ({
          ...previous,
          current: apiError.message,
        }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const goToDashboard = () => {
    if (!user) {
      navigate("/", { replace: true });
      return;
    }

    navigate(getDefaultRouteByRole(user.role), {
      replace: true,
    });
  };

  if (success) {
    return (
      <section className={styles.page} aria-labelledby="account-secured-title">
        <div className={styles.card}>
          <div className={styles.successBanner} role="status">
            <CheckCircle2
              size={14}
              strokeWidth={2}
              aria-hidden="true"
            />

            <span>
              Password updated successfully. Redirecting to
              dashboard...
            </span>
          </div>

          <div className={styles.successContent}>
            <div className={styles.successIcon}>
              <ShieldCheck
                size={24}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </div>

            <h1 id="account-secured-title">
              Account Secured
            </h1>

            <p>
              All set! Your profile credential change is
              processed. You will be redirected to the monitoring
              dashboard momentarily.
            </p>

            <Button
              type="button"
              size="lg"
              fullWidth
              onClick={goToDashboard}
            >
              Enter Dashboard
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={styles.page}
      aria-labelledby="change-password-title"
    >
      <div className={styles.card}>
        <div className={styles.heading}>
          <h1 id="change-password-title">
            Change Password
          </h1>

          <p>
            Your account status is currently pending. Please
            update your password to secure your account and unlock
            the AgriSense system.
          </p>
        </div>

        <form
          className={styles.form}
          onSubmit={submit}
          noValidate
        >
          {generalError && (
            <div className={styles.generalError} role="alert">
              <AlertCircle
                size={13}
                aria-hidden="true"
              />
              <span>{generalError}</span>
            </div>
          )}
          <div className={styles.field}>
            <label htmlFor="current-password">
              Current Password
            </label>

            <div
              className={`${styles.inputWrapper} ${
                fieldErrors.current
                  ? styles.inputError
                  : ""
              }`}
            >
              <input
                id="current-password"
                type={
                  showCurrentPassword
                    ? "text"
                    : "password"
                }
                autoComplete="current-password"
                placeholder="Enter current password"
                value={currentPassword}
                disabled={submitting}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  clearFieldError("current");
                }}
                aria-invalid={Boolean(fieldErrors.current)}
                aria-describedby={
                  fieldErrors.current
                    ? "current-password-error"
                    : undefined
                }
              />

              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() =>
                  setShowCurrentPassword(
                    (previous) => !previous,
                  )
                }
                disabled={submitting}
                aria-label={
                  showCurrentPassword
                    ? "Hide current password"
                    : "Show current password"
                }
              >
                {showCurrentPassword ? (
                  <EyeOff size={14} aria-hidden="true" />
                ) : (
                  <Eye size={14} aria-hidden="true" />
                )}
              </button>
            </div>

            {fieldErrors.current && (
              <p
                id="current-password-error"
                className={styles.fieldError}
                role="alert"
              >
                {fieldErrors.current}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="new-password">
              New Password
            </label>

            <div
              className={`${styles.inputWrapper} ${
                fieldErrors.new
                  ? styles.inputError
                  : ""
              }`}
            >
              <input
                id="new-password"
                type={
                  showNewPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                placeholder="Enter new password"
                value={newPassword}
                minLength={12}
                maxLength={128}
                disabled={submitting}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  clearFieldError("new");
                }}
                aria-invalid={Boolean(fieldErrors.new)}
                aria-describedby={
                  fieldErrors.new
                    ? "new-password-error"
                    : undefined
                }
              />

              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() =>
                  setShowNewPassword(
                    (previous) => !previous,
                  )
                }
                disabled={submitting}
                aria-label={
                  showNewPassword
                    ? "Hide new password"
                    : "Show new password"
                }
              >
                {showNewPassword ? (
                  <EyeOff size={14} aria-hidden="true" />
                ) : (
                  <Eye size={14} aria-hidden="true" />
                )}
              </button>
            </div>

            {fieldErrors.new && (
              <p
                id="new-password-error"
                className={styles.fieldError}
                role="alert"
              >
                {fieldErrors.new}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="confirm-password">
              Confirm New Password
            </label>

            <div
              className={`${styles.inputWrapper} ${
                fieldErrors.confirm
                  ? styles.inputError
                  : ""
              }`}
            >
              <input
                id="confirm-password"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirmPassword}
                disabled={submitting}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  clearFieldError("confirm");
                }}
                aria-invalid={Boolean(fieldErrors.confirm)}
                aria-describedby={
                  fieldErrors.confirm
                    ? "confirm-password-error"
                    : undefined
                }
              />

              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() =>
                  setShowConfirmPassword(
                    (previous) => !previous,
                  )
                }
                disabled={submitting}
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={14} aria-hidden="true" />
                ) : (
                  <Eye size={14} aria-hidden="true" />
                )}
              </button>
            </div>

            {fieldErrors.confirm && (
              <p
                id="confirm-password-error"
                className={styles.fieldError}
                role="alert"
              >
                {fieldErrors.confirm}
              </p>
            )}
          </div>

          <p className={styles.passwordHint}>
            Password must be between 12 and 128 characters.
          </p>

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={submitting}
          >
            {submitting ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </section>
  );
}