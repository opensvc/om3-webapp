/*
 * Whether the webapp may ask GitHub for its latest release: a request leaving the
 * cluster, the address of the user with it, so made only when the user opts in, from
 * the About page. Kept in the local storage of the browser; off by default. Turned
 * off, the release told before is forgotten too.
 */
import { useSyncExternalStore } from "react";

const KEY = "om3.releaseCheck";
const CACHED = ["appVersion", "appVersionTime"];
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

/** Whether the user opted in to the release check. */
export const releaseCheckEnabled = read;

/** Opts in or out; out, the release told before forgotten. */
export function setReleaseCheck(on: boolean): void {
  try {
    if (on) {
      localStorage.setItem(KEY, "on");
    } else {
      localStorage.removeItem(KEY);
      for (const key of CACHED) localStorage.removeItem(key);
    }
  } catch {
    // No storage: the check stays off.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The opt-in, kept in step with its changes, in this tab and the others. */
export function useReleaseCheck(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
