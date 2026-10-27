import { API_ENDPOINTS } from "../api/endpoints.ts";

interface ScopeHttpClient {
  put(url: string): Promise<unknown>;
  delete(url: string): Promise<unknown>;
}

export function createUserScopeService(client: ScopeHttpClient) {
  async function write(url: string, assigned: boolean): Promise<void> {
    if (assigned) await client.put(url);
    else await client.delete(url);
  }

  return {
    setFarmMembership(userId: string, farmId: string, assigned: boolean) {
      return write(API_ENDPOINTS.users.farmMembership(userId, farmId), assigned);
    },
    setStationGrant(userId: string, stationId: string, assigned: boolean) {
      return write(API_ENDPOINTS.users.stationGrant(userId, stationId), assigned);
    },
  };
}

export const userScopeService = createUserScopeService({
  async put(url) {
    const { apiClient } = await import("../api/apiClient.ts");
    return apiClient.put(url);
  },
  async delete(url) {
    const { apiClient } = await import("../api/apiClient.ts");
    return apiClient.delete(url);
  },
});
