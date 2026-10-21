import { useAnyPanelOpen } from "../ui/components/slide-over-open";
import { useShortcut } from "../ui/lib/shortcuts";
import { usePeek } from "./panel-search";
import { isPeekStep } from "./peek";
import { readLastRecord, useRecordHistory } from "./record-history";

/**
 * The "p" key, while no side panel is open: it brings back the record panel, on the
 * record shown last, or on the first of the history when that one is no longer
 * listed; with a record panel open, it closes it (`SlideOver`). Nothing on screen:
 * the records shown are proposed again by the search palette (`GlobalSearch`).
 */
export function PanelReopenKey() {
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

  return null;
}
