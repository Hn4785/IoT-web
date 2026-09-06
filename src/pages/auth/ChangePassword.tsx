import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Button from "@/components/common/Button";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";
import { normalizeApiError } from "@/utils/apiError";
import { getDefaultRouteByRole } from "@/auth/defaultRoute";
import styles from "./ResetPassword.module.css";

export default function ChangePassword() {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 12 || newPassword.length > 128) {
      setError("New password must contain 12 to 128 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const user = await authService.changePassword({ currentPassword, newPassword });
      setUser(user);
      navigate(getDefaultRouteByRole(user.role), { replace: true });
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="change-password-title">
        <div className={styles.iconContainer}><LockKeyhole size={24} aria-hidden="true" /></div>
        <div className={styles.heading}>
          <h1 id="change-password-title">Change your password</h1>
          <p>Your temporary password must be replaced before you continue.</p>
        </div>
        <form className={styles.form} onSubmit={submit}>
          {error && <div className={styles.error} role="alert">{error}</div>}
          <label className={styles.field}>Current password<div className={styles.inputWrapper}><input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div></label>
          <label className={styles.field}>New password<div className={styles.inputWrapper}><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div></label>
          <label className={styles.field}>Confirm new password<div className={styles.inputWrapper}><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div></label>
          <Button type="submit" size="lg" disabled={submitting}>{submitting ? "Updating..." : "Update password"}</Button>
        </form>
      </section>
    </main>
  );
}
