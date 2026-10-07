import { HistoryIcon, StopIcon } from "../icons";

const ZERO_TIME = "0001-01-01T00:00:00Z";

/** Whether an om3 timestamp is set: present and not the zero time. */
export function hasTimestamp(value: string | undefined | null): value is string {
  return typeof value === "string" && value !== "" && value !== ZERO_TIME;
}

/**
 * Stopped instance: the stop square in muted ink, the stop date in the tooltip.
 * `label` names it for assistive technologies ("Instance on node n1 is stopped").
 */
export function StoppedMark({ stoppedAt, label = "Stopped" }: { stoppedAt?: string | null; label?: string }) {
  const title = hasTimestamp(stoppedAt) ? `stopped at ${new Date(stoppedAt).toLocaleString()}` : "stopped";
  return (
    <span role="img" aria-label={label} title={title} className="inline-flex cursor-help text-ink-muted">
      <StopIcon className="h-3.5 w-3.5" />
    </span>
  );
}

/**
 * RPO breached: the replica lags behind its recovery point objective. The history
 * clock, in the warn colour.
 */
export function RpoBreachedMark({ label = "RPO breached" }: { label?: string }) {
  return (
    <span role="img" aria-label={label} title="RPO breached" className="inline-flex text-state-warn">
      <HistoryIcon className="h-3.5 w-3.5" />
    </span>
  );
}
