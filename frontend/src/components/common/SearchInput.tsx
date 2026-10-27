import { useEffect, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import styles from "./SearchInput.module.css";

export type SearchInputSize = "sm" | "md" | "lg";

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> {
  /** Initial/external value. Use this to reset or pre-fill the field from the parent. */
  value?: string;
  /** Called with the trimmed input value after the debounce delay. */
  onSearch: (value: string) => void;
  /** Debounce delay in ms before `onSearch` fires. Defaults to 300. */
  debounceMs?: number;
  size?: SearchInputSize;
  placeholder?: string;
  className?: string;
}

/**
 * Debounced search field with a clear (X) button.
 *
 * @example
 * <SearchInput
 *   placeholder="Search stations..."
 *   onSearch={(term) => setQuery(term)}
 * />
 */
export function SearchInput({
  value,
  onSearch,
  debounceMs = 300,
  size = "md",
  placeholder = "Search...",
  className,
  disabled,
  ...rest
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(value ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep in sync if the parent resets `value` externally.
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(internalValue.trim());
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalValue, debounceMs]);

  const handleClear = () => {
    setInternalValue("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSearch("");
  };

  return (
    <div className={`${styles.wrapper} ${className ?? ""}`}>
      <span className={styles.searchIcon} aria-hidden="true">
        <Search size={16} />
      </span>
      <input
        {...rest}
        type="text"
        className={`${styles.input} ${styles[size]}`}
        placeholder={placeholder}
        value={internalValue}
        disabled={disabled}
        onChange={(e) => setInternalValue(e.target.value)}
        aria-label={rest["aria-label"] ?? placeholder}
      />
      {internalValue && !disabled && (
        <button
          type="button"
          className={styles.clearButton}
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default SearchInput;