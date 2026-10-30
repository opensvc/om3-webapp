/*
 * The rows of a list ticked one by one, or a range at once: a tick with Shift held
 * gives every row between it and the row ticked before (the anchor), in the order the
 * list shows them, sorted and filtered as it is, the state the anchor got. The anchor
 * stays where the range started: another Shift-click redoes the range from it, over
 * the selection as it was when the anchor was ticked, as in a file manager.
 */

/** The row a range starts from: its key, the state it got, the selection then. */
export interface RangeAnchor<K> {
  key: K;
  checked: boolean;
  base: K[];
}

/** Whether a change of a checkbox was made with Shift held: the click it comes from, mouse or Space. */
export const withShift = (event: { nativeEvent?: { shiftKey?: boolean } } | undefined): boolean =>
  event?.nativeEvent?.shiftKey === true;

/**
 * The selection once `key` is ticked (`checked`) or unticked: with `shift` and an
 * anchor the list still shows, every row from the anchor to `key` takes the anchor's
 * state, over the selection of the anchor's time; else `key` alone, the new anchor.
 */
export function rangeSelect<K>(
  order: K[],
  selected: K[],
  anchor: RangeAnchor<K> | null,
  key: K,
  checked: boolean,
  shift: boolean,
): { selected: K[]; anchor: RangeAnchor<K> } {
  const from = anchor === null ? -1 : order.indexOf(anchor.key);
  const to = order.indexOf(key);
  if (!shift || anchor === null || from === -1 || to === -1) {
    const rest = selected.filter((k) => k !== key);
    const next = checked ? [...rest, key] : rest;
    return { selected: next, anchor: { key, checked, base: next } };
  }
  const range = order.slice(Math.min(from, to), Math.max(from, to) + 1);
  const inRange = new Set(range);
  const rest = anchor.base.filter((k) => !inRange.has(k));
  return { selected: anchor.checked ? [...rest, ...range] : rest, anchor };
}
