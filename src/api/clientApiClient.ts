import axios from "axios";

import { env } from "@/config/env";

/**
 * HTTP client dành riêng cho Client Developer API.
 *
 * API này sử dụng:
 * - Base URL từ environment
 * - X-API-Key authentication
 *
 * Không dùng authStorage hoặc Bearer token của Web Dashboard.
 */
export const clientApiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeout,

  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Tạo Axios config có X-API-Key.
 *
 * API key được truyền rõ ràng từ service/request,
 * không lưu chung với access token của Web Dashboard.
 */
export function createClientApiConfig(apiKey: string) {
  return {
    headers: {
      "X-API-Key": apiKey,
    },
  };
}