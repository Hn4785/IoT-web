let accessToken: string | null = null;

export const authStorage = {
  getAccessToken(): string | null {
    return accessToken;
  },

  setAccessToken(token: string): void {
    accessToken = token;
  },

  clearAccessToken(): void {
    accessToken = null;
  },
};
