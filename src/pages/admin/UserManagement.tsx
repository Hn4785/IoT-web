import { useEffect, useMemo, useState } from "react";
import {
  Edit3,
  KeyRound,
  MoreHorizontal,
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
import type {
  User,
  UserRole,
  UserStatus,
} from "@/types/user";
import { userService } from "@/services/userService";
import { normalizeApiError } from "@/utils/apiError";

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

export default function UserManagement() {
  const [items, setItems] = useState<User[]>([]);
  const [operationError, setOperationError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");

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
    setDrawerOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setDrawerOpen(true);
  };

  const saveUser = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const dName = String(
      form.get("displayName") ?? "",
    ).trim();

    const email = String(
      form.get("email") ?? "",
    ).trim();

    const nextRole = String(
      form.get("role") ?? "FARMER",
    ) as UserRole;

    const nextStatus = String(
      form.get("status") ?? "ACTIVE",
    ) as UserStatus;

    setOperationError("");
    try {
      if (editingUser) {
        const updated = await userService.updateUser(editingUser.id, {
          displayName: dName,
          role: nextRole,
          status: nextStatus,
        });
        setItems((current) => current.map((user) => user.id === updated.id ? updated : user));
      } else {
        const created = await userService.createUser({ email, displayName: dName, role: nextRole });
        setItems((current) => [...current, created.user]);
        setTemporaryPassword(created.temporaryPassword);
      }
      setDrawerOpen(false);
    } catch (error) {
      setOperationError(normalizeApiError(error).message);
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
      setTemporaryPassword(result.temporaryPassword);
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
      {temporaryPassword && (
        <div role="status">
          Temporary password (shown once): <code>{temporaryPassword}</code>{" "}
          <Button size="sm" variant="ghost" onClick={() => setTemporaryPassword("")}>Dismiss</Button>
        </div>
      )}

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
                <th>Assigned Plots</th>
                <th>Last Login</th>
                <th>Created At</th>
                <th />
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
                      <Shield size={13} />
                      {roleLabels[user.role]}
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

                  <td>
                    {user.assignedPlotIds.length}
                  </td>

                  <td>
                    {user.lastLogin ?? "Never"}
                  </td>

                  <td>
                    {user.createdAt}
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
                        <Edit3 size={15} />
                      </Button>

                      <Button
                        iconOnly
                        variant="ghost"
                        size="sm"
                        aria-label="Enable or disable user"
                        onClick={() =>
                          setConfirmUser(user)
                        }
                      >
                        {user.status === "ACTIVE" ? (
                          <UserX size={15} />
                        ) : (
                          <UserCheck size={15} />
                        )}
                      </Button>

                      <Button
                        iconOnly
                        variant="ghost"
                        size="sm"
                        aria-label="Reset credentials"
                        onClick={() => void resetPassword(user)}
                      >
                        <KeyRound size={15} />
                      </Button>

                      <Button
                        iconOnly
                        variant="ghost"
                        size="sm"
                        aria-label="More actions"
                      >
                        <MoreHorizontal size={15} />
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
                defaultValue={
                  editingUser?.role ??
                  "FARMER"
                }
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
                defaultValue={
                  editingUser?.status ??
                  "ACTIVE"
                }
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

          <div className={styles.authBox} role="note">
            Farm and station access cannot be edited here until the backend exposes each user's current assignments.
          </div>
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
    </div>
  );
}
