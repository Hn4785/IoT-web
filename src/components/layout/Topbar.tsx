import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  LogOut,
  KeyRound,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { notificationService } from "@/services/notificationService";
import type { NotificationDto } from "@/types/notification";
import { normalizeApiError } from "@/utils/apiError";

import Breadcrumb from "./Breadcrumb";
import NotificationDropdown from "../notifications/NotificationDropdown";
import StationSearch from "./StationSearch.tsx";

import styles from "./Topbar.module.css";

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRequest = useRef(0);

  const canViewNotifications = user?.role === "ADMIN" || user?.role === "FARMER";

  const loadNotifications = useCallback(async () => {
    const request = ++notificationRequest.current;
    if (!canViewNotifications || !user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setNotificationLoading(true);
    setNotificationError("");
    try {
      const page = await notificationService.list({ limit: 20 });
      if (request !== notificationRequest.current) return;
      setNotifications(page.items);
      setUnreadCount(page.unreadCount);
    } catch (reason) {
      if (request !== notificationRequest.current) return;
      setNotifications([]);
      setUnreadCount(0);
      setNotificationError(normalizeApiError(reason).message);
    } finally {
      if (request === notificationRequest.current) setNotificationLoading(false);
    }
  }, [canViewNotifications, user?.id]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadNotifications();
    });
    return () => {
      active = false;
      notificationRequest.current += 1;
    };
  }, [loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        notificationRef.current &&
        !notificationRef.current.contains(target)
      ) {
        setIsNotificationOpen(false);
      }

      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(target)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

  const handleNotificationToggle = () => {
    setIsNotificationOpen((current) => !current);
    setIsUserMenuOpen(false);
    if (!isNotificationOpen) void loadNotifications();
  };

  const handleMarkAsRead = async (id: string) => {
    setUpdatingId(id);
    setNotificationError("");
    try {
      const updated = await notificationService.setRead(id, true);
      setNotifications((current) => current.map((item) => item.id === id ? updated : item));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (reason) {
      setNotificationError(normalizeApiError(reason).message);
    } finally {
      setUpdatingId("");
    }
  };

  const handleLogout = async () => {
    setIsUserMenuOpen(false);

    await logout();

    navigate("/login", {
      replace: true,
    });
  };

  const handleChangePassword = () => {
    setIsUserMenuOpen(false);

    navigate("/change-password");
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <Breadcrumb />
      </div>

      <div className={styles.right}>
        {canViewNotifications && user && <StationSearch role={user.role} />}

        {canViewNotifications && <div
          ref={notificationRef}
          className={styles.notificationMenu}
        >
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Notifications${
              unreadCount > 0
                ? `, ${unreadCount} unread`
                : ""
            }`}
            aria-expanded={isNotificationOpen}
            onClick={handleNotificationToggle}
          >
            <Bell size={18} />

            {unreadCount > 0 && (
              <span className={styles.badge}>
                {unreadCount > 9
                  ? "9+"
                  : unreadCount}
              </span>
            )}
          </button>

          {isNotificationOpen && (
            <NotificationDropdown
              notifications={notifications}
              unreadCount={unreadCount}
              loading={notificationLoading}
              error={notificationError}
              updatingId={updatingId}
              onMarkAsRead={(id) => { void handleMarkAsRead(id); }}
              onRetry={() => { void loadNotifications(); }}
              onViewAll={user?.role === "FARMER" ? () => {
                setIsNotificationOpen(false);
                navigate("/farm-owner/notifications");
              } : undefined}
            />
          )}
        </div>}

        {/* User menu */}
        {user && (
          <div
            ref={userMenuRef}
            className={styles.userMenu}
          >
            <button
              type="button"
              className={styles.avatarButton}
              aria-label="User menu"
              aria-expanded={isUserMenuOpen}
              onClick={() =>
                setIsUserMenuOpen(
                  (current) => !current,
                )
              }
            >
              <span className={styles.avatarFallback}>
                {user.displayName
                  .charAt(0)
                  .toUpperCase()}
              </span>

              <ChevronDown
                size={12}
                className={
                  isUserMenuOpen
                    ? styles.chevronOpen
                    : ""
                }
              />
            </button>

            {isUserMenuOpen && (
              <div
                className={styles.userDropdown}
                role="menu"
              >
                <div
                  className={
                    styles.userDropdownHeader
                  }
                >
                  <div
                    className={
                      styles.dropdownAvatar
                    }
                  >
                    {user.displayName
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div
                    className={
                      styles.dropdownUserInfo
                    }
                  >
                    <strong>
                      {user.displayName}
                    </strong>

                    <span>
                      {user.email}
                    </span>
                  </div>
                </div>

                <div
                  className={
                    styles.dropdownDivider
                  }
                />

                <button
                  type="button"
                  className={styles.dropdownItem}
                  role="menuitem"
                  onClick={
                    handleChangePassword
                  }
                >
                  <KeyRound
                    size={15}
                    aria-hidden="true"
                  />

                  <span>
                    Change Password
                  </span>
                </button>

                <button
                  type="button"
                  className={`${styles.dropdownItem} ${styles.logoutItem}`}
                  role="menuitem"
                  onClick={handleLogout}
                >
                  <LogOut
                    size={15}
                    aria-hidden="true"
                  />

                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
