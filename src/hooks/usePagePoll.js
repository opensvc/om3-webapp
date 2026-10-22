import {useEffect, useRef} from "react";

/** Whether the page is seen: hidden (a tab in the background), nothing is polled. */
export const pageSeen = () => typeof document === "undefined" || document.visibilityState !== "hidden";

/**
 * Reads what no event tells, again and again while the page is seen: `read` at
 * once, then `everyMs` after each read ends, never two at a time, so that an
 * answer late can not undo a later one. Hidden, the reads stop; seen again, one
 * is made at once, unless one is running. `read(live)` is given whether the poll
 * still stands, to drop what it read once it does not; `deps` change, the poll
 * starts over.
 */
export function usePagePoll(read, everyMs, deps) {
    const readRef = useRef(read);
    readRef.current = read;
    useEffect(() => {
        let live = true;
        let timer = null;
        let reading = false;
        const run = async () => {
            timer = null;
            if (!live || reading || !pageSeen()) return;
            reading = true;
            try {
                await readRef.current(() => live);
            } finally {
                reading = false;
            }
            if (live) timer = setTimeout(run, everyMs);
        };
        const onVisibility = () => {
            if (!live || reading || !pageSeen()) return;
            if (timer !== null) clearTimeout(timer);
            void run();
        };
        void run();
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            live = false;
            if (timer !== null) clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisibility);
        };
        // The poll starts over when what it reads changes, as its caller says.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [everyMs, ...deps]);
}
