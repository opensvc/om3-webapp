import { useState } from "react";

interface DiffLine {
  kind: "hunk" | "add" | "del" | "context" | "note";
  old?: number;
  new?: number;
  text: string;
}

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

/** The lines of a unified diff, each with its number in the old and the new file. */
function parse(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let before = 0;
  let after = 0;
  // A diff ends with a newline: the empty string after it is no line.
  for (const raw of diff.replace(/\n$/, "").split("\n")) {
    const hunk = HUNK.exec(raw);
    if (hunk !== null) {
      before = Number(hunk[1]);
      after = Number(hunk[2]);
      lines.push({ kind: "hunk", text: raw });
    } else if (raw.startsWith("+")) {
      lines.push({ kind: "add", new: after++, text: raw.slice(1) });
    } else if (raw.startsWith("-")) {
      lines.push({ kind: "del", old: before++, text: raw.slice(1) });
    } else if (raw.startsWith("\\")) {
      // "\ No newline at end of file"
      lines.push({ kind: "note", text: raw.slice(1).trim() });
    } else {
      lines.push({ kind: "context", old: before++, new: after++, text: raw.slice(1) });
    }
  }
  return lines;
}

const ROW = {
  add: "bg-state-up-soft",
  del: "bg-state-down-soft",
  context: "",
  hunk: "bg-surface-sunken text-ink-muted",
  note: "text-ink-muted italic",
};

const SIGN = { add: "+", del: "−", context: "", hunk: "", note: "" };

/**
 * A unified diff, as `git diff` prints it from its first hunk: one row per line
 * with its number in the old and in the new file, the added and removed lines
 * marked by a sign as well as by a tint. A long diff shows its first lines, the
 * rest on demand. The labels come from the caller: this component knows no language.
 */
export function UnifiedDiff({
  diff,
  labels,
  limit = 300,
}: {
  diff: string;
  labels: {
    /** Said before an added or a removed line to assistive technologies. */
    added: string;
    removed: string;
    /** Button showing the whole diff, given the number of lines. */
    showAll: (lines: number) => string;
  };
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = parse(diff);
  const shown = expanded ? lines : lines.slice(0, limit);
  return (
    <div className="overflow-x-auto rounded-(--radius-control) border border-line font-mono text-data">
      <table className="w-full border-collapse">
        <tbody>
          {shown.map((line, index) => (
            <tr key={index} className={ROW[line.kind]}>
              <td className="w-10 px-1.5 text-right align-top text-ink-muted tabular-nums select-none">
                {line.old}
              </td>
              <td className="w-10 px-1.5 text-right align-top text-ink-muted tabular-nums select-none">
                {line.new}
              </td>
              <td className="w-4 text-center align-top select-none">
                <span aria-hidden="true">{SIGN[line.kind]}</span>
                {line.kind === "add" && <span className="sr-only">{labels.added}</span>}
                {line.kind === "del" && <span className="sr-only">{labels.removed}</span>}
              </td>
              <td className="px-1.5 break-all whitespace-pre-wrap">{line.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length < lines.length && (
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
          }}
          className="w-full border-t border-line px-2 py-1 text-left font-sans text-accent hover:underline"
        >
          {labels.showAll(lines.length)}
        </button>
      )}
    </div>
  );
}
