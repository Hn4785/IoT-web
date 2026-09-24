const viteEnv = import.meta.env ?? {};

const apiBaseUrl =
  viteEnv.VITE_API_BASE_URL || "/api/v1";

const apiTimeout = Number(
  viteEnv.VITE_API_TIMEOUT || 10000
);

export const env = {
  apiBaseUrl,
  apiTimeout,
} as const;
