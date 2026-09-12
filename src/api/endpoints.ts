export const API_ENDPOINTS = {
  /*
   * ========================================
   * WEB DASHBOARD API
   * ========================================
   *
   * Các endpoint này đang là frontend contract/placeholder
   * và sẽ được cập nhật khi Backend Dashboard cung cấp API chính thức.
   */

  auth: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
    me: "/auth/me",
    changePassword: "/auth/change-password",
  },

  users: {
    base: "/admin/users",
    byId: (id: string) => `/admin/users/${id}`,
    resetPassword: (id: string) => `/admin/users/${id}/reset-password`,
  },

  apiKeys: {
    base: "/developer/api-keys",
    rotate: (id: string) => `/developer/api-keys/${id}/rotate`,
    revoke: (id: string) => `/developer/api-keys/${id}/revoke`,
  },

  stations: {
    base: "/stations",
    byId: (id: string) => `/stations/${id}`,
    byPlot: (plotId: string) => `/plots/${plotId}/stations`,
    latest: (id: string) => `/stations/${id}/data/latest`,
    history: (id: string) => `/stations/${id}/data/history`,
  },

  superAdmin: {
    transfer: "/admin/super-admin/transfer",
  },

  farms: {
    base: "/farms",
    plots: (farmId: string) => `/farms/${farmId}/plots`,
  },

  sensors: {
    base: "/sensors",
    byId: (id: string) => `/sensors/${id}`,
  },

  alerts: {
    base: "/alerts",
    byId: (id: string) => `/alerts/${id}`,
  },

  /*
   * ========================================
   * CLIENT DEVELOPER API
   * ========================================
   *
   * Các endpoint dưới đây được xác nhận trong SRS.
   *
   * Authentication:
   * X-API-Key
   */

  clientApi: {
    health: "/health",

    stations: "/client/stations",

    data: {
      latest: "/client/data/latest",
      history: "/client/data/history",
    },
  },
} as const;
