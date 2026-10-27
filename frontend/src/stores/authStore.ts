import { create } from "zustand";

import { restoreAuthenticatedUser } from "../auth/restoreAuthenticatedUser.ts";
import { createSingleFlight } from "../api/refreshCoordinator.ts";
import type { User } from "../types/user.ts";
import { endSession, getCurrentSessionSnapshot, invalidateSession, isSessionEnding, registerSessionInvalidator, startSession } from "../auth/sessionInvalidation.ts";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (user: User) => void;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  restoreSession: () => Promise<void>;
}

let customAuthService: {
  refresh: () => Promise<unknown>;
  getCurrentUser: () => Promise<User>;
  clearSession: () => void;
  logout?: () => Promise<void>;
} | null = null;

export function setAuthServiceForTesting(service: typeof customAuthService) {
  customAuthService = service;
}

const restoreSessionOnce = createSingleFlight(async () => {
  const epoch = getCurrentSessionSnapshot().epoch;
  const service = customAuthService ?? (await import("../services/authService.ts")).authService;
  const user = await restoreAuthenticatedUser(service.refresh, service.getCurrentUser, () => {
    if (getCurrentSessionSnapshot().epoch === epoch) service.clearSession();
  });
  return { user, epoch };
});

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: (user) => {
    startSession();
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    // Fence restores immediately; retain the token only long enough to revoke it.
    endSession();
    const snapshot = getCurrentSessionSnapshot();
    // Do not navigate to login before the server has cleared its refresh cookie.
    set({ isLoading: true });
    try {
      const service = customAuthService ?? (await import("../services/authService.ts")).authService;
      if (getCurrentSessionSnapshot().epoch !== snapshot.epoch) return;
      await service.logout?.();
    } finally {
      if (getCurrentSessionSnapshot().epoch === snapshot.epoch) invalidateSession();
    }
  },

  setUser: (user) => {
    if (user !== null) startSession();
    set({ user, isAuthenticated: user !== null, isLoading: false });
  },

  restoreSession: async () => {
    if (isSessionEnding()) return;
    const { user, epoch } = await restoreSessionOnce();
    if (getCurrentSessionSnapshot().epoch !== epoch) return;
    if (user !== null) startSession();
    set({ user, isAuthenticated: user !== null, isLoading: false });
  },
}));

registerSessionInvalidator(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
});
