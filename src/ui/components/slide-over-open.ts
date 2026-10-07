import { useSyncExternalStore } from "react";

/**
 * How many side panels are open, for what must only show when none is: a panel may
 * be opened by the URL or by the local state of a view, and only the panels
 * themselves know it for sure.
 */

let count = 0;
const listeners = new Set<() => void>();

function change(by: number) {
  count += by;
  for (const listener of listeners) listener();
}

/** Called by a panel that opens; the function returned is called when it closes. */
export function panelOpened(): () => void {
  change(1);
  return () => {
    change(-1);
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether a side panel is open. */
export function useAnyPanelOpen(): boolean {
  return useSyncExternalStore(subscribe, () => count > 0);
}
