import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ObjectIcon } from "../ui/components/ObjectIcon";
import { StatusBadge } from "../ui/components/StatusBadge";
import { StatusMark } from "../ui/components/StatusMark";
import { statusBadge } from "../ui/components/status";
import { CloseIcon, SearchIcon } from "../ui/icons";
import { typing } from "../ui/lib/shortcuts";
import { usePeek } from "./panel-search";
import { KIND_ICON, SEARCH_KINDS, hitIcon, search, type SearchEntry, type SearchIndex, type SearchKind } from "./search";

type Scope = SearchKind | "all";

/** The parts of a text that match the query, marked; case-insensitive. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLocaleLowerCase();
  if (q === "") return <>{text}</>;
  const lower = text.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, from)) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className="bg-transparent font-semibold text-ink underline decoration-accent underline-offset-2">
        {text.slice(at, at + q.length)}
      </mark>,
    );
    from = at + q.length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
}

/**
 * Global search of the cluster, from the top bar, as oc3 searches the collector.
 *
 * A compact field in the bar opens a command palette over the current view:
 * Ctrl+K (⌘K on a Mac) or "/" open it from anywhere. The results come grouped by
 * kind (`search.ts`), each with its icon, what tells homonyms apart and its
 * status. Choosing one opens its record in the panel over the current view, as a
 * badge does (`usePeek`), a node included. Up and Down move through the results,
 * Enter opens, Escape closes; a
 * scope narrows the search to one kind and shows more of it.
 *
 * `loadIndex` reads what is searched, each time the palette opens.
 */
export function GlobalSearch({ loadIndex }: { loadIndex: () => Promise<SearchIndex> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const shortcut = isMac() ? "⌘K" : "Ctrl K";

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const combo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (combo || (event.key === "/" && !typing(event.target) && !event.altKey)) {
        // Not over another modal dialog: the help, a confirmation.
        if (!combo && document.querySelector('[aria-modal="true"]') !== null) return;
        event.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K /"
        onClick={() => {
          setOpen(true);
        }}
        className="flex h-7 w-64 items-center gap-2 rounded-(--radius-control) border border-line px-2 text-ink-muted hover:bg-surface-sunken hover:text-ink max-md:w-7 max-md:justify-center max-md:px-0"
      >
        <SearchIcon className="h-4 w-4 shrink-0" />
        <span className="truncate max-md:sr-only">{t("search.title")}</span>
        <kbd className="ml-auto shrink-0 rounded-sm border border-line px-1 text-data whitespace-nowrap max-md:hidden">
          {shortcut}
        </kbd>
      </button>
      {/* At the level of the page: the top bar has colours of its own. */}
      {open &&
        createPortal(
          <SearchPalette
            loadIndex={loadIndex}
            onClose={(restoreFocus) => {
              setOpen(false);
              // Closed without choosing: back to where the user was. A chosen
              // result opens a panel, which takes the focus itself.
              if (restoreFocus) window.setTimeout(() => trigger.current?.focus(), 0);
            }}
          />,
          document.body,
        )}
    </>
  );
}

function SearchPalette({
  loadIndex,
  onClose,
}: {
  loadIndex: () => Promise<SearchIndex>;
  onClose: (restoreFocus: boolean) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const peek = usePeek();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [active, setActive] = useState(0);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    let live = true;
    loadIndex().then(
      (loaded) => {
        if (live) setIndex(loaded);
      },
      (error: unknown) => {
        if (live) setFailure(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      live = false;
    };
  }, [loadIndex]);

  const trimmed = query.trim();
  const groups = useMemo(() => (index === null ? [] : search(index, trimmed, scope)), [index, trimmed, scope]);
  const hits = useMemo(() => groups.flatMap((g) => g.hits), [groups]);
  const current = hits[Math.min(active, hits.length - 1)];
  const key = (hit: SearchEntry) => `${hit.kind}:${hit.id}`;
  const optionId = (hit: SearchEntry) => `${id}-${key(hit)}`;

  // A new result list starts on its first result.
  useEffect(() => {
    setActive(0);
  }, [trimmed, scope]);

  useEffect(() => {
    if (current === undefined) return;
    document.getElementById(optionId(current))?.scrollIntoView?.({ block: "nearest" });
    // optionId only depends on the stable useId prefix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function choose(hit: SearchEntry) {
    onClose(false);
    peek(hit.kind, hit.id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        // The side panel listens for Escape too: it stays open under the search.
        event.stopPropagation();
        onClose(true);
        return;
      case "ArrowDown":
      case "ArrowUp": {
        if (hits.length === 0) return;
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((i) => (Math.min(i, hits.length - 1) + step + hits.length) % hits.length);
        return;
      }
      case "Enter":
        if (event.target !== input.current || current === undefined) return;
        event.preventDefault();
        choose(current);
        return;
      case "Tab": {
        // The palette is modal: the focus stays inside it.
        const focusable = dialog.current?.querySelectorAll<HTMLElement>("input, button:not([disabled])");
        if (focusable === undefined || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
        return;
      }
    }
  }

  const scopes: Scope[] = ["all", ...SEARCH_KINDS];

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-start justify-center bg-ink/20 px-4 pt-[10vh]"
      onPointerDown={(event) => {
        // A click on the backdrop, not inside the palette, closes it.
        if (event.target === event.currentTarget) onClose(true);
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t("search.title")}
        onKeyDown={onKeyDown}
        className="flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-(--radius-panel) border border-line bg-surface-raised text-ink shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <SearchIcon className="h-5 w-5 shrink-0 text-ink-muted" />
          <input
            ref={input}
            // Not "search": its own clear button would double the close button.
            type="text"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls={`${id}-results`}
            aria-autocomplete="list"
            aria-activedescendant={current === undefined ? undefined : optionId(current)}
            aria-label={t("search.title")}
            placeholder={t("search.placeholder")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            className="h-12 min-w-0 flex-1 bg-transparent text-title outline-none placeholder:text-ink-muted"
          />
          {index === null && failure === null && (
            <span role="status" className="shrink-0 text-ink-muted">
              {t("search.searching")}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              onClose(true);
            }}
            title={t("search.close")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-(--radius-control) text-ink-muted hover:text-ink"
          >
            <CloseIcon />
            <span className="sr-only">{t("search.close")}</span>
          </button>
        </div>

        <div role="group" aria-label={t("search.scopes")} className="flex flex-wrap gap-1 border-b border-line px-3 py-2">
          {scopes.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => {
                setScope(value);
                input.current?.focus();
              }}
              className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-data ${
                scope === value
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              {value !== "all" && <ObjectIcon kind={KIND_ICON[value]} className="h-3.5 w-3.5" />}
              {value === "all" ? t("search.all") : t(`search.kinds.${value}`)}
            </button>
          ))}
        </div>

        <div id={`${id}-results`} role="listbox" aria-label={t("search.results")} className="min-h-0 flex-1 overflow-y-auto py-1">
          {failure !== null ? (
            <p role="alert" className="px-3 py-6 text-center text-state-down">
              ■ {failure}
            </p>
          ) : trimmed === "" ? (
            <p className="px-3 py-6 text-center text-ink-muted">{t("search.hint")}</p>
          ) : index === null ? (
            <p className="px-3 py-6 text-center text-ink-muted">{t("search.searching")}</p>
          ) : groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-ink-muted">{t("search.none", { query: trimmed })}</p>
          ) : (
            groups.map((group) => {
              const headingId = `${id}-${group.kind}`;
              return (
                <div key={group.kind} role="group" aria-labelledby={headingId} className="py-1">
                  <div className="flex items-center gap-2 px-3 py-1 text-data text-ink-muted">
                    <ObjectIcon kind={KIND_ICON[group.kind]} className="h-3.5 w-3.5" />
                    <span id={headingId} className="font-medium tracking-wide uppercase">
                      {t(`search.kinds.${group.kind}`)}
                    </span>
                    {group.more && scope === "all" && (
                      <button
                        type="button"
                        onClick={() => {
                          setScope(group.kind);
                          input.current?.focus();
                        }}
                        className="ml-auto text-accent hover:underline"
                      >
                        {t("search.more")}
                      </button>
                    )}
                  </div>
                  {group.error && <p className="px-3 py-1 text-state-down">■ {t("search.kindError")}</p>}
                  {group.hits.map((hit) => {
                    const selected = hit === current;
                    return (
                      <div
                        key={key(hit)}
                        id={optionId(hit)}
                        role="option"
                        aria-selected={selected}
                        onPointerMove={() => {
                          const at = hits.indexOf(hit);
                          if (at !== active) setActive(at);
                        }}
                        onClick={() => {
                          choose(hit);
                        }}
                        className={`mx-1 flex cursor-pointer items-center gap-3 rounded-(--radius-control) px-2 py-1.5 ${
                          selected ? "bg-accent-soft" : ""
                        }`}
                      >
                        <ObjectIcon kind={hitIcon(hit)} className="h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            <Highlight text={hit.label} query={trimmed} />
                          </div>
                          {hit.context.length > 0 && (
                            <div className="truncate text-data text-ink-muted">
                              <Highlight text={hit.context.join(" · ")} query={trimmed} />
                            </div>
                          )}
                        </div>
                        {hit.status !== undefined &&
                          (hit.status === "n/a" ? (
                            <StatusMark state="na" label="n/a" />
                          ) : (
                            <StatusBadge {...statusBadge(hit.status)} className="w-auto" />
                          ))}
                      </div>
                    );
                  })}
                  {group.more && scope !== "all" && <p className="px-3 py-1 text-data text-ink-muted">{t("search.refine")}</p>}
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap gap-4 border-t border-line px-3 py-1.5 text-data text-ink-muted">
          <span>
            <kbd className="rounded-sm border border-line px-1">↑</kbd> <kbd className="rounded-sm border border-line px-1">↓</kbd>{" "}
            {t("search.keys.move")}
          </span>
          <span>
            <kbd className="rounded-sm border border-line px-1">↵</kbd> {t("search.keys.open")}
          </span>
          <span>
            <kbd className="rounded-sm border border-line px-1">Esc</kbd> {t("search.keys.close")}
          </span>
        </div>
      </div>
    </div>
  );
}
