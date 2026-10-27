import { authStorage } from "../utils/authStorage.ts";

export type SessionInvalidationListener = () => void;
let sessionEpoch = 0;
let sessionEnding = false;
const listeners = new Set<SessionInvalidationListener>();

export interface SessionSnapshot {
  epoch: number;
  token: string | null;
}

export const getCurrentSessionSnapshot = (): SessionSnapshot => ({
  epoch: sessionEpoch,
  token: authStorage.getAccessToken(),
});

export const startSession = (): number => {
  sessionEnding = false;
  return ++sessionEpoch;
};

export const isSessionEnding = (): boolean => sessionEnding;

export function endSession(): number {
  sessionEnding = true;
  return ++sessionEpoch;
}

export function registerSessionInvalidator(listener: SessionInvalidationListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function invalidateSession(expectedSnapshot?: SessionSnapshot): boolean {
  if (expectedSnapshot && (expectedSnapshot.epoch !== sessionEpoch || expectedSnapshot.token !== authStorage.getAccessToken())) {
    return false;
  }
  sessionEpoch += 1;
  sessionEnding = false;
  authStorage.clearAccessToken();
  listeners.forEach((fn) => { try { fn(); } catch {} });
  return true;
}
