import { cn } from "../cn";
import type { ObjectState } from "./StatusBadge";

/** The glyphs and tints of `StatusBadge`: the shape tells the state without colour. */
const MARKS: Record<ObjectState, { ink: string; glyph: string; label: string }> = {
  up: { ink: "text-state-up", glyph: "●", label: "up" },
  warn: { ink: "text-state-warn", glyph: "▲", label: "warn" },
  down: { ink: "text-state-down", glyph: "■", label: "down" },
  unknown: { ink: "text-state-unknown", glyph: "○", label: "n/a" },
};

/**
 * The glyph of a state without its label, where the column or the row already says
 * what it is about: a status column, a count beside it. The label stays for screen
 * readers and as a tooltip; `label` replaces it when the value is more precise
 * ("running", "stale", "stdby up").
 */
export function StatusMark({
  state,
  label,
  className,
}: {
  state: ObjectState;
  label?: string;
  className?: string;
}) {
  const mark = MARKS[state];
  const text = label ?? mark.label;
  return (
    <span
      title={text}
      data-state={state}
      className={cn("inline-flex w-4 shrink-0 justify-center text-[0.75rem] leading-none", mark.ink, className)}
    >
      <span aria-hidden="true">{mark.glyph}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
