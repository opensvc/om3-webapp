import { om3ObjectKind, type ObjectKind } from "../ui/components/ObjectIcon";

/**
 * The record opened in the panel over the current view, kept in the URL (`peek`) as
 * `kind:id`, as oc3 does: a reload or a shared link reopen it, and the browser Back
 * button returns to what was on display before. The records shown before it are
 * the panel history, kept by the browser tab (`record-history.ts`).
 */
export interface PeekStep {
  kind: string;
  id: string;
}

/**
 * The kinds of record a panel shows:
 * - `object`: an object, by its path (`ns/kind/name`), its instances shown by
 *   its status board;
 * - `network`: a network, by its name;
 * - `namespace`: the usage of a namespace, by its name.
 */
export type PeekKind = "object" | "network" | "namespace";

const PEEK_KINDS: ReadonlySet<string> = new Set<PeekKind>([
  "object",
  "network",
  "namespace",
]);

/** A step of another kind, from a hand-written URL or an old history, is dropped. */
export function isPeekStep(step: PeekStep): step is PeekStep & { kind: PeekKind } {
  return PEEK_KINDS.has(step.kind) && step.id !== "";
}

/** The id may hold colons: only the first one ends the kind. */
export function parseStep(raw: unknown): PeekStep | null {
  if (typeof raw !== "string") return null;
  const cut = raw.indexOf(":");
  if (cut <= 0 || cut === raw.length - 1) return null;
  const step = { kind: raw.slice(0, cut), id: raw.slice(cut + 1) };
  return isPeekStep(step) ? step : null;
}

export function serialiseStep(step: PeekStep): string {
  return `${step.kind}:${step.id}`;
}

/** The kind of an object path ("ns/kind/name", or a bare name for a root service). */
function pathKind(path: string): string | undefined {
  const parts = path.split("/");
  return parts.length === 3 ? parts[1] : parts.length === 2 ? parts[0] : undefined;
}

/** The pictogram of a record, the one of its object kind for objects. */
export function stepIcon(step: PeekStep): ObjectKind {
  switch (step.kind) {
    case "object":
      return om3ObjectKind(pathKind(step.id));
    case "network":
      return "network";
    case "namespace":
      return "namespace";
    default:
      return "service";
  }
}

/** The name of a record, as the history and the anchor show it. */
export function stepLabel(step: PeekStep): string {
  return step.id;
}
