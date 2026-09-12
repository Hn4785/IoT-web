import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Loader2,
  Mail,
  WifiOff,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { getDefaultRouteByRole } from "@/auth/defaultRoute";
import { normalizeApiError } from "@/utils/apiError";
import { requiresPasswordChange } from "@/auth/passwordChange";

import styles from "./Login.module.css";

interface LocationState {
  from?: {
    pathname?: string;
  };
}

type LoginStatus =
  | "idle"
  | "authenticating"
  | "error"
  | "service_unavailable";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  const [status, setStatus] = useState<LoginStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isSubmitting = status === "authenticating";
  const isServiceUnavailable = status === "service_unavailable";

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (isSubmitting || isServiceUnavailable) {
      return;
    }

    setErrorMessage("");
    setStatus("authenticating");

    try {
      const result = await authService.login({
        email: email.trim(),
        password,
      });

      /*
       * keepLoggedIn hiện chỉ được dùng để giữ trạng thái UI.
       *
       * Không tự thay đổi authStorage/session strategy vì backend
       * contract về "remember me" chưa được xác nhận.
       */
      void keepLoggedIn;

      login(result.user);

      const state = location.state as LocationState | null;

      const destination = requiresPasswordChange(result.user)
        ? "/change-password"
        : state?.from?.pathname ||
          getDefaultRouteByRole(result.user.role);

      navigate(destination, {
        replace: true,
      });
    } catch (requestError) {
      const apiError = normalizeApiError(requestError);

      /*
       * 503 / 502 / 504 được hiển thị theo state
       * "Service temporarily unavailable".
       */
      if (
        apiError.status === 502 ||
        apiError.status === 503 ||
        apiError.status === 504
      ) {
        setStatus("service_unavailable");

        setErrorMessage(
          "Service temporarily unavailable. Telemetry server returned 503 Gateway Timeout. Please try again later.",
        );

        return;
      }

      setStatus("error");

      /*
       * Nếu backend đã trả message cụ thể thì giữ message đó.
       * Nếu backend trả message không phù hợp với Login UI,
       * dùng message chuẩn cho invalid credentials.
       */
      const normalizedMessage = apiError.message?.trim();

      setErrorMessage(
        normalizedMessage ||
          "Invalid email or password. Please check your credentials and try again.",
      );
    } finally {
      setStatus((currentStatus) =>
        currentStatus === "authenticating" ? "idle" : currentStatus,
      );
    }
  };

  const handleEmailChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setEmail(event.target.value);

    if (status === "error" || status === "service_unavailable") {
      setStatus("idle");
      setErrorMessage("");
    }
  };

  const handlePasswordChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setPassword(event.target.value);

    if (status === "error" || status === "service_unavailable") {
      setStatus("idle");
      setErrorMessage("");
    }
  };

  const isFieldError = status === "error";

  return (
    <main className={styles.page}>
      <div className={styles.background} />

      <div className={styles.overlay} />

      <div className={styles.cloudStatus}>
        <span className={styles.cloudStatusDot} />
        <span>AgriSense Cloud Active</span>
      </div>

      <section
        className={styles.loginCard}
        aria-labelledby="login-title"
      >
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <Leaf size={16} strokeWidth={2.4} />
          </span>

          <span className={styles.brandName}>
            AgriSense
          </span>
        </div>

        <header className={styles.heading}>
          <h1 id="login-title">Sign in to Portal</h1>

          <p>
            Agricultural IoT &amp; Telemetry Control
          </p>
        </header>

        {errorMessage && (
          <div
            className={
              status === "service_unavailable"
                ? styles.warningBanner
                : styles.errorBanner
            }
            role="alert"
          >
            <span className={styles.bannerIcon}>
              {status === "service_unavailable" ? (
                <WifiOff size={14} />
              ) : (
                <AlertCircle size={14} />
              )}
            </span>

            <span>{errorMessage}</span>
          </div>
        )}

        <form
          className={styles.form}
          onSubmit={handleSubmit}
        >
          <div className={styles.field}>
            <label htmlFor="login-email">
              Email Address
            </label>

            <div
              className={[
                styles.inputWrapper,
                isFieldError ? styles.inputError : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Mail
                className={styles.inputIcon}
                size={14}
                aria-hidden="true"
              />

              <input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="operator@agrisense.io"
                value={email}
                onChange={handleEmailChange}
                disabled={isSubmitting}
                required
                aria-invalid={isFieldError}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label htmlFor="login-password">
                Password
              </label>

              <Link
                className={styles.forgotLink}
                to="/forgot-password"
              >
                Forgot password?
              </Link>
            </div>

            <div
              className={[
                styles.inputWrapper,
                isFieldError ? styles.inputError : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <LockKeyhole
                className={styles.inputIcon}
                size={14}
                aria-hidden="true"
              />

              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••••"
                minLength={12}
                maxLength={128}
                value={password}
                onChange={handlePasswordChange}
                disabled={isSubmitting}
                required
                aria-invalid={isFieldError}
              />

              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() =>
                  setShowPassword(
                    (current) => !current,
                  )
                }
                disabled={isSubmitting}
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={14} />
                ) : (
                  <Eye size={14} />
                )}
              </button>
            </div>
          </div>

          <label className={styles.rememberMe}>
            <input
              type="checkbox"
              checked={keepLoggedIn}
              onChange={(event) =>
                setKeepLoggedIn(event.target.checked)
              }
              disabled={isSubmitting}
            />

            <span className={styles.customCheckbox}>
              {keepLoggedIn && (
                <CheckCircle2 size={11} />
              )}
            </span>

            <span>Keep me logged in</span>
          </label>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={
              isSubmitting ||
              isServiceUnavailable
            }
          >
            {isSubmitting ? (
              <>
                <Loader2
                  className={styles.spinner}
                  size={13}
                />
                <span>Authenticating...</span>
              </>
            ) : isServiceUnavailable ? (
              <>
                <WifiOff size={13} />
                <span>Sign In Offline</span>
              </>
            ) : (
              <span>Sign In to Console</span>
            )}
          </button>
        </form>

        <footer className={styles.footer}>
          AgriSense Monitoring Node System v2.4
        </footer>
      </section>
    </main>
  );
}