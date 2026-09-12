import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import type { DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { CalendarDays } from "lucide-react";
import { Button } from "./Button";
import styles from "./DateRangePicker.module.css";

export interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  /** Shows the quick preset list (Today, Last 7 days, ...). Defaults to true. */
  showPresets?: boolean;
  placeholder?: string;
  className?: string;
}

interface Preset {
  label: string;
  getRange: () => DateRange;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return startOfDay(d);
}

const PRESETS: Preset[] = [
  {
    label: "Today",
    getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }),
  },
  {
    label: "Last 7 days",
    getRange: () => ({ from: daysAgo(6), to: endOfDay(new Date()) }),
  },
  {
    label: "Last 30 days",
    getRange: () => ({ from: daysAgo(29), to: endOfDay(new Date()) }),
  },
  {
    label: "This month",
    getRange: () => {
      const now = new Date();
      return {
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: endOfDay(now),
      };
    },
  },
  {
    label: "Last month",
    getRange: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(from), to: endOfDay(to) };
    },
  },
];

const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function formatRange(range?: DateRange): string | null {
  if (!range?.from) return null;
  if (!range.to || range.to.getTime() === range.from.getTime()) {
    return formatter.format(range.from);
  }
  return `${formatter.format(range.from)} – ${formatter.format(range.to)}`;
}

function isSameRange(a?: DateRange, b?: DateRange): boolean {
  if (!a?.from || !b?.from) return false;
  return (
    startOfDay(a.from).getTime() === startOfDay(b.from).getTime() &&
    (a.to && b.to ? startOfDay(a.to).getTime() === startOfDay(b.to).getTime() : a.to === b.to)
  );
}

/**
 * @example
 * <DateRangePicker value={range} onChange={setRange} />
 */
export function DateRangePicker({
  value,
  onChange,
  showPresets = true,
  placeholder = "Select date range",
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setDraftRange(value);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, value]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setDraftRange(value);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, value]);

  const handlePresetClick = (preset: Preset) => {
    setDraftRange(preset.getRange());
  };

  const handleApply = () => {
    onChange(draftRange);
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraftRange(undefined);
    onChange(undefined);
    setIsOpen(false);
  };

  const displayLabel = formatRange(value);

  return (
    <div ref={wrapperRef} className={`${styles.wrapper} ${className ?? ""}`}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ""}`}
        onClick={() => {
          if (!isOpen) setDraftRange(value);
          setIsOpen((open) => !open);
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={styles.triggerIcon} aria-hidden="true">
          <CalendarDays size={16} />
        </span>
        <span className={displayLabel ? styles.triggerLabel : styles.triggerPlaceholder}>
          {displayLabel ?? placeholder}
        </span>
      </button>

      {isOpen && (
        <div className={styles.popover} role="dialog" aria-label="Select date range">
          {showPresets && (
            <div className={styles.presetList}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={`${styles.presetButton} ${
                    isSameRange(draftRange, preset.getRange()) ? styles.presetButtonActive : ""
                  }`}
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          <div>
            <div className={styles.calendarWrapper}>
              <DayPicker
                mode="range"
                selected={draftRange}
                onSelect={setDraftRange}
                numberOfMonths={2}
                defaultMonth={draftRange?.from ?? new Date()}
              />
            </div>
            <div className={styles.footer}>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                Clear
              </Button>
              <Button variant="primary" size="sm" onClick={handleApply} disabled={!draftRange?.from}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DateRangePicker;
