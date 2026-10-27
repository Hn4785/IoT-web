import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import styles from "./Pagination.module.css";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Max number of page-number slots shown before collapsing with "...". Defaults to 7. */
  maxVisiblePages?: number;
  /** Shows the "Showing X-Y of Z items" summary text. Defaults to true. */
  showSummary?: boolean;
  itemLabel?: string;
  className?: string;
}

type PageSlot = number | "ellipsis";

function getPageSlots(current: number, total: number, maxVisible: number): PageSlot[] {
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const siblingCount = Math.max(1, Math.floor((maxVisible - 5) / 2));
  const leftSibling = Math.max(current - siblingCount, 2);
  const rightSibling = Math.min(current + siblingCount, total - 1);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  const slots: PageSlot[] = [1];

  if (showLeftEllipsis) {
    slots.push("ellipsis");
  } else {
    for (let page = 2; page < leftSibling; page++) slots.push(page);
  }

  for (let page = leftSibling; page <= rightSibling; page++) slots.push(page);

  if (showRightEllipsis) {
    slots.push("ellipsis");
  } else {
    for (let page = rightSibling + 1; page < total; page++) slots.push(page);
  }

  slots.push(total);
  return slots;
}

/**
 * @example
 * <Pagination
 *   currentPage={page}
 *   totalItems={data.total}
 *   pageSize={20}
 *   onPageChange={setPage}
 * />
 */
export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  maxVisiblePages = 7,
  showSummary = true,
  itemLabel = "items",
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  if (totalPages <= 1 && !showSummary) return null;

  const slots = getPageSlots(currentPage, totalPages, maxVisiblePages);

  const goTo = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
  };

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      {showSummary && (
        <p className={styles.summary}>
          Showing <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> of{" "}
          <strong>{totalItems}</strong> {itemLabel}
        </p>
      )}

      {totalPages > 1 && (
        <nav className={styles.pages} aria-label="Pagination">
          <button
            type="button"
            className={styles.navButton}
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>

          {slots.map((slot, index) =>
            slot === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className={styles.ellipsis} aria-hidden="true">
                <MoreHorizontal size={16} />
              </span>
            ) : (
              <button
                key={slot}
                type="button"
                className={`${styles.pageButton} ${slot === currentPage ? styles.active : ""}`}
                onClick={() => goTo(slot)}
                aria-current={slot === currentPage ? "page" : undefined}
                aria-label={`Page ${slot}`}
              >
                {slot}
              </button>
            )
          )}

          <button
            type="button"
            className={styles.navButton}
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}

export default Pagination;