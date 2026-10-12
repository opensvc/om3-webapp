import { useEffect, useState } from "react";
import type { ObjectKind } from "../ui/components/ObjectIcon";
import { isPeekStep, serialiseStep, stepIcon, stepLabel, type PeekKind, type PeekStep } from "./peek";
import { usePeek } from "./panel-search";
import { useRecordHistory } from "./record-history";

/** The key of the record a panel shows, as the history names it; empty without an id. */
export function recordKey(kind: string, recordId: string | undefined): string {
  return recordId === undefined || recordId === "" ? "" : serialiseStep({ kind, id: recordId });
}

/**
 * The sections of the history, by how long ago a record was shown, and the age each
 * ends at. A record older than the last one is no longer in the history.
 */
const SECTIONS = [
  ["now", 5 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
] as const;

export type HistorySection = (typeof SECTIONS)[number][0];

export function sectionOf(age: number): HistorySection {
  return SECTIONS.find(([, limit]) => age < limit)?.[0] ?? "week";
}

/** How often the sections are worked out again while the history is on screen. */
const TICK_MS = 30 * 1000;

/** The time it is, refreshed every `TICK_MS`: records age from a section to the next. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  return now;
}

/**
 * The record last picked in the history itself. The panel title, which records
 * every record shown, leaves that one where it stands (`openedFromHistory`): the
 * list must not move under the pointer of who is going through it.
 */
let picked: { key: string; at: number } | null = null;

/** Long enough for the panel to mount and record, too short for another gesture. */
const PICK_MS = 2000;

export function openedFromHistory(key: string): boolean {
  return picked !== null && picked.key === key && performance.now() - picked.at < PICK_MS;
}

/** An entry of the history, as the side panel and the menu show it. */
export interface HistoryEntry {
  key: string;
  step: PeekStep & { kind: PeekKind };
  icon: ObjectKind;
  label: string;
  /** The record the panel displays. */
  current: boolean;
  section: HistorySection;
}

/**
 * The panel history, ready to be shown: the records displayed in this browser tab
 * during the last week, the most recently shown first, grouped by how long ago they
 * were shown — only the groups that hold a record — and what opens one, removes one
 * or clears them all. Opening one from here leaves it where it stands.
 */
export function usePanelHistory(currentKey: string) {
  const history = useRecordHistory();
  const peek = usePeek();
  const now = useNow();
  const entries: HistoryEntry[] = history.entries.flatMap((record) => {
    const step = { kind: record.kind, id: record.id };
    if (!isPeekStep(step)) return [];
    const key = serialiseStep(step);
    return [
      {
        key,
        step,
        icon: stepIcon(step),
        label: stepLabel(step),
        current: key === currentKey,
        // A clock set back would give a negative age: such a record is of now.
        section: sectionOf(Math.max(0, now - record.at)),
      },
    ];
  });
  const sections = SECTIONS.map(([key]) => ({
    key,
    entries: entries.filter((entry) => entry.section === key),
  })).filter((section) => section.entries.length > 0);
  return {
    entries,
    sections,
    open: (entry: HistoryEntry) => {
      picked = { key: entry.key, at: performance.now() };
      peek(entry.step.kind, entry.step.id);
    },
    remove: (entry: HistoryEntry) => {
      history.remove(entry.step.kind, entry.step.id);
    },
    clear: history.clear,
  };
}
