import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "@/routes/ProtectedRoute";
import RoleRoute from "@/routes/RoleRoute";
import MainLayout from "@/components/layout/MainLayout";

import {
  publicRoutes,
  protectedRoutes,
} from "@/routes/routeConfig";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =========================
            PUBLIC ROUTES
            Không sử dụng MainLayout
        ========================= */}
        {publicRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={route.element}
          />
        ))}

        {/* =========================
            PROTECTED ROUTES
        ========================= */}
        <Route element={<ProtectedRoute />}>
          {protectedRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <RoleRoute allowedRoles={route.roles ?? []}>
                  <MainLayout>
                    {route.element}
                  </MainLayout>
                </RoleRoute>
              }
            />
          ))}
        </Route>

        {/* =========================
            FALLBACK
        ========================= */}
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;