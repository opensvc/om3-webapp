import { cn } from "../cn";

/**
 * Loading mark: an accent arc turning on a line ring, with a text for screen
 * readers. The rotation stops under prefers-reduced-motion (global rule).
 */
export function Spinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("inline-flex items-center gap-2 text-ink-muted", className)}>
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
