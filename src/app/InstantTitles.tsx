import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/*
 * The tooltips of the webapp, shown at once. A browser shows the `title` of an
 * element about a second after the pointer stops on it, a delay no page can
 * shorten: hovered, the title is set aside (`data-instant-title`) for the browser
 * to show none, and said at once in a card as the hover cards are; the pointer
 * gone, it is put back, for the screen readers and the next hover. One listener
 * for the whole page, the components writing `title` as before. A touch shows
 * nothing: no hover there.
 */

/** Room kept between the card and the edges of the window. */
const MARGIN = 8;
/** Width of the card at most, as `max-w-sm`. */
const WIDTH = 384;
/** Where a title hovered is kept, the browser seeing none meanwhile. */
const ASIDE = "data-instant-title";

interface Shown {
  text: string;
  top: number;
  left: number;
}

/** The element hovered whose title the card says, its title set aside. */
let hovered: Element | null = null;

/** Puts back the title of the element hovered, the card gone. */
function restore() {
  if (hovered === null) return;
  const text = hovered.getAttribute(ASIDE);
  hovered.removeAttribute(ASIDE);
  // Unless the page wrote a title of its own meanwhile, the newer one kept.
  if (text !== null && !hovered.hasAttribute("title")) hovered.setAttribute("title", text);
  hovered = null;
}

/** Where the card goes: under the element, kept inside the window. */
function placeUnder(element: Element): { top: number; left: number } {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.bottom + 4,
    left: Math.max(MARGIN, Math.min(rect.left, window.innerWidth - WIDTH - MARGIN)),
  };
}

export function InstantTitles() {
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    const hide = () => {
      restore();
      setShown(null);
    };
    const onOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const target = event.target instanceof Element ? event.target.closest(`[title], [${ASIDE}]`) : null;
      if (target === hovered) return;
      hide();
      const text = target?.getAttribute("title")?.trim();
      if (!target || !text) return;
      hovered = target;
      target.setAttribute(ASIDE, target.getAttribute("title") ?? "");
      target.removeAttribute("title");
      setShown({ text, ...placeUnder(target) });
    };
    const onOut = (event: PointerEvent) => {
      if (hovered === null) return;
      const to = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (to !== null && hovered.contains(to)) return;
      hide();
    };
    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointerout", onOut, true);
    // Scrolled, clicked or a key pressed: the card would stand where the element no longer is.
    window.addEventListener("scroll", hide, true);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("keydown", hide, true);
    return () => {
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointerout", onOut, true);
      window.removeEventListener("scroll", hide, true);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("keydown", hide, true);
      restore();
    };
  }, []);

  if (shown === null) return null;
  return createPortal(
    <div
      role="tooltip"
      data-instant-title-card=""
      style={{ top: shown.top, left: shown.left }}
      className="pointer-events-none fixed z-[1400] w-max max-w-sm rounded-(--radius-panel) border border-line bg-surface-raised px-2 py-1 text-data whitespace-pre-line text-ink shadow-lg"
    >
      {shown.text}
    </div>,
    document.body,
  );
}
