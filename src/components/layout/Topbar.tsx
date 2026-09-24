import { useEffect, useRef, useState } from "react";
import {
  Search,
  Bell,
  LogOut,
  KeyRound,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { notifications as initialNotifications } from "@/data/notifications";

import Breadcrumb from "./Breadcrumb";
import NotificationDropdown from "../notifications/NotificationDropdown";

import styles from "./Topbar.module.css";

interface TopbarProps {
  notificationCount?: number;
  onSearch?: (query: string) => void;
}

export default function Topbar({
  onSearch,
}: TopbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const [notifications, setNotifications] = useState(
    initialNotifications,
  );

  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

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
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              read: true,
            }
          : notification,
      ),
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read: true,
      })),
    );
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
        <div className={styles.searchBox}>
          <Search
            size={16}
            className={styles.searchIcon}
          />

          <input
            type="text"
            className={styles.searchInput}
            aria-label="Global search"
            placeholder="Global search devices, stations..."
            onChange={(event) =>
              onSearch?.(event.target.value)
            }
          />
        </div>

        {/* Notification */}
        <div
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
              onMarkAsRead={handleMarkAsRead}
              onMarkAllAsRead={handleMarkAllAsRead}
            />
          )}
        </div>

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