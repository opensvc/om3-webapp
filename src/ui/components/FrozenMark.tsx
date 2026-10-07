import { SnowflakeIcon } from "../icons";

/**
 * Frozen mark at the head of a row.
 *
 * Freezing reads whatever the columns on display: it says that the object no longer
 * answers orchestration orders, which explains many a state. The snowflake is
 * doubled by a text for screen readers and by a tooltip, colour and shape alone not
 * being enough.
 */
export function FrozenMark({ frozen }: { frozen: boolean }) {
  if (!frozen) return null;
  return (
    <span title={"frozen"} className="text-icon-network">
      <SnowflakeIcon className="h-3.5 w-3.5" />
      <span className="sr-only">{"frozen"}</span>
    </span>
  );
}
