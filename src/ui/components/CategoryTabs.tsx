import { useRef, type KeyboardEvent, type ReactNode } from "react";

/** A category of a tab made of several lists, as its chip shows it. */
export interface CategoryTab<K extends string> {
  key: K;
  label: string;
  icon?: ReactNode;
  /** What follows the name: a count (`CategoryCount`), or a mark saying a state. */
  mark?: ReactNode;
  /** The state in words, said after the name to assistive technologies. */
  description?: string;
  /** "strong" for a category worth a look, "error" when it could not load. */
  tone?: "strong" | "muted" | "error";
}

const TONES = {
  strong: "border-line-strong font-medium text-ink",
  muted: "border-line text-ink-muted",
  error: "border-line text-state-down",
};

/** The count of a category, in the pill its chip carries. */
export function CategoryCount({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      className="rounded-full bg-surface-sunken px-1.5 text-data font-medium tabular-nums"
    >
      {count}
    </span>
  );
}

/**
 * A strip of chips choosing which category a tab shows, one at a time: each chip
 * carries the icon and name of its category, then a count or a mark. A tab list
 * for assistive technologies: the arrows, Home and End move the choice, and the
 * panel shown is `<idPrefix>-panel-<key>`, labelled by `<idPrefix>-tab-<key>`.
 * On one line: it scrolls sideways rather than wrap, should the chips outgrow it.
 */
export function CategoryTabs<K extends string>({
  label,
  idPrefix,
  tabs,
  active,
  onSelect,
}: {
  /** Accessible name of the strip. */
  label: string;
  idPrefix: string;
  tabs: CategoryTab<K>[];
  active: K;
  onSelect: (key: K) => void;
}) {
  const list = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.key === active);
    const target =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    const next = tabs[target];
    if (next === undefined) return;
    event.preventDefault();
    onSelect(next.key);
    list.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(`${idPrefix}-tab-${next.key}`)}`)
      ?.focus();
  }

  return (
    <div
      ref={list}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex gap-1.5 overflow-x-auto"
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            id={`${idPrefix}-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.key}`}
            aria-label={
              tab.description === undefined ? undefined : `${tab.label}, ${tab.description}`
            }
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onSelect(tab.key);
            }}
            className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 whitespace-nowrap ${
              selected
                ? "border-accent bg-accent-soft text-ink"
                : `bg-surface ${TONES[tab.tone ?? "muted"]} hover:bg-surface-sunken`
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.mark}
          </button>
        );
      })}
    </div>
  );
}
