/*
 * The relays the heartbeats of the cluster go through, as `om node relay status`
 * shows them: a heartbeat of type relay (hb#<name>, type = relay) has each node
 * write its message to a slot of a relay, a third host, and read the slots of its
 * peers there. Asked for its slots by the node answering the api (GET
 * /api/relay/status?remote=true&relay=<relay>), with the username and password of
 * the heartbeat, a relay says each slot: the node, the address it wrote from, when
 * and how much. A relay not reached is one item of its own, the reason in its
 * status and no node.
 */

/** A keyword of the cluster configuration, evaluated (GET /api/cluster/config?evaluate=true). */
export interface EvaluatedItem {
  keyword: string;
  value?: string;
  evaluated?: unknown;
}

/** A slot of a relay, or the relay not reached, as the daemon lists them. */
export interface RelayStatusItem {
  relay: string;
  cluster_id?: string;
  cluster_name?: string;
  nodename?: string;
  node_addr?: string;
  username?: string;
  msg_len?: number;
  updated_at?: string;
  /** Why the relay could not be asked; empty when it answered. */
  status?: string;
}

/** A heartbeat of type relay: its section, its relay, how long a peer is waited for. */
export interface RelayHeartbeat {
  section: string;
  relay: string;
  timeoutMs: number;
}

/** The timeout of a heartbeat when the daemon says none: its default, 15s. */
export const DEFAULT_TIMEOUT_MS = 15_000;

/** The keywords read of the heartbeats, by pattern: their type, relay and timeout. */
export const RELAY_KEYWORDS = ["hb#*.type", "hb#*.relay", "hb#*.timeout"];

/** A duration as the daemon evaluates it (nanoseconds), in ms; undefined when it is none. */
const nsToMs = (value: unknown) => (typeof value === "number" && value > 0 ? value / 1e6 : undefined);

/** The heartbeats of type relay of the cluster configuration, by section name. */
export function relayHeartbeats(items: EvaluatedItem[]): RelayHeartbeat[] {
  const sections = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    const dot = item.keyword.lastIndexOf(".");
    if (dot < 0) continue;
    const section = item.keyword.slice(0, dot);
    const values = sections.get(section) ?? {};
    values[item.keyword.slice(dot + 1)] = item.evaluated ?? item.value;
    sections.set(section, values);
  }
  return [...sections.entries()]
    .filter(([, v]) => v.type === "relay" && typeof v.relay === "string" && v.relay !== "")
    .map(([section, v]) => ({ section, relay: v.relay as string, timeoutMs: nsToMs(v.timeout) ?? DEFAULT_TIMEOUT_MS }))
    .sort((a, b) => a.section.localeCompare(b.section, undefined, { numeric: true }));
}

/**
 * A node as a relay holds it: writing (`up`), its last write older than the timeout
 * of the heartbeat (`stale`), or no slot of it at all (`missing`).
 */
export type SlotState = "up" | "stale" | "missing";

export interface SlotRow {
  node: string;
  state: SlotState;
  addr?: string;
  updatedAt?: string;
  ageMs?: number;
  msgLen?: number;
}

/** What a relay says of the cluster: why it could not be asked, or a row per node. */
export interface RelayView {
  error?: string;
  rows: SlotRow[];
}

/**
 * The slots of a relay for the cluster: a row per node of `nodes`, in that order,
 * then the nodes the relay holds a slot of that the cluster does not name; a node
 * of the cluster with no slot, missing; a slot of another cluster (`clusterId`
 * given), sharing the username on the relay, left out. `now` the time read, in ms. The age is
 * reckoned on the clock of the browser against the one of the relay: clocks apart
 * by more than the timeout say a slot stale.
 */
export function relayView(
  items: RelayStatusItem[],
  nodes: string[],
  timeoutMs: number,
  now: number,
  clusterId?: string,
): RelayView {
  const failed = items.find((i) => !i.nodename && i.status);
  if (failed) return { error: failed.status, rows: [] };
  const slots = new Map<string, RelayStatusItem>();
  for (const item of items) {
    if (!item.nodename) continue;
    if (clusterId && item.cluster_id && item.cluster_id !== clusterId) continue;
    const seen = slots.get(item.nodename);
    // Two slots of a node, written from two addresses: the latest.
    if (!seen || String(item.updated_at ?? "") > String(seen.updated_at ?? "")) slots.set(item.nodename, item);
  }
  const order = [...nodes, ...[...slots.keys()].filter((n) => !nodes.includes(n)).sort()];
  return {
    rows: order.map((node) => {
      const slot = slots.get(node);
      if (!slot) return { node, state: "missing" };
      const written = Date.parse(slot.updated_at ?? "");
      const ageMs = Number.isNaN(written) ? undefined : Math.max(0, now - written);
      return {
        node,
        state: ageMs !== undefined && ageMs <= timeoutMs ? "up" : "stale",
        addr: slot.node_addr,
        updatedAt: slot.updated_at,
        ageMs,
        msgLen: slot.msg_len,
      };
    }),
  };
}

/** The state of a relay as a whole: down when not asked or no node writes, warn when one does not. */
export function relayState(view: RelayView): "up" | "warn" | "down" {
  if (view.error !== undefined) return "down";
  const up = view.rows.filter((r) => r.state === "up").length;
  if (up === 0) return "down";
  return up === view.rows.length ? "up" : "warn";
}
