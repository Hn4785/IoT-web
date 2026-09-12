import { create } from "zustand";

import { restoreAuthenticatedUser } from "@/auth/restoreAuthenticatedUser";
import { createSingleFlight } from "@/api/refreshCoordinator";
import { authService } from "@/services/authService";
import type { User } from "@/types/user";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (user: User) => void;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  restoreSession: () => Promise<void>;
}

const restoreSessionOnce = createSingleFlight(() =>
  restoreAuthenticatedUser(
    authService.refresh,
    authService.getCurrentUser,
    authService.clearSession,
  ),
);

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: (user) => {
    set({
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    try {
      await authService.logout();
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user) => {
    set({
      user,
      isAuthenticated: user !== null,
      isLoading: false,
    });
  },

  restoreSession: async () => {
    const user = await restoreSessionOnce();
    set({
      user,
      isAuthenticated: user !== null,
      isLoading: false,
    });
  },
}));
