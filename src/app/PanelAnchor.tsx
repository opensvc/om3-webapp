import { useTranslation } from "react-i18next";
import { useAnyPanelOpen } from "../ui/components/slide-over-open";
import { HistoryIcon } from "../ui/icons";
import { useShortcut } from "../ui/lib/shortcuts";
import { usePeek } from "./panel-search";
import { isPeekStep, stepLabel } from "./peek";
import { readLastRecord, useRecordHistory } from "./record-history";

/**
 * Anchor on the right edge of the window while no side panel is open, as in oc3: it
 * brings back the record panel and its history, on the record shown last, or on the
 * first of the history when that one is no longer listed. Nothing to reopen, no
 * anchor. The "p" key does the same from the keyboard; with a record panel open, it
 * closes it (`SlideOver`).
 */
export function PanelAnchor() {
  const { t } = useTranslation();
  const anyOpen = useAnyPanelOpen();
  const history = useRecordHistory();
  const peek = usePeek();
  const steps = history.entries.filter(isPeekStep);
  const last = readLastRecord();
  const target = steps.find((step) => step.kind === last?.kind && step.id === last.id) ?? steps[0];

  useShortcut("p", () => {
    if (anyOpen || target === undefined) return false;
    peek(target.kind, target.id);
    return true;
  });

  if (anyOpen || target === undefined) return null;
  const label = `${t("panelHistory.reopen", { name: stepLabel(target), count: steps.length })} (p)`;

  return (
    <button
      type="button"
      title={label}
      aria-keyshortcuts="p"
      onClick={() => {
        peek(target.kind, target.id);
      }}
      className="fixed top-14 right-0 z-10 flex items-center gap-1 rounded-l-(--radius-panel) border border-r-0 border-line bg-surface-raised py-1.5 pr-1.5 pl-2 text-ink-muted shadow-lg hover:text-ink"
    >
      <HistoryIcon className="h-4 w-4" />
      <span aria-hidden="true" className="text-data tabular-nums">
        {steps.length}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
