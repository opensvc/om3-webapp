import { useSyncExternalStore } from "react";
import type { PanelSide } from "../ui/components/panel-side";

/**
 * The edge of the window the side panels open against, as chosen in oc3: on the
 * right by default. Kept by the browser (oc3 keeps it with the account), the same
 * for every view and every tab.
 */

const STORAGE_KEY = "om3.panelSide";
const listeners = new Set<() => void>();

function read(): PanelSide {
  try {
    return localStorage.getItem(STORAGE_KEY) === "left" ? "left" : "right";
  } catch {
    return "right";
  }
}

let side: PanelSide = read();

export function setPanelSide(next: PanelSide): void {
  side = next;
  try {
    if (next === "left") localStorage.setItem(STORAGE_KEY, next);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not remembered: the choice holds until the page is reloaded.
  }
  listeners.forEach((listener) => {
    listener();
  });
}

/** The side chosen, and what changes it. */
export function usePanelSidePref(): { value: PanelSide; set: (next: PanelSide) => void } {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => side,
  );
  return { value, set: setPanelSide };
}
