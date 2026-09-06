import { useState } from "react";
import { Eye, EyeOff, Leaf, LockKeyhole, Mail } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import Button from "@/components/common/Button";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { getDefaultRouteByRole } from "@/auth/defaultRoute";
import { normalizeApiError } from "@/utils/apiError";
import { requiresPasswordChange } from "@/auth/passwordChange";
import styles from "./Login.module.css";

interface LocationState {
  from?: { pathname?: string };
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await authService.login({ email: email.trim(), password });
      login(result.user);
      const state = location.state as LocationState | null;
      navigate(
        requiresPasswordChange(result.user)
          ? "/change-password"
          : state?.from?.pathname || getDefaultRouteByRole(result.user.role),
        { replace: true },
      );
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.brandMark}><Leaf size={20} /></span>
          <span>
            <span className={styles.brandName}>AgriSense</span>
            <span className={styles.brandSubtitle}>Agricultural IoT monitoring</span>
          </span>
        </div>

        <div className={styles.content}>
          <div className={styles.heading}>
            <h1>Sign in</h1>
            <p>Use the account provided by your administrator.</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {error && <div className={styles.error} role="alert">{error}</div>}

            <div className={styles.field}>
              <label htmlFor="login-email">Email</label>
              <div className={styles.inputWrapper}>
                <Mail size={18} aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="login-password">Password</label>
              <div className={styles.inputWrapper}>
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
              Sign in
            </Button>
          </form>

          <p className={styles.securityNote}>
            Your session is protected by a secure refresh cookie.
          </p>
        </div>
      </section>

      <aside className={styles.visualPanel} aria-hidden="true">
        <div className={styles.visualOverlay} />
        <div className={styles.visualContent}>
          <span className={styles.eyebrow}>FIELD INTELLIGENCE</span>
          <h2>Soil measurements, stations and alerts in one place.</h2>
          <p>Monitor agricultural conditions and act on reliable field data.</p>
        </div>
      </aside>
    </main>
  );
}
