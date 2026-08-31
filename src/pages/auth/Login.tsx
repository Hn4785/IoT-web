import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

import Button from "@/components/common/Button";
import styles from "./Login.module.css";

const DEMO_EMAIL = "admin@example.com";
const DEMO_PASSWORD = "password";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    /*
     * Authentication is intentionally not connected to a backend yet.
     * useAuth() and the production authentication contract are
     * currently NOT CONFIRMED.
     *
     * Temporary development behavior:
     * accept any non-empty credentials and navigate to /admin.
     *
     * Replace this block with the real auth flow once the backend
     * contract and useAuth implementation are confirmed.
     */
    if (email === DEMO_EMAIL && password !== DEMO_PASSWORD) {
      setError("Invalid email or password.");
      return;
    }

    navigate("/admin");
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>SA</div>

          <div>
            <span className={styles.brandName}>Smart Agriculture</span>
            <span className={styles.brandSubtitle}>IoT Management Platform</span>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.heading}>
            <h1>Welcome back</h1>
            <p>Sign in to access your agriculture monitoring platform.</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="login-email">Email address</label>

              <div className={styles.inputWrapper}>
                <Mail size={18} aria-hidden="true" />

                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="login-password">Password</label>

                <Link to="/forgot-password" className={styles.forgotLink}>
                  Forgot password?
                </Link>
              </div>

              <div className={styles.inputWrapper}>
                <LockKeyhole size={18} aria-hidden="true" />

                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />

                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />

              <span>Remember me</span>
            </label>

            <Button type="submit" variant="primary" size="lg" className={styles.submit}>
              Sign in
            </Button>
          </form>

          <div className={styles.securityNote}>
            <LockKeyhole size={15} aria-hidden="true" />
            <span>Your connection is secured with encrypted authentication.</span>
          </div>
        </div>

        <footer className={styles.footer}>
          <span>Smart Agriculture IoT Management Platform</span>
          <span>© 2026</span>
        </footer>
      </section>

      <aside className={styles.visualPanel}>
        <div className={styles.visualOverlay} />

        <div className={styles.visualContent}>
          <span className={styles.eyebrow}>SMART AGRICULTURE</span>

          <h2>
            Monitor your soil.
            <br />
            Make better decisions.
          </h2>

          <p>
            Real-time soil monitoring, connected IoT stations, intelligent
            alerts, and reliable agricultural data in one platform.
          </p>

          <div className={styles.metrics}>
            <div>
              <strong>24/7</strong>
              <span>Monitoring</span>
            </div>

            <div>
              <strong>Real-time</strong>
              <span>Soil data</span>
            </div>

            <div>
              <strong>IoT</strong>
              <span>Connected</span>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}