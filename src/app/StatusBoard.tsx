import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../ui/cn";
import { AlertTriangleIcon, DrpIcon, HistoryIcon, InfoIcon, PlayIcon, PauseIcon, SnowflakeIcon, TargetIcon } from "../ui/icons";
import { FrozenMark } from "../ui/components/FrozenMark";
import { NotProvisionedMark } from "../ui/components/StateMarks";
import { StateGlyph } from "../ui/components/StateGlyph";
import type { ObjectState } from "../ui/components/StatusBadge";
import { statusBadge } from "../ui/components/status";
import { Cell, HeaderCell, HeaderRow, Row, Table } from "../ui/components/Table";
import type { Board, BoardRow, Level, Span, Text, Tone } from "./statusboard";
import { HoverNotes } from "./HoverNotes";

/** The inks of the webapp for om's colors. */
const TONES: Record<Tone, string> = {
  optimal: "text-state-up",
  error: "text-state-down",
  warning: "text-state-warn",
  secondary: "text-ink-muted",
  primary: "text-ink",
  frozen: "text-icon-network",
};


/** Depth of the first column: written out, Tailwind does not see names built at runtime. */
const INDENT = ["pl-2", "pl-6", "pl-10", "pl-14"];

const LEVELS: Record<Level, { ink: string; Icon: typeof InfoIcon }> = {
  error: { ink: "text-state-down", Icon: AlertTriangleIcon },
  warn: { ink: "text-state-warn", Icon: AlertTriangleIcon },
  info: { ink: "text-ink-muted", Icon: InfoIcon },
};

/*
 * The pieces of a cell carry no tooltip of their own: the card of the cell
 * (`HoverNotes`) says what they mean, with the notes, and two tooltips over each
 * other could not be read. Each keeps its meaning for the screen readers.
 */

const GLYPH_INK: Record<ObjectState, string> = {
  up: "text-state-up",
  warn: "text-state-warn",
  down: "text-state-down",
  na: "text-state-unknown",
  unknown: "text-state-unknown",
};

/** A status as the other views draw it: the glyph of its state, gray when no issue; n/a as om writes it, "/". */
function Status({ span }: { span: Span }) {
  const badge = statusBadge(span.status);
  // om grays a down where the object misses no instance: it is no issue.
  const muted = span.tone === "secondary" && badge.state !== "unknown" && badge.state !== "na";
  return (
    <span data-state={badge.state} className={cn("inline-flex w-4 shrink-0 items-center justify-center", muted ? "text-ink-muted" : GLYPH_INK[badge.state])}>
      <StateGlyph state={badge.state} />
      <span className="sr-only">{badge.label ?? span.status}</span>
    </span>
  );
}

/** The key of the meaning of an instance mark, under `statusBoard.marks`. */
function markKey(span: Span): string {
  switch (span.mark) {
    case "*":
      return "frozen";
    case "=":
      return "stopped";
    case "L":
      return "rpoBreached";
    case "!":
      return "overallWarn";
    case "R":
      return "running";
    case "#":
      return "drp";
    case "^":
      return span.tone === "error" ? "leaderNonOptimal" : "leader";
    default:
      return "notProvisioned";
  }
}

/** An instance mark of om mon, as an icon telling it. */
function Mark({ span }: { span: Span }) {
  const { t } = useTranslation();
  const label = t(`statusBoard.marks.${markKey(span)}`);
  const glyph = (() => {
    switch (span.mark) {
      case "*":
        return [<SnowflakeIcon className="h-3.5 w-3.5" />, "text-icon-network"] as const;
      case "=":
        // The pause bars, not the stop square: a gray square is a down that is no issue.
        return [<PauseIcon className="h-3.5 w-3.5" />, "text-ink-muted"] as const;
      case "L":
        return [<HistoryIcon className="h-3.5 w-3.5" />, "text-state-warn"] as const;
      case "!":
        return [<StateGlyph state="warn" />, "text-state-warn"] as const;
      case "R":
        return [<PlayIcon className="h-3.5 w-3.5" />, "text-icon-network"] as const;
      case "#":
        return [<DrpIcon className="h-3.5 w-3.5" />, "text-ink-muted"] as const;
      case "^":
        return [<TargetIcon className="h-3.5 w-3.5" />, span.tone === "error" ? "text-state-down" : "text-ink-muted"] as const;
      default:
        return null;
    }
  })();
  // Not provisioned: the "P" pill of the unprovisioned resources, the same mark.
  if (span.mark === "P") return <NotProvisionedMark label={label} />;
  if (glyph === null) return null;
  return (
    <span role="img" aria-label={label} className={cn("inline-flex", glyph[1])}>
      {glyph[0]}
    </span>
  );
}

/** What a resource flag means, its restarts counted. */
function flagMeaning(span: Span, t: (key: string, options?: Record<string, unknown>) => string): string {
  const key = /^[0-9+]$/.test(span.text) ? "restarts" : span.text;
  return t(`statusBoard.flags.${key}`, { count: span.text === "+" ? 10 : Number(span.text) });
}

/** A resource flag, a small pill naming it. */
function Flag({ span }: { span: Span }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded-sm border px-0.5 text-[0.6875rem] leading-none font-medium",
        span.tone === "error" ? "border-state-down text-state-down" : "border-line text-ink-muted",
      )}
    >
      <span aria-hidden="true">{span.text}</span>
      <span className="sr-only">{flagMeaning(span, t)}</span>
    </span>
  );
}

/** What the pieces of a cell mean, in words: its status, its marks, its flags. The card of the cell says them. */
function useCellDetails() {
  const { t } = useTranslation();
  return (text: Text): string[] =>
    text.flatMap((s) => {
      if (s.status !== undefined) return [t("statusBoard.details.status", { status: s.status === "n/a" ? "/" : s.status })];
      if (s.mark !== undefined) return [t(`statusBoard.marks.${markKey(s)}`)];
      if (s.flag) return [flagMeaning(s, t)];
      return [];
    });
}

/** What a cell holds: the status glyph, the marks, the flags, the markers of the notes. */
function Pieces({ text, kind }: { text: Text; kind: BoardRow["kind"] }) {
  const { t } = useTranslation();
  if (text.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {text.map((s, i) => {
        if (s.status !== undefined) return <Status key={i} span={s} />;
        if (s.mark !== undefined) return <Mark key={i} span={s} />;
        if (s.flag) return <Flag key={i} span={s} />;
        if (s.note)
          return (
            <sup key={i} className={cn("text-[0.75rem] font-medium", TONES[s.tone ?? "secondary"])}>
              <span aria-hidden="true">{s.text}</span>
              <span className="sr-only">{t("statusBoard.seeNote", { marker: s.text })}</span>
            </sup>
          );
        if (s.text.trim() === "") return null;
        // A value with no meaning of its own: a monitor state, an expectation…
        if (s.text === "·") return <span key={i} className="text-ink-muted" aria-label={t("statusBoard.none")}>–</span>;
        return (
          <span key={i} className={cn(kind !== "resource" && s.tone && TONES[s.tone])}>
            {s.text}
          </span>
        );
      })}
    </span>
  );
}

/** The tint of a status said in full: the availability states in their colour, n/a muted. */
const STATUS_INK: Record<string, string> = {
  up: "text-state-up",
  "stdby up": "text-state-up",
  down: "text-state-down",
  "stdby down": "text-state-down",
  warn: "text-state-warn",
  "n/a": "text-ink-muted",
};

/** A status of the summary, said in full: the word, bold, in its tint. */
function SummaryStatus({ status }: { status: string | undefined }) {
  const word = status || "n/a";
  return (
    <span data-state={word} className={cn("font-semibold", STATUS_INK[word] ?? "text-state-unknown")}>
      {word}
    </span>
  );
}

/** The nodes a resource row reports the resource on: its cells holding a status. */
export function rowNodes(board: Board, row: BoardRow): string[] {
  return board.nodes.filter((_, i) => row.cells[i]?.some((s) => s.status !== undefined)).map((n) => n.name);
}

/**
 * What is selected on the board, and what changes it: the caller's state. A
 * resource is selected node by node, a cell each; an instance by its node.
 */
export interface BoardSelection {
  isNode: (node: string) => boolean;
  toggleNode: (node: string) => void;
  isCell: (rid: string, node: string) => boolean;
  toggleCell: (rid: string, node: string) => void;
  /** Selects the resource on all its nodes, or unselects it when it is already. */
  toggleRow: (rid: string) => void;
}

/**
 * What answers a click, drawn so: the hand, and on hover the tint and the edge
 * of a selection to come. Selected, the tint and the edge stay, the cells selected
 * side by side making one block, edged on its outside only (`selectionEdges`).
 */
const CLICKABLE = "cursor-pointer hover:bg-accent-soft/60 hover:inset-ring-1 hover:inset-ring-accent/60";
const SELECTED = "bg-accent-soft";

/**
 * The edge of a selected cell: on each side where its neighbour is not selected,
 * so that cells selected side by side read as one block. `at(row, column)` says
 * whether a cell of the grid is selected; out of the grid, it is not.
 */
export function selectionEdges(at: (row: number, column: number) => boolean, row: number, column: number): CSSProperties | undefined {
  if (!at(row, column)) return undefined;
  const line = "var(--accent)";
  const edges = [
    !at(row, column - 1) && `inset 1px 0 0 ${line}`,
    !at(row, column + 1) && `inset -1px 0 0 ${line}`,
    !at(row - 1, column) && `inset 0 1px 0 ${line}`,
    !at(row + 1, column) && `inset 0 -1px 0 ${line}`,
  ].filter(Boolean);
  return { boxShadow: edges.length === 0 ? "none" : edges.join(", ") };
}

/** A name selecting what it names: accent on hover. */
const CLICKABLE_NAME = "group-hover:text-accent";

/**
 * A checkbox out of sight, which the cell or the header holding it shows instead:
 * a click on them toggles it, and the keyboard and the screen readers reach it as
 * any checkbox.
 */
function HiddenCheckbox({
  checked,
  indeterminate = false,
  label,
  onToggle,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <input
      type="checkbox"
      className="sr-only"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      aria-label={label}
      onChange={onToggle}
      // The click toggles it: not the cell around too.
      onClick={(event) => event.stopPropagation()}
    />
  );
}

/** What holds a hidden checkbox shows its focus, as a focused control would. */
const FOCUS_WITHIN =
  "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-(--focus-ring)";

/**
 * The status of an object as `om <path> status` tells it (`statusboard.ts`), drawn
 * as the rest of the webapp: its summary, the table of its instances and resources
 * by node, and the notes saying what needs attention.
 *
 * With a `selection`, the resources and the instances are picked by a click: a
 * resource on a node by its cell, on all its nodes by its name, an instance by the
 * column header of its node or its instance cell. The caller acts on what is
 * picked, from its `toolbar`. Every node has its instance to pick, reported or
 * not: its column is empty then, and a click on it selects it as well.
 */
export function StatusBoard({
  board,
  selection,
  toolbar,
}: {
  board: Board;
  selection?: BoardSelection;
  /** What acts on the selection, over the table. */
  toolbar?: ReactNode;
}) {
  const { t } = useTranslation();
  const details = useCellDetails();
  const columns = board.nodes.length + 3;
  const field = (name: string) => board.fields.find((f) => f.name === name)?.value;
  const avail = field("avail")?.[0];
  const overall = field("overall")?.[0];
  const states = (field("state") ?? []).filter((s) => s.text !== ", ");
  const count = board.rows.find((r) => r.kind === "instance")?.desc[0];
  const resources = board.rows.filter((r) => r.kind === "resource").length;
  const instanceRow = board.rows.find((r) => r.kind === "instance");
  const nodeSelected = (node: string) => selection?.isNode(node) ?? false;

  /*
   * The grid of what is selected, as drawn: the header row first, then the rows of
   * the board; the column of the names first, then the nodes. Its neighbours tell
   * a selected cell where its edges go.
   */
  /** The rows as drawn: the instances under a heading of their own, as the resources. */
  type Shown = BoardRow | { kind: "instances" };
  const shown: Shown[] = board.rows.flatMap((r): Shown[] =>
    r.kind === "blank" ? [] : r.kind === "instance" ? [{ kind: "instances" }, r] : [r],
  );
  const instances = board.nodes.filter((_, j) =>
    (instanceRow?.cells[j] ?? []).some((s) => s.status !== undefined && s.status !== "undef"),
  ).length;
  const rowSelectState = (r: BoardRow) => {
    if (selection === undefined || r.kind !== "resource") return "none";
    const nodes = rowNodes(board, r);
    const n = nodes.filter((node) => selection.isCell(r.name, node)).length;
    return n === 0 ? "none" : n === nodes.length ? "all" : "some";
  };
  /** The rows of the instances: their heading, then the state, the monitor and the others. */
  const INSTANCE_ROWS: ReadonlySet<string> = new Set(["instances", "instance", "monitor", "expect", "provisioned", "orchestration"]);
  const selectedAt = (v: number, c: number): boolean => {
    if (selection === undefined || c < 0 || c > board.nodes.length) return false;
    const node = board.nodes[c - 1]?.name ?? "";
    if (v === 0) return c > 0 && nodeSelected(node);
    const r = shown[v - 1];
    if (r === undefined) return false;
    // A selected instance: its column, from its header down through the rows of the instances.
    if (INSTANCE_ROWS.has(r.kind)) return c > 0 && nodeSelected(node);
    if (c === 0) return rowSelectState(r as BoardRow) === "all";
    return r.kind === "resource" && rowNodes(board, r).includes(node) && selection.isCell(r.name, node);
  };
  /** The look of a selected cell: its edges, and no line of the rows under it inside a block. */
  const selectedLook = (v: number, c: number) => ({
    style: selectionEdges(selectedAt, v, c),
    className: cn(selectedAt(v, c) && SELECTED),
  });

  return (
    <div className="space-y-3">
      {/* The summary: the statuses of the object, one a line, then what is wrong with it, if anything. */}
      <dl className="grid w-max grid-cols-[auto_auto] items-center gap-x-3 gap-y-1">
        {avail !== undefined && (
          <>
            <dt className="text-ink-muted">{t("statusBoard.avail")}</dt>
            <dd><SummaryStatus status={avail.status} /></dd>
          </>
        )}
        {overall !== undefined && (
          <>
            <dt className="text-ink-muted">{t("statusBoard.overall")}</dt>
            <dd><SummaryStatus status={overall.status} /></dd>
          </>
        )}
        {count !== undefined && (
          <>
            <dt className="text-ink-muted">{t("statusBoard.instancesUp")}</dt>
            <dd className={cn("font-medium tabular-nums", count.tone === "error" && "text-state-down")}>{count.text}</dd>
          </>
        )}
      </dl>
      {states.length > 0 && (
        <ul aria-label={t("statusBoard.issues")} className="flex flex-col items-start gap-y-1">
          {states.map((s) =>
            s.text === "frozen" || s.text === "mixed-frozen" ? (
              <li key={s.text} className="inline-flex items-center gap-1 text-icon-network">
                <FrozenMark frozen />
                {t(`statusBoard.states.${s.text}`)}
              </li>
            ) : (
              <li key={s.text} className={cn("inline-flex items-center gap-1", TONES[s.tone ?? "secondary"])}>
                <AlertTriangleIcon className="h-3.5 w-3.5" />
                {t(`statusBoard.states.${s.text}`)}
              </li>
            ),
          )}
        </ul>
      )}

      {toolbar}

      {/* No border, no line between the rows: the tint and the edge of a selection stand out. */}
      <Table aria-label={t("statusBoard.caption", { path: board.path })} className="rounded-none border-0 bg-transparent">
        <thead>
          <HeaderRow className="border-b-0">
            <HeaderCell>
              <span className="sr-only">{t("statusBoard.item")}</span>
            </HeaderCell>
            {board.nodes.map((n, j) => {
              const pick = selection !== undefined;
              const picked = nodeSelected(n.name);
              const look = selectedLook(0, j + 1);
              return (
                <HeaderCell
                  key={n.name}
                  onClick={pick ? () => selection.toggleNode(n.name) : undefined}
                  style={look.style}
                  className={cn(pick && cn("group", CLICKABLE, FOCUS_WITHIN), look.className, picked && "text-ink")}
                >
                  <span className="flex w-full items-center gap-1">
                      {pick && (
                        <HiddenCheckbox
                          checked={picked}
                          label={t("statusBoard.selectInstance", { node: n.name })}
                          onToggle={() => selection.toggleNode(n.name)}
                        />
                      )}
                      <span className={cn(pick && CLICKABLE_NAME)}>{n.name}</span>
                      {n.frozen && <FrozenMark frozen />}
                  </span>
                </HeaderCell>
              );
            })}
            <HeaderCell>{t("common.type")}</HeaderCell>
            <HeaderCell>{t("statusBoard.description")}</HeaderCell>
          </HeaderRow>
        </thead>
        <tbody>
          {shown.map((r, i) => {
            if (r.kind === "instances")
              return (
                <tr key={i}>
                  <th scope="rowgroup" className="h-[1.875rem] px-2 pt-3 text-left font-semibold whitespace-nowrap text-ink">
                    {t("statusBoard.rows.instances", { count: instances })}
                  </th>
                  {/* Under each node, its instance: a click selects it, as anywhere in its column. */}
                  {board.nodes.map((n, j) => {
                    const pick = selection !== undefined;
                    const look = selectedLook(i + 1, j + 1);
                    return (
                      <td
                        key={n.name}
                        onClick={pick ? () => selection.toggleNode(n.name) : undefined}
                        style={look.style}
                        className={cn("pt-3", pick && CLICKABLE, look.className)}
                      />
                    );
                  })}
                  <td colSpan={2} />
                </tr>
              );
            if (r.kind === "resources")
              return (
                <tr key={i}>
                  <th scope="rowgroup" colSpan={columns} className="h-[1.875rem] px-2 pt-3 text-left font-semibold text-ink">
                    {t("statusBoard.rows.resources", { count: resources })}
                  </th>
                </tr>
              );
            // The instance row tells the state of each instance: under the heading of the instances.
            const name =
              r.kind === "resource" || r.kind === "subset"
                ? r.name
                : r.kind === "label"
                  ? ""
                  : r.kind === "instance"
                    ? t("statusBoard.rows.state")
                    : t(`statusBoard.rows.${r.kind}`);
            const pickRow = selection !== undefined && r.kind === "resource";
            const nodesOfRow = pickRow ? rowNodes(board, r) : [];
            const rowState = rowSelectState(r);
            // The place of the row in the grid of the selection, the header row first.
            const v = i + 1;
            const nameLook = selectedLook(v, 0);
            return (
              <Row key={i} className="border-b-0">
                <th
                  scope="row"
                  onClick={pickRow ? () => selection.toggleRow(r.name) : undefined}
                  className={cn(
                    "px-2 py-1 text-left whitespace-nowrap",
                    // The state, under its heading, sits with the monitor and the others.
                    INDENT[Math.min(r.kind === "instance" ? 1 : r.indent, INDENT.length - 1)],
                    r.kind === "resource" ? "font-medium" : r.kind === "subset" ? "font-normal text-ink-muted italic" : "font-normal",
                    (r.kind === "monitor" || r.kind === "expect" || r.kind === "provisioned" || r.kind === "orchestration") && "text-ink-muted",
                    pickRow && cn("group", CLICKABLE, FOCUS_WITHIN),
                    nameLook.className,
                  )}
                  style={nameLook.style}
                >
                  {pickRow && (
                    <HiddenCheckbox
                      checked={rowState === "all"}
                      indeterminate={rowState === "some"}
                      label={t("statusBoard.selectResource", { rid: r.name })}
                      onToggle={() => selection.toggleRow(r.name)}
                    />
                  )}
                  <HoverNotes notes={r.rowNotes} showNodes fill>
                    <span className="flex w-full items-center gap-1">
                      <span className={cn(pickRow && CLICKABLE_NAME)}>{name}</span>
                    </span>
                  </HoverNotes>
                </th>
                {r.cells.map((c, j) => {
                  const node = board.nodes[j]?.name ?? "";
                  // The instance cell picks its node, as the column header does; a
                  // resource cell, the resource on its node.
                  // Any cell of the instances selects the instance of its node, an empty one too.
                  const pickNode = INSTANCE_ROWS.has(r.kind) && selection !== undefined;
                  const pickCell = pickRow && nodesOfRow.includes(node);
                  const picked = pickNode ? nodeSelected(node) : pickCell && selection.isCell(r.name, node);
                  const look = selectedLook(v, j + 1);
                  return (
                    <Cell
                      style={look.style}
                      key={j}
                      onClick={
                        pickNode
                          ? () => selection.toggleNode(node)
                          : pickCell
                            ? () => selection.toggleCell(r.name, node)
                            : undefined
                      }
                      className={cn((pickNode || pickCell) && cn(CLICKABLE, FOCUS_WITHIN), look.className)}
                    >
                      {pickCell && (
                        <HiddenCheckbox
                          checked={picked}
                          label={t("statusBoard.selectCell", { rid: r.name, node })}
                          onToggle={() => selection.toggleCell(r.name, node)}
                        />
                      )}
                      <HoverNotes notes={r.cellNotes[j] ?? []} details={details(c)} fill>
                        <span className="flex w-full items-center gap-1">
                          <Pieces text={c} kind={r.kind} />
                        </span>
                      </HoverNotes>
                    </Cell>
                  );
                })}
                <Cell className="text-ink-muted">{r.typ}</Cell>
                <Cell className={cn("break-all", r.kind === "label" && "text-ink-muted")}>
                  {r.kind === "instance" ? null : r.kind === "subset" && r.desc.length > 0 ? (
                    <span className="rounded-full border border-line px-2 text-ink-muted">{t("statusBoard.parallel")}</span>
                  ) : (
                    r.desc.map((s) => s.text).join("")
                  )}
                </Cell>
              </Row>
            );
          })}
        </tbody>
      </Table>

      {board.notes.length > 0 && (
        <section aria-labelledby="status-notes" className="space-y-1">
          <h3 id="status-notes" className="px-2 font-semibold">
            {t("statusBoard.notes", { count: board.notes.length })}
          </h3>
          <ul className="space-y-2">
            {board.notes.map((g, i) => {
              const { ink, Icon } = LEVELS[g.level];
              return (
                <li key={i} className="flex gap-2 px-2">
                  <span className={cn("mt-0.5 shrink-0", ink)} title={t(`statusBoard.levels.${g.level}`)}>
                    <Icon className="h-4 w-4" />
                    <span className="sr-only">{t(`statusBoard.levels.${g.level}`)}</span>
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {g.heads.map((h, j) => (
                      <p key={j} className="flex flex-wrap items-baseline gap-x-2">
                        {h.marker !== "" && h.marker !== "·" && (
                          <sup className={cn("text-[0.75rem] font-medium", ink)}>{h.marker}</sup>
                        )}
                        <span className="font-medium">{h.subject}</span>
                        {h.nodes !== "" && (
                          <span className="text-ink-muted">
                            {h.nodes === "all" ? t("statusBoard.allNodes") : h.nodes}
                          </span>
                        )}
                      </p>
                    ))}
                    <p className={cn(g.level === "info" ? "text-ink-muted" : "text-ink")}>{g.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          {board.moreInfos > 0 && (
            <p className="px-2 text-ink-muted">
              {t("statusBoard.moreInfos", { count: board.moreInfos })}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
