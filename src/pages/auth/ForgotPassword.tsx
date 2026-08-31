import { FormEvent, useState } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import Button from "@/components/common/Button";
import styles from "./ForgotPassword.module.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setSubmitted(true);
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link to="/login" className={styles.backLink}>
          <ArrowLeft size={17} aria-hidden="true" />
          Back to sign in
        </Link>

        <div className={styles.brand}>
          <div className={styles.brandMark}>SA</div>

          <div>
            <span className={styles.brandName}>Smart Agriculture</span>
            <span className={styles.brandSubtitle}>IoT Management Platform</span>
          </div>
        </div>

        {!submitted ? (
          <>
            <div className={styles.iconContainer}>
              <Mail size={24} aria-hidden="true" />
            </div>

            <div className={styles.heading}>
              <h1>Forgot your password?</h1>
              <p>
                Enter the email address associated with your account and
                we&apos;ll help you reset your password.
              </p>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              {error && (
                <div className={styles.error} role="alert">
                  {error}
                </div>
              )}

              <div className={styles.field}>
                <label htmlFor="forgot-email">Email address</label>

                <div className={styles.inputWrapper}>
                  <Mail size={18} aria-hidden="true" />

                  <input
                    id="forgot-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className={styles.submit}
              >
                Send reset link
              </Button>
            </form>
          </>
        ) : (
          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <ShieldCheck size={28} aria-hidden="true" />
            </div>

            <div className={styles.heading}>
              <h1>Check your email</h1>
              <p>
                If an account exists for{" "}
                <strong>{email}</strong>, a password reset link will be sent
                to that address.
              </p>
            </div>

            <div className={styles.notice}>
              <Mail size={18} aria-hidden="true" />
              <span>
                Please check your inbox and spam folder. The reset link may
                expire after a limited period.
              </span>
            </div>

            <Link to="/login" className={styles.loginLink}>
              Return to sign in
            </Link>
          </div>
        )}

        <footer className={styles.footer}>
          <span>Smart Agriculture IoT Management Platform</span>
          <span>© 2026</span>
        </footer>
      </section>
    </main>
  );
}