import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CloseIcon, HistoryIcon, TrashIcon } from "../ui/icons";
import { ObjectIcon } from "../ui/components/ObjectIcon";
import { usePanelHistory, type HistoryEntry } from "./panel-history";

const RAIL_BUTTON =
  "flex h-7 items-center justify-center rounded-(--radius-control) text-ink-muted hover:bg-surface-raised hover:text-ink";

/** As tall as the header of the panel it stands against, so that the two lines meet. */
const RAIL_HEADER = "flex h-11 shrink-0 items-center gap-1 border-b border-line pr-1 pl-2";

/**
 * The panel history as the right zone of a record panel (`rail` of `SlideOver`), after
 * oc3: one pill per record shown during the last week, with the icon of its kind and
 * its name, grouped by how long ago it was shown, the most recent first. The record
 * on display is highlighted where it stands, and scrolled into view.
 *
 * Clicking a pill shows its record and leaves it where it stands. The cross at the
 * right end of a pill, shown when the entry is hovered or focused, removes it; the
 * bin in the header clears them all. Nothing is rendered while the history is empty.
 */
export function PanelHistoryRail({ currentKey }: { currentKey: string }) {
  const { t } = useTranslation();
  const history = usePanelHistory(currentKey);
  const list = useRef<HTMLDivElement>(null);
  const signature = history.entries.map((entry) => entry.key).join(",");

  // The record on display stays in sight, however far down the list it stands.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>("[aria-current]")?.scrollIntoView?.({ block: "nearest" });
  }, [currentKey, signature]);

  if (history.entries.length === 0) return null;

  return (
    <nav
      aria-label={t("panelHistory.label")}
      // Sunken, against the raised record zone: two zones of one panel.
      className="flex h-full w-44 flex-col border-l border-line-strong bg-surface-sunken"
    >
      <div className={RAIL_HEADER}>
        <HistoryIcon className="h-4 w-4 shrink-0 text-ink-muted" />
        <span className="min-w-0 flex-1 truncate text-ink-muted">{t("panelHistory.title")}</span>
        <button
          type="button"
          title={t("panelHistory.clear")}
          onClick={history.clear}
          className={`${RAIL_BUTTON} w-7 shrink-0`}
        >
          <TrashIcon className="h-3.5 w-3.5" />
          <span className="sr-only">{t("panelHistory.clear")}</span>
        </button>
      </div>
      <div ref={list} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {history.sections.map((section) => (
          <section key={section.key} aria-labelledby={`history-${section.key}`}>
            <h3
              id={`history-${section.key}`}
              className="mb-1 text-[0.6875rem] font-medium tracking-wide text-ink-muted uppercase"
            >
              {t(`panelHistory.sections.${section.key}`)}
            </h3>
            <ol className="flex flex-col gap-1">
              {section.entries.map((entry) => (
                <li
                  key={entry.key}
                  // The pill: the record on the left, the cross that removes it on the right.
                  className={`group flex items-center rounded-full border text-data ${
                    entry.current
                      ? "border-accent bg-accent-soft font-medium text-ink"
                      : "border-line bg-surface-raised hover:border-line-strong hover:bg-surface"
                  }`}
                >
                  <EntryButton
                    entry={entry}
                    onOpen={() => {
                      history.open(entry);
                    }}
                    iconClassName="h-3.5 w-3.5 shrink-0"
                    className="flex min-w-0 flex-1 items-center gap-1 rounded-l-full py-0.5 pl-1.5 text-left"
                  />
                  <button
                    type="button"
                    title={t("panelHistory.remove", { name: entry.label })}
                    onClick={() => {
                      history.remove(entry);
                    }}
                    // Invisible at rest but present and focusable, for the keyboard.
                    className="mr-0.5 shrink-0 rounded-full p-0.5 text-ink-muted opacity-0 group-hover:opacity-100 hover:bg-surface-raised hover:text-ink focus-visible:opacity-100"
                  >
                    <CloseIcon className="h-3 w-3" />
                    <span className="sr-only">{t("panelHistory.remove", { name: entry.label })}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </nav>
  );
}

/**
 * The panel history as a button of the header opening a list, where the window
 * leaves no room for the rail beside the panel. Same entries and same actions.
 */
export function PanelHistoryMenu({ currentKey }: { currentKey: string }) {
  const { t } = useTranslation();
  const history = usePanelHistory(currentKey);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && root.current?.contains(event.target) === false)
        setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  if (history.entries.length === 0) return null;
  const label = t("panelHistory.menu", { count: history.entries.length });

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(event) => {
        // The panel listens for Escape at the document level: without this, closing
        // the list would close the panel too.
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        title={label}
        onClick={() => {
          setOpen((previous) => !previous);
        }}
        className="flex h-7 items-center gap-1 rounded-(--radius-control) border border-line px-1.5 text-ink-muted hover:text-ink"
      >
        <HistoryIcon className="h-4 w-4" />
        <span aria-hidden="true" className="text-data tabular-nums">
          {history.entries.length}
        </span>
        <span className="sr-only">{label}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-(--radius-panel) border border-line bg-surface-raised p-1 shadow-lg">
          <ol className="flex flex-col">
            {history.entries.map((entry) => (
              <li key={entry.key} className="flex items-center gap-1">
                <EntryButton
                  entry={entry}
                  onOpen={() => {
                    setOpen(false);
                    history.open(entry);
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-(--radius-control) px-2 py-1 text-left ${
                    entry.current ? "bg-accent-soft font-medium" : "hover:bg-surface-sunken"
                  }`}
                />
                <button
                  type="button"
                  title={t("panelHistory.remove", { name: entry.label })}
                  onClick={() => {
                    history.remove(entry);
                  }}
                  className="shrink-0 rounded-full p-1 text-ink-muted hover:text-ink"
                >
                  <CloseIcon className="h-3 w-3" />
                  <span className="sr-only">{t("panelHistory.remove", { name: entry.label })}</span>
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              history.clear();
            }}
            className="mt-1 flex w-full items-center gap-2 border-t border-line px-2 py-1 text-ink-muted hover:text-ink"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            {t("panelHistory.clear")}
          </button>
        </div>
      )}
    </div>
  );
}

/** An entry: the icon of its kind and its name; the one on display is not a link. */
function EntryButton({
  entry,
  onOpen,
  className,
  iconClassName = "h-4 w-4",
}: {
  entry: HistoryEntry;
  onOpen: () => void;
  className: string;
  iconClassName?: string;
}) {
  const { t } = useTranslation();
  const content = (
    <>
      <ObjectIcon kind={entry.icon} className={iconClassName} />
      <span className="w-full min-w-0 truncate">{entry.label}</span>
    </>
  );
  // The record on display: said so, and nothing to open.
  if (entry.current)
    return (
      <span aria-current="true" title={entry.label} className={className}>
        {content}
      </span>
    );
  return (
    <button
      type="button"
      title={t("panelHistory.show", { name: entry.label })}
      onClick={onOpen}
      className={className}
    >
      {content}
    </button>
  );
}
