/**
 * Smooth change of width when a side panel takes the place of another: the record
 * of a node, in a wide panel, shown after a tag, in a narrow one. Each kind of
 * record has its own panel, so the width is handed over here, outside the panels:
 * a panel that closes leaves its width, and a panel mounted open right after
 * starts from it and eases to its own. A panel opened on its own slides in as
 * usual; nothing moves when the user asked for reduced motion.
 */

let lastClosed: { width: number; at: number } | null = null;

/** A panel mounted this soon after another closed is taking its place. */
const SWAP_MS = 150;
const RESIZE_MS = 220;

/** Called when an open panel closes or is removed. */
export function leaveWidth(panel: HTMLElement): void {
  const width = panel.getBoundingClientRect().width;
  if (width > 0) lastClosed = { width, at: performance.now() };
}

/** Called when a panel is mounted open: eases from the width of the one it replaces. */
export function takeOverWidth(panel: HTMLElement): void {
  const before = lastClosed;
  lastClosed = null;
  if (before === null || performance.now() - before.at > SWAP_MS) return;
  const width = panel.getBoundingClientRect().width;
  if (Math.abs(width - before.width) < 1) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  panel.animate([{ maxWidth: `${String(before.width)}px` }, { maxWidth: `${String(width)}px` }], {
    duration: RESIZE_MS,
    easing: "ease-out",
  });
}
