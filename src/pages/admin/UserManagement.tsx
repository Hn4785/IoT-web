import { useEffect, useMemo, useState } from "react";
import {
  Crown,
  Edit3,
  Copy,
  KeyRound,
  Plus,
  Shield,
  UserCheck,
  UserX,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/common/Button";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import Drawer from "@/components/common/Drawer";
import { ConfirmDialog } from "@/components/common/Modal";
import { Modal } from "@/components/common/Modal";
import type {
  User,
  UserRole,
  UserStatus,
} from "@/types/user";
import { userService } from "@/services/userService";
import { normalizeApiError } from "@/utils/apiError";
import { useAuth } from "@/hooks/useAuth";
import { authorityService } from "@/services/authorityService";
import { authService } from "@/services/authService";
import {
  canResetCredentials,
  canTransferSuperAdminTo,
  requiresSensitiveChangeConfirmation,
} from "./userManagementPolicy";

import styles from "./UserManagement.module.css";

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Admin",
  FARMER: "Farmer",
  CLIENT_DEVELOPER: "Client Developer",
};

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "Active",
  DISABLED: "Disabled",
  PENDING_PASSWORD_CHANGE: "Password change required",
};

type PendingSave = {
  displayName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

function formatDateTime(value?: string) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export default function UserManagement() {
  const { user: currentUser, setUser } = useAuth();
  const [items, setItems] = useState<User[]>([]);
  const [operationError, setOperationError] = useState("");
  const [temporaryCredential, setTemporaryCredential] = useState<{
    email: string;
    password: string;
    action: "created" | "reset";
  } | null>(null);
  const [credentialConfirmed, setCredentialConfirmed] = useState(false);
  const [credentialCopied, setCredentialCopied] = useState(false);

  const [query, setQuery] = useState("");
  const [role, setRole] = useState<UserRole | "all">("all");
  const [status, setStatus] = useState<UserStatus | "all">("all");

  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([undefined]);
  const [page, setPage] = useState(0);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("FARMER");
  const [selectedStatus, setSelectedStatus] = useState<UserStatus>("ACTIVE");
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [transferTarget, setTransferTarget] = useState<User | null>(null);
  const [transferPassword, setTransferPassword] = useState("");
  const [transferAcknowledged, setTransferAcknowledged] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const pageSize = 20;

  useEffect(() => {
    let active = true;
    userService.getUsers({ limit: pageSize, cursor: cursorHistory[page] }).then(
      (result) => { if (active) { setItems(result.items); setNextCursor(result.nextCursor ?? undefined); } },
      (error) => { if (active) setOperationError(normalizeApiError(error).message); },
    ).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cursorHistory, page]);

  const filteredUsers = useMemo(() => {
    return items.filter((user) => {
      const searchableText = `
        ${user.displayName}
        ${user.email}
        ${user.id}
      `.toLowerCase();

      const matchesSearch =
        !query ||
        searchableText.includes(query.toLowerCase());

      const matchesRole =
        role === "all" || user.role === role;

      const matchesStatus =
        status === "all" || user.status === status;

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });
  }, [items, query, role, status]);

  const visibleUsers = filteredUsers;

  const openCreate = () => {
    setEditingUser(null);
    setSelectedRole("FARMER");
    setSelectedStatus("ACTIVE");
    setDrawerOpen(true);
  };

  const openEdit = async (user: User) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setSelectedStatus(user.status);
    setDrawerOpen(true);
    setOperationError("");
    try {
      const detail = await userService.getUserById(user.id);
      setEditingUser(detail);
      setSelectedRole(detail.role);
      setSelectedStatus(detail.status);
    } catch (error) {
      setOperationError(normalizeApiError(error).message);
    }
  };

  const persistUser = async (input: PendingSave) => {
    setOperationError("");
    try {
      if (editingUser) {
        const updated = await userService.updateUser(editingUser.id, {
          displayName: input.displayName,
          role: input.role,
          status: input.status,
        });
        setItems((current) => current.map((user) => user.id === updated.id ? updated : user));
      } else {
        const created = await userService.createUser({
          email: input.email,
          displayName: input.displayName,
          role: input.role,
        });
        setItems((current) => [...current, created.user]);
        setTemporaryCredential({ email: created.user.email, password: created.temporaryPassword, action: "created" });
        setCredentialConfirmed(false);
        setCredentialCopied(false);
      }
      setDrawerOpen(false);
    } catch (error) {
      setOperationError(normalizeApiError(error).message);
    }
  };

  const saveUser = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: PendingSave = {
      displayName: String(form.get("displayName") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      role: selectedRole,
      status: selectedStatus,
    };

    if (editingUser && requiresSensitiveChangeConfirmation(editingUser, input)) {
      setPendingSave(input);
      return;
    }
    void persistUser(input);
  };

  const openTransfer = (target: User) => {
    setTransferTarget(target);
    setTransferPassword("");
    setTransferAcknowledged(false);
    setOperationError("");
  };

  const transferSuperAdmin = async () => {
    if (!transferTarget || !transferAcknowledged) return;
    setTransferring(true);
    setOperationError("");
    try {
      await authorityService.transfer(transferTarget.id, transferPassword);
      setTransferTarget(null);
      setDrawerOpen(false);
      authService.clearSession();
      setUser(null);
      window.location.assign("/login?authority-transferred=1");
    } catch (error) {
      setOperationError(normalizeApiError(error).message);
    } finally {
      setTransferring(false);
    }
  };

  const toggleUserStatus = async () => {
    if (!confirmUser) {
      return;
    }

    try {
      const updated = await userService.updateUser(confirmUser.id, {
        status: confirmUser.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
      });
      setItems((current) => current.map((user) => user.id === updated.id ? updated : user));
      setConfirmUser(null);
    } catch (error) {
      setOperationError(normalizeApiError(error).message);
    }
  };

  const resetPassword = async (user: User) => {
    setOperationError("");
    try {
      const result = await userService.resetPassword(user.id);
      setItems((current) => current.map((item) => item.id === result.user.id ? result.user : item));
      setTemporaryCredential({ email: result.user.email, password: result.temporaryPassword, action: "reset" });
      setCredentialConfirmed(false);
      setCredentialCopied(false);
    } catch (error) {
      setOperationError(normalizeApiError(error).message);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="User Management"
        description="Manage users, roles, accounts, and tenant authorization."
        actions={
          <Button
            icon={<Plus size={16} />}
            onClick={openCreate}
          >
            Create User
          </Button>
        }
      />

      {operationError && <div role="alert">{operationError}</div>}
      <section className={styles.stats}>
        <div>
          <span>Total Users</span>
          <strong>{items.length}</strong>
        </div>

        <div>
          <span>Active</span>
          <strong>
            {
              items.filter(
                (user) => user.status === "ACTIVE",
              ).length
            }
          </strong>
        </div>

        <div>
          <span>Disabled</span>
          <strong>
            {
              items.filter(
                (user) => user.status === "DISABLED",
              ).length
            }
          </strong>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <SearchInput
            value={query}
            onSearch={(value) => {
              setQuery(value);
              setPage(0);
            }}
            placeholder="Search users..."
          />

          <select
            value={role}
            onChange={(event) => {
              setRole(
                event.target.value as
                  | UserRole
                  | "all",
              );
              setPage(0);
            }}
          >
            <option value="all">
              All Roles
            </option>

            {Object.entries(roleLabels).map(
              ([key, label]) => (
                <option
                  key={key}
                  value={key}
                >
                  {label}
                </option>
              ),
            )}
          </select>

          <select
            value={status}
            onChange={(event) => {
              setStatus(
                event.target.value as
                  | UserStatus
                  | "all",
              );
              setPage(0);
            }}
          >
            <option value="all">
              All Statuses
            </option>

            {Object.entries(statusLabels).map(
              ([key, label]) => (
                <option
                  key={key}
                  value={key}
                >
                  {label}
                </option>
              ),
            )}
          </select>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Assigned Farms</th>
                <th>Assigned Stations</th>
                <th>Last Login</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody aria-busy={loading}>
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.avatar}>
                        {user.displayName
                          .split(" ")
                          .map((part) => part[0])
                          .slice(-2)
                          .join("")}
                      </span>

                      <div>
                        <strong>
                          {user.displayName}
                        </strong>

                        <small>
                          {user.id}
                        </small>
                      </div>
                    </div>
                  </td>

                  <td>{user.email}</td>

                  <td>
                    <span className={styles.role}>
                      {user.isSuperAdmin ? <Crown size={15} /> : <Shield size={15} />}
                      {user.isSuperAdmin ? "Super Admin" : roleLabels[user.role]}
                    </span>
                  </td>

                  <td>
                    <StatusBadge
                      status={
                        user.status === "ACTIVE"
                          ? "active"
                          : "disabled"
                      }
                      label={statusLabels[user.status]}
                    />
                  </td>

                  <td>
                    {user.assignedFarmIds.length}
                  </td>

                  <td>{user.assignedStationIds.length}</td>

                  <td>
                    {formatDateTime(user.lastLogin)}
                  </td>

                  <td>
                    {formatDateTime(user.createdAt)}
                  </td>

                  <td>
                    <div className={styles.actions}>
                      <Button
                        iconOnly
                        variant="ghost"
                        size="sm"
                        aria-label="Edit user"
                        onClick={() =>
                          openEdit(user)
                        }
                      >
                        <Edit3 size={18} />
                      </Button>

                      <Button
                        iconOnly
                        variant="ghost"
                        size="sm"
                        aria-label="Enable or disable user"
                        title={user.isSuperAdmin ? "Transfer Super Admin authority before changing this account" : "Enable or disable account"}
                        disabled={user.isSuperAdmin}
                        onClick={() =>
                          setConfirmUser(user)
                        }
                      >
                        {user.status === "ACTIVE" ? (
                          <UserX size={18} />
                        ) : (
                          <UserCheck size={18} />
                        )}
                      </Button>

                      <Button
                        iconOnly
                        variant="ghost"
                        size="sm"
                        aria-label={canResetCredentials(currentUser, user) ? "Reset credentials" : "Reset credentials unavailable"}
                        title={user.isSuperAdmin ? "Transfer Super Admin authority before resetting this account" : "Reset credentials"}
                        disabled={!canResetCredentials(currentUser, user)}
                        onClick={() => void resetPassword(user)}
                      >
                        <KeyRound size={18} />
                      </Button>

                      <Button
                        iconOnly
                        variant="ghost"
                        size="sm"
                        aria-label={user.isSuperAdmin ? "Current Super Admin" : `Make ${user.displayName} Super Admin`}
                        title={
                          user.isSuperAdmin
                            ? "Current Super Admin"
                            : canTransferSuperAdminTo(currentUser, user)
                              ? "Transfer Super Admin authority"
                              : "Account must be a different active Admin"
                        }
                        disabled={!canTransferSuperAdminTo(currentUser, user)}
                        className={styles.superAdminAction}
                        onClick={() => openTransfer(user)}
                      >
                        <Crown size={18} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.paginationControls}>
          <span>Page {page + 1}</span>
          <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => { setLoading(true); setPage((current) => current - 1); }}>Previous</Button>
          <Button variant="outline" size="sm" disabled={!nextCursor || loading} onClick={() => {
            if (!nextCursor) return;
            setLoading(true);
            setCursorHistory((current) => [...current.slice(0, page + 1), nextCursor]);
            setPage((current) => current + 1);
          }}>Next</Button>
        </div>
      </section>

      <Drawer
        isOpen={drawerOpen}
        onClose={() =>
          setDrawerOpen(false)
        }
        title={
          editingUser
            ? "Edit User"
            : "Create User"
        }
        description="Configure account information and resource authorization."
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() =>
                setDrawerOpen(false)
              }
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="user-form"
            >
              {editingUser
                ? "Save Changes"
                : "Create User"}
            </Button>
          </>
        }
      >
        <form
          id="user-form"
          className={styles.form}
          onSubmit={saveUser}
        >
          <label>
            Display name

            <input
              name="displayName"
              defaultValue={
                editingUser?.displayName
              }
              required
            />
          </label>

          <label>
            Email

            <input
              name="email"
              type="email"
              defaultValue={
                editingUser?.email
              }
              disabled={Boolean(editingUser)}
              required
            />
          </label>

          <div className={styles.formGrid}>
            <label>
              Role

              <select
                name="role"
                value={selectedRole}
                disabled={Boolean(editingUser?.isSuperAdmin)}
                onChange={(event) => {
                  const nextRole = event.target.value as UserRole;
                  if (editingUser && nextRole !== selectedRole) setPendingRole(nextRole);
                  else setSelectedRole(nextRole);
                }}
              >
                {Object.entries(
                  roleLabels,
                ).map(
                  ([key, label]) => (
                    <option
                      key={key}
                      value={key}
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Status

              <select
                name="status"
                value={selectedStatus}
                disabled={Boolean(editingUser?.isSuperAdmin)}
                onChange={(event) => setSelectedStatus(event.target.value as UserStatus)}
              >
                {Object.entries(
                  statusLabels,
                ).map(
                  ([key, label]) => (
                    <option
                      key={key}
                      value={key}
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          {editingUser && (
            <div className={styles.authBox} role="note">
              <strong>Current resource access</strong>
              <span>Farms: {editingUser.assignedFarmIds.join(", ") || "None"}</span>
              <span>Stations: {editingUser.assignedStationIds.join(", ") || "None"}</span>
              <small>Assignment editing needs a dedicated selector before it can be enabled safely.</small>
            </div>
          )}
        </form>
      </Drawer>

      <ConfirmDialog
        isOpen={Boolean(confirmUser)}
        onClose={() =>
          setConfirmUser(null)
        }
        onConfirm={toggleUserStatus}
        title={`${
          confirmUser?.status === "ACTIVE"
            ? "Disable"
            : "Enable"
        } account?`}
        description={`This will change the account status for ${
          confirmUser?.displayName ??
          "this user"
        }.`}
        confirmText={
          confirmUser?.status === "ACTIVE"
            ? "Disable"
            : "Enable"
        }
        variant={
          confirmUser?.status === "ACTIVE"
            ? "danger"
            : "primary"
        }
      />

      <ConfirmDialog
        isOpen={Boolean(pendingRole)}
        onClose={() => setPendingRole(null)}
        onConfirm={() => {
          if (pendingRole) setSelectedRole(pendingRole);
        }}
        title="Change account role?"
        description={`Changing this account to ${pendingRole ? roleLabels[pendingRole] : "another role"} can revoke sessions, API keys, and incompatible resource access. This is confirmation 1 of 2.`}
        confirmText="Use this role"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={Boolean(pendingSave)}
        onClose={() => setPendingSave(null)}
        onConfirm={async () => {
          if (pendingSave) await persistUser(pendingSave);
        }}
        title="Save sensitive account changes?"
        description="This is confirmation 2 of 2. Saving a role or status change immediately revokes active sessions and API keys for the affected account."
        confirmText="Save Changes"
        variant="danger"
      />

      <Modal
        isOpen={Boolean(transferTarget)}
        onClose={() => {
          if (!transferring) setTransferTarget(null);
        }}
        title="Transfer Super Admin authority?"
        description="This action leaves exactly one Super Admin and signs both accounts out."
        size="sm"
        closeOnEsc={!transferring}
        closeOnOverlayClick={!transferring}
        showCloseButton={!transferring}
        footer={
          <>
            <Button variant="outline" disabled={transferring} onClick={() => setTransferTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={transferring}
              disabled={!transferAcknowledged || transferPassword.length < 12}
              onClick={() => void transferSuperAdmin()}
            >
              Transfer and sign out
            </Button>
          </>
        }
      >
        <div className={styles.transferForm}>
          <div className={styles.transferWarning} role="alert">
            <Crown size={22} aria-hidden="true" />
            <span>
              <strong>{transferTarget?.displayName}</strong> will become the only Super Admin.
              Your current session will be revoked immediately.
            </span>
          </div>
          <label>
            Current Super Admin password
            <input
              type="password"
              value={transferPassword}
              minLength={12}
              maxLength={128}
              autoComplete="current-password"
              onChange={(event) => setTransferPassword(event.target.value)}
            />
          </label>
          <label className={styles.transferConfirmation}>
            <input
              type="checkbox"
              checked={transferAcknowledged}
              onChange={(event) => setTransferAcknowledged(event.target.checked)}
            />
            I understand that I will lose Super Admin authority and must sign in again.
          </label>
        </div>
      </Modal>

      {temporaryCredential && (
        <div className={styles.credentialOverlay}>
          <section className={styles.credentialModal} role="dialog" aria-modal="true" aria-labelledby="temporary-password-title">
            <div>
              <span className={styles.credentialEyebrow}>ONE-TIME CREDENTIAL</span>
              <h2 id="temporary-password-title">
                {temporaryCredential.action === "created" ? "Account created" : "Password reset complete"}
              </h2>
              <p>Give this temporary password to <strong>{temporaryCredential.email}</strong> through a private channel. It cannot be shown again.</p>
            </div>
            <div className={styles.credentialSecret}>
              <code>{temporaryCredential.password}</code>
              <Button variant="outline" size="sm" icon={<Copy size={15} />} onClick={async () => {
                try {
                  await navigator.clipboard.writeText(temporaryCredential.password);
                  setCredentialCopied(true);
                } catch {
                  setOperationError("Could not copy automatically. Select and copy the password manually.");
                }
              }}>{credentialCopied ? "Copied" : "Copy"}</Button>
            </div>
            <label className={styles.credentialConfirmation}>
              <input type="checkbox" checked={credentialConfirmed} onChange={(event) => setCredentialConfirmed(event.target.checked)} />
              I have securely saved this temporary password.
            </label>
            <div className={styles.credentialActions}>
              <Button disabled={!credentialConfirmed} onClick={() => setTemporaryCredential(null)}>Done</Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
