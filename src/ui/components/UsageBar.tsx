import { cn } from "../cn";

export type UsageState = "up" | "warn" | "down";

const FILL: Record<UsageState, string> = {
  up: "bg-state-up",
  warn: "bg-state-warn",
  down: "bg-state-down",
};

/**
 * State of a usage percentage: warn above `warn`, down above `down` (50 and 80 by
 * default, as the om3 usage columns).
 */
export function usageState(percent: number, { warn = 50, down = 80 } = {}): UsageState {
  return percent > down ? "down" : percent > warn ? "warn" : "up";
}

/**
 * A percentage with a small bar beside it, not under it: the row keeps the height of
 * one line. The bar is a `progressbar` for assistive technologies, its fill in the
 * state colour (`state`, else from `usageState`). `showValue` writes the value
 * before the bar, rounded to `digits`.
 */
export function UsageBar({
  value,
  state,
  label,
  title,
  showValue = true,
  digits = 1,
  className,
}: {
  /** Percentage, 0 to 100; more is drawn full. */
  value: number;
  state?: UsageState;
  /** Accessible name of the bar. */
  label?: string;
  /** Tooltip of the whole, such as "used/size". */
  title?: string;
  showValue?: boolean;
  digits?: number;
  className?: string;
}) {
  const shown = Number(value.toFixed(digits));
  const tone = state ?? usageState(shown);
  return (
    <span className={cn("inline-flex items-center justify-end gap-2 whitespace-nowrap", className)} title={title}>
      {showValue && <span className="tabular-nums">{value.toFixed(digits)}%</span>}
      <span
        role="progressbar"
        aria-label={label}
        aria-valuenow={shown}
        aria-valuemin={0}
        aria-valuemax={100}
        data-state={tone}
        className="inline-block h-1 w-12 shrink-0 overflow-hidden rounded-full bg-surface-sunken"
      >
        <span
          className={cn("block h-full rounded-full", FILL[tone])}
          style={{ width: `${Math.min(Math.max(shown, 0), 100)}%` }}
        />
      </span>
    </span>
  );
}
