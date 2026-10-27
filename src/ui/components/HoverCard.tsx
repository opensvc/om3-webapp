import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePlaceCard } from "./card-place";


/**
 * The details of what it wraps, in a card under it while the pointer is over it or
 * the focus within it: a cell says the gist, the card the figures behind it. With
 * `focusable` the wrapper takes the focus itself, for a cell holding nothing that
 * does, so that the keyboard reaches the card too.
 *
 * The card is in a portal, placed against the window, as HoverNotes does: a side
 * panel sliding in or a table scrolling sideways would otherwise clip it.
 */
export function HoverCard({
  card,
  focusable = false,
  children,
}: {
  card: ReactNode;
  focusable?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number; right: number } | null>(null);
  const shown = useRef<HTMLDivElement>(null);
  usePlaceCard(shown, place);

  const show = () => {
    const rect = anchor.current?.getBoundingClientRect();
    if (rect === undefined) return;
    // Under it, its left edge on the element's until drawn: placed by its width then (usePlaceCard).
    setPlace({ top: rect.bottom + 4, left: rect.left, right: rect.right });
  };
  const hide = () => setPlace(null);

  return (
    <span
      ref={anchor}
      tabIndex={focusable ? 0 : undefined}
      aria-describedby={place === null ? undefined : id}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(event) => {
        if (event.key === "Escape") hide();
      }}
      className="inline-flex rounded-(--radius-control) focus-visible:outline-2 focus-visible:outline-accent"
    >
      {children}
      {place !== null &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            ref={shown}
            style={{ top: place.top, left: place.left }}
            className="pointer-events-none fixed z-[1250] w-max max-w-sm rounded-(--radius-panel) border border-line bg-surface-raised p-2 text-data text-ink shadow-lg"
          >
            {card}
          </div>,
          document.body,
        )}
    </span>
  );
}
