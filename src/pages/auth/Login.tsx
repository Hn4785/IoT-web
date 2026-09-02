import { useLocation, useNavigate } from "react-router-dom";

import {
  mockAdminUser,
  mockDeveloperUser,
  mockFarmOwnerUser,
} from "@/data/mockUsers";

import { useAuth } from "@/hooks/useAuth";

interface LocationState {
  from?: {
    pathname?: string;
  };
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const { login } = useAuth();

  const handleMockLogin = (
    userType: "admin" | "developer" | "farm_owner"
  ) => {
    let user;
    let defaultPath = "/";

    switch (userType) {
      case "admin":
        user = mockAdminUser;
        defaultPath = "/admin";
        break;

      case "developer":
        user = mockDeveloperUser;
        defaultPath = "/developer/dashboard";
        break;

      case "farm_owner":
        user = mockFarmOwnerUser;
        defaultPath = "/farm-owner/dashboard";
        break;
    }

    const loggedInUser = {
      ...user,
      lastLogin: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    login(loggedInUser);

    const state = location.state as LocationState | null;

    const redirectPath =
      state?.from?.pathname || defaultPath;

    navigate(redirectPath, {
      replace: true,
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f5f7fb",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          padding: "32px",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow:
            "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ marginBottom: "8px" }}>
          IoT Monitoring System
        </h1>

        <p
          style={{
            marginBottom: "32px",
            color: "#6b7280",
          }}
        >
          Development Mock Authentication
        </p>

        {/* ADMIN */}
        <button
          type="button"
          onClick={() => handleMockLogin("admin")}
          style={buttonStyle}
        >
          Login as Administrator
        </button>

        {/* FARM OWNER */}
        <button
          type="button"
          onClick={() => handleMockLogin("farm_owner")}
          style={buttonStyle}
        >
          Login as Farm Owner
        </button>

        {/* DEVELOPER */}
        <button
          type="button"
          onClick={() => handleMockLogin("developer")}
          style={buttonStyle}
        >
          Login as Client Developer
        </button>
      </div>
    </div>
  );
}

const buttonStyle = {
  width: "100%",
  padding: "14px",
  marginBottom: "12px",

  border: "none",
  borderRadius: "8px",

  cursor: "pointer",

  fontSize: "16px",
  fontWeight: 600,

  color: "#ffffff",

  background: "#2563eb",
};