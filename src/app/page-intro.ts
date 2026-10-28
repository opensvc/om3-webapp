import { useSyncExternalStore } from "react";

/*
 * The introduction of each page, a sentence or two under the header saying what the
 * page is about to someone who does not know OpenSVC (`pageIntro.<page>` in the
 * catalog). Hidden page by page on demand, for the browser; shown again all at once
 * from the Glossary page.
 */

/** The page an address shows, by its path and, for the objects, its list; null for none with an intro. */
export function introPage(pathname: string, search: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  switch (path) {
    case "/cluster":
    case "/heartbeats":
    case "/nodes":
    case "/namespaces":
    case "/pools":
    case "/stores":
    case "/resources":
      return path.slice(1);
    case "/network":
      return "networks";
    case "/kinds":
      return "objects-any";
    case "/objects": {
      const list = new URLSearchParams(search).get("list") || "services";
      return ["any", "services", "volumes", "configs", "secrets", "users"].includes(list) ? `objects-${list}` : null;
    }
    default:
      return null;
  }
}

const STORAGE_KEY = "om3-webapp.hiddenIntros";

const listeners = new Set<() => void>();

function readHidden(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

// The pages hidden, kept as one array while the storage says the same: a snapshot stable between reads.
let snapshot: string[] = readHidden();

function write(pages: string[]) {
  snapshot = pages;
  try {
    if (pages.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
  } catch {
    // Storage refused (a private window): hidden for this visit only.
  }
  listeners.forEach((listener) => listener());
}

/** Hides the intro of `page` for the browser. */
export const hideIntro = (page: string) => {
  if (!snapshot.includes(page)) write([...snapshot, page]);
};

/** Shows the intros of every page again. */
export const showAllIntros = () => write([]);

/** Read again from the storage: another tab, a test. */
export const reloadHiddenIntros = () => write(readHidden());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The pages whose intro is hidden, kept current. */
export const useHiddenIntros = () => useSyncExternalStore(subscribe, () => snapshot);
