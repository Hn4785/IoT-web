import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import styles from "./ForgotPassword.module.css";

export default function ForgotPassword() {
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

        <div className={styles.successState}>
          <div className={styles.successIcon}>
            <ShieldCheck size={28} aria-hidden="true" />
          </div>

          <div className={styles.heading}>
            <h1>Recover your account</h1>
            <p>
              Email recovery is not enabled yet. Ask an administrator to issue
              a one-time temporary password for your account.
            </p>
          </div>

          <div className={styles.notice}>
            <KeyRound size={18} aria-hidden="true" />
            <span>
              After signing in with the temporary password, the system will
              require you to choose a new private password immediately.
            </span>
          </div>

          <Link to="/login" className={styles.loginLink}>
            Return to sign in
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
