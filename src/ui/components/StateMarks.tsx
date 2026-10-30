import { useTranslation } from "react-i18next";
import { cn } from "../cn";
import { HistoryIcon, PauseIcon } from "../icons";

const ZERO_TIME = "0001-01-01T00:00:00Z";

/** Whether an om3 timestamp is set: present and not the zero time. */
export function hasTimestamp(value: string | undefined | null): value is string {
  return typeof value === "string" && value !== "" && value !== ZERO_TIME;
}

/**
 * Stopped instance: the pause bars in muted ink. Not
 * the stop square: a gray square is a down instance that is no issue.
 * `label` names it for assistive technologies ("Instance on node n1 is stopped").
 */
export function StoppedMark({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <span role="img" aria-label={label ?? t("ui.stateMarks.stopped")} className="inline-flex text-ink-muted">
      <PauseIcon className="h-3.5 w-3.5" />
    </span>
  );
}

/**
 * RPO breached: the replica lags behind its recovery point objective. The history
 * clock, in the warn colour.
 */
export function RpoBreachedMark({ label }: { label?: string }) {
  const { t } = useTranslation();
  const text = t("ui.stateMarks.rpoBreached");
  return (
    <span role="img" aria-label={label ?? text} className="inline-flex text-state-warn">
      <HistoryIcon className="h-3.5 w-3.5" />
    </span>
  );
}

/**
 * Not provisioned: a "P" in a small red pill, as the status board flags an
 * unprovisioned resource, the same mark for an object, an instance or a resource.
 * `label` names it for assistive technologies. `decorative` hides it where the text beside it
 * already says it (a filter option).
 */
export function NotProvisionedMark({
  label,
  decorative = false,
  className,
}: {
  label?: string;
  decorative?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const text = label ?? t("ui.stateMarks.notProvisioned");
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : text}
      aria-hidden={decorative || undefined}
      data-mark="not-provisioned"
      className={cn(
        "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm border border-state-down px-0.5 text-[0.6875rem] leading-none font-medium text-state-down",
        className,
      )}
    >
      <span aria-hidden="true">P</span>
    </span>
  );
}
