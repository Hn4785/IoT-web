export const API_ENDPOINTS = {
  auth: {
    login: "/auth/login",
    logout: "/auth/logout",
    me: "/auth/me",
  },

  users: {
    base: "/users",
    byId: (id: string) => `/users/${id}`,
  },

  stations: {
    base: "/stations",
    byId: (id: string) => `/stations/${id}`,
  },

  sensors: {
    base: "/sensors",
    byId: (id: string) => `/sensors/${id}`,
  },

  alerts: {
    base: "/alerts",
    byId: (id: string) => `/alerts/${id}`,
  },
} as const;