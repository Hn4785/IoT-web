import { useCallback, useEffect, useState } from "react";

import type { User } from "@/types/user";

const AUTH_STORAGE_KEY = "fe_iot_auth_user";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface UseAuthReturn extends AuthState {
  login: (user: User) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
}

function readStoredUser(): User | null {
  try {
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);

    if (!storedUser) {
      return null;
    }

    return JSON.parse(storedUser) as User;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const storedUser = readStoredUser();

    setState({
      user: storedUser,
      isAuthenticated: storedUser !== null,
      isLoading: false,
    });
  }, []);

  const login = useCallback((user: User) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));

    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);

    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const setUser = useCallback((user: User | null) => {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }

    setState({
      user,
      isAuthenticated: user !== null,
      isLoading: false,
    });
  }, []);

  return {
    ...state,
    login,
    logout,
    setUser,
  };
}

export default useAuth;