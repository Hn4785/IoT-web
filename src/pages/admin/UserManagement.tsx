import { useMemo, useState } from "react";
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
import Pagination from "@/components/common/Pagination";

import { users as initialUsers } from "@/data/user";
import { farms } from "@/data/farms";
import { plots } from "@/data/plots";
import { stations } from "@/data/stations";

import type {
  Permission,
  User,
  UserRole,
  UserStatus,
} from "@/types/user";

import styles from "./UserManagement.module.css";

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  technician: "Technician",
  operator: "Operator",
  farm_owner: "Farm Owner",
  client_developer: "Client Developer",
};

const permissions: Permission[] = [
  "view",
  "edit",
  "configure",
  "manage_alerts",
  "export_data",
  "manage_devices",
];

export default function UserManagement() {
  const [items, setItems] = useState<User[]>(initialUsers);

  const [query, setQuery] = useState("");
  const [role, setRole] = useState<UserRole | "all">("all");
  const [status, setStatus] = useState<UserStatus | "all">("all");

  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);

  const pageSize = 7;

  const filteredUsers = useMemo(() => {
    return items.filter((user) => {
      const searchableText = `
        ${user.fullName}
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

  const visibleUsers = filteredUsers.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const openCreate = () => {
    setEditingUser(null);
    setDrawerOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setDrawerOpen(true);
  };

  const saveUser = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const fullName = String(
      form.get("fullName") ?? "",
    ).trim();

    const email = String(
      form.get("email") ?? "",
    ).trim();

    const phone = String(
      form.get("phone") ?? "",
    ).trim();

    const nextRole = String(
      form.get("role") ?? "operator",
    ) as UserRole;

    const nextStatus = String(
      form.get("status") ?? "active",
    ) as UserStatus;

    const now = new Date().toISOString();

    if (editingUser) {
      setItems((current) =>
        current.map((user) =>
          user.id === editingUser.id
            ? {
                ...user,
                fullName,
                email,
                phone,
                role: nextRole,
                status: nextStatus,
                updatedAt: now,
              }
            : user,
        ),
      );
    } else {
      const newUser: User = {
        id: `USR-${String(
          items.length + 1,
        ).padStart(3, "0")}`,

        fullName,
        email,
        phone,

        role: nextRole,
        status: nextStatus,

        assignedFarmIds: [],
        assignedPlotIds: [],
        assignedStationIds: [],

        createdAt: now,
        updatedAt: now,
      };

      setItems((current) => [
        ...current,
        newUser,
      ]);
    }

    setDrawerOpen(false);
  };

  const toggleUserStatus = () => {
    if (!confirmUser) {
      return;
    }

    setItems((current) =>
      current.map((user) =>
        user.id === confirmUser.id
          ? {
              ...user,
              status:
                user.status === "active"
                  ? "inactive"
                  : "active",
            }
          : user,
      ),
    );

    setConfirmUser(null);
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
                (user) => user.status === "active",
              ).length
            }
          </strong>
        </div>

        <div>
          <span>Inactive</span>
          <strong>
            {
              items.filter(
                (user) => user.status === "inactive",
              ).length
            }
          </strong>
        </div>

        <div>
          <span>Suspended</span>
          <strong>
            {
              items.filter(
                (user) =>
                  user.status === "suspended",
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
              setPage(1);
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
              setPage(1);
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
              setPage(1);
            }}
          >
            <option value="all">
              All Statuses
            </option>
            <option value="active">
              Active
            </option>
            <option value="inactive">
              Inactive
            </option>
            <option value="suspended">
              Suspended
            </option>
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

            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div
                      className={
                        styles.userCell
                      }
                    >
                      <span
                        className={
                          styles.avatar
                        }
                      >
                        {user.fullName
                          .split(" ")
                          .map(
                            (part) =>
                              part[0],
                          )
                          .slice(-2)
                          .join("")}
                      </span>

                      <div>
                        <strong>
                          {user.fullName}
                        </strong>

                        <small>
                          {user.id}
                        </small>
                      </div>
                    </div>
                  </td>

                  <td>{user.email}</td>

                  <td>
                    <span
                      className={
                        styles.role
                      }
                    >
                      <Shield size={13} />
                      {roleLabels[user.role]}
                    </span>
                  </td>

                  <td>
                    <StatusBadge
                      status={
                        user.status === "active"
                          ? "active"
                          : user.status ===
                              "inactive"
                            ? "inactive"
                            : "disabled"
                      }
                      label={user.status}
                    />
                  </td>

                  <td>
                    {
                      user.assignedFarmIds
                        .length
                    }
                  </td>

                  <td>
                    {
                      user.assignedPlotIds
                        .length
                    }
                  </td>

                  <td>
                    {user.lastLogin ??
                      "Never"}
                  </td>

                  <td>
                    {user.createdAt}
                  </td>

                  <td>
                    <div
                      className={
                        styles.actions
                      }
                    >
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
                          setConfirmUser(
                            user,
                          )
                        }
                      >
                        {user.status ===
                        "active" ? (
                          <UserX size={15} />
                        ) : (
                          <UserCheck
                            size={15}
                          />
                        )}
                      </Button>

                      <Button
                        iconOnly
                        variant="ghost"
                        size="sm"
                        aria-label="Reset credentials"
                      >
                        <KeyRound
                          size={15}
                        />
                      </Button>

                      <Button
                        iconOnly
                        variant="ghost"
                        size="sm"
                        aria-label="More actions"
                      >
                        <MoreHorizontal
                          size={15}
                        />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalItems={filteredUsers.length}
          pageSize={pageSize}
          onPageChange={setPage}
          itemLabel="users"
        />
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
            Full name

            <input
              name="fullName"
              defaultValue={
                editingUser?.fullName
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
              required
            />
          </label>

          <label>
            Phone

            <input
              name="phone"
              defaultValue={
                editingUser?.phone
              }
            />
          </label>

          <div
            className={
              styles.formGrid
            }
          >
            <label>
              Role

              <select
                name="role"
                defaultValue={
                  editingUser?.role ??
                  "operator"
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
                  "active"
                }
              >
                <option value="active">
                  Active
                </option>
                <option value="inactive">
                  Inactive
                </option>
                <option value="suspended">
                  Suspended
                </option>
              </select>
            </label>
          </div>

          <div
            className={
              styles.authBox
            }
          >
            <strong>
              Tenant Authorization
            </strong>

            <span>
              Farm → Plot → Station
            </span>

            <label>
              Farm

              <select
                multiple
                defaultValue={
                  editingUser?.assignedFarmIds ??
                  []
                }
              >
                {farms.map((farm) => (
                  <option
                    key={farm.id}
                    value={farm.id}
                  >
                    {farm.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Plot

              <select
                multiple
                defaultValue={
                  editingUser?.assignedPlotIds ??
                  []
                }
              >
                {plots.map((plot) => (
                  <option
                    key={plot.id}
                    value={plot.id}
                  >
                    {plot.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Station

              <select
                multiple
                defaultValue={
                  editingUser?.assignedStationIds ??
                  []
                }
              >
                {stations.map(
                  (station) => (
                    <option
                      key={station.id}
                      value={station.id}
                    >
                      {station.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <div
              className={
                styles.permissionGrid
              }
            >
              {permissions.map(
                (permission) => (
                  <label
                    key={permission}
                  >
                    <input
                      type="checkbox"
                      defaultChecked={
                        permission ===
                        "view"
                      }
                    />

                    {permission.replace(
                      "_",
                      " ",
                    )}
                  </label>
                ),
              )}
            </div>
          </div>
        </form>
      </Drawer>

      <ConfirmDialog
        isOpen={Boolean(
          confirmUser,
        )}
        onClose={() =>
          setConfirmUser(null)
        }
        onConfirm={
          toggleUserStatus
        }
        title={`${
          confirmUser?.status ===
          "active"
            ? "Disable"
            : "Enable"
        } account?`}
        description={`This will change the account status for ${
          confirmUser?.fullName ??
          "this user"
        }.`}
        confirmText={
          confirmUser?.status ===
          "active"
            ? "Disable"
            : "Enable"
        }
        variant={
          confirmUser?.status ===
          "active"
            ? "danger"
            : "primary"
        }
      />
    </div>
  );
}