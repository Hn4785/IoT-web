export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId: string;
}

export function unwrapApiResponse<T>(response: ApiSuccessEnvelope<T>): T {
  return response.data;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
