/**
 * Motion of the history rail: when the order of its entries changes — a record
 * shown goes on top — the entries slide from where they were to their new place,
 * and a new one comes in from above.
 *
 * Showing another record may swap the whole panel (a node opened from a service),
 * or come after the panel was closed, so the last layout is kept here, outside the
 * panels: each rail measures its list after rendering, and plays the move from the
 * previous layout when its order differs.
 */

type Positions = Map<string, number>;

let last: { signature: string; positions: Positions } | null = null;

const DURATION_MS = 220;

/** Positions within the list; `offsetTop` ignores a move still playing. */
function measure(list: HTMLElement): Positions {
  const positions: Positions = new Map();
  for (const entry of list.querySelectorAll<HTMLElement>("[data-entry]")) {
    const key = entry.dataset.entry;
    if (key !== undefined) positions.set(key, entry.offsetTop);
  }
  return positions;
}

/**
 * Called by the rail after each render. `signature` names the order of its
 * entries: the move plays only when it changed.
 */
export function moveHistoryEntries(list: HTMLElement, signature: string): void {
  const now = measure(list);
  const before = last;
  last = { signature, positions: now };
  if (before === null || before.signature === signature) return;
  // Without the means to animate (an old browser, a test environment), no move.
  if (typeof window.matchMedia !== "function" || typeof list.animate !== "function") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const entry of list.querySelectorAll<HTMLElement>("[data-entry]")) {
    const key = entry.dataset.entry;
    if (key === undefined) continue;
    const from = before.positions.get(key);
    const to = now.get(key) ?? 0;
    if (from === undefined) {
      entry.animate(
        [
          { opacity: 0, transform: "translateY(-20px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: DURATION_MS, easing: "ease-out" },
      );
    } else if (Math.abs(from - to) > 0.5) {
      entry.animate([{ transform: `translateY(${String(from - to)}px)` }, { transform: "none" }], {
        duration: DURATION_MS,
        easing: "ease-out",
      });
    }
  }
}
