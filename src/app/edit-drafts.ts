/*
 * The edits in progress of the configuration editors, kept while the page lives: a
 * tab of a panel left, or the panel closed, unmounts its editor, and the text typed
 * would go with it. Its editor mounted again, the edit is where it was left.
 */
import { useEffect, useRef, useState } from "react";

const drafts = new Map<string, unknown>();

/**
 * The state of an edit, `key` naming what it edits (an object and its section, a
 * node): null, no edit, nothing kept; else kept for the editor of the same key to
 * find it again. Saved or cancelled, set back to null, it is forgotten.
 */
export function useEditDraft<T>(key: string): [T | null, (next: T | null) => void] {
  const [value, setValue] = useState<T | null>(() => (drafts.get(key) as T | undefined) ?? null);
  // Another thing edited by the same editor: its own edit, if one was left.
  const shownKey = useRef(key);
  useEffect(() => {
    if (shownKey.current === key) return;
    shownKey.current = key;
    setValue((drafts.get(key) as T | undefined) ?? null);
  }, [key]);
  const set = (next: T | null) => {
    if (next === null) drafts.delete(key);
    else drafts.set(key, next);
    setValue(next);
  };
  return [value, set];
}

/** Forgets every edit kept: for the tests, and a sign-out. */
export function clearEditDrafts(): void {
  drafts.clear();
}
