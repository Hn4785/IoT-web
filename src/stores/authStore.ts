import { create } from "zustand";

import type { User } from "@/types/user";

const AUTH_STORAGE_KEY = "fe_iot_auth_user";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (user: User) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  restoreSession: () => void;
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: (user) => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify(user)
    );

    set({
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);

    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setUser: (user) => {
    if (user) {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify(user)
      );
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }

    set({
      user,
      isAuthenticated: user !== null,
      isLoading: false,
    });
  },

  restoreSession: () => {
    const storedUser = readStoredUser();

    set({
      user: storedUser,
      isAuthenticated: storedUser !== null,
      isLoading: false,
    });
  },
}));