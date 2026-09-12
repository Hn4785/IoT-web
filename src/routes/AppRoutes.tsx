import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

import MainLayout from "@/components/layout/MainLayout";

import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";

import {
  publicRoutes,
  protectedRoutes,
} from "./routeConfig";
import { requiresPasswordChange } from "@/auth/passwordChange";
import { getDefaultRouteByRole } from "@/auth/defaultRoute";

export default function AppRoutes() {
  const { user } = useAuth();

  return (
    <Suspense fallback={<div role="status">Loading page…</div>}>
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
              to={requiresPasswordChange(user) ? "/change-password" : getDefaultRouteByRole(user.role)}
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
                  <MainLayout>
                    {route.element}
                  </MainLayout>
                </RoleRoute>
              ) : (
                <MainLayout>
                  {route.element}
                </MainLayout>
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
    </Suspense>
  );
}
