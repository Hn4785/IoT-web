import { useMemo, useState } from "react";
import { Check, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";

import Button from "@/components/common/Button";
import styles from "./ResetPassword.module.css";

function getPasswordStrength(password: string) {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return {
      label: "Weak",
      level: "weak",
    };
  }

  if (score <= 3) {
    return {
      label: "Fair",
      level: "fair",
    };
  }

  if (score === 4) {
    return {
      label: "Good",
      level: "good",
    };
  }

  return {
    label: "Strong",
    level: "strong",
  };
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const strength = useMemo(
    () => getPasswordStrength(password),
    [password],
  );

  const requirements = [
    {
      label: "At least 8 characters",
      valid: password.length >= 8,
    },
    {
      label: "One uppercase letter",
      valid: /[A-Z]/.test(password),
    },
    {
      label: "One lowercase letter",
      valid: /[a-z]/.test(password),
    },
    {
      label: "One number",
      valid: /\d/.test(password),
    },
  ];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter.");
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter.");
      return;
    }

    if (!/\d/.test(password)) {
      setError("Password must contain at least one number.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    /*
     * Password reset API is intentionally not implemented here.
     * The production authentication/reset-token contract is currently
     * NOT CONFIRMED.
     *
     * This only represents the successful UI state for now.
     */
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>SA</div>

            <div>
              <span className={styles.brandName}>Smart Agriculture</span>
              <span className={styles.brandSubtitle}>
                IoT Management Platform
              </span>
            </div>
          </div>

          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <Check size={30} aria-hidden="true" />
            </div>

            <div className={styles.heading}>
              <h1>Password updated</h1>
              <p>
                Your password has been successfully updated. You can now sign
                in using your new password.
              </p>
            </div>

            <Link to="/login" className={styles.loginLink}>
              Continue to sign in
            </Link>
          </div>

          <footer className={styles.footer}>
            <span>Smart Agriculture IoT Management Platform</span>
            <span>© 2026</span>
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>SA</div>

          <div>
            <span className={styles.brandName}>Smart Agriculture</span>
            <span className={styles.brandSubtitle}>
              IoT Management Platform
            </span>
          </div>
        </div>

        <div className={styles.iconContainer}>
          <LockKeyhole size={24} aria-hidden="true" />
        </div>

        <div className={styles.heading}>
          <h1>Reset your password</h1>
          <p>
            Create a new password for your Smart Agriculture account.
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="reset-password">New password</label>

            <div className={styles.inputWrapper}>
              <LockKeyhole size={18} aria-hidden="true" />

              <input
                id="reset-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter your new password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((current) => !current)}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>

            {password && (
              <div className={styles.strength}>
                <div className={styles.strengthHeader}>
                  <span>Password strength</span>
                  <strong className={styles[strength.level]}>
                    {strength.label}
                  </strong>
                </div>

                <div className={styles.strengthBar}>
                  <span
                    className={`${styles.strengthFill} ${
                      styles[strength.level]
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="reset-confirm-password">
              Confirm new password
            </label>

            <div className={styles.inputWrapper}>
              <LockKeyhole size={18} aria-hidden="true" />

              <input
                id="reset-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />

              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() =>
                  setShowConfirmPassword((current) => !current)
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className={styles.requirements}>
            <span className={styles.requirementsTitle}>
              Password requirements
            </span>

            <div className={styles.requirementList}>
              {requirements.map((requirement) => (
                <div
                  key={requirement.label}
                  className={`${styles.requirement} ${
                    requirement.valid ? styles.valid : ""
                  }`}
                >
                  <span className={styles.requirementIcon}>
                    <Check size={12} aria-hidden="true" />
                  </span>

                  <span>{requirement.label}</span>
                </div>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className={styles.submit}
          >
            Update password
          </Button>
        </form>

        <Link to="/login" className={styles.backLink}>
          Back to sign in
        </Link>

        <footer className={styles.footer}>
          <span>Smart Agriculture IoT Management Platform</span>
          <span>© 2026</span>
        </footer>
      </section>
    </main>
  );
}