import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute() {
  const {
    user,
    isLoading,
  } = useAuth();

  const location = useLocation();

  /**
   * Đang đọc User từ LocalStorage.
   */
  if (isLoading) {
    return null;
  }

  /**
   * Chưa đăng nhập.
   */
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
        }}
      />
    );
  }

  /**
   * Đã đăng nhập.
   */
  return <Outlet />;
}