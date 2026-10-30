import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { usePeek } from "./panel-search";
import type { PeekKind } from "./peek";

/**
 * Value of a cell that names a record from another view: the object of an address,
 * the node of an instance… In the body of a panel, the convention for what can be
 * drilled down into: the nodes, the objects, their instances and their resources,
 * each a link opening its own panel. A name as text, no icon nor badge: a pill is a
 * count filtering a page, a name is read as the text around it, underlined hovered.
 *
 * A click shows its record over the view, without leaving it (`peek` in the URL, see
 * `PeekPanel`). The click stops at the badge: the row under it, whose own panel a
 * click elsewhere on the row opens, does not receive it.
 */
export function CrossLink({
  kind,
  id,
  tab,
  children,
}: {
  kind: PeekKind;
  /** Id of the record; without it, the value stays plain text. */
  id: string | undefined;
  /** Tab of the record panel to open on, its first one by default. */
  tab?: string;
  children: ReactNode;
}) {
  const peek = usePeek();
  const { t } = useTranslation();

  if (id === undefined || id === "" || children === undefined || children === null || children === "")
    return <>{children}</>;

  const open = () => {
    peek(kind, id, tab);
  };

  return (
    <button
      type="button"
      onClick={(event) => {
        // Not for the row: it would open its own panel under the record.
        event.stopPropagation();
        open();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        open();
      }}
      data-cross-link=""
      className="inline-flex max-w-full cursor-pointer items-center rounded-sm text-left text-ink decoration-accent underline-offset-2 hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-(--focus-ring)"
    >
      <span className="truncate">{children}</span>
    </button>
  );
}
