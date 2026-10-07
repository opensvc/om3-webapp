import type { ReactNode } from "react";
import { AlertTriangleIcon, CheckIcon } from "../icons";
import { cn } from "../cn";

const TONES = {
  error: { box: "border-state-down bg-state-down-soft text-state-down", Icon: AlertTriangleIcon },
  warning: { box: "border-state-warn bg-state-warn-soft text-state-warn", Icon: AlertTriangleIcon },
  success: { box: "border-state-up bg-state-up-soft text-state-up", Icon: CheckIcon },
  info: { box: "border-line bg-surface-sunken text-ink", Icon: null },
} as const;

/**
 * Message strip in a state colour, an icon doubling the colour. Errors and warnings
 * are announced at once (`role="alert"`), the others politely (`role="status"`).
 */
export function Alert({
  tone = "error",
  action,
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  /** A button at the end of the strip: Retry, Dismiss… */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const { box, Icon } = TONES[tone];
  return (
    <div
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-2 rounded-(--radius-control) border px-2 py-1.5",
        box,
        className,
      )}
    >
      {Icon !== null && <Icon className="shrink-0" />}
      <div className="min-w-0 flex-1 text-ink">{children}</div>
      {action}
    </div>
  );
}
