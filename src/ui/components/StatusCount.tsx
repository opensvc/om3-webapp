import { StatusMark } from "./StatusMark";
import type { ObjectState } from "./StatusBadge";

/**
 * A state mark followed by a count, as in the status columns of the Namespaces and
 * Kinds views. With `onClick` the count is a button (shows the items counted, for
 * instance), which stops its click so that the row under it does not open; `label`
 * is then its accessible name and tooltip ("Show the 3 down objects of root").
 */
export function StatusCount({
  state,
  count,
  markLabel,
  label,
  onClick,
}: {
  state: ObjectState;
  count: number;
  /** Label of the mark, when the state's own ("down") is not the right word. */
  markLabel?: string;
  label?: string;
  onClick?: () => void;
}) {
  return (
    <span className="inline-flex items-center justify-end gap-1">
      <StatusMark state={state} label={markLabel} />
      {onClick === undefined ? (
        <span className="min-w-[2ch] text-right tabular-nums">{count}</span>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
          aria-label={label}
          title={label}
          className="min-w-[2ch] rounded-(--radius-control) text-right tabular-nums hover:underline"
        >
          {count}
        </button>
      )}
    </span>
  );
}
