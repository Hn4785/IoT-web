import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import {
  getDefaultRouteByRole,
  publicRoutes,
  protectedRoutes,
} from "./routeConfig";

export default function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* ========================================
          PUBLIC ROUTES
          ======================================== */}

      {publicRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={route.element}
        />
      ))}

      {/* ========================================
          ROOT ROUTE
          ======================================== */}

      <Route
        path="/"
        element={
          user ? (
            <Navigate
              to={getDefaultRouteByRole(user.role)}
              replace
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* ========================================
          PROTECTED ROUTES
          ======================================== */}

      <Route element={<ProtectedRoute />}>
        {protectedRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              route.roles ? (
                <RoleRoute allowedRoles={route.roles}>
                  {route.element}
                </RoleRoute>
              ) : (
                route.element
              )
            }
          />
        ))}
      </Route>

      {/* ========================================
          UNAUTHORIZED
          ======================================== */}

      <Route
        path="/unauthorized"
        element={
          <div>
            <h1>Access Denied</h1>
            <p>
              You do not have permission to access this page.
            </p>
          </div>
        }
      />

      {/* ========================================
          404
          ======================================== */}

      <Route
        path="*"
        element={
          <div>
            <h1>Page Not Found</h1>
            <p>
              The page you are looking for does not exist.
            </p>
          </div>
        }
      />
    </Routes>
  );
}