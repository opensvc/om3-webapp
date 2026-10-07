import { useEffect, useRef } from "react";

/** How long a revealed secret stays on screen before it is masked again. */
export const SECRET_REVEAL_MS = 10_000;

/**
 * Masks a revealed secret again on its own: `delay` after `shown` turns true,
 * `hide` is called. Hiding it by hand, or leaving, cancels the timer; revealing
 * it again starts a new one.
 */
export function useAutoHide(shown: boolean, hide: () => void, delay: number = SECRET_REVEAL_MS): void {
  const latestHide = useRef(hide);
  latestHide.current = hide;
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => {
      latestHide.current();
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [shown, delay]);
}
