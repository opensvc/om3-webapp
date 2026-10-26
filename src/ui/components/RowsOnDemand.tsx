import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

/** The rows drawn at first, and added each time the end of the list nears. */
export const ROWS_STEP = 100;
/** How far before the end of the rows drawn the next ones are added, in the scroller of the table. */
const AHEAD = "0px 0px 600px 0px";

export interface RowsOnDemand {
  /** The rows drawn, out of `total`. */
  shown: number;
  total: number;
  /** The rows drawn, out of the whole list. */
  rows: <T>(list: T[]) => T[];
  more: () => void;
}

/**
 * The rows of a list drawn on demand, in the place of its pages: the first ones,
 * then more as the end nears (`MoreRows`); back to the first ones when what the list
 * holds changes order or content (`reset`: its filters, its sort). Every row is in
 * memory already: what is spared is drawing them all.
 */
export function useRowsOnDemand(total: number, reset: DependencyList): RowsOnDemand {
  const [drawn, setDrawn] = useState(ROWS_STEP);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDrawn(ROWS_STEP), reset);
  const shown = Math.min(drawn, total);
  const rows = useCallback(<T,>(list: T[]) => list.slice(0, drawn), [drawn]);
  const more = useCallback(() => setDrawn((n) => n + ROWS_STEP), []);
  return { shown, total, rows, more };
}

/**
 * The last line of a list drawn on demand, while rows remain: how many are drawn out
 * of all, and a button drawing more, for the keyboard. Nearing the view in the
 * scroller of its table, it draws more by itself.
 */
export function MoreRows({ rows, colSpan }: { rows: RowsOnDemand; colSpan: number }) {
  const { t, i18n } = useTranslation();
  const line = useRef<HTMLTableRowElement>(null);
  const { shown, total, more } = rows;
  const remaining = total - shown;
  useEffect(() => {
    const element = line.current;
    if (element === null || remaining <= 0 || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) more();
      },
      { root: element.closest("[data-table-scroll]"), rootMargin: AHEAD },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [more, remaining, shown]);
  if (remaining <= 0) return null;
  const format = (n: number) => n.toLocaleString(i18n.language);
  return (
    <tr ref={line} data-more-rows="">
      <td colSpan={colSpan} className="px-2 py-2 text-center text-ink-muted">
        <span className="inline-flex items-center gap-3">
          {t("rowsOnDemand.shown", { shown: format(shown), total: format(total) })}
          <Button size="sm" onClick={more}>
            {t("rowsOnDemand.more", { count: Math.min(ROWS_STEP, remaining) })}
          </Button>
        </span>
      </td>
    </tr>
  );
}
