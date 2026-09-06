export async function restoreAuthenticatedUser<T>(
  refresh: () => Promise<unknown>,
  loadCurrentUser: () => Promise<T>,
  clearSession: () => void,
): Promise<T | null> {
  try {
    await refresh();
    return await loadCurrentUser();
  } catch {
    clearSession();
    return null;
  }
}
