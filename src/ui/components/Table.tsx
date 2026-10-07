import type {
  HTMLAttributes,
  Ref,
  KeyboardEvent,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "../cn";

/**
 * The list table of oc3 (`CollectorList`): a raised panel with a line border,
 * 13px text, header in muted ink, rows split by a line and darkened on hover.
 * Rows are 30px high (`h-[1.875rem]`), as in the views still on MUI.
 *
 * `sticky` keeps the header in view: the wrapper then scrolls both ways, so it must
 * be given a bounded height by its page (`min-h-0 flex-1` in a flex column filling
 * the view, or a `max-h-*`). Without one it grows with its rows and nothing scrolls
 * in it.
 *
 * `aria-label` names the table itself, not its wrapper.
 */
export function Table({
  sticky = false,
  className,
  tableClassName,
  "aria-label": label,
  ref,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  /** The scrolling container, for views that load more rows on scroll. */
  ref?: Ref<HTMLDivElement>;
  sticky?: boolean;
  tableClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-(--radius-panel) border border-line bg-surface-raised",
        sticky ? "overflow-auto" : "overflow-x-auto",
        className,
      )}
      {...props}
    >
      <table
        aria-label={label}
        data-sticky={sticky ? "" : undefined}
        className={cn(
          "w-full border-collapse text-data",
          sticky && "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-surface-raised",
          tableClassName,
        )}
      >
        {children}
      </table>
    </div>
  );
}

/** Header row. */
export function HeaderRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-line text-left text-ink-muted", className)} {...props} />;
}

type Align = "left" | "center" | "right";
const ALIGN: Record<Align, string> = { left: "text-left", center: "text-center", right: "text-right" };

/** Header cell, `scope="col"`. */
export function HeaderCell({
  align = "left",
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
  return (
    <th
      scope="col"
      className={cn("h-[1.875rem] px-2 py-1 font-medium whitespace-nowrap", ALIGN[align], className)}
      {...props}
    />
  );
}

export type SortDirection = "asc" | "desc";

/**
 * Sortable header cell: the whole label is a button, the order shown by an arrow
 * and announced by `aria-sort`, as in oc3.
 */
export function SortHeaderCell({
  label,
  active,
  direction,
  onSort,
  align = "left",
  className,
}: {
  label: ReactNode;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  align?: Align;
  className?: string;
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn("h-[1.875rem] p-0", ALIGN[align], className)}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "w-full px-2 py-1 font-medium whitespace-nowrap hover:text-ink",
          ALIGN[align],
          active && "text-ink",
        )}
      >
        {label}
        {active && <span aria-hidden="true">{direction === "asc" ? " ▲" : " ▼"}</span>}
      </button>
    </th>
  );
}

/**
 * Body row. With `onActivate` the row opens something, by click as by keyboard
 * (Enter, Space): it takes the focus and the pointer, and a click on a control
 * inside a cell must stop its propagation. `selected` marks the row on display.
 */
export function Row({
  onActivate,
  selected = false,
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { onActivate?: () => void; selected?: boolean }) {
  const interactive = onActivate !== undefined;
  return (
    <tr
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onActivate : undefined}
      onKeyDown={
        interactive
          ? (event: KeyboardEvent<HTMLTableRowElement>) => {
              if (event.target !== event.currentTarget) return;
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onActivate();
            }
          : undefined
      }
      aria-current={selected ? "true" : undefined}
      className={cn(
        "h-[1.875rem] border-b border-line last:border-b-0 hover:bg-surface-sunken",
        interactive &&
          "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--focus-ring)",
        selected && "bg-accent-soft",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Body cell. `numeric` aligns right with tabular digits. What the cell holds sits in
 * the middle of the line rather than on its baseline: an inline control (a checkbox,
 * a small button, a mark) would otherwise add the room of a descender under it and
 * make the row taller than the others.
 */
export function Cell({
  align,
  numeric = false,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: Align; numeric?: boolean }) {
  return (
    <td
      className={cn(
        "px-2 py-1 [&>*]:align-middle",
        ALIGN[align ?? (numeric ? "right" : "left")],
        className,
      )}
      data-numeric={numeric ? "" : undefined}
      {...props}
    />
  );
}

/** The single row of an empty table, or of a table that failed to load. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-2 py-3 text-ink-muted">
        {children}
      </td>
    </tr>
  );
}
