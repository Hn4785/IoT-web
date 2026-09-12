import { useState } from "react";
import {
  Search,
  Bell,
  LogOut,
  KeyRound,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import Breadcrumb from "./Breadcrumb";

import styles from "./Topbar.module.css";

interface TopbarProps {
  notificationCount?: number;
  onSearch?: (query: string) => void;
}

export default function Topbar({
  notificationCount = 0,
  onSearch,
}: TopbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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
            placeholder="Global search devices, stations..."
            onChange={(event) =>
              onSearch?.(event.target.value)
            }
          />
        </div>

        <button
          type="button"
          className={styles.iconButton}
          aria-label="Notifications"
        >
          <Bell size={18} />

          {notificationCount > 0 && (
            <span className={styles.badge}>
              {notificationCount > 9
                ? "9+"
                : notificationCount}
            </span>
          )}
        </button>

        {user && (
          <div className={styles.userMenu}>
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
                <div className={styles.userDropdownHeader}>
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
                  className={
                    styles.dropdownItem
                  }
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

                  <span>
                    Log out
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}