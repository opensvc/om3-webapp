import { useId } from "react";
import { useTranslation } from "react-i18next";
import { PAGE_SIZES, type Paging } from "../../app/paging";
import { Select } from "./Field";

/** The page buttons of oc3: outlined, the height of the list toolbars. */
const PAGE_BUTTON =
  "h-7 rounded-(--radius-control) border border-line px-2 text-ink-muted hover:text-ink disabled:opacity-50 disabled:hover:text-ink-muted";

/**
 * The pages of a list, as oc3 draws them over its tables: the rows a page to choose,
 * the rows shown out of how many, and the way to the first, previous, next and last
 * pages.
 */
export function Pager({ paging }: { paging: Paging }) {
  const { t, i18n } = useTranslation();
  const sizeId = useId();
  const { offset, limit, total, setOffset, setLimit } = paging;
  const format = (n: number) => n.toLocaleString(i18n.language);
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const pageIndex = Math.floor(offset / limit);
  const lastOffset = (pageCount - 1) * limit;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3">
      <label className="flex items-center gap-1 text-ink-muted" htmlFor={sizeId}>
        {t("pager.perPage")}
        <Select
          id={sizeId}
          className="h-7"
          value={limit}
          onChange={(event) => setLimit(Number(event.target.value))}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </label>
      <span aria-live="polite" className="ml-auto text-ink-muted tabular-nums">
        {t("pager.rangeOf", { from: format(from), to: format(to), total: format(total) })}
      </span>
      <nav aria-label={t("pager.label")} className="flex items-center gap-1">
        <button type="button" className={PAGE_BUTTON} disabled={offset === 0} onClick={() => setOffset(0)}>
          {t("pager.first")}
        </button>
        <button
          type="button"
          className={PAGE_BUTTON}
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - limit))}
        >
          {t("pager.previous")}
        </button>
        <span className="px-1 text-ink-muted tabular-nums" aria-current="page">
          {t("pager.page", { page: format(pageIndex + 1), pages: format(pageCount) })}
        </span>
        <button
          type="button"
          className={PAGE_BUTTON}
          disabled={pageIndex >= pageCount - 1}
          onClick={() => setOffset(offset + limit)}
        >
          {t("pager.next")}
        </button>
        <button
          type="button"
          className={PAGE_BUTTON}
          disabled={pageIndex >= pageCount - 1}
          onClick={() => setOffset(lastOffset)}
        >
          {t("pager.last")}
        </button>
      </nav>
    </div>
  );
}
