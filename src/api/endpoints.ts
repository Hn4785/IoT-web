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
    farmMembership: (userId: string, farmId: string) => `/admin/users/${userId}/farm-memberships/${farmId}`,
    stationGrant: (userId: string, stationId: string) => `/admin/users/${userId}/station-grants/${stationId}`,
  },

  auditEvents: "/admin/audit-events",

  dataSources: {
    base: "/data-sources",
    byId: (id: string) => `/data-sources/${id}`,
    grants: (id: string) => `/data-sources/${id}/grants`,
    grant: (id: string, userId: string) => `/data-sources/${id}/grants/${userId}`,
    reveal: (id: string) => `/data-sources/${id}/reveal`,
    test: (id: string) => `/data-sources/${id}/test`,
  },

  apiKeys: {
    base: "/developer/api-keys",
    availableStations: "/developer/api-keys/available-stations",
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
    acknowledgements: (id: string) => `/alerts/${id}/acknowledgements`,
    resolutions: (id: string) => `/alerts/${id}/resolutions`,
  },

  alertRules: {
    byStation: (stationId: string) => `/stations/${stationId}/alert-rules`,
    byId: (id: string) => `/alert-rules/${id}`,
  },

  notifications: {
    base: "/notifications",
    byId: (id: string) => `/notifications/${id}`,
  },

  deviceConfigurations: {
    capability: "/device-configurations/capability",
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
