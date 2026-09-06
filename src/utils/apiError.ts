import axios from "axios";

import type { ApiError } from "@/types/api";

export function normalizeApiError(
  error: unknown
): ApiError {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;

    if (
      responseData &&
      typeof responseData === "object"
    ) {
      const data = responseData as Record<string, unknown>;

      return {
        message:
          typeof data.message === "string"
            ? data.message
            : error.message || "Request failed",

        status: error.response?.status,

        code:
          typeof data.code === "string"
            ? data.code
            : undefined,

        details: data,
      };
    }

    return {
      message:
        error.message || "Network request failed",

      status: error.response?.status,

      details: responseData,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  return {
    message: "An unexpected error occurred",
  };
}