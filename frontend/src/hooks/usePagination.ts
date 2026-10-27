import { useCallback, useMemo, useState } from "react";

interface UsePaginationOptions {
  totalItems: number;
  pageSize?: number;
  initialPage?: number;
}

interface UsePaginationReturn {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  offset: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  setPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  resetPage: () => void;
}

export function usePagination({
  totalItems,
  pageSize = 20,
  initialPage = 1,
}: UsePaginationOptions): UsePaginationReturn {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const safeInitialPage = Math.min(
    Math.max(initialPage, 1),
    totalPages,
  );

  const [currentPage, setCurrentPage] = useState(safeInitialPage);

  const setPage = useCallback(
    (page: number) => {
      const nextPage = Math.min(Math.max(page, 1), totalPages);

      setCurrentPage(nextPage);
    },
    [totalPages],
  );

  const nextPage = useCallback(() => {
    setCurrentPage((page) => Math.min(page + 1, totalPages));
  }, [totalPages]);

  const previousPage = useCallback(() => {
    setCurrentPage((page) => Math.max(page - 1, 1));
  }, []);

  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const offset = useMemo(
    () => (currentPage - 1) * pageSize,
    [currentPage, pageSize],
  );

  return {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    offset,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    setPage,
    nextPage,
    previousPage,
    resetPage,
  };
}

export default usePagination;